import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole } from "./auth-helper";
import { requirePermission } from "./permissions";


// ─── PARKING SLOTS ─────────────────────────────────────────────────────────

export const getParkingSlotsFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const { tenantId, roles, userId } = await requirePermission(request, "parking", "view");
  const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);

  const db = getDb();

  // Fetch resident's units
  const [residentUnits] = await db.query(
    "SELECT unit_id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?) AND tenant_id = ?",
    [userId, tenantId]
  ) as any[];
  const unitIds = residentUnits.map((ru: any) => ru.unit_id);

  const [rows] = (await db.query(
    `SELECT ps.*,
              pa.resident_name, pa.vehicle_plate, pa.vehicle_type,
              u.unit_number, pa.unit_id
       FROM parking_slots ps
       LEFT JOIN parking_allocations pa ON pa.slot_id = ps.id AND pa.is_current = TRUE
       LEFT JOIN units u ON u.id = pa.unit_id
       WHERE ps.tenant_id = ?
       ORDER BY ps.block, ps.floor_number, ps.label`,
    [tenantId],
  )) as any[];

  // Mask allocation details in JS for slots whose unit_id does not belong to current resident
  const rowsMapped = rows.map((r: any) => {
    const hasAccess = isStaffOrAdmin || (unitIds.length > 0 && unitIds.includes(r.unit_id));
    return {
      id: r.id,
      tenantId: r.tenant_id,
      label: r.label,
      block: r.block ?? null,
      floorNumber: r.floor_number ?? null,
      slotType: r.slot_type,
      status: r.status,
      residentName: hasAccess ? r.resident_name : null,
      vehiclePlate: hasAccess ? r.vehicle_plate : null,
      vehicleType: hasAccess ? r.vehicle_type : null,
      unitNumber: hasAccess ? r.unit_number : null,
    };
  });

  return rowsMapped;
});

export const createParkingSlotFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      label: z.string().min(1),
      block: z.string().optional(),
      floorNumber: z.number().optional(),
      slotType: z.enum(["covered", "open", "bike"]).default("open"),
    }),
  )
  .handler(async (ctx: any) => {
    const { request } = ctx;
    const { tenantId } = await requirePermission(request, "parking", "create");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO parking_slots (id, tenant_id, label, block, floor_number, slot_type) VALUES (?, ?, ?, ?, ?, ?)",
      [id, tenantId, data.label, data.block || null, data.floorNumber ?? null, data.slotType],
    );
    return { id };
  });

// ─── PARKING ALLOCATIONS ───────────────────────────────────────────────────

export const allocateParkingSlotFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slotId: z.string(),
      unitId: z.string(),
      residentName: z.string().optional(),
      vehiclePlate: z.string().optional(),
      vehicleType: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "parking", "create");

    const db = getDb();

    // Check slot is free
    const [slotRows] = (await db.query(
      "SELECT status FROM parking_slots WHERE id = ? AND tenant_id = ?",
      [data.slotId, tenantId],
    )) as any[];
    if (!slotRows.length) throw new Error("Slot not found");
    if (slotRows[0].status !== "free") throw new Error("Slot is not available");

    // Verify unit belongs to tenant
    const [[unit]] = (await db.query("SELECT id FROM units WHERE id = ? AND tenant_id = ?", [
      data.unitId,
      tenantId,
    ])) as any[];
    if (!unit) throw new Error("Forbidden — Unit not found or unauthorized");

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO parking_allocations (id, tenant_id, slot_id, unit_id, resident_name, vehicle_plate, vehicle_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        data.slotId,
        data.unitId,
        data.residentName || null,
        data.vehiclePlate || null,
        data.vehicleType || null,
        userId,
      ],
    );

    await db.query("UPDATE parking_slots SET status = 'occupied' WHERE id = ?", [data.slotId]);

    return { id };
  });

export const deallocateParkingSlotFn = createServerFn({ method: "POST" })
  .validator(z.object({ slotId: z.string() }))
  .handler(async (ctx: any) => {
    const { request } = ctx;
    const { tenantId } = await requirePermission(request, "parking", "edit");

    const db = getDb();
    await db.query(
      `UPDATE parking_allocations
       SET is_current = FALSE, deallocated_at = NOW()
       WHERE slot_id = ? AND tenant_id = ? AND is_current = TRUE`,
      [data.slotId, tenantId],
    );
    await db.query("UPDATE parking_slots SET status = 'free' WHERE id = ? AND tenant_id = ?", [
      data.slotId,
      tenantId,
    ]);
    return { success: true };
  });


// ─── UNITS LIST (for dropdown) ─────────────────────────────────────────────

export const getUnitsForParkingFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const { tenantId, roles, userId } = await requirePermission(request, "parking", "view");
  const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);

  const db = getDb();
  let query = `
    SELECT u.id, u.unit_number, b.name AS block_name
    FROM units u LEFT JOIN blocks b ON b.id = u.block_id
    WHERE u.tenant_id = ?
  `;
  const params: any[] = [tenantId];
  if (!isStaffOrAdmin) {
    query += " AND u.id IN (SELECT unit_id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?))";
    params.push(userId);
  }
  query += " ORDER BY b.name, u.unit_number";

  const [rows] = (await db.query(query, params)) as any[];
  return rows;
});
