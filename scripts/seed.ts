import mysql from "mysql2/promise";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  // Load .env manually
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const key = trimmed
              .slice(0, idx)
              .trim()
              .replace(/^export\s+/, "");
            let val = trimmed.slice(idx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[SEED] Failed to load .env file manually:", err);
  }

  const host = process.env.MYSQL_HOST || "localhost";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "at_bms";

  console.log(
    `[SEED] Connection: host=${host}, port=${port}, user=${user}, database=${database}, hasPassword=${password.length > 0}`,
  );

  // Step 1: Connect WITHOUT database to ensure it exists
  console.log("[SEED] Ensuring database exists...");
  const initConn = await mysql.createConnection({ host, port, user, password });
  await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await initConn.end();

  // Step 2: Connect to the actual database
  console.log(`[SEED] Connecting to ${database}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  console.log("[SEED] Wiping existing demo data for clean state...");
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  // All tables that the seed touches — order doesn't matter with FK checks off
  const tables = [
    "notice_reads",
    "notices",
    "parking_allocations",
    "parking_slots",
    "meter_readings",
    "meter_rates",
    "complaint_history",
    "complaint_comments",
    "complaints",
    "sla_configs",
    "work_orders",
    "maintenance_schedules",
    "assets",
    "quotations",
    "purchase_orders",
    "rfqs",
    "vendors",
    "budget_line_items",
    "budgets",
    "payments",
    "ledger_entries",
    "charge_heads",
    "resident_vehicles",
    "residents",
    "persons",
    "units",
    "floors",
    "buildings",
    "blocks",
    "societies",
    "entry_exit_log",
    "visitor_passes",
    "forum_threads",
    "forum_replies",
    "polls",
    "poll_votes",
    "events",
    "event_rsvps",
    "amenities",
    "amenity_bookings",
    "gate_terminals",
    "guard_patrols",
    "blacklist",
    "governance_resolutions",
    "governance_meetings",
    "form_submissions",
    "documents",
    "notifications",
    "sessions",
    "user_roles",
    "profiles",
    "users",
    "tenant_modules",
    "module_registry",
    "audit_logs",
    "tenants",
  ];
  for (const table of tables) {
    await conn.query(`TRUNCATE TABLE \`${table}\``).catch(() => {});
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  // ─── TENANT ──────────────────────────────────────────────────────────────
  console.log("[SEED] Creating demo tenant...");
  const tenantId = crypto.randomUUID();
  await conn.query(
    `INSERT INTO tenants (id, name, slug, plan) VALUES (?, 'Green Pines Residencia', 'green-pines-demo', 'enterprise')`,
    [tenantId],
  );

  // ─── SUPER ADMIN USER ────────────────────────────────────────────────────
  console.log("[SEED] Provisioning demo Super Admin...");
  const userId = crypto.randomUUID();
  const passwordHash = hashPassword("demo1234");
  await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'admin@demo.com', ?)", [
    userId,
    passwordHash,
  ]);
  await conn.query(
    `INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Super Admin', 'Green Pines Residencia', '+92 300 1234567', ?)`,
    [userId, tenantId],
  );
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'super_admin')", [
    crypto.randomUUID(),
    userId,
  ]);

  // ─── MODULE ACTIVATIONS ──────────────────────────────────────────────────
  const modules = [
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
    "utility_meters",
    "community_forum",
    "polls",
    "events",
    "amenities",
    "governance",
  ];
  for (const m of modules) {
    await conn.query(
      `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_by) VALUES (?, ?, ?, TRUE, ?)`,
      [crypto.randomUUID(), tenantId, m, userId],
    );
  }

  // ─── PROPERTY LAYOUT ─────────────────────────────────────────────────────
  console.log("[SEED] Seeding Property layout...");
  const societyId = crypto.randomUUID();
  await conn.query(
    "INSERT INTO societies (id, tenant_id, name) VALUES (?, ?, 'Green Pines Residencia')",
    [societyId, tenantId],
  );

  const blockIds = [crypto.randomUUID(), crypto.randomUUID()];
  const blockNames = ["Block A", "Block B"];
  for (let i = 0; i < 2; i++) {
    await conn.query("INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, ?)", [
      blockIds[i],
      societyId,
      tenantId,
      blockNames[i],
    ]);
  }

  // Units — schema requires: id, floor_id, building_id, block_id, society_id, tenant_id, unit_number
  const unitIds: string[] = [];
  const residentsList = [
    { name: "Ali Ahmed", phone: "+92 300 2223344", email: "ali@demo.com", type: "owner" as const },
    {
      name: "Saira Khan",
      phone: "+92 300 5556677",
      email: "saira@demo.com",
      type: "tenant" as const,
    },
    {
      name: "Zainab Malik",
      phone: "+92 300 8889900",
      email: "zainab@demo.com",
      type: "owner" as const,
    },
    {
      name: "Dummy Resident",
      phone: "+92 300 1110001",
      email: "dummy@demo.com",
      type: "owner" as const,
    },
    {
      name: "Kamran Shah",
      phone: "+92 300 4445566",
      email: "kamran@demo.com",
      type: "owner" as const,
    },
    {
      name: "Faiza Begum",
      phone: "+92 300 7778899",
      email: "faiza@demo.com",
      type: "owner" as const,
    },
    {
      name: "Bilal Butt",
      phone: "+92 300 9990011",
      email: "bilal@demo.com",
      type: "tenant" as const,
    },
    {
      name: "Aisha Yusuf",
      phone: "+92 300 3334455",
      email: "aisha@demo.com",
      type: "owner" as const,
    },
  ];

  // Resident person IDs — needed for complaint submitted_by
  const personIds: string[] = [];

  let resIndex = 0;
  for (let bIndex = 0; bIndex < 2; bIndex++) {
    const blockId = blockIds[bIndex];
    for (let floor = 0; floor <= 1; floor++) {
      for (let unitNum = 1; unitNum <= 4; unitNum++) {
        const id = crypto.randomUUID();
        const unitNumber = `${floor}${unitNum}`;
        await conn.query(
          `INSERT INTO units (id, society_id, block_id, tenant_id, unit_number, unit_type, status)
           VALUES (?, ?, ?, ?, ?, 'flat', ?)`,
          [
            id,
            societyId,
            blockId,
            tenantId,
            unitNumber,
            resIndex < residentsList.length ? "occupied" : "vacant",
          ],
        );
        unitIds.push(id);

        // Assign residents to first 8 units
        if (resIndex < residentsList.length) {
          const res = residentsList[resIndex];
          const personId = crypto.randomUUID();
          personIds.push(personId);

          // Create login account for this resident
          const residentUserId = crypto.randomUUID();
          const residentPasswordHash = hashPassword("demo1234");
          await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
            residentUserId,
            res.email,
            residentPasswordHash,
          ]);
          await conn.query(
            `INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, 'Green Pines Residencia', ?, ?)`,
            [residentUserId, res.name, res.phone, tenantId],
          );
          // Set role based on type
          const userRole =
            res.email === "ali@demo.com"
              ? "society_admin"
              : res.type === "tenant"
                ? "tenant"
                : "resident";
          await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
            crypto.randomUUID(),
            residentUserId,
            userRole,
          ]);

          await conn.query(
            "INSERT INTO persons (id, tenant_id, user_id, full_name, phone, email) VALUES (?, ?, ?, ?, ?, ?)",
            [personId, tenantId, residentUserId, res.name, res.phone, res.email],
          );

          const resId = crypto.randomUUID();
          await conn.query(
            `INSERT INTO residents (id, tenant_id, unit_id, person_id, type, is_current)
             VALUES (?, ?, ?, ?, ?, TRUE)`,
            [resId, tenantId, id, personId, res.type],
          );
          resIndex++;
        }
      }
    }
  }

  // ─── CHARGE HEADS ────────────────────────────────────────────────────────
  console.log("[SEED] Seeding charge heads...");
  const headNames = ["Maintenance Fee", "Security Charges", "Sinking Fund"];
  const headAmounts = [5000, 1500, 500];
  const chargeHeadIds: string[] = [];
  for (let h = 0; h < headNames.length; h++) {
    const chId = crypto.randomUUID();
    chargeHeadIds.push(chId);
    await conn.query(
      `INSERT INTO charge_heads (id, tenant_id, name, description, default_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [chId, tenantId, headNames[h], `Monthly ${headNames[h].toLowerCase()}`, headAmounts[h]],
    );
  }

  // ─── LEDGER & PAYMENTS — 6 months history ────────────────────────────────
  console.log("[SEED] Generating 6 months of ledger & collection history...");
  const now = new Date();
  let receiptCounter = 1000;

  for (let m = 5; m >= 0; m--) {
    const date = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const billingPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    // Charge all 8 units with residents
    for (let u = 0; u < 8; u++) {
      const unitId = unitIds[u];
      for (let h = 0; h < headNames.length; h++) {
        const entryId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, billing_period, balance_after, created_by)
           VALUES (?, ?, ?, 'charge', ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            tenantId,
            unitId,
            chargeHeadIds[h],
            headAmounts[h],
            `Monthly ${headNames[h]} for ${formatMonthLabel(date)}`,
            billingPeriod,
            headAmounts[h],
            userId,
          ],
        );

        // 80% payment rate to simulate real collection variance
        if (Math.random() > 0.2) {
          const payDate = new Date(date);
          payDate.setDate(10 + Math.floor(Math.random() * 10));
          const payDateStr = payDate.toISOString().split("T")[0];
          receiptCounter++;

          const payId = crypto.randomUUID();
          await conn.query(
            `INSERT INTO payments (id, tenant_id, unit_id, amount, payment_method, receipt_number, payment_date, reference, notes, recorded_by)
             VALUES (?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, ?)`,
            [
              payId,
              tenantId,
              unitId,
              headAmounts[h],
              `REC-${receiptCounter}`,
              payDateStr,
              `TXN-${Math.floor(Math.random() * 1000000)}`,
              `Payment for ${headNames[h]}`,
              userId,
            ],
          );

          // Record corresponding ledger credit
          await conn.query(
            `INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, billing_period, reference_id, balance_after, created_by)
             VALUES (?, ?, ?, 'payment', ?, ?, ?, ?, ?, 0, ?)`,
            [
              crypto.randomUUID(),
              tenantId,
              unitId,
              chargeHeadIds[h],
              headAmounts[h],
              `Payment received for ${headNames[h]}`,
              billingPeriod,
              payId,
              userId,
            ],
          );
        }
      }
    }
  }

  // ─── COMPLAINTS ──────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Complaints...");
  const complaintsData = [
    {
      title: "Elevator B1 making rattling noise",
      desc: "The lift in Block B shakes heavily when moving between 1st and 2nd floors.",
      cat: "lift" as const,
      priority: "high" as const,
      status: "open" as const,
    },
    {
      title: "Water seepage in basement parking",
      desc: "Noticeable water dripping from main pipe junction onto parking slot P-4.",
      cat: "plumbing" as const,
      priority: "critical" as const,
      status: "in_progress" as const,
    },
    {
      title: "Common area lights broken",
      desc: "Corridor bulbs on Block A 1st floor are fused.",
      cat: "electrical" as const,
      priority: "low" as const,
      status: "open" as const,
    },
    {
      title: "Trash collection delay",
      desc: "Garbage collector did not arrive yesterday.",
      cat: "other" as const,
      priority: "medium" as const,
      status: "open" as const,
    },
  ];
  for (let i = 0; i < complaintsData.length; i++) {
    const c = complaintsData[i];
    const submittedBy = personIds[i] || userId; // use resident person IDs
    await conn.query(
      `INSERT INTO complaints (id, tenant_id, title, description, category, priority, status, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), tenantId, c.title, c.desc, c.cat, c.priority, c.status, submittedBy],
    );
  }

  // ─── VENDORS ─────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Vendors...");
  const vendors = [
    {
      name: "PowerPlus Generators",
      cat: "Generators & Heavy Power",
      phone: "+92 300 8111222",
      email: "info@powerplus.com",
    },
    {
      name: "Apex Elevator Services",
      cat: "Lifts & Elevators",
      phone: "+92 300 8333444",
      email: "apex@demo.com",
    },
  ];
  for (const v of vendors) {
    await conn.query(
      "INSERT INTO vendors (id, tenant_id, name, category, phone, email, rating) VALUES (?, ?, ?, ?, ?, ?, 4.5)",
      [crypto.randomUUID(), tenantId, v.name, v.cat, v.phone, v.email],
    );
  }

  // ─── NOTICES ─────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Notices...");
  const notices = [
    {
      title: "Water Supply Suspension Notice",
      body: "Please note that water supply will be suspended tomorrow from 9:00 AM to 1:00 PM due to cleanout of overhead tanks.",
      priority: "urgent",
    },
    {
      title: "Annual General Meeting (AGM)",
      body: "The committee is pleased to invite all residents to the AGM on coming Sunday in the Central Park.",
      priority: "info",
    },
  ];
  for (const n of notices) {
    await conn.query(
      `INSERT INTO notices (id, tenant_id, author_id, title, body, priority, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [crypto.randomUUID(), tenantId, userId, n.title, n.body, n.priority],
    );
  }

  // ─── UTILITY METERS ──────────────────────────────────────────────────────
  console.log("[SEED] Seeding Utility Meter rates & readings...");
  const rateId = crypto.randomUUID();
  await conn.query(
    "INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, effective_from) VALUES (?, ?, 'electricity', 24.50, '2026-01-01')",
    [rateId, tenantId],
  );
  await conn.query(
    `INSERT INTO meter_readings (id, tenant_id, unit_id, meter_type, reading_date, current_reading, previous_reading, charged_amount)
     VALUES (?, ?, ?, 'electricity', '2026-06-01', 120.00, 0, 2940.00)`,
    [crypto.randomUUID(), tenantId, unitIds[0]],
  );

  // ─── PARKING ─────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Parking slots...");
  const slotLabels = ["P-101", "P-102", "P-103", "P-104", "P-105"];
  for (let s = 0; s < slotLabels.length; s++) {
    const slotId = crypto.randomUUID();
    const isAllocated = s < 3;
    await conn.query(
      "INSERT INTO parking_slots (id, tenant_id, label, slot_type, status) VALUES (?, ?, ?, 'covered', ?)",
      [slotId, tenantId, slotLabels[s], isAllocated ? "occupied" : "free"],
    );

    if (isAllocated) {
      await conn.query(
        `INSERT INTO parking_allocations (id, tenant_id, slot_id, unit_id, resident_name, vehicle_plate, vehicle_type, is_current)
         VALUES (?, ?, ?, ?, ?, ?, 'car', TRUE)`,
        [
          crypto.randomUUID(),
          tenantId,
          slotId,
          unitIds[s],
          residentsList[s].name,
          `LED-${100 + s}`,
        ],
      );
    }
  }

  // ─── ASSETS ──────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Assets...");
  const assetData = [
    { name: "Elevator A1", location: "Block A", serial: "ELV-A1-2024" },
    { name: "Generator DG-1", location: "Basement", serial: "DG-001-2023" },
    { name: "Water Pump Motor", location: "Pump Room", serial: "WPM-003" },
  ];
  for (const a of assetData) {
    await conn.query(
      "INSERT INTO assets (id, tenant_id, name, location, serial_number, warranty_expires_at) VALUES (?, ?, ?, ?, ?, '2027-12-31')",
      [crypto.randomUUID(), tenantId, a.name, a.location, a.serial],
    );
  }

  // ─── COMMUNITY FORUM ──────────────────────────────────────────────────────
  console.log("[SEED] Seeding Community Forum...");
  const threadId = crypto.randomUUID();
  await conn.query(
    `INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body)
     VALUES (?, ?, ?, 'general', 'Car Washer Recommendations', 'Can anyone recommend a reliable car washer who is available early mornings in Block A?')`,
    [threadId, tenantId, userId],
  );
  await conn.query(
    `INSERT INTO forum_replies (id, thread_id, author_id, body)
     VALUES (?, ?, ?, 'I highly recommend Sajid, he does 3 cars in our lane. Very reliable. Phone: +92 300 9998877.')`,
    [crypto.randomUUID(), threadId, userId],
  );

  // ─── POLLS ────────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Polls...");
  const pollId = crypto.randomUUID();
  const opensAt = new Date();
  const closesAt = new Date();
  closesAt.setDate(closesAt.getDate() + 7);
  await conn.query(
    `INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at)
     VALUES (?, ?, 'Should we install security cameras in the lift lobbies?', 'single', ?, ?, ?)`,
    [
      pollId,
      tenantId,
      JSON.stringify(["Yes, absolutely", "No, unnecessary", "Undecided"]),
      opensAt.toISOString().slice(0, 19).replace("T", " "),
      closesAt.toISOString().slice(0, 19).replace("T", " "),
    ],
  );
  await conn.query(
    `INSERT INTO poll_votes (id, poll_id, user_id, choice)
     VALUES (?, ?, ?, 'Yes, absolutely')`,
    [crypto.randomUUID(), pollId, userId],
  );

  // ─── EVENTS ───────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Events...");
  const eventId = crypto.randomUUID();
  const eventStart = new Date();
  eventStart.setDate(eventStart.getDate() + 5);
  const eventEnd = new Date(eventStart);
  eventEnd.setHours(eventEnd.getHours() + 3);
  await conn.query(
    `INSERT INTO events (id, tenant_id, title, starts_at, ends_at, venue, capacity, description)
     VALUES (?, ?, 'Independence Day Celebrations', ?, ?, 'Central Lawn / Park', 150, 'Join us for the flag hoisting ceremony followed by high tea and fun activities for children.')`,
    [
      eventId,
      tenantId,
      eventStart.toISOString().slice(0, 19).replace("T", " "),
      eventEnd.toISOString().slice(0, 19).replace("T", " "),
    ],
  );
  await conn.query(
    `INSERT INTO event_rsvps (id, event_id, user_id, status, guests_count)
     VALUES (?, ?, ?, 'yes', 2)`,
    [crypto.randomUUID(), eventId, userId],
  );

  // ─── AMENITIES ────────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Amenities...");
  const amenityId1 = crypto.randomUUID();
  const amenityId2 = crypto.randomUUID();
  await conn.query(
    `INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit)
     VALUES (?, ?, 'Community Hall', 'hall', 100, 120, '09:00:00', '22:00:00', 5000.00, 10000.00)`,
    [amenityId1, tenantId],
  );
  await conn.query(
    `INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit)
     VALUES (?, ?, 'Roof Pool', 'pool', 25, 60, '06:00:00', '20:00:00', 200.00, 0.00)`,
    [amenityId2, tenantId],
  );
  // Book Community Hall
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 10);
  await conn.query(
    `INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, guests_count, purpose, status)
     VALUES (?, ?, ?, ?, ?, '14:00:00', '18:00:00', 40, 'Birthday Party', 'approved')`,
    [crypto.randomUUID(), tenantId, amenityId1, userId, bookingDate.toISOString().split("T")[0]],
  );

  // ─── SECURITY — PHASE 5 ──────────────────────────────────────────────────
  console.log("[SEED] Seeding Security (Gate, Patrols, Blacklist)...");

  // Gate Terminals
  const gateMeta = [
    { name: "Main Gate", location: "Block A Entrance" },
    { name: "Back Gate", location: "Block B Exit" },
    { name: "Parking Gate", location: "Basement Level" },
  ];
  const [gtMain, gtBack, gtParking] = gateMeta.map(() => crypto.randomUUID());
  for (const [idx, g] of gateMeta.entries()) {
    const id = [gtMain, gtBack, gtParking][idx];
    await conn.query(
      "INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, ?, ?, 'active')",
      [id, tenantId, g.name, g.location],
    );
  }

  // Guard Patrol Scans
  const patrols = [
    { guard: "Ahmed Khan", checkpoint: "Main Gate", notes: "All clear, no incidents" },
    { guard: "Bilal Raza", checkpoint: "Block B Stairwell", notes: null },
    { guard: "Ahmed Khan", checkpoint: "Parking Gate", notes: "Vehicle check completed" },
    { guard: "Saif Ullah", checkpoint: "Rooftop Access", notes: "Lock verified" },
    { guard: "Bilal Raza", checkpoint: "Main Gate", notes: null },
  ];
  for (const p of patrols) {
    await conn.query(
      "INSERT INTO guard_patrols (id, tenant_id, guard_name, checkpoint_name, notes) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), tenantId, p.guard, p.checkpoint, p.notes],
    );
  }

  // Blacklist entries
  const blacklisted = [
    { type: "vehicle", value: "LZA-4471", reason: "Unauthorized repeated entry" },
    { type: "visitor", value: "Usman Tariq", reason: "Theft incident - Block A" },
    { type: "vehicle", value: "ABC-1234", reason: "Suspicious activity near parking" },
  ];
  for (const b of blacklisted) {
    await conn.query(
      "INSERT INTO blacklist (id, tenant_id, type, value, reason) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), tenantId, b.type, b.value, b.reason],
    );
  }

  // ─── GOVERNANCE — PHASE 5 ────────────────────────────────────────────────
  console.log("[SEED] Seeding Governance (Meetings, Resolutions)...");

  // Meetings
  const meetingId1 = crypto.randomUUID();
  const meetingId2 = crypto.randomUUID();
  const meetingId3 = crypto.randomUUID();

  await conn.query(
    `INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status, meeting_minutes)
     VALUES (?, ?, 'AGM 2025 — Annual Budget Review', 'Review and approval of 2025-26 society budget', '2025-03-15 10:00:00', 'completed',
     'Meeting commenced at 10:05 AM. Budget of PKR 4.2M approved unanimously. Maintenance fund increased by 15%. Chairman thanked all members.')`,
    [meetingId1, tenantId],
  );
  await conn.query(
    `INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status)
     VALUES (?, ?, 'Emergency Security Meeting', 'Review of recent security incidents and preventive measures', '2025-07-10 18:00:00', 'completed')`,
    [meetingId2, tenantId],
  );
  await conn.query(
    `INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status)
     VALUES (?, ?, 'Q3 Maintenance Planning', 'Schedule and allocate budget for Q3 maintenance tasks', '2025-08-05 11:00:00', 'scheduled')`,
    [meetingId3, tenantId],
  );

  // Resolutions
  const resolutions = [
    {
      meetingId: meetingId1,
      title: "Approve 2025-26 Budget",
      description: "Annual budget of PKR 4.2M approved",
      status: "passed",
      votesFor: 7,
      votesAgainst: 0,
    },
    {
      meetingId: meetingId1,
      title: "Increase Maintenance Fund by 15%",
      description: "Reserve fund allocation increase for preventive maintenance",
      status: "passed",
      votesFor: 6,
      votesAgainst: 1,
    },
    {
      meetingId: meetingId2,
      title: "Install CCTV on Block B Stairwell",
      description: "Proposal to add 4 cameras in blind spots",
      status: "passed",
      votesFor: 5,
      votesAgainst: 0,
    },
    {
      meetingId: meetingId2,
      title: "Hire Additional Night Guard",
      description: "Increase nighttime security coverage",
      status: "proposed",
      votesFor: 2,
      votesAgainst: 1,
    },
    {
      meetingId: null,
      title: "Revise Guest Parking Policy",
      description: "Limit guest parking to 4 hours between 8AM–8PM",
      status: "proposed",
      votesFor: 1,
      votesAgainst: 0,
    },
  ];
  for (const r of resolutions) {
    await conn.query(
      `INSERT INTO governance_resolutions (id, tenant_id, meeting_id, title, description, status, votes_for, votes_against)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        tenantId,
        r.meetingId,
        r.title,
        r.description,
        r.status,
        r.votesFor,
        r.votesAgainst,
      ],
    );
  }

  // ─── DOCUMENTS ───────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Documents...");
  await conn.query(
    `INSERT INTO documents (id, tenant_id, name, category, file_url, uploaded_by, expiry_date)
     VALUES 
     (?, ?, 'Building Safety Certificate 2025', 'legal', 'https://housingos.org/mock-document.pdf', ?, '2026-12-31'),
     (?, ?, 'Banquet Hall Reservation Rules', 'other', 'https://housingos.org/mock-document.pdf', ?, NULL),
     (?, ?, 'NOC for Water Connection Block A', 'noc', 'https://housingos.org/mock-document.pdf', ?, NULL)`,
    [
      crypto.randomUUID(),
      tenantId,
      userId,
      crypto.randomUUID(),
      tenantId,
      userId,
      crypto.randomUUID(),
      tenantId,
      userId,
    ],
  );

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  console.log("[SEED] Seeding Notifications...");
  await conn.query(
    `INSERT INTO notifications (id, tenant_id, user_id, title, body, read_status)
     VALUES 
     (?, ?, ?, 'Welcome to Green Pines!', 'You have been registered as the super administrator of Green Pines Residencia.', FALSE),
     (?, ?, ?, 'Upcoming AGM Meeting Scheduled', 'The Q3 Maintenance Planning meeting is scheduled for 5th August 2025 at 11:00 AM.', FALSE),
     (?, ?, ?, 'New Work Order Assigned', 'Preventive schedule recurring task registered for the Main Lift Elevator cabin.', TRUE)`,
    [
      crypto.randomUUID(),
      tenantId,
      userId,
      crypto.randomUUID(),
      tenantId,
      userId,
      crypto.randomUUID(),
      tenantId,
      userId,
    ],
  );

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ✅  SEED COMPLETED SUCCESSFULLY!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("  🔐 Login credentials:");
  console.log("     Email:    admin@demo.com");
  console.log("     Password: demo1234");
  console.log("");
  console.log("  📊 Seeded data:");
  console.log("     • 1 tenant (Green Pines Residencia)");
  console.log("     • 1 super admin + 8 residents");
  console.log("     • 2 blocks × 8 units each (16 total)");
  console.log("     • 6 months billing history");
  console.log("     • 4 complaints, 2 vendors, 2 notices");
  console.log("     • 5 parking slots, 3 assets, meter readings");
  console.log("═══════════════════════════════════════════════════════════");

  await conn.end();
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

seed().catch((err) => {
  console.error("Seed execution failed: ", err);
  process.exit(1);
});
