import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserTenantId,
  getUserRoles,
} from "./auth-helper";

// ── Password helpers (same as db-functions.ts) ────────────────────────────
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// ── Internal: verify caller is super_admin ────────────────────────────────
async function requireSuperAdmin(request?: Request): Promise<{ userId: string }> {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const roles = await getUserRoles(userId);
  if (!roles.includes("super_admin")) {
    throw new Error("Forbidden: super_admin role required");
  }
  return { userId };
}

// ── Default modules seeded for every new society ──────────────────────────
const DEFAULT_MODULES = [
  "platform",
  "property",
  "residents",
  "notifications",
  "documents",
  "reports",
  "ledger",
  "payments",
  "complaints",
  "notice_board",
];

// ── listAllSocietiesFn ────────────────────────────────────────────────────
// Only super_admin can call this. Returns all tenants + their society_admin info.
export const listAllSocietiesFn = createServerFn({ method: "POST" }).handler(
  async (ctx: any) => {
    const { request } = ctx;
    await requireSuperAdmin(request);
    const db = getDb();

    // Fetch tenants with their assigned society_admin and metrics
    const [rows] = (await db.query(
      `SELECT
         t.id,
         t.name,
         t.code,
         t.slug,
         t.address,
         t.contact_email,
         t.contact_phone,
         t.is_active,
         t.plan,
         t.created_at,
         MIN(p.full_name)  AS admin_name,
         MIN(u.email)      AS admin_email,
         MIN(u.id)         AS admin_user_id,
         (SELECT COUNT(*) FROM residents WHERE tenant_id = t.id) AS resident_count,
         (SELECT COUNT(*) FROM complaints WHERE tenant_id = t.id) AS complaint_count,
         (SELECT COUNT(*) FROM polls WHERE tenant_id = t.id) AS poll_count,
         (SELECT COUNT(*) FROM events WHERE tenant_id = t.id) AS event_count,
         (SELECT COUNT(*) FROM visitor_passes WHERE tenant_id = t.id) AS visitor_count,
         (SELECT COUNT(*) FROM amenity_bookings WHERE tenant_id = t.id) AS booking_count,
         (SELECT COUNT(*) FROM maintenance_work_orders WHERE tenant_id = t.id) AS maintenance_count,
         (SELECT COUNT(DISTINCT pr.id) FROM profiles pr WHERE pr.tenant_id = t.id) AS user_count
       FROM tenants t
       LEFT JOIN profiles p
         ON p.tenant_id = t.id
         AND p.id IN (SELECT user_id FROM user_roles WHERE role = 'society_admin')
       LEFT JOIN users u ON u.id = p.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
    )) as any[];

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code ?? null,
      slug: r.slug,
      address: r.address ?? null,
      contact_email: r.contact_email ?? null,
      contact_phone: r.contact_phone ?? null,
      is_active: Boolean(r.is_active),
      plan: r.plan,
      created_at: r.created_at,
      admin_name: r.admin_name ?? null,
      admin_email: r.admin_email ?? null,
      admin_user_id: r.admin_user_id ?? null,
      resident_count: Number(r.resident_count ?? 0),
      complaint_count: Number(r.complaint_count ?? 0),
      poll_count: Number(r.poll_count ?? 0),
      event_count: Number(r.event_count ?? 0),
      visitor_count: Number(r.visitor_count ?? 0),
      booking_count: Number(r.booking_count ?? 0),
      maintenance_count: Number(r.maintenance_count ?? 0),
      user_count: Number(r.user_count ?? 0),
    }));
  },
);

// ── createSocietyWithAdminFn ──────────────────────────────────────────────
// Only super_admin can call this. Creates tenant + admin user atomically.
export const createSocietyWithAdminFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      // Society fields
      name: z.string().min(2, "Society name must be at least 2 characters"),
      code: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, "Code must be alphanumeric"),
      address: z.string().optional(),
      contact_email: z.string().email().optional().or(z.literal("")),
      contact_phone: z.string().optional(),
      // Admin fields
      admin_full_name: z.string().min(2, "Admin name must be at least 2 characters"),
      admin_email: z.string().email("Invalid admin email"),
      admin_password: z.string().min(8, "Password must be at least 8 characters"),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { userId: actorId } = await requireSuperAdmin(request);
    const db = getDb();

    // ── VALIDATION (before any writes) ────────────────────────────────────

    // 1. Check society code uniqueness
    const [existingCode] = (await db.query(
      "SELECT id FROM tenants WHERE code = ? LIMIT 1",
      [data.code],
    )) as any[];
    if ((existingCode as any[]).length > 0) {
      throw new Error("CONFLICT:Society code already exists. Please choose a different code.");
    }

    // 2. Check admin email uniqueness
    const [existingUser] = (await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [data.admin_email],
    )) as any[];
    if ((existingUser as any[]).length > 0) {
      throw new Error("CONFLICT:Admin email is already registered.");
    }

    // ── ATOMIC WRITES ─────────────────────────────────────────────────────

    // Generate IDs up front so we can rollback if needed
    const tenantId = crypto.randomUUID();
    const adminUserId = crypto.randomUUID();
    const societyId = crypto.randomUUID();

    const slug =
      data.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") +
      "-" +
      tenantId.slice(0, 6);

    const passwordHash = hashPassword(data.admin_password);

    // Get a dedicated connection for the transaction
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();

      // Step 1: Create tenant
      await conn.query(
        `INSERT INTO tenants (id, name, slug, code, address, contact_email, contact_phone, plan, is_active, trial_ends_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'professional', TRUE, DATE_ADD(NOW(), INTERVAL 365 DAY))`,
        [
          tenantId,
          data.name,
          slug,
          data.code,
          data.address || null,
          data.contact_email || null,
          data.contact_phone || null,
        ],
      );

      // Step 2: Seed default modules for the new tenant
      for (const key of DEFAULT_MODULES) {
        await conn.query(
          `INSERT IGNORE INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by)
           VALUES (?, ?, ?, TRUE, NOW(), ?)`,
          [crypto.randomUUID(), tenantId, key, actorId],
        );
      }

      // Step 3: Create initial society entry (secondary record, keep existing societies table)
      await conn.query(
        `INSERT INTO societies (id, tenant_id, name, address) VALUES (?, ?, ?, ?)`,
        [societyId, tenantId, data.name, data.address || null],
      );

      // Step 4: Create admin user
      await conn.query(
        "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
        [adminUserId, data.admin_email, passwordHash],
      );

      // Step 5: Create admin profile linked to the NEW tenant
      await conn.query(
        "INSERT INTO profiles (id, full_name, society_name, tenant_id) VALUES (?, ?, ?, ?)",
        [adminUserId, data.admin_full_name, data.name, tenantId],
      );

      // Step 6: Assign society_admin role
      await conn.query(
        "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')",
        [crypto.randomUUID(), adminUserId],
      );

      // Step 6b: Assign admin to society pivot
      await conn.query(
        "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
        [crypto.randomUUID(), adminUserId, tenantId],
      );

      // Step 7: Commit
      await conn.commit();

      // Audit log (after commit — non-critical)
      try {
        await db.query(
          `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, after_data)
           VALUES (?, NULL, ?, 'society_created', 'tenant', ?, ?)`,
          [
            crypto.randomUUID(),
            actorId,
            tenantId,
            JSON.stringify({ name: data.name, code: data.code, admin_email: data.admin_email }),
          ],
        );
        await db.query(
          `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, after_data)
           VALUES (?, ?, ?, 'society_admin_created', 'user', ?, ?)`,
          [
            crypto.randomUUID(),
            tenantId,
            actorId,
            adminUserId,
            JSON.stringify({ email: data.admin_email, full_name: data.admin_full_name }),
          ],
        );
      } catch (auditErr) {
        console.warn("[societies] Audit log insert failed (non-fatal):", auditErr);
      }

      return {
        success: true,
        tenantId,
        adminUserId,
        message: `Society "${data.name}" created successfully with admin ${data.admin_email}.`,
      };
    } catch (err: any) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

// ── toggleSocietyStatusFn ─────────────────────────────────────────────────
// Only super_admin can call this. Activate or deactivate a society.
export const toggleSocietyStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().uuid("Invalid tenant ID"),
      is_active: z.boolean(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { userId: actorId } = await requireSuperAdmin(request);
    const db = getDb();

    // Verify society exists
    const [rows] = (await db.query(
      "SELECT id, name, is_active FROM tenants WHERE id = ? LIMIT 1",
      [data.tenantId],
    )) as any[];
    if ((rows as any[]).length === 0) {
      throw new Error("NOT_FOUND:Society not found.");
    }

    await db.query("UPDATE tenants SET is_active = ? WHERE id = ?", [
      data.is_active,
      data.tenantId,
    ]);

    // Audit log
    try {
      await db.query(
        `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
         VALUES (?, NULL, ?, ?, 'tenant', ?)`,
        [
          crypto.randomUUID(),
          actorId,
          data.is_active ? "society_activated" : "society_deactivated",
          data.tenantId,
        ],
      );
    } catch (auditErr) {
      console.warn("[societies] Audit log insert failed (non-fatal):", auditErr);
    }

    return { success: true, is_active: data.is_active };
  });

// ── getSocietyDetailFn ────────────────────────────────────────────────────
// Only super_admin can call this. Returns full detail of one society + its admin.
export const getSocietyDetailFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().uuid("Invalid tenant ID") }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    await requireSuperAdmin(request);
    const db = getDb();

    const [tenantRows] = (await db.query(
      `SELECT id, name, code, slug, address, contact_email, contact_phone, is_active, plan, created_at
       FROM tenants WHERE id = ? LIMIT 1`,
      [data.tenantId],
    )) as any[];

    if ((tenantRows as any[]).length === 0) {
      throw new Error("NOT_FOUND:Society not found.");
    }
    const tenant = (tenantRows as any[])[0];

    // Get society admin (first user with society_admin role in this tenant)
    const [adminRows] = (await db.query(
      `SELECT u.id, u.email, u.created_at AS joined_at, p.full_name, p.phone
       FROM user_roles ur
       JOIN profiles p ON p.id = ur.user_id AND p.tenant_id = ?
       JOIN users u ON u.id = ur.user_id
       WHERE ur.role = 'society_admin'
       LIMIT 1`,
      [data.tenantId],
    )) as any[];

    const admin = (adminRows as any[]).length > 0 ? (adminRows as any[])[0] : null;

    // Get counts
    const [[{ unit_count }]] = (await db.query(
      "SELECT COUNT(*) AS unit_count FROM units WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ resident_count }]] = (await db.query(
      "SELECT COUNT(*) AS resident_count FROM residents WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ complaint_count }]] = (await db.query(
      "SELECT COUNT(*) AS complaint_count FROM complaints WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ poll_count }]] = (await db.query(
      "SELECT COUNT(*) AS poll_count FROM polls WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ event_count }]] = (await db.query(
      "SELECT COUNT(*) AS event_count FROM events WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ visitor_count }]] = (await db.query(
      "SELECT COUNT(*) AS visitor_count FROM visitor_passes WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ booking_count }]] = (await db.query(
      "SELECT COUNT(*) AS booking_count FROM amenity_bookings WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const [[{ maintenance_count }]] = (await db.query(
      "SELECT COUNT(*) AS maintenance_count FROM maintenance_work_orders WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];

    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code ?? null,
      slug: tenant.slug,
      address: tenant.address ?? null,
      contact_email: tenant.contact_email ?? null,
      contact_phone: tenant.contact_phone ?? null,
      is_active: Boolean(tenant.is_active),
      plan: tenant.plan,
      created_at: tenant.created_at,
      unit_count: Number(unit_count),
      resident_count: Number(resident_count),
      complaint_count: Number(complaint_count),
      poll_count: Number(poll_count),
      event_count: Number(event_count),
      visitor_count: Number(visitor_count),
      booking_count: Number(booking_count),
      maintenance_count: Number(maintenance_count),
      admin: admin
        ? {
            id: admin.id,
            email: admin.email,
            full_name: admin.full_name,
            phone: admin.phone ?? null,
            joined_at: admin.joined_at,
          }
        : null,
    };
  });


export const listSocietyAdminsFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  await requireSuperAdmin(request);
  const db = getDb();
  const [rows] = await db.query(`
    SELECT u.id, u.email, p.full_name
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'society_admin'
    LEFT JOIN profiles p ON p.id = u.id
    ORDER BY p.full_name, u.email
  `) as any[];
  return rows;
});

export const getAdminAssignmentsFn = createServerFn({ method: "GET" })
  .validator(z.object({ adminUserId: z.string().uuid() }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    await requireSuperAdmin(request);
    const db = getDb();
    const [rows] = await db.query(
      "SELECT tenant_id FROM society_admin_tenants WHERE user_id = ? AND is_active = TRUE",
      [data.adminUserId]
    ) as any[];
    return rows.map((r: any) => r.tenant_id as string);
  });

export const saveAdminAssignmentsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      adminUserId: z.string().uuid(),
      tenantIds: z.array(z.string().uuid()),
    })
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    await requireSuperAdmin(request);
    const db = getDb();
    const conn = await (db as any).getConnection();
    try {
      await conn.beginTransaction();

      // Delete existing assignments
      await conn.query("DELETE FROM society_admin_tenants WHERE user_id = ?", [data.adminUserId]);

      // Insert new assignments
      for (const tenantId of data.tenantIds) {
        const id = crypto.randomUUID();
        await conn.query(
          "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
          [id, data.adminUserId, tenantId]
        );
      }

      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

export const getAssignedSocietiesFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const db = getDb();
  const [rows] = await db.query(`
    SELECT t.id, t.name, t.code
    FROM tenants t
    INNER JOIN society_admin_tenants sat ON sat.tenant_id = t.id
    WHERE sat.user_id = ? AND sat.is_active = TRUE AND t.is_active = TRUE
    ORDER BY t.name
  `, [userId]) as any[];
  return rows;
});
