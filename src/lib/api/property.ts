import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, resolveTenantId, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";

// ── Get full property tree ─────────────────────────────────────────────────
export const getPropertyTreeFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");

    const [
      [societies],
      [blocks],
      [buildings],
      [floors],
      [units],
    ] = (await Promise.all([
      db.query(`SELECT id, name, address, city FROM societies WHERE ${sqlFilter} ORDER BY name`, sqlParams),
      db.query(`SELECT id, society_id, name FROM blocks WHERE ${sqlFilter} ORDER BY name`, sqlParams),
      db.query(`SELECT id, block_id, name, floors_count FROM buildings WHERE ${sqlFilter} ORDER BY name`, sqlParams),
      db.query(`SELECT id, building_id, floor_number, name FROM floors WHERE ${sqlFilter} ORDER BY floor_number`, sqlParams),
      db.query(`SELECT id, floor_id, building_id, block_id, society_id, unit_number, unit_type, status, area_sqft, bedrooms FROM units WHERE ${sqlFilter} ORDER BY unit_number`, sqlParams),
    ])) as any[];

    return { societies, blocks, buildings, floors, units };
  });

// ── Units list (flat) ──────────────────────────────────────────────────────
export const getUnitsFn = createServerFn({ method: "GET" })
  .validator(
    z.object({
      societyId: z.string().optional(),
      vacantOnly: z.boolean().optional(),
      tenantId: z.string().optional(),
    }).optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const userTenantId = await getUserTenantId(userId);

    const roles = await getUserRoles(userId);
    const isAdmin = isAdminRole(roles);

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "u.tenant_id");

    let query = `
      SELECT DISTINCT u.id, u.tenant_id, u.society_id, u.block_id, u.building_id, u.floor_id, u.unit_number, u.unit_type, u.area_sqft, u.bedrooms, u.status, 
             s.name AS society_name, bl.name AS block_name, b.name AS building_name, f.floor_number,
             CONCAT_WS(' › ', s.name, bl.name, b.name, CONCAT('Unit ', u.unit_number)) AS full_path
      FROM units u
      LEFT JOIN societies s ON s.id = u.society_id
      LEFT JOIN blocks bl ON bl.id = u.block_id
      LEFT JOIN buildings b ON b.id = u.building_id
      LEFT JOIN floors f ON f.id = u.floor_id
    `;
    const params: any[] = [];

    if (isAdmin) {
      query += ` WHERE ${sqlFilter}`;
      params.push(...sqlParams);
      if (data?.societyId) {
        query += " AND u.society_id = ?";
        params.push(data.societyId);
      }
      if (data?.vacantOnly) {
        query += " AND u.status = 'vacant'";
      }
    } else {
      query += `
        INNER JOIN residents r ON r.unit_id = u.id
        INNER JOIN persons p ON r.person_id = p.id
        WHERE p.user_id = ?
        AND r.is_current = 1
        AND u.tenant_id = ?
      `;
      params.push(userId, userTenantId || "");
      if (data?.societyId) {
        query += " AND u.society_id = ?";
        params.push(data.societyId);
      }
      if (data?.vacantOnly) {
        query += " AND u.status = 'vacant'";
      }
    }

    query += " ORDER BY s.name, bl.name, b.name, u.unit_number ASC";

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
    const roles = await getUserRoles(userId);
    if (!roles.includes("super_admin")) {
      throw new Error("Forbidden — Only Super Admin can create a society");
    }
    const tenantId = await resolveTenantId(request);

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
    const { tenantId } = await requirePermission(request, "property", "create");

    const db = getDb();
    const [[society]] = (await db.query(
      "SELECT id FROM societies WHERE id = ? AND tenant_id = ?",
      [data.societyId, tenantId],
    )) as any[];
    if (!society) {
      throw new Error("Forbidden — Society not found or unauthorized");
    }

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
    const { tenantId } = await requirePermission(request, "property", "create");

    const db = getDb();
    const [[block]] = (await db.query(
      "SELECT id FROM blocks WHERE id = ? AND tenant_id = ?",
      [data.blockId, tenantId],
    )) as any[];
    if (!block) {
      throw new Error("Forbidden — Block not found or unauthorized");
    }

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
      unitType: z.enum(["flat", "apartment", "villa", "house", "shop", "office", "penthouse", "other"]).optional(),
      areaSqft: z.number().optional(),
      bedrooms: z.number().int().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "property", "create");

    const db = getDb();

    // Verify properties and structure constraints
    const resolvedType = data.unitType || "flat";
    const isApartment = resolvedType === "flat" || resolvedType === "apartment";

    if (isApartment) {
      if (!data.blockId || !data.buildingId || !data.floorId) {
        throw new Error("Block, building, and floor are required for apartments.");
      }
    } else {
      // Standalone House, Villa, Shop, etc. do not have buildings/floors
      data.buildingId = undefined;
      data.floorId = undefined;
    }

    // Verify society belongs to tenant
    const [[society]] = (await db.query(
      "SELECT id FROM societies WHERE id = ? AND tenant_id = ?",
      [data.societyId, tenantId],
    )) as any[];
    if (!society) {
      throw new Error("Forbidden — Society not found or unauthorized");
    }

    // Verify block belongs to society and tenant
    if (data.blockId) {
      const [[block]] = (await db.query(
        "SELECT id FROM blocks WHERE id = ? AND tenant_id = ? AND society_id = ?",
        [data.blockId, tenantId, data.societyId],
      )) as any[];
      if (!block) {
        throw new Error("Forbidden — Block not found or unauthorized");
      }
    }

    // Verify building belongs to tenant
    if (data.buildingId) {
      const [[building]] = (await db.query(
        "SELECT id FROM buildings WHERE id = ? AND tenant_id = ?",
        [data.buildingId, tenantId],
      )) as any[];
      if (!building) {
        throw new Error("Forbidden — Building not found or unauthorized");
      }
      if (data.blockId) {
        const [[buildingBlock]] = (await db.query(
          "SELECT id FROM buildings WHERE id = ? AND block_id = ?",
          [data.buildingId, data.blockId],
        )) as any[];
        if (!buildingBlock) {
          throw new Error("Forbidden — Building does not belong to the selected block");
        }
      }
    }

    // Verify floor belongs to tenant
    if (data.floorId) {
      const [[floor]] = (await db.query(
        "SELECT id FROM floors WHERE id = ? AND tenant_id = ?",
        [data.floorId, tenantId],
      )) as any[];
      if (!floor) {
        throw new Error("Forbidden — Floor not found or unauthorized");
      }
      if (data.buildingId) {
        const [[floorBuilding]] = (await db.query(
          "SELECT id FROM floors WHERE id = ? AND building_id = ?",
          [data.floorId, data.buildingId],
        )) as any[];
        if (!floorBuilding) {
          throw new Error("Forbidden — Floor does not belong to the selected building");
        }
      }
    }

    // Check if a unit with the same unit_number already exists in this same building/block/society
    let duplicateQuery = `
      SELECT id FROM units 
      WHERE tenant_id = ? 
        AND unit_number = ?
    `;
    const duplicateParams: any[] = [tenantId, data.unitNumber];

    if (data.buildingId) {
      duplicateQuery += " AND building_id = ?";
      duplicateParams.push(data.buildingId);
    } else {
      duplicateQuery += " AND building_id IS NULL";
    }

    if (data.blockId) {
      duplicateQuery += " AND block_id = ?";
      duplicateParams.push(data.blockId);
    } else {
      duplicateQuery += " AND block_id IS NULL";
    }

    if (data.societyId) {
      duplicateQuery += " AND society_id = ?";
      duplicateParams.push(data.societyId);
    } else {
      duplicateQuery += " AND society_id IS NULL";
    }

    const [existing] = (await db.query(duplicateQuery, duplicateParams)) as any[];
    if (existing && existing.length > 0) {
      throw new Error(`Unit '${data.unitNumber}' already exists here.`);
    }

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
        resolvedType,
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
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "property", "edit");

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
    const { tenantId } = await requirePermission(request, "property", "edit");
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
    const { tenantId } = await requirePermission(request, "property", "delete");
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
    const { tenantId } = await requirePermission(request, "property", "edit");
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
    const { tenantId } = await requirePermission(request, "property", "delete");
    const db = getDb();

    await db.query("DELETE FROM units WHERE block_id = ? AND tenant_id = ?", [data.id, tenantId]);
    await db.query("DELETE FROM buildings WHERE block_id = ? AND tenant_id = ?", [data.id, tenantId]);
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
    const { tenantId } = await requirePermission(request, "property", "edit");
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
    const { tenantId } = await requirePermission(request, "property", "delete");
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
      unitType: z.enum(["flat", "apartment", "villa", "house", "shop", "office", "penthouse", "other"]).optional(),
      areaSqft: z.number().optional(),
      bedrooms: z.number().int().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "property", "edit");
    const db = getDb();

    // Fetch parent IDs for the unit to scope duplicate check
    const [currentUnit] = (await db.query(
      "SELECT society_id, block_id, building_id FROM units WHERE id = ? AND tenant_id = ?",
      [data.id, tenantId]
    )) as any[];
    if (!currentUnit || currentUnit.length === 0) {
      throw new Error("Unit not found");
    }
    const { society_id, block_id, building_id } = currentUnit[0];

    // Check if another unit has the same number in the same building/block/society
    let duplicateQuery = `
      SELECT id FROM units 
      WHERE tenant_id = ? 
        AND unit_number = ?
        AND id != ?
    `;
    const duplicateParams: any[] = [tenantId, data.unitNumber, data.id];

    if (building_id) {
      duplicateQuery += " AND building_id = ?";
      duplicateParams.push(building_id);
    } else {
      duplicateQuery += " AND building_id IS NULL";
    }

    if (block_id) {
      duplicateQuery += " AND block_id = ?";
      duplicateParams.push(block_id);
    } else {
      duplicateQuery += " AND block_id IS NULL";
    }

    if (society_id) {
      duplicateQuery += " AND society_id = ?";
      duplicateParams.push(society_id);
    } else {
      duplicateQuery += " AND society_id IS NULL";
    }

    const [existing] = (await db.query(duplicateQuery, duplicateParams)) as any[];
    if (existing && existing.length > 0) {
      throw new Error(`Another unit with number '${data.unitNumber}' already exists here.`);
    }

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
    const { tenantId } = await requirePermission(request, "property", "delete");
    const db = getDb();

    // Safeguard 1: Occupied status check
    const [units] = await db.query("SELECT status FROM units WHERE id = ? AND tenant_id = ?", [data.id, tenantId]) as any[];
    if (units.length > 0 && units[0].status === "occupied") {
      throw new Error("Cannot delete unit because it is currently occupied. Please vacate it first.");
    }

    // Safeguard 2: Active residents check
    const [residents] = await db.query("SELECT id FROM residents WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (residents.length > 0) {
      throw new Error("Cannot delete unit because it has resident records associated with it.");
    }

    // Safeguard 3: Billing ledger check
    const [ledger] = await db.query("SELECT id FROM ledger_entries WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (ledger.length > 0) {
      throw new Error("Cannot delete unit because it has billing ledger history associated with it.");
    }

    // Safeguard 4: Payment records check
    const [payments] = await db.query("SELECT id FROM payments WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (payments.length > 0) {
      throw new Error("Cannot delete unit because it has payment records associated with it.");
    }

    // Safeguard 5: Meter readings check
    const [readings] = await db.query("SELECT id FROM meter_readings WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (readings.length > 0) {
      throw new Error("Cannot delete unit because it has utility meter reading records associated with it.");
    }

    // Safeguard 6: Parking slots check
    const [parking] = await db.query("SELECT id FROM parking_allocations WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (parking.length > 0) {
      throw new Error("Cannot delete unit because it has parking slot allocations associated with it.");
    }

    await db.query("DELETE FROM units WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });
