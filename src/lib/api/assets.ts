import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";


export const getAssetsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) return [];

  const db = getDb();
  const [rows] = (await db.query("SELECT * FROM assets WHERE tenant_id = ? ORDER BY name", [
    tenantId,
  ])) as any[];
  return rows;
});

export const createAssetFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      location: z.string().optional(),
      serialNumber: z.string().optional(),
      warrantyExpiresAt: z.string().optional(),
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
      "INSERT INTO assets (id, tenant_id, name, location, serial_number, warranty_expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        tenantId,
        data.name,
        data.location || null,
        data.serialNumber || null,
        data.warrantyExpiresAt || null,
      ],
    );
    return { id };
  });
