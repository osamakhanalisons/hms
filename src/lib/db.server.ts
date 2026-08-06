import mysql from "mysql2/promise";

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

  // Profiles
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
      FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

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
      submitted_by VARCHAR(36) NOT NULL,
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
      author_id VARCHAR(36) NOT NULL,
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
      author_id VARCHAR(36) NOT NULL,
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
    CREATE TABLE IF NOT EXISTS assets (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NULL,
      serial_number VARCHAR(128) NULL,
      warranty_expires_at DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id VARCHAR(36) PRIMARY KEY,
      asset_id VARCHAR(36) NOT NULL,
      tenant_id VARCHAR(36) NOT NULL,
      frequency ENUM('daily','weekly','monthly','quarterly','annual') NOT NULL,
      task_description TEXT NOT NULL,
      next_due_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_work_orders (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      asset_id VARCHAR(36) NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('open','assigned','in_progress','completed','verified') NOT NULL DEFAULT 'open',
      assigned_technician_id VARCHAR(36) NULL,
      cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      body TEXT NOT NULL,
      read_status BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

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

  console.log("[DB] Module registry seeded.");
}

