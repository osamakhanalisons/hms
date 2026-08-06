import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole } from "./auth-helper";



export const getResidentsFn = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().optional(), search: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const roles = await getUserRoles(userId);
    const isAdmin = isAdminRole(roles);
    const db = getDb();

    let query = `
      SELECT r.*, p.full_name, p.email, p.phone, p.cnic,
             u.unit_number, s.name AS society_name
      FROM residents r
      JOIN persons p ON p.id = r.person_id
      JOIN units u ON u.id = r.unit_id
      LEFT JOIN societies s ON s.id = u.society_id
      WHERE r.tenant_id = ? AND r.is_current = TRUE
    `;
    const params: any[] = [tenantId];

    // Residents only see their own record
    if (!isAdmin) {
      query += " AND p.user_id = ?";
      params.push(userId);
    } else {
      if (data?.unitId) {
        query += " AND r.unit_id = ?";
        params.push(data.unitId);
      }
      if (data?.search) {
        query += " AND (p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ?)";
        const s = `%${data.search}%`;
        params.push(s, s, s);
      }
    }
    query += " ORDER BY p.full_name";

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });


export const createResidentFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      unitId: z.string(),
      fullName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      cnic: z.string().optional(),
      type: z.enum(["owner", "tenant"]),
      moveInDate: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const personId = crypto.randomUUID();
    const residentId = crypto.randomUUID();

    await db.query(
      "INSERT INTO persons (id, tenant_id, full_name, email, phone, cnic) VALUES (?, ?, ?, ?, ?, ?)",
      [
        personId,
        tenantId,
        data.fullName,
        data.email || null,
        data.phone || null,
        data.cnic || null,
      ],
    );
    await db.query(
      `INSERT INTO residents (id, person_id, unit_id, tenant_id, type, move_in_date, is_current)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [residentId, personId, data.unitId, tenantId, data.type, data.moveInDate || null],
    );
    // Update unit status to occupied
    await db.query("UPDATE units SET status = 'occupied' WHERE id = ? AND tenant_id = ?", [
      data.unitId,
      tenantId,
    ]);

    return { id: residentId, personId };
  });

export const addVehicleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      residentId: z.string(),
      vehicleType: z.enum(["car", "motorcycle", "van", "truck", "other"]),
      make: z.string().optional(),
      model: z.string().optional(),
      plateNumber: z.string().min(1),
      color: z.string().optional(),
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
      "INSERT INTO resident_vehicles (id, resident_id, tenant_id, vehicle_type, make, model, plate_number, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        data.residentId,
        tenantId,
        data.vehicleType,
        data.make || null,
        data.model || null,
        data.plateNumber,
        data.color || null,
      ],
    );
    return { id };
  });

export const moveOutResidentFn = createServerFn({ method: "POST" })
  .validator(z.object({ residentId: z.string(), moveOutDate: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    await db.query(
      "UPDATE residents SET is_current = FALSE, move_out_date = ? WHERE id = ? AND tenant_id = ?",
      [data.moveOutDate, data.residentId, tenantId],
    );
    // Check if any other current residents remain for that unit
    const [r] = (await db.query("SELECT unit_id FROM residents WHERE id = ?", [
      data.residentId,
    ])) as any[];
    if (r.length) {
      const [remaining] = (await db.query(
        "SELECT COUNT(*) AS cnt FROM residents WHERE unit_id = ? AND is_current = TRUE",
        [r[0].unit_id],
      )) as any[];
      if (remaining[0].cnt === 0) {
        await db.query("UPDATE units SET status = 'vacant' WHERE id = ?", [r[0].unit_id]);
      }
    }
    return { success: true };
  });
