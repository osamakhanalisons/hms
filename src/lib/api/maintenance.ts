import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


export const getWorkOrdersFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT wo.*, a.name AS asset_name, v.name AS vendor_name
       FROM maintenance_work_orders wo
       LEFT JOIN assets a ON a.id = wo.asset_id
       LEFT JOIN vendors v ON v.id = wo.assigned_vendor_id
       WHERE wo.tenant_id = ? ORDER BY wo.created_at DESC`,
    [tenantId],
  )) as any[];
  return rows;
});

export const createWorkOrderFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().min(1),
      cost: z.number().nonnegative().optional(),
      priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
      assignedVendorId: z.string().optional(),
      estimatedCost: z.number().optional(),
      slaDueAt: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO maintenance_work_orders (id, tenant_id, asset_id, title, description, status, cost, priority, assigned_vendor_id, estimated_cost, sla_due_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        data.assetId || null,
        data.title,
        data.description,
        data.cost || 0.0,
        data.priority,
        data.assignedVendorId || null,
        data.estimatedCost || 0.0,
        data.slaDueAt || null,
      ],
    );
    return { id };
  });

export const updateWorkOrderStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      workOrderId: z.string(),
      status: z.enum(["open", "assigned", "in_progress", "completed", "verified"]),
      assignedTechnicianId: z.string().optional(),
      assignedVendorId: z.string().optional(),
      cost: z.number().optional(),
      actualCost: z.number().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    let query = "UPDATE maintenance_work_orders SET status = ?";
    const params: any[] = [data.status];

    if (data.assignedTechnicianId) {
      query += ", assigned_technician_id = ?";
      params.push(data.assignedTechnicianId);
    }
    if (data.assignedVendorId) {
      query += ", assigned_vendor_id = ?";
      params.push(data.assignedVendorId);
    }
    if (data.cost !== undefined) {
      query += ", cost = ?";
      params.push(data.cost);
    }
    if (data.actualCost !== undefined) {
      query += ", actual_cost = ?";
      params.push(data.actualCost);
    }

    query += " WHERE id = ? AND tenant_id = ?";
    params.push(data.workOrderId, tenantId);

    await db.query(query, params);
    return { success: true };
  });

export const getMaintenanceSchedulesFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT ms.*, a.name AS asset_name
       FROM maintenance_schedules ms
       JOIN assets a ON a.id = ms.asset_id
       WHERE ms.tenant_id = ? ORDER BY ms.next_due_date ASC`,
    [tenantId],
  )) as any[];
  return rows;
});

export const createMaintenanceScheduleFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
      taskDescription: z.string().min(1),
      nextDueDate: z.string(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO maintenance_schedules (id, asset_id, tenant_id, frequency, task_description, next_due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.assetId, tenantId, data.frequency, data.taskDescription, data.nextDueDate],
    );
    return { id };
  });
