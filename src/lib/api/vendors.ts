import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


export const getVendorsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query("SELECT * FROM vendors WHERE tenant_id = ? ORDER BY name", [
    tenantId,
  ])) as any[];
  return rows;
});

export const createVendorFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      category: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO vendors (id, tenant_id, name, category, phone, email) VALUES (?, ?, ?, ?, ?, ?)",
      [id, tenantId, data.name, data.category, data.phone || null, data.email || null],
    );
    return { id };
  });

export const getRfqsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM rfqs WHERE tenant_id = ? ORDER BY created_at DESC",
    [tenantId],
  )) as any[];
  return rows;
});

export const createRfqFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO rfqs (id, tenant_id, title, description, status) VALUES (?, ?, ?, ?, 'draft')",
      [id, tenantId, data.title, data.description],
    );
    return { id };
  });

export const submitQuotationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rfqId: z.string(),
      vendorId: z.string(),
      amount: z.number().positive(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO quotations (id, rfq_id, vendor_id, tenant_id, amount, notes, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
      [id, data.rfqId, data.vendorId, tenantId, data.amount, data.notes || null],
    );
    return { id };
  });

export const getQuotationsFn = createServerFn({ method: "GET" })
  .validator(z.object({ rfqId: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const db = getDb();
    const [rows] = (await db.query(
      `SELECT q.*, v.name AS vendor_name
       FROM quotations q
       JOIN vendors v ON v.id = q.vendor_id
       WHERE q.rfq_id = ? AND q.tenant_id = ?`,
      [data.rfqId, tenantId],
    )) as any[];
    return rows;
  });

export const createPurchaseOrderFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      vendorId: z.string(),
      amount: z.number().positive(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO purchase_orders (id, tenant_id, vendor_id, amount, status) VALUES (?, ?, ?, ?, 'pending')",
      [id, tenantId, data.vendorId, data.amount],
    );
    return { id };
  });

export const awardQuotationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rfqId: z.string(),
      quotationId: z.string(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();

    // Begin Transaction
    await db.query("START TRANSACTION");

    try {
      // 1. Approve selected quotation
      await db.query("UPDATE quotations SET status = 'approved' WHERE id = ? AND tenant_id = ?", [
        data.quotationId,
        tenantId,
      ]);

      // 2. Reject other quotations for this RFQ
      await db.query(
        "UPDATE quotations SET status = 'rejected' WHERE rfq_id = ? AND id != ? AND tenant_id = ?",
        [data.rfqId, data.quotationId, tenantId],
      );

      // 3. Close the RFQ
      await db.query("UPDATE rfqs SET status = 'closed' WHERE id = ? AND tenant_id = ?", [
        data.rfqId,
        tenantId,
      ]);

      // 4. Retrieve vendor details & amount to generate Purchase Order
      const [quotes] = (await db.query("SELECT vendor_id, amount FROM quotations WHERE id = ?", [
        data.quotationId,
      ])) as any[];

      if (quotes.length > 0) {
        const poId = crypto.randomUUID();
        await db.query(
          "INSERT INTO purchase_orders (id, tenant_id, vendor_id, amount, status) VALUES (?, ?, ?, ?, 'pending')",
          [poId, tenantId, quotes[0].vendor_id, quotes[0].amount],
        );
      }

      await db.query("COMMIT");
      return { success: true };
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  });
