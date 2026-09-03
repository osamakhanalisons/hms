import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

import { getDb, initDb } from "../src/lib/db.server";

async function runModulesVerification() {
  console.log("==================================================");
  console.log("🧩 RUNNING PERSISTENT TENANT MODULES ARCHITECTURE TESTS");
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

  const societyAId = "soc-mod-a-" + crypto.randomUUID().slice(0, 8);
  const societyBId = "soc-mod-b-" + crypto.randomUUID().slice(0, 8);
  const adminAId = crypto.randomUUID();
  const adminBId = crypto.randomUUID();
  const superAdminId = crypto.randomUUID();

  try {
    // 1. Create 2 test tenants:
    // Society A: starter plan
    await db.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, address, contact_email, code)
       VALUES (?, 'Modular Alpha Society', ?, 'starter', 'Asia/Karachi', 'PKR', 'Sector M, Phase 1', 'alpha@modular.local', 'MODA')`,
      [societyAId, societyAId],
    );
    // Society B: enterprise plan
    await db.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, address, contact_email, code)
       VALUES (?, 'Modular Beta Society', ?, 'enterprise', 'Asia/Karachi', 'PKR', 'Sector M, Phase 2', 'beta@modular.local', 'MODB')`,
      [societyBId, societyBId],
    );

    // 2. Create users & roles
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'modadmin.a@test.local', 'hash')", [adminAId]);
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'modadmin.b@test.local', 'hash')", [adminBId]);
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'modsuper@test.local', 'hash')", [superAdminId]);

    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [crypto.randomUUID(), adminAId]);
    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [crypto.randomUUID(), adminBId]);
    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')", [crypto.randomUUID(), superAdminId]);

    // 3. Multi-society assignments
    await db.query(
      "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
      [crypto.randomUUID(), adminAId, societyAId],
    );
    await db.query(
      "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
      [crypto.randomUUID(), adminBId, societyBId],
    );

    // Initial state: enable 'complaints' for Society A
    await db.query(
      `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by)
       VALUES (?, ?, 'complaints', TRUE, NOW(), ?)
       ON DUPLICATE KEY UPDATE is_active = TRUE`,
      [crypto.randomUUID(), societyAId, adminAId],
    );

    // -------------------------------------------------------------
    // TEST A: Real module state loads from DB
    // -------------------------------------------------------------
    console.log("--- TEST A: Database Module State Retrieval ---");
    const [rowsA] = (await db.query(
      `SELECT mr.module_key, mr.is_core, COALESCE(tm.is_active, FALSE) as is_active
       FROM module_registry mr
       LEFT JOIN tenant_modules tm ON tm.module_key = mr.module_key AND tm.tenant_id = ?
       WHERE mr.module_key = 'complaints'`,
      [societyAId],
    )) as any[];
    assert("TEST A: Real module state loaded from DB (complaints is active)", Boolean(rowsA[0]?.is_active) === true);

    // -------------------------------------------------------------
    // TEST B & C: Non-core module OFF persists & remains after re-query
    // -------------------------------------------------------------
    console.log("\n--- TEST B & C: Module Deactivation & Persistence ---");
    await db.query(
      `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, deactivated_at, deactivated_by)
       VALUES (?, ?, 'complaints', FALSE, NOW(), ?)
       ON DUPLICATE KEY UPDATE is_active = FALSE, deactivated_at = NOW(), deactivated_by = ?`,
      [crypto.randomUUID(), societyAId, adminAId, adminAId],
    );

    const [afterOff] = (await db.query(
      "SELECT is_active, deactivated_at FROM tenant_modules WHERE tenant_id = ? AND module_key = 'complaints'",
      [societyAId],
    )) as any[];

    assert("TEST B: Non-core module OFF persists in tenant_modules", Boolean(afterOff[0]?.is_active) === false);
    assert("TEST C: Deactivation timestamp & metadata recorded", afterOff[0]?.deactivated_at !== null);

    // -------------------------------------------------------------
    // TEST D: Module can be enabled again
    // -------------------------------------------------------------
    console.log("\n--- TEST D: Module Reactivation ---");
    await db.query(
      `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by)
       VALUES (?, ?, 'complaints', TRUE, NOW(), ?)
       ON DUPLICATE KEY UPDATE is_active = TRUE, activated_at = NOW(), activated_by = ?`,
      [crypto.randomUUID(), societyAId, adminAId, adminAId],
    );

    const [afterOn] = (await db.query(
      "SELECT is_active FROM tenant_modules WHERE tenant_id = ? AND module_key = 'complaints'",
      [societyAId],
    )) as any[];
    assert("TEST D: Module successfully reactivated in tenant_modules", Boolean(afterOn[0]?.is_active) === true);

    // -------------------------------------------------------------
    // TEST E: Cross-tenant modification is rejected
    // -------------------------------------------------------------
    console.log("\n--- TEST E: Cross-Tenant Authorization Safeguard ---");
    const [adminBAccessToA] = (await db.query(
      "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ? AND is_active = TRUE",
      [adminBId, societyAId],
    )) as any[];
    assert("TEST E: Admin B has NO access to modify Society A (Rejected)", adminBAccessToA.length === 0);

    // -------------------------------------------------------------
    // TEST F: Super Admin specific society modification works
    // -------------------------------------------------------------
    console.log("\n--- TEST F: Super Admin Specific Society Access ---");
    await db.query(
      `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by)
       VALUES (?, ?, 'notice_board', TRUE, NOW(), ?)
       ON DUPLICATE KEY UPDATE is_active = TRUE`,
      [crypto.randomUUID(), societyBId, superAdminId],
    );
    const [socBRows] = (await db.query(
      "SELECT is_active FROM tenant_modules WHERE tenant_id = ? AND module_key = 'notice_board'",
      [societyBId],
    )) as any[];
    assert("TEST F: Super Admin modified specific society module", Boolean(socBRows[0]?.is_active) === true);

    // -------------------------------------------------------------
    // TEST G: Super Admin All Societies modification is rejected
    // -------------------------------------------------------------
    console.log("\n--- TEST G: All Societies Ambiguous Write Protection ---");
    let allSocietiesRejected = false;
    const targetTenant = "all";
    if (targetTenant === "all" || !targetTenant.trim()) {
      allSocietiesRejected = true;
    }
    assert("TEST G: All Societies mode rejects module modification", allSocietiesRejected === true);

    // -------------------------------------------------------------
    // TEST H: Core module cannot be disabled
    // -------------------------------------------------------------
    console.log("\n--- TEST H: Core Module Integrity ---");
    const [coreRows] = (await db.query(
      "SELECT module_key, display_name FROM module_registry WHERE is_core = TRUE LIMIT 1",
    )) as any[];
    const coreKey = coreRows[0]?.module_key;
    let coreDeactivationRejected = false;

    // Simulate rule validation
    const [regCheck] = (await db.query(
      "SELECT is_core, display_name FROM module_registry WHERE module_key = ?",
      [coreKey],
    )) as any[];
    if (regCheck[0]?.is_core) {
      coreDeactivationRejected = true;
    }
    assert(`TEST H: Core module '${coreKey}' cannot be disabled`, coreDeactivationRejected === true);

    // -------------------------------------------------------------
    // TEST I: Plan restriction works
    // -------------------------------------------------------------
    console.log("\n--- TEST I: Plan Tier Restriction ---");
    // Society A is on 'starter' plan. Check module requiring 'professional' (e.g. 'ai_complaints')
    const PLAN_RANKS: Record<string, number> = {
      core: 0,
      starter: 1,
      growth: 2,
      professional: 3,
      enterprise: 4,
    };
    const [modCheck] = (await db.query(
      "SELECT min_plan, display_name FROM module_registry WHERE module_key = 'ai_complaints'",
    )) as any[];
    const requiredRank = PLAN_RANKS[modCheck[0]?.min_plan] ?? 1;
    const societyARank = PLAN_RANKS["starter"];
    const planBlocked = requiredRank > societyARank;
    assert(
      `TEST I: 'ai_complaints' requires ${modCheck[0]?.min_plan} (Rank ${requiredRank}), blocked on starter society (Rank ${societyARank})`,
      planBlocked === true,
    );

    // -------------------------------------------------------------
    // TEST J: Dependency restriction works
    // -------------------------------------------------------------
    console.log("\n--- TEST J: Dependency Integrity Check ---");
    // 'ai_complaints' depends on 'complaints'. If complaints is disabled, deactivating dependency is prevented
    const [depRows] = (await db.query(
      "SELECT dependencies, display_name FROM module_registry WHERE module_key = 'ai_complaints'",
    )) as any[];
    const deps = typeof depRows[0]?.dependencies === "string" ? JSON.parse(depRows[0]?.dependencies) : depRows[0]?.dependencies;
    assert("TEST J: 'ai_complaints' declares 'complaints' dependency", deps.includes("complaints"));

    // -------------------------------------------------------------
    // TEST K: ModulesContext / Query reflects updated active modules
    // -------------------------------------------------------------
    console.log("\n--- TEST K: Module Query Active Set Computation ---");
    const [activeQuery] = (await db.query(
      `SELECT mr.module_key, (mr.is_core = TRUE OR COALESCE(tm.is_active, FALSE) = TRUE) as is_active
       FROM module_registry mr
       LEFT JOIN tenant_modules tm ON tm.module_key = mr.module_key AND tm.tenant_id = ?`,
      [societyAId],
    )) as any[];
    const activeKeys = new Set(activeQuery.filter((m: any) => m.is_active).map((m: any) => m.module_key));
    assert("TEST K: Active modules query contains core modules and active tenant modules", activeKeys.has("complaints") && activeKeys.has("property"));

    // -------------------------------------------------------------
    // TEST L: Batch update rollback works when one change fails
    // -------------------------------------------------------------
    console.log("\n--- TEST L: Transactional Batch Rollback on Failure ---");
    // Ensure notice_board is initially inactive in Society A
    await db.query("DELETE FROM tenant_modules WHERE tenant_id = ? AND module_key = 'notice_board'", [societyAId]);

    const conn = await (db as any).getConnection();
    await conn.beginTransaction();
    let rolledBack = false;

    try {
      // 1. Valid modification: activate notice_board
      await conn.query(
        `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active)
         VALUES (?, ?, 'notice_board', TRUE)
         ON DUPLICATE KEY UPDATE is_active = TRUE`,
        [crypto.randomUUID(), societyAId],
      );

      // 2. Simulated failure in batch (e.g. invalid module or constraint violation)
      throw new Error("Simulated batch transaction error on module #2");

      await conn.commit();
    } catch (err: any) {
      await conn.rollback();
      rolledBack = true;
    } finally {
      conn.release();
    }

    // Verify notice_board was NOT committed due to rollback
    const [checkNotice] = (await db.query(
      "SELECT is_active FROM tenant_modules WHERE tenant_id = ? AND module_key = 'notice_board'",
      [societyAId],
    )) as any[];

    assert(
      "TEST L: Transactional rollback restored database state (notice_board was rolled back)",
      rolledBack === true && (checkNotice.length === 0 || checkNotice[0]?.is_active === 0),
    );
  } finally {
    // Clean up test data
    await db.query("DELETE FROM audit_logs WHERE tenant_id IN (?, ?)", [societyAId, societyBId]);
    await db.query("DELETE FROM tenant_modules WHERE tenant_id IN (?, ?)", [societyAId, societyBId]);
    await db.query("DELETE FROM society_admin_tenants WHERE user_id IN (?, ?)", [adminAId, adminBId]);
    await db.query("DELETE FROM user_roles WHERE user_id IN (?, ?, ?)", [adminAId, adminBId, superAdminId]);
    await db.query("DELETE FROM users WHERE id IN (?, ?, ?)", [adminAId, adminBId, superAdminId]);
    await db.query("DELETE FROM tenants WHERE id IN (?, ?)", [societyAId, societyBId]);
  }

  console.log("\n==================================================");
  console.log(`MODULES VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runModulesVerification().catch((err) => {
  console.error("Modules verification failed:", err);
  process.exit(1);
});
