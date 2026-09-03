import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AssetItem = {
  id: string;
  name: string;
  category: string;
  location: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number;
  currentValuation: number;
  status: "active" | "under_maintenance" | "decommissioned" | "scrapped";
  warrantyExpiresAt: string | null;
  hasAmc: boolean;
  amcVendorId: string | null;
  amcVendorName: string | null;
  amcCost: number;
  amcStartDate: string | null;
  amcExpiresAt: string | null;
  notes: string | null;
  isAmcExpiringSoon: boolean;
  isAmcExpired: boolean;
  isWarrantyExpired: boolean;
  createdAt: string;
};

export type AssetsOverview = {
  summary: {
    totalAssets: number;
    activeAssets: number;
    underMaintenanceAssets: number;
    amcExpiringSoon: number;
    totalValuation: number;
  };
  assets: AssetItem[];
  vendorsList: { id: string; name: string; category?: string | null; address?: string | null }[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v);
};

function canManageAssets(roles: string[]): boolean {
  return isAdminRole(roles) || hasAnyRole(roles, ["treasurer", "committee_member", "maintenance_head"]);
}

// ─── GET ASSETS OVERVIEW ──────────────────────────────────────────────────────
export const getAssetsOverviewFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.string().optional(),
        amcStatus: z.string().optional(),
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const { tenantId: sessionTenantId } = await requirePermission(request, "assets", "view");

    const db = getDb();

    // Ensure assets table columns exist on existing database instances
    try {
      const [cols] = (await db.query("SHOW COLUMNS FROM assets")) as any[];
      const colNames = new Set(cols.map((c: any) => c.Field));
      if (!colNames.has("category")) {
        await db.query("ALTER TABLE assets ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT 'general'");
      }
      if (!colNames.has("location")) {
        await db.query("ALTER TABLE assets ADD COLUMN location VARCHAR(128) NULL");
      }
      if (!colNames.has("serial_number")) {
        await db.query("ALTER TABLE assets ADD COLUMN serial_number VARCHAR(128) NULL");
      }
      if (!colNames.has("purchase_date")) {
        await db.query("ALTER TABLE assets ADD COLUMN purchase_date DATE NULL");
      }
      if (!colNames.has("purchase_cost")) {
        await db.query("ALTER TABLE assets ADD COLUMN purchase_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      }
      if (!colNames.has("current_valuation")) {
        await db.query("ALTER TABLE assets ADD COLUMN current_valuation DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      }
      if (!colNames.has("status")) {
        await db.query("ALTER TABLE assets ADD COLUMN status ENUM('active','under_maintenance','decommissioned','scrapped') NOT NULL DEFAULT 'active'");
      }
      if (!colNames.has("warranty_expires_at")) {
        await db.query("ALTER TABLE assets ADD COLUMN warranty_expires_at DATE NULL");
      }
      if (!colNames.has("has_amc")) {
        await db.query("ALTER TABLE assets ADD COLUMN has_amc BOOLEAN NOT NULL DEFAULT FALSE");
      }
      if (!colNames.has("amc_vendor_id")) {
        await db.query("ALTER TABLE assets ADD COLUMN amc_vendor_id VARCHAR(36) NULL");
      }
      if (!colNames.has("amc_cost")) {
        await db.query("ALTER TABLE assets ADD COLUMN amc_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      }
      if (!colNames.has("amc_start_date")) {
        await db.query("ALTER TABLE assets ADD COLUMN amc_start_date DATE NULL");
      }
      if (!colNames.has("amc_expires_at")) {
        await db.query("ALTER TABLE assets ADD COLUMN amc_expires_at DATE NULL");
      }
      if (!colNames.has("notes")) {
        await db.query("ALTER TABLE assets ADD COLUMN notes TEXT NULL");
      }
    } catch (_) {}

    const { sqlFilter: sumFilter, sqlParams: sumParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: assetsFilter, sqlParams: assetsParamsBase } = await getTenantScoping(request, data?.tenantId, "a.tenant_id");
    const { sqlFilter: vendorFilter, sqlParams: vendorParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");

    // ── Summary KPIs ──────────────────────────────────────────────────────────
    const [[sumRow]] = (await db.query(
      `SELECT
         COUNT(*) AS total_assets,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_assets,
         SUM(CASE WHEN status = 'under_maintenance' THEN 1 ELSE 0 END) AS maintenance_assets,
         SUM(CASE WHEN has_amc = TRUE AND amc_expires_at >= CURDATE() AND amc_expires_at <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) AS amc_expiring_soon,
         COALESCE(SUM(current_valuation), 0) AS total_val
       FROM assets
       WHERE ${sumFilter}`,
      sumParams,
    )) as any[];

    // ── Assets Query ──────────────────────────────────────────────────────────
    let query = `
      SELECT a.*, v.name AS amc_vendor_name
      FROM assets a
      LEFT JOIN vendors v ON v.id = a.amc_vendor_id
      WHERE ${assetsFilter}
    `;
    const params: any[] = [...assetsParamsBase];

    if (data?.category && data.category !== "all") {
      query += " AND a.category = ?";
      params.push(data.category);
    }

    if (data?.status && data.status !== "all") {
      query += " AND a.status = ?";
      params.push(data.status);
    }

    if (data?.search && data.search.trim() !== "") {
      const q = `%${data.search.trim()}%`;
      query += " AND (a.name LIKE ? OR a.location LIKE ? OR a.serial_number LIKE ?)";
      params.push(q, q, q);
    }

    if (data?.amcStatus && data.amcStatus !== "all") {
      if (data.amcStatus === "active") {
        query += " AND a.has_amc = TRUE AND (a.amc_expires_at IS NULL OR a.amc_expires_at >= CURDATE())";
      } else if (data.amcStatus === "expiring_soon") {
        query += " AND a.has_amc = TRUE AND a.amc_expires_at >= CURDATE() AND a.amc_expires_at <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)";
      } else if (data.amcStatus === "expired") {
        query += " AND a.has_amc = TRUE AND a.amc_expires_at < CURDATE()";
      } else if (data.amcStatus === "no_amc") {
        query += " AND a.has_amc = FALSE";
      }
    }

    query += " ORDER BY a.name ASC";

    const [rows] = (await db.query(query, params)) as any[];
    const today = new Date();
    const in60Days = new Date();
    in60Days.setDate(today.getDate() + 60);

    const assets: AssetItem[] = (rows as any[]).map((r) => {
      const amcExpDate = r.amc_expires_at ? new Date(r.amc_expires_at) : null;
      const warrantyExpDate = r.warranty_expires_at ? new Date(r.warranty_expires_at) : null;

      const isAmcExpiringSoon = Boolean(
        r.has_amc && amcExpDate && amcExpDate >= today && amcExpDate <= in60Days,
      );
      const isAmcExpired = Boolean(r.has_amc && amcExpDate && amcExpDate < today);
      const isWarrantyExpired = Boolean(warrantyExpDate && warrantyExpDate < today);

      return {
        id: r.id,
        name: r.name,
        category: r.category || "general",
        location: r.location ?? null,
        serialNumber: r.serial_number ?? null,
        purchaseDate: toISO(r.purchase_date),
        purchaseCost: Number(r.purchase_cost ?? 0),
        currentValuation: Number(r.current_valuation ?? 0),
        status: r.status,
        warrantyExpiresAt: toISO(r.warranty_expires_at),
        hasAmc: Boolean(r.has_amc),
        amcVendorId: r.amc_vendor_id ?? null,
        amcVendorName: r.amc_vendor_name ?? null,
        amcCost: Number(r.amc_cost ?? 0),
        amcStartDate: toISO(r.amc_start_date),
        amcExpiresAt: toISO(r.amc_expires_at),
        notes: r.notes ?? null,
        isAmcExpiringSoon,
        isAmcExpired,
        isWarrantyExpired,
        createdAt: toISO(r.created_at),
      };
    });

    // ── Vendor Dropdown ───────────────────────────────────────────────────────
    const [vendorRows] = (await db.query(
      `SELECT id, name, category, address FROM vendors WHERE ${vendorFilter} ORDER BY name ASC`,
      vendorParams,
    )) as any[];

    return {
      summary: {
        totalAssets: Number(sumRow?.total_assets ?? 0),
        activeAssets: Number(sumRow?.active_assets ?? 0),
        underMaintenanceAssets: Number(sumRow?.maintenance_assets ?? 0),
        amcExpiringSoon: Number(sumRow?.amc_expiring_soon ?? 0),
        totalValuation: Math.round(Number(sumRow?.total_val ?? 0) * 100) / 100,
      },
      assets,
      vendorsList: (vendorRows as any[]).map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category ?? null,
        address: v.address ?? null,
      })),
    } satisfies AssetsOverview;
  });

// ─── LEGACY HELPER FOR COMPATIBILITY ──────────────────────────────────────────
export const getAssetsFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const overview = await getAssetsOverviewFn({ data: { tenantId: data?.tenantId }, request });
    return overview.assets.map((a) => ({
      id: a.id,
      name: a.name,
      location: a.location,
      serial_number: a.serialNumber,
      warranty_expires_at: a.warrantyExpiresAt,
      created_at: a.createdAt,
  }));
});

// ─── CREATE ASSET ─────────────────────────────────────────────────────────────
export const createAssetFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1, "Asset name is required"),
      category: z.string().optional(),
      location: z.string().optional(),
      serialNumber: z.string().optional(),
      purchaseDate: z.string().optional(),
      purchaseCost: z.number().nonnegative("Purchase cost cannot be negative").optional(),
      currentValuation: z.number().nonnegative("Valuation cannot be negative").optional(),
      warrantyExpiresAt: z.string().optional(),
      hasAmc: z.boolean().optional(),
      amcVendorId: z.string().optional(),
      amcCost: z.number().nonnegative("AMC cost cannot be negative").optional(),
      amcStartDate: z.string().optional(),
      amcExpiresAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "assets", "create");

    // AMC Date validation
    if (data.hasAmc && data.amcStartDate && data.amcExpiresAt) {
      if (new Date(data.amcStartDate) > new Date(data.amcExpiresAt)) {
        throw new Error("AMC start date cannot be after AMC expiry date");
      }
    }

    const db = getDb();

    // Verify vendor if supplied
    if (data.hasAmc && data.amcVendorId) {
      const [[vendor]] = (await db.query(
        "SELECT id FROM vendors WHERE id = ? AND tenant_id = ?",
        [data.amcVendorId, tenantId],
      )) as any[];
      if (!vendor) throw new Error("AMC Vendor not found or unauthorized");
    }

    const id = crypto.randomUUID();
    const purchaseCost = data.purchaseCost ?? 0;
    const currentValuation = data.currentValuation ?? purchaseCost;

    await db.query(
      `INSERT INTO assets 
        (id, tenant_id, name, category, location, serial_number, purchase_date, purchase_cost, current_valuation, status, warranty_expires_at, has_amc, amc_vendor_id, amc_cost, amc_start_date, amc_expires_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        data.name.trim(),
        data.category || "general",
        data.location?.trim() || null,
        data.serialNumber?.trim() || null,
        data.purchaseDate || null,
        purchaseCost,
        currentValuation,
        data.warrantyExpiresAt || null,
        data.hasAmc ?? false,
        data.hasAmc ? data.amcVendorId || null : null,
        data.hasAmc ? data.amcCost ?? 0 : 0,
        data.hasAmc ? data.amcStartDate || null : null,
        data.hasAmc ? data.amcExpiresAt || null : null,
        data.notes?.trim() || null,
      ],
    );

    return { id, success: true };
  });

// ─── UPDATE ASSET STATUS ──────────────────────────────────────────────────────
export const updateAssetStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string(),
      status: z.enum(["active", "under_maintenance", "decommissioned", "scrapped"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "assets", "edit");

    const db = getDb();
    const [result] = (await db.query(
      "UPDATE assets SET status = ? WHERE id = ? AND tenant_id = ?",
      [data.status, data.assetId, tenantId],
    )) as any[];

    if (result.affectedRows === 0) {
      throw new Error("Asset not found or unauthorized");
    }

    return { success: true };
  });

// ─── UPDATE ASSET AMC ─────────────────────────────────────────────────────────
export const updateAssetAmcFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string(),
      hasAmc: z.boolean(),
      amcVendorId: z.string().optional(),
      amcCost: z.number().nonnegative().optional(),
      amcStartDate: z.string().optional(),
      amcExpiresAt: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "assets", "edit");

    if (data.hasAmc && data.amcStartDate && data.amcExpiresAt) {
      if (new Date(data.amcStartDate) > new Date(data.amcExpiresAt)) {
        throw new Error("AMC start date cannot be after AMC expiry date");
      }
    }

    const db = getDb();

    if (data.hasAmc && data.amcVendorId) {
      const [[vendor]] = (await db.query(
        "SELECT id FROM vendors WHERE id = ? AND tenant_id = ?",
        [data.amcVendorId, tenantId],
      )) as any[];
      if (!vendor) throw new Error("AMC Vendor not found or unauthorized");
    }

    const [result] = (await db.query(
      `UPDATE assets 
       SET has_amc = ?, amc_vendor_id = ?, amc_cost = ?, amc_start_date = ?, amc_expires_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        data.hasAmc,
        data.hasAmc ? data.amcVendorId || null : null,
        data.hasAmc ? data.amcCost ?? 0 : 0,
        data.hasAmc ? data.amcStartDate || null : null,
        data.hasAmc ? data.amcExpiresAt || null : null,
        data.assetId,
        tenantId,
      ],
    )) as any[];

    if (result.affectedRows === 0) {
      throw new Error("Asset not found or unauthorized");
    }

    return { success: true };
  });

