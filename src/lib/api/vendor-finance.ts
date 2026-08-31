import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserTenantId,
  getUserRoles,
  hasAnyRole,
  getTenantScoping,
} from "./auth-helper";
import { requirePermission } from "./permissions";

export type VendorInvoiceItem = {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: "draft" | "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";
  notes: string | null;
  createdAt: string;
};

export type VendorFinanceOverview = {
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
  };
  invoices: VendorInvoiceItem[];
  vendorsList: { id: string; name: string }[];
  purchaseOrdersList: { id: string; vendorId: string; amount: number }[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v);
};

export const getVendorFinanceFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        vendorId: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      })
      .optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    // ── Auth & Scope ─────────────────────────────────────────────────────────
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const scoping = await getTenantScoping(request, data?.tenantId);
    let tenantId = scoping.tenantId;
    const db = getDb();

    if (!tenantId) {
      tenantId = scoping.userTenantId || "";
    }
    if (!tenantId) {
      const [tenants] = (await db.query(
        "SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1",
      )) as unknown as [{ id: string }[], unknown];
      if (tenants.length > 0) {
        tenantId = tenants[0].id;
      }
    }

    if (!tenantId) {
      return {
        summary: { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0 },
        invoices: [],
        vendorsList: [],
        purchaseOrdersList: [],
      } satisfies VendorFinanceOverview;
    }
    const todayStr = new Date().toISOString().split("T")[0];

    // Auto-update overdue status for unpaid past-due invoices
    await db.query(
      `UPDATE vendor_invoices
       SET status = 'overdue'
       WHERE tenant_id = ? AND due_date < ? AND status IN ('pending', 'partially_paid')`,
      [tenantId, todayStr],
    );

    // ── Summary KPIs ─────────────────────────────────────────────────────────
    const [[summaryRow]] = (await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN amount ELSE 0 END), 0) AS total_invoiced,
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN paid_amount ELSE 0 END), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0) AS overdue_cnt
       FROM vendor_invoices
       WHERE tenant_id = ?`,
      [tenantId],
    )) as any[];

    const totalInvoiced = Number(summaryRow?.total_invoiced ?? 0);
    const totalPaid = Number(summaryRow?.total_paid ?? 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
    const overdueCount = Number(summaryRow?.overdue_cnt ?? 0);

    // ── Filtered Invoices ────────────────────────────────────────────────────
    let query = `
      SELECT
        vi.*,
        v.name AS vendor_name,
        v.category AS vendor_category
      FROM vendor_invoices vi
      JOIN vendors v ON v.id = vi.vendor_id
      WHERE vi.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (data?.vendorId && data.vendorId !== "all") {
      query += " AND vi.vendor_id = ?";
      params.push(data.vendorId);
    }

    if (data?.status && data.status !== "all") {
      query += " AND vi.status = ?";
      params.push(data.status);
    }

    if (data?.search && data.search.trim() !== "") {
      const q = `%${data.search.trim()}%`;
      query += " AND (vi.invoice_number LIKE ? OR v.name LIKE ? OR vi.notes LIKE ?)";
      params.push(q, q, q);
    }

    query += " ORDER BY vi.due_date ASC, vi.created_at DESC";

    const [rows] = (await db.query(query, params)) as any[];

    const invoices: VendorInvoiceItem[] = (rows as any[]).map((r) => {
      const amount = Number(r.amount ?? 0);
      const paidAmount = Number(r.paid_amount ?? 0);
      const outstandingAmount = Math.max(0, amount - paidAmount);
      return {
        id: r.id,
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        vendorCategory: r.vendor_category ?? null,
        purchaseOrderId: r.purchase_order_id ?? null,
        invoiceNumber: r.invoice_number,
        invoiceDate: toISO(r.invoice_date),
        dueDate: toISO(r.due_date),
        amount,
        paidAmount,
        outstandingAmount,
        status: r.status,
        notes: r.notes ?? null,
        createdAt: toISO(r.created_at),
      };
    });

    // ── Vendors List & Purchase Orders List for creation modal ───────────────
    const [vendors] = (await db.query(
      "SELECT id, name FROM vendors WHERE tenant_id = ? ORDER BY name ASC",
      [tenantId],
    )) as any[];

    const [pos] = (await db.query(
      "SELECT id, vendor_id, amount FROM purchase_orders WHERE tenant_id = ? ORDER BY created_at DESC",
      [tenantId],
    )) as any[];

    return {
      summary: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        overdueCount,
      },
      invoices,
      vendorsList: (vendors as any[]).map((v) => ({ id: v.id, name: v.name })),
      purchaseOrdersList: (pos as any[]).map((p) => ({
        id: p.id,
        vendorId: p.vendor_id,
        amount: Number(p.amount ?? 0),
      })),
    } satisfies VendorFinanceOverview;
  });

export const createVendorInvoiceFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      vendorId: z.string().min(1, "Vendor is required"),
      purchaseOrderId: z.string().optional(),
      invoiceNumber: z.string().min(1, "Invoice number is required"),
      invoiceDate: z.string().min(1, "Invoice date is required"),
      dueDate: z.string().min(1, "Due date is required"),
      amount: z.number().positive("Amount must be greater than zero"),
      notes: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "vendors", "create");

    const db = getDb();

    // Verify vendor belongs to tenant
    const [[vRow]] = (await db.query("SELECT id FROM vendors WHERE id = ? AND tenant_id = ?", [
      data.vendorId,
      tenantId,
    ])) as any[];
    if (!vRow) throw new Error("Invalid vendor selected");

    // Verify purchase order if provided
    if (data.purchaseOrderId) {
      const [[poRow]] = (await db.query(
        "SELECT id, vendor_id FROM purchase_orders WHERE id = ? AND tenant_id = ?",
        [data.purchaseOrderId, tenantId],
      )) as any[];
      if (!poRow) throw new Error("Invalid Purchase Order selected");
      if (poRow.vendor_id !== data.vendorId) {
        throw new Error("Selected Purchase Order does not match the vendor");
      }
    }

    // Check duplicate invoice number
    const [[dupRow]] = (await db.query(
      "SELECT id FROM vendor_invoices WHERE tenant_id = ? AND invoice_number = ?",
      [tenantId, data.invoiceNumber.trim()],
    )) as any[];
    if (dupRow) {
      throw new Error(`Invoice number "${data.invoiceNumber}" already exists`);
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const status = data.dueDate < todayStr ? "overdue" : "pending";

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO vendor_invoices
         (id, tenant_id, vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, amount, paid_amount, status, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?)`,
      [
        id,
        tenantId,
        data.vendorId,
        data.purchaseOrderId || null,
        data.invoiceNumber.trim(),
        data.invoiceDate,
        data.dueDate,
        data.amount,
        status,
        data.notes || null,
        userId,
      ],
    );

    return { id, success: true };
  });

export const recordVendorPaymentFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      invoiceId: z.string(),
      paymentAmount: z.number().positive("Payment amount must be greater than zero"),
      notes: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "vendors", "edit");

    if (data.paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const db = getDb();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Fetch invoice with row lock (FOR UPDATE) & verify tenant isolation
      const [[inv]] = (await connection.query(
        "SELECT * FROM vendor_invoices WHERE id = ? AND tenant_id = ? FOR UPDATE",
        [data.invoiceId, tenantId],
      )) as any[];

      if (!inv) throw new Error("Invoice not found or unauthorized");

      if (inv.status === "cancelled") {
        throw new Error("Cannot record payment on a cancelled invoice");
      }

      if (inv.status === "paid") {
        throw new Error("Invoice is already fully paid");
      }

      const currentPaid = Number(inv.paid_amount ?? 0);
      const totalAmount = Number(inv.amount ?? 0);
      const outstanding = totalAmount - currentPaid;

      if (data.paymentAmount > outstanding + 0.001) {
        throw new Error(
          `Payment amount ₹${data.paymentAmount} cannot exceed outstanding balance of ₹${outstanding}`,
        );
      }

      const newPaidAmount = currentPaid + data.paymentAmount;
      let newStatus = inv.status;

      if (newPaidAmount >= totalAmount - 0.001) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partially_paid";
      }

      await connection.query(
        `UPDATE vendor_invoices
         SET paid_amount = ?, status = ?
         WHERE id = ? AND tenant_id = ?`,
        [newPaidAmount, newStatus, data.invoiceId, tenantId],
      );

      // If invoice is fully paid and linked to PO, auto-complete PO if all invoices paid
      if (newStatus === "paid" && inv.purchase_order_id) {
        const [[unpaidPoInvoices]] = (await connection.query(
          `SELECT COUNT(*) AS cnt
           FROM vendor_invoices
           WHERE purchase_order_id = ? AND tenant_id = ? AND status != 'paid'`,
          [inv.purchase_order_id, tenantId],
        )) as any[];

        if (Number(unpaidPoInvoices?.cnt ?? 0) === 0) {
          await connection.query(
            "UPDATE purchase_orders SET status = 'completed' WHERE id = ? AND tenant_id = ?",
            [inv.purchase_order_id, tenantId],
          );
        }
      }

      await connection.commit();
      return { success: true, paidAmount: newPaidAmount, status: newStatus };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });
