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
  resolveTenantId,
} from "./auth-helper";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
  budgetAmount: number;
  spentAmount: number;
  remainingBudget: number;
  progressPercent: number;
  isOverBudget: boolean;
  startDate: string | null;
  endDate: string | null;
  ownerId: string | null;
  ownerName: string | null;
  residentVisible: boolean;
  milestonesCount: number;
  completedMilestonesCount: number;
  createdAt: string;
};

export type ProjectMilestone = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  dueDate: string | null;
  status: "planned" | "in_progress" | "completed";
  notes: string | null;
  createdAt: string;
};

export type ProjectExpense = {
  id: string;
  projectId: string;
  projectName: string;
  vendorId: string | null;
  vendorName: string | null;
  title: string;
  amount: number;
  expenseDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
};

export type ProjectsOverview = {
  summary: {
    totalProjects: number;
    activeProjects: number;
    totalBudget: number;
    totalSpent: number;
    remainingBudget: number;
  };
  projects: ProjectItem[];
  milestones: ProjectMilestone[];
  expenses: ProjectExpense[];
  vendorsList: { id: string; name: string }[];
  usersList: { id: string; name: string }[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v);
};

function isProjectManager(roles: string[]): boolean {
  return (
    isAdminRole(roles) || hasAnyRole(roles, ["treasurer", "committee_member", "maintenance_head"])
  );
}

// ─── GET OVERVIEW ────────────────────────────────────────────────────────────
export const getProjectsOverviewFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        status: z.string().optional(),
        search: z.string().optional(),
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const roles = await getUserRoles(userId);
    const canManage = isProjectManager(roles);

    const db = getDb();

    // Super Admin with "all" selection → tenantId="" → sqlFilter="1=1" (no tenant filter)
    // For non-super-admins fallback to their home tenant or first tenant
    const scopingCheck = await getTenantScoping(request, data?.tenantId);
    let tenantId = scopingCheck.tenantId;

    if (!scopingCheck.isSuperAdmin && !tenantId) {
      tenantId = scopingCheck.userTenantId || "";
    }
    if (!scopingCheck.isSuperAdmin && !tenantId) {
      const [tenants] = (await db.query(
        "SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1",
      )) as unknown as [{ id: string }[], unknown];
      if (tenants.length > 0) {
        tenantId = tenants[0].id;
      }
    }

    // Re-resolve all SQL filters using the final tenantId (empty = all for super admin)
    const { sqlFilter: sumFilter, sqlParams: sumParamsBase } = await getTenantScoping(
      request,
      tenantId || null,
      "p.tenant_id",
    );
    const { sqlFilter: spentFilter, sqlParams: spentParamsBase } = await getTenantScoping(
      request,
      tenantId || null,
      "pe.tenant_id",
    );
    const { sqlFilter: projFilter, sqlParams: projParamsBase } = await getTenantScoping(
      request,
      tenantId || null,
      "p.tenant_id",
    );
    const { sqlFilter: milFilter, sqlParams: milParamsBase } = await getTenantScoping(
      request,
      tenantId || null,
      "pm.tenant_id",
    );
    const { sqlFilter: expFilter, sqlParams: expParamsBase } = await getTenantScoping(
      request,
      tenantId || null,
      "pe.tenant_id",
    );
    const { sqlFilter: vendorFilter, sqlParams: vendorParams } = await getTenantScoping(
      request,
      tenantId || null,
      "tenant_id",
    );
    const { sqlFilter: userFilter, sqlParams: userParams } = await getTenantScoping(
      request,
      tenantId || null,
      "p.tenant_id",
    );

    // ── Summary aggregates ────────────────────────────────────────────────────
    let summaryQuery = `
      SELECT
        COUNT(*) AS total_projects,
        SUM(CASE WHEN p.status = 'in_progress' THEN 1 ELSE 0 END) AS active_projects,
        COALESCE(SUM(p.budget_amount), 0) AS total_budget
      FROM projects p
      WHERE ${sumFilter}
    `;
    const summaryParams: any[] = [...sumParamsBase];

    if (!canManage) {
      summaryQuery += " AND p.resident_visible = TRUE";
    }

    const [[sumRow]] = (await db.query(summaryQuery, summaryParams)) as any[];

    // Total spent across expenses for visible projects
    let spentQuery = `
      SELECT COALESCE(SUM(pe.amount), 0) AS total_spent
      FROM project_expenses pe
      JOIN projects p ON p.id = pe.project_id
      WHERE ${spentFilter}
    `;
    const spentParams: any[] = [...spentParamsBase];
    if (!canManage) {
      spentQuery += " AND p.resident_visible = TRUE";
    }
    const [[spentRow]] = (await db.query(spentQuery, spentParams)) as any[];

    const totalBudget = Number(sumRow?.total_budget ?? 0);
    const totalSpent = Number(spentRow?.total_spent ?? 0);
    const remainingBudget = Math.max(0, totalBudget - totalSpent);

    // ── Projects List Query ───────────────────────────────────────────────────
    let projQuery = `
      SELECT 
        p.*,
        pr.full_name AS owner_name,
        COALESCE(SUM(pe.amount), 0) AS spent_amount,
        (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_count,
        (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'completed') AS completed_milestones_count
      FROM projects p
      LEFT JOIN profiles pr ON pr.id = p.owner_id
      LEFT JOIN project_expenses pe ON pe.project_id = p.id
      WHERE ${projFilter}
    `;
    const projParams: any[] = [...projParamsBase];

    if (!canManage) {
      projQuery += " AND p.resident_visible = TRUE";
    }

    if (data?.status && data.status !== "all") {
      projQuery += " AND p.status = ?";
      projParams.push(data.status);
    }

    if (data?.search && data.search.trim() !== "") {
      const q = `%${data.search.trim()}%`;
      projQuery += " AND (p.name LIKE ? OR p.description LIKE ?)";
      projParams.push(q, q);
    }

    projQuery += " GROUP BY p.id ORDER BY p.created_at DESC";

    const [projRows] = (await db.query(projQuery, projParams)) as any[];

    const projects: ProjectItem[] = (projRows as any[]).map((r) => {
      const budget = Number(r.budget_amount ?? 0);
      const spent = Number(r.spent_amount ?? 0);
      const remaining = budget - spent;
      const progressPercent = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
      const isOverBudget = spent > budget && budget > 0;

      return {
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        status: r.status,
        budgetAmount: budget,
        spentAmount: spent,
        remainingBudget: remaining,
        progressPercent,
        isOverBudget,
        startDate: toISO(r.start_date),
        endDate: toISO(r.end_date),
        ownerId: r.owner_id ?? null,
        ownerName: r.owner_name ?? null,
        residentVisible: Boolean(r.resident_visible),
        milestonesCount: Number(r.milestones_count ?? 0),
        completedMilestonesCount: Number(r.completed_milestones_count ?? 0),
        createdAt: toISO(r.created_at),
      };
    });

    // ── Milestones List ────────────────────────────────────────────────────────
    let milQuery = `
      SELECT pm.*, p.name AS project_name
      FROM project_milestones pm
      JOIN projects p ON p.id = pm.project_id
      WHERE ${milFilter}
    `;
    if (!canManage) milQuery += " AND p.resident_visible = TRUE";
    milQuery += " ORDER BY pm.due_date ASC, pm.created_at DESC";

    const [milRows] = (await db.query(milQuery, milParamsBase)) as any[];
    const milestones: ProjectMilestone[] = (milRows as any[]).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      title: r.title,
      dueDate: toISO(r.due_date),
      status: r.status,
      notes: r.notes ?? null,
      createdAt: toISO(r.created_at),
    }));

    // ── Expenses List ─────────────────────────────────────────────────────────
    let expQuery = `
      SELECT pe.*, p.name AS project_name, v.name AS vendor_name
      FROM project_expenses pe
      JOIN projects p ON p.id = pe.project_id
      LEFT JOIN vendors v ON v.id = pe.vendor_id
      WHERE ${expFilter}
    `;
    if (!canManage) expQuery += " AND p.resident_visible = TRUE";
    expQuery += " ORDER BY pe.expense_date DESC, pe.created_at DESC LIMIT 50";

    const [expRows] = (await db.query(expQuery, expParamsBase)) as any[];
    const expenses: ProjectExpense[] = (expRows as any[]).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      vendorId: r.vendor_id ?? null,
      vendorName: r.vendor_name ?? null,
      title: r.title,
      amount: Number(r.amount ?? 0),
      expenseDate: toISO(r.expense_date),
      invoiceNumber: r.invoice_number ?? null,
      notes: r.notes ?? null,
      createdAt: toISO(r.created_at),
    }));

    // ── Dropdowns: Vendors & Users ────────────────────────────────────────────
    const [vendorRows] = (await db.query(
      `SELECT id, name FROM vendors WHERE ${vendorFilter} ORDER BY name ASC`,
      vendorParams,
    )) as any[];

    const [userRows] = (await db.query(
      `SELECT u.id, COALESCE(p.full_name, u.email) AS name FROM users u JOIN profiles p ON p.id = u.id WHERE ${userFilter} ORDER BY name ASC`,
      userParams,
    )) as any[];

    return {
      summary: {
        totalProjects: Number(sumRow?.total_projects ?? 0),
        activeProjects: Number(sumRow?.active_projects ?? 0),
        totalBudget,
        totalSpent,
        remainingBudget,
      },
      projects,
      milestones,
      expenses,
      vendorsList: (vendorRows as any[]).map((v) => ({ id: v.id, name: v.name })),
      usersList: (userRows as any[]).map((u) => ({ id: u.id, name: u.name })),
    } satisfies ProjectsOverview;
  });

// ─── CREATE PROJECT ──────────────────────────────────────────────────────────
export const createProjectFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1, "Project name is required"),
      description: z.string().optional(),
      status: z.enum(["planning", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
      budgetAmount: z.number().nonnegative("Budget must be zero or positive").optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      ownerId: z.string().optional(),
      residentVisible: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const roles = await getUserRoles(userId);
    if (!isProjectManager(roles)) throw new Error("Forbidden – project manager access required");

    // Date order validation
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) > new Date(data.endDate)) {
        throw new Error("Start date cannot be after target end date");
      }
    }

    const db = getDb();
    const projectId = crypto.randomUUID();

    await db.query(
      `INSERT INTO projects 
        (id, tenant_id, name, description, status, budget_amount, start_date, end_date, owner_id, resident_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        tenantId,
        data.name.trim(),
        data.description?.trim() || null,
        data.status || "planning",
        data.budgetAmount ?? 0,
        data.startDate || null,
        data.endDate || null,
        data.ownerId || null,
        data.residentVisible ?? true,
      ],
    );

    return { id: projectId, success: true };
  });

// ─── UPDATE PROJECT STATUS ───────────────────────────────────────────────────
export const updateProjectStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string(),
      status: z.enum(["planning", "in_progress", "on_hold", "completed", "cancelled"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const roles = await getUserRoles(userId);
    if (!isProjectManager(roles)) throw new Error("Forbidden – project manager access required");

    const db = getDb();
    const [result] = (await db.query(
      "UPDATE projects SET status = ? WHERE id = ? AND tenant_id = ?",
      [data.status, data.projectId, tenantId],
    )) as any[];

    if (result.affectedRows === 0) {
      throw new Error("Project not found or unauthorized");
    }

    return { success: true };
  });

// ─── ADD PROJECT MILESTONE ───────────────────────────────────────────────────
export const addProjectMilestoneFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string(),
      title: z.string().min(1, "Milestone title is required"),
      dueDate: z.string().optional(),
      status: z.enum(["planned", "in_progress", "completed"]).optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const roles = await getUserRoles(userId);
    if (!isProjectManager(roles)) throw new Error("Forbidden – project manager access required");

    const db = getDb();

    // Verify project belongs to tenant
    const [[proj]] = (await db.query("SELECT id FROM projects WHERE id = ? AND tenant_id = ?", [
      data.projectId,
      tenantId,
    ])) as any[];
    if (!proj) throw new Error("Project not found or unauthorized");

    const milestoneId = crypto.randomUUID();
    await db.query(
      `INSERT INTO project_milestones (id, tenant_id, project_id, title, due_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        milestoneId,
        tenantId,
        data.projectId,
        data.title.trim(),
        data.dueDate || null,
        data.status || "planned",
        data.notes?.trim() || null,
      ],
    );

    return { id: milestoneId, success: true };
  });

// ─── UPDATE MILESTONE STATUS ─────────────────────────────────────────────────
export const updateMilestoneStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      milestoneId: z.string(),
      status: z.enum(["planned", "in_progress", "completed"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const roles = await getUserRoles(userId);
    if (!isProjectManager(roles)) throw new Error("Forbidden – project manager access required");

    const db = getDb();
    const [result] = (await db.query(
      "UPDATE project_milestones SET status = ? WHERE id = ? AND tenant_id = ?",
      [data.status, data.milestoneId, tenantId],
    )) as any[];

    if (result.affectedRows === 0) {
      throw new Error("Milestone not found or unauthorized");
    }

    return { success: true };
  });

// ─── ADD PROJECT EXPENSE ─────────────────────────────────────────────────────
export const addProjectExpenseFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string(),
      vendorId: z.string().optional(),
      title: z.string().min(1, "Expense title is required"),
      amount: z.number().positive("Amount must be greater than zero"),
      expenseDate: z.string().min(1, "Expense date is required"),
      invoiceNumber: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const roles = await getUserRoles(userId);
    if (!isProjectManager(roles)) throw new Error("Forbidden – project manager access required");

    const db = getDb();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Verify project belongs to tenant
      const [[proj]] = (await connection.query(
        "SELECT id FROM projects WHERE id = ? AND tenant_id = ? FOR UPDATE",
        [data.projectId, tenantId],
      )) as any[];
      if (!proj) throw new Error("Project not found or unauthorized");

      // Verify vendor if supplied
      if (data.vendorId) {
        const [[vendor]] = (await connection.query(
          "SELECT id FROM vendors WHERE id = ? AND tenant_id = ?",
          [data.vendorId, tenantId],
        )) as any[];
        if (!vendor) throw new Error("Vendor not found or unauthorized");
      }

      const expenseId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO project_expenses 
          (id, tenant_id, project_id, vendor_id, title, amount, expense_date, invoice_number, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expenseId,
          tenantId,
          data.projectId,
          data.vendorId || null,
          data.title.trim(),
          data.amount,
          data.expenseDate,
          data.invoiceNumber?.trim() || null,
          data.notes?.trim() || null,
          userId,
        ],
      );

      await connection.commit();
      return { id: expenseId, success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });
