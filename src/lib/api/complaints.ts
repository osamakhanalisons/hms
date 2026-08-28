import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import {
  getSessionUser,
  getUserTenantId,
  resolveTenantId,
  getUserRoles,
  isAdminRole,
  getTenantScoping,
} from "./auth-helper";
import { requirePermission } from "./permissions";

export const getComplaintsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await getUserRoles(userId);
    const isAdmin = isAdminRole(userRoles);
    const db = getDb();

    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "c.tenant_id");

    let query = `
      SELECT c.*, u.unit_number, p.full_name AS submitter_name, staff.full_name AS assignee_name,
             CONCAT_WS(' › ', s.name, bl.name, b.name, CONCAT('Unit ', u.unit_number)) AS full_path
      FROM complaints c
      LEFT JOIN units u ON u.id = c.unit_id
      LEFT JOIN societies s ON s.id = u.society_id
      LEFT JOIN blocks bl ON bl.id = u.block_id
      LEFT JOIN buildings b ON b.id = u.building_id
      LEFT JOIN profiles p ON p.id = c.submitted_by
      LEFT JOIN profiles staff ON staff.id = c.assigned_to
      WHERE ${sqlFilter}
    `;
    const params: any[] = [...sqlParams];

    if (!isAdmin) {
      query += " AND c.submitted_by = ?";
      params.push(userId);
    }

    if (data?.status) {
      query += " AND c.status = ?";
      params.push(data.status);
    }
    if (data?.priority) {
      query += " AND c.priority = ?";
      params.push(data.priority);
    }
    query += " ORDER BY c.created_at DESC";

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });

export const createComplaintFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      unitId: z.string().optional(),
      category: z.enum([
        "electrical",
        "plumbing",
        "security",
        "cleaning",
        "lift",
        "water",
        "civil",
        "hvac",
        "other",
      ]),
      priority: z.enum(["low", "medium", "high", "critical"]),
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }) => {
    const { tenantId, roles, userId } = await requirePermission(request, "complaints", "create");

    const db = getDb();

    // Verify unitId ownership
    if (data.unitId) {
      const isAdmin = isAdminRole(roles);
      if (!isAdmin) {
        // Non-admin (resident/tenant): must be currently registered to this unit
        const [residentCheck] = (await db.query(
          `SELECT r.id FROM residents r
           INNER JOIN persons p ON r.person_id = p.id
           WHERE r.unit_id = ? AND p.user_id = ? AND r.is_current = 1 AND r.tenant_id = ?`,
          [data.unitId, userId, tenantId],
        )) as any[];
        if (residentCheck.length === 0) {
          throw new Error("Forbidden — You can only file complaints for your own unit");
        }
      } else {
        // Admin: must belong to their tenant
        const [unitCheck] = (await db.query("SELECT id FROM units WHERE id = ? AND tenant_id = ?", [
          data.unitId,
          tenantId,
        ])) as any[];
        if (unitCheck.length === 0) {
          throw new Error("Forbidden — Unit not found or unauthorized");
        }
      }
    }

    const id = crypto.randomUUID();

    // Calculate SLA deadline
    const [sla] = (await db.query(
      "SELECT response_hours FROM sla_configs WHERE tenant_id = ? AND category = ? AND priority = ?",
      [tenantId, data.category, data.priority],
    )) as any[];
    const hours = sla.length ? Number(sla[0].response_hours) : 24;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);

    await db.query(
      `INSERT INTO complaints (id, tenant_id, unit_id, submitted_by, category, priority, status, title, description, sla_deadline)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        id,
        tenantId,
        data.unitId || null,
        userId,
        data.category,
        data.priority,
        data.title,
        data.description,
        deadline,
      ],
    );

    return { id };
  });

export const assignComplaintFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      complaintId: z.string(),
      assignedTo: z.string(), // user id of technician/staff
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) {
      throw new Error("Forbidden - Admin access required");
    }

    const db = getDb();
    await db.query(
      "UPDATE complaints SET assigned_to = ?, status = 'assigned' WHERE id = ? AND tenant_id = ?",
      [data.assignedTo, data.complaintId, tenantId],
    );

    return { success: true };
  });

export const updateComplaintStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      complaintId: z.string(),
      status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]),
      resolutionNotes: z.string().optional(),
      satisfactionRating: z.number().min(1).max(5).optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await resolveTenantId(request);

    const userRoles = await getUserRoles(userId);
    if (!isAdminRole(userRoles)) {
      throw new Error("Forbidden - Admin access required");
    }

    const db = getDb();
    let query = "UPDATE complaints SET status = ?";
    const params: any[] = [data.status];

    if (data.resolutionNotes) {
      query += ", resolution_notes = ?";
      params.push(data.resolutionNotes);
    }
    if (data.satisfactionRating) {
      query += ", satisfaction_rating = ?";
      params.push(data.satisfactionRating);
    }

    query += " WHERE id = ? AND tenant_id = ?";
    params.push(data.complaintId, tenantId);

    await db.query(query, params);
    return { success: true };
  });
