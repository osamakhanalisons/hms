import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";
import { createNotification, createBulkNotifications, NOTIFICATION_TYPES } from "../services/notification-service";

export const getLedgerFn = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string(), tenantId: z.string().optional() }))
  .handler(async ({ data, request }: any) => {
    const { tenantId, roles, userId } = await requirePermission(request, "ledger", "view");
    const isAdmin = isAdminRole(roles);
    const db = getDb();

    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "le.tenant_id");

    if (!isAdmin) {
      // Check if this unit belongs to the resident
      const [ownerCheck] = (await db.query(
        `SELECT r.id FROM residents r
         INNER JOIN persons p ON r.person_id = p.id
         WHERE r.unit_id = ? AND p.user_id = ? AND r.is_current = 1`,
        [data.unitId, userId],
      )) as any[];

      if (ownerCheck.length === 0) {
        throw new Error("Access denied — you can only view your own unit's ledger");
      }
    }

    const [rows] = (await db.query(
      `SELECT le.*, ch.name AS charge_head_name
       FROM ledger_entries le
       LEFT JOIN charge_heads ch ON ch.id = le.charge_head_id
       WHERE le.unit_id = ? AND ${sqlFilter}
       ORDER BY le.created_at ASC`,
      [data.unitId, ...sqlParams],
    )) as any[];
    return rows;
  });

export const getChargeHeadsFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }: any) => {
    await requirePermission(request, "ledger", "view");
    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const [rows] = (await db.query(
      `SELECT * FROM charge_heads WHERE ${sqlFilter} AND is_active = TRUE`,
      sqlParams,
    )) as any[];
    return rows;
  });

export const createChargeHeadFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      defaultAmount: z.number().optional(),
    }),
  )
  .handler(async ({ data, request }: any) => {
    const { tenantId } = await requirePermission(request, "ledger", "create");

    const db = getDb();
    // Same society should not have duplicate ACTIVE charge heads with the same name.
    const [existing] = (await db.query(
      "SELECT id FROM charge_heads WHERE tenant_id = ? AND name = ? AND is_active = TRUE",
      [tenantId, data.name.trim()],
    )) as any[];
    if (existing.length > 0) {
      throw new Error(`A charge head with the name "${data.name.trim()}" already exists in this society.`);
    }

    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, data.name.trim(), data.description || null, data.defaultAmount || null],
    );
    return { id };
  });

export const generateBulkChargesFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      chargeHeadId: z.string(),
      billingPeriod: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
      amount: z.number().positive(),
      description: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }: any) => {
    const { tenantId, userId } = await requirePermission(request, "ledger", "create");

    const db = getDb();

    // Verify charge head belongs to current tenant/society context and is active
    const [chCheck] = (await db.query(
      "SELECT id FROM charge_heads WHERE id = ? AND tenant_id = ? AND is_active = TRUE",
      [data.chargeHeadId, tenantId],
    )) as any[];
    if (chCheck.length === 0) {
      throw new Error("Invalid charge head selected for this society.");
    }

    // Get all occupied/vacant units
    const [units] = (await db.query(
      "SELECT id FROM units WHERE tenant_id = ? AND status IN ('occupied', 'vacant')",
      [tenantId],
    )) as any[];

    if (units.length === 0) return { count: 0 };

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const u of units) {
        // Calculate running balance
        const [lastBal] = (await connection.query(
          "SELECT balance_after FROM ledger_entries WHERE unit_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1",
          [u.id, tenantId],
        )) as any[];

        const prevBal = lastBal.length ? Number(lastBal[0].balance_after) : 0;
        const newBal = prevBal + data.amount;

        const ledgerId = crypto.randomUUID();
        await connection.query(
          `INSERT INTO ledger_entries (id, unit_id, tenant_id, type, charge_head_id, amount, description, billing_period, balance_after, created_by)
           VALUES (?, ?, ?, 'charge', ?, ?, ?, ?, ?, ?)`,
          [
            ledgerId,
            u.id,
            tenantId,
            data.chargeHeadId,
            data.amount,
            data.description || "Monthly Charge",
            data.billingPeriod,
            newBal,
            userId,
          ],
        );
      }

      await connection.commit();

      // Dispatch bill notifications to affected residents in bulk
      try {
        const unitIds = units.map((u: any) => u.id);
        const [resRows] = (await db.query(
          `SELECT p.user_id, u.unit_number
           FROM residents r
           JOIN persons p ON p.id = r.person_id
           JOIN units u ON u.id = r.unit_id
           WHERE r.unit_id IN (?) AND r.is_current = TRUE AND r.tenant_id = ?`,
          [unitIds, tenantId],
        )) as any[];

        if (resRows.length > 0) {
          const notifs = resRows
            .filter((r: any) => Boolean(r.user_id))
            .map((r: any) => ({
              userId: r.user_id,
              tenantId,
              type: NOTIFICATION_TYPES.BILL_GENERATED,
              title: "New Bill Available",
              message: `Your ${data.billingPeriod} maintenance bill of PKR ${data.amount.toLocaleString()} is now available.`,
              data: { billingPeriod: data.billingPeriod, amount: data.amount, unitNumber: r.unit_number },
            }));

          createBulkNotifications(notifs).catch((err) =>
            console.error("[LedgerNotification] Error in bulk notifications:", err),
          );
        }
      } catch (notifErr) {
        console.error("[LedgerNotification] Error preparing bulk bill notifications:", notifErr);
      }

      return { count: units.length };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });

export const createManualChargeFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      unitId: z.string(),
      chargeHeadId: z.string(),
      amount: z.number().positive(),
      description: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }: any) => {
    const { tenantId, userId } = await requirePermission(request, "ledger", "create");

    const db = getDb();

    // Verify charge head belongs to current tenant/society context and is active
    const [chCheck] = (await db.query(
      "SELECT id FROM charge_heads WHERE id = ? AND tenant_id = ? AND is_active = TRUE",
      [data.chargeHeadId, tenantId],
    )) as any[];
    if (chCheck.length === 0) {
      throw new Error("Invalid charge head selected for this society.");
    }

    // Verify target unit belongs to tenant
    const [unitCheck] = (await db.query(
      "SELECT id FROM units WHERE id = ? AND tenant_id = ?",
      [data.unitId, tenantId],
    )) as any[];
    if (unitCheck.length === 0) {
      throw new Error("Invalid unit selected for this society.");
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [lastBal] = (await connection.query(
        "SELECT balance_after FROM ledger_entries WHERE unit_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1",
        [data.unitId, tenantId],
      )) as any[];

      const prevBal = lastBal.length ? Number(lastBal[0].balance_after) : 0;
      const newBal = prevBal + data.amount;

      const ledgerId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO ledger_entries (id, unit_id, tenant_id, type, charge_head_id, amount, description, balance_after, created_by)
         VALUES (?, ?, ?, 'charge', ?, ?, ?, ?, ?)`,
        [
          ledgerId,
          data.unitId,
          tenantId,
          data.chargeHeadId,
          data.amount,
          data.description,
          newBal,
          userId,
        ],
      );

      await connection.commit();

      // Notify resident of manual charge
      try {
        const [resRows] = (await db.query(
          `SELECT p.user_id, u.unit_number
           FROM residents r
           JOIN persons p ON p.id = r.person_id
           JOIN units u ON u.id = r.unit_id
           WHERE r.unit_id = ? AND r.is_current = TRUE AND r.tenant_id = ?`,
          [data.unitId, tenantId],
        )) as any[];

        if (resRows.length > 0 && resRows[0].user_id) {
          createNotification({
            userId: resRows[0].user_id,
            tenantId,
            type: NOTIFICATION_TYPES.BILL_GENERATED,
            title: "New Charge Posted",
            message: `A new charge of PKR ${data.amount.toLocaleString()} has been posted to your ledger (${data.description}).`,
            data: { unitId: data.unitId, amount: data.amount, description: data.description },
          }).catch((err) => console.error("[LedgerNotification] Error in manual charge notification:", err));
        }
      } catch (notifErr) {
        console.error("[LedgerNotification] Error dispatching manual charge notification:", notifErr);
      }

      return { id: ledgerId };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });

