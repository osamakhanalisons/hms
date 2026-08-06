import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


// ─── PARKING SLOTS ─────────────────────────────────────────────────────────

export const getParkingSlotsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT ps.*,
              pa.resident_name, pa.vehicle_plate, pa.vehicle_type,
              u.unit_number
       FROM parking_slots ps
       LEFT JOIN parking_allocations pa ON pa.slot_id = ps.id AND pa.is_current = TRUE
       LEFT JOIN units u ON u.id = pa.unit_id
       WHERE ps.tenant_id = ?
       ORDER BY ps.block, ps.floor_number, ps.label`,
    [tenantId],
  )) as any[];
  return rows;
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
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

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
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();

    // Check slot is free
    const [slotRows] = (await db.query(
      "SELECT status FROM parking_slots WHERE id = ? AND tenant_id = ?",
      [data.slotId, tenantId],
    )) as any[];
    if (!slotRows.length) throw new Error("Slot not found");
    if (slotRows[0].status !== "free") throw new Error("Slot is not available");

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
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

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

export const getUnitsForParkingFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT u.id, u.unit_number, b.name AS block_name
       FROM units u LEFT JOIN blocks b ON b.id = u.block_id
       WHERE u.tenant_id = ? ORDER BY b.name, u.unit_number`,
    [tenantId],
  )) as any[];
  return rows;
});
