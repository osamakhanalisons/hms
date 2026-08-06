import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole } from "./auth-helper";


export const getPaymentsFn = createServerFn({ method: "GET" })
  .validator(z.object({ unitId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const roles = await getUserRoles(userId);
    const isAdmin = isAdminRole(roles);
    const db = getDb();

    let query = `
      SELECT p.*, u.unit_number, pr.full_name
      FROM payments p
      JOIN units u ON u.id = p.unit_id
      LEFT JOIN residents r ON r.unit_id = u.id AND r.is_current = TRUE
      LEFT JOIN persons pr ON pr.id = r.person_id
      WHERE p.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (!isAdmin) {
      // Resident: only see payments for their own unit
      query += " AND r.person_id IN (SELECT id FROM persons WHERE user_id = ?)";
      params.push(userId);
    } else if (data?.unitId) {
      query += " AND p.unit_id = ?";
      params.push(data.unitId);
    }
    query += " ORDER BY p.created_at DESC";

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });

export const recordPaymentFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      unitId: z.string(),
      amount: z.number().positive(),
      paymentMethod: z.enum(["cash", "bank_transfer", "cheque", "online"]),
      paymentDate: z.string(),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const paymentId = crypto.randomUUID();
      const receiptNumber =
        "REC-" + Date.now().toString().slice(-6) + "-" + Math.floor(Math.random() * 1000);

      // Save payment
      await connection.query(
        `INSERT INTO payments (id, unit_id, tenant_id, amount, payment_method, receipt_number, payment_date, reference, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          data.unitId,
          tenantId,
          data.amount,
          data.paymentMethod,
          receiptNumber,
          data.paymentDate,
          data.reference || null,
          data.notes || null,
          userId,
        ],
      );

      // Fetch current unit balance
      const [lastBal] = (await connection.query(
        "SELECT balance_after FROM ledger_entries WHERE unit_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1",
        [data.unitId, tenantId],
      )) as any[];

      const prevBal = lastBal.length ? Number(lastBal[0].balance_after) : 0;
      const newBal = prevBal - data.amount;

      // Log to ledger
      const ledgerId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO ledger_entries (id, unit_id, tenant_id, type, amount, description, reference_id, balance_after, created_by)
         VALUES (?, ?, ?, 'payment', ?, ?, ?, ?, ?)`,
        [
          ledgerId,
          data.unitId,
          tenantId,
          data.amount,
          `Receipt ${receiptNumber}`,
          paymentId,
          newBal,
          userId,
        ],
      );

      await connection.commit();
      return { success: true, receiptNumber };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });

export const getDailySummaryFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return { todayCollected: 0, count: 0 };

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
       FROM payments
       WHERE tenant_id = ? AND payment_date = CURDATE() AND status = 'recorded'`,
    [tenantId],
  )) as any[];

  return {
    todayCollected: Number(rows[0].total),
    count: Number(rows[0].cnt),
  };
});
