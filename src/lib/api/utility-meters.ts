import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


// ─── METER RATES ───────────────────────────────────────────────────────────

export const getMeterRatesFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

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
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

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
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) return [];

    const db = getDb();
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
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();

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
      const headName = `${data.meterType.charAt(0).toUpperCase() + data.meterType.slice(1)} Bill`;
      await db.query(
        `INSERT INTO ledger_entries (id, tenant_id, unit_id, entry_type, head_name, amount, balance, due_date, notes)
         VALUES (?, ?, ?, 'charge', ?, ?, ?, ?, ?)`,
        [
          ledgerEntryId,
          tenantId,
          data.unitId,
          headName,
          chargedAmount,
          chargedAmount,
          data.readingDate,
          `${data.meterType} consumption: ${consumption.toFixed(2)} units @ ₨${rate}/unit`,
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

export const getUnitsForMetersFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query(
    `SELECT u.id, u.unit_number, b.name AS block_name
       FROM units u
       LEFT JOIN blocks b ON b.id = u.block_id
       WHERE u.tenant_id = ?
       ORDER BY b.name, u.unit_number`,
    [tenantId],
  )) as any[];
  return rows;
});
