import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserRoles,
  getUserTenantId,
  getTenantScoping,
} from "./auth-helper";

// Supported currencies and timezones for validation
export const SUPPORTED_CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "INR", "CAD", "AUD"] as const;

export const SUPPORTED_TIMEZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;

export interface WorkspaceData {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  plan: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  trialEndsAt: string | null;
  enabledModulesCount: number;
  totalModulesCount: number;
}

export type WorkspaceResponse =
  | { isAllSocieties: true; workspace: null }
  | { isAllSocieties: false; workspace: WorkspaceData };

// ── GET WORKSPACE DETAILS ──────────────────────────────────────────────────
export const getWorkspaceDetailsFn = createServerFn({ method: "GET" })
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
    const isSuperAdmin = roles.includes("super_admin");
    const isSocietyAdmin = roles.includes("society_admin");

    if (!isSuperAdmin && !isSocietyAdmin) {
      throw new Error("Forbidden: Admin access required for Workspace management");
    }

    const scoping = await getTenantScoping(request, data?.tenantId);
    const activeTenantId = scoping.tenantId;

    // In All Societies mode for Super Admin
    if (isSuperAdmin && (scoping.sqlFilter === "1=1" || !activeTenantId || activeTenantId === "all")) {
      return { isAllSocieties: true, workspace: null } as WorkspaceResponse;
    }

    // For Society Admin, verify they are assigned to this tenant in society_admin_tenants
    const db = getDb();
    if (!isSuperAdmin) {
      const [assigned] = (await db.query(
        "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ? AND is_active = TRUE LIMIT 1",
        [userId, activeTenantId],
      )) as any[];

      if (assigned.length === 0) {
        throw new Error("Forbidden: You do not have administrative access to this society.");
      }
    }

    // Fetch canonical tenant record
    const [tenants] = (await db.query(
      `SELECT id, name, code, slug, plan, timezone, currency, date_format,
              contact_email, contact_phone, address, is_active, trial_ends_at
       FROM tenants
       WHERE id = ? LIMIT 1`,
      [activeTenantId],
    )) as any[];

    if (tenants.length === 0) {
      throw new Error("Tenant / Society not found.");
    }

    const t = tenants[0];

    // Compute real module counts directly from database
    const [totalModulesRows] = (await db.query(
      "SELECT COUNT(*) AS total_count FROM module_registry",
    )) as any[];
    const totalModulesCount = Number(totalModulesRows[0]?.total_count ?? 0);

    const [activeModulesRows] = (await db.query(
      `SELECT COUNT(DISTINCT mr.module_key) AS active_count
       FROM module_registry mr
       LEFT JOIN tenant_modules tm ON tm.module_key = mr.module_key AND tm.tenant_id = ?
       WHERE mr.is_core = TRUE OR tm.is_active = TRUE`,
      [activeTenantId],
    )) as any[];
    const enabledModulesCount = Number(activeModulesRows[0]?.active_count ?? 0);

    return {
      isAllSocieties: false,
      workspace: {
        id: t.id,
        name: t.name,
        code: t.code,
        slug: t.slug,
        plan: t.plan,
        timezone: t.timezone || "Asia/Karachi",
        currency: t.currency || "PKR",
        dateFormat: t.date_format || "DD/MM/YYYY",
        contactEmail: t.contact_email,
        contactPhone: t.contact_phone,
        address: t.address,
        isActive: Boolean(t.is_active),
        trialEndsAt: t.trial_ends_at,
        enabledModulesCount,
        totalModulesCount,
      },
    } as WorkspaceResponse;
  });

// ── UPDATE WORKSPACE DETAILS ───────────────────────────────────────────────
export const updateWorkspaceDetailsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tenantId: z.string().min(1, "Tenant ID is required"),
      name: z.string().min(2, "Society name must be at least 2 characters").max(255),
      address: z.string().max(1000).nullable().optional(),
      contactEmail: z
        .string()
        .email("Invalid email format")
        .nullable()
        .optional()
        .or(z.literal("")),
      contactPhone: z.string().max(64).nullable().optional(),
      currency: z.string().min(2).max(8),
      timezone: z.string().min(2).max(64),
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
      throw new Error("Forbidden: Admin access required to edit Workspace settings");
    }

    // Prevent ambiguous edits in "all" societies mode
    if (data.tenantId === "all" || !data.tenantId.trim()) {
      throw new Error("Cannot update workspace in 'All Societies' mode. Please select a specific society.");
    }

    const db = getDb();

    // Verify tenant exists
    const [existingTenants] = (await db.query(
      "SELECT id, plan FROM tenants WHERE id = ? LIMIT 1",
      [data.tenantId],
    )) as any[];

    if (existingTenants.length === 0) {
      throw new Error("Target society / tenant does not exist.");
    }

    // Verify Society Admin authorization through society_admin_tenants
    if (!isSuperAdmin) {
      const [assigned] = (await db.query(
        "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ? AND is_active = TRUE LIMIT 1",
        [userId, data.tenantId],
      )) as any[];

      if (assigned.length === 0) {
        throw new Error("Forbidden: You do not have permission to modify this society.");
      }
    }

    // Clean inputs
    const cleanEmail = data.contactEmail && data.contactEmail.trim() ? data.contactEmail.trim() : null;
    const cleanAddress = data.address && data.address.trim() ? data.address.trim() : null;
    const cleanPhone = data.contactPhone && data.contactPhone.trim() ? data.contactPhone.trim() : null;
    const cleanCurrency = data.currency.trim().toUpperCase();
    const cleanTimezone = data.timezone.trim();

    // Execute atomic update on the canonical tenants table
    await db.query(
      `UPDATE tenants
       SET name = ?,
           address = ?,
           contact_email = ?,
           contact_phone = ?,
           currency = ?,
           timezone = ?
       WHERE id = ?`,
      [
        data.name.trim(),
        cleanAddress,
        cleanEmail,
        cleanPhone,
        cleanCurrency,
        cleanTimezone,
        data.tenantId,
      ],
    );

    // Sync profiles.society_name for users belonging to this tenant for backward-compatibility
    try {
      await db.query(
        "UPDATE profiles SET society_name = ? WHERE tenant_id = ?",
        [data.name.trim(), data.tenantId],
      );
    } catch (_) {
      // Non-critical fallback
    }

    // Audit log entry
    try {
      await db.query(
        `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id)
         VALUES (?, ?, ?, 'workspace_updated', 'tenant', ?)`,
        [crypto.randomUUID(), data.tenantId, userId, data.tenantId],
      );
    } catch (_) {
      // Audit log non-blocking
    }

    return {
      success: true,
      message: "Workspace details updated successfully",
      tenantId: data.tenantId,
      name: data.name.trim(),
    };
  });
