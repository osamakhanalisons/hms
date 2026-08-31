import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserTenantId,
  getUserRoles,
  isAdminRole,
  hasAnyRole,
} from "./auth-helper";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type HighRiskAsset = {
  assetId: string;
  assetName: string;
  assetCategory: string;
  location: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  maintenanceCount: number;
  totalCost: number;
  avgCost: number;
  lastMaintenanceDate: string | null;
  reasons: string[];
};

export type SLARiskWorkOrder = {
  id: string;
  title: string;
  assetName: string | null;
  priority: string;
  status: string;
  slaDueAt: string;
  daysOverdue: number;
  estimatedCost: number;
  assignedTo: string | null;
};

export type CostAnalysis = {
  totalMaintenanceCost: number;
  avgCostPerWorkOrder: number;
  highestCostAsset: {
    name: string;
    cost: number;
  } | null;
  costByCategory: Array<{
    category: string;
    totalCost: number;
    workOrderCount: number;
  }>;
  costByVendor: Array<{
    vendorName: string;
    totalCost: number;
    workOrderCount: number;
  }>;
  monthlyCostTrend: Array<{
    month: string;
    cost: number;
  }>;
};

export type MaintenancePattern = {
  assetId: string;
  assetName: string;
  assetCategory: string;
  failurePattern: string;
  occurrenceCount: number;
  avgDaysBetweenFailures: number | null;
  recommendedAction: string;
};

export type PreventiveRecommendation = {
  assetId: string;
  assetName: string;
  assetCategory: string;
  location: string | null;
  recommendationType: "inspection" | "replacement" | "upgrade" | "preventive";
  priority: RiskLevel;
  reasoning: string;
  estimatedCost: number | null;
};

export type AIMaintenanceInsights = {
  overallHealthScore: number;
  overallHealthStatus: "excellent" | "good" | "fair" | "poor" | "critical";
  summary: string;
  highRiskAssets: HighRiskAsset[];
  slaRiskWorkOrders: SLARiskWorkOrder[];
  costAnalysis: CostAnalysis;
  recurringPatterns: MaintenancePattern[];
  preventiveRecommendations: PreventiveRecommendation[];
  statistics: {
    totalAssets: number;
    activeWorkOrders: number;
    overdueWorkOrders: number;
    completedWorkOrders: number;
    avgCompletionDays: number;
    slaComplianceRate: number;
    totalMaintenanceCost: number;
  };
  generatedAt: string;
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function calculateHealthStatus(score: number): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  if (score >= 30) return "poor";
  return "critical";
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ─── GET AI MAINTENANCE INSIGHTS ─────────────────────────────────────────────

export const getAIMaintenanceInsightsFn = createServerFn({ method: "GET" }).handler(
  async ({ request }: any) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant session found");

    const roles = await getUserRoles(userId);
    const canAccess =
      isAdminRole(roles) ||
      hasAnyRole(roles, ["maintenance_head", "treasurer", "committee_member"]);

    if (!canAccess) {
      throw new Error("Forbidden — Admin or Maintenance Head access required");
    }

    const db = getDb();
    const now = new Date();

    // ═══ FETCH BASE DATA ═══════════════════════════════════════════════════

    // Get all assets
    const [assets] = (await db.query(
      `SELECT id, name, category, location, status, purchase_date, warranty_expires_at
       FROM assets
       WHERE tenant_id = ? AND status != 'scrapped'
       ORDER BY name`,
      [tenantId],
    )) as any[];

    // Get all work orders with related data
    const [workOrders] = (await db.query(
      `SELECT wo.*, a.name as asset_name, a.category as asset_category, a.location as asset_location,
              v.name as vendor_name,
              COALESCE(wo.actual_cost, wo.cost) as effective_cost
       FROM maintenance_work_orders wo
       LEFT JOIN assets a ON a.id = wo.asset_id
       LEFT JOIN vendors v ON v.id = wo.assigned_vendor_id
       WHERE wo.tenant_id = ?
       ORDER BY wo.created_at DESC`,
      [tenantId],
    )) as any[];

    // ═══ HIGH RISK ASSETS ANALYSIS ═════════════════════════════════════════

    const assetMaintenanceMap = new Map<string, any[]>();
    workOrders.forEach((wo: any) => {
      if (wo.asset_id) {
        if (!assetMaintenanceMap.has(wo.asset_id)) {
          assetMaintenanceMap.set(wo.asset_id, []);
        }
        assetMaintenanceMap.get(wo.asset_id)!.push(wo);
      }
    });

    const highRiskAssets: HighRiskAsset[] = [];

    for (const asset of assets) {
      const maintenanceHistory = assetMaintenanceMap.get(asset.id) || [];
      if (maintenanceHistory.length === 0) continue;

      const completedMaintenance = maintenanceHistory.filter((wo: any) =>
        ["completed", "verified"].includes(wo.status),
      );

      const totalCost = completedMaintenance.reduce(
        (sum: number, wo: any) => sum + Number(wo.effective_cost || 0),
        0,
      );
      const maintenanceCount = maintenanceHistory.length;
      const avgCost = maintenanceCount > 0 ? totalCost / maintenanceCount : 0;

      // Calculate risk score (0-100)
      let riskScore = 0;
      const reasons: string[] = [];

      // High frequency maintenance (up to 40 points)
      if (maintenanceCount >= 10) {
        riskScore += 40;
        reasons.push(`High maintenance frequency (${maintenanceCount} work orders)`);
      } else if (maintenanceCount >= 5) {
        riskScore += 25;
        reasons.push(`Moderate maintenance frequency (${maintenanceCount} work orders)`);
      } else if (maintenanceCount >= 3) {
        riskScore += 15;
        reasons.push(`Recurring maintenance (${maintenanceCount} work orders)`);
      }

      // High cost (up to 30 points)
      if (totalCost >= 100000) {
        riskScore += 30;
        reasons.push(`Very high maintenance cost (₨${totalCost.toLocaleString()})`);
      } else if (totalCost >= 50000) {
        riskScore += 20;
        reasons.push(`High maintenance cost (₨${totalCost.toLocaleString()})`);
      } else if (totalCost >= 20000) {
        riskScore += 10;
        reasons.push(`Elevated maintenance cost (₨${totalCost.toLocaleString()})`);
      }

      // Critical priority work orders (up to 20 points)
      const criticalCount = maintenanceHistory.filter(
        (wo: any) => wo.priority === "critical",
      ).length;
      if (criticalCount > 0) {
        riskScore += Math.min(20, criticalCount * 10);
        reasons.push(`${criticalCount} critical priority work order(s)`);
      }

      // Unresolved issues (up to 10 points)
      const openCount = maintenanceHistory.filter((wo: any) =>
        ["open", "assigned", "in_progress"].includes(wo.status),
      ).length;
      if (openCount > 0) {
        riskScore += Math.min(10, openCount * 5);
        reasons.push(`${openCount} unresolved work order(s)`);
      }

      // Only include assets with meaningful risk
      if (riskScore >= 30 || maintenanceCount >= 3) {
        const sortedDates = completedMaintenance
          .map((wo: any) => wo.completed_at || wo.created_at)
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());

        highRiskAssets.push({
          assetId: asset.id,
          assetName: asset.name,
          assetCategory: asset.category || "general",
          location: asset.location || null,
          riskLevel: calculateRiskLevel(riskScore),
          riskScore: Math.min(100, riskScore),
          maintenanceCount,
          totalCost,
          avgCost,
          lastMaintenanceDate: sortedDates.length > 0 ? sortedDates[0] : null,
          reasons,
        });
      }
    }

    // Sort by risk score descending
    highRiskAssets.sort((a, b) => b.riskScore - a.riskScore);

    // ═══ SLA RISK ANALYSIS ═════════════════════════════════════════════════

    const slaRiskWorkOrders: SLARiskWorkOrder[] = [];
    const todayStr = now.toISOString().split("T")[0];

    for (const wo of workOrders) {
      if (
        wo.sla_due_at &&
        !["completed", "verified", "cancelled"].includes(wo.status)
      ) {
        const dueDate = new Date(wo.sla_due_at);
        const daysOverdue = daysBetween(dueDate, now);

        // Only include overdue or soon-due work orders
        if (wo.sla_due_at < todayStr || daysOverdue <= 3) {
          slaRiskWorkOrders.push({
            id: wo.id,
            title: wo.title,
            assetName: wo.asset_name || null,
            priority: wo.priority,
            status: wo.status,
            slaDueAt: wo.sla_due_at,
            daysOverdue: wo.sla_due_at < todayStr ? daysOverdue : -daysOverdue,
            estimatedCost: Number(wo.estimated_cost || 0),
            assignedTo: wo.vendor_name || wo.assigned_technician_id || null,
          });
        }
      }
    }

    slaRiskWorkOrders.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // ═══ COST ANALYSIS ═════════════════════════════════════════════════════

    const completedWOs = workOrders.filter((wo: any) =>
      ["completed", "verified"].includes(wo.status),
    );
    const totalMaintenanceCost = completedWOs.reduce(
      (sum: number, wo: any) => sum + Number(wo.effective_cost || 0),
      0,
    );
    const avgCostPerWorkOrder =
      completedWOs.length > 0 ? totalMaintenanceCost / completedWOs.length : 0;

    // Cost by category
    const costByCategoryMap = new Map<string, { cost: number; count: number }>();
    completedWOs.forEach((wo: any) => {
      const cat = wo.asset_category || "uncategorized";
      const current = costByCategoryMap.get(cat) || { cost: 0, count: 0 };
      current.cost += Number(wo.effective_cost || 0);
      current.count += 1;
      costByCategoryMap.set(cat, current);
    });

    const costByCategory = Array.from(costByCategoryMap.entries())
      .map(([category, data]) => ({
        category,
        totalCost: data.cost,
        workOrderCount: data.count,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Cost by vendor
    const costByVendorMap = new Map<string, { cost: number; count: number }>();
    completedWOs.forEach((wo: any) => {
      if (wo.vendor_name) {
        const current = costByVendorMap.get(wo.vendor_name) || { cost: 0, count: 0 };
        current.cost += Number(wo.effective_cost || 0);
        current.count += 1;
        costByVendorMap.set(wo.vendor_name, current);
      }
    });

    const costByVendor = Array.from(costByVendorMap.entries())
      .map(([vendorName, data]) => ({
        vendorName,
        totalCost: data.cost,
        workOrderCount: data.count,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Highest cost asset
    const assetCostMap = new Map<string, number>();
    completedWOs.forEach((wo: any) => {
      if (wo.asset_name) {
        const current = assetCostMap.get(wo.asset_name) || 0;
        assetCostMap.set(wo.asset_name, current + Number(wo.effective_cost || 0));
      }
    });

    let highestCostAsset: { name: string; cost: number } | null = null;
    assetCostMap.forEach((cost, name) => {
      if (!highestCostAsset || cost > highestCostAsset.cost) {
        highestCostAsset = { name, cost };
      }
    });

    // Monthly cost trend (last 6 months)
    const monthlyCostTrend: Array<{ month: string; cost: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().substring(0, 7);
      const monthCost = completedWOs
        .filter((wo: any) => {
          const completedDate = wo.completed_at || wo.created_at;
          if (!completedDate) return false;
          const dateStr = completedDate instanceof Date ? completedDate.toISOString() : String(completedDate);
          return dateStr.substring(0, 7) === monthStr;
        })
        .reduce((sum: number, wo: any) => sum + Number(wo.effective_cost || 0), 0);

      monthlyCostTrend.push({
        month: monthStr,
        cost: monthCost,
      });
    }

    const costAnalysis: CostAnalysis = {
      totalMaintenanceCost,
      avgCostPerWorkOrder,
      highestCostAsset,
      costByCategory,
      costByVendor,
      monthlyCostTrend,
    };

    // ═══ RECURRING PATTERNS ANALYSIS ═══════════════════════════════════════

    const recurringPatterns: MaintenancePattern[] = [];
    const assetPatternMap = new Map<string, Map<string, any[]>>();

    workOrders.forEach((wo: any) => {
      if (!wo.asset_id) return;

      if (!assetPatternMap.has(wo.asset_id)) {
        assetPatternMap.set(wo.asset_id, new Map());
      }

      const patterns = assetPatternMap.get(wo.asset_id)!;

      // Extract pattern from title or description
      const text = `${wo.title} ${wo.description}`.toLowerCase();
      let pattern = "general maintenance";

      if (text.includes("leak")) pattern = "water leak";
      else if (text.includes("noise") || text.includes("sound")) pattern = "noise issue";
      else if (text.includes("fail") || text.includes("not working"))
        pattern = "component failure";
      else if (text.includes("crack") || text.includes("damage")) pattern = "structural damage";
      else if (text.includes("overheat") || text.includes("temperature"))
        pattern = "overheating";
      else if (text.includes("electric") || text.includes("power")) pattern = "electrical issue";
      else if (text.includes("rust") || text.includes("corros")) pattern = "corrosion";

      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(wo);
    });

    assetPatternMap.forEach((patterns, assetId) => {
      const asset = assets.find((a: any) => a.id === assetId);
      if (!asset) return;

      patterns.forEach((occurrences, pattern) => {
        if (occurrences.length >= 2) {
          // Pattern identified
          const sortedOccurrences = occurrences
            .map((wo: any) => new Date(wo.created_at))
            .sort((a, b) => a.getTime() - b.getTime());

          let avgDaysBetweenFailures: number | null = null;
          if (sortedOccurrences.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < sortedOccurrences.length; i++) {
              intervals.push(daysBetween(sortedOccurrences[i - 1], sortedOccurrences[i]));
            }
            avgDaysBetweenFailures =
              intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
          }

          let recommendedAction = "Monitor and schedule preventive maintenance";
          if (occurrences.length >= 5) {
            recommendedAction = "Consider asset replacement or major overhaul";
          } else if (occurrences.length >= 3) {
            recommendedAction = "Schedule detailed inspection and root cause analysis";
          }

          recurringPatterns.push({
            assetId,
            assetName: asset.name,
            assetCategory: asset.category || "general",
            failurePattern: pattern,
            occurrenceCount: occurrences.length,
            avgDaysBetweenFailures,
            recommendedAction,
          });
        }
      });
    });

    recurringPatterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

    // ═══ PREVENTIVE RECOMMENDATIONS ═══════════════════════════════════════

    const preventiveRecommendations: PreventiveRecommendation[] = [];

    // Recommendation 1: Assets with high risk scores
    highRiskAssets.slice(0, 5).forEach((riskAsset) => {
      if (riskAsset.riskScore >= 60) {
        preventiveRecommendations.push({
          assetId: riskAsset.assetId,
          assetName: riskAsset.assetName,
          assetCategory: riskAsset.assetCategory,
          location: riskAsset.location,
          recommendationType: riskAsset.riskScore >= 80 ? "replacement" : "inspection",
          priority: riskAsset.riskLevel,
          reasoning: `High risk asset with ${riskAsset.maintenanceCount} maintenance events and total cost of ₨${riskAsset.totalCost.toLocaleString()}. ${riskAsset.reasons[0] || ""}`,
          estimatedCost: riskAsset.avgCost * 0.5, // Preventive cost estimate
        });
      }
    });

    // Recommendation 2: Assets with warranty expiry
    assets.forEach((asset: any) => {
      if (asset.warranty_expires_at) {
        const expiryDate = new Date(asset.warranty_expires_at);
        const daysUntilExpiry = daysBetween(now, expiryDate);

        if (daysUntilExpiry <= 90 && daysUntilExpiry >= 0) {
          preventiveRecommendations.push({
            assetId: asset.id,
            assetName: asset.name,
            assetCategory: asset.category || "general",
            location: asset.location || null,
            recommendationType: "inspection",
            priority: daysUntilExpiry <= 30 ? "high" : "medium",
            reasoning: `Warranty expires in ${daysUntilExpiry} days. Schedule inspection before warranty coverage ends.`,
            estimatedCost: null,
          });
        }
      }
    });

    // Recommendation 3: Assets with recurring patterns
    recurringPatterns.slice(0, 3).forEach((pattern) => {
      if (pattern.occurrenceCount >= 3) {
        preventiveRecommendations.push({
          assetId: pattern.assetId,
          assetName: pattern.assetName,
          assetCategory: pattern.assetCategory,
          location: null,
          recommendationType: pattern.occurrenceCount >= 5 ? "upgrade" : "preventive",
          priority: pattern.occurrenceCount >= 5 ? "high" : "medium",
          reasoning: `Recurring ${pattern.failurePattern} detected (${pattern.occurrenceCount} occurrences). ${pattern.recommendedAction}`,
          estimatedCost: null,
        });
      }
    });

    // ═══ STATISTICS ════════════════════════════════════════════════════════

    const activeWorkOrders = workOrders.filter((wo: any) =>
      ["open", "assigned", "in_progress"].includes(wo.status),
    ).length;

    const overdueWorkOrders = workOrders.filter(
      (wo: any) =>
        wo.sla_due_at &&
        wo.sla_due_at < todayStr &&
        !["completed", "verified", "cancelled"].includes(wo.status),
    ).length;

    const completedWorkOrders = workOrders.filter((wo: any) =>
      ["completed", "verified"].includes(wo.status),
    ).length;

    // Calculate average completion days
    let totalCompletionDays = 0;
    let completionDaysCount = 0;
    completedWOs.forEach((wo: any) => {
      if (wo.completed_at && wo.created_at) {
        const days = daysBetween(new Date(wo.created_at), new Date(wo.completed_at));
        totalCompletionDays += days;
        completionDaysCount++;
      }
    });
    const avgCompletionDays =
      completionDaysCount > 0 ? totalCompletionDays / completionDaysCount : 0;

    // SLA compliance rate
    const workOrdersWithSLA = workOrders.filter(
      (wo: any) => wo.sla_due_at && ["completed", "verified"].includes(wo.status),
    );
    const slaCompliantWOs = workOrdersWithSLA.filter((wo: any) => {
      const completedDate = wo.completed_at
        ? new Date(wo.completed_at).toISOString().split("T")[0]
        : null;
      return completedDate && completedDate <= wo.sla_due_at;
    });
    const slaComplianceRate =
      workOrdersWithSLA.length > 0
        ? (slaCompliantWOs.length / workOrdersWithSLA.length) * 100
        : 100;

    const statistics = {
      totalAssets: assets.length,
      activeWorkOrders,
      overdueWorkOrders,
      completedWorkOrders,
      avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
      slaComplianceRate: Math.round(slaComplianceRate * 10) / 10,
      totalMaintenanceCost,
    };

    // ═══ OVERALL HEALTH SCORE ══════════════════════════════════════════════

    let healthScore = 100;

    // Deduct for high-risk assets
    healthScore -= Math.min(30, highRiskAssets.length * 3);

    // Deduct for overdue work orders
    healthScore -= Math.min(20, overdueWorkOrders * 2);

    // Deduct for poor SLA compliance
    if (slaComplianceRate < 80) {
      healthScore -= (80 - slaComplianceRate) * 0.5;
    }

    // Deduct for high active work order count
    const activeRatio = assets.length > 0 ? activeWorkOrders / assets.length : 0;
    if (activeRatio > 0.3) {
      healthScore -= 15;
    } else if (activeRatio > 0.2) {
      healthScore -= 10;
    }

    // Bonus for good completion time
    if (avgCompletionDays > 0 && avgCompletionDays <= 3) {
      healthScore += 5;
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // ═══ AI SUMMARY ════════════════════════════════════════════════════════

    const summaryParts: string[] = [];

    summaryParts.push(
      `Overall maintenance health is ${calculateHealthStatus(healthScore)} with a score of ${Math.round(healthScore)}/100.`,
    );

    if (highRiskAssets.length > 0) {
      summaryParts.push(
        `${highRiskAssets.length} asset(s) identified as high-risk requiring attention.`,
      );
    }

    if (overdueWorkOrders > 0) {
      summaryParts.push(`${overdueWorkOrders} work order(s) are overdue and need immediate action.`);
    } else {
      summaryParts.push("All work orders are within SLA compliance.");
    }

    if (recurringPatterns.length > 0) {
      summaryParts.push(
        `${recurringPatterns.length} recurring failure pattern(s) detected across assets.`,
      );
    }

    if (totalMaintenanceCost > 0) {
      summaryParts.push(
        `Total maintenance cost to date: ₨${totalMaintenanceCost.toLocaleString()}.`,
      );
    }

    if (preventiveRecommendations.length > 0) {
      summaryParts.push(
        `${preventiveRecommendations.length} preventive maintenance recommendation(s) generated.`,
      );
    }

    const summary = summaryParts.join(" ");

    // ═══ RETURN INSIGHTS ═══════════════════════════════════════════════════

    const insights: AIMaintenanceInsights = {
      overallHealthScore: Math.round(healthScore),
      overallHealthStatus: calculateHealthStatus(healthScore),
      summary,
      highRiskAssets: highRiskAssets.slice(0, 10),
      slaRiskWorkOrders: slaRiskWorkOrders.slice(0, 10),
      costAnalysis,
      recurringPatterns: recurringPatterns.slice(0, 10),
      preventiveRecommendations: preventiveRecommendations.slice(0, 10),
      statistics,
      generatedAt: now.toISOString(),
    };

    return insights;
  },
);

// ─── STORE AI ANALYSIS (OPTIONAL) ────────────────────────────────────────────

export const storeAIAnalysisFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      analysisType: z.enum([
        "full_insights",
        "risk_assessment",
        "cost_analysis",
        "pattern_detection",
      ]),
      resultData: z.any(),
    }),
  )
  .handler(async ({ data, request }: any) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant session found");

    const roles = await getUserRoles(userId);
    if (!isAdminRole(roles)) {
      throw new Error("Forbidden — Admin access required");
    }

    const db = getDb();
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO ai_maintenance_analyses (id, tenant_id, analysis_type, result_data, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tenantId, data.analysisType, JSON.stringify(data.resultData), userId],
    );

    return { id, success: true };
  });

// ─── GET AI ANALYSIS HISTORY ─────────────────────────────────────────────────

export const getAIAnalysisHistoryFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        limit: z.number().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }: any) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const roles = await getUserRoles(userId);
    const canAccess =
      isAdminRole(roles) ||
      hasAnyRole(roles, ["maintenance_head", "treasurer", "committee_member"]);

    if (!canAccess) {
      throw new Error("Forbidden — Admin or Maintenance Head access required");
    }

    const db = getDb();
    const limit = data?.limit || 20;

    const [rows] = (await db.query(
      `SELECT id, analysis_type, created_at
       FROM ai_maintenance_analyses
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, limit],
    )) as any[];

    return rows;
  });
