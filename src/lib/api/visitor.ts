import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


export const getVisitorPassesFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT vp.*, p.full_name AS resident_name, u.unit_number
       FROM visitor_passes vp
       JOIN residents r ON r.id = vp.resident_id
       JOIN persons p ON p.id = r.person_id
       JOIN units u ON u.id = r.unit_id
       WHERE vp.tenant_id = ? ORDER BY vp.expected_at DESC`,
    [tenantId],
  )) as any[];
  return rows;
});

export const createVisitorPassFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      visitorName: z.string().min(1),
      visitorPhone: z.string().optional(),
      expectedAt: z.string(),
      visitorType: z.enum(["one_time", "recurring"]).default("one_time"),
      vehiclePlate: z.string().optional(),
      preRegistered: z.boolean().default(true),
      expiresAt: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();

    // Check if the current user is associated with any active resident profile
    const [residentRows] = (await db.query(
      `SELECT r.id FROM residents r
       JOIN persons p ON p.id = r.person_id
       WHERE p.user_id = ? AND r.tenant_id = ? AND r.is_current = TRUE`,
      [userId, tenantId],
    )) as any[];

    if (residentRows.length === 0) {
      throw new Error("Only registered residents can pre-register visitors");
    }

    const residentId = residentRows[0].id;
    const id = crypto.randomUUID();
    const passCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    await db.query(
      `INSERT INTO visitor_passes (id, tenant_id, resident_id, visitor_name, visitor_phone, expected_at, pass_code, status, visitor_type, vehicle_plate, pre_registered, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        residentId,
        data.visitorName,
        data.visitorPhone || null,
        data.expectedAt,
        passCode,
        data.visitorType,
        data.vehiclePlate || null,
        data.preRegistered,
        data.expiresAt || null,
      ],
    );

    return { id, passCode };
  });

export const getEntryExitLogsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM entry_exit_log WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT 200",
    [tenantId],
  )) as any[];
  return rows;
});

export const recordGatePassVerificationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      passCode: z.string(),
      direction: z.enum(["in", "out"]),
      vehiclePlate: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();

    // Verify pass code
    const [passes] = (await db.query(
      "SELECT * FROM visitor_passes WHERE pass_code = ? AND tenant_id = ? AND status = 'active'",
      [data.passCode, tenantId],
    )) as any[];

    if (passes.length === 0) {
      throw new Error("Invalid or expired visitor pass code");
    }

    const pass = passes[0];
    const logId = crypto.randomUUID();

    // Look up resident's user_id and profile
    const [residentUser] = (await db.query(
      `SELECT p.user_id, p.full_name FROM residents r
       JOIN persons p ON p.id = r.person_id
       WHERE r.id = ? AND r.tenant_id = ?`,
      [pass.resident_id, tenantId],
    )) as any[];

    // Integrated Parking check: check if the visitor's vehicle has an allocated slot
    let parkingDetails = "";
    const plate = data.vehiclePlate || pass.vehicle_plate || null;
    if (plate) {
      const trimmedPlate = plate.trim().toUpperCase();
      const [slots] = (await db.query(
        "SELECT label, slot_type FROM parking_slots WHERE vehicle_plate = ? AND tenant_id = ?",
        [trimmedPlate, tenantId],
      )) as any[];
      if (slots.length > 0) {
        parkingDetails = `Allocated Parking: Slot ${slots[0].label} (${slots[0].slot_type})`;
      }
    }

    // Send Real-Time Visitor Entry Notification for Approval to Resident/Tenant
    if (residentUser.length > 0 && residentUser[0].user_id) {
      const notifId = crypto.randomUUID();
      const message = `Visitor "${pass.visitor_name}" with vehicle [${
        plate ? plate.toUpperCase() : "None"
      }] is requesting entry at the main gate. ${
        parkingDetails ? `${parkingDetails}.` : "No pre-allocated slot."
      } Please approve/verify.`;

      await db.query(
        `INSERT INTO notifications (id, tenant_id, user_id, title, message, type, read_status)
         VALUES (?, ?, ?, 'Visitor Entry Approval Required', ?, 'visitor', 'unread')`,
        [notifId, tenantId, residentUser[0].user_id, message],
      );
    }

    // Log entry
    await db.query(
      `INSERT INTO entry_exit_log (id, tenant_id, visitor_pass_id, visitor_name, vehicle_plate, direction)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, tenantId, pass.id, pass.visitor_name, plate, data.direction],
    );

    // If logging check-in, update status to used
    if (data.direction === "in" && pass.visitor_type !== "recurring") {
      await db.query("UPDATE visitor_passes SET status = 'used' WHERE id = ?", [pass.id]);
    }

    return { success: true, visitorName: pass.visitor_name };
  });
