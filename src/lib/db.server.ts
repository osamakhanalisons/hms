import mysql from "mysql2/promise";
import crypto from "node:crypto";

let pool: mysql.Pool | null = null;

export function getDb() {
  if (!pool) {
    const host = process.env.MYSQL_HOST || "localhost";
    const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
    const user = process.env.MYSQL_USER || "root";
    const password = process.env.MYSQL_PASSWORD || "";
    const database = process.env.MYSQL_DATABASE || "at_bms";

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

export async function initDb() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "at_bms";

  try {
    const conn = await mysql.createConnection({ host, port, user, password });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await conn.end();
  } catch (err) {
    console.error("Failed to pre-verify/create database: ", err);
  }

  const db = getDb();
  console.log("[DB] Initializing MySQL tables if not exist...");

  // ─── PLATFORM CORE ────────────────────────────────────────────────────────

  // Users
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(36) PRIMARY KEY,
      full_name VARCHAR(255) NULL,
      phone VARCHAR(255) NULL,
      society_name VARCHAR(255) NULL,
      avatar_url TEXT NULL,
      tenant_id VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  // User roles
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      role VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_role (user_id, role),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);


  try {
    await db.query(`ALTER TABLE user_roles MODIFY COLUMN role VARCHAR(100) NOT NULL`);
  } catch (_) {
    /* already compatible */
  }
  // Custom tenant roles
  await db.query(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(100) NOT NULL,
      label VARCHAR(100) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_role_per_tenant (tenant_id, name),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Sessions
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Tenants (societies)
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(128) UNIQUE NOT NULL,
      plan ENUM('starter','growth','professional','enterprise') NOT NULL DEFAULT 'starter',
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
      currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
      date_format VARCHAR(32) NOT NULL DEFAULT 'DD/MM/YYYY',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      trial_ends_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  // ─── TENANTS: safe column additions for multi-society management ──────────
  try {
    await db.query(`ALTER TABLE tenants ADD COLUMN contact_email VARCHAR(255) NULL`);
  } catch (_) { /* column already exists */ }
  try {
    await db.query(`ALTER TABLE tenants ADD COLUMN contact_phone VARCHAR(64) NULL`);
  } catch (_) { /* column already exists */ }
  try {
    await db.query(`ALTER TABLE tenants ADD COLUMN address TEXT NULL`);
  } catch (_) { /* column already exists */ }
  try {
    await db.query(`ALTER TABLE tenants ADD COLUMN code VARCHAR(64) NULL`);
  } catch (_) { /* column already exists */ }
  try {
    await db.query(`ALTER TABLE tenants ADD UNIQUE KEY uniq_tenant_code (code)`);
  } catch (_) { /* constraint already exists */ }

  // Module registry (canonical list — seeded once)
  await db.query(`
    CREATE TABLE IF NOT EXISTS module_registry (
      module_key VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(128) NOT NULL,
      category VARCHAR(64) NOT NULL,
      description TEXT NULL,
      icon VARCHAR(64) NULL,
      min_plan ENUM('core','starter','growth','professional','enterprise') NOT NULL DEFAULT 'starter',
      dependencies JSON NOT NULL DEFAULT ('[]'),
      is_core BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB;
  `);

  // Tenant module activations
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenant_modules (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      module_key VARCHAR(64) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      settings JSON NOT NULL DEFAULT ('{}'),
      activated_at TIMESTAMP NULL,
      activated_by VARCHAR(36) NULL,
      deactivated_at TIMESTAMP NULL,
      deactivated_by VARCHAR(36) NULL,
      UNIQUE KEY uniq_tenant_module (tenant_id, module_key),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Role permissions
  await db.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tenant_id VARCHAR(36) NOT NULL,
      role VARCHAR(50) NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      can_view BOOLEAN DEFAULT FALSE,
      can_create BOOLEAN DEFAULT FALSE,
      can_edit BOOLEAN DEFAULT FALSE,
      can_delete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_role_module (tenant_id, role, module_key),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Audit logs (append-only)
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NULL,
      user_id VARCHAR(36) NULL,
      action VARCHAR(128) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(36) NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      ip_address VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  // ─── PROPERTY MODULE ──────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS societies (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      address TEXT NULL,
      city VARCHAR(128) NULL,
      total_units INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id VARCHAR(36) PRIMARY KEY,
      society_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS buildings (
      id VARCHAR(36) PRIMARY KEY,
      block_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(128) NOT NULL,
      floors_count INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS floors (
      id VARCHAR(36) PRIMARY KEY,
      building_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      floor_number INT NOT NULL,
      name VARCHAR(128) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS units (
      id VARCHAR(36) PRIMARY KEY,
      floor_id VARCHAR(36) NULL,
      building_id VARCHAR(36) NULL,
      block_id VARCHAR(36) NULL,
      society_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      unit_number VARCHAR(64) NOT NULL,
      unit_type ENUM('flat','villa','shop','office','penthouse','other') NOT NULL DEFAULT 'flat',
      area_sqft DECIMAL(10,2) NULL,
      bedrooms TINYINT NULL,
      status ENUM('occupied','vacant','renovation','locked') NOT NULL DEFAULT 'vacant',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
      FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
      FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_tenant_unit (tenant_id, block_id, building_id, floor_id, unit_number),
      INDEX idx_units_tenant_hierarchy (tenant_id, block_id, building_id, floor_id)
    ) ENGINE=InnoDB;
  `);

  try {
    await db.query("ALTER TABLE units MODIFY COLUMN unit_type ENUM('flat','apartment','villa','house','shop','office','penthouse','other') NOT NULL DEFAULT 'flat'");
  } catch (_) {}

  // ─── RESIDENTS MODULE ─────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS persons (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NULL,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(64) NULL,
      cnic VARCHAR(20) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS residents (
      id VARCHAR(36) PRIMARY KEY,
      person_id VARCHAR(36) NOT NULL,
      unit_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      type ENUM('owner','tenant') NOT NULL DEFAULT 'owner',
      move_in_date DATE NULL,
      move_out_date DATE NULL,
      is_current BOOLEAN NOT NULL DEFAULT TRUE,
      invite_status ENUM('pending','accepted','not_invited') NOT NULL DEFAULT 'not_invited',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS resident_vehicles (
      id VARCHAR(36) PRIMARY KEY,
      resident_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      vehicle_type ENUM('car','motorcycle','van','truck','other') NOT NULL DEFAULT 'car',
      make VARCHAR(128) NULL,
      model VARCHAR(128) NULL,
      plate_number VARCHAR(32) NOT NULL,
      color VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── LEDGER MODULE ────────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS charge_heads (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT NULL,
      default_amount DECIMAL(12,2) NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id VARCHAR(36) PRIMARY KEY,
      unit_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      type ENUM('charge','payment','adjustment','opening_balance') NOT NULL,
      charge_head_id VARCHAR(36) NULL,
      amount DECIMAL(12,2) NOT NULL,
      description VARCHAR(255) NULL,
      billing_period VARCHAR(7) NULL COMMENT 'YYYY-MM',
      reference_id VARCHAR(36) NULL COMMENT 'payment_id or charge_id',
      balance_after DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      unit_id VARCHAR(36) NOT NULL UNIQUE,
      balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      low_balance_threshold DECIMAL(12,2) NOT NULL DEFAULT 50.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── PAYMENTS MODULE ──────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(36) PRIMARY KEY,
      unit_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_method ENUM('cash','bank_transfer','cheque','online','stripe') NOT NULL DEFAULT 'cash',
      receipt_number VARCHAR(64) UNIQUE NOT NULL,
      payment_date DATE NOT NULL,
      reference VARCHAR(128) NULL COMMENT 'cheque no / transaction id',
      notes TEXT NULL,
      status ENUM('recorded','reversed') NOT NULL DEFAULT 'recorded',
      recorded_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── COMPLAINTS MODULE ────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS sla_configs (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      category VARCHAR(64) NOT NULL,
      priority ENUM('low','medium','high','critical') NOT NULL,
      response_hours INT NOT NULL DEFAULT 24,
      resolution_hours INT NOT NULL DEFAULT 72,
      UNIQUE KEY uniq_sla (tenant_id, category, priority),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      unit_id VARCHAR(36) NULL,
      submitted_by VARCHAR(36) NULL,
      assigned_to VARCHAR(36) NULL,
      category ENUM('electrical','plumbing','security','cleaning','lift','water','civil','hvac','other','general') NOT NULL DEFAULT 'other',
      priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      status ENUM('open','assigned','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      sla_deadline TIMESTAMP NULL,
      escalated BOOLEAN NOT NULL DEFAULT FALSE,
      satisfaction_rating TINYINT NULL COMMENT '1-5 stars',
      resolution_notes TEXT NULL,
      created_by VARCHAR(36) NULL COMMENT 'User who created the complaint',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS complaint_comments (
      id VARCHAR(36) PRIMARY KEY,
      complaint_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NULL,
      body TEXT NOT NULL,
      is_internal BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS complaint_history (
      id VARCHAR(36) PRIMARY KEY,
      complaint_id VARCHAR(36) NOT NULL,
      changed_by VARCHAR(36) NULL,
      field_changed VARCHAR(64) NOT NULL,
      old_value VARCHAR(255) NULL,
      new_value VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── NOTICE BOARD MODULE ──────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS notices (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
      target_scope ENUM('all','block','building') NOT NULL DEFAULT 'all',
      target_id VARCHAR(36) NULL COMMENT 'block_id or building_id when scoped',
      publish_at TIMESTAMP NULL COMMENT 'scheduled publish — null = immediate',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS notice_reads (
      id VARCHAR(36) PRIMARY KEY,
      notice_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_notice_read (notice_id, user_id),
      FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── VENDORS MODULE ───────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(128) NOT NULL,
      phone VARCHAR(64) NULL,
      email VARCHAR(255) NULL,
      rating DECIMAL(3,2) NOT NULL DEFAULT 5.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS rfqs (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('draft','sent','awarded','closed') NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS quotations (
      id VARCHAR(36) PRIMARY KEY,
      rfq_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      notes TEXT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pending','approved','completed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ── Auto-migrations for vendors, rfqs, quotations, purchase_orders ──
  try {
    const [vCols] = (await db.query(`SHOW COLUMNS FROM vendors`)) as any[];
    const vColNames = new Set(vCols.map((c: any) => c.Field));
    const vColumnsToAdd = [
      { name: "address", sql: "ALTER TABLE vendors ADD COLUMN address TEXT NULL" },
      { name: "tax_id", sql: "ALTER TABLE vendors ADD COLUMN tax_id VARCHAR(64) NULL" },
      { name: "contact_person", sql: "ALTER TABLE vendors ADD COLUMN contact_person VARCHAR(128) NULL" },
      { name: "bank_details", sql: "ALTER TABLE vendors ADD COLUMN bank_details TEXT NULL" },
      { name: "status", sql: "ALTER TABLE vendors ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'" },
      { name: "updated_at", sql: "ALTER TABLE vendors ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of vColumnsToAdd) {
      if (!vColNames.has(col.name)) await db.query(col.sql);
    }
  } catch (err) { console.error("Vendors table migration error:", err); }

  try {
    const [rfqCols] = (await db.query(`SHOW COLUMNS FROM rfqs`)) as any[];
    const rfqColNames = new Set(rfqCols.map((c: any) => c.Field));
    const rfqColumnsToAdd = [
      { name: "due_date", sql: "ALTER TABLE rfqs ADD COLUMN due_date DATE NULL" },
      { name: "budget_amount", sql: "ALTER TABLE rfqs ADD COLUMN budget_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00" },
      { name: "awarded_vendor_id", sql: "ALTER TABLE rfqs ADD COLUMN awarded_vendor_id VARCHAR(36) NULL" },
      { name: "awarded_quotation_id", sql: "ALTER TABLE rfqs ADD COLUMN awarded_quotation_id VARCHAR(36) NULL" },
      { name: "updated_at", sql: "ALTER TABLE rfqs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of rfqColumnsToAdd) {
      if (!rfqColNames.has(col.name)) await db.query(col.sql);
    }
  } catch (err) { console.error("RFQs table migration error:", err); }

  try {
    const [qCols] = (await db.query(`SHOW COLUMNS FROM quotations`)) as any[];
    const qColNames = new Set(qCols.map((c: any) => c.Field));
    const qColumnsToAdd = [
      { name: "delivery_timeline", sql: "ALTER TABLE quotations ADD COLUMN delivery_timeline VARCHAR(128) NULL" },
      { name: "valid_until", sql: "ALTER TABLE quotations ADD COLUMN valid_until DATE NULL" },
      { name: "quotation_number", sql: "ALTER TABLE quotations ADD COLUMN quotation_number VARCHAR(64) NULL" },
      { name: "updated_at", sql: "ALTER TABLE quotations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of qColumnsToAdd) {
      if (!qColNames.has(col.name)) await db.query(col.sql);
    }
  } catch (err) { console.error("Quotations table migration error:", err); }

  try {
    const [poCols] = (await db.query(`SHOW COLUMNS FROM purchase_orders`)) as any[];
    const poColNames = new Set(poCols.map((c: any) => c.Field));
    const poColumnsToAdd = [
      { name: "po_number", sql: "ALTER TABLE purchase_orders ADD COLUMN po_number VARCHAR(64) NULL" },
      { name: "rfq_id", sql: "ALTER TABLE purchase_orders ADD COLUMN rfq_id VARCHAR(36) NULL" },
      { name: "quotation_id", sql: "ALTER TABLE purchase_orders ADD COLUMN quotation_id VARCHAR(36) NULL" },
      { name: "notes", sql: "ALTER TABLE purchase_orders ADD COLUMN notes TEXT NULL" },
      { name: "updated_at", sql: "ALTER TABLE purchase_orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of poColumnsToAdd) {
      if (!poColNames.has(col.name)) await db.query(col.sql);
    }
  } catch (err) { console.error("Purchase orders table migration error:", err); }


  await db.query(`
    CREATE TABLE IF NOT EXISTS vendor_invoices (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NOT NULL,
      purchase_order_id VARCHAR(36) NULL,
      invoice_number VARCHAR(64) NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      status ENUM('draft','pending','partially_paid','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      recorded_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
      UNIQUE KEY uniq_vendor_inv (tenant_id, invoice_number)
    ) ENGINE=InnoDB;
  `);

  // ─── BUDGETS MODULE ───────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      year INT NOT NULL,
      title VARCHAR(128) NOT NULL,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS budget_line_items (
      id VARCHAR(36) PRIMARY KEY,
      budget_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      category VARCHAR(128) NOT NULL,
      planned_amount DECIMAL(12,2) NOT NULL,
      actual_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── ASSETS & MAINTENANCE MODULES ─────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(64) NOT NULL,
      category VARCHAR(128) NOT NULL DEFAULT 'General',
      unit_of_measure VARCHAR(32) NOT NULL DEFAULT 'pcs',
      quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      reorder_level DECIMAL(12,2) NOT NULL DEFAULT 10.00,
      unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      location VARCHAR(128) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_sku (tenant_id, sku)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      item_id VARCHAR(36) NOT NULL,
      movement_type ENUM('in','out','adjustment','return') NOT NULL,
      quantity DECIMAL(12,2) NOT NULL,
      reference VARCHAR(128) NULL,
      notes TEXT NULL,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── PROJECTS MODULE ──────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status ENUM('planning','in_progress','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
      budget_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      start_date DATE NULL,
      end_date DATE NULL,
      owner_id VARCHAR(36) NULL,
      resident_visible BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_proj_tenant_status (tenant_id, status)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS project_milestones (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      project_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      due_date DATE NULL,
      status ENUM('planned','in_progress','completed') NOT NULL DEFAULT 'planned',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      INDEX idx_milestone_tenant_proj (tenant_id, project_id)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS project_expenses (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      project_id VARCHAR(36) NOT NULL,
      vendor_id VARCHAR(36) NULL,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      expense_date DATE NOT NULL,
      invoice_number VARCHAR(128) NULL,
      notes TEXT NULL,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
      INDEX idx_expense_tenant_proj (tenant_id, project_id)
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'general',
      location VARCHAR(128) NULL,
      serial_number VARCHAR(128) NULL,
      purchase_date DATE NULL,
      purchase_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      current_valuation DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      status ENUM('active','under_maintenance','decommissioned','scrapped') NOT NULL DEFAULT 'active',
      warranty_expires_at DATE NULL,
      has_amc BOOLEAN NOT NULL DEFAULT FALSE,
      amc_vendor_id VARCHAR(36) NULL,
      amc_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      amc_start_date DATE NULL,
      amc_expires_at DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (amc_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
      INDEX idx_assets_tenant_status (tenant_id, status),
      INDEX idx_assets_tenant_category (tenant_id, category)
    ) ENGINE=InnoDB;
  `);

  // ── Migrations: safely add columns if table already existed without them ──
  try {
    const [existingCols] = (await db.query(`SHOW COLUMNS FROM assets`)) as any[];
    const existingColNames = new Set(existingCols.map((c: any) => c.Field));

    const columnsToAdd: { name: string; sql: string }[] = [
      { name: "category", sql: "ALTER TABLE assets ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT 'general'" },
      { name: "location", sql: "ALTER TABLE assets ADD COLUMN location VARCHAR(128) NULL" },
      { name: "serial_number", sql: "ALTER TABLE assets ADD COLUMN serial_number VARCHAR(128) NULL" },
      { name: "purchase_date", sql: "ALTER TABLE assets ADD COLUMN purchase_date DATE NULL" },
      { name: "purchase_cost", sql: "ALTER TABLE assets ADD COLUMN purchase_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00" },
      { name: "current_valuation", sql: "ALTER TABLE assets ADD COLUMN current_valuation DECIMAL(12,2) NOT NULL DEFAULT 0.00" },
      { name: "status", sql: "ALTER TABLE assets ADD COLUMN status ENUM('active','under_maintenance','decommissioned','scrapped') NOT NULL DEFAULT 'active'" },
      { name: "warranty_expires_at", sql: "ALTER TABLE assets ADD COLUMN warranty_expires_at DATE NULL" },
      { name: "has_amc", sql: "ALTER TABLE assets ADD COLUMN has_amc BOOLEAN NOT NULL DEFAULT FALSE" },
      { name: "amc_vendor_id", sql: "ALTER TABLE assets ADD COLUMN amc_vendor_id VARCHAR(36) NULL" },
      { name: "amc_cost", sql: "ALTER TABLE assets ADD COLUMN amc_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00" },
      { name: "amc_start_date", sql: "ALTER TABLE assets ADD COLUMN amc_start_date DATE NULL" },
      { name: "amc_expires_at", sql: "ALTER TABLE assets ADD COLUMN amc_expires_at DATE NULL" },
      { name: "notes", sql: "ALTER TABLE assets ADD COLUMN notes TEXT NULL" },
      { name: "updated_at", sql: "ALTER TABLE assets ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];

    for (const col of columnsToAdd) {
      if (!existingColNames.has(col.name)) {
        await db.query(col.sql);
      }
    }
  } catch (migErr) {
    console.error("Assets table migration error:", migErr);
  }



  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id VARCHAR(36) PRIMARY KEY,
      asset_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NULL,
      frequency ENUM('daily','weekly','monthly','quarterly','annual') NOT NULL,
      task_description TEXT NOT NULL,
      next_due_date DATE NOT NULL,
      assigned_vendor_id VARCHAR(36) NULL,
      assigned_technician_id VARCHAR(36) NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
      INDEX idx_maint_sched_tenant (tenant_id, is_active)
    ) ENGINE=InnoDB;
  `);

  try {
    const [schedCols] = (await db.query(`SHOW COLUMNS FROM maintenance_schedules`)) as any[];
    const schedColNames = new Set(schedCols.map((c: any) => c.Field));
    const schedColumnsToAdd = [
      { name: "title", sql: "ALTER TABLE maintenance_schedules ADD COLUMN title VARCHAR(255) NULL" },
      { name: "assigned_vendor_id", sql: "ALTER TABLE maintenance_schedules ADD COLUMN assigned_vendor_id VARCHAR(36) NULL" },
      { name: "assigned_technician_id", sql: "ALTER TABLE maintenance_schedules ADD COLUMN assigned_technician_id VARCHAR(36) NULL" },
      { name: "is_active", sql: "ALTER TABLE maintenance_schedules ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE" },
      { name: "notes", sql: "ALTER TABLE maintenance_schedules ADD COLUMN notes TEXT NULL" },
      { name: "updated_at", sql: "ALTER TABLE maintenance_schedules ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of schedColumnsToAdd) {
      if (!schedColNames.has(col.name)) {
        await db.query(col.sql);
      }
    }
  } catch (err) {
    console.error("Maintenance schedules migration error:", err);
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_work_orders (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      asset_id VARCHAR(36) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('open','assigned','in_progress','completed','verified','cancelled') NOT NULL DEFAULT 'open',
      priority ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
      assigned_technician_id VARCHAR(36) NULL,
      assigned_vendor_id VARCHAR(36) NULL,
      cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      actual_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      sla_due_at DATE NULL,
      completed_at DATETIME NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
      INDEX idx_maint_wo_tenant_status (tenant_id, status)
    ) ENGINE=InnoDB;
  `);

  try {
    const [woCols] = (await db.query(`SHOW COLUMNS FROM maintenance_work_orders`)) as any[];
    const woColNames = new Set(woCols.map((c: any) => c.Field));
    const woColumnsToAdd = [
      { name: "priority", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN priority ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal'" },
      { name: "assigned_vendor_id", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN assigned_vendor_id VARCHAR(36) NULL" },
      { name: "assigned_technician_id", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN assigned_technician_id VARCHAR(36) NULL" },
      { name: "estimated_cost", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00" },
      { name: "actual_cost", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN actual_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00" },
      { name: "sla_due_at", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN sla_due_at DATE NULL" },
      { name: "completed_at", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN completed_at DATETIME NULL" },
      { name: "notes", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN notes TEXT NULL" },
      { name: "updated_at", sql: "ALTER TABLE maintenance_work_orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of woColumnsToAdd) {
      if (!woColNames.has(col.name)) {
        await db.query(col.sql);
      }
    }
  } catch (err) {
    console.error("Maintenance work orders migration error:", err);
  }


  // ─── VISITOR & GATE MODULES ───────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS visitor_passes (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      resident_id VARCHAR(36) NOT NULL,
      visitor_name VARCHAR(255) NOT NULL,
      visitor_phone VARCHAR(64) NULL,
      expected_at DATETIME NOT NULL,
      pass_code VARCHAR(32) NOT NULL,
      status ENUM('active','used','expired') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS entry_exit_log (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      visitor_pass_id VARCHAR(36) NULL,
      visitor_name VARCHAR(255) NOT NULL,
      vehicle_plate VARCHAR(32) NULL,
      gate_id VARCHAR(36) NULL,
      direction ENUM('in','out') NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (visitor_pass_id) REFERENCES visitor_passes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS visitor_blacklist (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(64) NULL,
      vehicle_plate VARCHAR(32) NULL,
      reason TEXT NOT NULL,
      added_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      INDEX idx_blacklist_tenant (tenant_id)
    ) ENGINE=InnoDB;
  `);

  try {
    const [vpCols] = (await db.query(`SHOW COLUMNS FROM visitor_passes`)) as any[];
    const vpColNames = new Set(vpCols.map((c: any) => c.Field));
    const vpColumnsToAdd = [
      { name: "visitor_type", sql: "ALTER TABLE visitor_passes ADD COLUMN visitor_type ENUM('one_time','recurring') NOT NULL DEFAULT 'one_time'" },
      { name: "vehicle_plate", sql: "ALTER TABLE visitor_passes ADD COLUMN vehicle_plate VARCHAR(32) NULL" },
      { name: "pre_registered", sql: "ALTER TABLE visitor_passes ADD COLUMN pre_registered BOOLEAN NOT NULL DEFAULT TRUE" },
      { name: "expires_at", sql: "ALTER TABLE visitor_passes ADD COLUMN expires_at DATETIME NULL" },
      { name: "notes", sql: "ALTER TABLE visitor_passes ADD COLUMN notes TEXT NULL" },
      { name: "created_by", sql: "ALTER TABLE visitor_passes ADD COLUMN created_by VARCHAR(36) NULL" },
      { name: "updated_at", sql: "ALTER TABLE visitor_passes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of vpColumnsToAdd) {
      if (!vpColNames.has(col.name)) await db.query(col.sql);
    }
  } catch (err) { console.error("Visitor passes migration error:", err); }

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS domestic_staff (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        resident_id VARCHAR(36) NOT NULL,
        staff_code VARCHAR(32) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(32) NULL,
        staff_type ENUM('maid', 'driver', 'gardener', 'cook', 'nanny', 'other') NOT NULL,
        photo_url VARCHAR(512) NULL,
        valid_from DATE NOT NULL,
        valid_until DATE NOT NULL,
        allowed_days VARCHAR(255) NOT NULL,
        entry_start_time TIME NULL,
        entry_end_time TIME NULL,
        vehicle_plate VARCHAR(32) NULL,
        notes TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_tenant_staff_code (tenant_id, staff_code)
      ) ENGINE=InnoDB;
    `);
  } catch (err) {
    console.error("Domestic staff table migration error:", err);
  }

  try {
    const [staffCols] = (await db.query(`SHOW COLUMNS FROM domestic_staff`)) as any[];
    const staffColNames = new Set(staffCols.map((c: any) => c.Field));
    if (!staffColNames.has("staff_code")) {
      console.log("[DB] Adding staff_code column to domestic_staff...");
      await db.query("ALTER TABLE domestic_staff ADD COLUMN staff_code VARCHAR(32) NULL");
      
      // Generate valid sequential codes for all existing rows
      const [rows] = await db.query("SELECT id, tenant_id FROM domestic_staff WHERE staff_code IS NULL") as any[];
      for (const row of rows) {
        const [seqRows] = await db.query("SELECT staff_code FROM domestic_staff WHERE tenant_id = ? AND staff_code IS NOT NULL", [row.tenant_id]) as any[];
        let maxSeq = 0;
        for (const sr of seqRows) {
          if (sr.staff_code.startsWith("DS-")) {
            const num = parseInt(sr.staff_code.substring(3), 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }
        const code = `DS-${String(maxSeq + 1).padStart(5, "0")}`;
        await db.query("UPDATE domestic_staff SET staff_code = ? WHERE id = ?", [code, row.id]);
      }
      
      // Convert to NOT NULL and add UNIQUE index
      await db.query("ALTER TABLE domestic_staff MODIFY COLUMN staff_code VARCHAR(32) NOT NULL");
      await db.query("ALTER TABLE domestic_staff ADD CONSTRAINT uniq_tenant_staff_code UNIQUE (tenant_id, staff_code)");
      console.log("[DB] staff_code column successfully added and constraints created.");
    }
  } catch (err) {
    console.error("Domestic staff table alteration error:", err);
  }

  try {
    const [logCols] = (await db.query(`SHOW COLUMNS FROM entry_exit_log`)) as any[];
    const logColNames = new Set(logCols.map((c: any) => c.Field));
    const logColumnsToAdd = [
      { name: "verified_by", sql: "ALTER TABLE entry_exit_log ADD COLUMN verified_by VARCHAR(36) NULL" },
      { name: "unit_id", sql: "ALTER TABLE entry_exit_log ADD COLUMN unit_id VARCHAR(36) NULL" },
      { name: "notes", sql: "ALTER TABLE entry_exit_log ADD COLUMN notes TEXT NULL" },
      { name: "domestic_staff_id", sql: "ALTER TABLE entry_exit_log ADD COLUMN domestic_staff_id VARCHAR(36) NULL" },
    ];
    for (const col of logColumnsToAdd) {
      if (!logColNames.has(col.name)) await db.query(col.sql);
    }
  } catch (err) { console.error("Entry exit log migration error:", err); }


  // ─── LEGACY: Form submissions ─────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NULL,
      module_key VARCHAR(255) NOT NULL,
      form_key VARCHAR(255) NOT NULL,
      form_title VARCHAR(255) NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  console.log("[DB] MySQL tables initialized successfully.");

  // ─── PHASE 3: UTILITY METERS ──────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS meter_rates (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      meter_type ENUM('electricity','gas','water') NOT NULL,
      rate_per_unit DECIMAL(10,4) NOT NULL DEFAULT 0,
      currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
      effective_from DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_tenant_type_date (tenant_id, meter_type, effective_from),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS meter_readings (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      unit_id VARCHAR(36) NOT NULL,
      meter_type ENUM('electricity','gas','water') NOT NULL,
      reading_date DATE NOT NULL,
      current_reading DECIMAL(12,2) NOT NULL,
      previous_reading DECIMAL(12,2) NOT NULL DEFAULT 0,
      consumption DECIMAL(12,2) GENERATED ALWAYS AS (current_reading - previous_reading) STORED,
      charged_amount DECIMAL(12,2) NULL,
      ledger_entry_id VARCHAR(36) NULL,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── PHASE 3: PARKING ─────────────────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS parking_slots (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      label VARCHAR(64) NOT NULL,
      block VARCHAR(64) NULL,
      floor_number INT NULL,
      slot_type ENUM('covered','open','bike') NOT NULL DEFAULT 'open',
      status ENUM('free','occupied','reserved','maintenance') NOT NULL DEFAULT 'free',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS parking_allocations (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      slot_id VARCHAR(36) NOT NULL,
      unit_id VARCHAR(36) NOT NULL,
      resident_name VARCHAR(255) NULL,
      vehicle_plate VARCHAR(64) NULL,
      vehicle_type VARCHAR(64) NULL,
      allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deallocated_at TIMESTAMP NULL,
      is_current BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR(36) NULL,
      UNIQUE KEY uniq_slot_current (slot_id, is_current),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (slot_id) REFERENCES parking_slots(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── PHASE 3: NOTICES UPGRADE — safe column additions ─────────────────────

  // Add priority column if not already present
  try {
    await db.query(
      `ALTER TABLE notices ADD COLUMN priority ENUM('info','warning','urgent') NOT NULL DEFAULT 'info' AFTER body`,
    );
  } catch (_) {
    /* column already exists — safe to ignore */
  }

  try {
    await db.query(
      `ALTER TABLE notices ADD COLUMN target_type ENUM('all','block','unit') NOT NULL DEFAULT 'all' AFTER priority`,
    );
  } catch (_) {
    /* already exists */
  }

  try {
    await db.query(`ALTER TABLE notices ADD COLUMN target_id VARCHAR(36) NULL AFTER target_type`);
  } catch (_) {
    /* already exists */
  }

  try {
    await db.query(
      `ALTER TABLE notices ADD COLUMN read_count INT NOT NULL DEFAULT 0 AFTER target_id`,
    );
  } catch (_) {
    /* already exists */
  }

  // ─── PHASE 4: COMMUNITY MODULES ───────────────────────────────────────────

  // Forum Threads
  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_threads (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NOT NULL,
      category VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      photo_url TEXT NULL,
      allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Forum Replies
  await db.query(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id VARCHAR(36) PRIMARY KEY,
      thread_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Polls
  await db.query(`
    CREATE TABLE IF NOT EXISTS polls (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      question VARCHAR(255) NOT NULL,
      type ENUM('single','multi','agm') NOT NULL DEFAULT 'single',
      options JSON NOT NULL COMMENT 'JSON array of strings',
      opens_at TIMESTAMP NOT NULL,
      closes_at TIMESTAMP NOT NULL,
      is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
      eligible_voters ENUM('owners','all') NOT NULL DEFAULT 'all',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Poll Votes
  await db.query(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id VARCHAR(36) PRIMARY KEY,
      poll_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      choice VARCHAR(255) NOT NULL,
      option_selected VARCHAR(128) NULL COMMENT 'Selected option id/string',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_poll_user (poll_id, user_id),
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Events
  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      cover_url TEXT NULL,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      venue VARCHAR(255) NOT NULL,
      allow_rsvp BOOLEAN NOT NULL DEFAULT TRUE,
      capacity INT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Event RSVPs
  await db.query(`
    CREATE TABLE IF NOT EXISTS event_rsvps (
      id VARCHAR(36) PRIMARY KEY,
      event_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      status ENUM('yes','no','maybe') NOT NULL,
      guests_count INT NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_event_user (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Amenities
  await db.query(`
    CREATE TABLE IF NOT EXISTS amenities (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category ENUM('hall','gym','pool','court') NOT NULL,
      capacity INT NULL,
      slot_minutes INT NOT NULL DEFAULT 60,
      open_time TIME NOT NULL,
      close_time TIME NOT NULL,
      charge_per_slot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      refundable_deposit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      rules TEXT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Amenity Bookings
  await db.query(`
    CREATE TABLE IF NOT EXISTS amenity_bookings (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      amenity_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      guests_count INT NOT NULL DEFAULT 0,
      purpose TEXT NULL,
      status VARCHAR(64) NULL DEFAULT 'pending' COMMENT 'Status: pending, approved, cancelled, completed, confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_bookings_conflict (amenity_id, booking_date, status, start_time, end_time)
    ) ENGINE=InnoDB;
  `);

  // ─── SECURITY — PHASE 5 ───────────────────────────────────────────────────

  // Gate Terminals
  await db.query(`
    CREATE TABLE IF NOT EXISTS gate_terminals (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Guard Patrols
  await db.query(`
    CREATE TABLE IF NOT EXISTS guard_patrols (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      guard_name VARCHAR(255) NOT NULL,
      checkpoint_name VARCHAR(255) NOT NULL,
      scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Blacklist
  await db.query(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      type ENUM('visitor','vehicle') NOT NULL DEFAULT 'visitor',
      value VARCHAR(255) NOT NULL,
      reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ─── GOVERNANCE — PHASE 5 ─────────────────────────────────────────────────

  // Committee Meetings
  await db.query(`
    CREATE TABLE IF NOT EXISTS governance_meetings (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      scheduled_at DATETIME NOT NULL,
      status ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
      meeting_minutes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Resolutions
  await db.query(`
    CREATE TABLE IF NOT EXISTS governance_resolutions (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      meeting_id VARCHAR(36) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status ENUM('proposed','passed','failed') NOT NULL DEFAULT 'proposed',
      votes_for INT NOT NULL DEFAULT 0,
      votes_against INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (meeting_id) REFERENCES governance_meetings(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  // Documents
  await db.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      category ENUM('noc', 'maintenance', 'legal', 'financial', 'minutes', 'other') NOT NULL DEFAULT 'other',
      file_url TEXT NOT NULL,
      uploaded_by VARCHAR(36) NOT NULL,
      version INT NOT NULL DEFAULT 1,
      expiry_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // Notifications
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NULL,
      body TEXT NULL,
      type VARCHAR(64) DEFAULT 'info',
      read_status BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  try {
    await db.query(`ALTER TABLE notifications ADD COLUMN message TEXT NULL`);
  } catch (e) {}
  try {
    await db.query(`ALTER TABLE notifications ADD COLUMN type VARCHAR(64) DEFAULT 'info'`);
  } catch (e) {}


  // Upgrade maintenance table to include SLA, assigned vendor, and actual vs estimated cost tracking
  try {
    await db.query(
      `ALTER TABLE maintenance_work_orders ADD COLUMN priority ENUM('low', 'normal', 'high', 'critical') NOT NULL DEFAULT 'normal'`,
    );
  } catch (e) {}
  try {
    await db.query(
      `ALTER TABLE maintenance_work_orders ADD COLUMN assigned_vendor_id VARCHAR(36) NULL`,
    );
  } catch (e) {}
  try {
    await db.query(
      `ALTER TABLE maintenance_work_orders ADD COLUMN estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
    );
  } catch (e) {}
  try {
    await db.query(
      `ALTER TABLE maintenance_work_orders ADD COLUMN actual_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
    );
  } catch (e) {}
  try {
    await db.query(`ALTER TABLE maintenance_work_orders ADD COLUMN sla_due_at TIMESTAMP NULL`);
  } catch (e) {}

  // Upgrade visitor pass to include pre-registration, vehicle plate, pass expiry, and visitor type
  try {
    await db.query(
      `ALTER TABLE visitor_passes ADD COLUMN visitor_type ENUM('one_time', 'recurring') NOT NULL DEFAULT 'one_time'`,
    );
  } catch (e) {}
  try {
    await db.query(`ALTER TABLE visitor_passes ADD COLUMN vehicle_plate VARCHAR(50) NULL`);
  } catch (e) {}
  try {
    await db.query(
      `ALTER TABLE visitor_passes ADD COLUMN pre_registered BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  } catch (e) {}
  try {
    await db.query(`ALTER TABLE visitor_passes ADD COLUMN expires_at TIMESTAMP NULL`);
  } catch (e) {}

  // ─── Phase 2: Database Architecture Hardening Migrations ───
  console.log("[DB] Applying Phase 2 database integrity schema changes...");

  // Task 4: Drop old CASCADE constraints and alter columns to nullable
  try {
    await db.query("ALTER TABLE complaints DROP FOREIGN KEY fk_complaints_submitted");
  } catch (e) {}
  try {
    await db.query("ALTER TABLE complaints MODIFY COLUMN submitted_by VARCHAR(36) NULL");
  } catch (e) {}

  try {
    await db.query("ALTER TABLE complaint_comments DROP FOREIGN KEY fk_comments_author");
  } catch (e) {}
  try {
    await db.query("ALTER TABLE complaint_comments MODIFY COLUMN author_id VARCHAR(36) NULL");
  } catch (e) {}

  try {
    await db.query("ALTER TABLE notices DROP FOREIGN KEY fk_notices_author");
  } catch (e) {}
  try {
    await db.query("ALTER TABLE notices MODIFY COLUMN author_id VARCHAR(36) NULL");
  } catch (e) {}

  const migrations = [
    // Unique Constraints
    "ALTER TABLE units ADD CONSTRAINT uniq_tenant_unit UNIQUE (tenant_id, block_id, building_id, floor_id, unit_number)",
    "ALTER TABLE parking_slots ADD CONSTRAINT uniq_tenant_slot UNIQUE (tenant_id, block, label)",

    // Indexes
    "CREATE INDEX idx_units_tenant_hierarchy ON units (tenant_id, block_id, building_id, floor_id)",
    "CREATE INDEX idx_residents_tenant_person ON residents (tenant_id, person_id, unit_id)",
    "CREATE INDEX idx_ledger_tenant_unit ON ledger_entries (tenant_id, unit_id, billing_period)",
    "CREATE INDEX idx_visitor_tenant_resident ON visitor_passes (tenant_id, resident_id, expected_at)",
    "CREATE INDEX idx_bookings_conflict ON amenity_bookings (amenity_id, booking_date, status, start_time, end_time)",

    // Foreign Keys
    "ALTER TABLE governance_meetings ADD CONSTRAINT fk_gov_meetings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE units ADD CONSTRAINT fk_units_floor FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE",
    "ALTER TABLE units ADD CONSTRAINT fk_units_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE",
    "ALTER TABLE units ADD CONSTRAINT fk_units_block FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE",
    "ALTER TABLE units ADD CONSTRAINT fk_units_society FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE",
    "ALTER TABLE units ADD CONSTRAINT fk_units_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE profiles ADD CONSTRAINT fk_profiles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL",
    "ALTER TABLE residents ADD CONSTRAINT fk_residents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE resident_vehicles ADD CONSTRAINT fk_vehicles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE persons ADD CONSTRAINT fk_persons_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE visitor_passes ADD CONSTRAINT fk_passes_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE SET NULL",
    "ALTER TABLE entry_exit_log ADD CONSTRAINT fk_logs_verified FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE entry_exit_log ADD CONSTRAINT fk_logs_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL",
    "ALTER TABLE entry_exit_log ADD CONSTRAINT fk_logs_gate FOREIGN KEY (gate_id) REFERENCES gate_terminals(id) ON DELETE SET NULL",
    "ALTER TABLE entry_exit_log ADD CONSTRAINT fk_logs_domestic_staff FOREIGN KEY (domestic_staff_id) REFERENCES domestic_staff(id) ON DELETE SET NULL",
    "ALTER TABLE ledger_entries ADD CONSTRAINT fk_ledger_head FOREIGN KEY (charge_head_id) REFERENCES charge_heads(id) ON DELETE SET NULL",
    "ALTER TABLE ledger_entries ADD CONSTRAINT fk_ledger_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE payments ADD CONSTRAINT fk_payments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE payments ADD CONSTRAINT fk_payments_creator FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE complaints ADD CONSTRAINT fk_complaints_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL",
    "ALTER TABLE complaints ADD CONSTRAINT fk_complaints_submitted FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE complaints ADD CONSTRAINT fk_complaints_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE complaints ADD CONSTRAINT fk_complaints_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE complaint_comments ADD CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE complaint_history ADD CONSTRAINT fk_history_changer FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE notices ADD CONSTRAINT fk_notices_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE notice_reads ADD CONSTRAINT fk_notice_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE rfqs ADD CONSTRAINT fk_rfqs_vendor FOREIGN KEY (awarded_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL",
    "ALTER TABLE rfqs ADD CONSTRAINT fk_rfqs_quotation FOREIGN KEY (awarded_quotation_id) REFERENCES quotations(id) ON DELETE SET NULL",
    "ALTER TABLE quotations ADD CONSTRAINT fk_quotations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE purchase_orders ADD CONSTRAINT fk_pos_rfq FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE SET NULL",
    "ALTER TABLE purchase_orders ADD CONSTRAINT fk_pos_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL",
    "ALTER TABLE vendor_invoices ADD CONSTRAINT fk_invoices_recorded FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE budget_line_items ADD CONSTRAINT fk_line_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE stock_movements ADD CONSTRAINT fk_movements_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE project_expenses ADD CONSTRAINT fk_expenses_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE maintenance_schedules ADD CONSTRAINT fk_sched_technician FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE maintenance_work_orders ADD CONSTRAINT fk_wo_technician FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE visitor_blacklist ADD CONSTRAINT fk_blacklist_creator FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE form_submissions ADD CONSTRAINT fk_submissions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE",
    "ALTER TABLE meter_readings ADD CONSTRAINT fk_readings_ledger FOREIGN KEY (ledger_entry_id) REFERENCES ledger_entries(id) ON DELETE SET NULL",
    "ALTER TABLE meter_readings ADD CONSTRAINT fk_readings_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
    "ALTER TABLE parking_allocations ADD CONSTRAINT fk_parking_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL",
  ];

  for (const sql of migrations) {
    try {
      await db.query(sql);
    } catch (e: any) {
      // Ignore if constraint or index already exists
      if (!e.message.includes("Duplicate") && !e.message.includes("already exists") && !e.message.includes("duplicate key")) {
        console.warn(`[DB] Migration warning/skip for: "${sql}" ->`, e.message);
      }
    }
  }
  console.log("[DB] Phase 2 database schema changes applied.");

  // Seed default module registry
  await seedModuleRegistry(db);
}

async function seedModuleRegistry(db: mysql.Pool) {
  const modules = [
    // Core
    {
      key: "platform",
      name: "Platform Core",
      category: "Core",
      is_core: true,
      min_plan: "core",
      deps: [],
      sort: 1,
    },
    {
      key: "property",
      name: "Property Management",
      category: "Core",
      is_core: true,
      min_plan: "core",
      deps: [],
      sort: 2,
    },
    {
      key: "residents",
      name: "Resident Management",
      category: "Core",
      is_core: true,
      min_plan: "core",
      deps: [],
      sort: 3,
    },
    {
      key: "notifications",
      name: "Notifications",
      category: "Core",
      is_core: true,
      min_plan: "core",
      deps: [],
      sort: 4,
    },
    {
      key: "documents",
      name: "Document Management",
      category: "Core",
      is_core: true,
      min_plan: "core",
      deps: [],
      sort: 5,
    },
    {
      key: "reports",
      name: "Reports & Exports",
      category: "Core",
      is_core: true,
      min_plan: "core",
      deps: [],
      sort: 6,
    },
    // Finance
    {
      key: "ledger",
      name: "Resident Ledger",
      category: "Finance",
      is_core: false,
      min_plan: "starter",
      deps: ["property"],
      sort: 10,
    },
    {
      key: "payments",
      name: "Payments & Receipts",
      category: "Finance",
      is_core: false,
      min_plan: "starter",
      deps: ["ledger"],
      sort: 11,
    },
    {
      key: "financial_transparency",
      name: "Financial Transparency",
      category: "Finance",
      is_core: false,
      min_plan: "growth",
      deps: ["ledger", "payments"],
      sort: 12,
    },
    {
      key: "budget",
      name: "Budget Management",
      category: "Finance",
      is_core: false,
      min_plan: "growth",
      deps: ["payments"],
      sort: 13,
    },
    {
      key: "vendor_finance",
      name: "Vendor Finance",
      category: "Finance",
      is_core: false,
      min_plan: "growth",
      deps: ["budget"],
      sort: 14,
    },
    // Operations
    {
      key: "complaints",
      name: "Complaint Management",
      category: "Operations",
      is_core: false,
      min_plan: "starter",
      deps: ["residents"],
      sort: 20,
    },
    {
      key: "maintenance",
      name: "Maintenance Management",
      category: "Operations",
      is_core: false,
      min_plan: "growth",
      deps: ["property"],
      sort: 21,
    },
    {
      key: "inventory",
      name: "Spare Parts Inventory",
      category: "Operations",
      is_core: false,
      min_plan: "growth",
      deps: ["maintenance"],
      sort: 22,
    },
    {
      key: "vendors",
      name: "Vendor Management",
      category: "Operations",
      is_core: false,
      min_plan: "growth",
      deps: [],
      sort: 23,
    },
    {
      key: "projects",
      name: "Project Management",
      category: "Operations",
      is_core: false,
      min_plan: "professional",
      deps: ["vendors", "budget"],
      sort: 24,
    },
    {
      key: "assets",
      name: "Asset Register",
      category: "Operations",
      is_core: false,
      min_plan: "growth",
      deps: ["property"],
      sort: 25,
    },
    // Security
    {
      key: "visitor",
      name: "Visitor Management",
      category: "Security",
      is_core: false,
      min_plan: "growth",
      deps: ["residents"],
      sort: 30,
    },
    {
      key: "gate",
      name: "Gate Management",
      category: "Security",
      is_core: false,
      min_plan: "growth",
      deps: ["visitor"],
      sort: 31,
    },
    {
      key: "parking",
      name: "Parking Management",
      category: "Security",
      is_core: false,
      min_plan: "growth",
      deps: ["property"],
      sort: 32,
    },
    {
      key: "guard_patrol",
      name: "Guard Patrol & Shifts",
      category: "Security",
      is_core: false,
      min_plan: "professional",
      deps: ["gate"],
      sort: 33,
    },
    {
      key: "blacklist",
      name: "Blacklist Management",
      category: "Security",
      is_core: false,
      min_plan: "growth",
      deps: ["visitor", "gate"],
      sort: 34,
    },
    // Community
    {
      key: "notice_board",
      name: "Notice Board",
      category: "Community",
      is_core: false,
      min_plan: "starter",
      deps: ["residents"],
      sort: 40,
    },
    {
      key: "community_forum",
      name: "Community Forum",
      category: "Community",
      is_core: false,
      min_plan: "growth",
      deps: ["residents"],
      sort: 41,
    },
    {
      key: "polls",
      name: "Polls & Voting",
      category: "Community",
      is_core: false,
      min_plan: "professional",
      deps: ["residents"],
      sort: 42,
    },
    {
      key: "events",
      name: "Event Calendar",
      category: "Community",
      is_core: false,
      min_plan: "growth",
      deps: ["residents"],
      sort: 43,
    },
    {
      key: "amenities",
      name: "Amenity Booking",
      category: "Community",
      is_core: false,
      min_plan: "professional",
      deps: ["residents", "payments"],
      sort: 44,
    },
    {
      key: "governance",
      name: "Society Governance",
      category: "Community",
      is_core: false,
      min_plan: "professional",
      deps: ["residents"],
      sort: 45,
    },
    // Utilities
    {
      key: "utility_meters",
      name: "Utility Meter Management",
      category: "Utilities",
      is_core: false,
      min_plan: "growth",
      deps: ["ledger"],
      sort: 50,
    },
    // Intelligence
    {
      key: "ai_complaints",
      name: "AI Complaint Intelligence",
      category: "Intelligence",
      is_core: false,
      min_plan: "professional",
      deps: ["complaints"],
      sort: 60,
    },
    {
      key: "ai_finance",
      name: "AI Financial Intelligence",
      category: "Intelligence",
      is_core: false,
      min_plan: "professional",
      deps: ["budget", "vendor_finance"],
      sort: 61,
    },
    {
      key: "ai_maintenance",
      name: "AI Predictive Maintenance",
      category: "Intelligence",
      is_core: false,
      min_plan: "professional",
      deps: ["maintenance", "assets"],
      sort: 62,
    },
  ];

  for (const m of modules) {
    await db.query(
      `INSERT IGNORE INTO module_registry (module_key, display_name, category, is_core, min_plan, dependencies, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [m.key, m.name, m.category, m.is_core, m.min_plan, JSON.stringify(m.deps), m.sort],
    );
  }

  // Auto-link existing unlinked persons records with registered users matching by email
  try {
    await db.query(`
      UPDATE persons p
      INNER JOIN users u ON u.email = p.email
      SET p.user_id = u.id
      WHERE p.user_id IS NULL
      AND p.email IS NOT NULL
      AND p.email != ''
    `);
  } catch (err) {
    console.error("[DB] Error running auto-link migration for persons: ", err);
  }

  // ─── AI MAINTENANCE INTELLIGENCE ───────────────────────────────────────────

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_maintenance_analyses (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      analysis_type ENUM('full_insights','risk_assessment','cost_analysis','pattern_detection') NOT NULL,
      result_data JSON NOT NULL,
      created_by VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ai_maint_tenant_type (tenant_id, analysis_type, created_at)
    ) ENGINE=InnoDB;
  `);

  // ─── MULTI-SOCIETY ADMINS ──────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS society_admin_tenants (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_tenant (user_id, tenant_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      INDEX idx_sat_user (user_id),
      INDEX idx_sat_tenant (tenant_id)
    ) ENGINE=InnoDB;
  `);

  // Migrate existing data if needed
  try {
    const [existingAdmins] = await db.query(`
      SELECT ur.user_id, p.tenant_id
      FROM user_roles ur
      INNER JOIN profiles p ON p.id = ur.user_id
      WHERE ur.role = 'society_admin'
      AND p.tenant_id IS NOT NULL
    `) as any[];

    for (const admin of existingAdmins) {
      const [check] = await db.query(
        "SELECT id FROM society_admin_tenants WHERE user_id = ? AND tenant_id = ?",
        [admin.user_id, admin.tenant_id]
      ) as any[];

      if (check.length === 0) {
        const pivotId = crypto.randomUUID();
        await db.query(
          "INSERT INTO society_admin_tenants (id, user_id, tenant_id, is_active) VALUES (?, ?, ?, TRUE)",
          [pivotId, admin.user_id, admin.tenant_id]
        );
        console.log(`[DB] Migrated society_admin ${admin.user_id} to tenant ${admin.tenant_id}`);
      }
    }
  } catch (err) {
    console.error("[DB] Error running society_admin migration: ", err);
  }

  console.log("[DB] Module registry seeded.");
}


