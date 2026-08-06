import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


export const getNoticesFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT n.*, p.full_name AS author_name,
              EXISTS(SELECT 1 FROM notice_reads WHERE notice_id = n.id AND user_id = ?) AS is_read
       FROM notices n
       LEFT JOIN profiles p ON p.id = n.author_id
       WHERE n.tenant_id = ? AND (n.publish_at IS NULL OR n.publish_at <= NOW())
       ORDER BY n.is_pinned DESC, n.created_at DESC`,
    [userId, tenantId],
  )) as any[];
  return rows;
});

export const createNoticeFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      isPinned: z.boolean().optional(),
      isEmergency: z.boolean().optional(),
      targetScope: z.enum(["all", "block", "building"]).optional(),
      targetId: z.string().optional(),
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
      `INSERT INTO notices (id, tenant_id, author_id, title, body, is_pinned, is_emergency, target_scope, target_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        userId,
        data.title,
        data.body,
        data.isPinned || false,
        data.isEmergency || false,
        data.targetScope || "all",
        data.targetId || null,
      ],
    );

    return { id };
  });

export const markNoticeReadFn = createServerFn({ method: "POST" })
  .validator(z.object({ noticeId: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    await db.query("INSERT IGNORE INTO notice_reads (id, notice_id, user_id) VALUES (?, ?, ?)", [
      crypto.randomUUID(),
      data.noticeId,
      userId,
    ]);
    return { success: true };
  });
