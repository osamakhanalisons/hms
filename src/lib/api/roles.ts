import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";

export type CustomRole = {
  id: string;
  tenant_id?: string;
  name: string;
  label: string;
  description?: string | null;
};

const STATIC_ROLES = [
  "super_admin",
  "society_admin",
  "finance_head",
  "maintenance_head",
  "security_head",
  "resident",
  "tenant",
  "guard",
  "technician",
] as const;

function normalizeRoleName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function isTenantRoleValid(role: string, customRoles: string[]) {
  if (role === "super_admin") return false;
  return STATIC_ROLES.includes(role as typeof STATIC_ROLES[number]) || customRoles.includes(role);
}

// Get all users for the current admin's tenant, including their roles
export const getTenantUsersFn = createServerFn({ method: "GET" })
  .handler(async (ctx: any) => {
    const { request } = ctx;
    try {
      const userId = await getSessionUser(request);
      if (!userId) throw new Error("Unauthorized");
      const scoping = await getTenantScoping(request, undefined, "p.tenant_id");
      const adminRoles = await getUserRoles(userId);
      if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
      if (!scoping.isSuperAdmin && !scoping.tenantId) {
        throw new Error("Forbidden — A specific society must be selected.");
      }
      const db = getDb();
      const [rows] = (await db.query(
        `SELECT u.id AS user_id, p.full_name, u.email, GROUP_CONCAT(r.role) AS roles
         FROM users u
         JOIN profiles p ON p.id = u.id
         LEFT JOIN user_roles r ON r.user_id = u.id
         WHERE ${scoping.sqlFilter}
         GROUP BY u.id, p.full_name, u.email`,
        scoping.sqlParams
      )) as any[];
      return rows.map((row: any) => ({
        id: row.user_id,
        full_name: row.full_name ?? "",
        email: row.email ?? "",
        roles: row.roles ? row.roles.split(",") : [],
      }));
    } catch (err) {
      console.error("[getTenantUsersFn] Error:", err);
      throw err;
    }
  });

export const getCustomRolesFn = createServerFn({ method: "GET" })
  .handler(async (ctx: any) => {
    const { request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(userId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request, undefined, "tenant_id");
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }
    const db = getDb();
    const [rows] = (await db.query(
      `SELECT id, tenant_id, name, label, description 
       FROM custom_roles 
       WHERE ${scoping.sqlFilter} 
       ORDER BY created_at DESC`,
      scoping.sqlParams,
    )) as any[];
    return rows as CustomRole[];
  });

export const createCustomRoleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      label: z.string().min(1),
      description: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    const tenantId = scoping.tenantId;
    if (!tenantId) throw new Error("Forbidden — A specific society must be selected.");
    const name = normalizeRoleName(data.name);
    if (!name) throw new Error("Invalid role name");
    if (STATIC_ROLES.includes(name as typeof STATIC_ROLES[number])) {
      throw new Error("Role name conflicts with an existing system role");
    }
    const db = getDb();
    const [existing] = (await db.query(
      "SELECT id FROM custom_roles WHERE tenant_id = ? AND name = ?",
      [tenantId, name],
    )) as any[];
    if (existing.length > 0) throw new Error("Role name already exists");
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO custom_roles (id, tenant_id, name, label, description) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, name, data.label.trim(), data.description ?? null],
    );
    return { id, name, label: data.label.trim(), description: data.description ?? null };
  });

export const deleteCustomRoleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ roleId: z.string().min(1) }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }
    const db = getDb();
    const [roleRows] = (await db.query(
      "SELECT name, tenant_id FROM custom_roles WHERE id = ?",
      [data.roleId],
    )) as any[];
    if (roleRows.length === 0) throw new Error("Role not found");

    const targetTenantId = roleRows[0].tenant_id;
    if (!scoping.isSuperAdmin) {
      if (targetTenantId !== scoping.tenantId) {
        throw new Error("Forbidden — Access to this role is restricted.");
      }
    } else if (scoping.tenantId && targetTenantId !== scoping.tenantId) {
      throw new Error("Forbidden — Access to this role is restricted.");
    }

    const roleName = roleRows[0].name;
    const [assignedRows] = (await db.query(
      `SELECT COUNT(*) AS count FROM user_roles
       WHERE role = ? AND user_id IN (SELECT id FROM profiles WHERE tenant_id = ?)`,
      [roleName, targetTenantId],
    )) as any[];
    if (assignedRows[0].count > 0) {
      throw new Error("Cannot delete role — users are assigned to this role");
    }
    await db.query("DELETE FROM role_permissions WHERE tenant_id = ? AND role = ?", [targetTenantId, roleName]);
    await db.query("DELETE FROM custom_roles WHERE id = ? AND tenant_id = ?", [data.roleId, targetTenantId]);
    return { success: true };
  });

export const updateCustomRoleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      roleId: z.string().min(1),
      name: z.string().min(1),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }
    const db = getDb();
    const [roleRows] = (await db.query(
      "SELECT tenant_id FROM custom_roles WHERE id = ?",
      [data.roleId],
    )) as any[];
    if (roleRows.length === 0) throw new Error("Role not found");

    const targetTenantId = roleRows[0].tenant_id;
    if (!scoping.isSuperAdmin) {
      if (targetTenantId !== scoping.tenantId) {
        throw new Error("Forbidden — Access to this role is restricted.");
      }
    } else if (scoping.tenantId && targetTenantId !== scoping.tenantId) {
      throw new Error("Forbidden — Access to this role is restricted.");
    }

    const name = normalizeRoleName(data.name);
    if (!name) throw new Error("Invalid role name");
    if (STATIC_ROLES.includes(name as typeof STATIC_ROLES[number])) {
      throw new Error("Role name conflicts with an existing system role");
    }
    const [existingRole] = (await db.query(
      "SELECT id FROM custom_roles WHERE tenant_id = ? AND name = ? AND id <> ?",
      [targetTenantId, name, data.roleId],
    )) as any[];
    if (existingRole.length > 0) throw new Error("Role name already exists");
    await db.query(
      "UPDATE custom_roles SET name = ? WHERE id = ? AND tenant_id = ?",
      [name, data.roleId, targetTenantId],
    );
    return { success: true, id: data.roleId, name };
  });

export const createTenantUserFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fullName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.string().min(1),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    const tenantId = scoping.tenantId;
    if (!tenantId) throw new Error("Forbidden — A specific society must be selected.");
    const db = getDb();
    const [existingEmail] = (await db.query("SELECT id FROM users WHERE email = ?", [data.email])) as any[];
    if (existingEmail.length > 0) throw new Error("Email already registered");
    const [customRows] = (await db.query("SELECT name FROM custom_roles WHERE tenant_id = ?", [tenantId])) as any[];
    const customRoleNames = (customRows as Array<{ name: string }>).map((row) => row.name);
    if (!isTenantRoleValid(data.role, customRoleNames)) {
      throw new Error("Selected role is invalid");
    }
    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(data.password);
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      userId,
      data.email,
      passwordHash,
    ]);
    await db.query("INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, ?, ?)", [
      userId,
      data.fullName.trim(),
      tenantId,
    ]);
    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
      crypto.randomUUID(),
      userId,
      data.role,
    ]);
    return { success: true };
  });

export const updateTenantUserFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().min(1),
      fullName: z.string().min(1),
      email: z.string().email(),
      password: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }
    const db = getDb();

    const [userRows] = (await db.query(
      `SELECT u.id, u.email, p.tenant_id, r.role FROM users u
       JOIN profiles p ON p.id = u.id
       LEFT JOIN user_roles r ON r.user_id = u.id
       WHERE u.id = ?`,
      [data.userId],
    )) as any[];
    if (userRows.length === 0) throw new Error("User not found");

    const targetTenantId = userRows[0].tenant_id;
    if (!scoping.isSuperAdmin) {
      if (targetTenantId !== scoping.tenantId) {
        throw new Error("Forbidden — Access to this user is restricted.");
      }
    } else if (scoping.tenantId && targetTenantId !== scoping.tenantId) {
      throw new Error("Forbidden — Access to this user is restricted.");
    }

    const [emailRows] = (await db.query("SELECT id FROM users WHERE email = ? AND id <> ?", [data.email, data.userId])) as any[];
    if (emailRows.length > 0) throw new Error("Email already registered");

    await db.query("UPDATE profiles SET full_name = ? WHERE id = ?", [data.fullName.trim(), data.userId]);
    await db.query("UPDATE users SET email = ? WHERE id = ?", [data.email, data.userId]);

    if (data.password && data.password.trim().length > 0) {
      const passwordHash = hashPassword(data.password);
      await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, data.userId]);
    }

    return { success: true, id: data.userId, email: data.email, fullName: data.fullName.trim() };
  });

export const deleteTenantUserFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ userId: z.string().min(1) }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }
    const db = getDb();

    const [userRows] = (await db.query(
      `SELECT u.id, p.tenant_id, r.role FROM users u
       JOIN profiles p ON p.id = u.id
       LEFT JOIN user_roles r ON r.user_id = u.id
       WHERE u.id = ?`,
      [data.userId],
    )) as any[];
    if (userRows.length === 0) throw new Error("User not found");

    const targetTenantId = userRows[0].tenant_id;
    if (!scoping.isSuperAdmin) {
      if (targetTenantId !== scoping.tenantId) {
        throw new Error("Forbidden — Access to this user is restricted.");
      }
    } else if (scoping.tenantId && targetTenantId !== scoping.tenantId) {
      throw new Error("Forbidden — Access to this user is restricted.");
    }

    const assignedRoles = Array.from(new Set(userRows.map((row: any) => row.role).filter(Boolean)));
    if (assignedRoles.includes("super_admin")) {
      throw new Error("Cannot delete a super admin user");
    }

    await db.query("DELETE FROM users WHERE id = ?", [data.userId]);
    return { success: true };
  });

// Assign a role to a user (adds if not present)
export const assignUserRoleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string(),
      role: z.string().min(1),
    })
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");

    const scoping = await getTenantScoping(request);
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }

    const db = getDb();
    const [targetUsers] = (await db.query(
      `SELECT u.id, p.tenant_id FROM users u
       JOIN profiles p ON p.id = u.id
       WHERE u.id = ?`,
      [data.userId],
    )) as any[];
    if (targetUsers.length === 0) throw new Error("User not found");

    const targetTenantId = targetUsers[0].tenant_id;
    if (!scoping.isSuperAdmin) {
      if (targetTenantId !== scoping.tenantId) {
        throw new Error("Forbidden — Access to this user is restricted.");
      }
    } else if (scoping.tenantId && targetTenantId !== scoping.tenantId) {
      throw new Error("Forbidden — Access to this user is restricted.");
    }

    const [customRows] = (await db.query(
      "SELECT name FROM custom_roles WHERE tenant_id = ?",
      [targetTenantId],
    )) as any[];
    const customRoleNames = (customRows as Array<{ name: string }>).map((row) => row.name);
    if (!isTenantRoleValid(data.role, customRoleNames)) {
      throw new Error("Invalid role");
    }

    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)",
      [id, data.userId, data.role]
    );
    return { success: true };
  });

// Remove a role from a user (ensures user retains at least one role)
export const removeUserRoleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string(),
      role: z.string().min(1),
    })
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const adminId = await getSessionUser(request);
    if (!adminId) throw new Error("Unauthorized");
    const adminRoles = await getUserRoles(adminId);
    if (!isAdminRole(adminRoles)) throw new Error("Forbidden");
    const scoping = await getTenantScoping(request);
    if (!scoping.isSuperAdmin && !scoping.tenantId) {
      throw new Error("Forbidden — A specific society must be selected.");
    }
    const db = getDb();
    
    const [userCheck] = await db.query(
      "SELECT id, tenant_id FROM profiles WHERE id = ?",
      [data.userId]
    ) as any[];
    if (userCheck.length === 0) throw new Error("User not found");

    const targetTenantId = userCheck[0].tenant_id;
    if (!scoping.isSuperAdmin) {
      if (targetTenantId !== scoping.tenantId) {
        throw new Error("Forbidden — Access to this user is restricted.");
      }
    } else if (scoping.tenantId && targetTenantId !== scoping.tenantId) {
      throw new Error("Forbidden — Access to this user is restricted.");
    }

    const [roleRows] = (await db.query(
      "SELECT role FROM user_roles WHERE user_id = ?",
      [data.userId]
    )) as any[];
    if (roleRows.length <= 1) throw new Error("User must retain at least one role");
    await db.query(
      "DELETE FROM user_roles WHERE user_id = ? AND role = ?",
      [data.userId, data.role]
    );
    return { success: true };
  });



