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
  getTenantScoping,
} from "./auth-helper";
import { requirePermission } from "./permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkOrderItem = {
  id: string;
  tenantId: string;
  assetId: string | null;
  assetName: string | null;
  assetLocation: string | null;
  assetCategory: string | null;
  assetStatus: string | null;
  title: string;
  description: string;
  status: "open" | "assigned" | "in_progress" | "completed" | "verified" | "cancelled";
  priority: "low" | "normal" | "high" | "critical";
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  assignedVendorId: string | null;
  assignedVendorName: string | null;
  cost: number;
  estimatedCost: number;
  actualCost: number;
  slaDueAt: string | null;
  completedAt: string | null;
  notes: string | null;
  isOverdue: boolean;
  createdAt: string;
};

export type MaintenanceScheduleItem = {
  id: string;
  assetId: string;
  assetName: string;
  assetLocation: string | null;
  assetCategory: string | null;
  title: string | null;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  taskDescription: string;
  nextDueDate: string;
  assignedVendorId: string | null;
  assignedVendorName: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
};

export type MaintenanceOverview = {
  summary: {
    totalWorkOrders: number;
    openWorkOrders: number;
    inProgressWorkOrders: number;
    completedWorkOrders: number;
    overdueWorkOrders: number;
    totalMaintenanceCost: number;
    scheduledMaintenanceCount: number;
  };
  workOrders: WorkOrderItem[];
  schedules: MaintenanceScheduleItem[];
  assetsList: { id: string; name: string; location: string | null; category: string; status: string }[];
  vendorsList: { id: string; name: string; category: string | null }[];
  techniciansList: { id: string; name: string }[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v);
};

function canManageMaintenance(roles: string[]): boolean {
  return (
    isAdminRole(roles) ||
    hasAnyRole(roles, ["maintenance_head", "treasurer", "committee_member", "society_admin"])
  );
}

// ─── GET MAINTENANCE OVERVIEW ────────────────────────────────────────────────
export const getMaintenanceOverviewFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assetId: z.string().optional(),
        vendorId: z.string().optional(),
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const { roles, userId } = await requirePermission(request, "maintenance", "view");

    const db = getDb();

    // Self-healing schema assertions
    try {
      const [woCols] = (await db.query(`SHOW COLUMNS FROM maintenance_work_orders`)) as any[];
      const woColNames = new Set(woCols.map((c: any) => c.Field));
      if (!woColNames.has("priority")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN priority ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal'");
      }
      if (!woColNames.has("assigned_vendor_id")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN assigned_vendor_id VARCHAR(36) NULL");
      }
      if (!woColNames.has("estimated_cost")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      }
      if (!woColNames.has("actual_cost")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN actual_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      }
      if (!woColNames.has("sla_due_at")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN sla_due_at DATE NULL");
      }
      if (!woColNames.has("completed_at")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN completed_at DATETIME NULL");
      }
      if (!woColNames.has("notes")) {
        await db.query("ALTER TABLE maintenance_work_orders ADD COLUMN notes TEXT NULL");
      }
    } catch (_) {}

    try {
      const [schedCols] = (await db.query(`SHOW COLUMNS FROM maintenance_schedules`)) as any[];
      const schedColNames = new Set(schedCols.map((c: any) => c.Field));
      if (!schedColNames.has("title")) {
        await db.query("ALTER TABLE maintenance_schedules ADD COLUMN title VARCHAR(255) NULL");
      }
      if (!schedColNames.has("assigned_vendor_id")) {
        await db.query("ALTER TABLE maintenance_schedules ADD COLUMN assigned_vendor_id VARCHAR(36) NULL");
      }
      if (!schedColNames.has("is_active")) {
        await db.query("ALTER TABLE maintenance_schedules ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE");
      }
    } catch (_) {}

    const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["maintenance_head", "treasurer", "committee_member"]);
    const isTechnicianOnly = !isStaffOrAdmin && roles.includes("technician");

    const { sqlFilter: sumFilter, sqlParams: sumParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: sCountFilter, sqlParams: sCountParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: woFilter, sqlParams: woParamsBase } = await getTenantScoping(request, data?.tenantId, "wo.tenant_id");
    const { sqlFilter: msFilter, sqlParams: msParamsBase } = await getTenantScoping(request, data?.tenantId, "ms.tenant_id");
    const { sqlFilter: assetFilter, sqlParams: assetParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: vendorFilter, sqlParams: vendorParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: techFilter, sqlParams: techParams } = await getTenantScoping(request, data?.tenantId, "p.tenant_id");

    // Summary calculations
    let summaryQuery = `
      SELECT
         COUNT(*) AS total_wo,
         SUM(CASE WHEN status IN ('open', 'assigned') THEN 1 ELSE 0 END) AS open_wo,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_wo,
         SUM(CASE WHEN status IN ('completed', 'verified') THEN 1 ELSE 0 END) AS completed_wo,
         SUM(CASE WHEN status NOT IN ('completed', 'verified', 'cancelled') AND sla_due_at IS NOT NULL AND sla_due_at < CURDATE() THEN 1 ELSE 0 END) AS overdue_wo,
         COALESCE(SUM(CASE WHEN status IN ('completed', 'verified') THEN GREATEST(actual_cost, cost) ELSE 0 END), 0) AS total_cost
       FROM maintenance_work_orders
       WHERE ${sumFilter}
    `;
    const summaryParams: any[] = [...sumParams];
    if (isTechnicianOnly) {
      summaryQuery += " AND assigned_technician_id = ?";
      summaryParams.push(userId);
    }
    const [[summaryRow]] = (await db.query(summaryQuery, summaryParams)) as any[];

    let schedQuery = `SELECT COUNT(*) AS active_sched_count FROM maintenance_schedules WHERE ${sCountFilter} AND is_active = TRUE`;
    const schedParams: any[] = [...sCountParams];
    if (isTechnicianOnly) {
      schedQuery += " AND assigned_technician_id = ?";
      schedParams.push(userId);
    }
    const [[schedCountRow]] = (await db.query(schedQuery, schedParams)) as any[];

    // Fetch Work Orders
    let woQuery = `
      SELECT wo.*,
             a.name AS asset_name,
             a.location AS asset_location,
             a.category AS asset_category,
             a.status AS asset_status,
             v.name AS vendor_name,
             p.full_name AS tech_name
      FROM maintenance_work_orders wo
      LEFT JOIN assets a ON a.id = wo.asset_id
      LEFT JOIN vendors v ON v.id = wo.assigned_vendor_id
      LEFT JOIN profiles p ON p.id = wo.assigned_technician_id
      WHERE ${woFilter}
    `;
    const woParams: any[] = [...woParamsBase];

    if (isTechnicianOnly) {
      woQuery += " AND wo.assigned_technician_id = ?";
      woParams.push(userId);
    }

    if (data?.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      woQuery += " AND (wo.title LIKE ? OR wo.description LIKE ? OR a.name LIKE ? OR a.location LIKE ? OR v.name LIKE ?)";
      woParams.push(q, q, q, q, q);
    }
    if (data?.status && data.status !== "all") {
      woQuery += " AND wo.status = ?";
      woParams.push(data.status);
    }
    if (data?.priority && data.priority !== "all") {
      woQuery += " AND wo.priority = ?";
      woParams.push(data.priority);
    }
    if (data?.assetId && data.assetId !== "all") {
      woQuery += " AND wo.asset_id = ?";
      woParams.push(data.assetId);
    }
    if (data?.vendorId && data.vendorId !== "all") {
      woQuery += " AND wo.assigned_vendor_id = ?";
      woParams.push(data.vendorId);
    }

    woQuery += " ORDER BY wo.created_at DESC";

    const [woRows] = (await db.query(woQuery, woParams)) as any[];

    const todayStr = new Date().toISOString().split("T")[0];

    const workOrders: WorkOrderItem[] = woRows.map((r: any) => {
      const dueStr = toISO(r.sla_due_at);
      const isOverdue = Boolean(
        r.status !== "completed" &&
          r.status !== "verified" &&
          r.status !== "cancelled" &&
          dueStr &&
          dueStr < todayStr,
      );

      return {
        id: r.id,
        tenantId: r.tenant_id,
        assetId: r.asset_id ?? null,
        assetName: r.asset_name ?? null,
        assetLocation: r.asset_location ?? null,
        assetCategory: r.asset_category ?? null,
        assetStatus: r.asset_status ?? null,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority || "normal",
        assignedTechnicianId: r.assigned_technician_id ?? null,
        assignedTechnicianName: r.tech_name ?? null,
        assignedVendorId: r.assigned_vendor_id ?? null,
        assignedVendorName: r.vendor_name ?? null,
        cost: Number(r.cost ?? 0),
        estimatedCost: Number(r.estimated_cost ?? 0),
        actualCost: Number(r.actual_cost ?? 0),
        slaDueAt: dueStr,
        completedAt: toISO(r.completed_at),
        notes: r.notes ?? null,
        isOverdue,
        createdAt: toISO(r.created_at),
      };
    });

    // Fetch Maintenance Schedules
    let schedulesQuery = `
       SELECT ms.*, a.name AS asset_name, a.location AS asset_location, a.category AS asset_category, v.name AS vendor_name
       FROM maintenance_schedules ms
       JOIN assets a ON a.id = ms.asset_id
       LEFT JOIN vendors v ON v.id = ms.assigned_vendor_id
       WHERE ${msFilter}
    `;
    const schedulesParams: any[] = [...msParamsBase];
    if (isTechnicianOnly) {
      schedulesQuery += " AND ms.assigned_technician_id = ?";
      schedulesParams.push(userId);
    }
    schedulesQuery += " ORDER BY ms.next_due_date ASC";

    const [schedRows] = (await db.query(schedulesQuery, schedulesParams)) as any[];

    const schedules: MaintenanceScheduleItem[] = schedRows.map((s: any) => ({
      id: s.id,
      assetId: s.asset_id,
      assetName: s.asset_name,
      assetLocation: s.asset_location ?? null,
      assetCategory: s.asset_category ?? null,
      title: s.title ?? null,
      frequency: s.frequency,
      taskDescription: s.task_description,
      nextDueDate: toISO(s.next_due_date),
      assignedVendorId: s.assigned_vendor_id ?? null,
      assignedVendorName: s.vendor_name ?? null,
      isActive: Boolean(s.is_active ?? true),
      notes: s.notes ?? null,
      createdAt: toISO(s.created_at),
    }));

    // Fetch assets for dropdown
    const [assetRows] = (await db.query(
      `SELECT id, name, location, category, status FROM assets WHERE ${assetFilter} AND status != 'scrapped' ORDER BY name ASC`,
      assetParams,
    )) as any[];

    // Fetch vendors for dropdown
    const [vendorRows] = (await db.query(
      `SELECT id, name, category FROM vendors WHERE ${vendorFilter} ORDER BY name ASC`,
      vendorParams,
    )) as any[];

    // Fetch technicians / staff profiles
    const [techRows] = (await db.query(
      `SELECT p.id, COALESCE(p.full_name, u.email) AS name
       FROM profiles p
       JOIN users u ON u.id = p.id
       WHERE ${techFilter}
       ORDER BY name ASC`,
      techParams,
    )) as any[];

    return {
      summary: {
        totalWorkOrders: Number(summaryRow?.total_wo ?? 0),
        openWorkOrders: Number(summaryRow?.open_wo ?? 0),
        inProgressWorkOrders: Number(summaryRow?.in_progress_wo ?? 0),
        completedWorkOrders: Number(summaryRow?.completed_wo ?? 0),
        overdueWorkOrders: Number(summaryRow?.overdue_wo ?? 0),
        totalMaintenanceCost: Number(summaryRow?.total_cost ?? 0),
        scheduledMaintenanceCount: Number(schedCountRow?.active_sched_count ?? 0),
      },
      workOrders,
      schedules,
      assetsList: assetRows.map((a: any) => ({
        id: a.id,
        name: a.name,
        location: a.location ?? null,
        category: a.category || "general",
        status: a.status,
      })),
      vendorsList: vendorRows.map((v: any) => ({
        id: v.id,
        name: v.name,
        category: v.category ?? null,
      })),
      techniciansList: techRows.map((t: any) => ({
        id: t.id,
        name: t.name,
      })),
    } satisfies MaintenanceOverview;
  });

// ─── LEGACY WORK ORDERS GET ──────────────────────────────────────────────────
export const getWorkOrdersFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const overview = await getMaintenanceOverviewFn({ request });
  return overview.workOrders;
});

// ─── CREATE WORK ORDER ───────────────────────────────────────────────────────
export const createWorkOrderFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().optional(),
      title: z.string().min(1, "Title is required"),
      description: z.string().min(1, "Description is required"),
      priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
      assignedVendorId: z.string().optional(),
      assignedTechnicianId: z.string().optional(),
      cost: z.number().nonnegative("Cost cannot be negative").optional(),
      estimatedCost: z.number().nonnegative("Estimated cost cannot be negative").optional(),
      slaDueAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "maintenance", "create");

    const db = getDb();

    // Tenant safety checks
    if (data.assetId) {
      const [[asset]] = (await db.query(
        "SELECT id FROM assets WHERE id = ? AND tenant_id = ?",
        [data.assetId, tenantId],
      )) as any[];
      if (!asset) throw new Error("Invalid asset for this tenant");
    }

    if (data.assignedVendorId) {
      const [[vendor]] = (await db.query(
        "SELECT id FROM vendors WHERE id = ? AND tenant_id = ?",
        [data.assignedVendorId, tenantId],
      )) as any[];
      if (!vendor) throw new Error("Invalid vendor for this tenant");
    }

    // Verify technician role and tenant
    if (data.assignedTechnicianId) {
      const [techRows] = (await db.query(
        `SELECT r.role FROM user_roles r
         JOIN profiles p ON p.id = r.user_id
         WHERE p.id = ? AND p.tenant_id = ? AND r.role IN ('technician', 'maintenance_head')`,
        [data.assignedTechnicianId, tenantId]
      )) as any[];
      if (techRows.length === 0) {
        throw new Error("Invalid technician selected or unauthorized for this tenant");
      }
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO maintenance_work_orders (
         id, tenant_id, asset_id, title, description, status, priority,
         assigned_vendor_id, assigned_technician_id, cost, estimated_cost, actual_cost, sla_due_at, notes
       ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, 0.00, ?, ?)`,
      [
        id,
        tenantId,
        data.assetId || null,
        data.title,
        data.description,
        data.priority,
        data.assignedVendorId || null,
        data.assignedTechnicianId || null,
        data.cost ?? 0.0,
        data.estimatedCost ?? data.cost ?? 0.0,
        data.slaDueAt || null,
        data.notes || null,
      ],
    );

    return { id, success: true };
  });

// ─── UPDATE WORK ORDER STATUS ────────────────────────────────────────────────
export const updateWorkOrderStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      workOrderId: z.string(),
      status: z.enum(["open", "assigned", "in_progress", "completed", "verified", "cancelled"]),
      assignedTechnicianId: z.string().optional(),
      assignedVendorId: z.string().optional(),
      cost: z.number().nonnegative().optional(),
      actualCost: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId, roles, userId } = await requirePermission(request, "maintenance", "edit");

    const db = getDb();

    // Verify ownership
    const [[wo]] = (await db.query(
      "SELECT id, assigned_technician_id FROM maintenance_work_orders WHERE id = ? AND tenant_id = ?",
      [data.workOrderId, tenantId],
    )) as any[];
    if (!wo) throw new Error("Work order not found or unauthorized");

    // Technician scoping: technician role can only update their assigned work orders
    const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["maintenance_head", "treasurer", "committee_member"]);
    if (!isStaffOrAdmin && roles.includes("technician")) {
      if (wo.assigned_technician_id !== userId) {
        throw new Error("Forbidden — You can only update work orders assigned to you");
      }
    }

    // Verify technician role and tenant on assignment
    if (data.assignedTechnicianId) {
      const [techRows] = (await db.query(
        `SELECT r.role FROM user_roles r
         JOIN profiles p ON p.id = r.user_id
         WHERE p.id = ? AND p.tenant_id = ? AND r.role IN ('technician', 'maintenance_head')`,
        [data.assignedTechnicianId, tenantId]
      )) as any[];
      if (techRows.length === 0) {
        throw new Error("Invalid technician selected or unauthorized for this tenant");
      }
    }

    let query = "UPDATE maintenance_work_orders SET status = ?";
    const params: any[] = [data.status];

    if (data.assignedTechnicianId !== undefined) {
      query += ", assigned_technician_id = ?";
      params.push(data.assignedTechnicianId || null);
    }
    if (data.assignedVendorId !== undefined) {
      query += ", assigned_vendor_id = ?";
      params.push(data.assignedVendorId || null);
    }
    if (data.cost !== undefined) {
      query += ", cost = ?";
      params.push(data.cost);
    }
    if (data.actualCost !== undefined) {
      query += ", actual_cost = ?";
      params.push(data.actualCost);
    }
    if (data.notes !== undefined) {
      query += ", notes = ?";
      params.push(data.notes || null);
    }

    if (data.status === "completed" || data.status === "verified") {
      query += ", completed_at = NOW()";
    }

    query += " WHERE id = ? AND tenant_id = ?";
    params.push(data.workOrderId, tenantId);

    await db.query(query, params);
    return { success: true };
  });

// ─── LEGACY SCHEDULES GET ────────────────────────────────────────────────────
export const getMaintenanceSchedulesFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const overview = await getMaintenanceOverviewFn({ request });
  return overview.schedules;
});

// ─── CREATE MAINTENANCE SCHEDULE ──────────────────────────────────────────────
export const createMaintenanceScheduleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().min(1, "Asset selection is required"),
      title: z.string().optional(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
      taskDescription: z.string().min(1, "Task description is required"),
      nextDueDate: z.string().min(1, "Next due date is required"),
      assignedVendorId: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "maintenance", "create");

    const db = getDb();

    // Verify Asset Tenant ownership
    const [[asset]] = (await db.query(
      "SELECT id FROM assets WHERE id = ? AND tenant_id = ?",
      [data.assetId, tenantId],
    )) as any[];
    if (!asset) throw new Error("Selected asset does not belong to this tenant");

    if (data.assignedVendorId) {
      const [[vendor]] = (await db.query(
        "SELECT id FROM vendors WHERE id = ? AND tenant_id = ?",
        [data.assignedVendorId, tenantId],
      )) as any[];
      if (!vendor) throw new Error("Selected vendor does not belong to this tenant");
    }

    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO maintenance_schedules (
         id, asset_id, tenant_id, title, frequency, task_description, next_due_date, assigned_vendor_id, is_active, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [
        id,
        data.assetId,
        tenantId,
        data.title || null,
        data.frequency,
        data.taskDescription,
        data.nextDueDate,
        data.assignedVendorId || null,
        data.notes || null,
      ],
    );

    return { id, success: true };
  });

// ─── TOGGLE SCHEDULE ACTIVE ──────────────────────────────────────────────────
export const toggleMaintenanceScheduleStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      scheduleId: z.string(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId } = await requirePermission(request, "maintenance", "edit");

    const db = getDb();
    const [res] = (await db.query(
      "UPDATE maintenance_schedules SET is_active = ? WHERE id = ? AND tenant_id = ?",
      [data.isActive, data.scheduleId, tenantId],
    )) as any[];

    if (res.affectedRows === 0) {
      throw new Error("Schedule not found or unauthorized");
    }

    return { success: true };
  });
