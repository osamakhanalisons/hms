import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import { getSessionUser, getTenantScoping } from "./auth-helper";

export type FinancialTransparencyOverview = {
  totalIncome: number;
  totalBilled: number;
  totalExpenses: number;
  netSurplus: number;
  collectionRate: number;
  selectedYear: number;
  availableYears: number[];
  monthlyTrend: {
    monthKey: string;
    label: string;
    income: number;
    billed: number;
  }[];
  expenseBreakdown: {
    category: string;
    planned: number;
    actual: number;
  }[];
  recentTransactions: {
    id: string;
    date: string;
    unitNumber: string | null;
    type: "income" | "charge" | "expense";
    description: string;
    amount: number;
  }[];
};

const toISOString = (val: any): string => {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString();
  return String(val);
};

export const getFinancialTransparencyFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        year: z.number().optional(),
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    // ── 1. Authentication & Authorization ────────────────────────────────────
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const currentYear = new Date().getFullYear();
    const selectedYear = data?.year ?? currentYear;

    const { sqlFilter: incomeFilter, sqlParams: incomeParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: billedFilter, sqlParams: billedParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: budgetFilter, sqlParams: budgetParamsBase } = await getTenantScoping(request, data?.tenantId, "bli.tenant_id");
    const { sqlFilter: poFilter, sqlParams: poParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: yearsFilter, sqlParams: yearsParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: monthlyIncomeFilter, sqlParams: monthlyIncomeParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: monthlyBilledFilter, sqlParams: monthlyBilledParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: expenseFilter, sqlParams: expenseParamsBase } = await getTenantScoping(request, data?.tenantId, "bli.tenant_id");
    const { sqlFilter: paymentTxFilter, sqlParams: paymentTxParamsBase } = await getTenantScoping(request, data?.tenantId, "p.tenant_id");
    const { sqlFilter: chargeTxFilter, sqlParams: chargeTxParamsBase } = await getTenantScoping(request, data?.tenantId, "le.tenant_id");

    // ── 2. Total Income (Recorded Payments in selected year) ────────────────
    const [[incomeRow]] = (await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE ${incomeFilter} AND status = 'recorded' AND YEAR(payment_date) = ?`,
      [...incomeParamsBase, selectedYear],
    )) as any[];
    const totalIncome = Number(incomeRow?.total ?? 0);

    // ── 3. Total Billed (Ledger Charges in selected year) ────────────────────
    const yearPattern = `${selectedYear}-%`;
    const [[billedRow]] = (await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM ledger_entries
       WHERE ${billedFilter} AND type = 'charge'
         AND (billing_period LIKE ? OR YEAR(created_at) = ?)`,
      [...billedParamsBase, yearPattern, selectedYear],
    )) as any[];
    const totalBilled = Number(billedRow?.total ?? 0);

    // ── 4. Total Expenses (Primary: budget_line_items actuals; Fallback: completed POs)
    const [[budgetExpRow]] = (await db.query(
      `SELECT COALESCE(SUM(bli.actual_amount), 0) AS total
       FROM budget_line_items bli
       JOIN budgets b ON b.id = bli.budget_id
       WHERE ${budgetFilter} AND b.year = ?`,
      [...budgetParamsBase, selectedYear],
    )) as any[];

    const budgetTotal = Number(budgetExpRow?.total ?? 0);

    let totalExpenses = budgetTotal;
    if (budgetTotal === 0) {
      // Fallback: If no budget actuals recorded yet, use completed purchase orders
      const [[poExpRow]] = (await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM purchase_orders
         WHERE ${poFilter} AND status = 'completed' AND YEAR(created_at) = ?`,
        [...poParamsBase, selectedYear],
      )) as any[];
      totalExpenses = Number(poExpRow?.total ?? 0);
    }

    const netSurplus = totalIncome - totalExpenses;
    const collectionRate = totalBilled > 0 ? Math.round((totalIncome / totalBilled) * 100) : 0;

    // ── 5. Available Years ───────────────────────────────────────────────────
    const [yearRows] = (await db.query(
      `SELECT DISTINCT year FROM budgets WHERE ${yearsFilter}
       UNION
       SELECT DISTINCT YEAR(payment_date) AS year FROM payments WHERE ${yearsFilter}
       ORDER BY year DESC`,
      [...yearsParamsBase, ...yearsParamsBase],
    )) as any[];
    
    let availableYears = (yearRows as any[])
      .map((r) => Number(r.year))
      .filter((y) => !isNaN(y) && y > 2000);
    if (!availableYears.includes(currentYear)) {
      availableYears.push(currentYear);
      availableYears.sort((a, b) => b - a);
    }

    // ── 6. Monthly Trend (Income vs Billed) ──────────────────────────────────
    const [monthlyIncomeRows] = (await db.query(
      `SELECT
         DATE_FORMAT(payment_date, '%Y-%m') AS month_key,
         DATE_FORMAT(payment_date, '%b')    AS label,
         SUM(amount)                        AS total
       FROM payments
       WHERE ${monthlyIncomeFilter} AND status = 'recorded' AND YEAR(payment_date) = ?
       GROUP BY month_key, label
       ORDER BY month_key ASC`,
      [...monthlyIncomeParamsBase, selectedYear],
    )) as any[];

    const [monthlyBilledRows] = (await db.query(
      `SELECT
         billing_period AS month_key,
         SUM(amount)    AS total
       FROM ledger_entries
       WHERE ${monthlyBilledFilter} AND type = 'charge' AND billing_period LIKE ?
       GROUP BY billing_period
       ORDER BY billing_period ASC`,
      [...monthlyBilledParamsBase, yearPattern],
    )) as any[];

    const monthlyMap = new Map<string, { monthKey: string; label: string; income: number; billed: number }>();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach((m, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      const key = `${selectedYear}-${monthNum}`;
      monthlyMap.set(key, { monthKey: key, label: m, income: 0, billed: 0 });
    });

    (monthlyIncomeRows as any[]).forEach((r) => {
      if (monthlyMap.has(r.month_key)) {
        monthlyMap.get(r.month_key)!.income = Number(r.total ?? 0);
      }
    });
    (monthlyBilledRows as any[]).forEach((r) => {
      if (monthlyMap.has(r.month_key)) {
        monthlyMap.get(r.month_key)!.billed = Number(r.total ?? 0);
      }
    });

    const monthlyTrend = Array.from(monthlyMap.values());

    // ── 7. Expense Breakdown by Category ─────────────────────────────────────
    const [expenseRows] = (await db.query(
      `SELECT
         bli.category,
         SUM(bli.planned_amount) AS planned,
         SUM(bli.actual_amount)  AS actual
       FROM budget_line_items bli
       JOIN budgets b ON b.id = bli.budget_id
       WHERE ${expenseFilter} AND b.year = ?
       GROUP BY bli.category
       ORDER BY actual DESC`,
      [...expenseParamsBase, selectedYear],
    )) as any[];

    const expenseBreakdown = (expenseRows as any[]).map((r) => ({
      category: r.category || "General / Uncategorized",
      planned: Number(r.planned ?? 0),
      actual: Number(r.actual ?? 0),
    }));

    // ── 8. Recent Financial Transactions ─────────────────────────────────────
    const [paymentTxRows] = (await db.query(
      `SELECT
         p.id,
         p.payment_date AS date,
         u.unit_number,
         'income' AS type,
         CONCAT('Payment (', UPPER(p.payment_method), ') - ', p.receipt_number) AS description,
         p.amount
       FROM payments p
       LEFT JOIN units u ON u.id = p.unit_id
       WHERE ${paymentTxFilter} AND p.status = 'recorded'
       ORDER BY p.payment_date DESC, p.created_at DESC
       LIMIT 10`,
      paymentTxParamsBase,
    )) as any[];

    const [chargeTxRows] = (await db.query(
      `SELECT
         le.id,
         le.created_at AS date,
         u.unit_number,
         'charge' AS type,
         COALESCE(le.description, ch.name, 'Monthly Charge') AS description,
         le.amount
       FROM ledger_entries le
       LEFT JOIN units u ON u.id = le.unit_id
       LEFT JOIN charge_heads ch ON ch.id = le.charge_head_id
       WHERE ${chargeTxFilter} AND le.type = 'charge'
       ORDER BY le.created_at DESC
       LIMIT 10`,
      chargeTxParamsBase,
    )) as any[];

    const combinedTx = [
      ...(paymentTxRows as any[]).map((r) => ({
        id: r.id,
        date: toISOString(r.date),
        unitNumber: r.unit_number ?? null,
        type: "income" as const,
        description: r.description,
        amount: Number(r.amount ?? 0),
      })),
      ...(chargeTxRows as any[]).map((r) => ({
        id: r.id,
        date: toISOString(r.date),
        unitNumber: r.unit_number ?? null,
        type: "charge" as const,
        description: r.description,
        amount: Number(r.amount ?? 0),
      })),
    ];

    combinedTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentTransactions = combinedTx.slice(0, 15);

    return {
      totalIncome,
      totalBilled,
      totalExpenses,
      netSurplus,
      collectionRate,
      selectedYear,
      availableYears,
      monthlyTrend,
      expenseBreakdown,
      recentTransactions,
    } satisfies FinancialTransparencyOverview;
  });
