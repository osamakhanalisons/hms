import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getCookie } from "vinxi/http";
import { getEvent } from "vinxi/http";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, requireAdmin, isAdminRole, getUserRoles } from "./auth-helper";




// ── Get all modules with activation state for current tenant ──────────────
export const getActiveModulesFn = createServerFn({ method: "GET" }).handler(async (ctx) => {
  const request = (ctx as any).request as Request | undefined;
  const userId = await getSessionUser(request);
  if (!userId) return [] as { module_key: string; is_active: boolean; is_core: boolean }[];

  let tenantId = await getUserTenantId(userId);

  // Fallback: agar profile.tenant_id null ho, persons table se check karo (resident flow)
  if (!tenantId) {
    const db2 = getDb();
    const [personRows] = (await db2.query(
      "SELECT tenant_id FROM persons WHERE user_id = ? AND tenant_id IS NOT NULL LIMIT 1",
      [userId],
    )) as any[];
    if (personRows.length > 0) {
      tenantId = personRows[0].tenant_id as string;
      // Silently fix the profile
      await db2.query(
        "UPDATE profiles SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR tenant_id = '')",
        [tenantId, userId],
      );
    }
  }

  if (!tenantId) {
    // No tenant at all — return empty (modules-context will treat all as active)
    return [] as { module_key: string; is_active: boolean; is_core: boolean }[];
  }

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT mr.module_key, mr.is_core, mr.min_plan, mr.dependencies, mr.category, mr.display_name, mr.sort_order,
              COALESCE(tm.is_active, FALSE) AS is_active
       FROM module_registry mr
       LEFT JOIN tenant_modules tm ON tm.module_key = mr.module_key AND tm.tenant_id = ?
       ORDER BY mr.sort_order`,
    [tenantId],
  )) as any[];

  return rows.map((r: any) => ({
    module_key: r.module_key,
    display_name: r.display_name,
    category: r.category,
    is_core: Boolean(r.is_core),
    is_active: Boolean(r.is_active) || Boolean(r.is_core),
    min_plan: r.min_plan,
    dependencies:
      typeof r.dependencies === "string" ? JSON.parse(r.dependencies) : (r.dependencies ?? []),
    sort_order: r.sort_order,
  }));
});

// ── Toggle module on/off for the current tenant ───────────────────────────
export const toggleModuleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      moduleKey: z.string(),
      active: z.boolean(),
    }),
  )
  .handler(async ({ data, request }) => {
    // Use requireAdmin helper for cleaner code
    const { userId, tenantId } = await requireAdmin(request);

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
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
        tenantId,
        data.moduleKey,
        data.active,
        data.active ? new Date() : null,
        data.active ? userId : null,
        !data.active ? new Date() : null,
        !data.active ? userId : null,
      ],
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, ?, 'module', ?)`,
      [
        crypto.randomUUID(),
        tenantId,
        userId,
        data.active ? "module_activated" : "module_deactivated",
        data.moduleKey,
      ],
    );

    return { success: true };
  });

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
