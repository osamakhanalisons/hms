import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserTenantId,
  getUserRoles,
  isAdminRole,
  getTenantScoping,
} from "./auth-helper";
import { requirePermission } from "./permissions";

// ─── Types ────────────────────────────────────────────────────────────────────
export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitOfMeasure: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  stockValue: number;
  location: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
  createdAt: string;
};

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  movementType: "in" | "out" | "adjustment" | "return";
  quantity: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
};

export type InventoryOverview = {
  summary: {
    totalItems: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockValue: number;
  };
  items: InventoryItem[];
  recentMovements: StockMovement[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

// ─── GET OVERVIEW ────────────────────────────────────────────────────────────
export const getInventoryOverviewFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        category: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const scoping = await getTenantScoping(request, data?.tenantId);
    let tenantId = scoping.tenantId;
    const db = getDb();

    if (!tenantId) {
      tenantId = scoping.userTenantId || "";
    }
    if (!tenantId) {
      const [tenants] = (await db.query(
        "SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1",
      )) as unknown as [{ id: string }[], unknown];
      if (tenants.length > 0) {
        tenantId = tenants[0].id;
      }
    }

    if (!tenantId) {
      return {
        summary: {
          totalItems: 0,
          totalUnits: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalStockValue: 0,
        },
        items: [],
        recentMovements: [],
      } satisfies InventoryOverview;
    }

    // ── Summary KPIs (aggregate from inventory_items) ─────────────────────────
    const [[sumRow]] = (await db.query(
      `SELECT
         COUNT(*) AS total_items,
         COALESCE(SUM(quantity), 0) AS total_units,
         SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock_cnt,
         SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock_cnt,
         COALESCE(SUM(quantity * unit_cost), 0) AS total_value
       FROM inventory_items
       WHERE tenant_id = ?`,
      [tenantId],
    )) as any[];

    // ── Items (with optional filters) ─────────────────────────────────────────
    let itemQuery = `
      SELECT *
      FROM inventory_items
      WHERE tenant_id = ?
    `;
    const itemParams: any[] = [tenantId];

    if (data?.category && data.category !== "all") {
      itemQuery += " AND category = ?";
      itemParams.push(data.category);
    }

    if (data?.search && data.search.trim() !== "") {
      const q = `%${data.search.trim()}%`;
      itemQuery += " AND (name LIKE ? OR sku LIKE ? OR location LIKE ?)";
      itemParams.push(q, q, q);
    }

    if (data?.status && data.status !== "all") {
      if (data.status === "out_of_stock") {
        itemQuery += " AND quantity <= 0";
      } else if (data.status === "low_stock") {
        itemQuery += " AND quantity > 0 AND quantity <= reorder_level";
      } else if (data.status === "in_stock") {
        itemQuery += " AND quantity > reorder_level";
      }
    }

    itemQuery += " ORDER BY name ASC";

    const [itemRows] = (await db.query(itemQuery, itemParams)) as any[];

    const items: InventoryItem[] = (itemRows as any[]).map((r) => {
      const qty = Number(r.quantity ?? 0);
      const rl = Number(r.reorder_level ?? 0);
      const cost = Number(r.unit_cost ?? 0);
      const status: InventoryItem["status"] =
        qty <= 0 ? "out_of_stock" : qty <= rl ? "low_stock" : "in_stock";
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        category: r.category || "General",
        unitOfMeasure: r.unit_of_measure || "pcs",
        quantity: qty,
        reorderLevel: rl,
        unitCost: cost,
        stockValue: Math.round(qty * cost * 100) / 100,
        location: r.location ?? null,
        status,
        createdAt: toISO(r.created_at),
      };
    });

    // ── Recent 20 Movements ────────────────────────────────────────────────────
    const [movRows] = (await db.query(
      `SELECT sm.*, ii.name AS item_name
       FROM stock_movements sm
       JOIN inventory_items ii ON ii.id = sm.item_id
       WHERE sm.tenant_id = ?
       ORDER BY sm.created_at DESC
       LIMIT 20`,
      [tenantId],
    )) as any[];

    const recentMovements: StockMovement[] = (movRows as any[]).map((r) => ({
      id: r.id,
      itemId: r.item_id,
      itemName: r.item_name,
      movementType: r.movement_type,
      quantity: Number(r.quantity ?? 0),
      reference: r.reference ?? null,
      notes: r.notes ?? null,
      createdAt: toISO(r.created_at),
    }));

    return {
      summary: {
        totalItems: Number(sumRow?.total_items ?? 0),
        totalUnits: Number(sumRow?.total_units ?? 0),
        lowStockCount: Number(sumRow?.low_stock_cnt ?? 0),
        outOfStockCount: Number(sumRow?.out_of_stock_cnt ?? 0),
        totalStockValue: Math.round(Number(sumRow?.total_value ?? 0) * 100) / 100,
      },
      items,
      recentMovements,
    } satisfies InventoryOverview;
  });

// ─── ADD INVENTORY ITEM ───────────────────────────────────────────────────────
export const addInventoryItemFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      sku: z.string().min(1),
      category: z.string().optional(),
      unitOfMeasure: z.string().optional(),
      reorderLevel: z.number().nonnegative().optional(),
      unitCost: z.number().nonnegative().optional(),
      location: z.string().optional(),
      openingStock: z.number().nonnegative().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "inventory", "create");

    const db = getDb();

    // Prevent duplicate SKU within tenant
    const [[dupRow]] = (await db.query(
      "SELECT id FROM inventory_items WHERE tenant_id = ? AND sku = ?",
      [tenantId, data.sku.trim()],
    )) as any[];
    if (dupRow) throw new Error(`SKU "${data.sku}" already exists`);

    const itemId = crypto.randomUUID();
    const openingQty = data.openingStock ?? 0;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO inventory_items
           (id, tenant_id, name, sku, category, unit_of_measure, quantity, reorder_level, unit_cost, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          tenantId,
          data.name.trim(),
          data.sku.trim(),
          data.category || "General",
          data.unitOfMeasure || "pcs",
          openingQty,
          data.reorderLevel ?? 10,
          data.unitCost ?? 0,
          data.location || null,
        ],
      );

      // Record opening stock movement if provided
      if (openingQty > 0) {
        const movId = crypto.randomUUID();
        await connection.query(
          `INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, reference, notes, created_by)
           VALUES (?, ?, ?, 'in', ?, 'OPENING', 'Opening stock', ?)`,
          [movId, tenantId, itemId, openingQty, userId],
        );
      }

      await connection.commit();
      return { id: itemId, success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });

// ─── RECORD STOCK MOVEMENT ────────────────────────────────────────────────────
export const recordStockMovementFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      itemId: z.string(),
      movementType: z.enum(["in", "out", "adjustment", "return"]),
      quantity: z.number().positive("Quantity must be greater than zero"),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "inventory", "edit");

    if (data.quantity <= 0) throw new Error("Quantity must be greater than zero");

    const db = getDb();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Lock the inventory item row for this transaction
      const [[item]] = (await connection.query(
        "SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ? FOR UPDATE",
        [data.itemId, tenantId],
      )) as any[];

      if (!item) throw new Error("Inventory item not found or unauthorized");

      const currentQty = Number(item.quantity ?? 0);
      let newQty = currentQty;

      if (data.movementType === "in" || data.movementType === "return") {
        newQty = currentQty + data.quantity;
      } else if (data.movementType === "out") {
        if (data.quantity > currentQty) {
          throw new Error(
            `Insufficient stock. Available: ${currentQty} ${item.unit_of_measure}, Requested: ${data.quantity}`,
          );
        }
        newQty = currentQty - data.quantity;
      } else if (data.movementType === "adjustment") {
        // quantity field represents the DELTA (positive = increase, negative not allowed via UI
        // Adjustment can be a direct set via positive/negative notation — UI sends absolute delta
        newQty = currentQty + data.quantity; // For adjustments with positive qty = add
      }

      // Prevent negative stock
      if (newQty < 0) {
        throw new Error("Stock cannot go below zero");
      }

      // Insert movement record
      const movId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, reference, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movId,
          tenantId,
          data.itemId,
          data.movementType,
          data.quantity,
          data.reference || null,
          data.notes || null,
          userId,
        ],
      );

      // Update inventory_items.quantity (single source of truth)
      await connection.query(
        "UPDATE inventory_items SET quantity = ? WHERE id = ? AND tenant_id = ?",
        [newQty, data.itemId, tenantId],
      );

      await connection.commit();
      return { success: true, previousQty: currentQty, newQty };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });
