import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VendorItem = {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  taxId: string | null;
  address: string | null;
  bankDetails: string | null;
  rating: number;
  status: "active" | "inactive";
  createdAt: string;
};

export type RfqItem = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: "draft" | "sent" | "awarded" | "closed";
  budgetAmount: number;
  dueDate: string | null;
  awardedVendorId: string | null;
  awardedVendorName: string | null;
  awardedQuotationId: string | null;
  submissionsCount: number;
  createdAt: string;
};

export type QuotationItem = {
  id: string;
  rfqId: string;
  rfqTitle: string | null;
  vendorId: string;
  vendorName: string;
  tenantId: string;
  amount: number;
  quotationNumber: string | null;
  deliveryTimeline: string | null;
  validUntil: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type PurchaseOrderItem = {
  id: string;
  tenantId: string;
  poNumber: string | null;
  vendorId: string;
  vendorName: string;
  rfqId: string | null;
  quotationId: string | null;
  amount: number;
  status: "pending" | "approved" | "completed";
  notes: string | null;
  createdAt: string;
};

export type VendorsOverview = {
  summary: {
    totalVendors: number;
    activeVendors: number;
    openRfqs: number;
    totalAwardedValue: number;
    activePurchaseOrders: number;
  };
  vendors: VendorItem[];
  rfqs: RfqItem[];
  quotations: QuotationItem[];
  purchaseOrders: PurchaseOrderItem[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v);
};

function canManageVendors(roles: string[]): boolean {
  return (
    isAdminRole(roles) ||
    hasAnyRole(roles, ["society_admin", "treasurer", "committee_member", "maintenance_head"])
  );
}

// ─── GET VENDORS OVERVIEW ────────────────────────────────────────────────────
export const getVendorsOverviewFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId: sessionTenantId } = await requirePermission(request, "vendors", "view");

    const db = getDb();

    // Self-healing schema assertions
    try {
      const [vCols] = (await db.query(`SHOW COLUMNS FROM vendors`)) as any[];
      const vColNames = new Set(vCols.map((c: any) => c.Field));
      if (!vColNames.has("address")) await db.query("ALTER TABLE vendors ADD COLUMN address TEXT NULL");
      if (!vColNames.has("tax_id")) await db.query("ALTER TABLE vendors ADD COLUMN tax_id VARCHAR(64) NULL");
      if (!vColNames.has("contact_person")) await db.query("ALTER TABLE vendors ADD COLUMN contact_person VARCHAR(128) NULL");
      if (!vColNames.has("status")) await db.query("ALTER TABLE vendors ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'");
    } catch (_) {}

    try {
      const [rfqCols] = (await db.query(`SHOW COLUMNS FROM rfqs`)) as any[];
      const rfqColNames = new Set(rfqCols.map((c: any) => c.Field));
      if (!rfqColNames.has("due_date")) await db.query("ALTER TABLE rfqs ADD COLUMN due_date DATE NULL");
      if (!rfqColNames.has("budget_amount")) await db.query("ALTER TABLE rfqs ADD COLUMN budget_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      if (!rfqColNames.has("awarded_vendor_id")) await db.query("ALTER TABLE rfqs ADD COLUMN awarded_vendor_id VARCHAR(36) NULL");
    } catch (_) {}

    const { sqlFilter: vFilter, sqlParams: vParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: rfqFilter, sqlParams: rfqParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: poFilter, sqlParams: poParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: queryFilter, sqlParams: queryParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: rfqRowsFilter, sqlParams: rfqRowsParamsBase } = await getTenantScoping(request, data?.tenantId, "r.tenant_id");
    const { sqlFilter: qRowsFilter, sqlParams: qRowsParamsBase } = await getTenantScoping(request, data?.tenantId, "q.tenant_id");
    const { sqlFilter: poRowsFilter, sqlParams: poRowsParamsBase } = await getTenantScoping(request, data?.tenantId, "po.tenant_id");

    // 1. KPI Calculations
    const [[vSum]] = (await db.query(
      `SELECT
         COUNT(*) AS total_vendors,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_vendors
       FROM vendors
       WHERE ${vFilter}`,
      vParamsBase,
    )) as any[];

    const [[rfqSum]] = (await db.query(
      `SELECT COUNT(*) AS open_rfqs FROM rfqs WHERE ${rfqFilter} AND status IN ('draft', 'sent')`,
      rfqParamsBase,
    )) as any[];

    const [[poSum]] = (await db.query(
      `SELECT
         COUNT(*) AS active_pos,
         COALESCE(SUM(amount), 0) AS total_val
       FROM purchase_orders
       WHERE ${poFilter} AND status IN ('pending', 'approved', 'completed')`,
      poParamsBase,
    )) as any[];

    // 2. Fetch Vendors
    let vQuery = `SELECT * FROM vendors WHERE ${queryFilter}`;
    const vParams: any[] = [...queryParamsBase];
    if (data?.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      vQuery += ` AND (name LIKE ? OR category LIKE ? OR contact_person LIKE ? OR phone LIKE ?)`;
      vParams.push(q, q, q, q);
    }
    if (data?.category && data.category !== "all") {
      vQuery += ` AND category = ?`;
      vParams.push(data.category);
    }
    if (data?.status && data.status !== "all") {
      vQuery += ` AND status = ?`;
      vParams.push(data.status);
    }
    vQuery += ` ORDER BY name ASC`;

    const [vRows] = (await db.query(vQuery, vParams)) as any[];
    const vendors: VendorItem[] = vRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      category: r.category,
      phone: r.phone ?? null,
      email: r.email ?? null,
      contactPerson: r.contact_person ?? null,
      taxId: r.tax_id ?? null,
      address: r.address ?? null,
      bankDetails: r.bank_details ?? null,
      rating: Number(r.rating ?? 5.0),
      status: r.status || "active",
      createdAt: toISO(r.created_at),
    }));

    // 3. Fetch RFQs
    const [rfqRows] = (await db.query(
      `SELECT r.*, v.name AS awarded_vendor_name,
              (SELECT COUNT(*) FROM quotations q WHERE q.rfq_id = r.id) AS submissions_count
       FROM rfqs r
       LEFT JOIN vendors v ON v.id = r.awarded_vendor_id
       WHERE ${rfqRowsFilter}
       ORDER BY r.created_at DESC`,
      rfqRowsParamsBase,
    )) as any[];

    const rfqs: RfqItem[] = rfqRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      title: r.title,
      description: r.description,
      status: r.status,
      budgetAmount: Number(r.budget_amount ?? 0),
      dueDate: toISO(r.due_date),
      awardedVendorId: r.awarded_vendor_id ?? null,
      awardedVendorName: r.awarded_vendor_name ?? null,
      awardedQuotationId: r.awarded_quotation_id ?? null,
      submissionsCount: Number(r.submissions_count ?? 0),
      createdAt: toISO(r.created_at),
    }));

    // 4. Fetch Quotations
    const [qRows] = (await db.query(
      `SELECT q.*, r.title AS rfq_title, v.name AS vendor_name
       FROM quotations q
       LEFT JOIN rfqs r ON r.id = q.rfq_id
       JOIN vendors v ON v.id = q.vendor_id
       WHERE ${qRowsFilter}
       ORDER BY q.created_at DESC`,
      qRowsParamsBase,
    )) as any[];

    const quotations: QuotationItem[] = qRows.map((r: any) => ({
      id: r.id,
      rfqId: r.rfq_id,
      rfqTitle: r.rfq_title ?? null,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
      tenantId: r.tenant_id,
      amount: Number(r.amount ?? 0),
      quotationNumber: r.quotation_number ?? null,
      deliveryTimeline: r.delivery_timeline ?? null,
      validUntil: toISO(r.valid_until),
      notes: r.notes ?? null,
      status: r.status,
      createdAt: toISO(r.created_at),
    }));

    // 5. Fetch Purchase Orders
    const [poRows] = (await db.query(
      `SELECT po.*, v.name AS vendor_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       WHERE ${poRowsFilter}
       ORDER BY po.created_at DESC`,
      poRowsParamsBase,
    )) as any[];

    const purchaseOrders: PurchaseOrderItem[] = poRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      poNumber: r.po_number ?? null,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
      rfqId: r.rfq_id ?? null,
      quotationId: r.quotation_id ?? null,
      amount: Number(r.amount ?? 0),
      status: r.status,
      notes: r.notes ?? null,
      createdAt: toISO(r.created_at),
    }));

    return {
      summary: {
        totalVendors: Number(vSum?.total_vendors ?? 0),
        activeVendors: Number(vSum?.active_vendors ?? 0),
        openRfqs: Number(rfqSum?.open_rfqs ?? 0),
        totalAwardedValue: Number(poSum?.total_val ?? 0),
        activePurchaseOrders: Number(poSum?.active_pos ?? 0),
      },
      vendors,
      rfqs,
      quotations,
      purchaseOrders,
    } satisfies VendorsOverview;
  });

export const getVendorsFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const overview = await (getVendorsOverviewFn as any)({ request });
  return overview.vendors;
});

export const getRfqsFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const overview = await (getVendorsOverviewFn as any)({ request });
  return overview.rfqs;
});

// ─── CREATE VENDOR ───────────────────────────────────────────────────────────
export const createVendorFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1, "Vendor name is required"),
      category: z.string().min(1, "Category is required"),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      contactPerson: z.string().optional(),
      taxId: z.string().optional(),
      address: z.string().optional(),
      bankDetails: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "create");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO vendors (id, tenant_id, name, category, phone, email, contact_person, tax_id, address, bank_details, rating, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.00, 'active')`,
      [
        id,
        tenantId,
        data.name.trim(),
        data.category.trim(),
        data.phone || null,
        data.email || null,
        data.contactPerson || null,
        data.taxId || null,
        data.address || null,
        data.bankDetails || null,
      ],
    );

    return { id, success: true };
  });

// ─── UPDATE VENDOR ───────────────────────────────────────────────────────────
export const updateVendorFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      vendorId: z.string(),
      name: z.string().min(1),
      category: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      contactPerson: z.string().optional(),
      taxId: z.string().optional(),
      address: z.string().optional(),
      bankDetails: z.string().optional(),
      status: z.enum(["active", "inactive"]),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "edit");

    const db = getDb();
    const [res] = (await db.query(
      `UPDATE vendors
       SET name = ?, category = ?, phone = ?, email = ?, contact_person = ?, tax_id = ?, address = ?, bank_details = ?, status = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        data.name.trim(),
        data.category.trim(),
        data.phone || null,
        data.email || null,
        data.contactPerson || null,
        data.taxId || null,
        data.address || null,
        data.bankDetails || null,
        data.status,
        data.vendorId,
        tenantId,
      ],
    )) as any[];

    if (res.affectedRows === 0) {
      throw new Error("Vendor not found or unauthorized");
    }

    return { success: true };
  });

// ─── CREATE RFQ ──────────────────────────────────────────────────────────────
export const createRfqFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().min(1, "Description is required"),
      budgetAmount: z.number().nonnegative().optional(),
      dueDate: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "create");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO rfqs (id, tenant_id, title, description, status, budget_amount, due_date)
       VALUES (?, ?, ?, ?, 'sent', ?, ?)`,
      [
        id,
        tenantId,
        data.title.trim(),
        data.description.trim(),
        data.budgetAmount ?? 0,
        data.dueDate || null,
      ],
    );

    return { id, success: true };
  });

// ─── SUBMIT QUOTATION ────────────────────────────────────────────────────────
export const submitQuotationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rfqId: z.string(),
      vendorId: z.string(),
      amount: z.number().positive("Amount must be greater than zero"),
      deliveryTimeline: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "create");

    const db = getDb();

    // Verify RFQ belongs to tenant
    const [[rfq]] = (await db.query("SELECT id FROM rfqs WHERE id = ? AND tenant_id = ?", [
      data.rfqId,
      tenantId,
    ])) as any[];
    if (!rfq) throw new Error("Invalid RFQ for this tenant");

    // Verify Vendor belongs to tenant
    const [[vendor]] = (await db.query("SELECT id FROM vendors WHERE id = ? AND tenant_id = ?", [
      data.vendorId,
      tenantId,
    ])) as any[];
    if (!vendor) throw new Error("Invalid vendor for this tenant");

    const id = crypto.randomUUID();
    const qNum = `QUOTE-${Date.now().toString().slice(-6)}`;

    await db.query(
      `INSERT INTO quotations (id, rfq_id, vendor_id, tenant_id, amount, quotation_number, delivery_timeline, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        data.rfqId,
        data.vendorId,
        tenantId,
        data.amount,
        qNum,
        data.deliveryTimeline || null,
        data.notes || null,
      ],
    );

    return { id, success: true };
  });

export const getQuotationsFn = createServerFn({ method: "GET" })
  .validator(z.object({ rfqId: z.string() }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "view");

    const db = getDb();
    
    // Explicitly verify RFQ belongs to current tenant
    const [[rfq]] = (await db.query("SELECT id FROM rfqs WHERE id = ? AND tenant_id = ?", [
      data.rfqId,
      tenantId,
    ])) as any[];
    if (!rfq) throw new Error("Forbidden — RFQ not found or unauthorized");
    const [rows] = (await db.query(
      `SELECT q.*, v.name AS vendor_name
       FROM quotations q
       JOIN vendors v ON v.id = q.vendor_id
       WHERE q.rfq_id = ? AND q.tenant_id = ?
       ORDER BY q.amount ASC`,
      [data.rfqId, tenantId],
    )) as any[];

    return rows;
  });

export const awardQuotationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rfqId: z.string(),
      quotationId: z.string(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "edit");

    const db = getDb();
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Lock and verify RFQ
      const [[rfq]] = (await conn.query(
        "SELECT id, status FROM rfqs WHERE id = ? AND tenant_id = ? FOR UPDATE",
        [data.rfqId, tenantId],
      )) as any[];

      if (!rfq) throw new Error("RFQ not found or unauthorized");
      if (rfq.status === "awarded" || rfq.status === "closed") {
        throw new Error("RFQ has already been awarded or closed");
      }

      // 2. Lock and verify Quotation
      const [[quote]] = (await conn.query(
        "SELECT id, vendor_id, amount FROM quotations WHERE id = ? AND rfq_id = ? AND tenant_id = ? FOR UPDATE",
        [data.quotationId, data.rfqId, tenantId],
      )) as any[];

      if (!quote) throw new Error("Quotation not found for this RFQ");

      // 3. Approve winning quotation
      await conn.query(
        "UPDATE quotations SET status = 'approved' WHERE id = ? AND tenant_id = ?",
        [data.quotationId, tenantId],
      );

      // 4. Reject remaining quotations
      await conn.query(
        "UPDATE quotations SET status = 'rejected' WHERE rfq_id = ? AND id != ? AND tenant_id = ?",
        [data.rfqId, data.quotationId, tenantId],
      );

      // 5. Close RFQ & set winner
      await conn.query(
        "UPDATE rfqs SET status = 'awarded', awarded_vendor_id = ?, awarded_quotation_id = ? WHERE id = ? AND tenant_id = ?",
        [quote.vendor_id, data.quotationId, data.rfqId, tenantId],
      );

      // 6. Generate Purchase Order
      const poId = crypto.randomUUID();
      const poNum = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      await conn.query(
        `INSERT INTO purchase_orders (id, tenant_id, po_number, vendor_id, rfq_id, quotation_id, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`,
        [poId, tenantId, poNum, quote.vendor_id, data.rfqId, data.quotationId, quote.amount],
      );

      await conn.commit();
      return { success: true, purchaseOrderId: poId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

export const createPurchaseOrderFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      vendorId: z.string(),
      amount: z.number().positive("PO Amount must be greater than zero"),
      notes: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "vendors", "create");

    const db = getDb();

    // Verify vendor
    const [[vendor]] = (await db.query("SELECT id FROM vendors WHERE id = ? AND tenant_id = ?", [
      data.vendorId,
      tenantId,
    ])) as any[];
    if (!vendor) throw new Error("Vendor not found for this tenant");

    const id = crypto.randomUUID();
    const poNum = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.query(
      `INSERT INTO purchase_orders (id, tenant_id, po_number, vendor_id, amount, status, notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, tenantId, poNum, data.vendorId, data.amount, data.notes || null],
    );

    return { id, success: true };
  });
