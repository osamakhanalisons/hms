import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, resolveTenantId, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";

// ─── Password helpers (same algo as signUpFn) ────────────────────────────────

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function generateTempPassword(): string {
  // 8-char readable password — confusing chars (0, O, I, 1, l) removed
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

// ─── GET RESIDENTS ────────────────────────────────────────────────────────────

export const getResidentsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        unitId: z.string().optional(),
        search: z.string().optional(),
        tenantId: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      })
      .optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    const isAdmin = isAdminRole(roles);
    const db = getDb();

    if (isAdmin) {
      const { sqlFilter, sqlParams } = await getTenantScoping(
        request,
        data?.tenantId,
        "r.tenant_id",
      );

      // Admin: count query first for pagination
      let countQuery = `
        SELECT COUNT(*) AS total
        FROM residents r
        JOIN persons p ON p.id = r.person_id
        WHERE ${sqlFilter} AND r.is_current = TRUE
      `;
      const countParams: any[] = [...sqlParams];

      if (data?.unitId) {
        countQuery += " AND r.unit_id = ?";
        countParams.push(data.unitId);
      }
      if (data?.search) {
        countQuery += " AND (p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ?)";
        const s = `%${data.search}%`;
        countParams.push(s, s, s);
      }

      const [[{ total }]] = (await db.query(countQuery, countParams)) as any[];

      // Admin: return residents matching scoped filter
      let query = `
        SELECT r.*, p.full_name, p.email, p.phone, p.cnic, p.user_id,
               u.unit_number, s.name AS society_name, bl.name AS block_name, b.name AS building_name
        FROM residents r
        JOIN persons p ON p.id = r.person_id
        JOIN units u ON u.id = r.unit_id
        LEFT JOIN societies s ON s.id = u.society_id
        LEFT JOIN blocks bl ON bl.id = u.block_id
        LEFT JOIN buildings b ON b.id = u.building_id
        WHERE ${sqlFilter} AND r.is_current = TRUE
      `;
      const params: any[] = [...sqlParams];

      if (data?.unitId) {
        query += " AND r.unit_id = ?";
        params.push(data.unitId);
      }
      if (data?.search) {
        query += " AND (p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ?)";
        const s = `%${data.search}%`;
        params.push(s, s, s);
      }
      query += " ORDER BY p.full_name";

      if (data?.page && data?.pageSize) {
        const offset = (data.page - 1) * data.pageSize;
        query += " LIMIT ? OFFSET ?";
        params.push(data.pageSize, offset);
      }

      const [rows] = (await db.query(query, params)) as any[];

      if (rows.length > 0) {
        const residentIds = rows.map((r: any) => r.id);
        const [vehicles] = (await db.query(
          "SELECT * FROM resident_vehicles WHERE resident_id IN (?)",
          [residentIds],
        )) as any[];
        return {
          residents: rows.map((resident: any) => ({
            ...resident,
            vehicles: vehicles.filter((v: any) => v.resident_id === resident.id),
          })),
          totalItems: total,
        };
      }
      return { residents: [], totalItems: total };
    } else {
      // Resident/tenant: return only their own record (lookup by user_id — no tenantId required)
      const [rows] = (await db.query(
        `SELECT r.*, p.full_name, p.email, p.phone, p.cnic, p.user_id,
                u.unit_number, s.name AS society_name, bl.name AS block_name, b.name AS building_name
         FROM residents r
         JOIN persons p ON p.id = r.person_id
         JOIN units u ON u.id = r.unit_id
         LEFT JOIN societies s ON s.id = u.society_id
         LEFT JOIN blocks bl ON bl.id = u.block_id
         LEFT JOIN buildings b ON b.id = u.building_id
         WHERE p.user_id = ? AND r.is_current = TRUE
         ORDER BY p.full_name`,
        [userId],
      )) as any[];

      if (rows.length > 0) {
        const residentIds = rows.map((r: any) => r.id);
        const [vehicles] = (await db.query(
          "SELECT * FROM resident_vehicles WHERE resident_id IN (?)",
          [residentIds]
        )) as any[];
        return {
          residents: rows.map((resident: any) => ({
            ...resident,
            vehicles: vehicles.filter((v: any) => v.resident_id === resident.id),
          })),
          totalItems: rows.length,
        };
      }
      return { residents: [], totalItems: 0 };
    }
  });

// ─── CREATE RESIDENT ──────────────────────────────────────────────────────────

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
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "residents", "create");

    const db = getDb();

    // Check if unit already has an active resident
    const [existingResidents] = (await db.query(
      `SELECT r.id, p.full_name 
       FROM residents r
       JOIN persons p ON r.person_id = p.id
       WHERE r.unit_id = ? 
       AND r.tenant_id = ?
       AND r.is_current = 1
       LIMIT 1`,
      [data.unitId, tenantId],
    )) as any[];

    if (existingResidents.length > 0) {
      throw new Error(
        `Unit already has an active resident: ${existingResidents[0].full_name}. Please move them out first before adding a new resident.`
      );
    }

    const personId = crypto.randomUUID();
    const residentId = crypto.randomUUID();

    // 1. Create person record
    await db.query(
      "INSERT INTO persons (id, tenant_id, full_name, email, phone, cnic) VALUES (?, ?, ?, ?, ?, ?)",
      [personId, tenantId, data.fullName, data.email || null, data.phone || null, data.cnic || null],
    );

    // 2. Create resident record
    await db.query(
      `INSERT INTO residents (id, person_id, unit_id, tenant_id, type, move_in_date, is_current)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [residentId, personId, data.unitId, tenantId, data.type, data.moveInDate || null],
    );

    // 3. Mark unit as occupied
    await db.query("UPDATE units SET status = 'occupied' WHERE id = ? AND tenant_id = ?", [
      data.unitId,
      tenantId,
    ]);

    // 4. Handle login account creation (only if email provided)
    if (data.email) {
      const [existingRows] = (await db.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [data.email],
      )) as any[];

      if (existingRows.length > 0) {
        // User already exists — just link the person record + fix tenant_id
        const existingLoginId = existingRows[0].id;

        await db.query("UPDATE persons SET user_id = ? WHERE id = ?", [existingLoginId, personId]);

        // Fix tenant_id on their profile if it's null/missing
        await db.query(
          "UPDATE profiles SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR tenant_id = '')",
          [tenantId, existingLoginId],
        );

        return {
          id: residentId,
          personId,
          accountCreated: false as const,
          message: "Resident linked to existing account",
        };
      } else {
        // Create a brand-new login account with a temp password
        const tempPassword = generateTempPassword();
        const passwordHash = hashPassword(tempPassword);
        const loginUserId = crypto.randomUUID();

        // Insert user
        await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
          loginUserId,
          data.email,
          passwordHash,
        ]);

        // Insert profile — with tenant_id set
        await db.query(
          "INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, ?, ?)",
          [loginUserId, data.fullName, tenantId],
        );

        // Assign resident role
        await db.query(
          "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
          [crypto.randomUUID(), loginUserId, data.type === "tenant" ? "tenant" : "resident"],
        );

        // Link person record to new user
        await db.query("UPDATE persons SET user_id = ? WHERE id = ?", [loginUserId, personId]);

        return {
          id: residentId,
          personId,
          accountCreated: true as const,
          tempPassword,
          loginEmail: data.email,
        };
      }
    }

    // No email — no account created
    return { id: residentId, personId, accountCreated: false as const };
  });

// ─── ADD VEHICLE ──────────────────────────────────────────────────────────────

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
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const tenantId = await resolveTenantId(request);

    const db = getDb();
    
    // Validate resident belongs to current tenant
    const [[resident]] = (await db.query(
      "SELECT id FROM residents WHERE id = ? AND tenant_id = ?",
      [data.residentId, tenantId]
    )) as any[];
    if (!resident) {
      throw new Error("Forbidden — Resident not found or unauthorized");
    }
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

// ─── MOVE OUT ─────────────────────────────────────────────────────────────────

export const moveOutResidentFn = createServerFn({ method: "POST" })
  .validator(z.object({ residentId: z.string(), moveOutDate: z.string() }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "residents", "edit");

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

export const createResidentAccountFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      personId: z.string(),
      email: z.string().email(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const tenantId = await resolveTenantId(request);
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) throw new Error("Forbidden");

    const db = getDb();

    // Check if email already registered
    const [existing] = (await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [data.email],
    )) as any[];

    if (existing.length > 0) {
      // Already exists — link the person record and sync tenant_id
      const existingUserId = existing[0].id;
      await db.query("UPDATE persons SET user_id = ? WHERE id = ?", [existingUserId, data.personId]);
      await db.query(
        "UPDATE profiles SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR tenant_id = '')",
        [tenantId, existingUserId],
      );
      return { success: true, accountCreated: false as const, message: "Linked to existing account" };
    }

    // Create a new account with a temp password
    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);
    const newUserId = crypto.randomUUID();

    // Insert user
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      newUserId,
      data.email,
      passwordHash,
    ]);

    // Insert profile — with tenant_id set and subquery for full_name
    await db.query(
      "INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, (SELECT full_name FROM persons WHERE id = ? LIMIT 1), ?)",
      [newUserId, data.personId, tenantId],
    );

    // Get the resident type to assign the correct role
    const [residentRows] = (await db.query(
      "SELECT type FROM residents WHERE person_id = ? LIMIT 1",
      [data.personId],
    )) as any[];
    const role = residentRows.length > 0 && residentRows[0].type === "tenant" ? "tenant" : "resident";

    // Assign role
    await db.query(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
      [crypto.randomUUID(), newUserId, role],
    );

    // Link person record to new user
    await db.query("UPDATE persons SET user_id = ? WHERE id = ?", [newUserId, data.personId]);

    return {
      success: true,
      accountCreated: true as const,
      tempPassword,
      loginEmail: data.email,
    };
  });

