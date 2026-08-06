import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";

export const getFinancialSummaryReportFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return { totalBilled: 0, totalCollected: 0, outstanding: 0 };

  const db = getDb();

  // Calculate total billed from ledgers
  const [billedRows] = (await db.query(
    "SELECT SUM(amount) AS total FROM ledgers WHERE tenant_id = ? AND entry_type = 'debit'",
    [tenantId],
  )) as any[];

  // Calculate total collected from payments
  const [collectedRows] = (await db.query(
    "SELECT SUM(amount) AS total FROM payments WHERE tenant_id = ? AND status = 'cleared'",
    [tenantId],
  )) as any[];

  const totalBilled = Number(billedRows[0]?.total || 0);
  const totalCollected = Number(collectedRows[0]?.total || 0);
  const outstanding = Math.max(0, totalBilled - totalCollected);

  return { totalBilled, totalCollected, outstanding };
});

export const getOccupancyReportFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT u.unit_number, u.status AS occupancy_status, u.unit_type, b.name AS block_name
       FROM units u
       LEFT JOIN blocks b ON b.id = u.block_id
       WHERE u.tenant_id = ? ORDER BY b.name, u.unit_number`,
    [tenantId],
  )) as any[];
  return rows;
});

export const getComplaintResolutionReportFn = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return { total: 0, open: 0, resolved: 0 };

    const db = getDb();
    const [rows] = (await db.query(
      `SELECT status, COUNT(*) AS count
       FROM complaints
       WHERE tenant_id = ? GROUP BY status`,
      [tenantId],
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
  },
);
