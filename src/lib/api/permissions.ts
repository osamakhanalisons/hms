import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";

export const PERMISSION_ROLES = [
  "society_admin",
  "finance_head",
  "maintenance_head",
  "security_head",
  "resident",
  "tenant",
  "guard",
  "technician",
] as const;


export const PERMISSION_MODULES = [
  { key: "property", label: "Property" },
  { key: "residents", label: "Residents" },
  { key: "notifications", label: "Notifications" },
  { key: "documents", label: "Documents" },
  { key: "reports", label: "Reports" },
  { key: "ledger", label: "Ledger" },
  { key: "payments", label: "Payments" },
  { key: "financial_transparency", label: "Financial Transparency" },
  { key: "budget", label: "Budget" },
  { key: "complaints", label: "Complaints" },
  { key: "maintenance", label: "Maintenance" },
  { key: "vendors", label: "Vendors" },
  { key: "assets", label: "Assets" },
  { key: "visitor", label: "Visitors" },
  { key: "gate", label: "Gate / Security" },
  { key: "parking", label: "Parking" },
  { key: "guard_patrol", label: "Guard Patrol" },
  { key: "blacklist", label: "Blacklist" },
  { key: "notice_board", label: "Notices" },
  { key: "community_forum", label: "Forum" },
  { key: "polls", label: "Polls" },
  { key: "events", label: "Events" },
  { key: "amenities", label: "Amenities" },
  { key: "governance", label: "Governance" },
  { key: "utility_meters", label: "Utility Meters" },
] as const;

type PermissionModuleKey = (typeof PERMISSION_MODULES)[number]["key"];
export type PermissionRole = (typeof PERMISSION_ROLES)[number] | string;
export type PermissionModuleKeyType = PermissionModuleKey;

interface RolePermissionRecord {
  module_key: PermissionModuleKey;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

function buildEmptyPermissions(): RolePermissionRecord[] {
  return PERMISSION_MODULES.map((module) => ({
    module_key: module.key,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }));
}

function buildDefaultPermissions(role: PermissionRole): RolePermissionRecord[] {
  const base = buildEmptyPermissions();

  const setAll = () => {
    return base.map((item) => ({ ...item, can_view: true, can_create: true, can_edit: true, can_delete: true }));
  };

  const viewOnly = (key: PermissionModuleKey) => {
    const item = base.find((item) => item.module_key === key);
    if (item) item.can_view = true;
  };

  const full = (key: PermissionModuleKey) => {
    const item = base.find((item) => item.module_key === key);
    if (item) Object.assign(item, { can_view: true, can_create: true, can_edit: true, can_delete: true });
  };

  const createOnly = (key: PermissionModuleKey) => {
    const item = base.find((item) => item.module_key === key);
    if (item) Object.assign(item, { can_view: false, can_create: true, can_edit: false, can_delete: false });
  };

  const financeModules: PermissionModuleKey[] = ["ledger", "payments", "budget", "reports"];
  const securityModules: PermissionModuleKey[] = ["gate", "visitor", "parking", "guard_patrol", "blacklist"];
  const maintenanceModules: PermissionModuleKey[] = ["maintenance", "complaints", "vendors", "assets"];
  const residentTenantCreateModules: PermissionModuleKey[] = ["notice_board", "community_forum", "polls", "events"];

  switch (role) {
    case "society_admin":
      return setAll();
    case "finance_head":
      PERMISSION_MODULES.forEach((item) => {
        if (financeModules.includes(item.key)) {
          full(item.key);
        } else {
          viewOnly(item.key);
        }
      });
      return base;
    case "security_head":
      PERMISSION_MODULES.forEach((item) => {
        if (securityModules.includes(item.key)) {
          full(item.key);
        } else {
          viewOnly(item.key);
        }
      });
      return base;
    case "maintenance_head":
      PERMISSION_MODULES.forEach((item) => {
        if (maintenanceModules.includes(item.key)) {
          full(item.key);
        } else {
          viewOnly(item.key);
        }
      });
      return base;
    case "resident":
    case "tenant":
    case "member":
      // --- Resident/Tenant can VIEW their own profile in Residents module ---
      viewOnly("residents");
      // --- Finance modules (view own ledger & payments) ---
      viewOnly("ledger");
      viewOnly("payments");
      viewOnly("financial_transparency");
      // --- Utility meters (view readings) ---
      viewOnly("utility_meters");
      // --- Complaints: full CRUD (resident can create, track, close own) ---
      full("complaints");
      // --- Notifications, documents, amenities: view only ---
      viewOnly("notifications");
      viewOnly("documents");
      viewOnly("amenities");
      // --- Visitor: view + create (pre-register guests) ---
      viewOnly("visitor");
      const visitorItem2 = base.find((row) => row.module_key === "visitor");
      if (visitorItem2) { visitorItem2.can_view = true; visitorItem2.can_create = true; }
      // --- Parking: view only ---
      viewOnly("parking");
      // --- Community modules: view + create ---
      residentTenantCreateModules.forEach((key) => {
        viewOnly(key);
        const item = base.find((row) => row.module_key === key);
        if (item) item.can_create = true;
      });
      return base;
    case "guard":
      PERMISSION_MODULES.forEach((item) => {
        if (securityModules.includes(item.key)) {
          full(item.key);
        }
      });
      return base;
    case "technician":
      full("maintenance");
      base.forEach((item) => {
        if (item.module_key !== "maintenance") {
          item.can_view = false;
          item.can_create = false;
          item.can_edit = false;
          item.can_delete = false;
        }
      });
      return base;
    default:
      return base;
  }
}

function mergePermissions(role: PermissionRole, rows: RolePermissionRecord[]) {
  const defaultPermissions = buildDefaultPermissions(role).reduce<Record<PermissionModuleKey, RolePermissionRecord>>(
    (acc, item) => {
      acc[item.module_key] = item;
      return acc;
    },
  {} as Record<PermissionModuleKey, RolePermissionRecord>);

  rows.forEach((row) => {
    const item = defaultPermissions[row.module_key];
    if (item) {
      item.can_view = Boolean(row.can_view);
      item.can_create = Boolean(row.can_create);
      item.can_edit = Boolean(row.can_edit);
      item.can_delete = Boolean(row.can_delete);
    }
  });

  return Object.values(defaultPermissions);
}

function buildFullAccess(): RolePermissionRecord[] {
  return PERMISSION_MODULES.map((module) => ({
    module_key: module.key,
    can_view: true,
    can_create: true,
    can_edit: true,
    can_delete: true,
  }));
}

export async function requirePermission(
  request: Request | undefined,
  moduleKey: string,
  action: "view" | "create" | "edit" | "delete"
): Promise<{ userId: string; tenantId: string; roles: string[] }> {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const roles = await getUserRoles(userId);
  let tenantId: string;

  if (roles.includes("super_admin") || roles.includes("society_admin")) {
    const scoping = await getTenantScoping(request);
    tenantId = scoping.tenantId;
    if (!tenantId || tenantId === "all") {
      const { getDb } = await import("../db.server");
      const db = getDb();
      const [tenants] = (await db.query("SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1")) as any[];
      if (tenants.length > 0) {
        tenantId = tenants[0].id as string;
      }
    }
  } else {
    const userTenantId = await getUserTenantId(userId);
    if (!userTenantId) throw new Error("No tenant session found");
    tenantId = userTenantId;
  }

  if (action !== "view" && !tenantId) {
    throw new Error("Forbidden — A specific society must be selected for this operation.");
  }

  const { getDb } = await import("../db.server");
  const db = getDb();
  let hasAccess = false;

  for (const role of roles) {
    const [rows] = (await db.query(
      "SELECT module_key, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE tenant_id = ? AND role = ?",
      [tenantId, role],
    )) as any[];

    let rolePerms: RolePermissionRecord[] = [];
    if (rows && rows.length > 0) {
      rolePerms = mergePermissions(role, rows as RolePermissionRecord[]);
    } else {
      if (role === "super_admin" || role === "society_admin") {
        rolePerms = buildFullAccess();
      } else {
        rolePerms = buildDefaultPermissions(role);
      }
    }

    const modPerm = rolePerms.find((p) => p.module_key === moduleKey);
    if (modPerm) {
      if (action === "view" && modPerm.can_view) hasAccess = true;
      if (action === "create" && modPerm.can_create) hasAccess = true;
      if (action === "edit" && modPerm.can_edit) hasAccess = true;
      if (action === "delete" && modPerm.can_delete) hasAccess = true;
    }
  }

  if (!hasAccess) {
    throw new Error(`Forbidden — You do not have permission to ${action} ${moduleKey}`);
  }

  return { userId, tenantId, roles };
}


export const getRolePermissionsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      role: z.string().min(1),
      tenantId: z.string().optional(),
    }),
  )
  .handler(async (ctx) => {
    const data = ctx.data as { role: PermissionRole; tenantId?: string };
    const request = (ctx as any).request as Request | undefined;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) throw new Error("Forbidden");

    const scoping = await getTenantScoping(request);
    let resolvedTenantId = (scoping.isSuperAdmin && data.tenantId) ? data.tenantId : scoping.tenantId;
    if (!resolvedTenantId && scoping.isSuperAdmin) {
      const { getDb } = await import("../db.server");
      const db = getDb();
      const [tenants] = (await db.query(
        "SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1",
      )) as any[];
      if (tenants.length > 0) {
        resolvedTenantId = tenants[0].id;
      }
    }
    if (!resolvedTenantId) throw new Error("Forbidden — A specific society must be selected.");

    const { getDb } = await import("../db.server");
    const db = getDb();
    const [rows] = (await db.query(
      "SELECT module_key, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE tenant_id = ? AND role = ?",
      [resolvedTenantId, data.role],
    )) as any[];

    if (rows.length === 0) {
      return buildDefaultPermissions(data.role);
    }

    return mergePermissions(data.role, rows as RolePermissionRecord[]);
  });

const booleanOrNumber = z.union([z.boolean(), z.number()]).transform((val) => Boolean(val));

export const updateRolePermissionsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      role: z.string().min(1),
      tenantId: z.string().optional(),
      permissions: z.array(
        z.object({
          module_key: z.enum([
            "property",
            "residents",
            "notifications",
            "documents",
            "reports",
            "ledger",
            "payments",
            "financial_transparency",
            "budget",
            "complaints",
            "maintenance",
            "vendors",
            "assets",
            "visitor",
            "gate",
            "parking",
            "guard_patrol",
            "blacklist",
            "notice_board",
            "community_forum",
            "polls",
            "events",
            "amenities",
            "governance",
            "utility_meters",
          ]),
          can_view: booleanOrNumber,
          can_create: booleanOrNumber,
          can_edit: booleanOrNumber,
          can_delete: booleanOrNumber,
        }),
      ),
    }),
  )
  .handler(async (ctx) => {
    const data = ctx.data as {
      role: PermissionRole;
      tenantId?: string;
      permissions: Array<{
        module_key: PermissionModuleKey;
        can_view: boolean;
        can_create: boolean;
        can_edit: boolean;
        can_delete: boolean;
      }>;
    };
    const request = (ctx as any).request as Request | undefined;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) throw new Error("Forbidden");

    const scoping = await getTenantScoping(request);
    let resolvedTenantId = (scoping.isSuperAdmin && data.tenantId) ? data.tenantId : scoping.tenantId;
    if (!resolvedTenantId && scoping.isSuperAdmin) {
      const { getDb } = await import("../db.server");
      const db = getDb();
      const [tenants] = (await db.query(
        "SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1",
      )) as any[];
      if (tenants.length > 0) {
        resolvedTenantId = tenants[0].id;
      }
    }
    if (!resolvedTenantId) throw new Error("Forbidden — A specific society must be selected.");

    const { getDb } = await import("../db.server");
    const db = getDb();
    const values = data.permissions.map((permission) => [
      crypto.randomUUID(),
      resolvedTenantId,
      data.role,
      permission.module_key,
      permission.can_view ? 1 : 0,
      permission.can_create ? 1 : 0,
      permission.can_edit ? 1 : 0,
      permission.can_delete ? 1 : 0,
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const flattened = values.flat();

    await db.query(
      `INSERT INTO role_permissions (id, tenant_id, role, module_key, can_view, can_create, can_edit, can_delete)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         can_view = VALUES(can_view),
         can_create = VALUES(can_create),
         can_edit = VALUES(can_edit),
         can_delete = VALUES(can_delete),
         updated_at = CURRENT_TIMESTAMP`,
      flattened,
    );

    return { success: true };
  });

export const getMyPermissionsFn = createServerFn({ method: "GET" }).handler(async (ctx) => {
  const request = (ctx as any).request as Request | undefined;
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const userRoles = await getUserRoles(userId);
  if (userRoles.includes("super_admin") || userRoles.includes("society_admin")) {
    return buildFullAccess();
  }

  if (userRoles.length === 0) {
    return buildEmptyPermissions();
  }

  let tenantId = await getUserTenantId(userId);

  // Fallback: agar profile.tenant_id null ho, persons table se check karo
  if (!tenantId) {
    const { getDb } = await import("../db.server");
    const db = getDb();
    const [personRows] = (await db.query(
      "SELECT tenant_id FROM persons WHERE user_id = ? AND tenant_id IS NOT NULL LIMIT 1",
      [userId],
    )) as any[];
    if (personRows.length > 0) {
      tenantId = personRows[0].tenant_id as string;
      // Profile ko bhi fix kar do silently
      await db.query(
        "UPDATE profiles SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR tenant_id = '')",
        [tenantId, userId],
      );
    }
  }

  const { getDb } = await import("../db.server");
  const db = getDb();
  const allRoleRecords: RolePermissionRecord[] = [];

  for (const role of userRoles) {
    let rolePerms: RolePermissionRecord[] = [];
    if (tenantId) {
      const [rows] = (await db.query(
        "SELECT module_key, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE tenant_id = ? AND role = ?",
        [tenantId, role],
      )) as any[];
      if (rows && rows.length > 0) {
        rolePerms = mergePermissions(role, rows as RolePermissionRecord[]);
      } else {
        rolePerms = buildDefaultPermissions(role);
      }
    } else {
      // No tenantId at all: still use defaults so resident can see something
      rolePerms = buildDefaultPermissions(role);
    }
    allRoleRecords.push(...rolePerms);
  }

  // Merge all roles using OR logic (most permissive wins)
  const mergedMap = new Map<PermissionModuleKey, RolePermissionRecord>();
  PERMISSION_MODULES.forEach((mod) => {
    mergedMap.set(mod.key, {
      module_key: mod.key,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    });
  });

  for (const perm of allRoleRecords) {
    const existing = mergedMap.get(perm.module_key);
    if (existing) {
      existing.can_view = existing.can_view || perm.can_view;
      existing.can_create = existing.can_create || perm.can_create;
      existing.can_edit = existing.can_edit || perm.can_edit;
      existing.can_delete = existing.can_delete || perm.can_delete;
    }
  }

  return Array.from(mergedMap.values());
});

