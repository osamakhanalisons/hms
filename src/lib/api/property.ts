import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";

// ── Get full property tree ─────────────────────────────────────────────────
export const getPropertyTreeFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return { societies: [], blocks: [], buildings: [], floors: [], units: [] };

  const db = getDb();
  const [societies] = (await db.query("SELECT * FROM societies WHERE tenant_id = ? ORDER BY name", [
    tenantId,
  ])) as any[];
  const [blocks] = (await db.query("SELECT * FROM blocks WHERE tenant_id = ? ORDER BY name", [
    tenantId,
  ])) as any[];
  const [buildings] = (await db.query("SELECT * FROM buildings WHERE tenant_id = ? ORDER BY name", [
    tenantId,
  ])) as any[];
  const [floors] = (await db.query(
    "SELECT * FROM floors WHERE tenant_id = ? ORDER BY floor_number",
    [tenantId],
  )) as any[];
  const [units] = (await db.query("SELECT * FROM units WHERE tenant_id = ? ORDER BY unit_number", [
    tenantId,
  ])) as any[];

  return { societies, blocks, buildings, floors, units };
});

// ── Units list (flat) ──────────────────────────────────────────────────────
export const getUnitsFn = createServerFn({ method: "GET" })
  .validator(z.object({ societyId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const db = getDb();
    let query = `
      SELECT u.*, s.name AS society_name, bl.name AS block_name, b.name AS building_name, f.floor_number
      FROM units u
      LEFT JOIN societies s ON s.id = u.society_id
      LEFT JOIN blocks bl ON bl.id = u.block_id
      LEFT JOIN buildings b ON b.id = u.building_id
      LEFT JOIN floors f ON f.id = u.floor_id
      WHERE u.tenant_id = ?
    `;
    const params: any[] = [tenantId];
    if (data?.societyId) {
      query += " AND u.society_id = ?";
      params.push(data.societyId);
    }
    query += " ORDER BY u.unit_number";

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });

// ── Create society ─────────────────────────────────────────────────────────
export const createSocietyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      city: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO societies (id, tenant_id, name, address, city) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, data.name, data.address || null, data.city || null],
    );
    return { id };
  });

// ── Create block ───────────────────────────────────────────────────────────
export const createBlockFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      societyId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO blocks (id, society_id, tenant_id, name, description) VALUES (?, ?, ?, ?, ?)",
      [id, data.societyId, tenantId, data.name, data.description || null],
    );
    return { id };
  });

// ── Create building ────────────────────────────────────────────────────────
export const createBuildingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      blockId: z.string(),
      name: z.string().min(1),
      floorsCount: z.number().int().min(1).optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, ?, ?)",
      [id, data.blockId, tenantId, data.name, data.floorsCount ?? 1],
    );
    return { id };
  });

// ── Create unit ────────────────────────────────────────────────────────────
export const createUnitFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      societyId: z.string(),
      blockId: z.string().optional(),
      buildingId: z.string().optional(),
      floorId: z.string().optional(),
      unitNumber: z.string().min(1),
      unitType: z.enum(["flat", "villa", "shop", "office", "penthouse", "other"]).optional(),
      areaSqft: z.number().optional(),
      bedrooms: z.number().int().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO units (id, society_id, block_id, building_id, floor_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.societyId,
        data.blockId || null,
        data.buildingId || null,
        data.floorId || null,
        tenantId,
        data.unitNumber,
        data.unitType || "flat",
        data.areaSqft || null,
        data.bedrooms || null,
      ],
    );
    return { id };
  });

// ── Update unit status ─────────────────────────────────────────────────────
export const updateUnitStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      unitId: z.string(),
      status: z.enum(["occupied", "vacant", "renovation", "locked"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    await db.query("UPDATE units SET status = ? WHERE id = ? AND tenant_id = ?", [
      data.status,
      data.unitId,
      tenantId,
    ]);
    return { success: true };
  });


// ── Update society ─────────────────────────────────────────────────────────
export const updateSocietyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      address: z.string().optional(),
      city: z.string().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE societies SET name = ?, address = ?, city = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.address || null, data.city || null, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete society ─────────────────────────────────────────────────────────
export const deleteSocietyFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [blocks] = await db.query("SELECT id FROM blocks WHERE society_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (blocks.length > 0) {
      throw new Error("Cannot delete society because it contains blocks. Please delete or move them first.");
    }
    
    await db.query("DELETE FROM societies WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });

// ── Update block ───────────────────────────────────────────────────────────
export const updateBlockFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE blocks SET name = ?, description = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.description || null, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete block ───────────────────────────────────────────────────────────
export const deleteBlockFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [buildings] = await db.query("SELECT id FROM buildings WHERE block_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (buildings.length > 0) {
      throw new Error("Cannot delete block because it contains buildings. Please delete or move them first.");
    }
    const [units] = await db.query("SELECT id FROM units WHERE block_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (units.length > 0) {
      throw new Error("Cannot delete block because it contains units. Please delete or move them first.");
    }
    
    await db.query("DELETE FROM blocks WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });

// ── Update building ────────────────────────────────────────────────────────
export const updateBuildingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      floorsCount: z.number().int().min(1).optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE buildings SET name = ?, floors_count = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.floorsCount ?? 1, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete building ────────────────────────────────────────────────────────
export const deleteBuildingFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [units] = await db.query("SELECT id FROM units WHERE building_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (units.length > 0) {
      throw new Error("Cannot delete building because it contains units. Please delete or move them first.");
    }
    
    await db.query("DELETE FROM buildings WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });

// ── Update unit ────────────────────────────────────────────────────────────
export const updateUnitFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      unitNumber: z.string().min(1),
      unitType: z.enum(["flat", "villa", "shop", "office", "penthouse", "other"]).optional(),
      areaSqft: z.number().optional(),
      bedrooms: z.number().int().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE units SET unit_number = ?, unit_type = ?, area_sqft = ?, bedrooms = ? WHERE id = ? AND tenant_id = ?",
      [data.unitNumber, data.unitType || "flat", data.areaSqft || null, data.bedrooms || null, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete unit ────────────────────────────────────────────────────────────
export const deleteUnitFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [units] = await db.query("SELECT status FROM units WHERE id = ? AND tenant_id = ?", [data.id, tenantId]) as any[];
    if (units.length > 0 && units[0].status === "occupied") {
      throw new Error("Cannot delete unit because it is currently occupied. Please vacate it first.");
    }
    
    const [residents] = await db.query("SELECT id FROM residents WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (residents.length > 0) {
      throw new Error("Cannot delete unit because it has resident records associated with it.");
    }
    
    await db.query("DELETE FROM units WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });
