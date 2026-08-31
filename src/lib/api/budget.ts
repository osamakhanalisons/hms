import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, getTenantScoping } from "./auth-helper";


export const getBudgetsFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "b.tenant_id");
    const [rows] = (await db.query(
      `SELECT b.*, t.name AS tenant_name
       FROM budgets b
       LEFT JOIN tenants t ON t.id = b.tenant_id
       WHERE ${sqlFilter}
       ORDER BY b.year DESC`,
      sqlParams,
    )) as any[];
    return rows;
  });

export const createBudgetFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      year: z.number().int(),
      title: z.string().min(1),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) {
      throw new Error("Forbidden - Admin access required");
    }

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      "INSERT INTO budgets (id, tenant_id, year, title, is_approved) VALUES (?, ?, ?, ?, FALSE)",
      [id, tenantId, data.year, data.title],
    );
    return { id };
  });

export const getBudgetLineItemsFn = createServerFn({ method: "GET" })
  .validator(z.object({ budgetId: z.string(), tenantId: z.string().optional() }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const [rows] = (await db.query(
      `SELECT * FROM budget_line_items WHERE budget_id = ? AND ${sqlFilter}`,
      [data.budgetId, ...sqlParams],
    )) as any[];
    return rows;
  });

export const addBudgetLineItemFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      budgetId: z.string(),
      category: z.string().min(1),
      plannedAmount: z.number().positive(),
      actualAmount: z.number().nonnegative().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) {
      throw new Error("Forbidden - Admin access required");
    }

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO budget_line_items (id, budget_id, tenant_id, category, planned_amount, actual_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.budgetId, tenantId, data.category, data.plannedAmount, data.actualAmount || 0.0],
    );
    return { id };
  });

