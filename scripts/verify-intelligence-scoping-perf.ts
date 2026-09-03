import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

import { getDb, initDb } from "../src/lib/db.server";
import { getTenantScoping } from "../src/lib/api/auth-helper";

async function runVerification() {
  console.log("==================================================");
  console.log("⚡ VERIFYING INTELLIGENCE SCOPING & PERFORMANCE");
  console.log("==================================================\n");

  await initDb();
  const db = getDb();

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `- ${details}` : ""}`);
      failed++;
    }
  }

  const socA = "soc-perf-a-" + crypto.randomUUID().slice(0, 8);
  const socB = "soc-perf-b-" + crypto.randomUUID().slice(0, 8);

  const superAdminId = crypto.randomUUID();
  const adminAId = crypto.randomUUID();
  const adminBId = crypto.randomUUID();

  const superToken = "sess-super-" + crypto.randomUUID().slice(0, 12);
  const adminAToken = "sess-admin-a-" + crypto.randomUUID().slice(0, 12);
  const adminBToken = "sess-admin-b-" + crypto.randomUUID().slice(0, 12);

  try {
    // 1. Create two separate societies
    await db.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, address, contact_email, code)
       VALUES (?, 'Alpha Heights', ?, 'professional', 'Asia/Karachi', 'PKR', 'Alpha Sector', 'alpha@perf.local', 'ALPH')`,
      [socA, socA],
    );
    await db.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, address, contact_email, code)
       VALUES (?, 'Beta Towers', ?, 'professional', 'Asia/Karachi', 'PKR', 'Beta Sector', 'beta@perf.local', 'BETA')`,
      [socB, socB],
    );

    // 2. Create users & roles
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'super@perf.local', 'hash')", [superAdminId]);
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'adminA@perf.local', 'hash')", [adminAId]);
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'adminB@perf.local', 'hash')", [adminBId]);

    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')", [crypto.randomUUID(), superAdminId]);
    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [crypto.randomUUID(), adminAId]);
    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [crypto.randomUUID(), adminBId]);

    // Create active sessions for cookie authentication
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [superToken, superAdminId, futureExpiry]);
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [adminAToken, adminAId, futureExpiry]);
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [adminBToken, adminBId, futureExpiry]);

    // Society Admin A assigned ONLY to socA; Society Admin B assigned ONLY to socB
    await db.query(
      "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
      [crypto.randomUUID(), adminAId, socA],
    );
    await db.query(
      "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
      [crypto.randomUUID(), adminBId, socB],
    );

    // 3. Create Society A distinct data
    const assetAId = crypto.randomUUID();
    await db.query(
      `INSERT INTO assets (id, tenant_id, name, category, status, purchase_date)
       VALUES (?, ?, 'Alpha Diesel Generator', 'generator', 'active', '2025-01-01')`,
      [assetAId, socA],
    );
    await db.query(
      `INSERT INTO maintenance_work_orders (id, tenant_id, asset_id, title, description, status, priority, cost)
       VALUES (?, ?, ?, 'Fix Alpha Generator Belt', 'Belt worn out and making noise', 'completed', 'high', 15000)`,
      [crypto.randomUUID(), socA, assetAId],
    );

    await db.query(
      `INSERT INTO complaints (id, tenant_id, title, description, category, priority, status, is_duplicate)
       VALUES (?, ?, 'Water leakage in Alpha Basement', 'Main pipe leaking', 'plumbing', 'high', 'open', 0)`,
      [crypto.randomUUID(), socA],
    );

    const vendorAId = crypto.randomUUID();
    await db.query(
      `INSERT INTO vendors (id, tenant_id, name, category, contact_person, email, phone)
       VALUES (?, ?, 'Alpha Electric Co', 'electrical', 'Tariq', 'tariq@alpha.local', '03001111111')`,
      [vendorAId, socA],
    );
    await db.query(
      `INSERT INTO vendor_invoices (id, tenant_id, vendor_id, invoice_number, invoice_date, due_date, amount, status)
       VALUES (?, ?, ?, 'INV-A-101', '2026-09-01', '2026-09-15', 50000, 'pending')`,
      [crypto.randomUUID(), socA, vendorAId],
    );

    // 4. Create Society B distinct data
    const assetBId = crypto.randomUUID();
    await db.query(
      `INSERT INTO assets (id, tenant_id, name, category, status, purchase_date)
       VALUES (?, ?, 'Beta Passenger Lift', 'lift', 'active', '2025-06-01')`,
      [assetBId, socB],
    );
    await db.query(
      `INSERT INTO maintenance_work_orders (id, tenant_id, asset_id, title, description, status, priority, cost)
       VALUES (?, ?, ?, 'Beta Lift Cabin Cable Replacement', 'Elevator cable snapping risk', 'completed', 'critical', 45000)`,
      [crypto.randomUUID(), socB, assetBId],
    );

    await db.query(
      `INSERT INTO complaints (id, tenant_id, title, description, category, priority, status, is_duplicate)
       VALUES (?, ?, 'Beta Lift Stuck on Floor 5', 'Passenger alarm triggered', 'lift', 'critical', 'open', 1)`,
      [crypto.randomUUID(), socB],
    );

    const vendorBId = crypto.randomUUID();
    await db.query(
      `INSERT INTO vendors (id, tenant_id, name, category, contact_person, email, phone)
       VALUES (?, ?, 'Beta Elevator Experts', 'lift', 'Rashid', 'rashid@beta.local', '03002222222')`,
      [vendorBId, socB],
    );
    await db.query(
      `INSERT INTO vendor_invoices (id, tenant_id, vendor_id, invoice_number, invoice_date, due_date, amount, status)
       VALUES (?, ?, ?, 'INV-B-201', '2026-09-01', '2026-09-15', 90000, 'pending')`,
      [crypto.randomUUID(), socB, vendorBId],
    );

    // Helper to create Request object with cookie
    const makeReq = (token: string, selectedTenantId?: string) => {
      const headers = new Headers();
      let cookieStr = `session_token=${token}`;
      if (selectedTenantId) {
        cookieStr += `; selected_tenant_id=${selectedTenantId}`;
      }
      headers.set("cookie", cookieStr);
      return new Request("http://localhost:5173", { headers });
    };

    // -------------------------------------------------------------
    // TEST A & B & C: Super Admin Tenant Resolution
    // -------------------------------------------------------------
    console.log("--- PART 1: Secure Tenant Scoping & Resolution ---");

    const reqSuperA = makeReq(superToken, socA);
    const scopeSuperA = await getTenantScoping(reqSuperA, socA);
    assert(
      "TEST A: Super Admin selecting Society A resolves strictly to Society A",
      scopeSuperA.tenantId === socA && scopeSuperA.isSuperAdmin === true,
      `Resolved: ${scopeSuperA.tenantId}`,
    );

    const reqSuperB = makeReq(superToken, socB);
    const scopeSuperB = await getTenantScoping(reqSuperB, socB);
    assert(
      "TEST B: Super Admin selecting Society B resolves strictly to Society B",
      scopeSuperB.tenantId === socB && scopeSuperB.isSuperAdmin === true,
      `Resolved: ${scopeSuperB.tenantId}`,
    );

    assert(
      "TEST C: Switching A -> B switches resolved tenant completely (A != B)",
      scopeSuperA.tenantId !== scopeSuperB.tenantId,
    );

    // -------------------------------------------------------------
    // TEST D & E: Society Admin Authorization & Cross-Tenant Rejection
    // -------------------------------------------------------------
    console.log("\n--- PART 2: Society Admin Authorization & Isolation ---");

    const reqAdminA = makeReq(adminAToken, socA);
    const scopeAdminA = await getTenantScoping(reqAdminA, socA);
    assert(
      "TEST D: Society Admin A assigned to Society A resolves successfully",
      scopeAdminA.tenantId === socA,
    );

    // Admin B attempting to access Society A
    const reqAdminBOnA = makeReq(adminBToken, socA);
    let crossTenantBlocked = false;
    try {
      const scopeAdminB = await getTenantScoping(reqAdminBOnA, socA);
      if (scopeAdminB.tenantId !== socA) crossTenantBlocked = true;
    } catch {
      crossTenantBlocked = true;
    }
    assert(
      "TEST E: Society Admin B is strictly rejected from accessing Society A (No cross-tenant leak)",
      crossTenantBlocked === true,
    );

    // -------------------------------------------------------------
    // TEST F & G: AI Maintenance Scoped Queries
    // -------------------------------------------------------------
    console.log("\n--- PART 3: AI Maintenance Scoped Queries ---");

    const [assetsA] = (await db.query(
      "SELECT id, name FROM assets WHERE tenant_id = ? AND status != 'scrapped'",
      [scopeSuperA.tenantId],
    )) as any[];

    const [assetsB] = (await db.query(
      "SELECT id, name FROM assets WHERE tenant_id = ? AND status != 'scrapped'",
      [scopeSuperB.tenantId],
    )) as any[];

    assert(
      "TEST F: Society A query returns only Society A assets ('Alpha Diesel Generator')",
      assetsA.length === 1 && assetsA[0].name === "Alpha Diesel Generator",
    );

    assert(
      "TEST G: Society B query returns only Society B assets ('Beta Passenger Lift')",
      assetsB.length === 1 && assetsB[0].name === "Beta Passenger Lift",
    );

    // -------------------------------------------------------------
    // TEST H & I: AI Complaints & Finance Scoped Queries
    // -------------------------------------------------------------
    console.log("\n--- PART 4: AI Complaints & Finance Scoped Queries ---");

    const [complaintsA] = (await db.query(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(is_duplicate), 0) as dupCnt FROM complaints WHERE tenant_id = ?",
      [scopeSuperA.tenantId],
    )) as any[];

    const [complaintsB] = (await db.query(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(is_duplicate), 0) as dupCnt FROM complaints WHERE tenant_id = ?",
      [scopeSuperB.tenantId],
    )) as any[];

    assert(
      "TEST H: Complaints are strictly isolated (A: 0 duplicates, B: 1 duplicate)",
      Number(complaintsA[0].dupCnt) === 0 && Number(complaintsB[0].dupCnt) === 1,
    );

    const [invoicesA] = (await db.query(
      "SELECT amount FROM vendor_invoices WHERE tenant_id = ?",
      [scopeSuperA.tenantId],
    )) as any[];

    const [invoicesB] = (await db.query(
      "SELECT amount FROM vendor_invoices WHERE tenant_id = ?",
      [scopeSuperB.tenantId],
    )) as any[];

    assert(
      "TEST I: Financial invoices strictly isolated (A: ₨50,000, B: ₨90,000)",
      Number(invoicesA[0]?.amount) === 50000 && Number(invoicesB[0]?.amount) === 90000,
    );

    // -------------------------------------------------------------
    // TEST J & K: Performance Snapshot Caching & Composite Indexes
    // -------------------------------------------------------------
    console.log("\n--- PART 5: Performance Verification ---");

    // 1. Snapshot persistence in ai_maintenance_analyses
    const snapId = crypto.randomUUID();
    const fakeSnapshot = {
      overallHealthScore: 82,
      summary: "Alpha society maintenance baseline verified",
    };
    await db.query(
      `INSERT INTO ai_maintenance_analyses (id, tenant_id, analysis_type, result_data, created_by)
       VALUES (?, ?, 'full_insights', ?, ?)`,
      [snapId, socA, JSON.stringify(fakeSnapshot), superAdminId],
    );

    const startRead = Date.now();
    const [cached] = (await db.query(
      `SELECT result_data FROM ai_maintenance_analyses
       WHERE tenant_id = ? AND analysis_type = 'full_insights'
       ORDER BY created_at DESC LIMIT 1`,
      [socA],
    )) as any[];
    const readDuration = Date.now() - startRead;

    assert(
      "TEST J: Snapshot load is sub-15ms for instant page rendering",
      cached.length > 0 && readDuration < 15,
      `Duration: ${readDuration}ms`,
    );

    // 2. Check composite indexes exist
    const [indexes] = (await db.query(
      `SELECT DISTINCT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints'`,
    )) as any[];
    const indexNames = indexes.map((i: any) => i.INDEX_NAME);

    assert(
      "TEST K: Composite index 'idx_comp_tenant_status' exists on complaints",
      indexNames.includes("idx_comp_tenant_status"),
    );

    assert(
      "TEST L: Composite index 'idx_comp_tenant_flags' exists on complaints",
      indexNames.includes("idx_comp_tenant_flags"),
    );
  } finally {
    // Clean up test data
    await db.query("DELETE FROM ai_maintenance_analyses WHERE tenant_id IN (?, ?)", [socA, socB]);
    await db.query("DELETE FROM maintenance_work_orders WHERE tenant_id IN (?, ?)", [socA, socB]);
    await db.query("DELETE FROM assets WHERE tenant_id IN (?, ?)", [socA, socB]);
    await db.query("DELETE FROM complaints WHERE tenant_id IN (?, ?)", [socA, socB]);
    await db.query("DELETE FROM vendor_invoices WHERE tenant_id IN (?, ?)", [socA, socB]);
    await db.query("DELETE FROM vendors WHERE tenant_id IN (?, ?)", [socA, socB]);
    await db.query("DELETE FROM sessions WHERE id IN (?, ?, ?)", [superToken, adminAToken, adminBToken]);
    await db.query("DELETE FROM society_admin_tenants WHERE user_id IN (?, ?)", [adminAId, adminBId]);
    await db.query("DELETE FROM user_roles WHERE user_id IN (?, ?, ?)", [superAdminId, adminAId, adminBId]);
    await db.query("DELETE FROM users WHERE id IN (?, ?, ?)", [superAdminId, adminAId, adminBId]);
    await db.query("DELETE FROM tenants WHERE id IN (?, ?)", [socA, socB]);
  }

  console.log("\n==================================================");
  console.log(`SCOPING & PERFORMANCE VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
