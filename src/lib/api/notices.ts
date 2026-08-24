import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";


export const getNoticesFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId: sessionTenantId, roles, userId } = await requirePermission(request, "notice_board", "view");
    const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["finance_head", "maintenance_head", "society_admin"]);

    const db = getDb();

    let scopeFilter = "";
    const scopeParams: any[] = [];

    if (!isStaffOrAdmin) {
      // Fetch resident's block, building and unit ids
      const [residentUnits] = await db.query(
        `SELECT u.block_id, u.building_id, u.id AS unit_id FROM residents r
         INNER JOIN persons p ON p.id = r.person_id
         INNER JOIN units u ON u.id = r.unit_id
         WHERE p.user_id = ? AND r.is_current = 1 AND r.tenant_id = ?`,
        [userId, sessionTenantId]
      ) as any[];

      const blockIds = residentUnits.map((u: any) => u.block_id).filter(Boolean);
      const buildingIds = residentUnits.map((u: any) => u.building_id).filter(Boolean);

      scopeFilter = " AND (n.target_scope = 'all'";
      if (blockIds.length > 0) {
        scopeFilter += " OR (n.target_scope = 'block' AND n.target_id IN (?))";
        scopeParams.push(blockIds);
      }
      if (buildingIds.length > 0) {
        scopeFilter += " OR (n.target_scope = 'building' AND n.target_id IN (?))";
        scopeParams.push(buildingIds);
      }
      scopeFilter += ")";
    }

    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "n.tenant_id");

    const query = `
      SELECT n.*, p.full_name AS author_name,
             EXISTS(SELECT 1 FROM notice_reads WHERE notice_id = n.id AND user_id = ?) AS is_read
      FROM notices n
      LEFT JOIN profiles p ON p.id = n.author_id
      WHERE ${sqlFilter} AND (n.publish_at IS NULL OR n.publish_at <= NOW())${scopeFilter}
      ORDER BY n.is_pinned DESC, n.created_at DESC
    `;

    const [rows] = (await db.query(query, [userId, ...sqlParams, ...scopeParams])) as any[];
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
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "notice_board", "create");

    const db = getDb();

    if (data.targetScope === "block" && data.targetId) {
      const [[block]] = await db.query("SELECT id FROM blocks WHERE id = ? AND tenant_id = ?", [data.targetId, tenantId]) as any[];
      if (!block) throw new Error("Forbidden — Block not found or unauthorized");
    }
    if (data.targetScope === "building" && data.targetId) {
      const [[building]] = await db.query("SELECT id FROM buildings WHERE id = ? AND tenant_id = ?", [data.targetId, tenantId]) as any[];
      if (!building) throw new Error("Forbidden — Building not found or unauthorized");
    }
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
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();

    // Verify notice belongs to current tenant
    const [[notice]] = (await db.query("SELECT id FROM notices WHERE id = ? AND tenant_id = ?", [
      data.noticeId,
      tenantId,
    ])) as any[];
    if (!notice) throw new Error("Forbidden — Notice not found or unauthorized");

    await db.query("INSERT IGNORE INTO notice_reads (id, notice_id, user_id) VALUES (?, ?, ?)", [
      crypto.randomUUID(),
      data.noticeId,
      userId,
    ]);
    return { success: true };
  });
