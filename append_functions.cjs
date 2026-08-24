const fs = require('fs');
const content = fs.readFileSync('src/lib/api/property.ts', 'utf8');
const newFunctions = `

// ── Update society ─────────────────────────────────────────────────────────
export const updateSocietyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      address: z.string().optional(),
      city: z.string().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE societies SET name = ?, address = ?, city = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.address || null, data.city || null, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete society ─────────────────────────────────────────────────────────
export const deleteSocietyFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [blocks] = await db.query("SELECT id FROM blocks WHERE society_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (blocks.length > 0) {
      throw new Error("Cannot delete society because it contains blocks. Please delete or move them first.");
    }
    
    await db.query("DELETE FROM societies WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });

// ── Update block ───────────────────────────────────────────────────────────
export const updateBlockFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE blocks SET name = ?, description = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.description || null, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete block ───────────────────────────────────────────────────────────
export const deleteBlockFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [buildings] = await db.query("SELECT id FROM buildings WHERE block_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (buildings.length > 0) {
      throw new Error("Cannot delete block because it contains buildings. Please delete or move them first.");
    }
    const [units] = await db.query("SELECT id FROM units WHERE block_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (units.length > 0) {
      throw new Error("Cannot delete block because it contains units. Please delete or move them first.");
    }
    
    await db.query("DELETE FROM blocks WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });

// ── Update building ────────────────────────────────────────────────────────
export const updateBuildingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      floorsCount: z.number().int().min(1).optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE buildings SET name = ?, floors_count = ? WHERE id = ? AND tenant_id = ?",
      [data.name, data.floorsCount ?? 1, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete building ────────────────────────────────────────────────────────
export const deleteBuildingFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [units] = await db.query("SELECT id FROM units WHERE building_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (units.length > 0) {
      throw new Error("Cannot delete building because it contains units. Please delete or move them first.");
    }
    
    await db.query("DELETE FROM buildings WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });

// ── Update unit ────────────────────────────────────────────────────────────
export const updateUnitFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      unitNumber: z.string().min(1),
      unitType: z.enum(["flat", "villa", "shop", "office", "penthouse", "other"]).optional(),
      areaSqft: z.number().optional(),
      bedrooms: z.number().int().optional(),
    })
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    await db.query(
      "UPDATE units SET unit_number = ?, unit_type = ?, area_sqft = ?, bedrooms = ? WHERE id = ? AND tenant_id = ?",
      [data.unitNumber, data.unitType || "flat", data.areaSqft || null, data.bedrooms || null, data.id, tenantId]
    );
    return { success: true };
  });

// ── Delete unit ────────────────────────────────────────────────────────────
export const deleteUnitFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");
    const db = getDb();
    
    const [units] = await db.query("SELECT status FROM units WHERE id = ? AND tenant_id = ?", [data.id, tenantId]) as any[];
    if (units.length > 0 && units[0].status === "occupied") {
      throw new Error("Cannot delete unit because it is currently occupied. Please vacate it first.");
    }
    
    const [residents] = await db.query("SELECT id FROM residents WHERE unit_id = ? AND tenant_id = ? LIMIT 1", [data.id, tenantId]) as any[];
    if (residents.length > 0) {
      throw new Error("Cannot delete unit because it has resident records associated with it.");
    }
    
    await db.query("DELETE FROM units WHERE id = ? AND tenant_id = ?", [data.id, tenantId]);
    return { success: true };
  });
`;
fs.writeFileSync('src/lib/api/property.ts', content + newFunctions);
console.log('Appended successfully');
