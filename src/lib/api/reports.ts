import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, hasAnyRole, getTenantScoping } from "./auth-helper";

export const getFinancialSummaryReportFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    
    // Role check - only admin and finance head can access financial reports
    const roles = await getUserRoles(userId);
    if (!hasAnyRole(roles, ["super_admin", "society_admin", "finance_head"])) {
      throw new Error("Forbidden - Finance access required");
    }

    const db = getDb();
    const { sqlFilter: ledgerFilter, sqlParams: ledgerParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: paymentFilter, sqlParams: paymentParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");

    // Calculate total billed from ledgers
    const [billedRows] = (await db.query(
      `SELECT SUM(amount) AS total FROM ledgers WHERE ${ledgerFilter} AND entry_type = 'debit'`,
      ledgerParams,
    )) as any[];

    // Calculate total collected from payments
    const [collectedRows] = (await db.query(
      `SELECT SUM(amount) AS total FROM payments WHERE ${paymentFilter} AND status = 'cleared'`,
      paymentParams,
    )) as any[];

    const totalBilled = Number(billedRows[0]?.total || 0);
    const totalCollected = Number(collectedRows[0]?.total || 0);
    const outstanding = Math.max(0, totalBilled - totalCollected);

    return { totalBilled, totalCollected, outstanding };
  });

export const getOccupancyReportFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    
    // Role check - admin access required for occupancy reports
    const roles = await getUserRoles(userId);
    if (!hasAnyRole(roles, ["super_admin", "society_admin", "finance_head"])) {
      throw new Error("Forbidden - Admin access required");
    }

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "u.tenant_id");
    const [rows] = (await db.query(
      `SELECT u.unit_number, u.status AS occupancy_status, u.unit_type, b.name AS block_name
         FROM units u
         LEFT JOIN blocks b ON b.id = u.block_id
         WHERE ${sqlFilter} ORDER BY b.name, u.unit_number`,
      sqlParams,
    )) as any[];
    return rows;
  });

export const getComplaintResolutionReportFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    
    // Role check - admin access required for complaint reports
    const roles = await getUserRoles(userId);
    if (!hasAnyRole(roles, ["super_admin", "society_admin", "maintenance_head"])) {
      throw new Error("Forbidden - Admin access required");
    }

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const [rows] = (await db.query(
      `SELECT status, COUNT(*) AS count
       FROM complaints
       WHERE ${sqlFilter} GROUP BY status`,
      sqlParams,
    )) as any[];

    let open = 0;
    let resolved = 0;
    let total = 0;

    rows.forEach((r: any) => {
      total += r.count;
      if (r.status === "resolved" || r.status === "closed") {
        resolved += r.count;
      } else {
        open += r.count;
      }
    });

    return { total, open, resolved };
  });
