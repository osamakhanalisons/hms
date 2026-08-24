/**
 * DEMO DATA ONLY — sample housing society data for application demonstration.
 * This is NOT an official registry of Askari housing societies.
 * Society names are based on publicly referenced Askari communities in Pakistan
 * (Lahore, Karachi, Rawalpindi). All resident names, CNICs, phone numbers,
 * emails, payment references, and security data are entirely fictional.
 *
 * Usage:
 *   npm run seed:demo           → reset then seed
 *   npm run seed:demo:reset     → reset (delete demo data) only
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ─── PASSWORD HELPER ─────────────────────────────────────────────────────────
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// ─── DETERMINISTIC DEMO TENANT & SOCIETY IDs ─────────────────────────────────
// These are fixed UUIDs used as anchors for all cleanup operations.
// All demo data is either scoped by tenant_id or by @demo.housingos.local email.

const DEMO_TENANTS = [
  {
    id: "de011000-0011-0000-0000-000000000011",
    societyId: "de011000-0011-0000-0000-000000000001",
    name: "Askari 11 Lahore Demo",
    slug: "askari-11-lahore-demo",
    code: "ASK11-LHR",
    city: "Lahore",
    address: "Bedian Road, Sector C, Askari 11, Lahore",
    contactEmail: "admin.ask11@demo.housingos.local",
    contactPhone: "+92 42 35741111",
    plan: "enterprise" as const,
    layout: "apartments_heavy" as const,
  },
  {
    id: "de010000-0010-0000-0000-000000000010",
    societyId: "de010000-0010-0000-0000-000000000002",
    name: "Askari 10 Lahore Demo",
    slug: "askari-10-lahore-demo",
    code: "ASK10-LHR",
    city: "Lahore",
    address: "Amjad Chaudhry Road, Askari 10, Lahore",
    contactEmail: "admin.ask10@demo.housingos.local",
    contactPhone: "+92 42 35741010",
    plan: "professional" as const,
    layout: "apartments_only" as const,
  },
  {
    id: "de005000-0005-0000-0000-000000000005",
    societyId: "de005000-0005-0000-0000-000000000003",
    name: "Askari 5 Karachi Demo",
    slug: "askari-5-karachi-demo",
    code: "ASK5-KHI",
    city: "Karachi",
    address: "Malir Cantonment, Askari 5, Karachi",
    contactEmail: "admin.ask5@demo.housingos.local",
    contactPhone: "+92 21 34960505",
    plan: "enterprise" as const,
    layout: "mixed" as const,
  },
  {
    id: "de004000-0004-0000-0000-000000000004",
    societyId: "de004000-0004-0000-0000-000000000004",
    name: "Askari 4 Karachi Demo",
    slug: "askari-4-karachi-demo",
    code: "ASK4-KHI",
    city: "Karachi",
    address: "Rashid Minhas Road, Karachi Cantonment, Karachi",
    contactEmail: "admin.ask4@demo.housingos.local",
    contactPhone: "+92 21 34960404",
    plan: "growth" as const,
    layout: "apartments_only" as const,
  },
  {
    id: "de009000-0009-0000-0000-000000000009",
    societyId: "de009000-0009-0000-0000-000000000005",
    name: "Askari Rawalpindi Demo",
    slug: "askari-rawalpindi-demo",
    code: "ASKRP-RWP",
    city: "Rawalpindi",
    address: "Chaklala Cantonment, Rawalpindi",
    contactEmail: "admin.askrp@demo.housingos.local",
    contactPhone: "+92 51 5599001",
    plan: "growth" as const,
    layout: "houses_heavy" as const,
  },
] as const;

const DEMO_TENANT_IDS = DEMO_TENANTS.map((t) => t.id);

// ─── FICTIONAL RESIDENT NAMES (demo only) ────────────────────────────────────
const DEMO_NAMES = [
  "Muhammad Tariq",   "Ayesha Siddiqui", "Usman Farooq",   "Sara Baig",
  "Ahmed Nawaz",      "Fatima Malik",    "Hassan Raza",    "Zainab Sheikh",
  "Bilal Chaudhry",   "Maria Butt",      "Hamza Iqbal",    "Sana Khan",
  "Faisal Mehmood",   "Nadia Hussain",   "Imran Sohail",   "Rukhsana Gul",
  "Asif Qureshi",     "Mehwish Hafeez",  "Kamran Ashraf",  "Seema Jabeen",
  "Naveed Anwar",     "Amna Riaz",       "Shahid Latif",   "Rabia Noor",
  "Junaid Khalil",    "Hina Rehman",     "Zeeshan Ahmad",  "Sadia Akhtar",
  "Waqas Mirza",      "Tayyaba Syed",
];

// ─── MODULES TO ENABLE PER TENANT ────────────────────────────────────────────
const DEMO_MODULES = [
  "platform", "property", "residents", "notifications", "documents", "reports",
  "ledger", "payments", "financial_transparency", "budget",
  "complaints", "maintenance", "inventory", "vendors", "assets",
  "visitor", "gate", "parking",
  "notice_board", "community_forum", "polls", "events", "amenities", "governance",
  "utility_meters",
];

// ─── DEMO ADMIN USER DETERMINISTIC IDs ───────────────────────────────────────
const SUPER_ADMIN_ID = "de900000-0000-0000-0000-000000000000";
const ADMIN_ALPHA_ID = "de900000-0000-0000-0000-000000000001"; // Askari 11 & 10
const ADMIN_BETA_ID  = "de900000-0000-0000-0000-000000000002"; // Askari 5
const ADMIN_GAMMA_ID = "de900000-0000-0000-0000-000000000003"; // Askari 4 & Rawalpindi

// ─── DB CONNECTION ────────────────────────────────────────────────────────────
async function connectDb() {
  // Load .env manually for script context
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim().replace(/^export\s+/, "");
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
          }
        }
      }
    }
  } catch (_) {}

  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "at_bms";

  console.log(`[CONN] ${host}:${port} / ${database}`);
  return mysql.createConnection({ host, port, user, password, database });
}

// ─── PHASE 1: AUDIT ──────────────────────────────────────────────────────────
async function auditDemoData(conn: mysql.Connection): Promise<Record<string, number>> {
  console.log("\n=== PHASE 1: DEMO DATA AUDIT ===");
  const counts: Record<string, number> = {};

  const auditQueries: [string, string][] = [
    ["tenants",        `SELECT COUNT(*) as n FROM tenants WHERE id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["users",          `SELECT COUNT(*) as n FROM users WHERE email LIKE '%@demo.housingos.local'`],
    ["societies",      `SELECT COUNT(*) as n FROM societies WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["residents",      `SELECT COUNT(*) as n FROM residents WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["units",          `SELECT COUNT(*) as n FROM units WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["ledger_entries", `SELECT COUNT(*) as n FROM ledger_entries WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["payments",       `SELECT COUNT(*) as n FROM payments WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["complaints",     `SELECT COUNT(*) as n FROM complaints WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["visitor_passes", `SELECT COUNT(*) as n FROM visitor_passes WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["domestic_staff", `SELECT COUNT(*) as n FROM domestic_staff WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["assets",         `SELECT COUNT(*) as n FROM assets WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["polls",          `SELECT COUNT(*) as n FROM polls WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["events",         `SELECT COUNT(*) as n FROM events WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["amenities",      `SELECT COUNT(*) as n FROM amenities WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["notices",        `SELECT COUNT(*) as n FROM notices WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["forum_threads",  `SELECT COUNT(*) as n FROM forum_threads WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
  ];

  for (const [label, query] of auditQueries) {
    const params = label === "users" ? [] : DEMO_TENANT_IDS;
    const [rows] = await conn.query(query, params) as any[];
    counts[label] = rows[0].n;
    console.log(`  ${label.padEnd(18)}: ${counts[label]}`);
  }

  // Non-demo counts
  const [allT] = await conn.query("SELECT COUNT(*) as n FROM tenants") as any[];
  const [allU] = await conn.query("SELECT COUNT(*) as n FROM users") as any[];
  const nonDemoTenants = allT[0].n - (counts["tenants"] || 0);
  const nonDemoUsers = allU[0].n - (counts["users"] || 0);
  console.log(`\n  Non-demo tenants preserved: ${nonDemoTenants}`);
  console.log(`  Non-demo users preserved:   ${nonDemoUsers}`);

  return counts;
}

// ─── PHASE 2: SAFE RESET ─────────────────────────────────────────────────────
async function performReset(conn: mysql.Connection): Promise<void> {
  console.log("\n=== PHASE 2: SAFE DEMO DATA RESET ===");
  console.log("[RESET] Deleting only records anchored to demo tenant IDs or demo emails...");

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  // Deletion order: most dependent first → tenants last
  const tenantScopedTables = [
    "amenity_bookings", "event_rsvps", "poll_votes",
    "forum_replies", "forum_threads",
    "notice_reads", "notices",
    "governance_resolutions", "governance_meetings",
    "entry_exit_log", "visitor_blacklist", "visitor_passes", "domestic_staff",
    "maintenance_work_orders", "maintenance_schedules", "assets",
    "project_expenses", "project_milestones", "projects",
    "stock_movements", "inventory_items",
    "vendor_invoices", "purchase_orders", "quotations", "rfqs", "vendors",
    "meter_readings", "meter_rates",
    "parking_allocations", "parking_slots",
    "payments", "ledger_entries", "wallets", "charge_heads",
    "complaint_comments", "complaint_history", "complaints",
    "sla_configs",
    "resident_vehicles", "residents", "persons",
    "units", "floors", "buildings", "blocks",
    "custom_roles", "role_permissions", "tenant_modules",
    "society_admin_tenants",
    "budget_line_items", "budgets",
    "documents", "notifications", "form_submissions",
    "guard_patrols", "gate_terminals", "blacklist",
    "audit_logs",
    "societies",
  ];

  for (const table of tenantScopedTables) {
    const [res] = await conn.query(
      `DELETE FROM \`${table}\` WHERE tenant_id IN (?)`,
      [DEMO_TENANT_IDS]
    ).catch(() => [{ affectedRows: 0 }]) as any[];
    if (res?.affectedRows > 0) {
      console.log(`  [DEL] ${table}: ${res.affectedRows} rows`);
    }
  }

  // Delete demo users (by email domain) and their cascaded profiles/roles/sessions
  const [demoUserIds] = await conn.query(
    "SELECT id FROM users WHERE email LIKE '%@demo.housingos.local'"
  ).catch(() => [[]]) as any[];

  if (demoUserIds.length > 0) {
    const ids = demoUserIds.map((r: any) => r.id);
    await conn.query("DELETE FROM society_admin_tenants WHERE user_id IN (?)", [ids]).catch(() => {});
    await conn.query("DELETE FROM user_roles WHERE user_id IN (?)", [ids]).catch(() => {});
    await conn.query("DELETE FROM profiles WHERE id IN (?)", [ids]).catch(() => {});
    await conn.query("DELETE FROM sessions WHERE user_id IN (?)", [ids]).catch(() => {});
    await conn.query("DELETE FROM users WHERE id IN (?)", [ids]).catch(() => {});
    console.log(`  [DEL] users + profiles + roles + sessions: ${ids.length} users`);
  }

  // Delete demo tenants last
  await conn.query("DELETE FROM tenants WHERE id IN (?)", [DEMO_TENANT_IDS]).catch(() => {});
  console.log(`  [DEL] tenants: ${DEMO_TENANT_IDS.length} records`);

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("[RESET] ✅ Reset complete.");
}

// ─── PHASE 3: VERIFY CLEAN STATE ─────────────────────────────────────────────
async function verifyCleanState(conn: mysql.Connection): Promise<boolean> {
  console.log("\n=== PHASE 3: VERIFY CLEAN STATE ===");
  let pass = true;

  const checks: [string, string][] = [
    ["demo tenants",   `SELECT COUNT(*) as n FROM tenants WHERE id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["demo users",     `SELECT COUNT(*) as n FROM users WHERE email LIKE '%@demo.housingos.local'`],
    ["demo residents", `SELECT COUNT(*) as n FROM residents WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["demo units",     `SELECT COUNT(*) as n FROM units WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["demo ledger",    `SELECT COUNT(*) as n FROM ledger_entries WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["demo payments",  `SELECT COUNT(*) as n FROM payments WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["demo visitors",  `SELECT COUNT(*) as n FROM visitor_passes WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
    ["demo staff",     `SELECT COUNT(*) as n FROM domestic_staff WHERE tenant_id IN (${DEMO_TENANT_IDS.map(() => "?").join(",")})`],
  ];

  for (const [label, query] of checks) {
    const params = label === "demo users" ? [] : DEMO_TENANT_IDS;
    const [rows] = await conn.query(query, params) as any[];
    const n = rows[0].n;
    const ok = n === 0;
    if (!ok) pass = false;
    console.log(`  ${label.padEnd(18)}: ${n} ${ok ? "✅" : "❌ FAILED"}`);
  }

  // Verify non-demo data not deleted
  const [allT] = await conn.query("SELECT COUNT(*) as n FROM tenants") as any[];
  console.log(`  Non-demo tenants still exist: ${allT[0].n} ✅`);

  if (pass) {
    console.log("\n  ✅ DEMO CLEANUP: PASS — safe to reseed");
  } else {
    console.log("\n  ❌ DEMO CLEANUP: FAILED — aborting reseed");
  }
  return pass;
}

// ─── PHASE 5+: SEED ──────────────────────────────────────────────────────────
async function seedAll(conn: mysql.Connection): Promise<void> {
  const pwHash = hashPassword("Demo@12345");
  const bp = "2026-08"; // billing period

  // Running receipt counter (must stay globally unique across all societies)
  let receiptSeq = 10000;
  function nextReceipt(code: string): string {
    return `REC-DEMO-${code}-${String(++receiptSeq).padStart(4, "0")}`;
  }

  // ── Step 1: Create Tenants (before any FK references) ──────────────────────
  console.log("\n[SEED] Creating tenants...");
  for (const t of DEMO_TENANTS) {
    await conn.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, date_format,
        contact_email, contact_phone, address, code)
       VALUES (?, ?, ?, ?, 'Asia/Karachi', 'PKR', 'DD/MM/YYYY', ?, ?, ?, ?)`,
      [t.id, t.name, t.slug, t.plan, t.contactEmail, t.contactPhone, t.address, t.code]
    );
  }

  // ── Step 2: Super Admin ─────────────────────────────────────────────────────
  console.log("[SEED] Creating Super Admin...");
  await conn.query(
    "INSERT INTO users (id, email, password_hash) VALUES (?, 'superadmin@demo.housingos.local', ?)",
    [SUPER_ADMIN_ID, pwHash]
  );
  await conn.query(
    "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Demo Super Admin', 'HousingOS Platform', '+92 300 0000000', NULL)",
    [SUPER_ADMIN_ID]
  );
  await conn.query(
    "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')",
    [crypto.randomUUID(), SUPER_ADMIN_ID]
  );

  // ── Step 3: Society Admins ──────────────────────────────────────────────────
  console.log("[SEED] Creating Society Admins...");
  const admins = [
    { id: ADMIN_ALPHA_ID, email: "admin.alpha@demo.housingos.local", name: "Admin Alpha", tenants: [DEMO_TENANTS[0].id, DEMO_TENANTS[1].id] },
    { id: ADMIN_BETA_ID,  email: "admin.beta@demo.housingos.local",  name: "Admin Beta",  tenants: [DEMO_TENANTS[2].id] },
    { id: ADMIN_GAMMA_ID, email: "admin.gamma@demo.housingos.local", name: "Admin Gamma", tenants: [DEMO_TENANTS[3].id, DEMO_TENANTS[4].id] },
  ];

  for (const admin of admins) {
    await conn.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [admin.id, admin.email, pwHash]
    );
    await conn.query(
      "INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, ?, ?)",
      [admin.id, admin.name, admin.tenants[0]]
    );
    await conn.query(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')",
      [crypto.randomUUID(), admin.id]
    );
    for (const tid of admin.tenants) {
      await conn.query(
        "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
        [crypto.randomUUID(), admin.id, tid]
      );
    }
  }

  // ── Step 4: Enable Modules per tenant ──────────────────────────────────────
  console.log("[SEED] Activating modules...");
  for (const t of DEMO_TENANTS) {
    for (const mod of DEMO_MODULES) {
      await conn.query(
        `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_by)
         VALUES (?, ?, ?, TRUE, ?)`,
        [crypto.randomUUID(), t.id, mod, SUPER_ADMIN_ID]
      ).catch(() => {}); // ignore duplicates
    }
  }

  // ── Step 5: Loop over each society ─────────────────────────────────────────
  for (const tenant of DEMO_TENANTS) {
    console.log(`\n[SEED] ▶ ${tenant.name}`);
    await seedSociety(conn, tenant, pwHash, bp, nextReceipt);
  }
}

// ─── PER-SOCIETY SEEDER ───────────────────────────────────────────────────────
async function seedSociety(
  conn: mysql.Connection,
  tenant: typeof DEMO_TENANTS[number],
  pwHash: string,
  bp: string,
  nextReceipt: (code: string) => string
) {
  const tid = tenant.id;
  const code = tenant.code;
  const slugShort = tenant.slug.replace(/-demo$/, "").replace(/[^a-z0-9]/g, "-");

  // ── 5.1 Society record ──────────────────────────────────────────────────────
  await conn.query(
    "INSERT INTO societies (id, tenant_id, name, address, city) VALUES (?, ?, ?, ?, ?)",
    [tenant.societyId, tid, tenant.name, tenant.address, tenant.city]
  );

  // ── 5.2 Staff users (guard, technician, finance, security head, maintenance head) ───
  type StaffUser = { id: string; email: string; name: string; role: string };
  const staffUsers: StaffUser[] = [];

  const staffRoles = [
    { key: "guard",       role: "guard",       name: "Security Guard" },
    { key: "technician",  role: "technician",  name: "Maintenance Tech" },
    { key: "finance",     role: "finance_head", name: "Finance Officer" },
    { key: "security",    role: "security_head", name: "Security Head" },
    { key: "maintenance", role: "maintenance_head", name: "Maintenance Head" },
  ];

  for (const sr of staffRoles) {
    const uid = crypto.randomUUID();
    const email = `${sr.key}.${slugShort}@demo.housingos.local`;
    await conn.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [uid, email, pwHash]
    );
    await conn.query(
      "INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, ?, ?)",
      [uid, `${sr.name} (${tenant.code})`, tid]
    );
    await conn.query(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
      [crypto.randomUUID(), uid, sr.role]
    );
    staffUsers.push({ id: uid, email, name: sr.name, role: sr.role });
  }

  const guardUser    = staffUsers.find(s => s.role === "guard")!;
  const techUser     = staffUsers.find(s => s.role === "technician")!;
  const financeUser  = staffUsers.find(s => s.role === "finance_head")!;

  // ── 5.3 Property structure ──────────────────────────────────────────────────
  // We build blocks → buildings → floors → units  (apartments)
  // and  standalone houses/villas (no building/floor)

  type UnitInfo = { id: string; num: string; type: string; blockId?: string; buildingId?: string; floorId?: string };
  const units: UnitInfo[] = [];

  // Apartment structure: 2 Blocks × 1 Building × 3 Floors × 3 Apts = 18 apts
  const blockNames = ["Block A", "Block B"];
  const blockIds: string[] = [];

  for (let bi = 0; bi < blockNames.length; bi++) {
    const blockId = crypto.randomUUID();
    blockIds.push(blockId);
    await conn.query(
      "INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, ?)",
      [blockId, tenant.societyId, tid, blockNames[bi]]
    );

    const buildingId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, ?, ?)",
      [buildingId, blockId, tid, `Building ${blockNames[bi].split(" ")[1]}-1`, 3]
    );

    for (let fl = 1; fl <= 3; fl++) {
      const floorId = crypto.randomUUID();
      await conn.query(
        "INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, ?, ?)",
        [floorId, buildingId, tid, fl, `Floor ${fl}`]
      );

      for (let apt = 1; apt <= 3; apt++) {
        const prefix = blockNames[bi].split(" ")[1]; // A or B
        const unitNum = `${prefix}-${fl}0${apt}`;
        const unitId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO units (id, floor_id, building_id, block_id, society_id, tenant_id,
             unit_number, unit_type, area_sqft, bedrooms, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'flat', ?, ?, 'occupied')`,
          [unitId, floorId, buildingId, blockId, tenant.societyId, tid, unitNum,
           apt === 1 ? 1200 : apt === 2 ? 1450 : 1600, apt === 1 ? 2 : 3]
        );
        units.push({ id: unitId, num: unitNum, type: "flat", blockId, buildingId, floorId });
      }
    }
  }

  // Houses / Villas (layout-dependent)
  const hasHouses = tenant.layout === "apartments_heavy" || tenant.layout === "mixed" || tenant.layout === "houses_heavy";
  if (hasHouses) {
    const houseCount = tenant.layout === "houses_heavy" ? 6 : 3;
    for (let h = 1; h <= houseCount; h++) {
      const unitNum = `H-${String(h).padStart(2, "0")}`;
      const unitId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO units (id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
         VALUES (?, ?, ?, ?, 'house', ?, ?, 'occupied')`,
        [unitId, tenant.societyId, tid, unitNum, 2200 + h * 100, 4]
      );
      units.push({ id: unitId, num: unitNum, type: "house" });
    }
  }

  if (tenant.layout === "mixed" || tenant.layout === "apartments_heavy") {
    for (let v = 1; v <= 2; v++) {
      const unitNum = `V-${String(v).padStart(2, "0")}`;
      const unitId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO units (id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
         VALUES (?, ?, ?, ?, 'villa', ?, ?, 'occupied')`,
        [unitId, tenant.societyId, tid, unitNum, 3500 + v * 200, 5]
      );
      units.push({ id: unitId, num: unitNum, type: "villa" });
    }
  }

  const totalUnits = units.length;
  console.log(`   Units: ${totalUnits} (${units.filter(u => u.type === "flat").length} flats, ${units.filter(u => u.type === "house").length} houses, ${units.filter(u => u.type === "villa").length} villas)`);

  // ── 5.4 Residents ───────────────────────────────────────────────────────────
  type ResidentInfo = { userId: string; personId: string; residentId: string; unitId: string; name: string; idx: number };
  const residents: ResidentInfo[] = [];
  const residentUserIds: string[] = [];

  const residentCount = Math.min(units.length, 15);
  for (let i = 0; i < residentCount; i++) {
    const unit = units[i];
    const nameIdx = (Math.floor(i * 1.7) % DEMO_NAMES.length);
    const resName = DEMO_NAMES[nameIdx];
    const resEmail = `resident.${slugShort}.${String(i + 1).padStart(3, "0")}@demo.housingos.local`;
    const isOwner = i % 3 !== 2; // 2/3 owners, 1/3 tenants

    const userId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [userId, resEmail, pwHash]
    );
    await conn.query(
      "INSERT INTO profiles (id, full_name, phone, tenant_id) VALUES (?, ?, ?, ?)",
      [userId, resName, `+92 300 ${String(3000000 + i * 17).slice(0, 7)}`, tid]
    );
    await conn.query(
      "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'resident')",
      [crypto.randomUUID(), userId]
    );

    const personId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO persons (id, tenant_id, user_id, full_name, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [personId, tid, userId, resName, resEmail, `+92 300 ${String(3000000 + i * 17).slice(0, 7)}`]
    );

    const residentId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO residents (id, person_id, unit_id, tenant_id, type, move_in_date, is_current, invite_status)
       VALUES (?, ?, ?, ?, ?, '2024-01-01', TRUE, 'accepted')`,
      [residentId, personId, unit.id, tid, isOwner ? "owner" : "tenant"]
    );

    residents.push({ userId, personId, residentId, unitId: unit.id, name: resName, idx: i });
    residentUserIds.push(userId);
  }
  console.log(`   Residents: ${residents.length}`);

  // ── 5.5 Vehicles ────────────────────────────────────────────────────────────
  const vehicleModels = [
    { make: "Toyota", model: "Corolla", type: "car" as const, color: "White" },
    { make: "Honda", model: "Civic",    type: "car" as const, color: "Silver" },
    { make: "Toyota", model: "Yaris",   type: "car" as const, color: "Red" },
    { make: "Honda", model: "City",     type: "car" as const, color: "Black" },
    { make: "Suzuki", model: "Cultus",  type: "car" as const, color: "Blue" },
    { make: "Honda", model: "CB125",    type: "motorcycle" as const, color: "Black" },
  ];

  const vehicleIds: string[] = [];
  for (let i = 0; i < residents.length; i++) {
    const vm = vehicleModels[i % vehicleModels.length];
    const plate = `DEMO-${code.replace(/[^A-Z0-9]/g, "")}-${String(i + 1).padStart(3, "0")}`;
    const vId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO resident_vehicles (id, resident_id, tenant_id, vehicle_type, make, model, plate_number, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vId, residents[i].residentId, tid, vm.type, vm.make, vm.model, plate, vm.color]
    );
    vehicleIds.push(vId);
  }

  // ── 5.6 Parking ─────────────────────────────────────────────────────────────
  const parkingSlotIds: string[] = [];
  const totalSlots = Math.min(residents.length + 3, 20);
  for (let p = 1; p <= totalSlots; p++) {
    const slotId = crypto.randomUUID();
    const slotType = p <= residents.length ? "covered" : "open";
    const status = p <= residents.length ? "occupied" : "free";
    await conn.query(
      "INSERT INTO parking_slots (id, tenant_id, label, block, slot_type, status) VALUES (?, ?, ?, ?, ?, ?)",
      [slotId, tid, `P-${String(p).padStart(2, "0")}`, blockIds[0] ? "Block A" : "Main", slotType, status]
    );
    parkingSlotIds.push(slotId);
  }

  // Allocate parking to occupied residents
  for (let i = 0; i < residents.length && i < parkingSlotIds.length; i++) {
    const vehicle = vehicleModels[i % vehicleModels.length];
    const plate = `DEMO-${code.replace(/[^A-Z0-9]/g, "")}-${String(i + 1).padStart(3, "0")}`;
    await conn.query(
      `INSERT INTO parking_allocations (id, tenant_id, slot_id, unit_id, resident_name, vehicle_plate,
         vehicle_type, is_current, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [crypto.randomUUID(), tid, parkingSlotIds[i], residents[i].unitId,
       residents[i].name, plate, vehicle.type, SUPER_ADMIN_ID]
    );
  }

  // ── 5.7 Vendors ─────────────────────────────────────────────────────────────
  const vendorData = [
    { name: "Metro Electrical Services Demo", cat: "electrical" },
    { name: "SafeGuard Security Demo",        cat: "security" },
    { name: "CleanPro Facility Demo",         cat: "cleaning" },
    { name: "LiftCare Engineering Demo",      cat: "lift_maintenance" },
    { name: "WaterWorks Plumbing Demo",       cat: "plumbing" },
  ];
  const vendorIds: string[] = [];
  for (const v of vendorData) {
    const vid = crypto.randomUUID();
    await conn.query(
      "INSERT INTO vendors (id, tenant_id, name, category, email, rating) VALUES (?, ?, ?, ?, ?, ?)",
      [vid, tid, v.name, v.cat, `${v.cat}.vendor@demo.housingos.local`, 4.2]
    );
    vendorIds.push(vid);
  }

  // ── 5.8 Charge Heads ────────────────────────────────────────────────────────
  const chargeHeads = [
    { name: "Monthly Maintenance",  amount: 3500 },
    { name: "Water Charges",        amount: 1500 },
    { name: "Electricity Common",   amount: 2000 },
    { name: "Parking Fee",          amount: 500  },
    { name: "Security Fee",         amount: 1200 },
    { name: "Waste Management",     amount: 300  },
  ];
  const headIds: string[] = [];
  for (const ch of chargeHeads) {
    const hid = crypto.randomUUID();
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, default_amount) VALUES (?, ?, ?, ?)",
      [hid, tid, ch.name, ch.amount]
    );
    headIds.push(hid);
  }

  // ── 5.9 Billing & Payments ──────────────────────────────────────────────────
  const billingPatterns = ["paid", "partial", "unpaid", "overdue"];

  for (let u = 0; u < residents.length; u++) {
    const unit = units[u];
    const pattern = billingPatterns[u % billingPatterns.length];
    let runningBalance = 0;

    // Apply 3-4 charges
    const chargesToApply = headIds.slice(0, u % 2 === 0 ? 4 : 3);
    let totalCharge = 0;
    for (const hid of chargesToApply) {
      const head = chargeHeads[headIds.indexOf(hid)];
      totalCharge += head.amount;
      runningBalance += head.amount;
      await conn.query(
        `INSERT INTO ledger_entries (id, unit_id, tenant_id, type, charge_head_id, amount,
           description, billing_period, balance_after, created_by)
         VALUES (?, ?, ?, 'charge', ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), unit.id, tid, hid, head.amount,
         `${head.name} - ${bp}`, bp, runningBalance, financeUser.id]
      );
    }

    // Apply payment based on pattern
    let paymentAmount = 0;
    if (pattern === "paid") paymentAmount = totalCharge;
    else if (pattern === "partial") paymentAmount = Math.floor(totalCharge * 0.6);
    else if (pattern === "unpaid") paymentAmount = 0;
    else if (pattern === "overdue") paymentAmount = 0; // overdue: charge posted earlier month, no payment

    if (paymentAmount > 0) {
      const methods = ["cash", "bank_transfer", "cheque", "online"];
      const method = methods[u % methods.length];
      const receipt = nextReceipt(code.replace(/[^A-Z0-9]/g, ""));
      const payId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO payments (id, unit_id, tenant_id, amount, payment_method, receipt_number,
           payment_date, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, '2026-08-10', ?, ?)`,
        [payId, unit.id, tid, paymentAmount, method, receipt,
         `${pattern === "partial" ? "Partial p" : "P"}ayment received - ${receipt}`, financeUser.id]
      );
      runningBalance -= paymentAmount;
      await conn.query(
        `INSERT INTO ledger_entries (id, unit_id, tenant_id, type, amount, description,
           billing_period, reference_id, balance_after, created_by)
         VALUES (?, ?, ?, 'payment', ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), unit.id, tid, paymentAmount,
         `Payment received - ${receipt}`, bp, payId, runningBalance, financeUser.id]
      );
    }
  }
  console.log(`   Billing: ${residents.length * 3}+ ledger entries`);

  // ── 5.10 Complaints ─────────────────────────────────────────────────────────
  const complaintData = [
    { title: "Water leakage from roof",   desc: "Roof leaking in heavy rain, seeping into flat A-101.", cat: "plumbing",   pri: "high",   status: "open" },
    { title: "Street light not working",  desc: "The street lamp near Block B entrance is out.",         cat: "electrical", pri: "medium", status: "in_progress" },
    { title: "Elevator not functioning",  desc: "Building A-1 lift is out of service since morning.",   cat: "lift",       pri: "high",   status: "assigned" },
    { title: "Overflowing garbage bin",   desc: "Garbage bin near Block A gate is overflowing.",        cat: "cleaning",   pri: "low",    status: "resolved" },
    { title: "Parking slot occupied",     desc: "My allocated parking slot P-03 occupied by unknown.",  cat: "security",   pri: "medium", status: "open" },
    { title: "Water supply cut in block", desc: "No water supply in Block B since 2 hours.",            cat: "water",      pri: "critical", status: "in_progress" },
    { title: "Intercom not working",      desc: "Intercom at gate not connecting to flat.",              cat: "electrical", pri: "medium", status: "closed" },
  ];

  for (let i = 0; i < Math.min(complaintData.length, residents.length); i++) {
    const cd = complaintData[i];
    const resident = residents[i % residents.length];
    const unit = units[i % units.length];
    await conn.query(
      `INSERT INTO complaints (id, tenant_id, unit_id, submitted_by, assigned_to, category,
         priority, status, title, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), tid, unit.id, resident.userId,
       cd.status !== "open" ? techUser.id : null,
       cd.cat, cd.pri, cd.status, cd.title, cd.desc, resident.userId]
    );
  }
  console.log(`   Complaints: ${Math.min(complaintData.length, residents.length)}`);

  // ── 5.11 Assets ─────────────────────────────────────────────────────────────
  const assetData = [
    { name: "Main Generator 50KVA",   cat: "electrical", loc: "Main Gate Annex" },
    { name: "Water Pump Station",     cat: "plumbing",   loc: "Basement B" },
    { name: "CCTV System (32 cams)",  cat: "security",   loc: "Control Room" },
    { name: "Main Gate Barrier",      cat: "security",   loc: "Main Entry Gate" },
    { name: "Passenger Elevator A-1", cat: "lift",       loc: "Building A-1" },
    { name: "Electrical Panel DB-1",  cat: "electrical", loc: "Ground Floor, Block A" },
    { name: "Fire Suppression System",cat: "safety",     loc: "All Floors" },
  ];
  const assetIds: string[] = [];
  for (const a of assetData) {
    const aid = crypto.randomUUID();
    await conn.query(
      `INSERT INTO assets (id, tenant_id, name, category, location, purchase_date,
         purchase_cost, current_valuation, status)
       VALUES (?, ?, ?, ?, ?, '2022-01-01', ?, ?, 'active')`,
      [aid, tid, a.name, a.cat, a.loc, 150000, 120000]
    );
    assetIds.push(aid);
  }

  // ── 5.12 Maintenance Work Orders ────────────────────────────────────────────
  const woData = [
    { title: "Monthly generator servicing",  status: "completed",   pri: "normal" },
    { title: "CCTV camera lens cleaning",    status: "in_progress", pri: "normal" },
    { title: "Water pump pressure check",    status: "open",        pri: "high" },
    { title: "Gate barrier lubrication",     status: "assigned",    pri: "low" },
    { title: "Elevator annual inspection",   status: "completed",   pri: "high" },
    { title: "Common area light replacement",status: "open",        pri: "normal" },
  ];
  for (let i = 0; i < woData.length; i++) {
    const wo = woData[i];
    await conn.query(
      `INSERT INTO maintenance_work_orders (id, tenant_id, asset_id, title, description,
         status, priority, assigned_technician_id, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), tid, assetIds[i % assetIds.length],
       wo.title, `DEMO: ${wo.title} for ${tenant.name}`,
       wo.status, wo.pri, techUser.id, 5000 + i * 1000]
    );
  }

  // ── 5.13 Inventory ──────────────────────────────────────────────────────────
  const invData = [
    { name: "CCTV Camera Unit",     sku: `INV-${code}-CAM`,   cat: "Electronics",   qty: 10, cost: 8500 },
    { name: "LED Bulb 20W",         sku: `INV-${code}-LED`,   cat: "Electrical",    qty: 100, cost: 150 },
    { name: "Electrical Cable 2.5mm", sku: `INV-${code}-CABLE`, cat: "Electrical",  qty: 500, cost: 45 },
    { name: "Water Valve 1 inch",   sku: `INV-${code}-VALVE`, cat: "Plumbing",      qty: 20, cost: 350 },
    { name: "Cleaning Supplies Kit",sku: `INV-${code}-CLEAN`, cat: "Cleaning",      qty: 30, cost: 1200 },
    { name: "Fire Extinguisher 5kg",sku: `INV-${code}-FIRE`,  cat: "Safety",        qty: 15, cost: 2500 },
  ];
  const invIds: string[] = [];
  for (const inv of invData) {
    const iid = crypto.randomUUID();
    await conn.query(
      `INSERT INTO inventory_items (id, tenant_id, name, sku, category, unit_of_measure,
         quantity, reorder_level, unit_cost)
       VALUES (?, ?, ?, ?, ?, 'pcs', ?, ?, ?)`,
      [iid, tid, inv.name, inv.sku, inv.cat, inv.qty, Math.floor(inv.qty * 0.2), inv.cost]
    );
    invIds.push(iid);
    // Add an 'in' stock movement
    await conn.query(
      "INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, notes, created_by) VALUES (?, ?, ?, 'in', ?, ?, ?)",
      [crypto.randomUUID(), tid, iid, inv.qty, "Initial stock - DEMO", SUPER_ADMIN_ID]
    );
  }

  // ── 5.14 Gate Terminals ─────────────────────────────────────────────────────
  const gateIds: string[] = [];
  const gates = ["Main Entry Gate", "Back Gate"];
  for (const g of gates) {
    const gid = crypto.randomUUID();
    await conn.query(
      "INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, ?, ?, 'active')",
      [gid, tid, g, `${tenant.name} - ${g}`]
    );
    gateIds.push(gid);
  }

  // ── 5.15 Visitors ───────────────────────────────────────────────────────────
  const visitorData = [
    { name: "Delivery Courier", phone: "+92 300 1234567", purpose: "Package delivery",  status: "used" as const },
    { name: "Plumber (External)", phone: "+92 321 9876543", purpose: "Repair work",     status: "active" as const },
    { name: "Family Guest",     phone: "+92 333 5551234", purpose: "Family visit",       status: "expired" as const },
    { name: "Electrician",      phone: "+92 345 4443333", purpose: "Electrical repair",  status: "used" as const },
    { name: "PTCL Technician",  phone: "+92 312 7778888", purpose: "Internet setup",    status: "active" as const },
    { name: "Catering Staff",   phone: "+92 300 9991234", purpose: "Event catering",    status: "used" as const },
  ];

  const visitorPassIds: string[] = [];
  for (let i = 0; i < Math.min(visitorData.length, residents.length); i++) {
    const vd = visitorData[i];
    const passCode = `VP-${code.replace(/[^A-Z0-9]/g, "")}-${String(1000 + i).padStart(4, "0")}`;
    const passId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO visitor_passes (id, tenant_id, resident_id, visitor_name, visitor_phone,
         expected_at, pass_code, status, visitor_type, purpose, pre_registered, created_by)
       VALUES (?, ?, ?, ?, ?, '2026-08-20 10:00:00', ?, ?, 'one_time', ?, TRUE, ?)`,
      [passId, tid, residents[i % residents.length].residentId,
       vd.name, vd.phone, passCode, vd.status, vd.purpose,
       residents[i % residents.length].userId]
    );
    visitorPassIds.push(passId);

    // Entry log
    await conn.query(
      `INSERT INTO entry_exit_log (id, tenant_id, visitor_pass_id, visitor_name, gate_id,
         direction, verified_by, unit_id)
       VALUES (?, ?, ?, ?, ?, 'in', ?, ?)`,
      [crypto.randomUUID(), tid, passId, vd.name, gateIds[0],
       guardUser.id, residents[i % residents.length].unitId]
    );
    if (vd.status === "used") {
      await conn.query(
        `INSERT INTO entry_exit_log (id, tenant_id, visitor_pass_id, visitor_name, gate_id,
           direction, verified_by, unit_id)
         VALUES (?, ?, ?, ?, ?, 'out', ?, ?)`,
        [crypto.randomUUID(), tid, passId, vd.name, gateIds[0],
         guardUser.id, residents[i % residents.length].unitId]
      );
    }
  }
  console.log(`   Visitors: ${Math.min(visitorData.length, residents.length)}`);

  // ── 5.16 Domestic Staff ─────────────────────────────────────────────────────
  const staffData = [
    { name: "Razia Bibi",     type: "maid" as const,     days: "Mon,Tue,Wed,Thu,Fri" },
    { name: "Ghulam Abbas",   type: "gardener" as const,  days: "Mon,Wed,Fri" },
    { name: "Amjad Ali",      type: "driver" as const,    days: "Mon,Tue,Wed,Thu,Fri,Sat" },
    { name: "Fatima Noor",    type: "cook" as const,      days: "Mon,Tue,Wed,Thu,Fri" },
    { name: "Shaheen Begum",  type: "nanny" as const,     days: "Mon,Tue,Wed,Thu,Fri" },
  ];

  for (let i = 0; i < Math.min(staffData.length, residents.length); i++) {
    const sd = staffData[i];
    // Use DB-generated staff_code via trigger or generate sequentially
    const staffCode = `DS-${code.replace(/[^A-Z0-9]/g, "").slice(0, 4)}-${String(i + 1).padStart(5, "0")}`;
    const staffId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO domestic_staff (id, tenant_id, resident_id, name, phone, staff_type,
         valid_from, valid_until, allowed_days, entry_start_time, entry_end_time,
         is_active, created_by, staff_code)
       VALUES (?, ?, ?, ?, ?, ?, '2026-01-01', '2026-12-31', ?, '08:00:00', '18:00:00',
         TRUE, ?, ?)`,
      [staffId, tid, residents[i % residents.length].residentId,
       sd.name, `+92 300 ${String(5000000 + i * 13).slice(0, 7)}`, sd.type,
       sd.days, residents[i % residents.length].userId, staffCode]
    );

    // Staff entry log
    await conn.query(
      `INSERT INTO entry_exit_log (id, tenant_id, domestic_staff_id, visitor_name, gate_id,
         direction, verified_by, unit_id)
       VALUES (?, ?, ?, ?, ?, 'in', ?, ?)`,
      [crypto.randomUUID(), tid, staffId, sd.name, gateIds[0],
       guardUser.id, residents[i % residents.length].unitId]
    );
  }
  console.log(`   Domestic staff: ${Math.min(staffData.length, residents.length)}`);

  // ── 5.17 Polls ──────────────────────────────────────────────────────────────
  const pollData = [
    {
      question: "Should community gym timings be extended to 10 PM?",
      type: "single" as const,
      options: ["Yes, extend to 10 PM", "No, keep current timings", "Extend on weekends only"],
      eligible: "all" as const,
    },
    {
      question: "Which area needs priority maintenance this month?",
      type: "single" as const,
      options: ["Parking area", "Common corridors", "Garden & landscaping", "Boundary wall"],
      eligible: "owners" as const,
    },
  ];

  for (const pd of pollData) {
    const pollId = crypto.randomUUID();
    const closesAt = new Date("2026-09-30T23:59:59");
    const opensAt = new Date("2026-08-01T00:00:00");
    await conn.query(
      `INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at,
         is_anonymous, eligible_voters)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
      [pollId, tid, pd.question, pd.type, JSON.stringify(pd.options),
       opensAt, closesAt, pd.eligible]
    );

    // Add 3 votes from residents
    const votersSeen = new Set<string>();
    for (let i = 0; i < Math.min(3, residents.length); i++) {
      const uid = residents[i].userId;
      if (votersSeen.has(uid)) continue;
      votersSeen.add(uid);
      const choice = pd.options[i % pd.options.length];
      await conn.query(
        `INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), pollId, uid, choice, choice]
      ).catch(() => {}); // skip if duplicate
    }
  }

  // ── 5.18 Events ─────────────────────────────────────────────────────────────
  const eventData = [
    { title: "Annual General Meeting 2026",  venue: "Community Hall", capacity: 200, desc: "DEMO: Annual General Meeting for all residents and owners." },
    { title: "Community Sports Day",         venue: "Sports Ground",  capacity: 150, desc: "DEMO: Annual sports event for families." },
    { title: "Maintenance Awareness Session", venue: "Block A Lobby", capacity: 50,  desc: "DEMO: Maintenance team briefing on new protocols." },
  ];

  for (let i = 0; i < eventData.length; i++) {
    const ed = eventData[i];
    const eventId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO events (id, tenant_id, title, starts_at, ends_at, venue, allow_rsvp, capacity, description)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
      [eventId, tid,
       ed.title,
       new Date(`2026-09-${10 + i * 7} 10:00:00`),
       new Date(`2026-09-${10 + i * 7} 14:00:00`),
       ed.venue, ed.capacity, ed.desc]
    );

    // RSVPs
    for (let j = 0; j < Math.min(3, residents.length); j++) {
      const rsvpStatus = j === 0 ? "yes" : j === 1 ? "yes" : "maybe";
      await conn.query(
        "INSERT INTO event_rsvps (id, event_id, user_id, status, guests_count) VALUES (?, ?, ?, ?, ?)",
        [crypto.randomUUID(), eventId, residents[j].userId, rsvpStatus, j === 0 ? 2 : 1]
      ).catch(() => {});
    }
  }

  // ── 5.19 Amenities ──────────────────────────────────────────────────────────
  const amenityData = [
    { name: "Community Hall",  cat: "hall" as const,  cap: 200, slot: 60,  charge: 5000, open: "08:00:00", close: "22:00:00" },
    { name: "Gymnasium",       cat: "gym" as const,   cap: 30,  slot: 60,  charge: 0,    open: "06:00:00", close: "22:00:00" },
    { name: "Swimming Pool",   cat: "pool" as const,  cap: 50,  slot: 60,  charge: 200,  open: "07:00:00", close: "20:00:00" },
    { name: "Tennis Court",    cat: "court" as const, cap: 8,   slot: 60,  charge: 500,  open: "06:00:00", close: "21:00:00" },
  ];
  const amenityIds: string[] = [];
  for (const am of amenityData) {
    const amid = crypto.randomUUID();
    await conn.query(
      `INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes,
         open_time, close_time, charge_per_slot, refundable_deposit,
         rules, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [amid, tid, am.name, am.cat, am.cap, am.slot,
       am.open, am.close, am.charge, am.charge > 0 ? am.charge * 0.5 : 0,
       `DEMO: Standard ${am.name} usage rules apply. Book in advance.`]
    );
    amenityIds.push(amid);
  }

  // Amenity bookings (non-overlapping)
  if (residents.length >= 2) {
    await conn.query(
      `INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date,
         start_time, end_time, guests_count, purpose, status)
       VALUES (?, ?, ?, ?, '2026-08-25', '10:00:00', '11:00:00', 5, 'Family gathering', 'approved')`,
      [crypto.randomUUID(), tid, amenityIds[0], residents[0].userId]
    ).catch(() => {});

    await conn.query(
      `INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date,
         start_time, end_time, guests_count, purpose, status)
       VALUES (?, ?, ?, ?, '2026-08-26', '07:00:00', '08:00:00', 2, 'Morning swim', 'approved')`,
      [crypto.randomUUID(), tid, amenityIds[2] || amenityIds[0], residents[1].userId]
    ).catch(() => {});
  }

  // ── 5.20 Notices ────────────────────────────────────────────────────────────
  const noticeData = [
    { title: "Water Maintenance Notice",   body: "DEMO: Planned water shutdown on Aug 28 from 10AM to 2PM for pipeline maintenance.", priority: "warning" as const, pinned: false },
    { title: "AGM Invitation 2026",        body: "DEMO: Annual General Meeting scheduled for September 10, 2026 at Community Hall 10AM.", priority: "info" as const, pinned: true },
    { title: "Security Advisory",         body: "DEMO: All residents to ensure vehicles are properly locked at night.", priority: "urgent" as const, pinned: false },
    { title: "Electricity Maintenance",   body: "DEMO: Common area electricity work on Aug 30 from 9AM to 12PM.", priority: "warning" as const, pinned: false },
    { title: "Community Event Notice",    body: "DEMO: Sports Day on September 17 — register with your block representative.", priority: "info" as const, pinned: false },
  ];

  for (const nd of noticeData) {
    await conn.query(
      `INSERT INTO notices (id, tenant_id, author_id, title, body, priority, target_type,
         is_pinned, is_emergency)
       VALUES (?, ?, ?, ?, ?, ?, 'all', ?, ?)`,
      [crypto.randomUUID(), tid, SUPER_ADMIN_ID,
       nd.title, nd.body, nd.priority, nd.pinned, nd.priority === "urgent"]
    );
  }

  // ── 5.21 Forum ──────────────────────────────────────────────────────────────
  if (residents.length >= 2) {
    const threads = [
      { cat: "security",    title: "Improving nighttime gate security", body: "DEMO: Should we increase patrol frequency after midnight?" },
      { cat: "maintenance", title: "Water pressure issue in Block A",   body: "DEMO: Anyone else experiencing low water pressure on upper floors?" },
      { cat: "community",   title: "Organizing a community clean-up",   body: "DEMO: Proposal to organize a monthly community clean-up day." },
    ];

    for (let i = 0; i < threads.length; i++) {
      const th = threads[i];
      const thId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body, allow_comments)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [thId, tid, residents[i % residents.length].userId,
         th.cat, th.title, th.body]
      );
      // Add a reply
      if (residents.length > i + 1) {
        await conn.query(
          "INSERT INTO forum_replies (id, thread_id, author_id, body) VALUES (?, ?, ?, ?)",
          [crypto.randomUUID(), thId, residents[(i + 1) % residents.length].userId,
           `DEMO: Agreed, this is an important issue for ${tenant.name}.`]
        );
      }
    }
  }

  // ── 5.22 Governance ─────────────────────────────────────────────────────────
  const meetingId = crypto.randomUUID();
  await conn.query(
    `INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status, meeting_minutes)
     VALUES (?, ?, ?, ?, '2026-09-10 10:00:00', 'scheduled', NULL)`,
    [meetingId, tid,
     "AGM 2026 — Annual General Meeting",
     `DEMO: Annual General Meeting for ${tenant.name} — agenda: budget review, maintenance plan, new proposals.`]
  );

  await conn.query(
    `INSERT INTO governance_resolutions (id, tenant_id, meeting_id, title, description, status, votes_for, votes_against)
     VALUES (?, ?, ?, ?, ?, 'proposed', 0, 0)`,
    [crypto.randomUUID(), tid, meetingId,
     "Approve 2026-27 Maintenance Budget",
     `DEMO: Resolution to approve the maintenance budget of PKR 2,500,000 for fiscal year 2026-27.`]
  ).catch(() => {});

  // ── 5.23 Budget ─────────────────────────────────────────────────────────────
  const budgetId = crypto.randomUUID();
  await conn.query(
    "INSERT INTO budgets (id, tenant_id, year, title, is_approved) VALUES (?, ?, 2026, ?, FALSE)",
    [budgetId, tid, `DEMO Budget 2026 — ${tenant.name}`]
  );
  const budgetItems = [
    { cat: "Security", amount: 500000 },
    { cat: "Maintenance", amount: 750000 },
    { cat: "Utilities", amount: 300000 },
    { cat: "Landscaping", amount: 150000 },
    { cat: "Administration", amount: 200000 },
  ];
  for (const bi of budgetItems) {
    await conn.query(
      "INSERT INTO budget_line_items (id, budget_id, tenant_id, category, planned_amount) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), budgetId, tid, bi.cat, bi.amount]
    );
  }

  // ── 5.24 Audit Log ──────────────────────────────────────────────────────────
  await conn.query(
    "INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'demo_seed', 'tenant', ?)",
    [crypto.randomUUID(), tid, SUPER_ADMIN_ID, tid]
  );

  console.log(`   ✅ ${tenant.name} seeded.`);
}

// ─── PHASE 29: RELATIONAL INTEGRITY CHECKS ──────────────────────────────────
async function runIntegrityChecks(conn: mysql.Connection): Promise<void> {
  console.log("\n=== PHASE 29: RELATIONAL INTEGRITY CHECKS ===");

  // Check 1: No orphan units
  const [orphanUnits] = await conn.query(
    `SELECT COUNT(*) as n FROM units u
     WHERE u.tenant_id IN (?) AND u.society_id NOT IN (SELECT id FROM societies)`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Orphan units: ${orphanUnits[0].n} ${orphanUnits[0].n === 0 ? "✅" : "❌"}`);

  // Check 2: No orphan residents
  const [orphanRes] = await conn.query(
    `SELECT COUNT(*) as n FROM residents r
     WHERE r.tenant_id IN (?) AND r.unit_id NOT IN (SELECT id FROM units)`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Orphan residents: ${orphanRes[0].n} ${orphanRes[0].n === 0 ? "✅" : "❌"}`);

  // Check 3: No orphan ledger entries
  const [orphanLedger] = await conn.query(
    `SELECT COUNT(*) as n FROM ledger_entries le
     WHERE le.tenant_id IN (?) AND le.unit_id NOT IN (SELECT id FROM units)`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Orphan ledger entries: ${orphanLedger[0].n} ${orphanLedger[0].n === 0 ? "✅" : "❌"}`);

  // Check 4: No orphan payments
  const [orphanPay] = await conn.query(
    `SELECT COUNT(*) as n FROM payments p
     WHERE p.tenant_id IN (?) AND p.unit_id NOT IN (SELECT id FROM units)`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Orphan payments: ${orphanPay[0].n} ${orphanPay[0].n === 0 ? "✅" : "❌"}`);

  // Check 5: No orphan visitor passes
  const [orphanVP] = await conn.query(
    `SELECT COUNT(*) as n FROM visitor_passes vp
     WHERE vp.tenant_id IN (?) AND vp.resident_id NOT IN (SELECT id FROM residents)`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Orphan visitor passes: ${orphanVP[0].n} ${orphanVP[0].n === 0 ? "✅" : "❌"}`);

  // Check 6: No duplicate poll votes
  const [dupVotes] = await conn.query(
    `SELECT COUNT(*) as n FROM (
       SELECT poll_id, user_id, COUNT(*) as c FROM poll_votes
       WHERE poll_id IN (SELECT id FROM polls WHERE tenant_id IN (?))
       GROUP BY poll_id, user_id HAVING c > 1
     ) x`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Duplicate poll votes: ${dupVotes[0].n} ${dupVotes[0].n === 0 ? "✅" : "❌"}`);

  // Check 7: No cross-tenant leakage
  const [crossTenant] = await conn.query(
    `SELECT COUNT(*) as n FROM residents r
     JOIN units u ON r.unit_id = u.id
     WHERE r.tenant_id IN (?) AND u.tenant_id != r.tenant_id`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Cross-tenant resident/unit mismatch: ${crossTenant[0].n} ${crossTenant[0].n === 0 ? "✅" : "❌"}`);

  // Check 8: No orphan domestic staff
  const [orphanStaff] = await conn.query(
    `SELECT COUNT(*) as n FROM domestic_staff ds
     WHERE ds.tenant_id IN (?) AND ds.resident_id NOT IN (SELECT id FROM residents)`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Orphan domestic staff: ${orphanStaff[0].n} ${orphanStaff[0].n === 0 ? "✅" : "❌"}`);

  // Check 9: Staff code uniqueness per tenant
  const [dupStaff] = await conn.query(
    `SELECT COUNT(*) as n FROM (
       SELECT tenant_id, staff_code, COUNT(*) as c FROM domestic_staff
       WHERE tenant_id IN (?) GROUP BY tenant_id, staff_code HAVING c > 1
     ) x`
  , [DEMO_TENANT_IDS]) as any[];
  console.log(`  Duplicate staff codes per tenant: ${dupStaff[0].n} ${dupStaff[0].n === 0 ? "✅" : "❌"}`);
}

// ─── FINAL COUNTS ─────────────────────────────────────────────────────────────
async function printFinalCounts(conn: mysql.Connection): Promise<void> {
  console.log("\n=== FINAL SEEDING COUNTS ===");
  const queries: [string, string][] = [
    ["Tenants",        `SELECT COUNT(*) as n FROM tenants WHERE id IN (?)`],
    ["Societies",      `SELECT COUNT(*) as n FROM societies WHERE tenant_id IN (?)`],
    ["Users (demo)",   `SELECT COUNT(*) as n FROM users WHERE email LIKE '%@demo.housingos.local'`],
    ["Residents",      `SELECT COUNT(*) as n FROM residents WHERE tenant_id IN (?)`],
    ["Units",          `SELECT COUNT(*) as n FROM units WHERE tenant_id IN (?)`],
    ["Ledger Entries", `SELECT COUNT(*) as n FROM ledger_entries WHERE tenant_id IN (?)`],
    ["Payments",       `SELECT COUNT(*) as n FROM payments WHERE tenant_id IN (?)`],
    ["Complaints",     `SELECT COUNT(*) as n FROM complaints WHERE tenant_id IN (?)`],
    ["Visitor Passes", `SELECT COUNT(*) as n FROM visitor_passes WHERE tenant_id IN (?)`],
    ["Domestic Staff", `SELECT COUNT(*) as n FROM domestic_staff WHERE tenant_id IN (?)`],
    ["Assets",         `SELECT COUNT(*) as n FROM assets WHERE tenant_id IN (?)`],
    ["Work Orders",    `SELECT COUNT(*) as n FROM maintenance_work_orders WHERE tenant_id IN (?)`],
    ["Inventory Items",`SELECT COUNT(*) as n FROM inventory_items WHERE tenant_id IN (?)`],
    ["Polls",          `SELECT COUNT(*) as n FROM polls WHERE tenant_id IN (?)`],
    ["Events",         `SELECT COUNT(*) as n FROM events WHERE tenant_id IN (?)`],
    ["Amenities",      `SELECT COUNT(*) as n FROM amenities WHERE tenant_id IN (?)`],
    ["Notices",        `SELECT COUNT(*) as n FROM notices WHERE tenant_id IN (?)`],
    ["Forum Threads",  `SELECT COUNT(*) as n FROM forum_threads WHERE tenant_id IN (?)`],
    ["Parking Slots",  `SELECT COUNT(*) as n FROM parking_slots WHERE tenant_id IN (?)`],
    ["Vendors",        `SELECT COUNT(*) as n FROM vendors WHERE tenant_id IN (?)`],
  ];

  for (const [label, q] of queries) {
    const params = label.includes("demo") ? [] : DEMO_TENANT_IDS;
    const [rows] = await conn.query(q, params) as any[];
    console.log(`  ${label.padEnd(20)}: ${rows[0].n}`);
  }
}

// ─── PRINT CREDENTIALS ───────────────────────────────────────────────────────
function printCredentials(): void {
  console.log(`
=========================================================
🔑 DEMO CREDENTIAL MATRIX (DEMO ONLY — NOT REAL DATA)
=========================================================

┌─────────────────────────────────────────────────────────────────────┐
│  SUPER ADMIN (Platform-wide access)                                 │
│  Email:    superadmin@demo.housingos.local                          │
│  Password: Demo@12345                                               │
├─────────────────────────────────────────────────────────────────────┤
│  ADMIN ALPHA  (Askari 11 Lahore + Askari 10 Lahore)                 │
│  Email:    admin.alpha@demo.housingos.local                         │
│  Password: Demo@12345                                               │
├─────────────────────────────────────────────────────────────────────┤
│  ADMIN BETA   (Askari 5 Karachi)                                    │
│  Email:    admin.beta@demo.housingos.local                          │
│  Password: Demo@12345                                               │
├─────────────────────────────────────────────────────────────────────┤
│  ADMIN GAMMA  (Askari 4 Karachi + Askari Rawalpindi)                │
│  Email:    admin.gamma@demo.housingos.local                         │
│  Password: Demo@12345                                               │
├─────────────────────────────────────────────────────────────────────┤
│  RESIDENT    (Askari 11 Lahore, first resident)                     │
│  Email:    resident.askari-11-lahore.001@demo.housingos.local       │
│  Password: Demo@12345                                               │
├─────────────────────────────────────────────────────────────────────┤
│  GUARD       (Askari 11 Lahore)                                     │
│  Email:    guard.askari-11-lahore@demo.housingos.local              │
│  Password: Demo@12345                                               │
└─────────────────────────────────────────────────────────────────────┘

Societies seeded:
  1. Askari 11 Lahore Demo   [enterprise]  — apartments + houses + villas
  2. Askari 10 Lahore Demo   [professional] — apartments only
  3. Askari 5 Karachi Demo   [enterprise]  — apartments + houses + villas
  4. Askari 4 Karachi Demo   [growth]      — apartments only
  5. Askari Rawalpindi Demo  [growth]      — apartments + houses (heavy)

=========================================================
`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=========================================================");
  console.log("🏗️  HOUSINGOS MULTI-SOCIETY DEMO SEEDER");
  console.log("    DEMO DATA ONLY — not an official Askari registry");
  console.log("=========================================================");

  const conn = await connectDb();
  const isResetOnly = process.argv.includes("--reset");

  try {
    // Phase 1: Audit current state
    await auditDemoData(conn);

    // Phase 2: Safe reset
    await performReset(conn);

    // Phase 3: Verify clean state
    const isClean = await verifyCleanState(conn);

    if (isResetOnly) {
      console.log("\n🧹 Reset-only mode. Exiting after cleanup.");
      await conn.end();
      return;
    }

    if (!isClean) {
      console.log("\n❌ Cleanup incomplete. Aborting reseed to prevent data corruption.");
      await conn.end();
      process.exit(1);
    }

    // Phases 5–28: Seed all data
    console.log("\n=== PHASES 5-28: SEEDING DEMO DATA ===");
    await seedAll(conn);

    // Phase 29: Integrity checks
    await runIntegrityChecks(conn);

    // Final counts
    await printFinalCounts(conn);

    // Print credentials
    printCredentials();

    console.log("🎉 DEMO SEEDING COMPLETED SUCCESSFULLY!\n");
  } catch (err: any) {
    console.error("\n❌ SEEDING FAILED:", err.message);
    console.error("   SQL:", err.sql || "(no SQL)");
    await conn.end();
    process.exit(1);
  }

  await conn.end();
}

main();
