import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";

// ─── Session Helpers ──────────────────────────────────────────────────────────



// ─── Gate Terminals ──────────────────────────────────────────────────────────

export const getGateTerminalsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM gate_terminals WHERE tenant_id = ? ORDER BY name ASC",
    [tenantId],
  )) as any[];
  return rows;
});

export const createGateTerminalFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      location: z.string().optional(),
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
      "INSERT INTO gate_terminals (id, tenant_id, name, location) VALUES (?, ?, ?, ?)",
      [id, tenantId, data.name, data.location || null],
    );
    return { id };
  });

export const updateGateTerminalStatusFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      terminalId: z.string(),
      status: z.enum(["active", "inactive"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    await db.query("UPDATE gate_terminals SET status = ? WHERE id = ? AND tenant_id = ?", [
      data.status,
      data.terminalId,
      tenantId,
    ]);
    return { success: true };
  });

// ─── Guard Patrols ───────────────────────────────────────────────────────────

export const getGuardPatrolsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM guard_patrols WHERE tenant_id = ? ORDER BY scanned_at DESC LIMIT 100",
    [tenantId],
  )) as any[];
  return rows;
});

export const recordPatrolScanFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      guardName: z.string().min(1),
      checkpointName: z.string().min(1),
      notes: z.string().optional(),
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
      "INSERT INTO guard_patrols (id, tenant_id, guard_name, checkpoint_name, notes) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, data.guardName, data.checkpointName, data.notes || null],
    );
    return { id };
  });

// ─── Blacklist ────────────────────────────────────────────────────────────────

export const getBlacklistFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM blacklist WHERE tenant_id = ? ORDER BY created_at DESC",
    [tenantId],
  )) as any[];
  return rows;
});

export const addBlacklistFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      type: z.enum(["visitor", "vehicle"]),
      value: z.string().min(1),
      reason: z.string().optional(),
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
      "INSERT INTO blacklist (id, tenant_id, type, value, reason) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, data.type, data.value, data.reason || null],
    );
    return { id };
  });

export const removeBlacklistFn = createServerFn({ method: "POST" })
  .validator(z.object({ entryId: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    await db.query("DELETE FROM blacklist WHERE id = ? AND tenant_id = ?", [
      data.entryId,
      tenantId,
    ]);
    return { success: true };
  });

export const checkBlacklistFn = createServerFn({ method: "POST" })
  .validator(z.object({ value: z.string().min(1) }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return { blacklisted: false };

    const db = getDb();
    const [rows] = (await db.query("SELECT * FROM blacklist WHERE tenant_id = ? AND value = ?", [
      tenantId,
      data.value,
    ])) as any[];
    return { blacklisted: rows.length > 0, entry: rows[0] || null };
  });

// ─── Governance — Meetings ────────────────────────────────────────────────────

export const getMeetingsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM governance_meetings WHERE tenant_id = ? ORDER BY scheduled_at DESC",
    [tenantId],
  )) as any[];
  return rows;
});

export const createMeetingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledAt: z.string(),
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
      "INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, data.title, data.description || null, data.scheduledAt],
    );
    return { id };
  });

export const updateMeetingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      meetingId: z.string(),
      status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
      meetingMinutes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) {
      updates.push("status = ?");
      values.push(data.status);
    }
    if (data.meetingMinutes !== undefined) {
      updates.push("meeting_minutes = ?");
      values.push(data.meetingMinutes);
    }
    if (!updates.length) return { success: true };

    values.push(data.meetingId, tenantId);
    await db.query(
      `UPDATE governance_meetings SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      values,
    );
    return { success: true };
  });

// ─── Governance — Resolutions ─────────────────────────────────────────────────

export const getResolutionsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT gr.*, gm.title AS meeting_title
       FROM governance_resolutions gr
       LEFT JOIN governance_meetings gm ON gm.id = gr.meeting_id
       WHERE gr.tenant_id = ? ORDER BY gr.created_at DESC`,
    [tenantId],
  )) as any[];
  return rows;
});

export const createResolutionFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      meetingId: z.string().optional(),
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
      "INSERT INTO governance_resolutions (id, tenant_id, meeting_id, title, description) VALUES (?, ?, ?, ?, ?)",
      [id, tenantId, data.meetingId || null, data.title, data.description || null],
    );
    return { id };
  });

export const voteResolutionFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      resolutionId: z.string(),
      vote: z.enum(["for", "against"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    const col = data.vote === "for" ? "votes_for" : "votes_against";
    await db.query(
      `UPDATE governance_resolutions SET ${col} = ${col} + 1 WHERE id = ? AND tenant_id = ?`,
      [data.resolutionId, tenantId],
    );

    // Auto-update status: if votes_for >= 3 pass, if votes_against >= 3 fail
    await db.query(
      `UPDATE governance_resolutions
       SET status = CASE
         WHEN votes_for >= 3 THEN 'passed'
         WHEN votes_against >= 3 THEN 'failed'
         ELSE 'proposed'
       END
       WHERE id = ? AND tenant_id = ?`,
      [data.resolutionId, tenantId],
    );

    return { success: true };
  });
