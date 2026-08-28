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
    `[SEED] Connection: host=${host}, port=${port}, user=${user}, database=${database}`,
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

  const tables = [
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
  for (const table of tables) {
    await conn.query(`TRUNCATE TABLE \`${table}\``).catch(() => {});
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");

  // ─── TENANT ──────────────────────────────────────────────────────────────
  console.log("[SEED] Creating demo tenant...");
  const tenantId = crypto.randomUUID();
  await conn.query(
    `INSERT INTO tenants (id, name, slug, plan, timezone, currency, date_format, contact_email, contact_phone, address, code)
     VALUES (?, 'Green Pines Residencia', 'green-pines-demo', 'enterprise', 'Asia/Karachi', 'PKR', 'DD/MM/YYYY', 'admin@greenpines.pk', '+92 51 5566778', 'Main Club Road, Phase 1, Islamabad', 'GPR-ISB')`,
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
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [
    crypto.randomUUID(),
    userId,
  ]);
  await conn.query("INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)", [
    crypto.randomUUID(),
    userId,
    tenantId,
  ]);

  // ─── STAFF USERS ─────────────────────────────────────────────────────────
  const techId = crypto.randomUUID();
  const guardId = crypto.randomUUID();
  const finId = crypto.randomUUID();

  await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'tech@demo.com', ?)", [techId, passwordHash]);
  await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Lead Technician Tariq', 'Green Pines Residencia', '+92 300 4433221', ?)", [techId, tenantId]);
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'technician')", [crypto.randomUUID(), techId]);

  await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'guard@demo.com', ?)", [guardId, passwordHash]);
  await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Gate Guard Rafiq', 'Green Pines Residencia', '+92 300 5566778', ?)", [guardId, tenantId]);
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'guard')", [crypto.randomUUID(), guardId]);

  await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, 'finance@demo.com', ?)", [finId, passwordHash]);
  await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, 'Finance Head Farooq', 'Green Pines Residencia', '+92 300 9988112', ?)", [finId, tenantId]);
  await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'finance_head')", [crypto.randomUUID(), finId]);

  // ─── MODULE ACTIVATIONS ──────────────────────────────────────────────────
  const modules = [
    "platform", "property", "residents", "notifications", "documents", "reports",
    "ledger", "payments", "financial_transparency", "budget", "vendor_finance",
    "complaints", "maintenance", "inventory", "vendors", "projects", "assets",
    "visitor", "gate", "parking", "guard_patrol", "blacklist", "notice_board",
    "utility_meters", "community_forum", "polls", "events", "amenities", "governance",
    "ai_maintenance"
  ];
  for (const m of modules) {
    await conn.query(
      `INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, activated_by) VALUES (?, ?, ?, TRUE, ?)`,
      [crypto.randomUUID(), tenantId, m, userId],
    );
  }

  // ─── SLA CONFIGS & CUSTOM ROLES ──────────────────────────────────────────
  const slaRows = [
    [crypto.randomUUID(), tenantId, "lift", "critical", 1, 4],
    [crypto.randomUUID(), tenantId, "plumbing", "high", 2, 8],
    [crypto.randomUUID(), tenantId, "electrical", "high", 2, 6],
    [crypto.randomUUID(), tenantId, "security", "critical", 1, 2],
    [crypto.randomUUID(), tenantId, "water", "high", 2, 8],
    [crypto.randomUUID(), tenantId, "cleaning", "low", 12, 24],
    [crypto.randomUUID(), tenantId, "general", "medium", 6, 24]
  ];
  for (const sla of slaRows) {
    await conn.query("INSERT INTO sla_configs (id, tenant_id, category, priority, response_hours, resolution_hours) VALUES (?, ?, ?, ?, ?, ?)", sla);
  }

  // ─── PROPERTY LAYOUT ─────────────────────────────────────────────────────
  console.log("[SEED] Seeding Property layout...");
  const societyId = crypto.randomUUID();
  await conn.query(
    "INSERT INTO societies (id, tenant_id, name, address, city, total_units) VALUES (?, ?, 'Green Pines Residencia', 'Main Club Road, Phase 1, Islamabad', 'Islamabad', 24)",
    [societyId, tenantId],
  );

  const blockIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const blockNames = ["Block A (Pine Heights Towers)", "Block B (Executive Villas)", "Block C (Commercial Plaza)"];
  for (let i = 0; i < 3; i++) {
    await conn.query("INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, ?)", [
      blockIds[i],
      societyId,
      tenantId,
      blockNames[i],
    ]);
  }

  // Tower in Block A
  const bldgId = crypto.randomUUID();
  await conn.query("INSERT INTO buildings (id, block_id, tenant_id, name, floors_count) VALUES (?, ?, ?, 'Pine Heights Tower 1', 4)", [bldgId, blockIds[0], tenantId]);

  const floorIds: string[] = [];
  for (let fl = 1; fl <= 4; fl++) {
    const fId = crypto.randomUUID();
    floorIds.push(fId);
    await conn.query("INSERT INTO floors (id, building_id, tenant_id, floor_number, name) VALUES (?, ?, ?, ?, ?)", [fId, bldgId, tenantId, fl, `Floor ${fl}`]);
  }

  // Units
  const unitIds: string[] = [];
  const residentsList = [
    { name: "Brig. (R) Ali Ahmed Khan", phone: "+92 300 2223344", email: "ali@demo.com", type: "owner" as const, unit: "101", typeName: "flat" },
    { name: "Saira Khan", phone: "+92 300 5556677", email: "saira@demo.com", type: "tenant" as const, unit: "102", typeName: "flat" },
    { name: "Dr. Zainab Malik", phone: "+92 300 8889900", email: "zainab@demo.com", type: "owner" as const, unit: "201", typeName: "flat" },
    { name: "Maj. (R) Kamran Shah", phone: "+92 300 4445566", email: "kamran@demo.com", type: "owner" as const, unit: "202", typeName: "flat" },
    { name: "Faiza Begum", phone: "+92 300 7778899", email: "faiza@demo.com", type: "owner" as const, unit: "301", typeName: "flat" },
    { name: "Bilal Butt", phone: "+92 300 9990011", email: "bilal@demo.com", type: "tenant" as const, unit: "302", typeName: "flat" },
    { name: "Col. (R) Tariq Mahmood", phone: "+92 300 1122334", email: "tariq@demo.com", type: "owner" as const, unit: "401", typeName: "penthouse" },
    { name: "Aisha Yusuf", phone: "+92 300 3334455", email: "aisha@demo.com", type: "owner" as const, unit: "Villa-01", typeName: "villa" },
  ];

  const residentUserIds: string[] = [];
  const residentPersonIds: string[] = [];
  const residentIds: string[] = [];

  for (let i = 0; i < residentsList.length; i++) {
    const res = residentsList[i];
    const uId = crypto.randomUUID();
    unitIds.push(uId);

    const isVilla = res.typeName === "villa";
    const blockId = isVilla ? blockIds[1] : blockIds[0];
    const floorId = isVilla ? null : floorIds[Math.floor(i / 2)];
    const buildingId = isVilla ? null : bldgId;

    await conn.query(
      `INSERT INTO units (id, floor_id, building_id, block_id, society_id, tenant_id, unit_number, unit_type, area_sqft, bedrooms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'occupied')`,
      [uId, floorId, buildingId, blockId, societyId, tenantId, res.unit, res.typeName, isVilla ? 4500 : 1800, isVilla ? 5 : 3],
    );

    const resUserId = crypto.randomUUID();
    residentUserIds.push(resUserId);
    await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [resUserId, res.email, passwordHash]);
    await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, 'Green Pines Residencia', ?, ?)", [resUserId, res.name, res.phone, tenantId]);
    await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [crypto.randomUUID(), resUserId, res.type === "owner" ? "resident" : "tenant"]);

    const personId = crypto.randomUUID();
    residentPersonIds.push(personId);
    await conn.query("INSERT INTO persons (id, tenant_id, user_id, full_name, email, phone, cnic) VALUES (?, ?, ?, ?, ?, ?, ?)", [personId, tenantId, resUserId, res.name, res.email, res.phone, `37405-112233${i}-1`]);

    const resId = crypto.randomUUID();
    residentIds.push(resId);
    await conn.query("INSERT INTO residents (id, person_id, unit_id, tenant_id, type, move_in_date, is_current, invite_status) VALUES (?, ?, ?, ?, ?, '2024-01-01', TRUE, 'accepted')", [resId, personId, uId, tenantId, res.type]);

    // Vehicle
    await conn.query("INSERT INTO resident_vehicles (id, resident_id, tenant_id, vehicle_type, make, model, plate_number, color) VALUES (?, ?, ?, 'car', 'Toyota', 'Corolla', ?, 'White')", [crypto.randomUUID(), resId, tenantId, `GPR-${100 + i}`]);
  }

  // ─── CHARGE HEADS & LEDGERS ──────────────────────────────────────────────
  console.log("[SEED] Seeding Charge Heads, Ledgers, and Payments...");
  const chMaintId = crypto.randomUUID();
  const chSecId   = crypto.randomUUID();
  const chSinkId  = crypto.randomUUID();

  await conn.query("INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Monthly Maintenance Fee', 'Building maintenance and common services', 12000.00)", [chMaintId, tenantId]);
  await conn.query("INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Security & Guard Charges', '24/7 Gate security & CCTV surveillance', 2500.00)", [chSecId, tenantId]);
  await conn.query("INSERT INTO charge_heads (id, tenant_id, name, description, default_amount) VALUES (?, ?, 'Sinking Fund Contribution', 'Reserve fund for major asset repairs', 1000.00)", [chSinkId, tenantId]);

  for (let i = 0; i < unitIds.length; i++) {
    const uId = unitIds[i];
    await conn.query("INSERT INTO wallets (id, tenant_id, unit_id, balance, low_balance_threshold) VALUES (?, ?, ?, 0.00, 2000.00)", [crypto.randomUUID(), tenantId, uId]);

    const chargeAmount = 15500.00;
    const receiptNo = `REC-GPR-${String(1000 + i)}`;

    await conn.query("INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, billing_period, balance_after, created_by) VALUES (?, ?, ?, 'charge', ?, ?, 'Monthly Maintenance & Security - Aug 2026', '2026-08', ?, ?)", [crypto.randomUUID(), tenantId, uId, chMaintId, chargeAmount, chargeAmount, userId]);
    await conn.query("INSERT INTO payments (id, tenant_id, unit_id, amount, payment_method, receipt_number, payment_date, reference, notes, status, recorded_by) VALUES (?, ?, ?, ?, 'bank_transfer', ?, '2026-08-05', ?, 'Online Bank Transfer via Meezan Bank', 'recorded', ?)", [crypto.randomUUID(), tenantId, uId, chargeAmount, receiptNo, `TXN-${receiptNo}`, userId]);
    await conn.query("INSERT INTO ledger_entries (id, tenant_id, unit_id, type, charge_head_id, amount, description, billing_period, balance_after, created_by) VALUES (?, ?, ?, 'payment', ?, ?, ?, '2026-08', 0.00, ?)", [crypto.randomUUID(), tenantId, uId, chMaintId, chargeAmount, `Payment Received - Receipt #${receiptNo}`, userId]);
  }

  // ─── BUDGETS & LINE ITEMS ────────────────────────────────────────────────
  console.log("[SEED] Seeding Budgets...");
  const budget2026Id = crypto.randomUUID();
  await conn.query("INSERT INTO budgets (id, tenant_id, year, title, is_approved) VALUES (?, ?, 2026, 'Annual Approved Budget 2026-27', TRUE)", [budget2026Id, tenantId]);

  const budgetLines = [
    ["Security Guard Services", 3600000.00, 2400000.00],
    ["Generator Fuel & Power", 2200000.00, 1450000.00],
    ["Elevator & Lifts Maintenance", 1200000.00, 800000.00],
    ["Water Pumps & Filtration", 900000.00, 580000.00],
    ["Horticulture & Parks", 600000.00, 390000.00],
    ["Janitorial & Waste Management", 950000.00, 620000.00],
  ];
  for (const bl of budgetLines) {
    await conn.query("INSERT INTO budget_line_items (id, budget_id, tenant_id, category, planned_amount, actual_amount) VALUES (?, ?, ?, ?, ?, ?)", [crypto.randomUUID(), budget2026Id, tenantId, bl[0], bl[1], bl[2]]);
  }

  // ─── VENDORS, RFQS, QUOTATIONS, PURCHASE ORDERS, VENDOR INVOICES ─────────
  console.log("[SEED] Seeding Vendors and Vendor Finance...");
  const vGenId = crypto.randomUUID();
  const vLiftId = crypto.randomUUID();
  const vSecId = crypto.randomUUID();

  await conn.query("INSERT INTO vendors (id, tenant_id, name, category, phone, email, rating, address, tax_id, contact_person, status) VALUES (?, ?, 'PowerPlus Generators Pakistan', 'Generators & Power', '+92 300 8111222', 'info@powerplus.pk', 4.9, 'I-9 Industrial Area, Islamabad', 'NTN-2849104-1', 'Engr. Farhan Malik', 'active')", [vGenId, tenantId]);
  await conn.query("INSERT INTO vendors (id, tenant_id, name, category, phone, email, rating, address, tax_id, contact_person, status) VALUES (?, ?, 'Apex Elevator Services', 'Lifts & Elevators', '+92 300 8333444', 'apex@demo.com', 4.8, 'Blue Area, Islamabad', 'NTN-3918273-4', 'Tariq Siddiqui', 'active')", [vLiftId, tenantId]);
  await conn.query("INSERT INTO vendors (id, tenant_id, name, category, phone, email, rating, address, tax_id, contact_person, status) VALUES (?, ?, 'Frontier Security Guards Pvt Ltd', 'Security', '+92 51 4455667', 'ops@frontier.pk', 4.7, 'Westridge, Rawalpindi', 'NTN-1928374-9', 'Col. (R) Javed', 'active')", [vSecId, tenantId]);

  const rfqId = crypto.randomUUID();
  await conn.query("INSERT INTO rfqs (id, tenant_id, title, description, status, due_date, budget_amount) VALUES (?, ?, 'Elevator Annual AMC Comprehensive Coverage', 'Comprehensive preventive and breakdown maintenance', 'awarded', '2026-06-30', 800000.00)", [rfqId, tenantId]);

  const quoteId = crypto.randomUUID();
  await conn.query("INSERT INTO quotations (id, rfq_id, vendor_id, tenant_id, amount, notes, status, delivery_timeline, valid_until, quotation_number) VALUES (?, ?, ?, ?, 750000.00, 'Includes 24/7 callout coverage and all hoist spare parts.', 'approved', 'Immediate', '2026-12-31', 'QT-APEX-GPR-01')", [quoteId, rfqId, vLiftId, tenantId]);

  const poId = crypto.randomUUID();
  await conn.query("INSERT INTO purchase_orders (id, tenant_id, vendor_id, amount, status, po_number, rfq_id, quotation_id, notes) VALUES (?, ?, ?, 750000.00, 'approved', 'PO-GPR-2026-001', ?, ?, 'Full year AMC payment released quarterly.')", [poId, tenantId, vLiftId, rfqId, quoteId]);

  await conn.query("INSERT INTO vendor_invoices (id, tenant_id, vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, amount, paid_amount, status, notes, recorded_by) VALUES (?, ?, ?, ?, 'INV-APEX-Q1', '2026-07-01', '2026-07-31', 187500.00, 187500.00, 'paid', 'Q1 AMC Paid', ?)", [crypto.randomUUID(), tenantId, vLiftId, poId, userId]);
  await conn.query("INSERT INTO vendor_invoices (id, tenant_id, vendor_id, purchase_order_id, invoice_number, invoice_date, due_date, amount, paid_amount, status, notes, recorded_by) VALUES (?, ?, ?, ?, 'INV-APEX-Q2', '2026-08-01', '2026-08-31', 187500.00, 0.00, 'pending', 'Q2 AMC Pending', ?)", [crypto.randomUUID(), tenantId, vLiftId, poId, userId]);

  // ─── INVENTORY ITEMS & STOCK MOVEMENTS ───────────────────────────────────
  console.log("[SEED] Seeding Inventory...");
  const item1Id = crypto.randomUUID();
  const item2Id = crypto.randomUUID();
  const item3Id = crypto.randomUUID();
  await conn.query("INSERT INTO inventory_items (id, tenant_id, name, sku, category, unit_of_measure, quantity, reorder_level, unit_cost, location) VALUES (?, ?, 'Philips LED Corridor Light 36W', 'ELEC-LED-01', 'Electrical', 'pcs', 80.00, 20.00, 850.00, 'Main Store Shelf A1')", [item1Id, tenantId]);
  await conn.query("INSERT INTO inventory_items (id, tenant_id, name, sku, category, unit_of_measure, quantity, reorder_level, unit_cost, location) VALUES (?, ?, 'Schneider 16A MCB Single Pole', 'ELEC-MCB-16', 'Electrical', 'pcs', 35.00, 10.00, 450.00, 'Main Store Shelf A2')", [item2Id, tenantId]);
  await conn.query("INSERT INTO inventory_items (id, tenant_id, name, sku, category, unit_of_measure, quantity, reorder_level, unit_cost, location) VALUES (?, ?, 'PPRC Water Pipe 32mm', 'PLUMB-PPRC-32', 'Plumbing', 'lengths', 25.00, 8.00, 1200.00, 'Plumbing Bay')", [item3Id, tenantId]);

  await conn.query("INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, reference, notes, created_by) VALUES (?, ?, ?, 'in', 50.00, 'PO-GPR-2026-003', 'Stock replenishment', ?)", [crypto.randomUUID(), tenantId, item1Id, userId]);
  await conn.query("INSERT INTO stock_movements (id, tenant_id, item_id, movement_type, quantity, reference, notes, created_by) VALUES (?, ?, ?, 'out', 2.00, 'WO-MAINT-101', 'Replaced in corridor Tower 1', ?)", [crypto.randomUUID(), tenantId, item1Id, techId]);

  // ─── PROJECTS, MILESTONES, EXPENSES ──────────────────────────────────────
  console.log("[SEED] Seeding Projects...");
  const projId = crypto.randomUUID();
  await conn.query("INSERT INTO projects (id, tenant_id, name, description, status, budget_amount, start_date, end_date, owner_id, resident_visible) VALUES (?, ?, 'CCTV & Boundary Security Upgrade', 'Upgrading boundary wall and gates with 32 4K IP cameras', 'in_progress', 1800000.00, '2026-07-01', '2026-10-31', ?, TRUE)", [projId, tenantId, userId]);
  await conn.query("INSERT INTO project_milestones (id, tenant_id, project_id, title, due_date, status, notes) VALUES (?, ?, ?, 'Fiber Cabling Installation', '2026-07-25', 'completed', 'All 1.5km optical fiber laid')", [crypto.randomUUID(), tenantId, projId]);
  await conn.query("INSERT INTO project_milestones (id, tenant_id, project_id, title, due_date, status, notes) VALUES (?, ?, ?, 'Camera Mounting & Power Setup', '2026-09-10', 'in_progress', '24 of 32 cameras mounted')", [crypto.randomUUID(), tenantId, projId]);
  await conn.query("INSERT INTO project_expenses (id, tenant_id, project_id, vendor_id, title, amount, expense_date, invoice_number, notes, created_by) VALUES (?, ?, ?, ?, 'Optical Fiber Cable & Media Converters', 450000.00, '2026-07-20', 'INV-FIB-101', 'Verified by Network Engineer', ?)", [crypto.randomUUID(), tenantId, projId, vGenId, userId]);

  // ─── ASSETS, MAINTENANCE SCHEDULES & WORK ORDERS ─────────────────────────
  console.log("[SEED] Seeding Assets & Maintenance...");
  const assetGenId = crypto.randomUUID();
  const assetLiftId = crypto.randomUUID();
  const assetPumpId = crypto.randomUUID();

  await conn.query("INSERT INTO assets (id, tenant_id, name, category, location, serial_number, purchase_date, purchase_cost, current_valuation, status, warranty_expires_at, has_amc, amc_vendor_id, amc_cost, amc_start_date, amc_expires_at, notes) VALUES (?, ?, 'Cummins 250kVA Generator DG-1', 'generators', 'Basement Power Room', 'DG-001-2023', '2023-01-15', 7500000.00, 6500000.00, 'active', '2028-01-31', TRUE, ?, 350000.00, '2026-01-01', '2026-12-31', 'Main backup power generator')", [assetGenId, tenantId, vGenId]);
  await conn.query("INSERT INTO assets (id, tenant_id, name, category, location, serial_number, purchase_date, purchase_cost, current_valuation, status, warranty_expires_at, has_amc, amc_vendor_id, amc_cost, amc_start_date, amc_expires_at, notes) VALUES (?, ?, 'Mitsubishi Passenger Elevator A1', 'elevators', 'Pine Heights Tower 1', 'ELV-A1-2024', '2022-05-10', 5500000.00, 4800000.00, 'active', '2027-05-31', TRUE, ?, 280000.00, '2026-01-01', '2026-12-31', '10-passenger passenger lift')", [assetLiftId, tenantId, vLiftId]);
  await conn.query("INSERT INTO assets (id, tenant_id, name, category, location, serial_number, purchase_date, purchase_cost, current_valuation, status, warranty_expires_at, has_amc, amc_cost, notes) VALUES (?, ?, 'Grundfos Booster Pump System', 'pumps', 'Pump House', 'WPM-003', '2023-03-20', 1800000.00, 1500000.00, 'active', '2028-03-31', FALSE, 0.00, 'Water supply pressure pumps')", [assetPumpId, tenantId]);

  await conn.query("INSERT INTO maintenance_schedules (id, asset_id, tenant_id, title, frequency, task_description, next_due_date, assigned_vendor_id, assigned_technician_id, is_active, notes) VALUES (?, ?, ?, 'Quarterly Generator Oil & Filter Servicing', 'quarterly', 'Replace lube oil and air filters', '2026-09-15', ?, ?, TRUE, 'Standard Cummins OEM schedule')", [crypto.randomUUID(), assetGenId, tenantId, vGenId, techId]);
  await conn.query("INSERT INTO maintenance_schedules (id, asset_id, tenant_id, title, frequency, task_description, next_due_date, assigned_vendor_id, assigned_technician_id, is_active, notes) VALUES (?, ?, ?, 'Monthly Elevator Hoist & Brake Check', 'monthly', 'Inspect hoist cables and brake clearance', '2026-09-01', ?, ?, TRUE, 'Monthly safety checklist')", [crypto.randomUUID(), assetLiftId, tenantId, vLiftId, techId]);

  await conn.query("INSERT INTO maintenance_work_orders (id, tenant_id, asset_id, title, description, status, priority, assigned_technician_id, assigned_vendor_id, cost, estimated_cost, actual_cost, sla_due_at, completed_at, notes) VALUES (?, ?, ?, 'Quarterly Elevator Hoist Inspection', 'Lubricate guide rails and adjust door sensor', 'completed', 'normal', ?, ?, 15000.00, 15000.00, 15000.00, '2026-08-01', '2026-08-02 11:00:00', 'Smooth running verified')", [crypto.randomUUID(), tenantId, assetLiftId, techId, vLiftId]);
  await conn.query("INSERT INTO maintenance_work_orders (id, tenant_id, asset_id, title, description, status, priority, assigned_technician_id, assigned_vendor_id, cost, estimated_cost, actual_cost, sla_due_at, completed_at, notes) VALUES (?, ?, ?, 'Generator ATS Relay Calibration', 'Tune automatic transfer switch timing', 'in_progress', 'high', ?, ?, 8500.00, 10000.00, 0.00, '2026-08-28', NULL, 'Testing in progress')", [crypto.randomUUID(), tenantId, assetGenId, techId, vGenId]);

  // ─── COMPLAINTS & COMMENTS ───────────────────────────────────────────────
  console.log("[SEED] Seeding Complaints...");
  const c1Id = crypto.randomUUID();
  const c2Id = crypto.randomUUID();
  const c3Id = crypto.randomUUID();

  await conn.query("INSERT INTO complaints (id, tenant_id, unit_id, submitted_by, assigned_to, category, priority, status, title, description, sla_deadline, escalated, satisfaction_rating, resolution_notes, created_by) VALUES (?, ?, ?, ?, ?, 'lift', 'high', 'in_progress', 'Elevator A1 rattling sound between 2nd & 3rd floor', 'Vibrations observed during upward transit.', '2026-08-29 18:00:00', FALSE, NULL, NULL, ?)", [c1Id, tenantId, unitIds[0], residentUserIds[0], techId, residentUserIds[0]]);
  await conn.query("INSERT INTO complaints (id, tenant_id, unit_id, submitted_by, assigned_to, category, priority, status, title, description, sla_deadline, escalated, satisfaction_rating, resolution_notes, created_by) VALUES (?, ?, ?, ?, ?, 'plumbing', 'critical', 'open', 'Basement pipe dripping on parking slot P-102', 'Water leakage near main sewer riser.', '2026-08-28 12:00:00', FALSE, NULL, NULL, ?)", [c2Id, tenantId, unitIds[1], residentUserIds[1], techId, residentUserIds[1]]);
  await conn.query("INSERT INTO complaints (id, tenant_id, unit_id, submitted_by, assigned_to, category, priority, status, title, description, sla_deadline, escalated, satisfaction_rating, resolution_notes, created_by) VALUES (?, ?, ?, ?, ?, 'electrical', 'low', 'resolved', 'Corridor light fused on 2nd floor', 'Bulb needs replacement in hallway.', '2026-08-20 18:00:00', FALSE, 5, 'Replaced with 36W LED light.', ?)", [c3Id, tenantId, unitIds[2], residentUserIds[2], techId, residentUserIds[2]]);

  await conn.query("INSERT INTO complaint_comments (id, complaint_id, author_id, body, is_internal) VALUES (?, ?, ?, 'Technician dispatched to inspect guide shoes.', FALSE)", [crypto.randomUUID(), c1Id, techId]);

  // ─── GATE, PATROLS, VISITOR PASSES, DOMESTIC STAFF, BLACKLIST ────────────
  console.log("[SEED] Seeding Security, Visitors, and Domestic Staff...");
  const gt1Id = crypto.randomUUID();
  const gt2Id = crypto.randomUUID();
  await conn.query("INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Main Gate 1', 'North Entrance Avenue', 'active')", [gt1Id, tenantId]);
  await conn.query("INSERT INTO gate_terminals (id, tenant_id, name, location, status) VALUES (?, ?, 'Executive Gate 2', 'South Exit', 'active')", [gt2Id, tenantId]);

  await conn.query("INSERT INTO guard_patrols (id, tenant_id, guard_name, checkpoint_name, scanned_at, notes) VALUES (?, ?, 'Havaldar (R) Rafiq', 'Main Gate 1', '2026-08-27 10:00:00', 'Barrier operational, all clear')", [crypto.randomUUID(), tenantId]);
  await conn.query("INSERT INTO guard_patrols (id, tenant_id, guard_name, checkpoint_name, scanned_at, notes) VALUES (?, ?, 'Havaldar (R) Rafiq', 'Basement Parking Checkpoint', '2026-08-27 11:30:00', 'No unauthorized parking')", [crypto.randomUUID(), tenantId]);

  const vp1Id = crypto.randomUUID();
  const vp2Id = crypto.randomUUID();
  await conn.query("INSERT INTO visitor_passes (id, tenant_id, resident_id, visitor_name, visitor_phone, expected_at, pass_code, status, visitor_type, vehicle_plate, pre_registered, expires_at, notes, created_by) VALUES (?, ?, ?, 'Dr. Naveed Farooq', '+92 321 5551234', '2026-08-27 15:00:00', 'VP-1001', 'active', 'one_time', 'ICT-8841', TRUE, '2026-08-27 22:00:00', 'Family guest visit', ?)", [vp1Id, tenantId, residentIds[0], residentUserIds[0]]);
  await conn.query("INSERT INTO visitor_passes (id, tenant_id, resident_id, visitor_name, visitor_phone, expected_at, pass_code, status, visitor_type, vehicle_plate, pre_registered, expires_at, notes, created_by) VALUES (?, ?, ?, 'TCS Delivery Courier', '+92 333 9988776', '2026-08-27 11:00:00', 'VP-1002', 'used', 'one_time', 'RWP-4412', TRUE, '2026-08-27 18:00:00', 'Parcel delivery', ?)", [vp2Id, tenantId, residentIds[1], residentUserIds[1]]);

  await conn.query("INSERT INTO entry_exit_log (id, tenant_id, visitor_pass_id, visitor_name, vehicle_plate, gate_id, direction, verified_by, unit_id, notes, timestamp) VALUES (?, ?, ?, 'TCS Delivery Courier', 'RWP-4412', ?, 'in', ?, ?, 'Verified at gate', '2026-08-27 11:05:00')", [crypto.randomUUID(), tenantId, vp2Id, gt1Id, guardId, unitIds[1]]);

  await conn.query("INSERT INTO domestic_staff (id, tenant_id, resident_id, staff_code, name, phone, staff_type, valid_from, valid_until, allowed_days, entry_start_time, entry_end_time, vehicle_plate, notes, is_active, created_by) VALUES (?, ?, ?, 'DS-00001', 'Kalsoom Bibi', '+92 301 7766554', 'maid', '2026-01-01', '2026-12-31', 'Mon,Tue,Wed,Thu,Fri,Sat', '08:00:00', '16:00:00', NULL, 'Domestic housekeeping assistant', TRUE, ?)", [crypto.randomUUID(), tenantId, residentIds[0], residentUserIds[0]]);
  await conn.query("INSERT INTO domestic_staff (id, tenant_id, resident_id, staff_code, name, phone, staff_type, valid_from, valid_until, allowed_days, entry_start_time, entry_end_time, vehicle_plate, notes, is_active, created_by) VALUES (?, ?, ?, 'DS-00002', 'Muhammad Akram', '+92 302 4433221', 'driver', '2026-01-01', '2026-12-31', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', '07:00:00', '20:00:00', 'ICT-5542', 'Personal family driver', TRUE, ?)", [crypto.randomUUID(), tenantId, residentIds[1], residentUserIds[1]]);

  await conn.query("INSERT INTO blacklist (id, tenant_id, type, value, reason) VALUES (?, ?, 'vehicle', 'LZA-4471', 'Unauthorized repeated entry attempts')", [crypto.randomUUID(), tenantId]);
  await conn.query("INSERT INTO visitor_blacklist (id, tenant_id, name, phone, vehicle_plate, reason, added_by) VALUES (?, ?, 'Usman Tariq', '+92 300 9182736', 'LZA-4471', 'Disorderly conduct at parking lot', ?)", [crypto.randomUUID(), tenantId, userId]);

  // ─── PARKING SLOTS & ALLOCATIONS ─────────────────────────────────────────
  console.log("[SEED] Seeding Parking slots...");
  const slotLabels = ["P-101", "P-102", "P-103", "P-104", "P-105", "P-106", "P-107", "P-108"];
  for (let s = 0; s < slotLabels.length; s++) {
    const slotId = crypto.randomUUID();
    const isAllocated = s < 6;
    await conn.query("INSERT INTO parking_slots (id, tenant_id, label, block, floor_number, slot_type, status) VALUES (?, ?, ?, 'Basement 1', -1, 'covered', ?)", [slotId, tenantId, slotLabels[s], isAllocated ? "occupied" : "free"]);
    if (isAllocated) {
      await conn.query("INSERT INTO parking_allocations (id, tenant_id, slot_id, unit_id, resident_name, vehicle_plate, vehicle_type, is_current, created_by) VALUES (?, ?, ?, ?, ?, ?, 'car', TRUE, ?)", [crypto.randomUUID(), tenantId, slotId, unitIds[s], residentsList[s].name, `GPR-${100 + s}`, userId]);
    }
  }

  // ─── UTILITY METERS ──────────────────────────────────────────────────────
  console.log("[SEED] Seeding Utility Meters...");
  const rateElecId = crypto.randomUUID();
  await conn.query("INSERT INTO meter_rates (id, tenant_id, meter_type, rate_per_unit, currency, effective_from) VALUES (?, ?, 'electricity', 28.50, 'PKR', '2026-01-01')", [rateElecId, tenantId]);
  await conn.query("INSERT INTO meter_readings (id, tenant_id, unit_id, meter_type, reading_date, current_reading, previous_reading, charged_amount, created_by) VALUES (?, ?, ?, 'electricity', '2026-08-01', 340.00, 100.00, 6840.00, ?)", [crypto.randomUUID(), tenantId, unitIds[0], userId]);
  await conn.query("INSERT INTO meter_readings (id, tenant_id, unit_id, meter_type, reading_date, current_reading, previous_reading, charged_amount, created_by) VALUES (?, ?, ?, 'electricity', '2026-08-01', 290.00, 80.00, 5985.00, ?)", [crypto.randomUUID(), tenantId, unitIds[1], userId]);

  // ─── NOTICES, FORUM, POLLS, EVENTS, AMENITIES, GOVERNANCE ────────────────
  console.log("[SEED] Seeding Community & Governance...");
  const not1Id = crypto.randomUUID();
  await conn.query("INSERT INTO notices (id, tenant_id, author_id, title, body, priority, is_pinned, is_emergency, target_scope, publish_at) VALUES (?, ?, ?, 'Overhead Water Tank Cleanout Notice', 'Water supply will be suspended tomorrow from 09:00 AM to 01:00 PM for scheduled tank cleanout.', 'urgent', TRUE, FALSE, 'all', '2026-08-27 08:00:00')", [not1Id, tenantId, userId]);
  await conn.query("INSERT INTO notice_reads (id, notice_id, user_id, read_at) VALUES (?, ?, ?, '2026-08-27 09:15:00')", [crypto.randomUUID(), not1Id, residentUserIds[0]]);

  const thId = crypto.randomUUID();
  await conn.query("INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body, allow_comments) VALUES (?, ?, ?, 'general', 'High Speed Fiber Optic Internet in Block A', 'Which ISP provides best latency for remote working?', TRUE)", [thId, tenantId, residentUserIds[0]]);
  await conn.query("INSERT INTO forum_replies (id, thread_id, author_id, body) VALUES (?, ?, ?, 'Nayatel and StormFiber are both active with zero downtime.')", [crypto.randomUUID(), thId, residentUserIds[1]]);

  const pollId = crypto.randomUUID();
  await conn.query("INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at, is_anonymous, eligible_voters) VALUES (?, ?, 'Should we install Solar Panels for Common Area Lighting?', 'single', '[\"Yes, approve budget\", \"No, keep existing setup\"]', '2026-08-01 00:00:00', '2026-09-15 00:00:00', FALSE, 'all')", [pollId, tenantId]);
  await conn.query("INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected) VALUES (?, ?, ?, 'Yes, approve budget', '0')", [crypto.randomUUID(), pollId, residentUserIds[0]]);

  const evId = crypto.randomUUID();
  await conn.query("INSERT INTO events (id, tenant_id, title, cover_url, starts_at, ends_at, venue, allow_rsvp, capacity, description) VALUES (?, ?, 'Green Pines Annual Gala & High Tea', 'https://images.unsplash.com/photo-1511578314322-379afb476865', '2026-08-14 17:00:00', '2026-08-14 21:00:00', 'Central Lawn / Community Park', TRUE, 200, 'Flag hoisting, kids sports gala, high tea buffet.')", [evId, tenantId]);
  await conn.query("INSERT INTO event_rsvps (id, event_id, user_id, status, guests_count, notes) VALUES (?, ?, ?, 'yes', 3, 'Attending with family')", [crypto.randomUUID(), evId, residentUserIds[0]]);

  const am1Id = crypto.randomUUID();
  const am2Id = crypto.randomUUID();
  await conn.query("INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active) VALUES (?, ?, 'Green Pines Banquet Hall', 'hall', 150, 240, '09:00:00', '23:00:00', 15000.00, 10000.00, 'Music off by 10:30 PM.', TRUE)", [am1Id, tenantId]);
  await conn.query("INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active) VALUES (?, ?, 'Community Swimming Pool', 'pool', 30, 60, '06:00:00', '21:00:00', 300.00, 0.00, 'Swimming costume required.', TRUE)", [am2Id, tenantId]);
  await conn.query("INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, guests_count, purpose, status) VALUES (?, ?, ?, ?, '2026-09-15', '18:00:00', '22:00:00', 80, 'Family Dinner Party', 'approved')", [crypto.randomUUID(), tenantId, am1Id, residentUserIds[0]]);

  const meetId = crypto.randomUUID();
  await conn.query("INSERT INTO governance_meetings (id, tenant_id, title, description, scheduled_at, status, meeting_minutes) VALUES (?, ?, 'Annual General Meeting 2026', 'Review and approval of FY 2026-27 annual budget and accounts.', '2026-08-10 17:00:00', 'completed', 'Budget approved unanimously by management committee.')", [meetId, tenantId]);
  await conn.query("INSERT INTO governance_resolutions (id, tenant_id, meeting_id, title, description, status, votes_for, votes_against) VALUES (?, ?, ?, 'Approve FY 2026-27 Budget', 'Approve annual operational budget and reserve contributions', 'passed', 8, 0)", [crypto.randomUUID(), tenantId, meetId]);

  // ─── DOCUMENTS, NOTIFICATIONS, AUDIT LOGS, FORM SUBMISSIONS ──────────────
  console.log("[SEED] Seeding Documents, Notifications, and Audit Logs...");
  await conn.query("INSERT INTO documents (id, tenant_id, name, category, file_url, uploaded_by, version, expiry_date) VALUES (?, ?, 'Green Pines Society Bylaws 2026', 'legal', 'https://housingos.org/mock-bylaws.pdf', ?, 1, '2030-12-31')", [crypto.randomUUID(), tenantId, userId]);
  await conn.query("INSERT INTO documents (id, tenant_id, name, category, file_url, uploaded_by, version, expiry_date) VALUES (?, ?, 'Building Safety & Fire Civil Defense Certificate', 'noc', 'https://housingos.org/mock-fire-noc.pdf', ?, 1, '2027-12-31')", [crypto.randomUUID(), tenantId, userId]);

  await conn.query("INSERT INTO notifications (id, tenant_id, user_id, title, message, body, type, read_status) VALUES (?, ?, ?, 'Welcome to Green Pines!', 'You are registered as administrator.', 'You are registered as administrator.', 'system', FALSE)", [crypto.randomUUID(), tenantId, userId]);
  await conn.query("INSERT INTO notifications (id, tenant_id, user_id, title, message, body, type, read_status) VALUES (?, ?, ?, 'Payment Verified', 'Monthly maintenance payment has been recorded.', 'Monthly maintenance payment has been recorded.', 'billing', FALSE)", [crypto.randomUUID(), tenantId, residentUserIds[0]]);

  await conn.query("INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, ?, 'USER_LOGIN', 'platform', ?, '127.0.0.1')", [crypto.randomUUID(), tenantId, userId, userId]);
  await conn.query("INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, ?, 'RECORD_PAYMENT', 'payments', ?, '127.0.0.1')", [crypto.randomUUID(), tenantId, userId, unitIds[0]]);

  await conn.query("INSERT INTO form_submissions (id, user_id, tenant_id, module_key, form_key, form_title, payload) VALUES (?, ?, ?, 'residents', 'resident_onboarding', 'Resident Onboarding Form', ?)", [crypto.randomUUID(), residentUserIds[0], tenantId, JSON.stringify({ name: residentsList[0].name, unit: residentsList[0].unit })]);
  await conn.query("INSERT INTO form_submissions (id, user_id, tenant_id, module_key, form_key, form_title, payload) VALUES (?, ?, ?, 'complaints', 'complaint_submission', 'Maintenance Complaint Form', ?)", [crypto.randomUUID(), residentUserIds[1], tenantId, JSON.stringify({ category: "plumbing", description: "Basement leakage" })]);

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ✅  COMPLETE 100% MODULE SEED FINISHED SUCCESSFULLY!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Login: admin@demo.com / demo1234");
  console.log("═══════════════════════════════════════════════════════════");

  await conn.end();
}

seed().catch((err) => {
  console.error("Seed execution failed: ", err);
  process.exit(1);
});
