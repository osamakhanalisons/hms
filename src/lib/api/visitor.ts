import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole, getTenantScoping } from "./auth-helper";
import { requirePermission } from "./permissions";

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

    // Visitor Passes Query
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
    vpQuery += ` ORDER BY vp.expected_at DESC`;

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
    logsQuery += " ORDER BY eel.timestamp DESC LIMIT 150";

    const [logRows] = (await db.query(logsQuery, logsParams)) as any[];

    const entryExitLogs: EntryExitLogItem[] = logRows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      visitorPassId: r.visitor_pass_id ?? null,
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
         ORDER BY bl.created_at DESC`,
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

    // Units List for Pre-registration
    let unitsQuery = `
      SELECT u.id, u.unit_number, p.full_name AS resident_name,
             CONCAT_WS(' › ', s.name, bl.name, b.name, CONCAT('Unit ', u.unit_number)) AS full_path
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
    unitsQuery += " ORDER BY s.name, bl.name, b.name, u.unit_number ASC";

    const [unitRows] = (await db.query(unitsQuery, unitsParams)) as any[];

    return {
      summary: {
        totalPasses: Number(passSum?.total_passes ?? 0),
        activePasses: Number(passSum?.active_passes ?? 0),
        todayCheckedIn: Number(logSum?.in_today ?? 0),
        todayCheckedOut: Number(logSum?.out_today ?? 0),
        blacklistedCount: blCount,
      },
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
