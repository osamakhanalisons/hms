import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserRoles,
  isAdminRole,
  hasAnyRole,
  getTenantScoping,
} from "./auth-helper";
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "../services/notification-service";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type SensitivityLevel = "low" | "medium" | "high";

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  zScore: number;
  expectedMin: number;
  expectedMax: number;
  anomalyScore: number; // 0 to 100
  deviationAmount: number;
  explanation: string;
}

export interface AIFinanceSettings {
  detectAnomalies: boolean;
  sensitivity: SensitivityLevel;
  forecastHorizonMonths: number; // 3 to 12
  notifyTreasurer: boolean;
  updatedAt?: string;
}

export const DEFAULT_AI_FINANCE_SETTINGS: AIFinanceSettings = {
  detectAnomalies: true,
  sensitivity: "medium",
  forecastHorizonMonths: 6,
  notifyTreasurer: true,
};

export interface BudgetVarianceItem {
  id: string;
  category: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
  utilizationPercentage: number;
  status: "normal" | "warning" | "critical";
}

export interface MonthlyForecastItem {
  month: string; // YYYY-MM
  predictedIncome: number;
  predictedExpense: number;
  netCashflow: number;
  confidenceLow: number;
  confidenceHigh: number;
}

// ─── DETERMINISTIC STATISTICAL ALGORITHMS ─────────────────────────────────────

/**
 * Calculates deterministic Z-score based anomaly against a historical baseline.
 * Uses sample standard deviation with Bessel's correction (n - 1).
 */
export function calculateZScoreAnomaly(
  amount: number,
  history: number[],
  sensitivity: SensitivityLevel,
): AnomalyDetectionResult {
  const n = history.length;

  // Multiplier thresholds:
  // Low sensitivity: k = 3.0 (extreme outliers only)
  // Medium sensitivity: k = 2.0 (significant outliers)
  // High sensitivity: k = 1.5 (moderate outliers)
  const kMap: Record<SensitivityLevel, number> = {
    low: 3.0,
    medium: 2.0,
    high: 1.5,
  };
  const k = kMap[sensitivity] || 2.0;

  // Fallback for cold start / small sample size (n < 3)
  if (n < 3) {
    if (n === 0) {
      return {
        isAnomaly: false,
        zScore: 0,
        expectedMin: 0,
        expectedMax: Math.round(amount * 1.5),
        anomalyScore: 0,
        deviationAmount: 0,
        explanation: "Insufficient historical baseline for outlier detection.",
      };
    }

    const mean = history.reduce((sum, val) => sum + val, 0) / n;
    const fallbackThreshold = mean * 2.5;
    const isAnomaly = amount > fallbackThreshold;
    const deviation = amount - mean;
    const score = isAnomaly ? 70 : 0;

    return {
      isAnomaly,
      zScore: isAnomaly ? 2.5 : 0,
      expectedMin: 0,
      expectedMax: Math.round(fallbackThreshold),
      anomalyScore: score,
      deviationAmount: Math.round(deviation),
      explanation: isAnomaly
        ? `Amount exceeds 2.5x historical average (₨${Math.round(mean).toLocaleString()}) for this category.`
        : "Amount within normal bounds based on limited transaction history.",
    };
  }

  // Calculate sample mean
  const mean = history.reduce((sum, val) => sum + val, 0) / n;

  // Calculate sample standard deviation
  const varianceSum = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const stdDev = Math.sqrt(varianceSum / (n - 1));

  // If all historical values are identical
  if (stdDev === 0) {
    const isAnomaly = amount > mean * 1.5;
    return {
      isAnomaly,
      zScore: isAnomaly ? 3.0 : 0,
      expectedMin: Math.max(0, Math.round(mean * 0.8)),
      expectedMax: Math.round(mean * 1.2),
      anomalyScore: isAnomaly ? 80 : 0,
      deviationAmount: Math.round(amount - mean),
      explanation: isAnomaly
        ? `Amount deviates significantly from uniform historical value (₨${Math.round(mean).toLocaleString()}).`
        : "Amount aligns with historical baseline.",
    };
  }

  const zScore = (amount - mean) / stdDev;
  const isAnomaly = zScore > k;
  const expectedMin = Math.max(0, Math.round(mean - k * stdDev));
  const expectedMax = Math.round(mean + k * stdDev);
  const deviationAmount = Math.round(amount - mean);

  // Scaled 0 to 100 anomaly score
  const anomalyScore = isAnomaly
    ? Math.min(100, Math.max(50, Math.round((zScore / 4.0) * 100)))
    : 0;

  const explanation = isAnomaly
    ? `Amount is ${zScore.toFixed(1)} standard deviations above mean (₨${Math.round(mean).toLocaleString()}), exceeding ${sensitivity} sensitivity threshold (${k}σ).`
    : "Transaction conforms to expected statistical distribution.";

  return {
    isAnomaly,
    zScore: Math.round(zScore * 100) / 100,
    expectedMin,
    expectedMax,
    anomalyScore,
    deviationAmount,
    explanation,
  };
}

/**
 * Calculates budget variance status based on utilization percentage:
 * < 80%: Normal
 * 80% to 99%: Warning
 * >= 100%: Critical
 */
export function calculateBudgetVarianceStatus(
  planned: number,
  actual: number,
): { status: "normal" | "warning" | "critical"; utilization: number; variance: number } {
  const variance = actual - planned;
  const utilization = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0;

  let status: "normal" | "warning" | "critical" = "normal";
  if (utilization >= 100) {
    status = "critical";
  } else if (utilization >= 80) {
    status = "warning";
  }

  return {
    status,
    utilization: Math.round(utilization * 10) / 10,
    variance: Math.round(variance),
  };
}

/**
 * Deterministic Weighted Moving Average (WMA) forecasting with linear trend damping.
 */
export function calculateWMAForecast(
  historicalIncome: number[],
  historicalExpenses: number[],
  horizonMonths: number,
  startDate: Date = new Date(),
): MonthlyForecastItem[] {
  const weights = [1, 2, 3, 4, 5, 6];
  const weightSum = 21; // 1+2+3+4+5+6

  // Pad histories to at least 6 points if fewer exist
  const incHistory = [...historicalIncome];
  while (incHistory.length < 6) incHistory.unshift(incHistory[0] || 0);
  const expHistory = [...historicalExpenses];
  while (expHistory.length < 6) expHistory.unshift(expHistory[0] || 0);

  const recentInc = incHistory.slice(-6);
  const recentExp = expHistory.slice(-6);

  // Base WMA
  const baseIncome = recentInc.reduce((sum, val, idx) => sum + val * weights[idx], 0) / weightSum;
  const baseExpense = recentExp.reduce((sum, val, idx) => sum + val * weights[idx], 0) / weightSum;

  // Trend slope over the last 3 data points
  const incTrend = (recentInc[5] - recentInc[3]) / 2;
  const expTrend = (recentExp[5] - recentExp[3]) / 2;

  const forecasts: MonthlyForecastItem[] = [];

  for (let t = 1; t <= horizonMonths; t++) {
    const nextDate = new Date(startDate.getFullYear(), startDate.getMonth() + t, 1);
    const monthStr = nextDate.toISOString().substring(0, 7);

    // Apply dampened trend: damping factor 0.5 prevents runaway values
    const predIncome = Math.max(0, Math.round(baseIncome + t * incTrend * 0.5));
    const predExpense = Math.max(0, Math.round(baseExpense + t * expTrend * 0.5));
    const netCashflow = predIncome - predExpense;

    // Confidence interval (+/- 15%)
    const confidenceLow = Math.round(predExpense * 0.85);
    const confidenceHigh = Math.round(predExpense * 1.15);

    forecasts.push({
      month: monthStr,
      predictedIncome: predIncome,
      predictedExpense: predExpense,
      netCashflow,
      confidenceLow,
      confidenceHigh,
    });
  }

  return forecasts;
}

// ─── GET AI FINANCE SETTINGS ──────────────────────────────────────────────────

export const getAIFinanceSettingsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    const canAccess =
      isAdminRole(roles) || hasAnyRole(roles, ["treasurer", "committee_member"]);

    if (!canAccess) {
      throw new Error("Forbidden — Finance Admin access required");
    }

    const scoping = await getTenantScoping(request, data?.tenantId);
    const activeTenantId = scoping.tenantId;

    if (!activeTenantId || activeTenantId === "all") {
      return { isAllSocieties: true, settings: DEFAULT_AI_FINANCE_SETTINGS };
    }

    const db = getDb();
    const [rows] = (await db.query(
      `SELECT detect_anomalies, sensitivity, forecast_horizon_months, notify_treasurer, updated_at
       FROM ai_finance_settings
       WHERE tenant_id = ? LIMIT 1`,
      [activeTenantId],
    )) as any[];

    if (rows.length === 0) {
      return {
        isAllSocieties: false,
        tenantId: activeTenantId,
        settings: DEFAULT_AI_FINANCE_SETTINGS,
      };
    }

    const r = rows[0];
    return {
      isAllSocieties: false,
      tenantId: activeTenantId,
      settings: {
        detectAnomalies: Boolean(r.detect_anomalies),
        sensitivity: (r.sensitivity || "medium") as SensitivityLevel,
        forecastHorizonMonths: Number(r.forecast_horizon_months || 6),
        notifyTreasurer: Boolean(r.notify_treasurer),
        updatedAt: r.updated_at,
      },
    };
  });

// ─── UPDATE AI FINANCE SETTINGS ───────────────────────────────────────────────

export const updateAIFinanceSettingsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().min(1, "Tenant ID is required"),
      detectAnomalies: z.boolean(),
      sensitivity: z.enum(["low", "medium", "high"]),
      forecastHorizonMonths: z.number().min(3).max(12),
      notifyTreasurer: z.boolean(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    const isSuperAdmin = roles.includes("super_admin");
    const isSocietyAdmin = roles.includes("society_admin");
    const isTreasurer = roles.includes("treasurer");

    if (!isSuperAdmin && !isSocietyAdmin && !isTreasurer) {
      throw new Error("Forbidden — Finance Admin access required to update settings");
    }

    if (data.tenantId === "all" || !data.tenantId.trim()) {
      throw new Error("Cannot save settings in 'All Societies' mode. Please select a specific society.");
    }

    const db = getDb();

    // Verify Society Admin assignment
    if (!isSuperAdmin) {
      const [assigned] = (await db.query(
        "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ? AND is_active = TRUE LIMIT 1",
        [userId, data.tenantId],
      )) as any[];
      if (assigned.length === 0) {
        throw new Error("Forbidden — You do not have access to manage this society.");
      }
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO ai_finance_settings (id, tenant_id, detect_anomalies, sensitivity, forecast_horizon_months, notify_treasurer)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         detect_anomalies = VALUES(detect_anomalies),
         sensitivity = VALUES(sensitivity),
         forecast_horizon_months = VALUES(forecast_horizon_months),
         notify_treasurer = VALUES(notify_treasurer)`,
      [
        id,
        data.tenantId,
        data.detectAnomalies,
        data.sensitivity,
        data.forecastHorizonMonths,
        data.notifyTreasurer,
      ],
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, 'update_ai_finance_settings', 'ai_finance', ?)`,
      [crypto.randomUUID(), data.tenantId, userId, data.tenantId],
    );

    return { success: true };
  });

// ─── GET AI FINANCE INSIGHTS (DASHBOARD) ──────────────────────────────────────

export const getAIFinanceInsightsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    const canAccess =
      isAdminRole(roles) || hasAnyRole(roles, ["treasurer", "committee_member"]);

    if (!canAccess) {
      throw new Error("Forbidden — Finance Admin access required to view financial intelligence");
    }

    const scoping = await getTenantScoping(request, data?.tenantId);
    const activeTenantId = scoping.tenantId;

    if (!activeTenantId || activeTenantId === "all") {
      return {
        isAllSocieties: true,
        tenantId: "all",
        stats: null,
      };
    }

    const db = getDb();
    const currentYear = new Date().getFullYear();

    // 1. Fetch persistent anomalies
    const [anomalies] = (await db.query(
      `SELECT id, source_type, source_id, category, vendor_name, amount,
              expected_range_min, expected_range_max, anomaly_score, deviation_amount,
              explanation, status, created_at
       FROM financial_ai_anomalies
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [activeTenantId],
    )) as any[];

    // 2. Fetch budgets & line items for variance calculation
    const [budgetItems] = (await db.query(
      `SELECT bli.id, bli.category, bli.planned_amount, bli.actual_amount
       FROM budget_line_items bli
       INNER JOIN budgets b ON b.id = bli.budget_id
       WHERE bli.tenant_id = ? AND b.year = ?
       ORDER BY bli.category`,
      [activeTenantId, currentYear],
    )) as any[];

    const budgetVariances: BudgetVarianceItem[] = budgetItems.map((bi: any) => {
      const planned = Number(bi.planned_amount || 0);
      const actual = Number(bi.actual_amount || 0);
      const { status, utilization, variance } = calculateBudgetVarianceStatus(planned, actual);

      return {
        id: bi.id,
        category: bi.category,
        plannedAmount: planned,
        actualAmount: actual,
        variance,
        utilizationPercentage: utilization,
        status,
      };
    });

    // 3. Fetch past 6 months income and expenses for WMA forecast
    const [monthlyLedger] = (await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as monthKey,
              SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM ledger_entries
       WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY monthKey ASC`,
      [activeTenantId],
    )) as any[];

    const histIncome = monthlyLedger.map((r: any) => Number(r.income || 0));
    const histExpense = monthlyLedger.map((r: any) => Number(r.expense || 0));

    // Get configured forecast horizon
    const [settingsRow] = (await db.query(
      "SELECT forecast_horizon_months FROM ai_finance_settings WHERE tenant_id = ? LIMIT 1",
      [activeTenantId],
    )) as any[];
    const horizon = settingsRow.length ? Number(settingsRow[0].forecast_horizon_months) : 6;

    const forecasts = calculateWMAForecast(histIncome, histExpense, horizon);

    // Executive Metrics
    const activeAnomaliesCount = anomalies.filter((a: any) => a.status === "flagged").length;
    const overBudgetCount = budgetVariances.filter((b) => b.status === "critical").length;
    const warningBudgetCount = budgetVariances.filter((b) => b.status === "warning").length;

    // Monthly burn rate (average of last 3 months expenses)
    const recentExpenses = histExpense.slice(-3);
    const monthlyBurnRate = recentExpenses.length > 0
      ? Math.round(recentExpenses.reduce((sum, v) => sum + v, 0) / recentExpenses.length)
      : 0;

    // Financial health score (0-100)
    let healthScore = 100;
    if (activeAnomaliesCount > 0) healthScore -= Math.min(30, activeAnomaliesCount * 10);
    if (overBudgetCount > 0) healthScore -= Math.min(30, overBudgetCount * 15);
    if (warningBudgetCount > 0) healthScore -= Math.min(15, warningBudgetCount * 5);
    healthScore = Math.max(20, healthScore);

    return {
      isAllSocieties: false,
      tenantId: activeTenantId,
      stats: {
        financialHealthScore: healthScore,
        activeAnomaliesCount,
        overBudgetCount,
        warningBudgetCount,
        monthlyBurnRate,
        nextMonthProjectedCashflow: forecasts[0]?.netCashflow ?? 0,
        anomalies,
        budgetVariances,
        forecasts,
      },
    };
  });

// ─── RUN EXPENSE ANOMALY SCAN ─────────────────────────────────────────────────

export const runExpenseAnomalyScanFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().min(1, "Tenant ID is required"),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    if (!isAdminRole(roles) && !roles.includes("treasurer")) {
      throw new Error("Forbidden — Finance Admin access required to execute anomaly scans");
    }

    if (data.tenantId === "all" || !data.tenantId.trim()) {
      throw new Error("Cannot run anomaly scan on 'All Societies' mode.");
    }

    const db = getDb();

    // 1. Fetch tenant settings
    const [settingsRows] = (await db.query(
      "SELECT detect_anomalies, sensitivity, notify_treasurer FROM ai_finance_settings WHERE tenant_id = ? LIMIT 1",
      [data.tenantId],
    )) as any[];

    const sensitivity: SensitivityLevel = settingsRows.length
      ? (settingsRows[0].sensitivity as SensitivityLevel)
      : "medium";
    const notifyTreasurer = settingsRows.length ? Boolean(settingsRows[0].notify_treasurer) : true;

    // 2. Fetch all vendor invoices
    const [invoices] = (await db.query(
      `SELECT vi.id, vi.amount, vi.invoice_date, vi.created_at, v.name as vendor_name, v.category
       FROM vendor_invoices vi
       LEFT JOIN vendors v ON v.id = vi.vendor_id
       WHERE vi.tenant_id = ?
       ORDER BY vi.created_at DESC`,
      [data.tenantId],
    )) as any[];

    if (invoices.length === 0) {
      return { flaggedCount: 0, message: "No invoices available to analyze for this society." };
    }

    // Group invoice amounts by vendor for baseline
    const vendorHistoryMap = new Map<string, number[]>();
    invoices.forEach((inv: any) => {
      const vName = inv.vendor_name || "General Vendor";
      if (!vendorHistoryMap.has(vName)) {
        vendorHistoryMap.set(vName, []);
      }
      vendorHistoryMap.get(vName)!.push(Number(inv.amount || 0));
    });

    let newlyFlaggedCount = 0;

    for (const inv of invoices) {
      const vName = inv.vendor_name || "General Vendor";
      const allHistory = vendorHistoryMap.get(vName) || [];
      // Exclude current transaction from baseline
      const history = allHistory.filter((amt) => amt !== Number(inv.amount || 0));

      const res = calculateZScoreAnomaly(Number(inv.amount || 0), history, sensitivity);

      if (res.isAnomaly) {
        const anomalyId = crypto.randomUUID();

        // Idempotent upsert
        await db.query(
          `INSERT INTO financial_ai_anomalies (
             id, tenant_id, source_type, source_id, category, vendor_name,
             amount, expected_range_min, expected_range_max, anomaly_score,
             deviation_amount, explanation, status
           ) VALUES (?, ?, 'vendor_invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'flagged')
           ON DUPLICATE KEY UPDATE
             amount = VALUES(amount),
             expected_range_min = VALUES(expected_range_min),
             expected_range_max = VALUES(expected_range_max),
             anomaly_score = VALUES(anomaly_score),
             deviation_amount = VALUES(deviation_amount),
             explanation = VALUES(explanation)`,
          [
            anomalyId,
            data.tenantId,
            inv.id,
            inv.category || "General",
            vName,
            Number(inv.amount || 0),
            res.expectedMin,
            res.expectedMax,
            res.anomalyScore,
            res.deviationAmount,
            res.explanation,
          ],
        );

        newlyFlaggedCount++;

        // Notify treasurer if severity is high (score >= 75)
        if (notifyTreasurer && res.anomalyScore >= 75) {
          try {
            const [treasurers] = (await db.query(
              `SELECT ur.user_id
               FROM user_roles ur
               INNER JOIN profiles p ON p.id = ur.user_id
               WHERE ur.role IN ('treasurer', 'society_admin') AND p.tenant_id = ?
               LIMIT 3`,
              [data.tenantId],
            )) as any[];

            for (const t of treasurers) {
              await createNotification({
                userId: t.user_id,
                tenantId: data.tenantId,
                type: NOTIFICATION_TYPES.FINANCIAL_ANOMALY_DETECTED,
                title: "Expense Anomaly Detected",
                message: `Invoice from "${vName}" of ₨${Number(inv.amount).toLocaleString()} deviates significantly from normal bounds.`,
                data: { invoiceId: inv.id, amount: inv.amount, anomalyScore: res.anomalyScore },
              });
            }
          } catch (notifErr) {
            console.warn("[AI Finance] Notification dispatch ignored:", notifErr);
          }
        }
      }
    }

    return {
      flaggedCount: newlyFlaggedCount,
      message: `Analysis complete: ${newlyFlaggedCount} transaction(s) flagged under ${sensitivity} sensitivity.`,
    };
  });

// ─── REVIEW ANOMALY STATUS ────────────────────────────────────────────────────

export const reviewAnomalyStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      anomalyId: z.string().min(1),
      action: z.enum(["reviewed", "dismissed"]),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    if (!isAdminRole(roles) && !roles.includes("treasurer")) {
      throw new Error("Forbidden — Finance Admin access required");
    }

    const db = getDb();
    const [existing] = (await db.query(
      "SELECT id, tenant_id FROM financial_ai_anomalies WHERE id = ?",
      [data.anomalyId],
    )) as any[];

    if (existing.length === 0) {
      throw new Error("Anomaly record not found");
    }

    await db.query(
      `UPDATE financial_ai_anomalies
       SET status = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [data.action, userId, data.anomalyId],
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, ?, 'financial_anomaly', ?)`,
      [
        crypto.randomUUID(),
        existing[0].tenant_id,
        userId,
        `anomaly_${data.action}`,
        data.anomalyId,
      ],
    );

    return { success: true };
  });

// ─── GENERATE CASHFLOW FORECAST SNAPSHOT ──────────────────────────────────────

export const generateCashflowForecastFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().min(1),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    if (!isAdminRole(roles) && !roles.includes("treasurer")) {
      throw new Error("Forbidden — Finance Admin access required");
    }

    const db = getDb();

    // Fetch past 6 months income and expenses
    const [monthlyLedger] = (await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as monthKey,
              SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM ledger_entries
       WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY monthKey ASC`,
      [data.tenantId],
    )) as any[];

    const histIncome = monthlyLedger.map((r: any) => Number(r.income || 0));
    const histExpense = monthlyLedger.map((r: any) => Number(r.expense || 0));

    const [settingsRow] = (await db.query(
      "SELECT forecast_horizon_months FROM ai_finance_settings WHERE tenant_id = ? LIMIT 1",
      [data.tenantId],
    )) as any[];
    const horizon = settingsRow.length ? Number(settingsRow[0].forecast_horizon_months) : 6;

    const forecasts = calculateWMAForecast(histIncome, histExpense, horizon);

    for (const fc of forecasts) {
      await db.query(
        `INSERT INTO financial_ai_forecast_snapshots (
           id, tenant_id, forecast_month, predicted_income, predicted_expense,
           net_cashflow, confidence_low, confidence_high
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          data.tenantId,
          fc.month,
          fc.predictedIncome,
          fc.predictedExpense,
          fc.netCashflow,
          fc.confidenceLow,
          fc.confidenceHigh,
        ],
      );
    }

    return { success: true, count: forecasts.length };
  });
