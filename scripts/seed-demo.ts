/**
 * HOUSINGOS — ALL-PAKISTAN MASSIVE ASKARI SEEDER (19,000+ RESIDENTS)
 * Populates 34 Askari Housing Societies across Pakistan with 100% full coverage
 * of EVERY module, including:
 *   - Platform Core (Tenants, Users, Profiles, Roles, Permissions, Modules, Audit Logs)
 *   - Property (Societies, Blocks, Towers, Floors, Units)
 *   - Residents & Vehicles (Owners, Renters, CNICs, Vehicles)
 *   - Finance: Ledgers, Charge Heads, Payments, Wallets, Budgets, Line Items, Financial Transparency
 *   - Procurement: Vendors, RFQs, Quotations, Purchase Orders, Vendor Invoices
 *   - Operations: Inventory Items, Stock Movements, Projects, Milestones, Project Expenses
 *   - Assets & Maintenance: Assets, AMC, Maintenance Schedules, Work Orders, AI Insights
 *   - Complaints & SLA: Complaints, History, Comments, SLA Configs
 *   - Security: Gate Terminals, Guard Patrols, Visitor Passes, Entry/Exit Logs, Domestic Staff, Blacklist
 *   - Parking: Covered/Open/Bike Slots, Unit Allocations
 *   - Utilities: Meter Rates (Electricity, Water, Gas), Meter Readings & Consumption
 *   - Community: Notice Board & Reads, Discussion Forum & Replies, Polls & Votes, Events & RSVPs, Amenities & Bookings, Governance Meetings & Resolutions
 *   - Documents & Notifications & Form Submissions
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
  {
    tenantId: "a0001001-0000-4000-8000-000000000001",
    societyId: "b0001001-0000-4000-8000-000000000001",
    name: "Askari-I",
    city: "Rawalpindi",
    code: "ASK-I-RWP",
    slug: "askari-i-rawalpindi",
    address: "Westridge, Rawalpindi",
    plan: "enterprise",
    scale: "medium",
  },
  {
    tenantId: "a0001002-0000-4000-8000-000000000002",
    societyId: "b0001002-0000-4000-8000-000000000002",
    name: "Askari-II",
    city: "Rawalpindi",
    code: "ASK-II-RWP",
    slug: "askari-ii-rawalpindi",
    address: "Westridge, Rawalpindi",
    plan: "professional",
    scale: "medium",
  },
  {
    tenantId: "a0001003-0000-4000-8000-000000000003",
    societyId: "b0001003-0000-4000-8000-000000000003",
    name: "Askari-III",
    city: "Rawalpindi",
    code: "ASK-III-RWP",
    slug: "askari-iii-rawalpindi",
    address: "Westridge, Rawalpindi",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0001004-0000-4000-8000-000000000004",
    societyId: "b0001004-0000-4000-8000-000000000004",
    name: "Askari-IV",
    city: "Rawalpindi",
    code: "ASK-IV-RWP",
    slug: "askari-iv-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "professional",
    scale: "medium",
  },
  {
    tenantId: "a0001005-0000-4000-8000-000000000005",
    societyId: "b0001005-0000-4000-8000-000000000005",
    name: "Askari-V",
    city: "Rawalpindi",
    code: "ASK-V-RWP",
    slug: "askari-v-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "growth",
    scale: "large",
  },
  {
    tenantId: "a0001006-0000-4000-8000-000000000006",
    societyId: "b0001006-0000-4000-8000-000000000006",
    name: "Askari-VI",
    city: "Rawalpindi",
    code: "ASK-VI-RWP",
    slug: "askari-vi-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "starter",
    scale: "small",
  },
  {
    tenantId: "a0001007-0000-4000-8000-000000000007",
    societyId: "b0001007-0000-4000-8000-000000000007",
    name: "Askari-VII",
    city: "Rawalpindi",
    code: "ASK-VII-RWP",
    slug: "askari-vii-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0001008-0000-4000-8000-000000000008",
    societyId: "b0001008-0000-4000-8000-000000000008",
    name: "Askari-VIII",
    city: "Rawalpindi",
    code: "ASK-VIII-RWP",
    slug: "askari-viii-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "professional",
    scale: "medium",
  },
  {
    tenantId: "a0001009-0000-4000-8000-000000000009",
    societyId: "b0001009-0000-4000-8000-000000000009",
    name: "Askari-IX",
    city: "Rawalpindi",
    code: "ASK-IX-RWP",
    slug: "askari-ix-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0001010-0000-4000-8000-000000000010",
    societyId: "b0001010-0000-4000-8000-000000000010",
    name: "Askari-X",
    city: "Rawalpindi",
    code: "ASK-X-RWP",
    slug: "askari-x-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "enterprise",
    scale: "large",
  },
  {
    tenantId: "a0001011-0000-4000-8000-000000000011",
    societyId: "b0001011-0000-4000-8000-000000000011",
    name: "Askari-XI",
    city: "Rawalpindi",
    code: "ASK-XI-RWP",
    slug: "askari-xi-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "professional",
    scale: "medium",
  },
  {
    tenantId: "a0001012-0000-4000-8000-000000000012",
    societyId: "b0001012-0000-4000-8000-000000000012",
    name: "Askari-XII",
    city: "Rawalpindi",
    code: "ASK-XII-RWP",
    slug: "askari-xii-rawalpindi",
    address: "Chaklala Cantt, Rawalpindi",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0001013-0000-4000-8000-000000000013",
    societyId: "b0001013-0000-4000-8000-000000000013",
    name: "Askari-XIII",
    city: "Rawalpindi",
    code: "ASK-XIII-RWP",
    slug: "askari-xiii-rawalpindi",
    address: "Adyala Road, Rawalpindi",
    plan: "starter",
    scale: "small",
  },
  {
    tenantId: "a0001014-0000-4000-8000-000000000014",
    societyId: "b0001014-0000-4000-8000-000000000014",
    name: "Askari-XIV",
    city: "Rawalpindi",
    code: "ASK-XIV-RWP",
    slug: "askari-xiv-rawalpindi",
    address: "Adyala Road, Rawalpindi",
    plan: "growth",
    scale: "large",
  },
  {
    tenantId: "a0001015-0000-4000-8000-000000000015",
    societyId: "b0001015-0000-4000-8000-000000000015",
    name: "Askari-XV",
    city: "Rawalpindi",
    code: "ASK-XV-RWP",
    slug: "askari-xv-rawalpindi",
    address: "Adyala Road, Rawalpindi",
    plan: "enterprise",
    scale: "large",
  },

  // ── ISLAMABAD ─────────────────────────────────────────────────────────────
  {
    tenantId: "a0002001-0000-4000-8000-000000000001",
    societyId: "b0002001-0000-4000-8000-000000000001",
    name: "Askari-I",
    city: "Islamabad",
    code: "ASK-I-ISB",
    slug: "askari-i-islamabad",
    address: "Jinnah Avenue, E-9, Islamabad",
    plan: "enterprise",
    scale: "medium",
  },
  {
    tenantId: "a0002002-0000-4000-8000-000000000002",
    societyId: "b0002002-0000-4000-8000-000000000002",
    name: "Falcon Complex AFOHS",
    city: "Islamabad",
    code: "FALCON-ISB",
    slug: "falcon-complex-islamabad",
    address: "Sector E-9, Islamabad",
    plan: "enterprise",
    scale: "large",
  },

  // ── LAHORE ────────────────────────────────────────────────────────────────
  {
    tenantId: "a0003001-0000-4000-8000-000000000001",
    societyId: "b0003001-0000-4000-8000-000000000001",
    name: "Askari 1",
    city: "Lahore",
    code: "ASK-1-LHR",
    slug: "askari-1-lahore",
    address: "Sarwar Road, Lahore Cantt",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0003002-0000-4000-8000-000000000002",
    societyId: "b0003002-0000-4000-8000-000000000002",
    name: "Askari 2",
    city: "Lahore",
    code: "ASK-2-LHR",
    slug: "askari-2-lahore",
    address: "Zarar Shaheed Road, Lahore Cantt",
    plan: "professional",
    scale: "medium",
  },
  {
    tenantId: "a0003003-0000-4000-8000-000000000003",
    societyId: "b0003003-0000-4000-8000-000000000003",
    name: "Askari 3",
    city: "Lahore",
    code: "ASK-3-LHR",
    slug: "askari-3-lahore",
    address: "Bedian Road, Lahore Cantt",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0003005-0000-4000-8000-000000000005",
    societyId: "b0003005-0000-4000-8000-000000000005",
    name: "Askari 5",
    city: "Lahore",
    code: "ASK-5-LHR",
    slug: "askari-5-lahore",
    address: "Gulberg / Cantt, Lahore",
    plan: "enterprise",
    scale: "large",
  },
  {
    tenantId: "a0003010-0000-4000-8000-000000000010",
    societyId: "b0003010-0000-4000-8000-000000000010",
    name: "Askari 10",
    city: "Lahore",
    code: "ASK-10-LHR",
    slug: "askari-10-lahore",
    address: "Amjad Chaudhry Road, Lahore Cantt",
    plan: "enterprise",
    scale: "large",
  },
  {
    tenantId: "a0003011-0000-4000-8000-000000000011",
    societyId: "b0003011-0000-4000-8000-000000000011",
    name: "Askari 11",
    city: "Lahore",
    code: "ASK-11-LHR",
    slug: "askari-11-lahore",
    address: "Bedian Road, Lahore Cantt",
    plan: "enterprise",
    scale: "large",
  },

  // ── KARACHI ───────────────────────────────────────────────────────────────
  {
    tenantId: "a0004001-0000-4000-8000-000000000001",
    societyId: "b0004001-0000-4000-8000-000000000001",
    name: "Askari 1",
    city: "Karachi",
    code: "ASK-1-KHI",
    slug: "askari-1-karachi",
    address: "Chanesar Goth, Karachi Cantt",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0004002-0000-4000-8000-000000000002",
    societyId: "b0004002-0000-4000-8000-000000000002",
    name: "Askari 2",
    city: "Karachi",
    code: "ASK-2-KHI",
    slug: "askari-2-karachi",
    address: "Cantonment, Karachi",
    plan: "professional",
    scale: "medium",
  },
  {
    tenantId: "a0004003-0000-4000-8000-000000000003",
    societyId: "b0004003-0000-4000-8000-000000000003",
    name: "Askari 3",
    city: "Karachi",
    code: "ASK-3-KHI",
    slug: "askari-3-karachi",
    address: "School Road, Karachi Cantt",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0004004-0000-4000-8000-000000000004",
    societyId: "b0004004-0000-4000-8000-000000000004",
    name: "Askari 4",
    city: "Karachi",
    code: "ASK-4-KHI",
    slug: "askari-4-karachi",
    address: "Rashid Minhas Road, Karachi Cantt",
    plan: "professional",
    scale: "large",
  },
  {
    tenantId: "a0004005-0000-4000-8000-000000000005",
    societyId: "b0004005-0000-4000-8000-000000000005",
    name: "Askari 5",
    city: "Karachi",
    code: "ASK-5-KHI",
    slug: "askari-5-karachi",
    address: "Malir Cantonment, Karachi",
    plan: "enterprise",
    scale: "large",
  },

  // ── PESHAWAR ──────────────────────────────────────────────────────────────
  {
    tenantId: "a0005001-0000-4000-8000-000000000001",
    societyId: "b0005001-0000-4000-8000-000000000001",
    name: "Askari-I",
    city: "Peshawar",
    code: "ASK-I-PEW",
    slug: "askari-i-peshawar",
    address: "Khyber Road, Peshawar Cantt",
    plan: "growth",
    scale: "small",
  },
  {
    tenantId: "a0005002-0000-4000-8000-000000000002",
    societyId: "b0005002-0000-4000-8000-000000000002",
    name: "Askari-II",
    city: "Peshawar",
    code: "ASK-II-PEW",
    slug: "askari-ii-peshawar",
    address: "Warsak Road, Peshawar",
    plan: "professional",
    scale: "large",
  },

  // ── MULTAN ────────────────────────────────────────────────────────────────
  {
    tenantId: "a0006001-0000-4000-8000-000000000001",
    societyId: "b0006001-0000-4000-8000-000000000001",
    name: "Askari-I",
    city: "Multan",
    code: "ASK-I-MUX",
    slug: "askari-i-multan",
    address: "Multan Cantt",
    plan: "growth",
    scale: "medium",
  },
  {
    tenantId: "a0006002-0000-4000-8000-000000000002",
    societyId: "b0006002-0000-4000-8000-000000000002",
    name: "Askari-II",
    city: "Multan",
    code: "ASK-II-MUX",
    slug: "askari-ii-multan",
    address: "Bosan Road, Multan",
    plan: "professional",
    scale: "medium",
  },

  // ── GUJRANWALA ────────────────────────────────────────────────────────────
  {
    tenantId: "a0007001-0000-4000-8000-000000000001",
    societyId: "b0007001-0000-4000-8000-000000000001",
    name: "Askari Housing",
    city: "Gujranwala",
    code: "ASK-GWA",
    slug: "askari-housing-gujranwala",
    address: "Gujranwala Cantt",
    plan: "growth",
    scale: "small",
  },

  // ── QUETTA ────────────────────────────────────────────────────────────────
  {
    tenantId: "a0008001-0000-4000-8000-000000000001",
    societyId: "b0008001-0000-4000-8000-000000000001",
    name: "Askari Housing",
    city: "Quetta",
    code: "ASK-UET",
    slug: "askari-housing-quetta",
    address: "Chaman Road, Quetta Cantt",
    plan: "professional",
    scale: "small",
  },
];

// ─── UNIQUE RESIDENT NAME GENERATOR ───────────────────────────────────────────
const RANKS_AND_TITLES = [
  "Brig. (R)",
  "Col. (R)",
  "Lt. Col. (R)",
  "Maj. (R)",
  "Capt. (R)",
  "Air Cdre. (R)",
  "Sqn. Ldr. (R)",
  "Cmde. (R)",
  "Vice Adm. (R)",
  "Dr.",
  "Engr.",
  "Prof.",
  "Advocate",
  "Mr.",
  "Mrs.",
];

const FIRST_NAMES = [
  "Tariq",
  "Javed",
  "Faisal",
  "Salman",
  "Hamza",
  "Ayesha",
  "Zafar",
  "Usman",
  "Imran",
  "Shahid",
  "Bilal",
  "Hassan",
  "Kamran",
  "Saad",
  "Mariam",
  "Nadia",
  "Fozia",
  "Sadia",
  "Asad",
  "Danish",
  "Furqan",
  "Owais",
  "Rehan",
  "Sohail",
  "Waqas",
  "Zainab",
  "Naveed",
  "Lubna",
  "Iqra",
  "Amna",
  "Rizwan",
  "Junaid",
  "Ambreen",
  "Rukhsana",
  "Adeel",
  "Ahsan",
  "Babar",
  "Haroon",
  "Kashif",
  "Noman",
];

const LAST_NAMES = [
  "Mahmood",
  "Iqbal",
  "Ahmad",
  "Farooq",
  "Khan",
  "Hashmi",
  "Ali",
  "Raza",
  "Siddiqui",
  "Qureshi",
  "Bukhari",
  "Awan",
  "Malik",
  "Bhatti",
  "Shah",
  "Ghauri",
  "Mirza",
  "Latif",
  "Anwar",
  "Saleem",
  "Jahangir",
  "Durrani",
  "Khattak",
  "Niazi",
  "Gillani",
  "Begum",
  "Noor",
  "Akhtar",
  "Gul",
  "Javed",
];

const UNIQUE_NAMES: string[] = [];
let globalNameIdx = 0;
for (const title of RANKS_AND_TITLES) {
  for (const fn of FIRST_NAMES) {
    for (const ln of LAST_NAMES) {
      UNIQUE_NAMES.push(`${title} ${fn} ${ln}`);
    }
  }
}

const ALL_MODULES = [
  "platform",
  "property",
  "residents",
  "notifications",
  "documents",
  "reports",
  "ledger",
  "payments",
  "financial_transparency",
  "budget",
  "vendor_finance",
  "complaints",
  "maintenance",
  "inventory",
  "vendors",
  "projects",
  "assets",
  "visitor",
  "gate",
  "parking",
  "guard_patrol",
  "blacklist",
  "notice_board",
  "community_forum",
  "polls",
  "events",
  "amenities",
  "governance",
  "utility_meters",
  "ai_maintenance",
];

const SUPER_ADMIN_ID = "a9900000-0000-4000-8000-000000000000";
const ADMIN_ALPHA_ID = "a9900001-0000-4000-8000-000000000001";
const ADMIN_BETA_ID = "a9900002-0000-4000-8000-000000000002";
const ADMIN_GAMMA_ID = "a9900003-0000-4000-8000-000000000003";
const ADMIN_DELTA_ID = "a9900004-0000-4000-8000-000000000004";
const ADMIN_EPSILON_ID = "a9900005-0000-4000-8000-000000000005";

async function connectDb(): Promise<mysql.Connection> {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const idx = t.indexOf("=");
        if (idx !== -1) {
          const key = t
            .slice(0, idx)
            .trim()
            .replace(/^export\s+/, "");
          let val = t.slice(idx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          )
            val = val.slice(1, -1);
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

  // Pre-create DB
  const initConn = await mysql.createConnection({ host, port, user, password });
  await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await initConn.end();

  console.log(`[CONN] Connecting to MySQL database: ${database}...`);
  return mysql.createConnection({ host, port, user, password, database });
}

// ─── HIGH PERFORMANCE BATCH SQL INSERT HELPER ────────────────────────────────
async function batchInsert(
  conn: mysql.Connection,
  table: string,
  columns: string[],
  rows: any[][],
  chunkSize = 500,
): Promise<void> {
  if (rows.length === 0) return;
  const colSql = columns.map((c) => `\`${c}\``).join(", ");
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(", ");
    const flatParams = chunk.flat();
    await conn.query(`INSERT INTO \`${table}\` (${colSql}) VALUES ${placeholders}`, flatParams);
  }
}

// ─── PHASE 1: PURGE LEGACY DATA ───────────────────────────────────────────────
async function purgeAllData(conn: mysql.Connection): Promise<void> {
  console.log("\n=== PHASE 1: FULL PURGE OF OLD DEMO DATA ===");
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  const tablesToTruncate = [
    "amenity_bookings",
    "amenities",
    "event_rsvps",
    "events",
    "poll_votes",
    "polls",
    "forum_replies",
    "forum_threads",
    "notice_reads",
    "notices",
    "governance_resolutions",
    "governance_meetings",
    "entry_exit_log",
    "visitor_blacklist",
    "visitor_passes",
    "domestic_staff",
    "maintenance_work_orders",
    "maintenance_schedules",
    "assets",
    "project_expenses",
    "project_milestones",
    "projects",
    "stock_movements",
    "inventory_items",
    "vendor_invoices",
    "purchase_orders",
    "quotations",
    "rfqs",
    "vendors",
    "meter_readings",
    "meter_rates",
    "parking_allocations",
    "parking_slots",
    "payments",
    "ledger_entries",
    "wallets",
    "charge_heads",
    "complaint_comments",
    "complaint_history",
    "complaints",
    "sla_configs",
    "resident_vehicles",
    "residents",
    "persons",
    "units",
    "floors",
    "buildings",
    "blocks",
    "custom_roles",
    "role_permissions",
    "tenant_modules",
    "society_admin_tenants",
    "budget_line_items",
    "budgets",
    "documents",
    "notifications",
    "form_submissions",
    "guard_patrols",
    "gate_terminals",
    "blacklist",
    "ai_maintenance_analyses",
    "audit_logs",
    "societies",
    "sessions",
    "user_roles",
    "profiles",
    "users",
    "tenants",
  ];

  for (const t of tablesToTruncate) {
    await conn.query(`TRUNCATE TABLE \`${t}\``).catch(() => {});
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("[PURGE] ✅ All tables cleared cleanly.");
}

// ─── PHASE 2: PROVISION ADMINS ────────────────────────────────────────────────
async function seedAdmins(conn: mysql.Connection, pwHash: string): Promise<void> {
  console.log("\n=== PHASE 2: PROVISIONING SUPER ADMIN & REGIONAL ADMINS ===");

  await conn.query(
    "INSERT INTO users (id, email, password_hash) VALUES (?, 'superadmin@demo.housingos.local', ?)",
    [SUPER_ADMIN_ID, pwHash],
  );
  await conn.query(
    "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Global Super Admin', 'Askari Housing Authority', '+92 51 111222333', ?)",
    [SUPER_ADMIN_ID, DEMO_SOCIETIES[0].tenantId],
  );
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')", [
    crypto.randomUUID(),
    SUPER_ADMIN_ID,
  ]);

  const adminDemoId = "a9900000-0000-4000-8000-000000000099";
  const pwdDemo1234 = hashPassword("demo1234");
  await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'admin@demo.com', ?)", [
    adminDemoId,
    pwdDemo1234,
  ]);
  await conn.query(
    "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Super Admin Backup', 'Askari Housing Authority', '+92 300 1234567', ?)",
    [adminDemoId, DEMO_SOCIETIES[0].tenantId],
  );
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')", [
    crypto.randomUUID(),
    adminDemoId,
  ]);

  const regionalAdmins = [
    {
      id: ADMIN_ALPHA_ID,
      email: `admin.alpha${DEMO_EMAIL_DOMAIN}`,
      name: "Admin Alpha (Rawalpindi 1-5)",
      tenants: DEMO_SOCIETIES.slice(0, 5).map((s) => s.tenantId),
    },
    {
      id: ADMIN_BETA_ID,
      email: `admin.beta${DEMO_EMAIL_DOMAIN}`,
      name: "Admin Beta (Rawalpindi 6-10)",
      tenants: DEMO_SOCIETIES.slice(5, 10).map((s) => s.tenantId),
    },
    {
      id: ADMIN_GAMMA_ID,
      email: `admin.gamma${DEMO_EMAIL_DOMAIN}`,
      name: "Admin Gamma (Rawalpindi 11-15)",
      tenants: DEMO_SOCIETIES.slice(10, 15).map((s) => s.tenantId),
    },
    {
      id: ADMIN_DELTA_ID,
      email: `admin.delta${DEMO_EMAIL_DOMAIN}`,
      name: "Admin Delta (Islamabad & Lahore)",
      tenants: DEMO_SOCIETIES.slice(15, 23).map((s) => s.tenantId),
    },
    {
      id: ADMIN_EPSILON_ID,
      email: `admin.epsilon${DEMO_EMAIL_DOMAIN}`,
      name: "Admin Epsilon (Karachi, Peshawar, Multan, Gujranwala, Quetta)",
      tenants: DEMO_SOCIETIES.slice(23).map((s) => s.tenantId),
    },
  ];

  for (const adm of regionalAdmins) {
    await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      adm.id,
      adm.email,
      pwHash,
    ]);
    await conn.query(
      "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, ?, '+92 300 0000000', ?)",
      [adm.id, adm.name, "Askari Housing Authority", adm.tenants[0]],
    );
    await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [
      crypto.randomUUID(),
      adm.id,
    ]);
    for (const tid of adm.tenants) {
      await conn.query(
        "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
        [crypto.randomUUID(), adm.id, tid],
      );
    }
  }

  console.log("✅ Super Admin and Regional Admins provisioned.");
}

// ─── PHASE 3: SEED ALL ASKARI SOCIETIES WITH COMPLETE DATA IN EVERY MODULE ───
async function seedAskariSocieties(conn: mysql.Connection, pwHash: string): Promise<void> {
  console.log(
    `\n=== PHASE 3: SEEDING ${DEMO_SOCIETIES.length} ASKARI SOCIETIES WITH COMPLETE MODULE DATA ===`,
  );

  let receiptSeq = 1000;
  function nextReceipt(code: string): string {
    return `REC-${code}-${String(receiptSeq++).padStart(6, "0")}`;
  }

  for (const s of DEMO_SOCIETIES) {
    const baseCount = s.scale === "small" ? 400 : s.scale === "medium" ? 600 : 900;
    const targetResidentCount = baseCount + Math.floor(Math.random() * 200);
    const codeSum = s.code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    console.log(
      `\n[ASKARI] 🏛️ ${s.name} (${s.city}) [${s.code}] — Populating ${targetResidentCount} Units & Residents + All Modules`,
    );

    // 1. Tenant & Society
    await conn.query(
      `INSERT INTO tenants (id, name, slug, plan, timezone, currency, date_format, contact_email, contact_phone, address, code)
       VALUES (?, ?, ?, ?, 'Asia/Karachi', 'PKR', 'DD/MM/YYYY', ?, ?, ?, ?)`,
      [
        s.tenantId,
        s.name,
        s.slug,
        s.plan,
        `admin.${s.slug}${DEMO_EMAIL_DOMAIN}`,
        "+92 51 5000000",
        s.address,
        s.code,
      ],
    );
    await conn.query(
      "INSERT INTO societies (id, tenant_id, name, address, city, total_units) VALUES (?, ?, ?, ?, ?, ?)",
      [s.societyId, s.tenantId, s.name, s.address, s.city, targetResidentCount],
    );

    // 2. Activate All Modules
    for (const mod of ALL_MODULES) {
      await conn
        .query(
          "INSERT INTO tenant_modules (id, tenant_id, module_key, is_active) VALUES (?, ?, ?, TRUE)",
          [crypto.randomUUID(), s.tenantId, mod],
        )
        .catch(() => {});
    }

    // 3. Society Admin
    const socAdminId = crypto.randomUUID();
    const socAdminEmail = `admin.${s.slug}${DEMO_EMAIL_DOMAIN}`;
    await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      socAdminId,
      socAdminEmail,
      pwHash,
    ]);
    await conn.query(
      "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, ?, ?, ?)",
      [socAdminId, `${s.name} Society Admin`, s.name, "+92 300 5000000", s.tenantId],
    );
    await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [
      crypto.randomUUID(),
      socAdminId,
    ]);
    await conn.query(
      "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
      [crypto.randomUUID(), socAdminId, s.tenantId],
    );

    // 4. Staff Users
    const staffIds: Record<string, string> = {};
    const staffDefs = [
      { key: "guard", role: "guard", label: "Head Security Guard" },
      { key: "technician", role: "technician", label: "Lead Technician" },
      { key: "finance", role: "finance_head", label: "Finance & Accounts Head" },
      { key: "maintenance_head", role: "maintenance_head", label: "Maintenance Manager" },
      { key: "security_head", role: "security_head", label: "Chief Security Officer" },
    ];
    for (const sd of staffDefs) {
      const uid = crypto.randomUUID();
      await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        uid,
        `${sd.key}.${s.slug}${DEMO_EMAIL_DOMAIN}`,
        pwHash,
      ]);
      await conn.query(
        "INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, ?, ?, ?)",
        [uid, `${sd.label} (${s.code})`, s.name, "+92 300 4000000", s.tenantId],
      );
      await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
        crypto.randomUUID(),
        uid,
        sd.role,
      ]);
      staffIds[sd.key] = uid;
    }

    // 5. Custom Roles & SLA Configs
    const customRolesRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        "finance_officer",
        "Finance Officer",
        "Manages resident ledgers and invoice verification",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "maintenance_supervisor",
        "Maintenance Supervisor",
        "Assigns work orders and inspects asset maintenance",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "gate_supervisor",
        "Gate & Security Supervisor",
        "Oversees gate operations and visitor passes",
      ],
    ];
    await batchInsert(
      conn,
      "custom_roles",
      ["id", "tenant_id", "name", "label", "description"],
      customRolesRows,
    );

    const slaConfigsRows = [
      [crypto.randomUUID(), s.tenantId, "lift", "critical", 1, 4],
      [crypto.randomUUID(), s.tenantId, "plumbing", "high", 2, 8],
      [crypto.randomUUID(), s.tenantId, "electrical", "high", 2, 6],
      [crypto.randomUUID(), s.tenantId, "security", "critical", 1, 2],
      [crypto.randomUUID(), s.tenantId, "water", "high", 2, 8],
      [crypto.randomUUID(), s.tenantId, "cleaning", "low", 12, 24],
      [crypto.randomUUID(), s.tenantId, "general", "medium", 6, 24],
    ];
    await batchInsert(
      conn,
      "sla_configs",
      ["id", "tenant_id", "category", "priority", "response_hours", "resolution_hours"],
      slaConfigsRows,
    );

    // 6. PROPERTY HIERARCHY (Blocks, Towers, Floors, Units)
    const aptBlockId = crypto.randomUUID();
    const houseBlockId = crypto.randomUUID();
    const commBlockId = crypto.randomUUID();

    await conn.query(
      "INSERT INTO blocks (id, society_id, tenant_id, name, description) VALUES (?, ?, ?, 'Block A (Askari Heights & Towers)', 'Residential apartment complexes and penthouses')",
      [aptBlockId, s.societyId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO blocks (id, society_id, tenant_id, name, description) VALUES (?, ?, ?, 'Block B (Officer Villas & Houses)', 'Independent executive bungalows and villas')",
      [houseBlockId, s.societyId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO blocks (id, society_id, tenant_id, name, description) VALUES (?, ?, ?, 'Block C (Commercial Plaza & Market)', 'Commercial shopping plaza, banks and offices')",
      [commBlockId, s.societyId, s.tenantId],
    );

    const numHouses = Math.round(targetResidentCount * 0.25);
    const numTowers = Math.ceil((targetResidentCount * 0.7) / 40);
    const numShops = Math.round(targetResidentCount * 0.05);

    const unitsRows: any[][] = [];
    type UnitMeta = { id: string; num: string; type: string; blockId: string };
    const unitMetas: UnitMeta[] = [];

    // Independent Houses
    for (let h = 1; h <= numHouses; h++) {
      const uid = crypto.randomUUID();
      const unitNum = `${h * 2}-B`;
      unitsRows.push([
        uid,
        null,
        null,
        houseBlockId,
        s.societyId,
        s.tenantId,
        unitNum,
        "villa",
        4500,
        5,
        "occupied",
      ]);
      unitMetas.push({ id: uid, num: unitNum, type: "villa", blockId: houseBlockId });
    }

    // Apartment Towers & Flats
    for (let t = 1; t <= numTowers; t++) {
      const towerId = crypto.randomUUID();
      const towerName = `Askari Heights Tower ${String.fromCharCode(65 + (t % 26))}${t > 26 ? Math.floor(t / 26) : ""}`;
      await conn.query(
        "INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, ?, 10)",
        [towerId, aptBlockId, s.tenantId, towerName],
      );

      for (let fl = 1; fl <= 10; fl++) {
        const floorId = crypto.randomUUID();
        await conn.query(
          "INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, ?, ?)",
          [floorId, towerId, s.tenantId, fl, `Floor ${fl}`],
        );

        for (let apt = 1; apt <= 4; apt++) {
          if (unitMetas.length >= targetResidentCount - numShops) break;
          const uid = crypto.randomUUID();
          const isPenthouse = fl === 10 && apt === 4;
          const unitType = isPenthouse ? "penthouse" : "flat";
          const unitNum = `${fl}0${apt}`;
          unitsRows.push([
            uid,
            floorId,
            towerId,
            aptBlockId,
            s.societyId,
            s.tenantId,
            unitNum,
            unitType,
            isPenthouse ? 3500 : 1800,
            isPenthouse ? 4 : 3,
            "occupied",
          ]);
          unitMetas.push({ id: uid, num: unitNum, type: unitType, blockId: aptBlockId });
        }
      }
    }

    // Commercial Shops
    const commBldgId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, 'Askari Commercial Plaza', 2)",
      [commBldgId, commBlockId, s.tenantId],
    );
    const commFloorId = crypto.randomUUID();
    await conn.query(
      "INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, 1, 'Ground Floor')",
      [commFloorId, commBldgId, s.tenantId],
    );

    for (let sh = 1; sh <= numShops; sh++) {
      const uid = crypto.randomUUID();
      const unitNum = `Shop-${100 + sh}`;
      unitsRows.push([
        uid,
        commFloorId,
        commBldgId,
        commBlockId,
        s.societyId,
        s.tenantId,
        unitNum,
        "shop",
        900,
        0,
        "occupied",
      ]);
      unitMetas.push({ id: uid, num: unitNum, type: "shop", blockId: commBlockId });
    }

    await batchInsert(
      conn,
      "units",
      [
        "id",
        "floor_id",
        "building_id",
        "block_id",
        "society_id",
        "tenant_id",
        "unit_number",
        "unit_type",
        "area_sqft",
        "bedrooms",
        "status",
      ],
      unitsRows,
    );

    // 7. RESIDENTS, USERS, PROFILES, VEHICLES, WALLETS, LEDGERS, PAYMENTS
    const usersRows: any[][] = [];
    const profilesRows: any[][] = [];
    const userRolesRows: any[][] = [];
    const personsRows: any[][] = [];
    const residentsRows: any[][] = [];
    const vehiclesRows: any[][] = [];
    const walletsRows: any[][] = [];
    const ledgerRows: any[][] = [];
    const paymentsRows: any[][] = [];

    const chMaintId = crypto.randomUUID();
    const chRentId = crypto.randomUUID();
    const chSecId = crypto.randomUUID();
    const chUtilId = crypto.randomUUID();
    const chSinkId = crypto.randomUUID();

    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Monthly Maintenance Fee', 'Variable maintenance fee based on unit type and area', 15000.00)",
      [chMaintId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Monthly Property Rent', 'Monthly rent for tenant occupants', 65000.00)",
      [chRentId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Security & CCTV Service Charge', '24/7 Gate security & CCTV surveillance contribution', 2500.00)",
      [chSecId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Water & Sewage Utility Charge', 'Clean drinking water & sewage maintenance', 1500.00)",
      [chUtilId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Sinking Reserve Fund', 'Reserve contribution for long term asset replacements', 1000.00)",
      [chSinkId, s.tenantId],
    );

    const residentMetas: {
      userId: string;
      residentId: string;
      personId: string;
      name: string;
      phone: string;
      unitId: string;
      unitNum: string;
    }[] = [];

    for (let i = 0; i < unitMetas.length; i++) {
      const u = unitMetas[i];
      const resName = UNIQUE_NAMES[globalNameIdx++ % UNIQUE_NAMES.length];
      const resEmail = `resident.${s.slug}.${String(i + 1).padStart(4, "0")}${DEMO_EMAIL_DOMAIN}`;
      const resPhone = `+92 300 ${String(1000000 + ((globalNameIdx * 17) % 9000000)).slice(0, 7)}`;
      const resType: "owner" | "tenant" = i % 3 === 2 ? "tenant" : "owner";

      const resUserId = crypto.randomUUID();
      const personId = crypto.randomUUID();
      const residentId = crypto.randomUUID();

      usersRows.push([resUserId, resEmail, pwHash]);
      profilesRows.push([resUserId, resName, s.name, resPhone, s.tenantId]);
      userRolesRows.push([
        crypto.randomUUID(),
        resUserId,
        resType === "owner" ? "resident" : "tenant",
      ]);
      personsRows.push([
        personId,
        s.tenantId,
        resUserId,
        resName,
        resEmail,
        resPhone,
        `37405-${String(1000000 + i).slice(0, 7)}-1`,
      ]);
      residentsRows.push([
        residentId,
        personId,
        u.id,
        s.tenantId,
        resType,
        "2024-01-01",
        true,
        "accepted",
      ]);

      // Vehicle
      const vehicleMake = ["Toyota", "Honda", "Suzuki", "KIA", "Hyundai"][i % 5];
      const vehicleModel = ["Corolla", "Civic", "Alto", "Sportage", "Tucson"][i % 5];
      const plate = `${s.code.slice(0, 4)}-${String(i + 101)}`;
      vehiclesRows.push([
        crypto.randomUUID(),
        residentId,
        s.tenantId,
        "car",
        vehicleMake,
        vehicleModel,
        plate,
        "White",
      ]);

      // Financials
      let maintFee = 15000;
      if (u.type === "villa") maintFee = 35000;
      else if (u.type === "penthouse") maintFee = 25000;
      else if (u.type === "flat") maintFee = 15000;
      else if (u.type === "shop") maintFee = 8000;

      let rentFee = 0;
      if (resType === "tenant") {
        if (u.type === "villa") rentFee = 180000;
        else if (u.type === "penthouse") rentFee = 125000;
        else if (u.type === "flat") rentFee = 65000;
        else if (u.type === "shop") rentFee = 45000;
      }

      const totalCharge = maintFee + rentFee + 2500 + 1500 + 1000;
      const historyMonths = [
        { label: "Apr 2026", period: "2026-04", date: "2026-04-05" },
        { label: "May 2026", period: "2026-05", date: "2026-05-05" },
        { label: "Jun 2026", period: "2026-06", date: "2026-06-05" },
        { label: "Jul 2026", period: "2026-07", date: "2026-07-05" },
        { label: "Aug 2026", period: "2026-08", date: "2026-08-05" }
      ];

      walletsRows.push([crypto.randomUUID(), s.tenantId, u.id, 0.0, 5000.0]);

      for (const m of historyMonths) {
        const receiptNo = nextReceipt(s.code.replace(/[^A-Z0-9]/g, ""));
        ledgerRows.push([
          crypto.randomUUID(),
          s.tenantId,
          u.id,
          "charge",
          chMaintId,
          maintFee,
          `Monthly Maintenance Fee - ${m.label}`,
          m.period,
          maintFee,
          socAdminId,
        ]);
        if (resType === "tenant" && rentFee > 0) {
          ledgerRows.push([
            crypto.randomUUID(),
            s.tenantId,
            u.id,
            "charge",
            chRentId,
            rentFee,
            `Monthly Property Rent - ${m.label}`,
            m.period,
            maintFee + rentFee,
            socAdminId,
          ]);
        }
        ledgerRows.push([
          crypto.randomUUID(),
          s.tenantId,
          u.id,
          "charge",
          chSecId,
          2500.0,
          `Security & CCTV Charge - ${m.label}`,
          m.period,
          maintFee + rentFee + 2500,
          socAdminId,
        ]);
        paymentsRows.push([
          crypto.randomUUID(),
          s.tenantId,
          u.id,
          totalCharge,
          "bank_transfer",
          receiptNo,
          m.date,
          `TXN-${receiptNo}`,
          "Paid via Habib Bank / Meezan Online",
          "recorded",
          socAdminId,
        ]);
        ledgerRows.push([
          crypto.randomUUID(),
          s.tenantId,
          u.id,
          "payment",
          chMaintId,
          totalCharge,
          `Payment Received - Receipt #${receiptNo}`,
          m.period,
          0.0,
          socAdminId,
        ]);
      }

      residentMetas.push({
        userId: resUserId,
        residentId,
        personId,
        name: resName,
        phone: resPhone,
        unitId: u.id,
        unitNum: u.num,
      });
    }

    await batchInsert(conn, "users", ["id", "email", "password_hash"], usersRows);
    await batchInsert(
      conn,
      "profiles",
      ["id", "full_name", "society_name", "phone", "tenant_id"],
      profilesRows,
    );
    await batchInsert(conn, "user_roles", ["id", "user_id", "role"], userRolesRows);
    await batchInsert(
      conn,
      "persons",
      ["id", "tenant_id", "user_id", "full_name", "email", "phone", "cnic"],
      personsRows,
    );
    await batchInsert(
      conn,
      "residents",
      [
        "id",
        "person_id",
        "unit_id",
        "tenant_id",
        "type",
        "move_in_date",
        "is_current",
        "invite_status",
      ],
      residentsRows,
    );
    await batchInsert(
      conn,
      "resident_vehicles",
      ["id", "resident_id", "tenant_id", "vehicle_type", "make", "model", "plate_number", "color"],
      vehiclesRows,
    );
    await batchInsert(
      conn,
      "wallets",
      ["id", "tenant_id", "unit_id", "balance", "low_balance_threshold"],
      walletsRows,
    );
    await batchInsert(
      conn,
      "ledger_entries",
      [
        "id",
        "tenant_id",
        "unit_id",
        "type",
        "charge_head_id",
        "amount",
        "description",
        "billing_period",
        "balance_after",
        "created_by",
      ],
      ledgerRows,
    );
    await batchInsert(
      conn,
      "payments",
      [
        "id",
        "tenant_id",
        "unit_id",
        "amount",
        "payment_method",
        "receipt_number",
        "payment_date",
        "reference",
        "notes",
        "status",
        "recorded_by",
      ],
      paymentsRows,
    );

    // 8. BUDGETS & BUDGET LINE ITEMS (FINANCIAL TRANSPARENCY & BUDGET MODULE)
    const budget2025Id = crypto.randomUUID();
    const budget2026Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO budgets (id, tenant_id, year, title, is_approved) VALUES (?, ?, 2025, 'Annual Operational Budget 2025-26', TRUE)",
      [budget2025Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO budgets (id, tenant_id, year, title, is_approved) VALUES (?, ?, 2026, 'Approved Society Budget 2026-27', TRUE)",
      [budget2026Id, s.tenantId],
    );

    const budgetLinesRows = [
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Security & Guard Operations",
        12500000.0,
        7800000.0,
      ],
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Generator Fuel & Heavy Power",
        8500000.0,
        5200000.0,
      ],
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Lifts & Elevator AMC Maintenance",
        4500000.0,
        2900000.0,
      ],
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Water Filtration & Tubewell Power",
        3800000.0,
        2400000.0,
      ],
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Horticulture, Parks & Landscaping",
        2200000.0,
        1400000.0,
      ],
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Janitorial & Waste Management",
        3500000.0,
        2100000.0,
      ],
      [
        crypto.randomUUID(),
        budget2026Id,
        s.tenantId,
        "Capital Improvements & Road Works",
        6000000.0,
        3100000.0,
      ],
    ];
    await batchInsert(
      conn,
      "budget_line_items",
      ["id", "budget_id", "tenant_id", "category", "planned_amount", "actual_amount"],
      budgetLinesRows,
    );

    // 9. VENDORS, RFQS, QUOTATIONS, PURCHASE ORDERS, VENDOR INVOICES
    const vGenId = crypto.randomUUID();
    const vLiftId = crypto.randomUUID();
    const vSecId = crypto.randomUUID();
    const vElecId = crypto.randomUUID();
    const vPlumbId = crypto.randomUUID();

    const vendorsRows = [
      [
        vGenId,
        s.tenantId,
        `${s.name} PowerPlus Generators`,
        "Generators & Power",
        "+92 300 8111222",
        "info@powerplus.pk",
        4.9,
        `${s.city} Industrial Area`,
        `NTN-${1000000 + (codeSum % 9000000)}-1`,
        "Engr. Farhan Malik",
        "Habib Bank - 0192837465",
        "active",
      ],
      [
        vLiftId,
        s.tenantId,
        `${s.name} Apex Elevator Services`,
        "Lifts & Elevators",
        "+92 300 8333444",
        "support@apexlifts.com.pk",
        4.8,
        `${s.city} Engineering Zone`,
        `NTN-${1000000 + (codeSum % 9000000)}-4`,
        "Tariq Siddiqui",
        "Meezan Bank - 0293847561",
        "active",
      ],
      [
        vSecId,
        s.tenantId,
        `${s.name} Frontier Security Guards`,
        "Security Services",
        "+92 51 4455667",
        "ops@frontierguards.pk",
        4.7,
        `${s.address}`,
        `NTN-${1000000 + (codeSum % 9000000)}-9`,
        "Col. (R) Javed Akhtar",
        "Bank Alfalah - 0987654321",
        "active",
      ],
      [
        vElecId,
        s.tenantId,
        `${s.name} VoltCare Electricals`,
        "Electrical & Transformers",
        "+92 321 9998811",
        "sales@voltcare.com.pk",
        4.6,
        `${s.city} Commercial Zone`,
        `NTN-${1000000 + (codeSum % 9000000)}-0`,
        "Naveed Khan",
        "MCB Bank - 0817263541",
        "active",
      ],
      [
        vPlumbId,
        s.tenantId,
        `${s.name} AquaFlow Commercial Plumbing`,
        "Plumbing & Pumps",
        "+92 333 5554422",
        "service@aquaflow.pk",
        4.5,
        `${s.city} Utility Market`,
        `NTN-${1000000 + (codeSum % 9000000)}-2`,
        "Danish Butt",
        "Allied Bank - 0493827162",
        "active",
      ],
    ];
    await batchInsert(
      conn,
      "vendors",
      [
        "id",
        "tenant_id",
        "name",
        "category",
        "phone",
        "email",
        "rating",
        "address",
        "tax_id",
        "contact_person",
        "bank_details",
        "status",
      ],
      vendorsRows,
    );

    // RFQs & Quotations
    const rfq1Id = crypto.randomUUID();
    const rfq2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO rfqs (id, tenant_id, title, description, status, due_date, budget_amount) VALUES (?, ?, 'Annual Lift AMC Comprehensive Contract', 'Preventive maintenance and breakdown emergency coverage for all tower lifts', 'awarded', '2026-06-30', 2500000.00)",
      [rfq1Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO rfqs (id, tenant_id, title, description, status, due_date, budget_amount) VALUES (?, ?, 'Solar Inverter 100kW Replacement', 'Replacement of common area solar hybrid inverters', 'sent', '2026-09-15', 3800000.00)",
      [rfq2Id, s.tenantId],
    );

    const quote1Id = crypto.randomUUID();
    const quote2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO quotations (id, rfq_id, vendor_id, tenant_id, amount, notes, status, delivery_timeline, valid_until, quotation_number) VALUES (?, ?, ?, ?, 2350000.00, 'Includes 24/7 on-site technician and all routine spare parts.', 'approved', 'Immediate', '2026-12-31', 'QT-APEX-2026-01')",
      [quote1Id, rfq1Id, vLiftId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO quotations (id, rfq_id, vendor_id, tenant_id, amount, notes, status, delivery_timeline, valid_until, quotation_number) VALUES (?, ?, ?, ?, 3650000.00, 'Huawei 100kW On-Grid inverter with 5 year warranty.', 'pending', '3 Weeks', '2026-10-15', 'QT-VOLT-2026-88')",
      [quote2Id, rfq2Id, vElecId, s.tenantId],
    );

    // Purchase Orders & Vendor Invoices
    const po1Id = crypto.randomUUID();
    const po2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO purchase_orders (id, tenant_id, vendor_id, amount, status, po_number, rfq_id, quotation_id, notes) VALUES (?, ?, ?, 2350000.00, 'approved', 'PO-ASK-2026-001', ?, ?, 'Full year AMC payment released quarterly in advance.')",
      [po1Id, s.tenantId, vLiftId, rfq1Id, quote1Id],
    );
    await conn.query(
      "INSERT INTO purchase_orders (id, tenant_id, vendor_id, amount, status, po_number, rfq_id, quotation_id, notes) VALUES (?, ?, ?, 850000.00, 'completed', 'PO-ASK-2026-002', NULL, NULL, 'Bi-annual Cummins Generator major overhaul and filter replacement.')",
      [po2Id, s.tenantId, vGenId],
    );

    const inv1Id = crypto.randomUUID();
    const inv2Id = crypto.randomUUID();
    const inv3Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO vendor_invoices (id, tenant_id, vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, amount, paid_amount, status, notes, recorded_by) VALUES (?, ?, ?, ?, 'INV-APEX-Q1', '2026-07-01', '2026-07-31', 587500.00, 587500.00, 'paid', 'Q1 AMC Invoice Settled', ?)",
      [inv1Id, s.tenantId, vLiftId, po1Id, socAdminId],
    );
    await conn.query(
      "INSERT INTO vendor_invoices (id, tenant_id, vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, amount, paid_amount, status, notes, recorded_by) VALUES (?, ?, ?, ?, 'INV-APEX-Q2', '2026-08-01', '2026-08-31', 587500.00, 0.00, 'pending', 'Q2 AMC Invoice under processing', ?)",
      [inv2Id, s.tenantId, vLiftId, po1Id, socAdminId],
    );
    await conn.query(
      "INSERT INTO vendor_invoices (id, tenant_id, vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, amount, paid_amount, status, notes, recorded_by) VALUES (?, ?, ?, ?, 'INV-GEN-902', '2026-07-15', '2026-08-15', 850000.00, 850000.00, 'paid', 'Generator Overhaul parts and labor', ?)",
      [inv3Id, s.tenantId, vGenId, po2Id, socAdminId],
    );

    // 10. INVENTORY ITEMS & STOCK MOVEMENTS
    const invItemsRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        "Philips LED Corridor Tube Lights 36W",
        "ELEC-LED-001",
        "Electrical",
        "pcs",
        150.0,
        30.0,
        850.0,
        "Central Store - Shelf E1",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Schneider MCB Single Pole Breaker 16A",
        "ELEC-MCB-016",
        "Electrical",
        "pcs",
        65.0,
        15.0,
        450.0,
        "Central Store - Shelf E2",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "PPRC Heavy Water Pipes 32mm",
        "PLUMB-PPRC-32",
        "Plumbing",
        "lengths",
        40.0,
        10.0,
        1250.0,
        "Plumbing Bay - Rack P1",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Brass Water Ball Valve 1-inch",
        "PLUMB-VALV-01",
        "Plumbing",
        "pcs",
        28.0,
        8.0,
        1800.0,
        "Plumbing Bay - Rack P2",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Cummins Diesel Engine Fuel Filter",
        "GEN-FLTR-882",
        "Generators",
        "pcs",
        12.0,
        4.0,
        8500.0,
        "Power House Store",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "High Pressure Water Booster Impeller",
        "PUMP-IMP-003",
        "Pumps",
        "pcs",
        6.0,
        2.0,
        14500.0,
        "Pump Room Store",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Commercial Janitorial Floor Cleaner 20L",
        "CLEN-FLR-020",
        "Cleaning",
        "drums",
        18.0,
        5.0,
        3200.0,
        "Janitorial Stockroom",
      ],
    ];
    await batchInsert(
      conn,
      "inventory_items",
      [
        "id",
        "tenant_id",
        "name",
        "sku",
        "category",
        "unit_of_measure",
        "quantity",
        "reorder_level",
        "unit_cost",
        "location",
      ],
      invItemsRows,
    );

    const [allInvRows] = (await conn.query(
      "SELECT id, name FROM inventory_items WHERE tenant_id = ?",
      [s.tenantId],
    )) as any[];
    if (allInvRows.length > 0) {
      await conn.query(
        "INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, reference, notes, created_by) VALUES (?, ?, ?, 'in', 50.00, 'PO-ASK-2026-004', 'Bulk seasonal restocking', ?)",
        [crypto.randomUUID(), s.tenantId, allInvRows[0].id, socAdminId],
      );
      await conn.query(
        "INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, reference, notes, created_by) VALUES (?, ?, ?, 'out', 4.00, 'WO-MAINT-891', 'Replacement in Block A stairwell corridor', ?)",
        [crypto.randomUUID(), s.tenantId, allInvRows[0].id, staffIds["technician"]],
      );
    }

    // 11. PROJECTS, MILESTONES & EXPENSES
    const projectTemplates = [
      {
        key: "cctv",
        name: "CCTV & AI Security Upgrade",
        desc: "Upgrading boundary and gate security with AI facial recognition cameras",
        baseBudget: 6500000.0,
        milestones: [
          {
            title: "Optical Fiber Cabling & Network Switch Laying",
            offsetDays: -40,
            status: "completed",
            notes: "All fiber trenches laid.",
          },
          {
            title: "Camera Hardware Installation",
            offsetDays: 0,
            status: "in_progress",
            notes: "Mounting cameras on perimeters.",
          },
          {
            title: "Control Room Console Setup",
            offsetDays: 20,
            status: "planned",
            notes: "NVR configuration.",
          },
        ],
        expenseTemplates: [
          {
            title: "Fiber Optic Cable Drum 4000m & Media Converters",
            baseAmount: 1850000.0,
            offsetDays: -35,
            vendorType: "elec",
          },
          {
            title: "Hikvision 4K IP Cameras (Part 1)",
            baseAmount: 1620000.0,
            offsetDays: -10,
            vendorType: "elec",
          },
        ],
      },
      {
        key: "solar",
        name: "Solar Hybridization Project",
        desc: "Installing Solar PV systems on residential tower rooftops to reduce common electricity costs",
        baseBudget: 14000000.0,
        milestones: [
          {
            title: "Rooftop Structural Load Analysis",
            offsetDays: -15,
            status: "completed",
            notes: "Structural survey complete.",
          },
          {
            title: "Solar Inverters & Panels Delivery",
            offsetDays: 15,
            status: "planned",
            notes: "Awaiting customs clearance.",
          },
        ],
        expenseTemplates: [
          {
            title: "Initial Consultant Survey & Structural Report Fee",
            baseAmount: 450000.0,
            offsetDays: -15,
            vendorType: "elec",
          },
        ],
      },
      {
        key: "gate",
        name: "Main Entrance Gate Reconstruction",
        desc: "Beautification and structural reinforcement of the main society entry gate",
        baseBudget: 4500000.0,
        milestones: [
          {
            title: "Demolition & Foundation Excavation",
            offsetDays: -60,
            status: "completed",
            notes: "Old structure cleared.",
          },
          {
            title: "Structure RCC Columns Curing",
            offsetDays: -30,
            status: "completed",
            notes: "Load testing passed.",
          },
          {
            title: "Aesthetic Brickwork & Arch Painting",
            offsetDays: 10,
            status: "in_progress",
            notes: "Applying base coat.",
          },
        ],
        expenseTemplates: [
          {
            title: "Raw Material Cement & Steel Reinforcement Supply",
            baseAmount: 2200000.0,
            offsetDays: -50,
            vendorType: "plumb",
          },
          {
            title: "Masonry & Steelwork Contractor Installment",
            baseAmount: 1500000.0,
            offsetDays: -25,
            vendorType: "lift",
          },
        ],
      },
      {
        key: "mosque",
        name: "Central Mosque Refurbishment",
        desc: "Interior redesign, new carpet layout, acoustic sound system, and central air conditioning for Mosque",
        baseBudget: 8000000.0,
        milestones: [
          {
            title: "HVAC Ducting & AC Mounting",
            offsetDays: -10,
            status: "completed",
            notes: "Main VRF outdoor unit installed.",
          },
          {
            title: "Acoustic Insulation & Carpet Laying",
            offsetDays: 10,
            status: "in_progress",
            notes: "Installing soundproofing panels.",
          },
        ],
        expenseTemplates: [
          {
            title: "Central AC Units & Compressor Supply",
            baseAmount: 4800000.0,
            offsetDays: -8,
            vendorType: "elec",
          },
        ],
      },
      {
        key: "sports",
        name: "Sports Complex & Swimming Pool",
        desc: "Construction of an indoor sports hall, gym, and an Olympic-sized swimming pool",
        baseBudget: 35000000.0,
        milestones: [
          {
            title: "Excavation and Land Leveling",
            offsetDays: -20,
            status: "completed",
            notes: "Pool basin excavated.",
          },
          {
            title: "Pool Plastering & Waterproofing Concrete",
            offsetDays: 15,
            status: "in_progress",
            notes: "Applying epoxy coating.",
          },
        ],
        expenseTemplates: [
          {
            title: "Excavation Heavy Machinery Rental",
            baseAmount: 3200000.0,
            offsetDays: -18,
            vendorType: "plumb",
          },
        ],
      },
      {
        key: "lifts",
        name: "Elevator Modernization Program",
        desc: "Upgrading lift cabins, safety controllers, and traction motors across multiple blocks",
        baseBudget: 12000000.0,
        milestones: [
          {
            title: "Traction Motor Replacements",
            offsetDays: -30,
            status: "completed",
            notes: "Motors upgraded in Block A & B.",
          },
          {
            title: "Cabin Interior Styling & LED Upgrade",
            offsetDays: 0,
            status: "in_progress",
            notes: "Currently upgrading Block C cabin.",
          },
        ],
        expenseTemplates: [
          {
            title: "Traction Motors Import & Customs Clearance Duty",
            baseAmount: 5500000.0,
            offsetDays: -25,
            vendorType: "lift",
          },
          {
            title: "Cabin Interior Woodwork and Stainless Steel Sheets",
            baseAmount: 2400000.0,
            offsetDays: -5,
            vendorType: "lift",
          },
        ],
      },
      {
        key: "roads",
        name: "Main Roads Asphalt Resurfacing",
        desc: "Repaving and line-marking of the society's primary boulevards and commercial lanes",
        baseBudget: 18000000.0,
        milestones: [
          {
            title: "Asphalt Milling & Leveling",
            offsetDays: -12,
            status: "completed",
            notes: "Milling complete.",
          },
          {
            title: "Asphalt Overlay Laying",
            offsetDays: 0,
            status: "in_progress",
            notes: "Laying 3-inch hot-mix asphalt.",
          },
          {
            title: "Road Cat Eyes & Lane Marking",
            offsetDays: 10,
            status: "planned",
            notes: "Using thermoplastic paint.",
          },
        ],
        expenseTemplates: [
          {
            title: "Hot-Mix Asphalt & Bitumen Tanker Supply",
            baseAmount: 9200000.0,
            offsetDays: -8,
            vendorType: "plumb",
          },
        ],
      },
      {
        key: "water",
        name: "Water Filtration RO Plant Setup",
        desc: "Installing high-capacity Reverse Osmosis filtration systems to provide clean drinking water",
        baseBudget: 5000000.0,
        milestones: [
          {
            title: "Filtration Building Construction",
            offsetDays: -45,
            status: "completed",
            notes: "Building shell ready.",
          },
          {
            title: "Membrane Filters & RO Equipment Mounting",
            offsetDays: -15,
            status: "completed",
            notes: "RO skids connected.",
          },
          {
            title: "Water Pipe Network Integration",
            offsetDays: 5,
            status: "in_progress",
            notes: "Connecting to main reservoir.",
          },
        ],
        expenseTemplates: [
          {
            title: "RO Skids & Heavy Filtration Membrane Import",
            baseAmount: 3100000.0,
            offsetDays: -20,
            vendorType: "plumb",
          },
        ],
      },
    ];

    const pickedTemplates: typeof projectTemplates = [];
    const tempIndices = new Set<number>();

    // Select exactly 3 projects deterministically per society
    while (tempIndices.size < 3) {
      const nextIdx = (codeSum + tempIndices.size * 3) % projectTemplates.length;
      if (tempIndices.has(nextIdx)) {
        let found = false;
        for (let i = 0; i < projectTemplates.length; i++) {
          if (!tempIndices.has(i)) {
            tempIndices.add(i);
            pickedTemplates.push(projectTemplates[i]);
            found = true;
            break;
          }
        }
        if (!found) break;
      } else {
        tempIndices.add(nextIdx);
        pickedTemplates.push(projectTemplates[nextIdx]);
      }
    }

    for (const t of pickedTemplates) {
      const variance = 0.85 + (codeSum % 30) / 100; // 0.85 to 1.15 budget multiplier
      const budget = Math.round((t.baseBudget * variance) / 1000) * 1000;

      const pId = crypto.randomUUID();
      const pName = `${s.name} ${t.name}`;
      const pDesc = t.desc;

      const statuses: ("planning" | "in_progress" | "completed" | "on_hold")[] = [
        "planning",
        "in_progress",
        "completed",
        "on_hold",
      ];
      const status = statuses[(codeSum + pickedTemplates.indexOf(t)) % statuses.length];

      await conn.query(
        "INSERT INTO projects (id, tenant_id, name, description, status, budget_amount, start_date, end_date, owner_id, resident_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
        [
          pId,
          s.tenantId,
          pName,
          pDesc,
          status,
          budget,
          "2026-04-01",
          status === "completed" ? "2026-08-01" : "2026-12-31",
          socAdminId,
        ],
      );

      for (const m of t.milestones) {
        let mStatus = m.status;
        if (status === "completed") {
          mStatus = "completed";
        } else if (status === "planning") {
          mStatus = "planned";
        }

        const baseDate = new Date("2026-09-01");
        baseDate.setDate(baseDate.getDate() + m.offsetDays);
        const dueDate = baseDate.toISOString().split("T")[0];

        await conn.query(
          "INSERT INTO project_milestones (id, tenant_id, project_id, title, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [crypto.randomUUID(), s.tenantId, pId, m.title, dueDate, mStatus, m.notes],
        );
      }

      if (status === "completed" || status === "in_progress") {
        for (const e of t.expenseTemplates) {
          const expenseAmount = Math.round((e.baseAmount * variance) / 1000) * 1000;
          const vendorId =
            e.vendorType === "elec"
              ? vElecId
              : e.vendorType === "plumb"
                ? vPlumbId
                : e.vendorType === "lift"
                  ? vLiftId
                  : vGenId;

          const baseDate = new Date("2026-09-01");
          baseDate.setDate(baseDate.getDate() + e.offsetDays);
          const expDate = baseDate.toISOString().split("T")[0];

          await conn.query(
            "INSERT INTO project_expenses (id, tenant_id, project_id, vendor_id, title, amount, expense_date, invoice_number, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              s.tenantId,
              pId,
              vendorId,
              e.title,
              expenseAmount,
              expDate,
              `INV-${s.code}-${100 + (codeSum % 900)}`,
              e.notes,
              socAdminId,
            ],
          );
        }
      }
    }

    // 12. ASSETS, MAINTENANCE SCHEDULES & WORK ORDERS (WITH AI PREDICTION DATA)
    const assetGenId = crypto.randomUUID();
    const assetLift1Id = crypto.randomUUID();
    const assetLift2Id = crypto.randomUUID();
    const assetPumpId = crypto.randomUUID();
    const assetTransId = crypto.randomUUID();

    const assetsRows = [
      [
        assetGenId,
        s.tenantId,
        "Cummins 250kVA Prime Generator",
        "generators",
        "Power Room Basement 1",
        `GEN-${s.code}-01`,
        "2023-01-15",
        9500000.0,
        8200000.0,
        "active",
        "2028-12-31",
        true,
        vGenId,
        450000.0,
        "2026-01-01",
        "2026-12-31",
        "Backup generator for water booster and lifts",
      ],
      [
        assetLift1Id,
        s.tenantId,
        "Mitsubishi Passenger Elevator #1 (Tower A)",
        "elevators",
        "Askari Tower A",
        `ELV-${s.code}-A1`,
        "2022-06-10",
        6800000.0,
        5600000.0,
        "active",
        "2027-06-30",
        true,
        vLiftId,
        380000.0,
        "2026-01-01",
        "2026-12-31",
        "10-passenger high speed lift",
      ],
      [
        assetLift2Id,
        s.tenantId,
        "Mitsubishi Passenger Elevator #2 (Tower A)",
        "elevators",
        "Askari Tower A",
        `ELV-${s.code}-A2`,
        "2022-06-10",
        6800000.0,
        5600000.0,
        "active",
        "2027-06-30",
        true,
        vLiftId,
        380000.0,
        "2026-01-01",
        "2026-12-31",
        "10-passenger high speed lift",
      ],
      [
        assetPumpId,
        s.tenantId,
        "Grundfos Hydro Multi-E Water Booster System",
        "pumps",
        "Main Pump House",
        `PMP-${s.code}-01`,
        "2023-03-20",
        3200000.0,
        2700000.0,
        "active",
        "2028-03-31",
        true,
        vPlumbId,
        180000.0,
        "2026-01-01",
        "2026-12-31",
        "Continuous water pressure booster system",
      ],
      [
        assetTransId,
        s.tenantId,
        "Siemens 500kVA Step-Down Transformer",
        "electrical",
        "Substation Yard",
        `TRF-${s.code}-01`,
        "2021-11-05",
        8500000.0,
        7100000.0,
        "active",
        "2031-11-30",
        false,
        null,
        0.0,
        null,
        null,
        "Main grid distribution transformer",
      ],
    ];
    await batchInsert(
      conn,
      "assets",
      [
        "id",
        "tenant_id",
        "name",
        "category",
        "location",
        "serial_number",
        "purchase_date",
        "purchase_cost",
        "current_valuation",
        "status",
        "warranty_expires_at",
        "has_amc",
        "amc_vendor_id",
        "amc_cost",
        "amc_start_date",
        "amc_expires_at",
        "notes",
      ],
      assetsRows,
    );

    const maintSchedsRows = [
      [
        crypto.randomUUID(),
        assetGenId,
        s.tenantId,
        "Quarterly Engine Oil & Filter Change",
        "quarterly",
        "Drain and replace lube oil, change air & diesel filters, test automatic transfer switch",
        "2026-09-15",
        vGenId,
        staffIds["technician"],
        true,
        "Standard OEM procedure",
      ],
      [
        crypto.randomUUID(),
        assetLift1Id,
        s.tenantId,
        "Monthly Elevator Safety & Brake Inspection",
        "monthly",
        "Inspect hoist ropes, check brake shoe clearance, test emergency phone & door interlocks",
        "2026-09-01",
        vLiftId,
        staffIds["technician"],
        true,
        "Mandatory safety certificate renewal check",
      ],
      [
        crypto.randomUUID(),
        assetPumpId,
        s.tenantId,
        "Weekly Pressure Vessel & Seal Inspection",
        "weekly",
        "Check mechanical seals for leaks, verify digital pressure sensors and auto cutoff",
        "2026-08-30",
        null,
        staffIds["technician"],
        true,
        "In-house maintenance checklist",
      ],
    ];
    await batchInsert(
      conn,
      "maintenance_schedules",
      [
        "id",
        "asset_id",
        "tenant_id",
        "title",
        "frequency",
        "task_description",
        "next_due_date",
        "assigned_vendor_id",
        "assigned_technician_id",
        "is_active",
        "notes",
      ],
      maintSchedsRows,
    );

    const workOrdersRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        assetLift1Id,
        "Quarterly Elevator Hoist Inspection",
        "Complete comprehensive mechanical overhaul and lubrication of guide rails.",
        "completed",
        "normal",
        staffIds["technician"],
        vLiftId,
        35000.0,
        35000.0,
        35000.0,
        "2026-08-01",
        "2026-08-02 14:00:00",
        "Brakes adjusted, smooth operation confirmed",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        assetGenId,
        "Automatic Transfer Switch (ATS) Relay Tuning",
        "ATS relay calibration to ensure switchover time is under 8 seconds.",
        "in_progress",
        "high",
        staffIds["technician"],
        vGenId,
        18000.0,
        20000.0,
        0.0,
        "2026-08-28",
        null,
        "Testing ongoing during load-shedding window",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        assetPumpId,
        "Booster Pump #2 Mechanical Seal Replacement",
        "Minor water seepage observed at secondary seal junction.",
        "open",
        "normal",
        staffIds["technician"],
        vPlumbId,
        12500.0,
        15000.0,
        0.0,
        "2026-09-02",
        null,
        "Spares requested from inventory",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        null,
        "Corridor Lighting Circuit Breaker Reset",
        "Block A 4th floor corridor breaker tripped due to fused bulb.",
        "completed",
        "low",
        staffIds["technician"],
        null,
        2500.0,
        2500.0,
        2500.0,
        "2026-08-15",
        "2026-08-15 11:30:00",
        "Replaced fused tube light and re-energized circuit",
      ],
    ];

    // Add extra random work orders to differentiate societies
    const extraWoCount = 3 + Math.floor(Math.random() * 6); // 3 to 8 extra jobs
    const woTitles = [
      "Staircase Railing Welding Repair",
      "Basement Drainage Pump De-silting",
      "Fire Extinguisher Annual Pressure Test",
      "Intercom Cable Fault Localization",
      "Sewer Mainline High-Pressure Jetting",
      "Security Guard Cabin Fan Replacement",
      "Main Water Tank Valve Greasing",
      "Roof Waterproofing Patch Work"
    ];
    const woDescs = [
      "Weld loose joints on Block A staircase railing.",
      "Clear silt and debris from primary drainage sump in basement.",
      "Check pressure gauge and refill dry chemical powder.",
      "Trace and splice broken audio wire for Apartment 402.",
      "Clear blockage using mechanical high-pressure jetting machine.",
      "Replace faulty ceiling fan capacitor in guard room.",
      "Apply heavy industrial grease to main gate valves.",
      "Apply bitumen coat to minor cracks on roof floor."
    ];
    const assetsForWo = [assetGenId, assetLift1Id, assetLift2Id, assetPumpId, null];
    
    for (let w = 0; w < extraWoCount; w++) {
      const idx = Math.floor(Math.random() * woTitles.length);
      const isCompleted = Math.random() > 0.4;
      const priority = Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "normal" : "low";
      const costVal = 1500 + Math.floor(Math.random() * 20000);
      
      workOrdersRows.push([
        crypto.randomUUID(),
        s.tenantId,
        assetsForWo[Math.floor(Math.random() * assetsForWo.length)],
        woTitles[idx],
        woDescs[idx],
        isCompleted ? "completed" : Math.random() > 0.5 ? "in_progress" : "open",
        priority,
        staffIds["technician"],
        Math.random() > 0.5 ? vLiftId : null,
        costVal,
        costVal + 500,
        isCompleted ? costVal : 0,
        "2026-08-30",
        isCompleted ? "2026-08-30 15:30:00" : null,
        "Standard repair completed.",
      ]);
    }

    await batchInsert(
      conn,
      "maintenance_work_orders",
      [
        "id",
        "tenant_id",
        "asset_id",
        "title",
        "description",
        "status",
        "priority",
        "assigned_technician_id",
        "assigned_vendor_id",
        "cost",
        "estimated_cost",
        "actual_cost",
        "sla_due_at",
        "completed_at",
        "notes",
      ],
      workOrdersRows,
    );

    // 13. COMPLAINTS, COMMENTS & HISTORY
    const numComplaints = Math.floor(targetResidentCount * (0.06 + Math.random() * 0.08));

    const complaintsRows: any[][] = [];
    const complaintDefs = [
      {
        title: "Water Pressure Low on Upper Floors",
        cat: "water",
        prio: "medium",
        status: "in_progress",
      },
      {
        title: "Basement Pipe Leakage near Parking",
        cat: "plumbing",
        prio: "high",
        status: "open",
      },
      {
        title: "Corridor Light Fixture Fused in Block A",
        cat: "electrical",
        prio: "low",
        status: "resolved",
      },
      { title: "Main Gate RFID Scanner Delay", cat: "security", prio: "high", status: "open" },
      {
        title: "Passenger Elevator Jerking Motion",
        cat: "lift",
        prio: "critical",
        status: "in_progress",
      },
      { title: "Garbage Collection Delayed", cat: "general", prio: "low", status: "resolved" },
    ];

    for (let c = 0; c < numComplaints; c++) {
      const cd = complaintDefs[c % complaintDefs.length];
      const submitter = residentMetas[c % residentMetas.length];
      const compId = crypto.randomUUID();
      complaintsRows.push([
        compId,
        s.tenantId,
        submitter.unitId,
        submitter.userId,
        staffIds["technician"],
        cd.cat,
        cd.prio,
        cd.status,
        cd.title,
        "Maintenance issue reported by resident.",
        "2026-08-30 18:00:00",
        false,
        cd.status === "resolved" ? 5 : null,
        cd.status === "resolved" ? "Issue inspected and resolved by on-duty technician." : null,
        submitter.userId,
      ]);
    }
    await batchInsert(
      conn,
      "complaints",
      [
        "id",
        "tenant_id",
        "unit_id",
        "submitted_by",
        "assigned_to",
        "category",
        "priority",
        "status",
        "title",
        "description",
        "sla_deadline",
        "escalated",
        "satisfaction_rating",
        "resolution_notes",
        "created_by",
      ],
      complaintsRows,
    );

    const firstCompId = complaintsRows[0][0];
    await conn.query(
      "INSERT INTO complaint_comments (id, complaint_id, author_id, body, is_internal) VALUES (?, ?, ?, 'Technician has been dispatched with booster pressure gauges.', FALSE)",
      [crypto.randomUUID(), firstCompId, staffIds["technician"]],
    );
    await conn.query(
      "INSERT INTO complaint_history (id, complaint_id, changed_by, field_changed, old_value, new_value) VALUES (?, ?, ?, 'status', 'open', 'in_progress')",
      [crypto.randomUUID(), firstCompId, staffIds["technician"]],
    );

    // 14. GATE TERMINALS, GUARD PATROLS, VISITOR PASSES, ENTRY/EXIT LOGS, DOMESTIC STAFF, BLACKLIST
    const gt1Id = crypto.randomUUID();
    const gt2Id = crypto.randomUUID();
    const gt3Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Main North Gate 1', 'North Boundary Avenue', 'active')",
      [gt1Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Executive South Gate 2', 'South Boulevard Exit', 'active')",
      [gt2Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Commercial Plaza Gate 3', 'East Commercial Zone', 'active')",
      [gt3Id, s.tenantId],
    );

    const patrolsRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        "Subedar (R) Muhammad Rafiq",
        "Main North Gate 1",
        "2026-08-27 10:00:00",
        "Barrier and barrier arm verified operational",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Havaldar (R) Tariq Mehmood",
        "Basement Parking B1 Checkpoint",
        "2026-08-27 11:30:00",
        "All parked vehicle passes in order",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Subedar (R) Muhammad Rafiq",
        "Rooftop Water Tank Access",
        "2026-08-27 12:45:00",
        "Safety hatch padlocks secured",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Sepoy (R) Imran Ali",
        "Substation Perimeter Fence",
        "2026-08-27 13:15:00",
        "All clear, lighting functional",
      ],
    ];
    await batchInsert(
      conn,
      "guard_patrols",
      ["id", "tenant_id", "guard_name", "checkpoint_name", "scanned_at", "notes"],
      patrolsRows,
    );

    const numVisitors = Math.floor(targetResidentCount * (0.15 + Math.random() * 0.15));
    const visitorRows: any[][] = [];
    for (let vp = 1; vp <= numVisitors; vp++) {
      const targetRes = residentMetas[vp % residentMetas.length];
      const vpId = crypto.randomUUID();
      const code = `VP-${String(vp).padStart(4, "0")}`;
      const status = vp % 3 === 0 ? "used" : "active";
      visitorRows.push([
        vpId,
        s.tenantId,
        targetRes.residentId,
        `Guest Visitor ${vp}`,
        `+92 321 ${String(5550000 + vp)}`,
        "2026-08-27 14:00:00",
        code,
        status,
        "one_time",
        `ICT-${1000 + vp}`,
        true,
        "2026-08-27 22:00:00",
        "Family visit",
        targetRes.userId,
      ]);
    }
    await batchInsert(
      conn,
      "visitor_passes",
      [
        "id",
        "tenant_id",
        "resident_id",
        "visitor_name",
        "visitor_phone",
        "expected_at",
        "pass_code",
        "status",
        "visitor_type",
        "vehicle_plate",
        "pre_registered",
        "expires_at",
        "notes",
        "created_by",
      ],
      visitorRows,
    );

    // Entry Exit Logs
    const entryExitRows: any[][] = [];
    for (let ee = 0; ee < Math.min(25, visitorRows.length); ee++) {
      const v = visitorRows[ee];
      const res = residentMetas[ee % residentMetas.length];
      entryExitRows.push([
        crypto.randomUUID(),
        s.tenantId,
        v[0],
        v[3],
        v[9],
        gt1Id,
        ee % 2 === 0 ? "in" : "out",
        staffIds["guard"],
        res.unitId,
        "Verified by gate facial and vehicle scanner",
        null,
        "2026-08-27 13:30:00",
      ]);
    }
    await batchInsert(
      conn,
      "entry_exit_log",
      [
        "id",
        "tenant_id",
        "visitor_pass_id",
        "visitor_name",
        "vehicle_plate",
        "gate_id",
        "direction",
        "verified_by",
        "unit_id",
        "notes",
        "domestic_staff_id",
        "timestamp",
      ],
      entryExitRows,
    );

    // Domestic Staff
    const staffNamesSets = [
      ["Kalsoom Bibi", "Muhammad Akram", "Ghulam Nabi", "Rashida Begum"],
      ["Sajida Parveen", "Allah Ditta", "Niaz Ali", "Zubeda Bibi"],
      ["Shazia Anjum", "Liaqat Ali", "Rahmat Masih", "Kaneez Fatima"],
      ["Nasreen Bibi", "Abdul Ghafoor", "Siddique Ahmad", "Sakina Begum"],
    ];
    const pickedStaffNames = staffNamesSets[codeSum % staffNamesSets.length];

    const domesticStaffRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[0].residentId,
        "DS-00001",
        pickedStaffNames[0],
        "+92 301 7766554",
        "maid",
        null,
        "2026-01-01",
        "2026-12-31",
        "Mon,Tue,Wed,Thu,Fri,Sat",
        "08:00:00",
        "16:00:00",
        null,
        "Full-time domestic housekeeping assistant",
        true,
        residentMetas[0].userId,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[1].residentId,
        "DS-00002",
        pickedStaffNames[1],
        "+92 302 4433221",
        "driver",
        null,
        "2026-01-01",
        "2026-12-31",
        "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
        "07:00:00",
        "20:00:00",
        "ICT-5542",
        "Personal family driver",
        true,
        residentMetas[1].userId,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[2].residentId,
        "DS-00003",
        pickedStaffNames[2],
        "+92 303 9988776",
        "gardener",
        null,
        "2026-01-01",
        "2026-12-31",
        "Mon,Wed,Fri",
        "09:00:00",
        "13:00:00",
        null,
        "Lawn maintenance & gardening",
        true,
        residentMetas[2].userId,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[3].residentId,
        "DS-00004",
        pickedStaffNames[3],
        "+92 304 1122334",
        "cook",
        null,
        "2026-01-01",
        "2026-12-31",
        "Mon,Tue,Wed,Thu,Fri,Sat",
        "11:00:00",
        "19:00:00",
        null,
        "Kitchen cook",
        true,
        residentMetas[3].userId,
      ],
    ];
    await batchInsert(
      conn,
      "domestic_staff",
      [
        "id",
        "tenant_id",
        "resident_id",
        "staff_code",
        "name",
        "phone",
        "staff_type",
        "photo_url",
        "valid_from",
        "valid_until",
        "allowed_days",
        "entry_start_time",
        "entry_end_time",
        "vehicle_plate",
        "notes",
        "is_active",
        "created_by",
      ],
      domesticStaffRows,
    );

    // Blacklist & Visitor Blacklist
    await conn.query(
      "INSERT INTO blacklist (id, tenant_id, type, value, reason) VALUES (?, ?, 'vehicle', 'LZA-4471', 'Repeated unauthorized speeding and gate bypass attempt')",
      [crypto.randomUUID(), s.tenantId],
    );
    await conn.query(
      "INSERT INTO blacklist (id, tenant_id, type, value, reason) VALUES (?, ?, 'visitor', 'Usman Tariq', 'Disorderly conduct at community banquet hall')",
      [crypto.randomUUID(), s.tenantId],
    );

    await conn.query(
      "INSERT INTO visitor_blacklist (id, tenant_id, name, phone, vehicle_plate, reason, added_by) VALUES (?, ?, 'Usman Tariq', '+92 300 9182736', 'LZA-4471', 'Trespassing and disorderly conduct at commercial market', ?)",
      [crypto.randomUUID(), s.tenantId, socAdminId],
    );

    // 15. PARKING SLOTS & ALLOCATIONS
    const parkingSlotsRows: any[][] = [];
    const parkingAllocRows: any[][] = [];
    const numSlots = Math.min(60, unitMetas.length);

    for (let p = 1; p <= numSlots; p++) {
      const slotId = crypto.randomUUID();
      const label = `P-${100 + p}`;
      const block = p <= 30 ? "Basement 1" : "Basement 2";
      const slotType = p % 5 === 0 ? "bike" : "covered";
      const isAllocated = p <= numSlots - 10;
      const status = isAllocated ? "occupied" : "free";

      parkingSlotsRows.push([
        slotId,
        s.tenantId,
        label,
        block,
        p <= 30 ? -1 : -2,
        slotType,
        status,
      ]);

      if (isAllocated) {
        const targetRes = residentMetas[(p - 1) % residentMetas.length];
        parkingAllocRows.push([
          crypto.randomUUID(),
          s.tenantId,
          slotId,
          targetRes.unitId,
          targetRes.name,
          `${s.code.slice(0, 4)}-${String(p + 100)}`,
          slotType === "bike" ? "motorcycle" : "car",
          true,
          socAdminId,
        ]);
      }
    }
    await batchInsert(
      conn,
      "parking_slots",
      ["id", "tenant_id", "label", "block", "floor_number", "slot_type", "status"],
      parkingSlotsRows,
    );
    await batchInsert(
      conn,
      "parking_allocations",
      [
        "id",
        "tenant_id",
        "slot_id",
        "unit_id",
        "resident_name",
        "vehicle_plate",
        "vehicle_type",
        "is_current",
        "created_by",
      ],
      parkingAllocRows,
    );

    // 16. UTILITY METERS (RATES & READINGS)
    const rateElecId = crypto.randomUUID();
    const rateWaterId = crypto.randomUUID();
    const rateGasId = crypto.randomUUID();

    await conn.query(
      "INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, currency, effective_from) VALUES (?, ?, 'electricity', 28.50, 'PKR', '2026-01-01')",
      [rateElecId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, currency, effective_from) VALUES (?, ?, 'water', 15.00, 'PKR', '2026-01-01')",
      [rateWaterId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, currency, effective_from) VALUES (?, ?, 'gas', 22.00, 'PKR', '2026-01-01')",
      [rateGasId, s.tenantId],
    );

    const meterReadingsRows: any[][] = [];
    for (let m = 0; m < Math.min(30, unitMetas.length); m++) {
      const u = unitMetas[m];
      const curr = 350.0 + m * 25;
      const prev = 120.0 + m * 25;
      const consumption = curr - prev;
      const amount = consumption * 28.5;
      meterReadingsRows.push([
        crypto.randomUUID(),
        s.tenantId,
        u.id,
        "electricity",
        "2026-08-01",
        curr,
        prev,
        amount,
        socAdminId,
      ]);
    }
    await batchInsert(
      conn,
      "meter_readings",
      [
        "id",
        "tenant_id",
        "unit_id",
        "meter_type",
        "reading_date",
        "current_reading",
        "previous_reading",
        "charged_amount",
        "created_by",
      ],
      meterReadingsRows,
    );

    // 17. NOTICES, FORUM, POLLS, EVENTS, AMENITIES, GOVERNANCE
    // Notices
    const not1Id = crypto.randomUUID();
    const not2Id = crypto.randomUUID();
    const not3Id = crypto.randomUUID();

    await conn.query(
      "INSERT INTO notices (id, tenant_id, author_id, title, body, priority, is_pinned, is_emergency, target_scope, publish_at) VALUES (?, ?, ?, 'Water Supply Overhead Tank Desilting', 'Water supply will be suspended tomorrow from 09:00 to 13:00 for scheduled overhead reservoir chlorination.', 'urgent', TRUE, FALSE, 'all', '2026-08-27 08:00:00')",
      [not1Id, s.tenantId, socAdminId],
    );
    await conn.query(
      "INSERT INTO notices (id, tenant_id, author_id, title, body, priority, is_pinned, is_emergency, target_scope, publish_at) VALUES (?, ?, ?, 'Annual General Meeting (AGM) 2026 Notice', 'All property owners and registered occupants are invited to the Annual General Meeting in the Central Lawn.', 'info', TRUE, FALSE, 'all', '2026-08-25 10:00:00')",
      [not2Id, s.tenantId, socAdminId],
    );
    await conn.query(
      "INSERT INTO notices (id, tenant_id, author_id, title, body, priority, is_pinned, is_emergency, target_scope, publish_at) VALUES (?, ?, ?, 'Speed Limit & Vehicle Pass Compliance', 'All residents are requested to ensure vehicle RFID stickers are pasted on front windscreens. Society speed limit is 30 km/h.', 'warning', FALSE, FALSE, 'all', '2026-08-20 12:00:00')",
      [not3Id, s.tenantId, socAdminId],
    );

    await conn.query(
      "INSERT INTO notice_reads (id, notice_id, user_id, read_at) VALUES (?, ?, ?, '2026-08-27 09:15:00')",
      [crypto.randomUUID(), not1Id, residentMetas[0].userId],
    );
    await conn.query(
      "INSERT INTO notice_reads (id, notice_id, user_id, read_at) VALUES (?, ?, ?, '2026-08-27 09:30:00')",
      [crypto.randomUUID(), not1Id, residentMetas[1].userId],
    );

    // Forum Threads & Replies
    const th1Id = crypto.randomUUID();
    const th2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body, allow_comments) VALUES (?, ?, ?, 'general', 'High Speed Fiber Optic Provider in Askari', 'Which fiber optic ISP offers the most stable ping for remote work in our block?', TRUE)",
      [th1Id, s.tenantId, residentMetas[0].userId],
    );
    await conn.query(
      "INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body, allow_comments) VALUES (?, ?, ?, 'security', 'Children Bicycle Track Safety near Central Park', 'Can we place rubber speed breakers near the children cycling loop?', TRUE)",
      [th2Id, s.tenantId, residentMetas[1].userId],
    );

    await conn.query(
      "INSERT INTO forum_replies (id, thread_id, author_id, body) VALUES (?, ?, ?, 'StormFiber and Nayatel both have 99.9% uptime with backup fiber lines in Block A.')",
      [crypto.randomUUID(), th1Id, residentMetas[2].userId],
    );
    await conn.query(
      "INSERT INTO forum_replies (id, thread_id, author_id, body) VALUES (?, ?, ?, 'Agreed, committee has approved installing 4 rubber speed humps next week.')",
      [crypto.randomUUID(), th2Id, socAdminId],
    );

    // Polls & Votes
    const poll1Id = crypto.randomUUID();
    const poll2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at, is_anonymous, eligible_voters) VALUES (?, ?, 'Should we install Solar Panels for Common Area Lighting & Elevators?', 'single', '[\"Yes, approve capital budget\", \"No, keep existing grid setup\", \"Need more financial ROI details\"]', '2026-08-01 00:00:00', '2026-09-15 00:00:00', FALSE, 'all')",
      [poll1Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at, is_anonymous, eligible_voters) VALUES (?, ?, 'Proposal to extend Swimming Pool timings to 10:00 PM in Summers', 'single', '[\"Approve 10:00 PM extension\", \"Keep 08:30 PM closing\", \"Weekends only\"]', '2026-08-10 00:00:00', '2026-09-01 00:00:00', FALSE, 'all')",
      [poll2Id, s.tenantId],
    );

    await conn.query(
      "INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected) VALUES (?, ?, ?, 'Yes, approve capital budget', '0')",
      [crypto.randomUUID(), poll1Id, residentMetas[0].userId],
    );
    await conn.query(
      "INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected) VALUES (?, ?, ?, 'Yes, approve capital budget', '0')",
      [crypto.randomUUID(), poll1Id, residentMetas[1].userId],
    );
    await conn.query(
      "INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected) VALUES (?, ?, ?, 'Approve 10:00 PM extension', '0')",
      [crypto.randomUUID(), poll2Id, residentMetas[2].userId],
    );

    // Inject 1 to 3 extra polls
    const extraPollsCount = 1 + Math.floor(Math.random() * 3);
    const pollTemplates = [
      {
        question: "Should we designate Block B rear lawn as a Pet-Free zone?",
        options: "[\"Yes, restrict pets\", \"No restriction\", \"Neutral\"]"
      },
      {
        question: "Approve PKR 5,000 one-time levy for Independence Day Gala?",
        options: "[\"Approve\", \"Reject\", \"Reduce to 2500\"]"
      },
      {
        question: "Preferred day for Weekly Society Fruit & Vegetable Market?",
        options: "[\"Friday\", \"Saturday\", \"Sunday\"]"
      },
      {
        question: "Proposal to install electronic speed signs on Main Boulevard",
        options: "[\"Agree, high priority\", \"Disagree, waste of funds\"]"
      }
    ];
    for (let pIdx = 0; pIdx < extraPollsCount; pIdx++) {
      const template = pollTemplates[(codeSum + pIdx) % pollTemplates.length];
      const pollId = crypto.randomUUID();
      await conn.query(
        "INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at, is_anonymous, eligible_voters) VALUES (?, ?, ?, 'single', ?, '2026-08-01 00:00:00', '2026-09-15 00:00:00', FALSE, 'all')",
        [pollId, s.tenantId, template.question, template.options],
      );
      await conn.query(
        "INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected) VALUES (?, ?, ?, 'Answer option', '0')",
        [crypto.randomUUID(), pollId, residentMetas[pIdx % residentMetas.length].userId],
      );
    }

    // Events & RSVPs
    const ev1Id = crypto.randomUUID();
    const ev2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO events (id, tenant_id, title, cover_url, starts_at, ends_at, venue, allow_rsvp, capacity, description) VALUES (?, ?, 'Askari Annual Independence Gala & High Tea', 'https://images.unsplash.com/photo-1511578314322-379afb476865', '2026-08-14 16:30:00', '2026-08-14 20:00:00', 'Central Lawns & Officers Club', TRUE, 350, 'Flag hoisting ceremony, kids sports gala, patriotic musical performance, and lavish high tea buffet.')",
      [ev1Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO events (id, tenant_id, title, cover_url, starts_at, ends_at, venue, allow_rsvp, capacity, description) VALUES (?, ?, 'Annual General Meeting & Dinner 2026', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87', '2026-09-20 18:00:00', '2026-09-20 22:00:00', 'Askari Community Banquet Hall', TRUE, 250, 'Annual financial transparency presentation, executive committee election, and dinner.')",
      [ev2Id, s.tenantId],
    );

    await conn.query(
      "INSERT INTO event_rsvps (id, event_id, user_id, status, guests_count, notes) VALUES (?, ?, ?, 'yes', 4, 'Attending with family')",
      [crypto.randomUUID(), ev1Id, residentMetas[0].userId],
    );
    await conn.query(
      "INSERT INTO event_rsvps (id, event_id, user_id, status, guests_count, notes) VALUES (?, ?, ?, 'yes', 2, 'Attending')",
      [crypto.randomUUID(), ev1Id, residentMetas[1].userId],
    );

    // Inject 1 to 2 extra events
    const extraEventsCount = 1 + Math.floor(Math.random() * 2);
    const eventTemplates = [
      {
        title: "Eid Milad-un-Nabi Spiritual Gathering & Dinner",
        desc: "Annual religious assembly with guest speaker, Durood recitation, and traditional dinner box distribution.",
        venue: "Askari Central Mosque Yard"
      },
      {
        title: "Defense Day Kids Painting Competition",
        desc: "Bring your kids to draw and paint their tribute to national heroes. Free painting kits provided.",
        venue: "Block A Community Club House"
      },
      {
        title: "Winter Badminton Championship 2026",
        desc: "Open doubles tournament for all age brackets. Register with society sports secretary.",
        venue: "Society Sports Court"
      }
    ];
    for (let eIdx = 0; eIdx < extraEventsCount; eIdx++) {
      const template = eventTemplates[(codeSum + eIdx) % eventTemplates.length];
      const evId = crypto.randomUUID();
      await conn.query(
        "INSERT INTO events (id, tenant_id, title, cover_url, starts_at, ends_at, venue, allow_rsvp, capacity, description) VALUES (?, ?, ?, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87', '2026-09-06 17:00:00', '2026-09-06 20:00:00', ?, TRUE, 100, ?)",
        [evId, s.tenantId, template.title, template.venue, template.desc],
      );
    }


    // Amenities & Bookings
    const amHallId = crypto.randomUUID();
    const amPoolId = crypto.randomUUID();
    const amGymId = crypto.randomUUID();
    const amCourtId = crypto.randomUUID();

    await conn.query(
      "INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active) VALUES (?, ?, 'Askari Executive Banquet Hall', 'hall', 250, 240, '09:00:00', '23:00:00', 25000.00, 20000.00, 'Sound system to be lowered by 10:30 PM. Catering waste must be packed.', TRUE)",
      [amHallId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active) VALUES (?, ?, 'Semi-Olympic Swimming Pool', 'pool', 40, 60, '06:00:00', '21:00:00', 500.00, 0.00, 'Proper swimming attire required. Children under 10 must be accompanied.', TRUE)",
      [amPoolId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active) VALUES (?, ?, 'Community Fitness & Cardio Gym', 'gym', 30, 90, '06:00:00', '22:00:00', 300.00, 0.00, 'Clean indoor sneakers mandatory. Wipe equipment after use.', TRUE)",
      [amGymId, s.tenantId],
    );
    await conn.query(
      "INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active) VALUES (?, ?, 'All-Weather Badminton & Tennis Court', 'court', 12, 60, '07:00:00', '22:00:00', 400.00, 0.00, 'Non-marking gum sole shoes only.', TRUE)",
      [amCourtId, s.tenantId],
    );

    await conn.query(
      "INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, guests_count, purpose, status) VALUES (?, ?, ?, ?, '2026-09-12', '18:00:00', '22:00:00', 120, 'Daughter Wedding Reception Dinner', 'approved')",
      [crypto.randomUUID(), s.tenantId, amHallId, residentMetas[0].userId],
    );
    await conn.query(
      "INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, guests_count, purpose, status) VALUES (?, ?, ?, ?, '2026-08-30', '07:00:00', '08:00:00', 2, 'Morning Swimming Session', 'confirmed')",
      [crypto.randomUUID(), s.tenantId, amPoolId, residentMetas[1].userId],
    );

    // Governance Meetings & Resolutions
    const meet1Id = crypto.randomUUID();
    const meet2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status, meeting_minutes) VALUES (?, ?, 'Executive Committee Budget & Audit Meeting', 'Review of audited financial statements for FY 2025-26 and security gate automation budget approval.', '2026-08-10 17:00:00', 'completed', 'Meeting commenced at 17:05 PM under the chair of Management Board. Budget of PKR 38.5M approved unanimously. Sinking fund reserve contribution verified.')",
      [meet1Id, s.tenantId],
    );
    await conn.query(
      "INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status, meeting_minutes) VALUES (?, ?, 'Quarterly Security & Traffic Review Meeting', 'Review of CCTV installation progress and revision of commercial delivery vehicle entry timings.', '2026-09-05 18:30:00', 'scheduled', NULL)",
      [meet2Id, s.tenantId],
    );

    const res1Id = crypto.randomUUID();
    const res2Id = crypto.randomUUID();
    await conn.query(
      "INSERT INTO governance_resolutions (id, tenant_id, meeting_id, title, description, status, votes_for, votes_against) VALUES (?, ?, ?, 'Approve FY 2026-27 Operating Budget and Reserve Allocations', 'Unanimous approval of audited financials and capital maintenance allocations.', 'passed', 18, 0)",
      [res1Id, s.tenantId, meet1Id],
    );
    await conn.query(
      "INSERT INTO governance_resolutions (id, tenant_id, meeting_id, title, description, status, votes_for, votes_against) VALUES (?, ?, ?, 'Approve 150kW Solar PV Hybridization Tender', 'Award contract to the lowest evaluated technically compliant engineering bidder.', 'proposed', 12, 1)",
      [res2Id, s.tenantId, meet1Id],
    );

    // 18. DOCUMENTS
    const docsRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        "Askari Housing Society Bylaws & Resident Handbook 2026",
        "legal",
        "https://housingos.org/mock-bylaws.pdf",
        socAdminId,
        3,
        "2030-12-31",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Building Safety & Fire Civil Defense Certificate",
        "noc",
        "https://housingos.org/mock-fire-noc.pdf",
        socAdminId,
        1,
        "2027-12-31",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Annual External Financial Audit Report FY 2025-26",
        "financial",
        "https://housingos.org/mock-audit-report.pdf",
        staffIds["finance"],
        1,
        "2027-06-30",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "Executive Banquet Hall & Amenity Booking Guidelines",
        "other",
        "https://housingos.org/mock-guidelines.pdf",
        socAdminId,
        2,
        null,
      ],
    ];
    await batchInsert(
      conn,
      "documents",
      ["id", "tenant_id", "name", "category", "file_url", "uploaded_by", "version", "expiry_date"],
      docsRows,
    );

    // 19. NOTIFICATIONS
    const notifsRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[0].userId,
        "Payment Received Successfully",
        "Your monthly maintenance payment of PKR 20,000 has been verified and recorded.",
        "Your monthly maintenance payment has been verified.",
        "billing",
        false,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[0].userId,
        "Visitor Pass Verified at Gate 1",
        "Guest Visitor 1 checked in through North Gate 1.",
        "Guest Visitor 1 checked in through North Gate 1.",
        "security",
        false,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        residentMetas[1].userId,
        "Scheduled Maintenance Notice",
        "Water supply tank desilting is scheduled for tomorrow 09:00 - 13:00.",
        "Water supply tank desilting is scheduled for tomorrow.",
        "maintenance",
        false,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        socAdminId,
        "New Work Order Logged",
        "Technician dispatched for ATS relay calibration in Power House.",
        "Technician dispatched for ATS relay calibration.",
        "system",
        true,
      ],
    ];
    await batchInsert(
      conn,
      "notifications",
      ["id", "tenant_id", "user_id", "title", "message", "body", "type", "read_status"],
      notifsRows,
    );

    // 20. AUDIT LOGS
    const auditLogsRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        socAdminId,
        "USER_LOGIN",
        "platform",
        socAdminId,
        null,
        null,
        "192.168.1.1",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        socAdminId,
        "CREATE_UNIT",
        "property",
        unitMetas[0].id,
        null,
        JSON.stringify({ unit_number: unitMetas[0].num }),
        "192.168.1.1",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        socAdminId,
        "RECORD_PAYMENT",
        "payments",
        paymentsRows[0][0],
        null,
        JSON.stringify({ amount: paymentsRows[0][3] }),
        "192.168.1.1",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        staffIds["technician"],
        "WORK_ORDER_COMPLETED",
        "maintenance",
        workOrdersRows[0][0],
        null,
        JSON.stringify({ title: workOrdersRows[0][3] }),
        "192.168.1.25",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        staffIds["guard"],
        "PASS_VERIFIED",
        "visitor",
        visitorRows[0][0],
        null,
        JSON.stringify({ code: visitorRows[0][6] }),
        "192.168.1.50",
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        socAdminId,
        "NOTICE_PUBLISHED",
        "notice_board",
        not1Id,
        null,
        JSON.stringify({ title: "Water Supply Overhead Tank Desilting" }),
        "192.168.1.1",
      ],
    ];
    await batchInsert(
      conn,
      "audit_logs",
      [
        "id",
        "tenant_id",
        "user_id",
        "action",
        "entity_type",
        "entity_id",
        "before_data",
        "after_data",
        "ip_address",
      ],
      auditLogsRows,
    );

    // 21. FORM SUBMISSIONS (ANALYTICS & FORMS CATALOG)
    const formSubmissionsRows = [
      [
        crypto.randomUUID(),
        residentMetas[0].userId,
        s.tenantId,
        "residents",
        "resident_onboarding",
        "Resident Onboarding & Verification Form",
        JSON.stringify({
          full_name: residentMetas[0].name,
          phone: residentMetas[0].phone,
          unit: residentMetas[0].unitNum,
        }),
      ],
      [
        crypto.randomUUID(),
        residentMetas[1].userId,
        s.tenantId,
        "parking",
        "vehicle_sticker_request",
        "Vehicle RFID Sticker Application",
        JSON.stringify({ plate: `${s.code.slice(0, 4)}-101`, make: "Toyota", model: "Corolla" }),
      ],
      [
        crypto.randomUUID(),
        residentMetas[2].userId,
        s.tenantId,
        "complaints",
        "complaint_submission",
        "Maintenance Complaint Ticket",
        JSON.stringify({
          category: "plumbing",
          priority: "high",
          description: "Water pipe seepage",
        }),
      ],
      [
        crypto.randomUUID(),
        residentMetas[3].userId,
        s.tenantId,
        "amenities",
        "hall_reservation",
        "Community Banquet Hall Reservation",
        JSON.stringify({ purpose: "Wedding dinner", date: "2026-09-12", guests: 120 }),
      ],
    ];
    await batchInsert(
      conn,
      "form_submissions",
      ["id", "user_id", "tenant_id", "module_key", "form_key", "form_title", "payload"],
      formSubmissionsRows,
    );

    const aiAnalysesRows = [
      [
        crypto.randomUUID(),
        s.tenantId,
        "full_insights",
        JSON.stringify({ score: 85, status: "good" }),
        socAdminId,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "risk_assessment",
        JSON.stringify({ highRiskCount: 2 }),
        socAdminId,
      ],
      [
        crypto.randomUUID(),
        s.tenantId,
        "cost_analysis",
        JSON.stringify({ totalCost: 1540000 }),
        socAdminId,
      ],
    ];
    await batchInsert(
      conn,
      "ai_maintenance_analyses",
      ["id", "tenant_id", "analysis_type", "result_data", "created_by"],
      aiAnalysesRows,
    );
  }

  console.log(
    `\n✅ All ${DEMO_SOCIETIES.length} Askari Housing Societies seeded with 100% full dataset across all modules.`,
  );
}

// ─── MAIN EXECUTION ───────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("=========================================================");
  console.log("🏗️  HOUSINGOS — MASSIVE ASKARI SEEDER (19,000+ POPULATION)");
  console.log("=========================================================");

  const conn = await connectDb();
  const pwHash = hashPassword("Demo@12345");

  try {
    await purgeAllData(conn);
    await seedAskariSocieties(conn, pwHash);
    await seedAdmins(conn, pwHash);

    // Final Verification Scorecard
    const [[tenantCount]] = (await conn.query("SELECT COUNT(*) as n FROM tenants")) as any[];
    const [[societyCount]] = (await conn.query("SELECT COUNT(*) as n FROM societies")) as any[];
    const [[unitCount]] = (await conn.query("SELECT COUNT(*) as n FROM units")) as any[];
    const [[residentCount]] = (await conn.query("SELECT COUNT(*) as n FROM residents")) as any[];
    const [[paymentCount]] = (await conn.query("SELECT COUNT(*) as n FROM payments")) as any[];
    const [[budgetCount]] = (await conn.query("SELECT COUNT(*) as n FROM budgets")) as any[];
    const [[vendorCount]] = (await conn.query("SELECT COUNT(*) as n FROM vendors")) as any[];
    const [[invCount]] = (await conn.query("SELECT COUNT(*) as n FROM inventory_items")) as any[];
    const [[projCount]] = (await conn.query("SELECT COUNT(*) as n FROM projects")) as any[];
    const [[assetCount]] = (await conn.query("SELECT COUNT(*) as n FROM assets")) as any[];
    const [[woCount]] = (await conn.query(
      "SELECT COUNT(*) as n FROM maintenance_work_orders",
    )) as any[];
    const [[complaintCount]] = (await conn.query("SELECT COUNT(*) as n FROM complaints")) as any[];
    const [[visitorCount]] = (await conn.query(
      "SELECT COUNT(*) as n FROM visitor_passes",
    )) as any[];
    const [[staffCount]] = (await conn.query("SELECT COUNT(*) as n FROM domestic_staff")) as any[];
    const [[slotCount]] = (await conn.query("SELECT COUNT(*) as n FROM parking_slots")) as any[];
    const [[meterCount]] = (await conn.query("SELECT COUNT(*) as n FROM meter_readings")) as any[];
    const [[docCount]] = (await conn.query("SELECT COUNT(*) as n FROM documents")) as any[];
    const [[notifCount]] = (await conn.query("SELECT COUNT(*) as n FROM notifications")) as any[];
    const [[auditCount]] = (await conn.query("SELECT COUNT(*) as n FROM audit_logs")) as any[];

    console.log("\n=========================================================");
    console.log("📊 MASSIVE ASKARI COMPLETE MODULES SEEDING SCORECARD:");
    console.log(
      `  Tenants & Societies:      ${tenantCount.n} tenants, ${societyCount.n} societies`,
    );
    console.log(`  Units & Residents:        ${unitCount.n} units, ${residentCount.n} residents`);
    console.log(`  Finance:                  ${paymentCount.n} payments, ${budgetCount.n} budgets`);
    console.log(`  Procurement & Vendors:    ${vendorCount.n} vendors`);
    console.log(`  Inventory & Stock:        ${invCount.n} items`);
    console.log(`  Capital Projects:         ${projCount.n} projects`);
    console.log(`  Assets & Maintenance:     ${assetCount.n} assets, ${woCount.n} work orders`);
    console.log(`  Complaints:               ${complaintCount.n} tickets`);
    console.log(
      `  Security & Gates:         ${visitorCount.n} visitor passes, ${staffCount.n} domestic staff`,
    );
    console.log(`  Parking Slots:            ${slotCount.n} slots`);
    console.log(`  Utility Meters:           ${meterCount.n} readings`);
    console.log(`  Documents & Notifications:${docCount.n} docs, ${notifCount.n} notifs`);
    console.log(`  Audit Logs Timeline:      ${auditCount.n} events`);
    console.log("=========================================================\n");
  } catch (err: any) {
    console.error("\n❌ SEEDING FAILED:", err.message);
    if (err.sql) console.error("   SQL:", err.sql);
  } finally {
    await conn.end();
  }
}

main();
