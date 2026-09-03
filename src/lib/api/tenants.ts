import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getCookie } from "vinxi/http";
import { getEvent } from "vinxi/http";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserTenantId,
  requireAdmin,
  isAdminRole,
  getUserRoles,
  getTenantScoping,
} from "./auth-helper";

// ── Get all modules with activation state for current tenant ──────────────
export const getActiveModulesFn = createServerFn({ method: "GET" })
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
    if (!userId) {
      return {
        isAllSocieties: false,
        tenantId: null,
        tenantPlan: null,
        modules: [],
      };
    }

    const roles = await getUserRoles(userId);
    const isSuperAdmin = roles.includes("super_admin");
    const isSocietyAdmin = roles.includes("society_admin");

    const scoping = await getTenantScoping(request, data?.tenantId);
    const activeTenantId = scoping.tenantId;

    // If Super Admin has "All Societies" selected (or scoping.sqlFilter === "1=1" / empty)
    if (isSuperAdmin && (scoping.sqlFilter === "1=1" || !activeTenantId || activeTenantId === "all")) {
      return {
        isAllSocieties: true,
        tenantId: "all",
        tenantPlan: null,
        modules: [],
      };
    }

    // For Society Admin, verify assignment in society_admin_tenants
    const db = getDb();
    if (isSocietyAdmin && !isSuperAdmin) {
      const [assigned] = (await db.query(
        "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ? AND is_active = TRUE LIMIT 1",
        [userId, activeTenantId],
      )) as any[];
      if (assigned.length === 0) {
        throw new Error("Forbidden: You do not have administrative access to this society.");
      }
    }

    // Fetch tenant plan
    const [tRows] = (await db.query("SELECT plan FROM tenants WHERE id = ? LIMIT 1", [
      activeTenantId,
    ])) as any[];
    const tenantPlan = tRows.length ? (tRows[0].plan as string) : "starter";

    const [rows] = (await db.query(
      `SELECT mr.module_key, mr.is_core, mr.min_plan, mr.dependencies, mr.category, mr.display_name, mr.description, mr.sort_order,
              COALESCE(tm.is_active, FALSE) AS is_active
       FROM module_registry mr
       LEFT JOIN tenant_modules tm ON tm.module_key = mr.module_key AND tm.tenant_id = ?
       ORDER BY mr.sort_order`,
      [activeTenantId],
    )) as any[];

    const modules = rows.map((r: any) => ({
      module_key: r.module_key,
      display_name: r.display_name,
      category: r.category,
      description: r.description,
      is_core: Boolean(r.is_core),
      is_active: Boolean(r.is_active) || Boolean(r.is_core),
      min_plan: r.min_plan,
      dependencies:
        typeof r.dependencies === "string" ? JSON.parse(r.dependencies) : (r.dependencies ?? []),
      sort_order: r.sort_order,
    }));

    return {
      isAllSocieties: false,
      tenantId: activeTenantId,
      tenantPlan,
      modules,
    };
  });

// ── Transactional Batch Module Activation / Deactivation ─────────────────
export const batchSetModulesActiveFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().min(1, "Tenant ID is required"),
      changes: z
        .array(
          z.object({
            moduleKey: z.string().min(1),
            active: z.boolean(),
          }),
        )
        .min(1, "At least one module change is required"),
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
      throw new Error("Forbidden: Admin access required to manage modules.");
    }

    if (data.tenantId === "all" || !data.tenantId.trim()) {
      throw new Error(
        "Cannot modify module settings in 'All Societies' mode. Please select a specific society.",
      );
    }

    const db = getDb();

    // Check tenant existence & plan
    const [tRows] = (await db.query("SELECT id, name, plan FROM tenants WHERE id = ? LIMIT 1", [
      data.tenantId,
    ])) as any[];
    if (tRows.length === 0) {
      throw new Error("Target society / tenant does not exist.");
    }
    const tenantPlan = tRows[0].plan as string;

    // Authorization check for Society Admin
    if (!isSuperAdmin) {
      const [assigned] = (await db.query(
        "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ? AND is_active = TRUE LIMIT 1",
        [userId, data.tenantId],
      )) as any[];
      if (assigned.length === 0) {
        throw new Error("Forbidden: You do not have permission to modify modules for this society.");
      }
    }

    // Fetch canonical module_registry
    const [regRows] = (await db.query(
      "SELECT module_key, display_name, is_core, min_plan, dependencies FROM module_registry",
    )) as any[];
    const registryMap = new Map<string, any>();
    for (const r of regRows) {
      registryMap.set(r.module_key, {
        ...r,
        is_core: Boolean(r.is_core),
        dependencies:
          typeof r.dependencies === "string" ? JSON.parse(r.dependencies) : (r.dependencies ?? []),
      });
    }

    // Fetch currently active modules for this tenant
    const [curRows] = (await db.query(
      "SELECT module_key, is_active FROM tenant_modules WHERE tenant_id = ?",
      [data.tenantId],
    )) as any[];
    const simulatedActiveSet = new Set<string>();
    // Core modules always active
    for (const r of regRows) {
      if (r.is_core) simulatedActiveSet.add(r.module_key);
    }
    // Active tenant modules
    for (const r of curRows) {
      if (r.is_active) simulatedActiveSet.add(r.module_key);
    }

    const PLAN_RANKS: Record<string, number> = {
      core: 0,
      starter: 1,
      growth: 2,
      professional: 3,
      enterprise: 4,
    };
    const currentPlanRank = PLAN_RANKS[tenantPlan] ?? 1;

    // Validate each requested change
    for (const change of data.changes) {
      const def = registryMap.get(change.moduleKey);
      if (!def) {
        throw new Error(`Unknown module '${change.moduleKey}'.`);
      }

      // Rule 1: Core modules cannot be disabled
      if (def.is_core && !change.active) {
        throw new Error(
          `Cannot disable core module '${def.display_name}'. Core modules are essential for system operation.`,
        );
      }

      // Rule 2: Minimum plan check
      if (change.active) {
        const requiredRank = PLAN_RANKS[def.min_plan] ?? 1;
        if (requiredRank > currentPlanRank) {
          throw new Error(
            `Cannot enable '${def.display_name}'. It requires ${def.min_plan.toUpperCase()} plan, but current society is on ${tenantPlan.toUpperCase()} plan.`,
          );
        }
        simulatedActiveSet.add(change.moduleKey);
      } else {
        simulatedActiveSet.delete(change.moduleKey);
      }
    }

    // Rule 3: Dependency integrity check across final simulated state
    for (const activeKey of simulatedActiveSet) {
      const def = registryMap.get(activeKey);
      if (def && Array.isArray(def.dependencies)) {
        for (const depKey of def.dependencies) {
          if (!simulatedActiveSet.has(depKey)) {
            const depDef = registryMap.get(depKey);
            const depName = depDef?.display_name || depKey;
            throw new Error(
              `Cannot deactivate dependency '${depName}' because active module '${def.display_name}' depends on it.`,
            );
          }
        }
      }
    }

    // ── ATOMIC TRANSACTION WRITES ──
    const conn = await (db as any).getConnection();
    await conn.beginTransaction();

    try {
      for (const change of data.changes) {
        const id = crypto.randomUUID();
        await conn.query(
          `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by, deactivated_at, deactivated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             is_active = VALUES(is_active),
             activated_at = IF(VALUES(is_active) = TRUE, NOW(), activated_at),
             activated_by = IF(VALUES(is_active) = TRUE, VALUES(activated_by), activated_by),
             deactivated_at = IF(VALUES(is_active) = FALSE, NOW(), deactivated_at),
             deactivated_by = IF(VALUES(is_active) = FALSE, VALUES(deactivated_by), deactivated_by)`,
          [
            id,
            data.tenantId,
            change.moduleKey,
            change.active,
            change.active ? new Date() : null,
            change.active ? userId : null,
            !change.active ? new Date() : null,
            !change.active ? userId : null,
          ],
        );

        await conn.query(
          `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
           VALUES (?, ?, ?, ?, 'module', ?)`,
          [
            crypto.randomUUID(),
            data.tenantId,
            userId,
            change.active ? "module_activated" : "module_deactivated",
            change.moduleKey,
          ],
        );
      }

      await conn.commit();
      return { success: true, count: data.changes.length };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });

// ── Single Module Toggle (delegates to atomic batch handler) ───────────────
export const setModuleActiveFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().optional(),
      moduleKey: z.string(),
      active: z.boolean(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    let targetTenantId = data.tenantId;
    if (!targetTenantId) {
      const scoping = await getTenantScoping(request);
      targetTenantId = scoping.tenantId;
    }
    return batchSetModulesActiveFn({
      data: {
        tenantId: targetTenantId,
        changes: [{ moduleKey: data.moduleKey, active: data.active }],
      },
      request,
    });
  });

export const toggleModuleFn = setModuleActiveFn;

// ── Provision default tenant for a new super_admin ───────────────────────
export const provisionTenantFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      societyName: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();

    // Check if user already has a tenant
    const existing = await getUserTenantId(userId);
    if (existing) return { tenantId: existing };

    const tenantId = crypto.randomUUID();
    const slug =
      data.societyName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") +
      "-" +
      tenantId.slice(0, 6);

    await db.query(
      `INSERT INTO tenants (id, name, slug, plan, trial_ends_at)
       VALUES (?, ?, ?, 'professional', DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [tenantId, data.societyName, slug],
    );

    await db.query("UPDATE profiles SET tenant_id = ? WHERE id = ?", [tenantId, userId]);

    // Activate starter modules by default
    const defaultModules = [
      "platform",
      "property",
      "residents",
      "notifications",
      "documents",
      "reports",
      "ledger",
      "payments",
      "complaints",
      "notice_board",
    ];
    for (const key of defaultModules) {
      await db.query(
        `INSERT IGNORE INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by)
         VALUES (?, ?, ?, TRUE, NOW(), ?)`,
        [crypto.randomUUID(), tenantId, key, userId],
      );
    }

    return { tenantId };
  });

// ── Get tenant info ───────────────────────────────────────────────────────
export const getTenantFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return null;

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT id, name, slug, plan, timezone, currency, date_format, is_active, trial_ends_at FROM tenants WHERE id = ?",
    [tenantId],
  )) as any[];

  return rows.length ? rows[0] : null;
});
