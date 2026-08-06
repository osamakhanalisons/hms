import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole } from "./auth-helper";

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
  { key: "budget", label: "Budget" },
  { key: "complaints", label: "Complaints" },
  { key: "maintenance", label: "Maintenance" },
  { key: "vendors", label: "Vendors" },
  { key: "assets", label: "Assets" },
  { key: "visitor", label: "Visitor" },
  { key: "gate", label: "Security" },
  { key: "parking", label: "Parking" },
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
  const securityModules: PermissionModuleKey[] = ["gate", "visitor", "parking"];
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
      full("complaints");
      createOnly("visitor");
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
      item.can_view = row.can_view;
      item.can_create = row.can_create;
      item.can_edit = row.can_edit;
      item.can_delete = row.can_delete;
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

export const getRolePermissionsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      role: z.string().min(1),
    }),
  )
  .handler(async (ctx) => {
    const data = ctx.data as { role: PermissionRole };
    const request = (ctx as any).request as Request | undefined;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) throw new Error("Forbidden");

    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("Tenant not found");

    const db = getDb();
    const [rows] = (await db.query(
      "SELECT module_key, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE tenant_id = ? AND role = ?",
      [tenantId, data.role],
    )) as any[];

    if (rows.length === 0) {
      return buildDefaultPermissions(data.role);
    }

    return mergePermissions(data.role, rows as RolePermissionRecord[]);
  });

export const updateRolePermissionsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      role: z.string().min(1),
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
            "budget",
            "complaints",
            "maintenance",
            "vendors",
            "assets",
            "visitor",
            "gate",
            "parking",
            "notice_board",
            "community_forum",
            "polls",
            "events",
            "amenities",
            "governance",
            "utility_meters",
          ]),
          can_view: z.boolean(),
          can_create: z.boolean(),
          can_edit: z.boolean(),
          can_delete: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async (ctx) => {
    const data = ctx.data as {
      role: PermissionRole;
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

    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("Tenant not found");

    const db = getDb();
    const values = data.permissions.map((permission) => [
      crypto.randomUUID(),
      tenantId,
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
  if (userRoles.includes("super_admin")) {
    return buildFullAccess();
  }

  const role = userRoles[0] as PermissionRole | undefined;
  if (!role) {
    return buildEmptyPermissions();
  }

  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return buildDefaultPermissions(role);

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT module_key, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE tenant_id = ? AND role = ?",
    [tenantId, role],
  )) as any[];

  if (rows.length === 0) {
    return buildDefaultPermissions(role);
  }

  return mergePermissions(role, rows as RolePermissionRecord[]);
});
