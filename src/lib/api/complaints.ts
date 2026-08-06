import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


export const getComplaintsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const db = getDb();
    let query = `
      SELECT c.*, u.unit_number, p.full_name AS submitter_name, staff.full_name AS assignee_name
      FROM complaints c
      LEFT JOIN units u ON u.id = c.unit_id
      LEFT JOIN profiles p ON p.id = c.submitted_by
      LEFT JOIN profiles staff ON staff.id = c.assigned_to
      WHERE c.tenant_id = ?
    `;
    const params: any[] = [tenantId];

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
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
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
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

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
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

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
