/**
 * HOUSINGOS — ALL-PAKISTAN COMPREHENSIVE ASKARI SEEDER
 *
 * Populates 34 Askari Housing Societies across Pakistan with:
 *   - Mixed Resident Occupancy: ~70% Owners (`owner`) and ~30% Renters (`tenant`)
 *   - Monthly Rent Charges for Renters (Villas: 180k, Penthouses: 125k, Flats: 65k, Shops: 45k PKR)
 *   - Dynamic Maintenance Charges per Unit Type (Villas: 35k, Penthouses: 25k, Flats: 15k, Shops: 8k PKR)
 *   - Multiple Financial Charge Heads (Maintenance, Rent, Security, Utility, Park Care)
 *   - Clean Property Tree Hierarchy (Block A: Apartments, Block B: Houses with NULL building_id, Block C: Commercial)
 *   - Full Module Coverage: Security Gates, Visitor Passes, Patrols, Blacklist, Vendors, Assets, Work Orders,
 *     Amenities, Meter Readings, Governance, Forum, Polls, Notices, Events.
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEMO_EMAIL_DOMAIN = "@demo.housingos.local";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

type SocietyDef = {
  tenantId: string;
  societyId: string;
  name: string;
  city: string;
  code: string;
  slug: string;
  address: string;
  plan: string;
  scale: "small" | "medium" | "large";
};

// ─── ASKARI SOCIETIES REGISTRY (34 SOCIETIES) ─────────────────────────────────
const DEMO_SOCIETIES: SocietyDef[] = [
  // ── RAWALPINDI ────────────────────────────────────────────────────────────
  { tenantId: "a0001001-0000-4000-8000-000000000001", societyId: "b0001001-0000-4000-8000-000000000001", name: "Askari-I",    city: "Rawalpindi", code: "ASK-I-RWP",   slug: "askari-i-rawalpindi",    address: "Westridge, Rawalpindi",          plan: "enterprise",   scale: "medium" },
  { tenantId: "a0001002-0000-4000-8000-000000000002", societyId: "b0001002-0000-4000-8000-000000000002", name: "Askari-II",   city: "Rawalpindi", code: "ASK-II-RWP",  slug: "askari-ii-rawalpindi",   address: "Westridge, Rawalpindi",          plan: "professional", scale: "medium" },
  { tenantId: "a0001003-0000-4000-8000-000000000003", societyId: "b0001003-0000-4000-8000-000000000003", name: "Askari-III",  city: "Rawalpindi", code: "ASK-III-RWP", slug: "askari-iii-rawalpindi",  address: "Westridge, Rawalpindi",          plan: "growth",       scale: "medium" },
  { tenantId: "a0001004-0000-4000-8000-000000000004", societyId: "b0001004-0000-4000-8000-000000000004", name: "Askari-IV",   city: "Rawalpindi", code: "ASK-IV-RWP",  slug: "askari-iv-rawalpindi",   address: "Chaklala Cantt, Rawalpindi",     plan: "professional", scale: "medium" },
  { tenantId: "a0001005-0000-4000-8000-000000000005", societyId: "b0001005-0000-4000-8000-000000000005", name: "Askari-V",    city: "Rawalpindi", code: "ASK-V-RWP",   slug: "askari-v-rawalpindi",    address: "Chaklala Cantt, Rawalpindi",     plan: "growth",       scale: "large"  },
  { tenantId: "a0001006-0000-4000-8000-000000000006", societyId: "b0001006-0000-4000-8000-000000000006", name: "Askari-VI",   city: "Rawalpindi", code: "ASK-VI-RWP",  slug: "askari-vi-rawalpindi",   address: "Chaklala Cantt, Rawalpindi",     plan: "starter",      scale: "small"  },
  { tenantId: "a0001007-0000-4000-8000-000000000007", societyId: "b0001007-0000-4000-8000-000000000007", name: "Askari-VII",  city: "Rawalpindi", code: "ASK-VII-RWP", slug: "askari-vii-rawalpindi",  address: "Chaklala Cantt, Rawalpindi",     plan: "growth",       scale: "medium" },
  { tenantId: "a0001008-0000-4000-8000-000000000008", societyId: "b0001008-0000-4000-8000-000000000008", name: "Askari-VIII", city: "Rawalpindi", code: "ASK-VIII-RWP",slug: "askari-viii-rawalpindi", address: "Chaklala Cantt, Rawalpindi",     plan: "professional", scale: "medium" },
  { tenantId: "a0001009-0000-4000-8000-000000000009", societyId: "b0001009-0000-4000-8000-000000000009", name: "Askari-IX",   city: "Rawalpindi", code: "ASK-IX-RWP",  slug: "askari-ix-rawalpindi",   address: "Chaklala Cantt, Rawalpindi",     plan: "growth",       scale: "medium" },
  { tenantId: "a0001010-0000-4000-8000-000000000010", societyId: "b0001010-0000-4000-8000-000000000010", name: "Askari-X",    city: "Rawalpindi", code: "ASK-X-RWP",   slug: "askari-x-rawalpindi",    address: "Chaklala Cantt, Rawalpindi",     plan: "enterprise",   scale: "large"  },
  { tenantId: "a0001011-0000-4000-8000-000000000011", societyId: "b0001011-0000-4000-8000-000000000011", name: "Askari-XI",   city: "Rawalpindi", code: "ASK-XI-RWP",  slug: "askari-xi-rawalpindi",   address: "Chaklala Cantt, Rawalpindi",     plan: "professional", scale: "medium" },
  { tenantId: "a0001012-0000-4000-8000-000000000012", societyId: "b0001012-0000-4000-8000-000000000012", name: "Askari-XII",  city: "Rawalpindi", code: "ASK-XII-RWP", slug: "askari-xii-rawalpindi",  address: "Chaklala Cantt, Rawalpindi",     plan: "growth",       scale: "medium" },
  { tenantId: "a0001013-0000-4000-8000-000000000013", societyId: "b0001013-0000-4000-8000-000000000013", name: "Askari-XIII", city: "Rawalpindi", code: "ASK-XIII-RWP",slug: "askari-xiii-rawalpindi", address: "Adyala Road, Rawalpindi",        plan: "starter",      scale: "small"  },
  { tenantId: "a0001014-0000-4000-8000-000000000014", societyId: "b0001014-0000-4000-8000-000000000014", name: "Askari-XIV",  city: "Rawalpindi", code: "ASK-XIV-RWP", slug: "askari-xiv-rawalpindi",  address: "Adyala Road, Rawalpindi",        plan: "growth",       scale: "large"  },
  { tenantId: "a0001015-0000-4000-8000-000000000015", societyId: "b0001015-0000-4000-8000-000000000015", name: "Askari-XV",   city: "Rawalpindi", code: "ASK-XV-RWP",  slug: "askari-xv-rawalpindi",   address: "Adyala Road, Rawalpindi",        plan: "enterprise",   scale: "large"  },

  // ── ISLAMABAD ─────────────────────────────────────────────────────────────
  { tenantId: "a0002001-0000-4000-8000-000000000001", societyId: "b0002001-0000-4000-8000-000000000001", name: "Askari-I",    city: "Islamabad",  code: "ASK-I-ISB",   slug: "askari-i-islamabad",     address: "Jinnah Avenue, E-9, Islamabad",  plan: "enterprise",   scale: "medium" },
  { tenantId: "a0002002-0000-4000-8000-000000000002", societyId: "b0002002-0000-4000-8000-000000000002", name: "Falcon Complex AFOHS", city: "Islamabad", code: "FALCON-ISB", slug: "falcon-complex-islamabad", address: "Sector E-9, Islamabad",   plan: "enterprise",   scale: "large"  },

  // ── LAHORE ────────────────────────────────────────────────────────────────
  { tenantId: "a0003001-0000-4000-8000-000000000001", societyId: "b0003001-0000-4000-8000-000000000001", name: "Askari 1",    city: "Lahore",     code: "ASK-1-LHR",   slug: "askari-1-lahore",        address: "Sarwar Road, Lahore Cantt",      plan: "growth",       scale: "medium" },
  { tenantId: "a0003002-0000-4000-8000-000000000002", societyId: "b0003002-0000-4000-8000-000000000002", name: "Askari 2",    city: "Lahore",     code: "ASK-2-LHR",   slug: "askari-2-lahore",        address: "Zarar Shaheed Road, Lahore Cantt", plan: "professional", scale: "medium" },
  { tenantId: "a0003003-0000-4000-8000-000000000003", societyId: "b0003003-0000-4000-8000-000000000003", name: "Askari 3",    city: "Lahore",     code: "ASK-3-LHR",   slug: "askari-3-lahore",        address: "Bedian Road, Lahore Cantt",      plan: "growth",       scale: "medium" },
  { tenantId: "a0003005-0000-4000-8000-000000000005", societyId: "b0003005-0000-4000-8000-000000000005", name: "Askari 5",    city: "Lahore",     code: "ASK-5-LHR",   slug: "askari-5-lahore",        address: "Gulberg / Cantt, Lahore",        plan: "enterprise",   scale: "large"  },
  { tenantId: "a0003010-0000-4000-8000-000000000010", societyId: "b0003010-0000-4000-8000-000000000010", name: "Askari 10",   city: "Lahore",     code: "ASK-10-LHR",  slug: "askari-10-lahore",       address: "Amjad Chaudhry Road, Lahore Cantt", plan: "enterprise", scale: "large"  },
  { tenantId: "a0003011-0000-4000-8000-000000000011", societyId: "b0003011-0000-4000-8000-000000000011", name: "Askari 11",   city: "Lahore",     code: "ASK-11-LHR",  slug: "askari-11-lahore",       address: "Bedian Road, Lahore Cantt",      plan: "enterprise",   scale: "large"  },

  // ── KARACHI ───────────────────────────────────────────────────────────────
  { tenantId: "a0004001-0000-4000-8000-000000000001", societyId: "b0004001-0000-4000-8000-000000000001", name: "Askari 1",    city: "Karachi",    code: "ASK-1-KHI",   slug: "askari-1-karachi",       address: "Chanesar Goth, Karachi Cantt",   plan: "growth",       scale: "medium" },
  { tenantId: "a0004002-0000-4000-8000-000000000002", societyId: "b0004002-0000-4000-8000-000000000002", name: "Askari 2",    city: "Karachi",    code: "ASK-2-KHI",   slug: "askari-2-karachi",       address: "Cantonment, Karachi",            plan: "professional", scale: "medium" },
  { tenantId: "a0004003-0000-4000-8000-000000000003", societyId: "b0004003-0000-4000-8000-000000000003", name: "Askari 3",    city: "Karachi",    code: "ASK-3-KHI",   slug: "askari-3-karachi",       address: "School Road, Karachi Cantt",     plan: "growth",       scale: "medium" },
  { tenantId: "a0004004-0000-4000-8000-000000000004", societyId: "b0004004-0000-4000-8000-000000000004", name: "Askari 4",    city: "Karachi",    code: "ASK-4-KHI",   slug: "askari-4-karachi",       address: "Rashid Minhas Road, Karachi Cantt", plan: "professional", scale: "large"  },
  { tenantId: "a0004005-0000-4000-8000-000000000005", societyId: "b0004005-0000-4000-8000-000000000005", name: "Askari 5",    city: "Karachi",    code: "ASK-5-KHI",   slug: "askari-5-karachi",       address: "Malir Cantonment, Karachi",      plan: "enterprise",   scale: "large"  },

  // ── PESHAWAR ──────────────────────────────────────────────────────────────
  { tenantId: "a0005001-0000-4000-8000-000000000001", societyId: "b0005001-0000-4000-8000-000000000001", name: "Askari-I",    city: "Peshawar",   code: "ASK-I-PEW",   slug: "askari-i-peshawar",      address: "Khyber Road, Peshawar Cantt",    plan: "growth",       scale: "small"  },
  { tenantId: "a0005002-0000-4000-8000-000000000002", societyId: "b0005002-0000-4000-8000-000000000002", name: "Askari-II",   city: "Peshawar",   code: "ASK-II-PEW",  slug: "askari-ii-peshawar",     address: "Warsak Road, Peshawar",          plan: "professional", scale: "large"  },

  // ── MULTAN ────────────────────────────────────────────────────────────────
  { tenantId: "a0006001-0000-4000-8000-000000000001", societyId: "b0006001-0000-4000-8000-000000000001", name: "Askari-I",    city: "Multan",     code: "ASK-I-MUX",   slug: "askari-i-multan",        address: "Multan Cantt",                   plan: "growth",       scale: "medium" },
  { tenantId: "a0006002-0000-4000-8000-000000000002", societyId: "b0006002-0000-4000-8000-000000000002", name: "Askari-II",   city: "Multan",     code: "ASK-II-MUX",  slug: "askari-ii-multan",       address: "Bosan Road, Multan",             plan: "professional", scale: "medium" },

  // ── GUJRANWALA ────────────────────────────────────────────────────────────
  { tenantId: "a0007001-0000-4000-8000-000000000001", societyId: "b0007001-0000-4000-8000-000000000001", name: "Askari Housing", city: "Gujranwala", code: "ASK-GWA",   slug: "askari-housing-gujranwala", address: "Gujranwala Cantt",           plan: "growth",       scale: "small"  },

  // ── QUETTA ────────────────────────────────────────────────────────────────
  { tenantId: "a0008001-0000-4000-8000-000000000001", societyId: "b0008001-0000-4000-8000-000000000001", name: "Askari Housing", city: "Quetta",     code: "ASK-UET",   slug: "askari-housing-quetta",     address: "Chaman Road, Quetta Cantt",      plan: "professional", scale: "small"  },
];

// ─── UNIQUE RESIDENT NAME GENERATOR ───────────────────────────────────────────
const RANKS_AND_TITLES = [
  "Brig. (R)", "Col. (R)", "Lt. Col. (R)", "Maj. (R)", "Capt. (R)",
  "Air Cdre. (R)", "Sqn. Ldr. (R)", "Cmde. (R)", "Vice Adm. (R)",
  "Dr.", "Engr.", "Prof.", "Advocate", "Mr.", "Mrs."
];

const FIRST_NAMES = [
  "Tariq",    "Javed",    "Faisal",   "Salman",   "Hamza",
  "Ayesha",   "Zafar",    "Usman",    "Imran",    "Shahid",
  "Bilal",    "Hassan",   "Kamran",   "Saad",     "Mariam",
  "Nadia",    "Fozia",    "Sadia",    "Asad",     "Danish",
  "Furqan",   "Owais",    "Rehan",    "Sohail",   "Waqas",
  "Zainab",   "Naveed",   "Lubna",    "Iqra",     "Amna",
  "Rizwan",   "Junaid",   "Mariam",   "Ambreen",  "Rukhsana"
];

const LAST_NAMES = [
  "Mahmood",  "Iqbal",    "Ahmad",    "Farooq",   "Khan",
  "Hashmi",   "Ali",      "Raza",     "Siddiqui", "Qureshi",
  "Bukhari",  "Awan",     "Malik",    "Bhatti",   "Shah",
  "Ghauri",   "Mirza",    "Latif",    "Anwar",    "Saleem",
  "Jahangir", "Durrani",  "Khattak",  "Niazi",    "Gillani",
  "Begum",    "Noor",     "Akhtar",   "Gul",      "Javed"
];

const UNIQUE_NAMES: string[] = [];
let nameIdx = 0;
for (const title of RANKS_AND_TITLES) {
  for (const fn of FIRST_NAMES) {
    for (const ln of LAST_NAMES) {
      UNIQUE_NAMES.push(`${title} ${fn} ${ln}`);
    }
  }
}

// ─── MODULES LIST ─────────────────────────────────────────────────────────────
const DEMO_MODULES = [
  "platform", "property", "residents", "notifications", "documents", "reports",
  "ledger", "payments", "financial_transparency", "budget",
  "complaints", "maintenance", "inventory", "vendors", "assets",
  "visitor", "gate", "parking",
  "notice_board", "community_forum", "polls", "events", "amenities", "governance",
  "utility_meters"
];

const SUPER_ADMIN_ID = "a9900000-0000-4000-8000-000000000000";
const ADMIN_ALPHA_ID = "a9900001-0000-4000-8000-000000000001";
const ADMIN_BETA_ID  = "a9900002-0000-4000-8000-000000000002";
const ADMIN_GAMMA_ID = "a9900003-0000-4000-8000-000000000003";
const ADMIN_DELTA_ID = "a9900004-0000-4000-8000-000000000004";
const ADMIN_EPSILON_ID="a9900005-0000-4000-8000-000000000005";

async function connectDb(): Promise<mysql.Connection> {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const idx = t.indexOf("=");
        if (idx !== -1) {
          const key = t.slice(0, idx).trim().replace(/^export\s+/, "");
          let val = t.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }

  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "at_bms";
  console.log(`[CONN] Connecting to MySQL database: ${database}...`);
  return mysql.createConnection({ host, port, user, password, database });
}

// ─── PHASE 1: FULL PURGE OF LEGACY DATA ───────────────────────────────────────
async function purgeAllNonAskariData(conn: mysql.Connection): Promise<void> {
  console.log("\n=== PHASE 1: FULL PURGE OF NON-ASKARI & DUMMY SOCIETIES ===");
  console.log("[PURGE] Truncating all tenant tables to remove legacy data...");

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  const tablesToTruncate = [
    "amenity_bookings", "amenities", "event_rsvps", "events", "poll_votes", "polls",
    "forum_replies", "forum_threads", "notice_reads", "notices",
    "governance_resolutions", "governance_meetings",
    "entry_exit_log", "visitor_blacklist", "visitor_passes", "domestic_staff",
    "maintenance_work_orders", "maintenance_schedules", "assets",
    "project_expenses", "project_milestones", "projects",
    "stock_movements", "inventory_items",
    "vendor_invoices", "purchase_orders", "quotations", "rfqs", "vendors",
    "meter_readings", "meter_rates",
    "parking_allocations", "parking_slots",
    "payments", "ledger_entries", "wallets", "charge_heads",
    "complaint_comments", "complaint_history", "complaints", "sla_configs",
    "resident_vehicles", "residents", "persons",
    "units", "floors", "buildings", "blocks",
    "custom_roles", "role_permissions", "tenant_modules", "society_admin_tenants",
    "budget_line_items", "budgets", "documents", "notifications", "form_submissions",
    "guard_patrols", "gate_terminals", "blacklist",
    "audit_logs", "societies", "sessions", "user_roles", "profiles", "users", "tenants"
  ];

  for (const t of tablesToTruncate) {
    await conn.query(`TRUNCATE TABLE \`${t}\``).catch(() => {});
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("[PURGE] ✅ All legacy data purged cleanly.");
}

// ─── PHASE 2: SEED PLATFORM SUPER ADMIN & REGIONAL ADMINS ────────────────────
async function seedAdmins(conn: mysql.Connection, pwHash: string): Promise<void> {
  console.log("\n=== PHASE 2: PROVISIONING PLATFORM SUPER ADMIN & REGIONAL ADMINS ===");

  await conn.query(
    "INSERT INTO users (id, email, password_hash) VALUES (?, 'superadmin@demo.housingos.local', ?)",
    [SUPER_ADMIN_ID, pwHash]
  );
  await conn.query(
    "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Global Super Admin', 'Askari Housing Authority', '+92 51 111222333', NULL)",
    [SUPER_ADMIN_ID]
  );
  await conn.query(
    "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')",
    [crypto.randomUUID(), SUPER_ADMIN_ID]
  );

  // Backup admin@demo.com
  const adminDemoId = "a9900000-0000-4000-8000-000000000099";
  const pwdDemo1234 = hashPassword("demo1234");
  await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'admin@demo.com', ?)", [adminDemoId, pwdDemo1234]);
  await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Super Admin Backup', 'Askari Housing Authority', '+92 300 1234567', NULL)", [adminDemoId]);
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')", [crypto.randomUUID(), adminDemoId]);

  // Regional Multi-Society Admins
  const regionalAdmins = [
    { id: ADMIN_ALPHA_ID, email: `admin.alpha${DEMO_EMAIL_DOMAIN}`, name: "Admin Alpha (Rawalpindi 1-5)", tenants: DEMO_SOCIETIES.slice(0, 5).map(s => s.tenantId) },
    { id: ADMIN_BETA_ID,  email: `admin.beta${DEMO_EMAIL_DOMAIN}`,  name: "Admin Beta (Rawalpindi 6-10)", tenants: DEMO_SOCIETIES.slice(5, 10).map(s => s.tenantId) },
    { id: ADMIN_GAMMA_ID, email: `admin.gamma${DEMO_EMAIL_DOMAIN}`, name: "Admin Gamma (Rawalpindi 11-15)", tenants: DEMO_SOCIETIES.slice(10, 15).map(s => s.tenantId) },
    { id: ADMIN_DELTA_ID, email: `admin.delta${DEMO_EMAIL_DOMAIN}`, name: "Admin Delta (Islamabad & Lahore)", tenants: DEMO_SOCIETIES.slice(15, 23).map(s => s.tenantId) },
    { id: ADMIN_EPSILON_ID, email: `admin.epsilon${DEMO_EMAIL_DOMAIN}`, name: "Admin Epsilon (Karachi, Peshawar, Multan, Gujranwala, Quetta)", tenants: DEMO_SOCIETIES.slice(23).map(s => s.tenantId) },
  ];

  for (const adm of regionalAdmins) {
    await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [adm.id, adm.email, pwHash]);
    await conn.query("INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, ?, NULL)", [adm.id, adm.name]);
    await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [crypto.randomUUID(), adm.id]);
    for (const tid of adm.tenants) {
      await conn.query(
        "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
        [crypto.randomUUID(), adm.id, tid]
      );
    }
  }

  console.log("✅ Super Admin and Regional Admins provisioned.");
}

// ─── PHASE 3: SEED ASKARI SOCIETIES WITH DYNAMIC FEES & RENT ────────────────
async function seedAskariSocieties(conn: mysql.Connection, pwHash: string): Promise<void> {
  console.log(`\n=== PHASE 3: SEEDING ${DEMO_SOCIETIES.length} ASKARI SOCIETIES WITH RENT, DYNAMIC FEES & ALL MODULES ===`);

  let receiptSeq = 1;
  function nextReceipt(code: string): string {
    return `REC-${code}-${String(receiptSeq++).padStart(6, "0")}`;
  }

  for (const s of DEMO_SOCIETIES) {
    console.log(`\n[ASKARI] 🏛️ ${s.name} (${s.city}) [${s.code}] — Scale: ${s.scale.toUpperCase()}`);

    // 1. Tenant record
    await conn.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, date_format, contact_email, contact_phone, address, code)
       VALUES (?, ?, ?, ?, 'Asia/Karachi', 'PKR', 'DD/MM/YYYY', ?, ?, ?, ?)`,
      [s.tenantId, s.name, s.slug, s.plan, `admin.${s.slug}${DEMO_EMAIL_DOMAIN}`, "+92 51 5000000", s.address, s.code]
    );

    // 2. Society record
    await conn.query(
      "INSERT INTO societies (id, tenant_id, name, address, city) VALUES (?, ?, ?, ?, ?)",
      [s.societyId, s.tenantId, s.name, s.address, s.city]
    );

    // 3. Module activations
    for (const mod of DEMO_MODULES) {
      await conn.query(
        "INSERT INTO tenant_modules (id, tenant_id, module_key, is_active) VALUES (?, ?, ?, TRUE)",
        [crypto.randomUUID(), s.tenantId, mod]
      ).catch(() => {});
    }

    // 4. Dedicated Society Admin
    const socAdminId = crypto.randomUUID();
    const socAdminEmail = `admin.${s.slug}${DEMO_EMAIL_DOMAIN}`;
    await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [socAdminId, socAdminEmail, pwHash]);
    await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, ?, ?, ?)", [
      socAdminId, `${s.name} Society Admin`, s.name, "+92 300 5000000", s.tenantId
    ]);
    await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [crypto.randomUUID(), socAdminId]);
    await conn.query("INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)", [
      crypto.randomUUID(), socAdminId, s.tenantId
    ]);

    // 5. Staff Users
    const staffDefs = [
      { key: "guard",       role: "guard",            label: "Gate Security Guard" },
      { key: "technician",  role: "technician",        label: "Maintenance Tech" },
      { key: "finance",     role: "finance_head",      label: "Finance Head" },
    ];
    const staffIds: Record<string, string> = {};
    for (const sd of staffDefs) {
      const uid = crypto.randomUUID();
      const email = `${sd.key}.${s.slug}${DEMO_EMAIL_DOMAIN}`;
      await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [uid, email, pwHash]);
      await conn.query("INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, ?, ?)", [uid, `${sd.label} (${s.code})`, s.tenantId]);
      await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [crypto.randomUUID(), uid, sd.role]);
      staffIds[sd.key] = uid;
    }

    // 6. PROPERTY TREE & UNITS GENERATION
    type UnitInfo = { id: string; num: string; type: string; area: number };
    const units: UnitInfo[] = [];

    const numHouses = s.scale === "small" ? 3 : s.scale === "medium" ? 5 : 8;
    const numTowers = s.scale === "small" ? 1 : s.scale === "medium" ? 2 : 3;
    const numFloorsPerTower = s.scale === "small" ? 2 : s.scale === "medium" ? 3 : 4;
    const numFlatsPerFloor = s.scale === "small" ? 2 : s.scale === "medium" ? 2 : 3;

    // ── BLOCK 1: Independent Houses & Villas (building_id = NULL) ──
    const houseBlockId = crypto.randomUUID();
    await conn.query("INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, 'Block B (Officer Housing & Villas)')", [
      houseBlockId, s.societyId, s.tenantId
    ]);

    for (let h = 1; h <= numHouses; h++) {
      const uid = crypto.randomUUID();
      const unitNum = `${h * 5}-A`;
      await conn.query(
        `INSERT INTO units (id, floor_id, building_id, block_id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, 'villa', 4500, 5, 'occupied')`,
        [uid, houseBlockId, s.societyId, s.tenantId, unitNum]
      );
      units.push({ id: uid, num: unitNum, type: "villa", area: 4500 });
    }

    // ── BLOCK 2: Apartment Towers ──
    const aptBlockId = crypto.randomUUID();
    await conn.query("INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, 'Block A (Askari Apartments)')", [
      aptBlockId, s.societyId, s.tenantId
    ]);

    for (let t = 1; t <= numTowers; t++) {
      const towerName = `Askari Heights Tower ${String.fromCharCode(64 + t)}`;
      const towerId = crypto.randomUUID();
      await conn.query("INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, ?, ?)", [
        towerId, aptBlockId, s.tenantId, towerName, numFloorsPerTower
      ]);

      for (let fl = 1; fl <= numFloorsPerTower; fl++) {
        const floorId = crypto.randomUUID();
        await conn.query("INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, ?, ?)", [
          floorId, towerId, s.tenantId, fl, `Floor ${fl}`
        ]);

        for (let apt = 1; apt <= numFlatsPerFloor; apt++) {
          const uid = crypto.randomUUID();
          const unitNum = `${fl}0${apt}`;
          await conn.query(
            `INSERT INTO units (id, floor_id, building_id, block_id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'flat', 1800, 3, 'occupied')`,
            [uid, floorId, towerId, aptBlockId, s.societyId, s.tenantId, unitNum]
          );
          units.push({ id: uid, num: unitNum, type: "flat", area: 1800 });
        }
      }

      if (s.scale !== "small" && t === 1) {
        const topFloorId = crypto.randomUUID();
        await conn.query("INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, ?, 'Penthouse Level')", [
          topFloorId, towerId, s.tenantId, numFloorsPerTower + 1
        ]);
        const pentUid = crypto.randomUUID();
        await conn.query(
          `INSERT INTO units (id, floor_id, building_id, block_id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
           VALUES (?, ?, ?, ?, ?, ?, '501', 'penthouse', 3500, 4, 'occupied')`,
          [pentUid, topFloorId, towerId, aptBlockId, s.societyId, s.tenantId]
        );
        units.push({ id: pentUid, num: "501", type: "penthouse", area: 3500 });
      }
    }

    // ── BLOCK 3: Commercial Complex ──
    const commBlockId = crypto.randomUUID();
    await conn.query("INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, 'Block C (Askari Commercial Zone)')", [
      commBlockId, s.societyId, s.tenantId
    ]);
    const commBldgId = crypto.randomUUID();
    await conn.query("INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, 'Askari Commercial Plaza', 1)", [
      commBldgId, commBlockId, s.tenantId
    ]);
    const commFloorId = crypto.randomUUID();
    await conn.query("INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, 1, 'Ground Floor')", [
      commFloorId, commBldgId, s.tenantId
    ]);
    const shopUid = crypto.randomUUID();
    await conn.query(
      `INSERT INTO units (id, floor_id, building_id, block_id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
       VALUES (?, ?, ?, ?, ?, ?, '101', 'shop', 900, 0, 'occupied')`,
      [shopUid, commFloorId, commBldgId, commBlockId, s.societyId, s.tenantId]
    );
    units.push({ id: shopUid, num: "101", type: "shop", area: 900 });

    // 7. DYNAMIC RESIDENTS SEEDING (MIXED OWNERS & TENANTS)
    type ResRecord = { userId: string; residentId: string; unitId: string; name: string; resType: "owner" | "tenant"; unitType: string };
    const residentsList: ResRecord[] = [];

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const resName = UNIQUE_NAMES[nameIdx++ % UNIQUE_NAMES.length];
      const resEmail = `resident.${s.slug}.${String(i + 1).padStart(3, "0")}${DEMO_EMAIL_DOMAIN}`;
      const resPhone = `+92 300 ${String(1000000 + nameIdx * 17).slice(0, 7)}`;
      // ~30% of occupants are tenants (renters), ~70% are owners
      const resType: "owner" | "tenant" = (i % 3 === 2) ? "tenant" : "owner";

      const resUserId = crypto.randomUUID();
      await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [resUserId, resEmail, pwHash]);
      await conn.query("INSERT INTO profiles (id, full_name, phone, tenant_id) VALUES (?, ?, ?, ?)", [
        resUserId, resName, resPhone, s.tenantId
      ]);
      await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'resident')", [crypto.randomUUID(), resUserId]);

      const personId = crypto.randomUUID();
      await conn.query(
        "INSERT INTO persons (id, tenant_id, user_id, full_name, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
        [personId, s.tenantId, resUserId, resName, resEmail, resPhone]
      );

      const residentId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO residents (id, person_id, unit_id, tenant_id, type, move_in_date, is_current, invite_status)
         VALUES (?, ?, ?, ?, ?, '2024-01-01', TRUE, 'accepted')`,
        [residentId, personId, u.id, s.tenantId, resType]
      );

      residentsList.push({ userId: resUserId, residentId, unitId: u.id, name: resName, resType, unitType: u.type });

      // Resident Vehicle
      const plate = `${s.code.slice(0, 4)}-${String(i + 101)}`;
      await conn.query(
        "INSERT INTO resident_vehicles (id, resident_id, tenant_id, vehicle_type, make, model, plate_number, color) VALUES (?, ?, ?, 'car', 'Toyota', 'Corolla', ?, 'White')",
        [crypto.randomUUID(), residentId, s.tenantId, plate]
      );
    }

    // 8. MULTIPLE FINANCIAL CHARGE HEADS (VARYING FEES & MONTHLY RENT)
    const chMaintId   = crypto.randomUUID();
    const chRentId    = crypto.randomUUID();
    const chSecId     = crypto.randomUUID();
    const chUtilId    = crypto.randomUUID();

    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Monthly Maintenance Fee', 'Variable maintenance fee based on unit type and area', 15000.00)",
      [chMaintId, s.tenantId]
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Monthly Property Rent', 'Monthly rent for tenant occupants', 65000.00)",
      [chRentId, s.tenantId]
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Security & CCTV Service Charge', '24/7 Gate security & CCTV surveillance contribution', 2500.00)",
      [chSecId, s.tenantId]
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Water & Filtration Utility Charge', 'Clean drinking water & sewage maintenance', 1500.00)",
      [chUtilId, s.tenantId]
    );

    for (const r of residentsList) {
      // Determine Maintenance Fee by unit type
      let maintFee = 15000; // default flat
      if (r.unitType === "villa") maintFee = 35000;
      else if (r.unitType === "penthouse") maintFee = 25000;
      else if (r.unitType === "flat") maintFee = 15000;
      else if (r.unitType === "shop") maintFee = 8000;

      // Determine Monthly Rent (only for tenants)
      let rentFee = 0;
      if (r.resType === "tenant") {
        if (r.unitType === "villa") rentFee = 180000;
        else if (r.unitType === "penthouse") rentFee = 125000;
        else if (r.unitType === "flat") rentFee = 65000;
        else if (r.unitType === "shop") rentFee = 45000;
      }

      const totalCharge = maintFee + rentFee + 2500 + 1500;

      // Wallet
      await conn.query("INSERT INTO wallets (id, tenant_id, unit_id, balance) VALUES (?, ?, ?, 0.00)", [crypto.randomUUID(), s.tenantId, r.unitId]);

      // 1. Maintenance Charge Ledger
      await conn.query(
        `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, balance_after)
         VALUES (?, ?, ?, 'charge', ?, ?, 'Monthly Maintenance Fee - Aug 2026', ?)`,
        [crypto.randomUUID(), s.tenantId, r.unitId, chMaintId, maintFee, maintFee]
      );

      // 2. Rent Charge Ledger (if tenant)
      if (r.resType === "tenant" && rentFee > 0) {
        await conn.query(
          `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, balance_after)
           VALUES (?, ?, ?, 'charge', ?, ?, 'Monthly Property Rent - Aug 2026', ?)`,
          [crypto.randomUUID(), s.tenantId, r.unitId, chRentId, rentFee, maintFee + rentFee]
        );
      }

      // 3. Security & Utility Ledger Charges
      await conn.query(
        `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, balance_after)
         VALUES (?, ?, ?, 'charge', ?, 2500.00, 'Security & CCTV Surveillance Charge - Aug 2026', ?)`,
        [crypto.randomUUID(), s.tenantId, r.unitId, chSecId, maintFee + rentFee + 2500]
      );

      // Payment Recording (Settled)
      const receiptNo = nextReceipt(s.code.replace(/[^A-Z0-9]/g, ""));
      await conn.query(
        `INSERT INTO payments (id, tenant_id, unit_id, amount, payment_method, receipt_number, payment_date, reference, notes, recorded_by)
         VALUES (?, ?, ?, ?, 'bank_transfer', ?, '2026-08-01', ?, 'Paid via Habib Bank Online', ?)`,
        [crypto.randomUUID(), s.tenantId, r.unitId, totalCharge, receiptNo, `TXN-${receiptNo}`, socAdminId]
      );

      // Payment Ledger Credit
      await conn.query(
        `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, balance_after)
         VALUES (?, ?, ?, 'payment', ?, ?, 'Payment Received - Receipt #${receiptNo}', 0.00)`,
        [crypto.randomUUID(), s.tenantId, r.unitId, chMaintId, totalCharge]
      );
    }

    // 9. DYNAMIC COMPLAINTS
    const complaintDefs = [
      { title: "Water Supply Pressure Low", cat: "water", prio: "medium", status: "in_progress" },
      { title: "Basement Drainage Dripping", cat: "plumbing", prio: "high", status: "open" },
      { title: "Corridor Light Fixture Fused", cat: "electrical", prio: "low", status: "resolved" },
      { title: "Main Gate RFID Scanner Delay", cat: "security", prio: "high", status: "open" },
      { title: "Elevator Lift Door Sensor Issue", cat: "lift", prio: "medium", status: "in_progress" },
    ];
    const numComplaints = s.scale === "small" ? 1 : s.scale === "medium" ? 3 : 5;
    for (let c = 0; c < numComplaints; c++) {
      const cd = complaintDefs[c % complaintDefs.length];
      await conn.query(
        `INSERT INTO complaints (id, tenant_id, title, description, category, priority, status, submitted_by)
         VALUES (?, ?, ?, 'Maintenance ticket registered by occupant.', ?, ?, ?, ?)`,
        [crypto.randomUUID(), s.tenantId, cd.title, cd.cat, cd.prio, cd.status, residentsList[c % residentsList.length].userId]
      );
    }

    // 10. MAINTENANCE WORK ORDERS
    const numWorkOrders = s.scale === "small" ? 1 : s.scale === "medium" ? 2 : 4;
    for (let w = 1; w <= numWorkOrders; w++) {
      await conn.query(
        `INSERT INTO maintenance_work_orders (id, tenant_id, title, description, category, priority, status, assigned_to)
         VALUES (?, ?, ?, 'Scheduled routine inspection work order.', 'electrical', 'medium', ?, ?)`,
        [crypto.randomUUID(), s.tenantId, `Routine Inspection Order #${w}`, w % 2 === 0 ? "in_progress" : "completed", staffIds["technician"]]
      ).catch(() => {});
    }

    // 11. GATE TERMINALS & VISITOR PASSES
    const gate1 = crypto.randomUUID();
    const gate2 = crypto.randomUUID();
    await conn.query("INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Main Gate 1', 'North Entrance', 'active')", [gate1, s.tenantId]);
    await conn.query("INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Executive Gate 2', 'South Exit', 'active')", [gate2, s.tenantId]);

    const numVisitors = s.scale === "small" ? 3 : s.scale === "medium" ? 8 : 15;
    for (let vp = 1; vp <= numVisitors; vp++) {
      const targetRes = residentsList[vp % residentsList.length];
      await conn.query(
        `INSERT INTO visitor_passes (id, tenant_id, resident_id, visitor_name, visitor_phone, expected_at, pass_code, status)
         VALUES (?, ?, ?, ?, '+92 321 5551234', '2026-08-25 08:00:00', ?, ?)`,
        [crypto.randomUUID(), s.tenantId, targetRes.residentId, `Guest Visitor ${vp}`, `VP-${String(vp).padStart(3, "0")}`, vp % 3 === 0 ? "used" : "active"]
      ).catch((e) => console.log("Visitor pass err:", e.message));
    }

    // Guard Patrol Checkpoints
    await conn.query("INSERT INTO guard_patrols (id, tenant_id, guard_name, checkpoint_name, notes) VALUES (?, ?, 'Ahmed Khan', 'Main Gate 1', 'All secure')", [crypto.randomUUID(), s.tenantId]);
    await conn.query("INSERT INTO guard_patrols (id, tenant_id, guard_name, checkpoint_name, notes) VALUES (?, ?, 'Bilal Raza', 'Block A Elevator Lobby', 'Patrol completed')", [crypto.randomUUID(), s.tenantId]);

    // Blacklist
    await conn.query("INSERT INTO blacklist (id, tenant_id, type, value, reason) VALUES (?, ?, 'vehicle', 'LZA-4471', 'Unauthorized entry attempt')", [crypto.randomUUID(), s.tenantId]);

    // 12. VENDORS & PROCUREMENT
    const v1 = crypto.randomUUID();
    const v2 = crypto.randomUUID();
    await conn.query("INSERT INTO vendors (id, tenant_id, name, category, phone, email, rating) VALUES (?, ?, 'PowerPlus Generators Pakistan', 'Generators & Power', '+92 300 8111222', 'info@powerplus.pk', 4.8)", [v1, s.tenantId]);
    await conn.query("INSERT INTO vendors (id, tenant_id, name, category, phone, email, rating) VALUES (?, ?, 'Apex Lifts & Elevators', 'Elevators & Lifts', '+92 300 8333444', 'sales@apexlifts.pk', 4.6)", [v2, s.tenantId]);

    // 13. ASSETS
    await conn.query("INSERT INTO assets (id, tenant_id, name, location, serial_number, warranty_expires_at) VALUES (?, ?, 'Cummins 250kVA Generator', 'Basement Power Room', 'DG-250-2024', '2028-12-31')", [crypto.randomUUID(), s.tenantId]);
    await conn.query("INSERT INTO assets (id, tenant_id, name, location, serial_number, warranty_expires_at) VALUES (?, ?, 'Otis Passenger Lift A1', 'Tower A Elevator Shaft', 'OTIS-A1-99', '2027-06-30')", [crypto.randomUUID(), s.tenantId]);

    // 14. AMENITIES & BOOKINGS
    const am1 = crypto.randomUUID();
    await conn.query(
      `INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit)
       VALUES (?, ?, 'Askari Banquet Hall', 'hall', 150, 180, '09:00:00', '23:00:00', 8000.00, 15000.00)`,
      [am1, s.tenantId]
    );
    await conn.query(
      `INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, guests_count, purpose, status)
       VALUES (?, ?, ?, ?, '2026-09-05', '18:00:00', '21:00:00', 50, 'Family Reception', 'approved')`,
      [crypto.randomUUID(), s.tenantId, am1, residentsList[0].userId]
    );

    // 15. UTILITY METERS
    const mr1 = crypto.randomUUID();
    await conn.query("INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, effective_from) VALUES (?, ?, 'electricity', 28.50, '2026-01-01')", [mr1, s.tenantId]);
    await conn.query(
      `INSERT INTO meter_readings (id, tenant_id, unit_id, meter_type, reading_date, current_reading, previous_reading, charged_amount)
       VALUES (?, ?, ?, 'electricity', '2026-08-01', 240.00, 0.00, 6840.00)`,
      [crypto.randomUUID(), s.tenantId, units[0].id]
    );

    // 16. GOVERNANCE
    await conn.query(
      `INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status, meeting_minutes)
       VALUES (?, ?, 'Askari Annual General Body Meeting (AGM 2026)', 'Approved annual audit report and security gate automation budget.', '2026-08-10 17:00:00', 'completed', 'Minutes recorded by management board.')`,
      [crypto.randomUUID(), s.tenantId]
    );

    // 17. COMMUNITY FORUM
    const threadId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body)
       VALUES (?, ?, ?, 'general', 'High-Speed Internet Fiber Provider Feedback', 'Which fiber ISP has the best uptime in Askari?')`,
      [threadId, s.tenantId, residentsList[0].userId]
    );
    await conn.query(
      `INSERT INTO forum_replies (id, thread_id, author_id, body)
       VALUES (?, ?, ?, 'StormFiber has excellent uptime in Block A.')`,
      [crypto.randomUUID(), threadId, residentsList[1].userId]
    );

    // 18. NOTICES
    await conn.query(
      `INSERT INTO notices (id, tenant_id, author_id, title, body, is_pinned)
       VALUES (?, ?, ?, 'Welcome to Askari Housing Society', 'Official management portal is now live for all residents.', TRUE)`,
      [crypto.randomUUID(), s.tenantId, socAdminId]
    );

    // 19. POLLS
    const pollId = crypto.randomUUID();
    await conn.query(
      `INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at)
       VALUES (?, ?, 'Should we install Solar Panels for Common Area Lighting?', 'single', '["Yes, approve budget", "No, keep existing setup"]', '2026-08-01 00:00:00', '2026-09-01 00:00:00')`,
      [pollId, s.tenantId]
    );
  }

  console.log(`\n✅ All ${DEMO_SOCIETIES.length} Askari Housing Societies seeded successfully with mixed Owners/Renters, dynamic fees, and complete modules.`);
}

// ─── MAIN EXECUTION ───────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("=========================================================");
  console.log("🏗️  HOUSINGOS — ALL-PAKISTAN COMPREHENSIVE ASKARI SEEDER");
  console.log("=========================================================");

  const conn = await connectDb();
  const pwHash = hashPassword("Demo@12345");

  try {
    await purgeAllNonAskariData(conn);
    await seedAskariSocieties(conn, pwHash);
    await seedAdmins(conn, pwHash);

    // Summary output
    const [[tenantCount]] = await conn.query("SELECT COUNT(*) as n FROM tenants") as any[];
    const [[societyCount]] = await conn.query("SELECT COUNT(*) as n FROM societies") as any[];
    const [[unitCount]] = await conn.query("SELECT COUNT(*) as n FROM units") as any[];
    const [[residentCount]] = await conn.query("SELECT COUNT(*) as n FROM residents") as any[];
    const [[tenantResidentCount]] = await conn.query("SELECT COUNT(*) as n FROM residents WHERE type = 'tenant'") as any[];
    const [[ownerResidentCount]] = await conn.query("SELECT COUNT(*) as n FROM residents WHERE type = 'owner'") as any[];
    const [[complaintCount]] = await conn.query("SELECT COUNT(*) as n FROM complaints") as any[];
    const [[visitorCount]] = await conn.query("SELECT COUNT(*) as n FROM visitor_passes") as any[];
    const [[vendorCount]] = await conn.query("SELECT COUNT(*) as n FROM vendors") as any[];
    const [[assetCount]] = await conn.query("SELECT COUNT(*) as n FROM assets") as any[];

    console.log("\n=========================================================");
    console.log("📊 SEEDING COMPLETE SCORECARD:");
    console.log(`  Tenants Created:          ${tenantCount.n}`);
    console.log(`  Societies Created:        ${societyCount.n}`);
    console.log(`  Units Created:            ${unitCount.n}`);
    console.log(`  Total Residents Created:  ${residentCount.n}`);
    console.log(`    ├── Owners:             ${ownerResidentCount.n}`);
    console.log(`    └── Tenants (Renters):  ${tenantResidentCount.n}`);
    console.log(`  Complaints Logged:        ${complaintCount.n}`);
    console.log(`  Visitor Passes Issued:    ${visitorCount.n}`);
    console.log(`  Vendors Registered:       ${vendorCount.n}`);
    console.log(`  Assets Cataloged:         ${assetCount.n}`);
    console.log("=========================================================\n");

  } catch (err: any) {
    console.error("\n❌ SEEDING FAILED:", err.message);
    if (err.sql) console.error("   SQL:", err.sql);
  } finally {
    await conn.end();
  }
}

main();
