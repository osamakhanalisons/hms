import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId, getUserRoles, isAdminRole, hasAnyRole } from "./auth-helper";
import { requirePermission } from "./permissions";


// ─── METER RATES ───────────────────────────────────────────────────────────

export const getMeterRatesFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const { tenantId } = await requirePermission(request, "utility_meters", "view");

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT * FROM meter_rates WHERE tenant_id = ? ORDER BY meter_type, effective_from DESC",
    [tenantId],
  )) as any[];
  return rows;
});

export const upsertMeterRateFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      meterType: z.enum(["electricity", "gas", "water"]),
      ratePerUnit: z.number().positive(),
      effectiveFrom: z.string(),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId } = await requirePermission(request, "utility_meters", "create");

    const db = getDb();
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, effective_from)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rate_per_unit = VALUES(rate_per_unit)`,
      [id, tenantId, data.meterType, data.ratePerUnit, data.effectiveFrom],
    );
    return { id };
  });


// ─── METER READINGS ────────────────────────────────────────────────────────

export const getMeterReadingsFn = createServerFn({ method: "GET" })
  .validator(
    z.object({ unitId: z.string().optional(), meterType: z.string().optional() }).optional(),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, roles, userId } = await requirePermission(request, "utility_meters", "view");
    const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["finance_head", "maintenance_head", "society_admin"]);

    const db = getDb();

    // Get resident's unit IDs
    const [residentUnits] = await db.query(
      "SELECT unit_id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?) AND tenant_id = ?",
      [userId, tenantId]
    ) as any[];
    const unitIds = residentUnits.map((ru: any) => ru.unit_id);

    if (!isStaffOrAdmin) {
      if (data?.unitId) {
        if (!unitIds.includes(data.unitId)) {
          throw new Error("Forbidden — You do not have access to this unit's meter readings");
        }
      } else {
        if (unitIds.length === 0) return [];
      }
    }

    let query = `
      SELECT mr.*, u.unit_number, b.name AS block_name
      FROM meter_readings mr
      JOIN units u ON u.id = mr.unit_id
      LEFT JOIN blocks b ON b.id = u.block_id
      WHERE mr.tenant_id = ?
    `;
    const params: any[] = [tenantId];
    if (data?.unitId) {
      query += " AND mr.unit_id = ?";
      params.push(data.unitId);
    } else if (!isStaffOrAdmin) {
      query += " AND mr.unit_id IN (?)";
      params.push(unitIds);
    }
    if (data?.meterType) {
      query += " AND mr.meter_type = ?";
      params.push(data.meterType);
    }
    query += " ORDER BY mr.reading_date DESC, mr.created_at DESC LIMIT 200";

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });

export const recordMeterReadingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      unitId: z.string(),
      meterType: z.enum(["electricity", "gas", "water"]),
      readingDate: z.string(),
      currentReading: z.number().nonnegative(),
      createLedgerEntry: z.boolean().optional().default(true),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const { tenantId, userId } = await requirePermission(request, "utility_meters", "create");

    const db = getDb();

    // Verify unit belongs to tenant
    const [[unitCheck]] = (await db.query("SELECT id FROM units WHERE id = ? AND tenant_id = ?", [
      data.unitId,
      tenantId,
    ])) as any[];
    if (!unitCheck) throw new Error("Forbidden — Unit not found or unauthorized");

    // Get previous reading for this unit + type
    const [prevRows] = (await db.query(
      `SELECT current_reading FROM meter_readings
       WHERE tenant_id = ? AND unit_id = ? AND meter_type = ?
       ORDER BY reading_date DESC LIMIT 1`,
      [tenantId, data.unitId, data.meterType],
    )) as any[];
    const previousReading = prevRows.length > 0 ? Number(prevRows[0].current_reading) : 0;
    const consumption = Math.max(0, data.currentReading - previousReading);

    // Get applicable rate
    const [rateRows] = (await db.query(
      `SELECT rate_per_unit FROM meter_rates
       WHERE tenant_id = ? AND meter_type = ? AND effective_from <= ?
       ORDER BY effective_from DESC LIMIT 1`,
      [tenantId, data.meterType, data.readingDate],
    )) as any[];
    const rate = rateRows.length > 0 ? Number(rateRows[0].rate_per_unit) : 0;
    const chargedAmount = consumption * rate;

    const readingId = crypto.randomUUID();
    let ledgerEntryId: string | null = null;

    // Auto-create ledger entry if rate is configured
    if (data.createLedgerEntry && chargedAmount > 0) {
      ledgerEntryId = crypto.randomUUID();
      const description = `${data.meterType.charAt(0).toUpperCase() + data.meterType.slice(1)} Bill - ${consumption.toFixed(2)} units @ ₨${rate}/unit`;
      
      // Get current balance
      const [[balanceRow]] = (await db.query(
        `SELECT COALESCE(SUM(CASE WHEN type IN ('charge', 'adjustment') THEN amount WHEN type = 'payment' THEN -amount ELSE 0 END), 0) as current_balance
         FROM ledger_entries WHERE tenant_id = ? AND unit_id = ?`,
        [tenantId, data.unitId],
      )) as any[];
      const balanceAfter = Number(balanceRow?.current_balance || 0) + chargedAmount;
      
      await db.query(
        `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, amount, description, billing_period, balance_after, created_by)
         VALUES (?, ?, ?, 'charge', ?, ?, ?, ?, ?)`,
        [
          ledgerEntryId,
          tenantId,
          data.unitId,
          chargedAmount,
          description,
          data.readingDate.substring(0, 7), // YYYY-MM format
          balanceAfter,
          userId,
        ],
      );
    }

    await db.query(
      `INSERT INTO meter_readings
         (id, tenant_id, unit_id, meter_type, reading_date, current_reading, previous_reading, charged_amount, ledger_entry_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        readingId,
        tenantId,
        data.unitId,
        data.meterType,
        data.readingDate,
        data.currentReading,
        previousReading,
        chargedAmount || null,
        ledgerEntryId,
        userId,
      ],
    );

    return { id: readingId, previousReading, consumption, chargedAmount };
  });

// ─── UNIT LIST (for selector) ──────────────────────────────────────────────

export const getUnitsForMetersFn = createServerFn({ method: "GET" }).handler(async (ctx: any) => {
  const { request } = ctx;
  const { tenantId, roles, userId } = await requirePermission(request, "utility_meters", "view");
  const isStaffOrAdmin = isAdminRole(roles) || hasAnyRole(roles, ["finance_head", "maintenance_head", "society_admin"]);

  const db = getDb();
  let query = `
    SELECT u.id, u.unit_number, b.name AS block_name
    FROM units u
    LEFT JOIN blocks b ON b.id = u.block_id
    WHERE u.tenant_id = ?
  `;
  const params: any[] = [tenantId];
  if (!isStaffOrAdmin) {
    query += " AND u.id IN (SELECT unit_id FROM residents WHERE person_id IN (SELECT id FROM persons WHERE user_id = ?))";
    params.push(userId);
  }
  query += " ORDER BY b.name, u.unit_number";

  const [rows] = (await db.query(query, params)) as any[];
  return rows;
});
