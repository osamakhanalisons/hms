import { getDb } from "../db.server";

export async function getSessionUser(request?: Request) {
  if (!request) return null;
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const parts = c.trim().split("=");
      return [parts[0], parts.slice(1).join("=")];
    }),
  );
  const token = cookies["session_token"];
  if (!token) return null;

  const db = getDb();
  const [sessions] = (await db.query(
    "SELECT user_id, expires_at FROM sessions WHERE id = ? AND expires_at > NOW()",
    [token],
  )) as any[];

  if (sessions.length === 0) return null;
  return sessions[0].user_id as string;
}

export async function getUserTenantId(userId: string) {
  const db = getDb();
  const [rows] = (await db.query("SELECT tenant_id FROM profiles WHERE id = ?", [userId])) as any[];
  return rows.length ? (rows[0].tenant_id as string | null) : null;
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const db = getDb();
  const [rows] = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId])) as any[];
  return rows.map((r: any) => r.role as string);
}

export function isAdminRole(roles: string[]): boolean {
  return roles.includes("super_admin") || roles.includes("society_admin");
}

// Helper to require admin access
export async function requireAdmin(request: Request): Promise<{
  userId: string;
  tenantId: string;
  roles: string[];
}> {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) throw new Error("No tenant");
  
  const roles = await getUserRoles(userId);
  if (!isAdminRole(roles)) {
    throw new Error("Forbidden - Admin access required");
  }
  
  return { userId, tenantId, roles };
}

// Helper to require authentication and return user context
export async function requireAuth(request: Request): Promise<{
  userId: string;
  tenantId: string;
  roles: string[];
}> {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) throw new Error("No tenant");
  
  const roles = await getUserRoles(userId);
  return { userId, tenantId, roles };
}

// Helper to check if user has specific role(s)
export function hasAnyRole(roles: string[], allowedRoles: string[]): boolean {
  return roles.some(role => allowedRoles.includes(role));
}

// Scoping helper for role-aware multi-tenant querying
export async function getTenantScoping(
  request: Request | undefined,
  clientTenantId?: string | null,
  columnName = "tenant_id"
): Promise<{
  isSuperAdmin: boolean;
  tenantId: string;
  sqlFilter: string;
  sqlParams: any[];
  userTenantId: string | null;
}> {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const userTenantId = await getUserTenantId(userId);
  const roles = await getUserRoles(userId);
  const isSuperAdmin = roles.includes("super_admin");

  // Resolve selected tenant from cookies if not explicitly passed
  let selectedTenantIdCookie: string | null = null;
  if (request) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const parts = c.trim().split("=");
          return [parts[0], parts.slice(1).join("=")];
        }),
      );
      selectedTenantIdCookie = cookies["selected_tenant_id"] || null;
    }
  }

  const activeClientTenantId = clientTenantId || selectedTenantIdCookie;

  if (isSuperAdmin) {
    if (activeClientTenantId && activeClientTenantId !== "all" && activeClientTenantId !== "") {
      const db = getDb();
      const [rows] = (await db.query("SELECT id FROM tenants WHERE id = ?", [activeClientTenantId])) as any[];
      if (rows.length > 0) {
        return {
          isSuperAdmin: true,
          tenantId: activeClientTenantId,
          sqlFilter: `${columnName} = ?`,
          sqlParams: [activeClientTenantId],
          userTenantId,
        };
      }
    }
    return {
      isSuperAdmin: true,
      tenantId: "",
      sqlFilter: "1=1",
      sqlParams: [],
      userTenantId,
    };
  } else if (roles.includes("society_admin")) {
    const db = getDb();
    const [assigned] = (await db.query(
      "SELECT tenant_id FROM society_admin_tenants WHERE user_id = ? AND is_active = TRUE",
      [userId],
    )) as any[];

    const assignedTenantIds = assigned.map((r: any) => r.tenant_id as string);
    if (assignedTenantIds.length === 0) {
      throw new Error("Forbidden: No active society assignments found for this administrator.");
    }

    let activeTenantId = assignedTenantIds[0];

    if (assignedTenantIds.length > 1) {
      if (activeClientTenantId && assignedTenantIds.includes(activeClientTenantId)) {
        activeTenantId = activeClientTenantId;
      }
    }

    return {
      isSuperAdmin: false,
      tenantId: activeTenantId,
      sqlFilter: `${columnName} = ?`,
      sqlParams: [activeTenantId],
      userTenantId: activeTenantId,
    };
  } else {
    if (!userTenantId) throw new Error("No tenant associated with user");
    return {
      isSuperAdmin: false,
      tenantId: userTenantId,
      sqlFilter: `${columnName} = ?`,
      sqlParams: [userTenantId],
      userTenantId,
    };
  }
}

