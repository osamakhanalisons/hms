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

