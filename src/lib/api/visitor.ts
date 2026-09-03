import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";
import { createNotification, NOTIFICATION_TYPES } from "../services/notification-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisitorPassItem = {
  id: string;
  tenantId: string;
  residentId: string | null;
  residentName: string | null;
  unitNumber: string | null;
  visitorName: string;
  visitorPhone: string | null;
  expectedAt: string;
  passCode: string;
  status: "active" | "used" | "expired" | "cancelled";
  visitorType: "one_time" | "recurring";
  vehiclePlate: string | null;
  preRegistered: boolean;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
};

export type EntryExitLogItem = {
  id: string;
  tenantId: string;
  visitorPassId: string | null;
  domesticStaffId: string | null;
  visitorName: string;
  vehiclePlate: string | null;
  gateId: string | null;
  direction: "in" | "out";
  verifiedByName: string | null;
  unitNumber: string | null;
  timestamp: string;
};

export type BlacklistItem = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  vehiclePlate: string | null;
  reason: string;
  addedByName: string | null;
  createdAt: string;
};

export type VisitorOverview = {
  summary: {
    totalPasses: number;
    activePasses: number;
    todayCheckedIn: number;
    todayCheckedOut: number;
    blacklistedCount: number;
  };
  totalFilteredPasses: number;
  page: number;
  pageSize: number;
  visitorPasses: VisitorPassItem[];
  entryExitLogs: EntryExitLogItem[];
  blacklist: BlacklistItem[];
  unitsList: { id: string; unitNumber: string; residentName: string | null; fullPath: string | null }[];
};

const toISO = (v: any): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().replace("T", " ").split(".")[0];
  return String(v);
};

function canVerifyGatePass(roles: string[]): boolean {
  return (
    isAdminRole(roles) ||
    hasAnyRole(roles, ["security_head", "guard", "society_admin", "treasurer", "committee_member"])
  );
}

// ─── GET VISITOR OVERVIEW ───────────────────────────────────────────────────
export const getVisitorOverviewFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        tenantId: z.string().optional(),
        page: z.number().optional().default(1),
        pageSize: z.number().optional().default(9),
      })
      .optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId: sessionTenantId, roles, userId } = await requirePermission(request, "visitor", "view");
    const isSecurityOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);

    const db = getDb();

    // Fetch resident ID(s) linked to current user
    const [residentRows] = await db.query(
      "SELECT id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?) AND tenant_id = ?",
      [userId, sessionTenantId]
    ) as any[];
    const residentIds = residentRows.map((r: any) => r.id);

    if (!isSecurityOrAdmin && residentIds.length === 0) {
      return {
        summary: { totalPasses: 0, activePasses: 0, todayCheckedIn: 0, todayCheckedOut: 0, blacklistedCount: 0 },
        totalFilteredPasses: 0,
        page: 1,
        pageSize: 9,
        visitorPasses: [],
        entryExitLogs: [],
        blacklist: [],
        unitsList: [],
      } satisfies VisitorOverview;
    }

    const { sqlFilter: vpFilter, sqlParams: vpParamsBase } = await getTenantScoping(request, data?.tenantId, "vp.tenant_id");
    const { sqlFilter: passSumFilter, sqlParams: passSumParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: logSumFilter, sqlParams: logSumParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: blFilter, sqlParams: blParamsBase } = await getTenantScoping(request, data?.tenantId, "bl.tenant_id");
    const { sqlFilter: unitFilter, sqlParams: unitParamsBase } = await getTenantScoping(request, data?.tenantId, "u.tenant_id");

    // Summary KPIs
    let passSumQuery = `
      SELECT
         COUNT(*) AS total_passes,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_passes
       FROM visitor_passes
       WHERE ${passSumFilter}
    `;
    const passSumParams: any[] = [...passSumParamsBase];
    if (!isSecurityOrAdmin) {
      passSumQuery += " AND resident_id IN (?)";
      passSumParams.push(residentIds);
    }
    const [[passSum]] = (await db.query(passSumQuery, passSumParams)) as any[];

    let logSumQuery = `
      SELECT
         SUM(CASE WHEN direction = 'in' AND DATE(timestamp) = CURDATE() THEN 1 ELSE 0 END) AS in_today,
         SUM(CASE WHEN direction = 'out' AND DATE(timestamp) = CURDATE() THEN 1 ELSE 0 END) AS out_today
       FROM entry_exit_log
       WHERE ${logSumFilter}
    `;
    const logSumParams: any[] = [...logSumParamsBase];
    if (!isSecurityOrAdmin) {
      logSumQuery += " AND unit_id IN (SELECT unit_id FROM residents WHERE id IN (?))";
      logSumParams.push(residentIds);
    }
    const [[logSum]] = (await db.query(logSumQuery, logSumParams)) as any[];

    let blCount = 0;
    if (isSecurityOrAdmin) {
      const { sqlFilter: blSumFilter, sqlParams: blSumParamsBase } = await getTenantScoping(request, data?.tenantId, "tenant_id");
      const [[blSum]] = (await db.query(
        `SELECT COUNT(*) AS bl_count FROM visitor_blacklist WHERE ${blSumFilter}`,
        blSumParamsBase,
      )) as any[];
      blCount = Number(blSum?.bl_count ?? 0);
    }

    // Filtered count query for pagination
    let countQuery = `
      SELECT COUNT(*) AS total_count
      FROM visitor_passes vp
      LEFT JOIN residents r ON r.id = vp.resident_id
      LEFT JOIN persons p ON p.id = r.person_id
      LEFT JOIN units u ON u.id = r.unit_id
      WHERE ${vpFilter}
    `;
    const countParams = [...vpParamsBase];
    if (!isSecurityOrAdmin) {
      countQuery += " AND vp.resident_id IN (?)";
      countParams.push(residentIds);
    }
    if (data?.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      countQuery += ` AND (vp.visitor_name LIKE ? OR vp.visitor_phone LIKE ? OR vp.pass_code LIKE ? OR vp.vehicle_plate LIKE ? OR p.full_name LIKE ? OR u.unit_number LIKE ?)`;
      countParams.push(q, q, q, q, q, q);
    }
    if (data?.status && data.status !== "all") {
      countQuery += ` AND vp.status = ?`;
      countParams.push(data.status);
    }
    if (data?.type && data.type !== "all") {
      countQuery += ` AND vp.visitor_type = ?`;
      countParams.push(data.type);
    }
    const [[countRow]] = (await db.query(countQuery, countParams)) as any[];
    const totalFiltered = Number(countRow?.total_count ?? 0);

    // Visitor Passes Query with limit & offset
    let vpQuery = `
      SELECT vp.*,
             p.full_name AS resident_name,
             u.unit_number
      FROM visitor_passes vp
      LEFT JOIN residents r ON r.id = vp.resident_id
      LEFT JOIN persons p ON p.id = r.person_id
      LEFT JOIN units u ON u.id = r.unit_id
      WHERE ${vpFilter}
    `;
    const vpParams: any[] = [...vpParamsBase];

    if (!isSecurityOrAdmin) {
      vpQuery += " AND vp.resident_id IN (?)";
      vpParams.push(residentIds);
    }

    if (data?.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      vpQuery += ` AND (vp.visitor_name LIKE ? OR vp.visitor_phone LIKE ? OR vp.pass_code LIKE ? OR vp.vehicle_plate LIKE ? OR p.full_name LIKE ? OR u.unit_number LIKE ?)`;
      vpParams.push(q, q, q, q, q, q);
    }
    if (data?.status && data.status !== "all") {
      vpQuery += ` AND vp.status = ?`;
      vpParams.push(data.status);
    }
    if (data?.type && data.type !== "all") {
      vpQuery += ` AND vp.visitor_type = ?`;
      vpParams.push(data.type);
    }

    const page = Math.max(1, Number(data?.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(data?.pageSize ?? 9)));
    const offset = (page - 1) * pageSize;

    vpQuery += ` ORDER BY vp.expected_at DESC LIMIT ? OFFSET ?`;
    vpParams.push(pageSize, offset);

    const [vpRows] = (await db.query(vpQuery, vpParams)) as any[];
    const visitorPasses: VisitorPassItem[] = vpRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      residentId: r.resident_id ?? null,
      residentName: r.resident_name ?? null,
      unitNumber: r.unit_number ?? null,
      visitorName: r.visitor_name,
      visitorPhone: r.visitor_phone ?? null,
      expectedAt: toISO(r.expected_at),
      passCode: r.pass_code,
      status: r.status,
      visitorType: r.visitor_type || "one_time",
      vehiclePlate: r.vehicle_plate ?? null,
      preRegistered: Boolean(r.pre_registered ?? true),
      expiresAt: toISO(r.expires_at),
      notes: r.notes ?? null,
      createdAt: toISO(r.created_at),
    }));

    // Entry Exit Logs Query
    let logsQuery = `
      SELECT eel.*, p.full_name AS verifier_name, u.unit_number
      FROM entry_exit_log eel
      LEFT JOIN users u_user ON u_user.id = eel.verified_by
      LEFT JOIN profiles p ON p.id = eel.verified_by
      LEFT JOIN units u ON u.id = eel.unit_id
      WHERE eel.tenant_id = ?
    `;
    const logsParams: any[] = [data?.tenantId || sessionTenantId];
    if (!isSecurityOrAdmin) {
      logsQuery += " AND eel.unit_id IN (SELECT unit_id FROM residents WHERE id IN (?))";
      logsParams.push(residentIds);
    }
    logsQuery += " ORDER BY eel.timestamp DESC LIMIT 50";

    const [logRows] = (await db.query(logsQuery, logsParams)) as any[];

    const entryExitLogs: EntryExitLogItem[] = logRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      visitorPassId: r.visitor_pass_id ?? null,
      domesticStaffId: r.domestic_staff_id ?? null,
      visitorName: r.visitor_name,
      vehiclePlate: r.vehicle_plate ?? null,
      gateId: r.gate_id ?? null,
      direction: r.direction,
      verifiedByName: r.verifier_name ?? null,
      unitNumber: r.unit_number ?? null,
      timestamp: toISO(r.timestamp),
    }));

    // Blacklist Query
    let blRows: any[] = [];
    if (isSecurityOrAdmin) {
      [blRows] = (await db.query(
        `SELECT bl.*, p.full_name AS added_by_name
         FROM visitor_blacklist bl
         LEFT JOIN profiles p ON p.id = bl.added_by
         WHERE ${blFilter}
         ORDER BY bl.created_at DESC
         LIMIT 50`,
        blParamsBase,
      )) as any[];
    }

    const blacklist: BlacklistItem[] = blRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      phone: r.phone ?? null,
      vehiclePlate: r.vehicle_plate ?? null,
      reason: r.reason,
      addedByName: r.added_by_name ?? null,
      createdAt: toISO(r.created_at),
    }));

    // Units List for Pre-registration (limited to top 100 for fast select performance)
    let unitsQuery = `
      SELECT u.id, u.unit_number, p.full_name AS resident_name,
             CONCAT_WS(' › ', IF(s.city IS NOT NULL AND s.city != '', CONCAT(s.name, ' (', s.city, ')'), s.name), bl.name, b.name, CONCAT('Unit ', u.unit_number)) AS full_path
      FROM units u
      LEFT JOIN residents r ON r.unit_id = u.id AND r.is_current = TRUE
      LEFT JOIN persons p ON p.id = r.person_id
      LEFT JOIN societies s ON s.id = u.society_id
      LEFT JOIN blocks bl ON bl.id = u.block_id
      LEFT JOIN buildings b ON b.id = u.building_id
      WHERE ${unitFilter}
    `;
    const unitsParams: any[] = [...unitParamsBase];
    if (!isSecurityOrAdmin) {
      unitsQuery += " AND u.id IN (SELECT unit_id FROM residents WHERE id IN (?))";
      unitsParams.push(residentIds);
    }
    unitsQuery += " ORDER BY s.name, bl.name, b.name, u.unit_number ASC LIMIT 100";

    const [unitRows] = (await db.query(unitsQuery, unitsParams)) as any[];

    return {
      summary: {
        totalPasses: Number(passSum?.total_passes ?? 0),
        activePasses: Number(passSum?.active_passes ?? 0),
        todayCheckedIn: Number(logSum?.in_today ?? 0),
        todayCheckedOut: Number(logSum?.out_today ?? 0),
        blacklistedCount: blCount,
      },
      totalFilteredPasses: totalFiltered,
      page,
      pageSize,
      visitorPasses,
      entryExitLogs,
      blacklist,
      unitsList: unitRows.map((u: any) => ({
        id: u.id,
        unitNumber: u.unit_number,
        residentName: u.resident_name ?? null,
        fullPath: u.full_path ?? null,
      })),
    } satisfies VisitorOverview;
  });

// ─── LEGACY COMPATIBILITY ────────────────────────────────────────────────────
export const getVisitorPassesFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const overview = await (getVisitorOverviewFn as any)({ request });
  return overview.visitorPasses;
});

export const getEntryExitLogsFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const overview = await (getVisitorOverviewFn as any)({ request });
  return overview.entryExitLogs;
});

// ─── CREATE VISITOR PASS ────────────────────────────────────────────────────
export const createVisitorPassFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      visitorName: z.string().min(1, "Visitor name is required"),
      visitorPhone: z.string().optional(),
      expectedAt: z.string().min(1, "Expected arrival date/time is required"),
      visitorType: z.enum(["one_time", "recurring"]).default("one_time"),
      vehiclePlate: z.string().optional(),
      unitId: z.string().optional(),
      expiresAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, roles, userId } = await requirePermission(request, "visitor", "create");

    const db = getDb();

    // Verify unitId ownership for residents
    const isSecurityOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);
    if (!isSecurityOrAdmin && data.unitId) {
      const [residentCheck] = (await db.query(
        `SELECT r.id FROM residents r
         INNER JOIN persons p ON r.person_id = p.id
         WHERE r.unit_id = ? AND p.user_id = ? AND r.is_current = 1 AND r.tenant_id = ?`,
        [data.unitId, userId, tenantId],
      )) as any[];
      if (residentCheck.length === 0) {
        throw new Error("Forbidden — You can only create visitor passes for your own unit");
      }
    }

    // 1. Blacklist Check: Ensure phone / vehicle plate is not blacklisted
    if (data.visitorPhone || data.vehiclePlate) {
      const params: any[] = [tenantId];
      let blSql = "SELECT name, reason FROM visitor_blacklist WHERE tenant_id = ? AND (";
      const conditions: string[] = [];
      if (data.visitorPhone) {
        conditions.push("phone = ?");
        params.push(data.visitorPhone.trim());
      }
      if (data.vehiclePlate) {
        conditions.push("UPPER(vehicle_plate) = UPPER(?)");
        params.push(data.vehiclePlate.trim());
      }
      blSql += conditions.join(" OR ") + ")";

      const [blHits] = (await db.query(blSql, params)) as any[];
      if (blHits.length > 0) {
        throw new Error(
          `ENTRY DENIED: Visitor or vehicle is blacklisted! Reason: "${blHits[0].reason}"`,
        );
      }
    }

    // 2. Resolve Resident ID
    let residentId: string | null = null;
    const [resRows] = (await db.query(
      `SELECT r.id FROM residents r
       JOIN persons p ON p.id = r.person_id
       WHERE p.user_id = ? AND r.tenant_id = ? AND r.is_current = TRUE`,
      [userId, tenantId],
    )) as any[];

    if (resRows.length > 0) {
      residentId = resRows[0].id;
    } else if (data.unitId) {
      const [unitRes] = (await db.query(
        `SELECT id FROM residents WHERE unit_id = ? AND tenant_id = ? AND is_current = TRUE LIMIT 1`,
        [data.unitId, tenantId],
      )) as any[];
      if (unitRes.length > 0) {
        residentId = unitRes[0].id;
      }
    }

    const id = crypto.randomUUID();
    // Secure 6-digit numeric pass code without Math.random()
    const passCode = crypto.randomInt(100000, 999999).toString();

    await db.query(
      `INSERT INTO visitor_passes (
         id, tenant_id, resident_id, visitor_name, visitor_phone, expected_at,
         pass_code, status, visitor_type, vehicle_plate, pre_registered, expires_at, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, TRUE, ?, ?, ?)`,
      [
        id,
        tenantId,
        residentId,
        data.visitorName.trim(),
        data.visitorPhone || null,
        data.expectedAt,
        passCode,
        data.visitorType,
        data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : null,
        data.expiresAt || null,
        data.notes || null,
        userId,
      ],
    );

    return { id, passCode, success: true };
  });

// ─── GATE VERIFICATION & ENTRY/EXIT LOGGING ─────────────────────────────────
export const recordGatePassVerificationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      passCode: z.string().min(1, "Pass code is required"),
      direction: z.enum(["in", "out"]),
      vehiclePlate: z.string().optional(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "gate", "create");

    const db = getDb();

    // 1. Verify Pass Code
    const [passes] = (await db.query(
      "SELECT * FROM visitor_passes WHERE pass_code = ? AND tenant_id = ?",
      [data.passCode.trim(), tenantId],
    )) as any[];

    if (passes.length === 0) {
      throw new Error("Invalid pass code! No visitor pass found for this code.");
    }

    const pass = passes[0];
    if (pass.status === "cancelled" || pass.status === "expired") {
      throw new Error(`Pass status is "${pass.status}". Entry cannot be granted.`);
    }

    // 2. Blacklist Check
    const plate = data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : pass.vehicle_plate;
    if (pass.visitor_phone || plate) {
      const params: any[] = [tenantId];
      let blSql = "SELECT reason FROM visitor_blacklist WHERE tenant_id = ? AND (";
      const conds: string[] = [];
      if (pass.visitor_phone) {
        conds.push("phone = ?");
        params.push(pass.visitor_phone);
      }
      if (plate) {
        conds.push("UPPER(vehicle_plate) = ?");
        params.push(plate);
      }
      blSql += conds.join(" OR ") + ")";

      const [blHits] = (await db.query(blSql, params)) as any[];
      if (blHits.length > 0) {
        throw new Error(
          `ALERT: Visitor/Vehicle is BLACKLISTED! Entry denied. Reason: ${blHits[0].reason}`,
        );
      }
    }

    const logId = crypto.randomUUID();

    // Log Entry/Exit event
    await db.query(
      `INSERT INTO entry_exit_log (id, tenant_id, visitor_pass_id, visitor_name, vehicle_plate, direction, verified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [logId, tenantId, pass.id, pass.visitor_name, plate, data.direction, userId],
    );

    // If check-in on one-time pass, mark as used
    if (data.direction === "in" && pass.visitor_type !== "recurring") {
      await db.query("UPDATE visitor_passes SET status = 'used' WHERE id = ?", [pass.id]);
    }

    // Trigger visitor arrival notification to resident if check-in
    if (data.direction === "in" && pass.resident_id) {
      try {
        const [resRows] = (await db.query(
          `SELECT p.user_id, u.unit_number
           FROM residents r
           JOIN persons p ON p.id = r.person_id
           LEFT JOIN units u ON u.id = r.unit_id
           WHERE r.id = ? AND r.tenant_id = ?`,
          [pass.resident_id, tenantId],
        )) as any[];

        if (resRows.length > 0 && resRows[0].user_id) {
          await createNotification({
            userId: resRows[0].user_id,
            tenantId,
            type: NOTIFICATION_TYPES.VISITOR_ARRIVAL,
            title: "Visitor Arrival",
            message: `Your visitor ${pass.visitor_name} has arrived at the gate.${resRows[0].unit_number ? ` (Unit ${resRows[0].unit_number})` : ""}`,
            data: {
              visitorPassId: pass.id,
              visitorName: pass.visitor_name,
              vehiclePlate: plate || null,
              passCode: pass.pass_code,
            },
          });
        }
      } catch (notifErr) {
        console.error("[VisitorNotification] Failed to send arrival alert:", notifErr);
      }
    }

    return { success: true, visitorName: pass.visitor_name, direction: data.direction };
  });

// ─── CANCEL VISITOR PASS ────────────────────────────────────────────────────
export const cancelVisitorPassFn = createServerFn({ method: "POST" })
  .validator(z.object({ passId: z.string() }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, roles, userId } = await requirePermission(request, "visitor", "edit");

    const db = getDb();

    // Verify pass ownership for residents
    const isSecurityOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);
    if (!isSecurityOrAdmin) {
      const [passCheck] = (await db.query(
        `SELECT id FROM visitor_passes 
         WHERE id = ? AND resident_id IN (
           SELECT id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?)
         ) AND tenant_id = ?`,
        [data.passId, userId, tenantId],
      )) as any[];
      if (passCheck.length === 0) {
        throw new Error("Forbidden — You can only cancel your own visitor passes");
      }
    }

    const [res] = (await db.query(
      "UPDATE visitor_passes SET status = 'cancelled' WHERE id = ? AND tenant_id = ?",
      [data.passId, tenantId],
    )) as any[];

    if (res.affectedRows === 0) {
      throw new Error("Visitor pass not found or unauthorized");
    }

    return { success: true };
  });

// ─── BLACKLIST MANAGEMENT ────────────────────────────────────────────────────
export const addToBlacklistFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1, "Name is required"),
      phone: z.string().optional(),
      vehiclePlate: z.string().optional(),
      reason: z.string().min(1, "Reason is required"),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "blacklist", "create");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO visitor_blacklist (id, tenant_id, name, phone, vehicle_plate, reason, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        data.name.trim(),
        data.phone ? data.phone.trim() : null,
        data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : null,
        data.reason.trim(),
        userId,
      ],
    );

    return { id, success: true };
  });

export const removeFromBlacklistFn = createServerFn({ method: "POST" })
  .validator(z.object({ blacklistId: z.string() }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "blacklist", "delete");

    const db = getDb();
    await db.query("DELETE FROM visitor_blacklist WHERE id = ? AND tenant_id = ?", [
      data.blacklistId,
      tenantId,
    ]);

    return { success: true };
  });

// ─── DOMESTIC STAFF MANAGEMENT ───────────────────────────────────────────────

export type DomesticStaffItem = {
  id: string;
  tenantId: string;
  residentId: string;
  residentName: string;
  unitNumber: string;
  staffCode: string;
  name: string;
  phone: string | null;
  staffType: "maid" | "driver" | "gardener" | "cook" | "nanny" | "other";
  photoUrl: string | null;
  validFrom: string;
  validUntil: string;
  allowedDays: string;
  entryStartTime: string | null;
  entryEndTime: string | null;
  vehiclePlate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export const getDomesticStaffFn = createServerFn({ method: "GET" })
  .validator(
    z.object({
      search: z.string().optional(),
      tenantId: z.string().optional(),
    }).optional()
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId: sessionTenantId, roles, userId } = await requirePermission(request, "visitor", "view");
    const isSecurityOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);
    
    const db = getDb();

    // Fetch resident ID(s) linked to current user
    const [residentRows] = await db.query(
      "SELECT id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?) AND tenant_id = ?",
      [userId, sessionTenantId]
    ) as any[];
    const residentIds = residentRows.map((r: any) => r.id);

    if (!isSecurityOrAdmin && residentIds.length === 0) {
      return [] as DomesticStaffItem[];
    }

    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "ds.tenant_id");

    let query = `
      SELECT ds.*, p.full_name AS resident_name, u.unit_number
      FROM domestic_staff ds
      JOIN residents r ON r.id = ds.resident_id
      JOIN persons p ON p.id = r.person_id
      JOIN units u ON u.id = r.unit_id
      WHERE ${sqlFilter}
    `;
    const params: any[] = [...sqlParams];

    if (!isSecurityOrAdmin) {
      query += " AND ds.resident_id IN (?)";
      params.push(residentIds);
    }

    if (data?.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      query += " AND (ds.name LIKE ? OR ds.phone LIKE ? OR ds.vehicle_plate LIKE ? OR ds.staff_code LIKE ?)";
      params.push(q, q, q, q);
    }

    query += " ORDER BY ds.created_at DESC";

    const [rows] = await db.query(query, params) as any[];

    return rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      residentId: r.resident_id,
      residentName: r.resident_name,
      unitNumber: r.unit_number,
      staffCode: r.staff_code,
      name: r.name,
      phone: r.phone ?? null,
      staffType: r.staff_type,
      photoUrl: r.photo_url ?? null,
      validFrom: toISO(r.valid_from).split(" ")[0],
      validUntil: toISO(r.valid_until).split(" ")[0],
      allowedDays: r.allowed_days,
      entryStartTime: r.entry_start_time ?? null,
      entryEndTime: r.entry_end_time ?? null,
      vehiclePlate: r.vehicle_plate ?? null,
      notes: r.notes ?? null,
      isActive: Boolean(r.is_active),
      createdAt: toISO(r.created_at),
    })) as DomesticStaffItem[];
  });

export const createDomesticStaffFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1, "Staff name is required"),
      phone: z.string().optional().nullable(),
      staffType: z.enum(["maid", "driver", "gardener", "cook", "nanny", "other"]),
      validFrom: z.string().min(1, "Valid from date is required"),
      validUntil: z.string().min(1, "Valid until date is required"),
      allowedDays: z.string().min(1, "Allowed days are required"), // Comma-separated
      entryStartTime: z.string().optional().nullable(),
      entryEndTime: z.string().optional().nullable(),
      vehiclePlate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      residentId: z.string().optional(), // For admin use
    })
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, roles, userId } = await requirePermission(request, "visitor", "create");
    const isSecurityOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);

    const db = getDb();

    // Acquire pool connection for transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Blacklist check on phone or vehicle plate
      if (data.phone || data.vehiclePlate) {
        const params: any[] = [tenantId];
        let blSql = "SELECT name, reason FROM visitor_blacklist WHERE tenant_id = ? AND (";
        const conditions: string[] = [];
        if (data.phone) {
          conditions.push("phone = ?");
          params.push(data.phone.trim());
        }
        if (data.vehiclePlate) {
          conditions.push("UPPER(vehicle_plate) = UPPER(?)");
          params.push(data.vehiclePlate.trim());
        }
        blSql += conditions.join(" OR ") + ")";

        const [blHits] = await connection.query(blSql, params) as any[];
        if (blHits.length > 0) {
          throw new Error(`ENTRY DENIED: This staff member or vehicle is blacklisted! Reason: "${blHits[0].reason}"`);
        }
      }

      // Resolve Resident ID
      let residentId: string;
      if (!isSecurityOrAdmin) {
        // Residents can only create for their own profile
        const [resRows] = await connection.query(
          "SELECT id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?) AND tenant_id = ? AND is_current = TRUE",
          [userId, tenantId]
        ) as any[];
        if (resRows.length === 0) {
          throw new Error("Forbidden — You must be an active resident of this society to register staff.");
        }
        residentId = resRows[0].id;
      } else {
        // Admins/Security can specify any resident ID
        if (!data.residentId) {
          throw new Error("residentId is required for admin/security staff registration.");
        }
        const [resCheck] = await connection.query(
          "SELECT id FROM residents WHERE id = ? AND tenant_id = ?",
          [data.residentId, tenantId]
        ) as any[];
        if (resCheck.length === 0) {
          throw new Error("Invalid resident ID selected for this society.");
        }
        residentId = data.residentId;
      }

      // Generate sequential staff code securely using SELECT ... FOR UPDATE transaction lock
      const [seqRows] = await connection.query(
        "SELECT staff_code FROM domestic_staff WHERE tenant_id = ? FOR UPDATE",
        [tenantId]
      ) as any[];

      let maxSeq = 0;
      for (const row of seqRows) {
        const code = row.staff_code;
        if (code && code.startsWith("DS-")) {
          const num = parseInt(code.substring(3), 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
      const nextSeq = maxSeq + 1;
      const staffCode = `DS-${String(nextSeq).padStart(5, "0")}`;

      const id = crypto.randomUUID();

      await connection.query(
        `INSERT INTO domestic_staff (
          id, tenant_id, resident_id, staff_code, name, phone, staff_type, valid_from, valid_until,
          allowed_days, entry_start_time, entry_end_time, vehicle_plate, notes, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
        [
          id,
          tenantId,
          residentId,
          staffCode,
          data.name.trim(),
          data.phone || null,
          data.staffType,
          data.validFrom,
          data.validUntil,
          data.allowedDays,
          data.entryStartTime || null,
          data.entryEndTime || null,
          data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : null,
          data.notes || null,
          userId,
        ]
      );

      await connection.commit();

      return {
        id,
        staffCode,
        name: data.name,
        staffType: data.staffType,
        residentId,
        tenantId,
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  });

export const updateDomesticStaffFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1, "Staff name is required"),
      phone: z.string().optional().nullable(),
      staffType: z.enum(["maid", "driver", "gardener", "cook", "nanny", "other"]),
      validFrom: z.string().min(1, "Valid from date is required"),
      validUntil: z.string().min(1, "Valid until date is required"),
      allowedDays: z.string().min(1, "Allowed days are required"),
      entryStartTime: z.string().optional().nullable(),
      entryEndTime: z.string().optional().nullable(),
      vehiclePlate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      isActive: z.boolean(),
    })
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, roles, userId } = await requirePermission(request, "visitor", "edit");
    const isSecurityOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["security_head", "guard", "society_admin"]);

    const db = getDb();

    // Verify staff exists and belongs to active tenant
    const [staffRows] = await db.query(
      "SELECT tenant_id, resident_id FROM domestic_staff WHERE id = ?",
      [data.id]
    ) as any[];
    if (staffRows.length === 0) {
      throw new Error("Domestic staff record not found.");
    }
    const staff = staffRows[0];

    if (staff.tenant_id !== tenantId) {
      throw new Error("Forbidden — Access denied to this staff record.");
    }

    if (!isSecurityOrAdmin) {
      // Resident: check ownership of this record
      const [resRows] = await db.query(
        "SELECT id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?) AND tenant_id = ? AND is_current = TRUE",
        [userId, tenantId]
      ) as any[];
      if (resRows.length === 0 || resRows[0].id !== staff.resident_id) {
        throw new Error("Forbidden — You can only edit your own domestic staff.");
      }
    }

    await db.query(
      `UPDATE domestic_staff 
       SET name = ?, phone = ?, staff_type = ?, valid_from = ?, valid_until = ?,
           allowed_days = ?, entry_start_time = ?, entry_end_time = ?,
           vehicle_plate = ?, notes = ?, is_active = ?
       WHERE id = ?`,
      [
        data.name.trim(),
        data.phone || null,
        data.staffType,
        data.validFrom,
        data.validUntil,
        data.allowedDays,
        data.entryStartTime || null,
        data.entryEndTime || null,
        data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : null,
        data.notes || null,
        data.isActive,
        data.id,
      ]
    );

    return { success: true };
  });

export type StaffVerificationResult = {
  status: "authorized" | "inactive" | "expired" | "not_allowed_today" | "outside_time" | "not_found";
  message: string;
  staff: {
    id: string;
    staffCode: string;
    name: string;
    staffType: string;
    phone: string | null;
    unitNumber: string;
    residentName: string;
    vehiclePlate: string | null;
    notes: string | null;
  } | null;
};

export const verifyDomesticStaffFn = createServerFn({ method: "POST" })
  .validator(z.object({ query: z.string().min(1, "Search query is required") }))
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "gate", "view");

    const db = getDb();
    
    // Search by exact phone, exact vehicle plate, exact id, or like name
    const searchQuery = data.query.trim();
    const [rows] = await db.query(
      `SELECT ds.*, p.full_name AS resident_name, u.unit_number, u.id AS unit_id
       FROM domestic_staff ds
       JOIN residents r ON r.id = ds.resident_id
       JOIN persons p ON p.id = r.person_id
       JOIN units u ON u.id = r.unit_id
       WHERE ds.tenant_id = ? AND (ds.staff_code = ? OR ds.phone = ? OR ds.name LIKE ? OR ds.id = ? OR ds.vehicle_plate = ?)
       LIMIT 1`,
      [tenantId, searchQuery, searchQuery, `%${searchQuery}%`, searchQuery, searchQuery]
    ) as any[];

    if (rows.length === 0) {
      return {
        status: "not_found",
        message: "❌ No domestic staff member found matching your query.",
        staff: null,
      } satisfies StaffVerificationResult;
    }

    const s = rows[0];
    const staffData = {
      id: s.id,
      staffCode: s.staff_code,
      name: s.name,
      staffType: s.staff_type,
      phone: s.phone ?? null,
      unitNumber: s.unit_number,
      residentName: s.resident_name,
      vehiclePlate: s.vehicle_plate ?? null,
      notes: s.notes ?? null,
    };

    // Check 1: Active status
    if (!s.is_active) {
      return {
        status: "inactive",
        message: "❌ Access Denied: Staff authorization has been deactivated by the resident.",
        staff: staffData,
      } satisfies StaffVerificationResult;
    }

    // Check 2: Validity dates
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD local format
    const validFrom = toISO(s.valid_from).split(" ")[0];
    const validUntil = toISO(s.valid_until).split(" ")[0];
    if (todayStr < validFrom || todayStr > validUntil) {
      return {
        status: "expired",
        message: `❌ Access Denied: Authorization expired on ${validUntil} (valid from ${validFrom}).`,
        staff: staffData,
      } satisfies StaffVerificationResult;
    }

    // Check 3: Allowed days
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = daysMap[new Date().getDay()];
    const allowedDays = s.allowed_days.split(",");
    if (!allowedDays.includes(currentDay)) {
      return {
        status: "not_allowed_today",
        message: `❌ Access Denied: Not authorized to enter today (${currentDay}). Allowed: ${s.allowed_days}.`,
        staff: staffData,
      } satisfies StaffVerificationResult;
    }

    // Check 4: Time window
    if (s.entry_start_time && s.entry_end_time) {
      const now = new Date();
      const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      
      const [sh, sm, ss] = s.entry_start_time.split(":").map(Number);
      const startSeconds = sh * 3600 + sm * 60 + (ss || 0);

      const [eh, em, es] = s.entry_end_time.split(":").map(Number);
      const endSeconds = eh * 3600 + em * 60 + (es || 0);

      if (currentSeconds < startSeconds || currentSeconds > endSeconds) {
        return {
          status: "outside_time",
          message: `❌ Access Denied: Outside allowed entry hours (${s.entry_start_time.slice(0, 5)} - ${s.entry_end_time.slice(0, 5)}).`,
          staff: staffData,
        } satisfies StaffVerificationResult;
      }
    }

    return {
      status: "authorized",
      message: "✅ Authorized: Access granted.",
      staff: staffData,
    } satisfies StaffVerificationResult;
  });

export const recordStaffMovementFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      staffId: z.string(),
      direction: z.enum(["in", "out"]),
      vehiclePlate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "gate", "create");

    const db = getDb();

    // Verify staff exists and belongs to active tenant
    const [staffRows] = await db.query(
      `SELECT ds.name, ds.staff_type, ds.vehicle_plate, r.unit_id, p.user_id 
       FROM domestic_staff ds
       JOIN residents r ON r.id = ds.resident_id
       JOIN persons p ON p.id = r.person_id
       WHERE ds.id = ? AND ds.tenant_id = ?`,
      [data.staffId, tenantId]
    ) as any[];

    if (staffRows.length === 0) {
      throw new Error("Staff member not found or access denied.");
    }

    const s = staffRows[0];
    const plate = data.vehiclePlate ? data.vehiclePlate.trim().toUpperCase() : s.vehicle_plate;

    const logId = crypto.randomUUID();
    await db.query(
      `INSERT INTO entry_exit_log (id, tenant_id, domestic_staff_id, visitor_name, vehicle_plate, direction, unit_id, verified_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        tenantId,
        data.staffId,
        s.name,
        plate || null,
        data.direction,
        s.unit_id,
        userId,
        data.notes || null,
      ]
    );

    // Notify resident of domestic staff movement
    if (s.user_id) {
      try {
        if (data.direction === "in") {
          await createNotification({
            userId: s.user_id,
            tenantId,
            type: NOTIFICATION_TYPES.DOMESTIC_STAFF_CHECKIN,
            title: "Domestic Staff Check-In",
            message: `${s.name} (${s.staff_type}) checked in at the gate.`,
            data: { staffId: data.staffId, staffName: s.name, direction: "in" },
          });
        } else {
          await createNotification({
            userId: s.user_id,
            tenantId,
            type: NOTIFICATION_TYPES.DOMESTIC_STAFF_CHECKOUT,
            title: "Domestic Staff Check-Out",
            message: `${s.name} has checked out.`,
            data: { staffId: data.staffId, staffName: s.name, direction: "out" },
          });
        }
      } catch (notifErr) {
        console.error("[StaffNotification] Failed to send movement alert:", notifErr);
      }
    }

    return { success: true };
  });
