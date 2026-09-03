import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/lib/db.server";
import { z } from "zod";
import { getSessionUser, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";

export type PlatformOverview = {
  totalUsers: number;
  totalTenants: number;
  activeModules: number;
  inactiveModules: number;
  totalUnits: number;
  openComplaints: number;
  pendingWorkOrders: number;
  recentAuditLogs: {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_email: string | null;
    created_at: string;
  }[];
  tenantPlan: string | null;
  tenantName: string | null;
  tenantCreatedAt: string | null;
};

/**
 * getPlatformOverviewFn
 *
 * Admin-only endpoint.
 * Returns real DB-backed platform statistics scoped to the caller's tenant.
 * Super-admin sees cross-tenant aggregate counts; society-admin sees their own tenant only.
 */
export const getPlatformOverviewFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    if (!isAdminRole(roles)) throw new Error("Forbidden – admin access required");

    const db = getDb();
    const isSuperAdmin = roles.includes("super_admin");

    const { sqlFilter, sqlParams, tenantId: activeTenantId } = await getTenantScoping(
      request,
      data?.tenantId,
      "tenant_id"
    );

    // ── 1. Tenant info ────────────────────────────────────────────────────────
    let tenantRow: any = null;
    if (activeTenantId) {
      const [[tRow]] = (await db.query(
        "SELECT name, plan, created_at FROM tenants WHERE id = ?",
        [activeTenantId],
      )) as any[];
      tenantRow = tRow;
    } else {
      tenantRow = {
        name: "HousingOS Platform",
        plan: "enterprise",
        created_at: null,
      };
    }

    // ── 2. Total tenants (super_admin: all; society_admin: just 1) ─────────────
    let totalTenants: number;
    if (isSuperAdmin) {
      const [[tRow]] = (await db.query(
        "SELECT COUNT(*) AS cnt FROM tenants WHERE is_active = TRUE",
      )) as any[];
      totalTenants = Number(tRow?.cnt ?? 1);
    } else {
      totalTenants = 1;
    }

    // ── 3. Total users scoped to tenant (via profiles) ─────────────────────────
    const { sqlFilter: uFilter, sqlParams: uParams } = await getTenantScoping(
      request,
      data?.tenantId,
      "p.tenant_id"
    );
    const [[uRow]] = (await db.query(
      `SELECT COUNT(DISTINCT p.id) AS cnt
       FROM profiles p
       WHERE ${uFilter}`,
      uParams,
    )) as any[];
    const totalUsers = Number(uRow?.cnt ?? 0);

    // ── 4. Active/Inactive modules for this tenant ─────────────────────────────
    let activeModules = 0;
    let inactiveModules = 0;
    if (activeTenantId) {
      const [[activeRow]] = (await db.query(
        "SELECT COUNT(*) AS cnt FROM tenant_modules WHERE tenant_id = ? AND is_active = TRUE",
        [activeTenantId],
      )) as any[];
      const [[inactiveRow]] = (await db.query(
        "SELECT COUNT(*) AS cnt FROM tenant_modules WHERE tenant_id = ? AND is_active = FALSE",
        [activeTenantId],
      )) as any[];
      activeModules = Number(activeRow?.cnt ?? 0);
      inactiveModules = Number(inactiveRow?.cnt ?? 0);
    } else {
      // Platform-wide active modules: total module registrations
      const [[activeRow]] = (await db.query(
        "SELECT COUNT(*) AS cnt FROM tenant_modules WHERE is_active = TRUE",
      )) as any[];
      const [[inactiveRow]] = (await db.query(
        "SELECT COUNT(*) AS cnt FROM tenant_modules WHERE is_active = FALSE",
      )) as any[];
      activeModules = Number(activeRow?.cnt ?? 0);
      inactiveModules = Number(inactiveRow?.cnt ?? 0);
    }

    // ── 5. Total units ─────────────────────────────────────────────────────────
    const { sqlFilter: unitFilter, sqlParams: unitParams } = await getTenantScoping(
      request,
      data?.tenantId,
      "tenant_id"
    );
    const [[unitRow]] = (await db.query(
      `SELECT COUNT(*) AS cnt FROM units WHERE ${unitFilter}`,
      unitParams,
    )) as any[];
    const totalUnits = Number(unitRow?.cnt ?? 0);

    // ── 6. Open complaints ─────────────────────────────────────────────────────
    const { sqlFilter: cFilter, sqlParams: cParams } = await getTenantScoping(
      request,
      data?.tenantId,
      "tenant_id"
    );
    const [[cRow]] = (await db.query(
      `SELECT COUNT(*) AS cnt FROM complaints WHERE ${cFilter} AND status NOT IN ('resolved','closed')`,
      cParams,
    )) as any[];
    const openComplaints = Number(cRow?.cnt ?? 0);

    // ── 7. Pending work orders ─────────────────────────────────────────────────
    const { sqlFilter: wFilter, sqlParams: wParams } = await getTenantScoping(
      request,
      data?.tenantId,
      "tenant_id"
    );
    const [[wRow]] = (await db.query(
      `SELECT COUNT(*) AS cnt FROM maintenance_work_orders WHERE ${wFilter} AND status IN ('open','assigned','in_progress')`,
      wParams,
    )) as any[];
    const pendingWorkOrders = Number(wRow?.cnt ?? 0);

    // ── 8. Recent audit logs (up to 100 entries for pagination) ───────────────
    const { sqlFilter: alFilter, sqlParams: alParams } = await getTenantScoping(
      request,
      data?.tenantId,
      "al.tenant_id"
    );
    const [auditRows] = (await db.query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.created_at,
              u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${alFilter}
       ORDER BY al.created_at DESC
       LIMIT 100`,
      alParams,
    )) as any[];

    // Helper: safely convert a MySQL Date/string to ISO string
    const toISO = (v: any): string | null => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString();
      return String(v);
    };

    return {
      totalUsers,
      totalTenants,
      activeModules,
      inactiveModules,
      totalUnits,
      openComplaints,
      pendingWorkOrders,
      tenantPlan: tenantRow?.plan ?? null,
      tenantName: tenantRow?.name ?? null,
      tenantCreatedAt: toISO(tenantRow?.created_at),
      recentAuditLogs: (auditRows as any[]).map((r) => ({
        id: r.id,
        action: r.action,
        entity_type: r.entity_type,
        entity_id: r.entity_id ?? null,
        actor_email: r.actor_email ?? null,
        created_at: toISO(r.created_at) ?? "",
      })),
    } satisfies PlatformOverview;
  });
