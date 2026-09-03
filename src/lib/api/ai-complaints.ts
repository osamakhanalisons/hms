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

export interface AIAnalysisResult {
  suggestedCategory: string;
  suggestedPriority: "low" | "medium" | "high" | "critical";
  confidence: number; // 0 to 100
  matchedKeywords: string[];
  explanation: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  similarityScore: number; // 0 to 100
  matchedTitle?: string;
}

export interface AIComplaintSettings {
  autoCategorize: boolean;
  autoPriority: boolean;
  dupThreshold: number; // e.g. 85
  escalationDays: number; // e.g. 3
  updatedAt?: string;
}

export const DEFAULT_AI_COMPLAINT_SETTINGS: AIComplaintSettings = {
  autoCategorize: true,
  autoPriority: true,
  dupThreshold: 85,
  escalationDays: 3,
};

// ─── DETERMINISTIC NLP / HEURISTIC CLASSIFIER ─────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  lift: [
    "lift", "elevator", "cabin", "stuck", "hoist", "ground floor", "floors",
    "grinding", "screeching", "lift alarm", "elevator door", "shaft"
  ],
  electrical: [
    "light", "power", "switch", "wire", "voltage", "spark", "breaker", "socket",
    "short circuit", "fan", "fuse", "blackout", "wiring", "bulb", "electric", "mcb"
  ],
  plumbing: [
    "leak", "pipe", "drain", "sewer", "faucet", "tap", "flush", "toilet",
    "clog", "sink", "commode", "pipeline", "plumber", "sanitary", "geyser"
  ],
  water: [
    "tank", "supply", "pump", "motor", "shortage", "dirty water", "low pressure",
    "no water", "drinking water", "bore", "filtration", "overhead tank"
  ],
  security: [
    "guard", "gate", "cctv", "camera", "theft", "unauthorized", "trespass",
    "stranger", "break in", "barrier", "intercom", "stolen", "vandalism"
  ],
  cleaning: [
    "garbage", "trash", "dirt", "smell", "odor", "sweep", "dustbin", "waste",
    "corridor", "staircase", "cleanliness", "janitor", "rubbish", "litter"
  ],
  civil: [
    "crack", "roof", "seepage", "damp", "plaster", "wall", "paint", "tile",
    "structure", "balcony", "ceiling", "masonry", "pothole", "floor tile"
  ],
  hvac: [
    "ac", "air conditioner", "cooling", "heating", "ventilation", "chiller",
    "compressor", "aircon", "thermostat", "duct"
  ],
};

const URGENCY_CRITICAL_KEYWORDS = [
  "fire", "smoke", "sparking", "flooding", "gas leak", "explosion",
  "stuck in lift", "stuck inside", "electric shock", "danger", "collapse", "emergency"
];

const URGENCY_HIGH_KEYWORDS = [
  "no water", "blackout", "overflow", "lift broken", "main pipe burst",
  "loud grinding", "screeching", "seepage into electric", "theft", "broken glass", "urgent"
];

const URGENCY_LOW_KEYWORDS = [
  "paint peeling", "slow drain", "minor", "cosmetic", "bulb replacement",
  "cleaning request", "routine", "dust", "faded"
];

const STOPWORDS = new Set([
  "the", "is", "in", "at", "of", "a", "an", "and", "to", "for", "with", "on", "my",
  "unit", "flat", "apt", "apartment", "house", "please", "urgent", "issue", "problem",
  "help", "there", "it", "this", "that", "from", "be", "has", "have", "had", "are",
  "was", "were", "we", "our", "you", "they", "been", "by", "not", "so", "but"
]);

export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Calculates Jaccard similarity and token overlap between two strings (0 to 100).
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenizeText(text1));
  const tokens2 = new Set(tokenizeText(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  if (union === 0) return 0;

  const jaccard = (intersection / union) * 100;
  return Math.round(jaccard * 100) / 100;
}

/**
 * Deterministic text categorization and priority suggestion engine.
 */
export function analyzeComplaintTextInternal(
  title: string,
  description: string,
): AIAnalysisResult {
  const combinedText = `${title} ${description}`.toLowerCase();
  const tokens = tokenizeText(combinedText);

  // Category matching
  const categoryScores: Record<string, number> = {};
  const matchedKeywordSet = new Set<string>();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (combinedText.includes(kw)) {
        score += kw.includes(" ") ? 3 : 2; // Multi-word phrases give higher weight
        matchedKeywordSet.add(kw);
      }
    }
    if (score > 0) {
      categoryScores[category] = score;
    }
  }

  let suggestedCategory = "other";
  let maxScore = 0;
  for (const [cat, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score;
      suggestedCategory = cat;
    }
  }

  // Calculate confidence score (scaled based on matched evidence)
  let confidence = 50; // baseline
  if (maxScore >= 6) confidence = 95;
  else if (maxScore >= 4) confidence = 88;
  else if (maxScore >= 2) confidence = 75;
  else if (maxScore > 0) confidence = 65;

  // Priority detection
  let suggestedPriority: "low" | "medium" | "high" | "critical" = "medium";
  const matchedUrgency: string[] = [];

  for (const kw of URGENCY_CRITICAL_KEYWORDS) {
    if (combinedText.includes(kw)) {
      suggestedPriority = "critical";
      matchedUrgency.push(kw);
      matchedKeywordSet.add(kw);
      break;
    }
  }

  if (suggestedPriority !== "critical") {
    for (const kw of URGENCY_HIGH_KEYWORDS) {
      if (combinedText.includes(kw)) {
        suggestedPriority = "high";
        matchedUrgency.push(kw);
        matchedKeywordSet.add(kw);
        break;
      }
    }
  }

  if (suggestedPriority === "medium") {
    for (const kw of URGENCY_LOW_KEYWORDS) {
      if (combinedText.includes(kw)) {
        suggestedPriority = "low";
        matchedUrgency.push(kw);
        matchedKeywordSet.add(kw);
        break;
      }
    }
  }

  const matchedKeywords = Array.from(matchedKeywordSet);
  const explanation = matchedKeywords.length > 0
    ? `Identified key terms: ${matchedKeywords.slice(0, 5).join(", ")}. Suggested priority based on urgency cues.`
    : "No distinct technical terms detected; classified as general/other.";

  return {
    suggestedCategory,
    suggestedPriority,
    confidence,
    matchedKeywords,
    explanation,
  };
}

/**
 * Searches active open complaints for duplicates within the same tenant/unit.
 */
export async function detectDuplicateInternal(
  db: any,
  tenantId: string,
  unitId: string | null | undefined,
  title: string,
  description: string,
  thresholdPercent: number,
  excludeId?: string,
): Promise<DuplicateDetectionResult> {
  const query = `
    SELECT id, unit_id, title, description, created_at
    FROM complaints
    WHERE tenant_id = ?
      AND status IN ('open', 'assigned', 'in_progress')
      ${excludeId ? "AND id != ?" : ""}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const params = excludeId ? [tenantId, excludeId] : [tenantId];
  const [candidates] = (await db.query(query, params)) as any[];

  let highestScore = 0;
  let duplicateOfId: string | null = null;
  let matchedTitle = "";

  const candidateCombined = `${title} ${description}`;

  for (const candidate of candidates) {
    const existingCombined = `${candidate.title} ${candidate.description}`;
    let sim = calculateTextSimilarity(candidateCombined, existingCombined);

    // Boost similarity if it's the exact same unit
    if (unitId && candidate.unit_id && unitId === candidate.unit_id) {
      sim = Math.min(100, sim + 10);
    }

    if (sim > highestScore) {
      highestScore = sim;
      duplicateOfId = candidate.id;
      matchedTitle = candidate.title;
    }
  }

  const isDuplicate = highestScore >= thresholdPercent;
  return {
    isDuplicate,
    duplicateOfId: isDuplicate ? duplicateOfId : null,
    similarityScore: highestScore,
    matchedTitle,
  };
}

// ─── GET AI COMPLAINT SETTINGS ────────────────────────────────────────────────

export const getAIComplaintSettingsFn = createServerFn({ method: "GET" })
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
    if (!isAdminRole(roles) && !hasAnyRole(roles, ["complaint_manager", "maintenance_head"])) {
      throw new Error("Forbidden — Admin access required");
    }

    const scoping = await getTenantScoping(request, data?.tenantId);
    const activeTenantId = scoping.tenantId;

    if (!activeTenantId || activeTenantId === "all") {
      return { isAllSocieties: true, settings: DEFAULT_AI_COMPLAINT_SETTINGS };
    }

    const db = getDb();
    const [rows] = (await db.query(
      `SELECT auto_categorize, auto_priority, dup_threshold, escalation_days, updated_at
       FROM ai_complaint_settings
       WHERE tenant_id = ? LIMIT 1`,
      [activeTenantId],
    )) as any[];

    if (rows.length === 0) {
      return {
        isAllSocieties: false,
        tenantId: activeTenantId,
        settings: DEFAULT_AI_COMPLAINT_SETTINGS,
      };
    }

    const r = rows[0];
    return {
      isAllSocieties: false,
      tenantId: activeTenantId,
      settings: {
        autoCategorize: Boolean(r.auto_categorize),
        autoPriority: Boolean(r.auto_priority),
        dupThreshold: Number(r.dup_threshold),
        escalationDays: Number(r.escalation_days),
        updatedAt: r.updated_at,
      },
    };
  });

// ─── UPDATE AI COMPLAINT SETTINGS ─────────────────────────────────────────────

export const updateAIComplaintSettingsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().min(1, "Tenant ID is required"),
      autoCategorize: z.boolean(),
      autoPriority: z.boolean(),
      dupThreshold: z.number().min(50).max(100),
      escalationDays: z.number().min(1).max(30),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    const isSuperAdmin = roles.includes("super_admin");
    const isSocietyAdmin = roles.includes("society_admin");

    if (!isSuperAdmin && !isSocietyAdmin) {
      throw new Error("Forbidden — Admin access required to update AI settings");
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
      `INSERT INTO ai_complaint_settings (id, tenant_id, auto_categorize, auto_priority, dup_threshold, escalation_days)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         auto_categorize = VALUES(auto_categorize),
         auto_priority = VALUES(auto_priority),
         dup_threshold = VALUES(dup_threshold),
         escalation_days = VALUES(escalation_days)`,
      [
        id,
        data.tenantId,
        data.autoCategorize,
        data.autoPriority,
        data.dupThreshold,
        data.escalationDays,
      ],
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, 'update_ai_complaint_settings', 'ai_complaints', ?)`,
      [crypto.randomUUID(), data.tenantId, userId, data.tenantId],
    );

    return { success: true };
  });

// ─── ANALYZE COMPLAINT TEXT FN (FOR LIVE UI TESTING / PREVIEWS) ───────────────

export const analyzeComplaintTextFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  )
  .handler(async ({ data }: any) => {
    return analyzeComplaintTextInternal(data.title, data.description);
  });

// ─── GET AI COMPLAINT INSIGHTS (DASHBOARD) ───────────────────────────────────

export const getAIComplaintInsightsFn = createServerFn({ method: "GET" })
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
      isAdminRole(roles) ||
      hasAnyRole(roles, ["complaint_manager", "maintenance_head", "committee_member"]);

    if (!canAccess) {
      throw new Error("Forbidden — Admin access required to view AI Complaint insights");
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

    // 1. Fast aggregate counts
    const [aggRows] = (await db.query(
      `SELECT
         COUNT(*) as totalComplaints,
         COALESCE(SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END), 0) as duplicateCount,
         COALESCE(SUM(CASE WHEN escalated = 1 THEN 1 ELSE 0 END), 0) as escalatedCount,
         COALESCE(SUM(CASE WHEN ai_category IS NOT NULL THEN 1 ELSE 0 END), 0) as aiCategorizedCount,
         COALESCE(SUM(CASE WHEN ai_category IS NOT NULL AND ai_category = category THEN 1 ELSE 0 END), 0) as aiAgreedCount
       FROM complaints
       WHERE tenant_id = ?`,
      [activeTenantId],
    )) as any[];

    const agg = aggRows[0] || {};
    const totalComplaints = Number(agg.totalComplaints || 0);
    const duplicateCount = Number(agg.duplicateCount || 0);
    const escalatedCount = Number(agg.escalatedCount || 0);
    const aiCategorizedCount = Number(agg.aiCategorizedCount || 0);
    const aiAgreedCount = Number(agg.aiAgreedCount || 0);

    const categorizationAccuracy = aiCategorizedCount > 0
      ? Math.round((aiAgreedCount / aiCategorizedCount) * 100)
      : 88;

    // 2. Category distribution aggregate
    const [categoryRows] = (await db.query(
      `SELECT category, COUNT(*) as count
       FROM complaints
       WHERE tenant_id = ?
       GROUP BY category
       ORDER BY count DESC`,
      [activeTenantId],
    )) as any[];

    const categoryDistribution = categoryRows.map((r: any) => ({
      category: r.category || "other",
      count: Number(r.count || 0),
    }));

    // 3. Hotspots aggregate (top 10 by complaint volume)
    const [hotspotRows] = (await db.query(
      `SELECT
         COALESCE(
           IF(u.unit_number IS NOT NULL AND u.unit_number != '', CONCAT('Unit ', u.unit_number), NULL),
           'Common Area / General'
         ) as location,
         COUNT(*) as count,
         GROUP_CONCAT(DISTINCT c.category SEPARATOR ',') as categoriesConcat
       FROM complaints c
       LEFT JOIN units u ON u.id = c.unit_id
       WHERE c.tenant_id = ?
       GROUP BY location
       ORDER BY count DESC
       LIMIT 10`,
      [activeTenantId],
    )) as any[];

    const hotspots = hotspotRows.map((h: any) => ({
      location: h.location,
      count: Number(h.count || 0),
      categories: h.categoriesConcat ? h.categoriesConcat.split(",") : [],
    }));

    // 4. Duplicate pairs (only flagged rows, limit 25)
    const [duplicatePairs] = (await db.query(
      `SELECT c.id, c.title, COALESCE(u.unit_number, '—') as unit, c.category,
              COALESCE(c.similarity_score, 85) as similarityScore,
              c.created_at as createdAt, c.duplicate_of_id as duplicateOfId, c.status,
              COALESCE(orig.title, 'Original complaint') as originalTitle,
              COALESCE(ou.unit_number, '—') as originalUnit
       FROM complaints c
       LEFT JOIN units u ON u.id = c.unit_id
       LEFT JOIN complaints orig ON orig.id = c.duplicate_of_id
       LEFT JOIN units ou ON ou.id = orig.unit_id
       WHERE c.tenant_id = ? AND c.is_duplicate = 1
       ORDER BY c.created_at DESC
       LIMIT 25`,
      [activeTenantId],
    )) as any[];

    return {
      isAllSocieties: false,
      tenantId: activeTenantId,
      stats: {
        totalComplaints,
        duplicateCount,
        escalatedCount,
        aiCategorizedCount,
        categorizationAccuracy,
        categoryDistribution,
        hotspots,
        duplicatePairs,
      },
    };
  });

// ─── RUN AUTO ESCALATION CHECK ────────────────────────────────────────────────

export const runAutoEscalationCheckFn = createServerFn({ method: "POST" })
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
    if (!isAdminRole(roles)) {
      throw new Error("Forbidden — Admin access required to execute escalation checks");
    }

    if (data.tenantId === "all" || !data.tenantId.trim()) {
      throw new Error("Cannot run escalation scan on 'All Societies' mode.");
    }

    const db = getDb();

    // Fetch tenant escalation threshold (default 3 days)
    const [settingsRows] = (await db.query(
      "SELECT escalation_days FROM ai_complaint_settings WHERE tenant_id = ? LIMIT 1",
      [data.tenantId],
    )) as any[];
    const escalationDays = settingsRows.length ? Number(settingsRows[0].escalation_days) : 3;

    // Find non-escalated open complaints older than escalationDays
    const [overdueComplaints] = (await db.query(
      `SELECT id, title, submitted_by, created_at
       FROM complaints
       WHERE tenant_id = ?
         AND status IN ('open', 'assigned')
         AND escalated = 0
         AND TIMESTAMPDIFF(DAY, created_at, NOW()) >= ?`,
      [data.tenantId, escalationDays],
    )) as any[];

    if (overdueComplaints.length === 0) {
      return { escalatedCount: 0, message: "No new complaints required escalation." };
    }

    // Mark as escalated and record audit logs
    for (const c of overdueComplaints) {
      await db.query(
        "UPDATE complaints SET escalated = 1 WHERE id = ? AND tenant_id = ?",
        [c.id, data.tenantId],
      );

      await db.query(
        `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, 'complaint_auto_escalated', 'complaint', ?)`,
        [crypto.randomUUID(), data.tenantId, userId, c.id],
      );

      // Dispatch notification (isolated from failures)
      try {
        if (c.submitted_by) {
          await createNotification({
            userId: c.submitted_by,
            tenantId: data.tenantId,
            type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
            title: "Complaint Escalated",
            message: `Your complaint "${c.title}" has been automatically escalated due to pending resolution SLA.`,
            data: { complaintId: c.id },
          });
        }
      } catch (notifErr) {
        console.warn("[AI Complaints] Notification dispatch ignored:", notifErr);
      }
    }

    return {
      escalatedCount: overdueComplaints.length,
      message: `Successfully escalated ${overdueComplaints.length} overdue complaint(s).`,
    };
  });

// ─── RESOLVE DUPLICATE COMPLAINT ACTION ───────────────────────────────────────

export const resolveDuplicateComplaintFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      complaintId: z.string().min(1),
      action: z.enum(["keep_separate", "confirm_duplicate"]),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    if (!isAdminRole(roles)) {
      throw new Error("Forbidden — Admin access required");
    }

    const db = getDb();
    if (data.action === "keep_separate") {
      await db.query(
        "UPDATE complaints SET is_duplicate = 0, duplicate_of_id = NULL, similarity_score = NULL WHERE id = ?",
        [data.complaintId],
      );
    } else if (data.action === "confirm_duplicate") {
      await db.query(
        "UPDATE complaints SET is_duplicate = 1, status = 'closed', resolution_notes = 'Closed as duplicate ticket by AI verification' WHERE id = ?",
        [data.complaintId],
      );
    }

    return { success: true };
  });
