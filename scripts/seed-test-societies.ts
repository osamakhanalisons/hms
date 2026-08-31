import mysql from "mysql2/promise";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function run() {
  // Load .env
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
          process.env[key] = val;
        }
      }
    }
  }

  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "at_bms";

  console.log(`[SEED-TEST] Connecting to ${database}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  const passwordHash = hashPassword("demo1234");

  // Helper to ensure tenant exists
  async function ensureTenant(name: string, code: string, slug: string) {
    const [rows] = await conn.query("SELECT id FROM tenants WHERE code = ?", [code]) as any[];
    if (rows.length > 0) {
      return rows[0].id as string;
    }
    const tenantId = crypto.randomUUID();
    await conn.query("INSERT INTO tenants (id, name, slug, code, plan, is_active) VALUES (?, ?, ?, ?, 'standard', TRUE)", [
      tenantId,
      name,
      slug,
      code
    ]);
    return tenantId;
  }

  // Ensure Test Society A & B exist
  const tenantAId = await ensureTenant("Askari Heights A", "TEST-A", "askari-heights-a");
  const tenantBId = await ensureTenant("Askari Heights B", "TEST-B", "askari-heights-b");

  console.log(`[SEED-TEST] Askari Heights A ID: ${tenantAId}`);
  console.log(`[SEED-TEST] Askari Heights B ID: ${tenantBId}`);

  // Helper to provision modules, societies, block, unit, resident user, complaint, and poll
  async function seedTestData(tenantId: string, suffix: string, emailPrefix: string) {
    // 1. Activate required modules
    const modules = ["residents", "complaints", "polls", "events", "visitor", "maintenance", "property", "notice_board", "documents", "reports"];
    for (const m of modules) {
      await conn.query("INSERT IGNORE INTO tenant_modules (id, tenant_id, module_key, is_active) VALUES (?, ?, ?, TRUE)", [
        crypto.randomUUID(),
        tenantId,
        m
      ]);
    }

    // 2. Society record
    const [socRows] = await conn.query("SELECT id FROM societies WHERE tenant_id = ?", [tenantId]) as any[];
    let societyId = socRows.length > 0 ? socRows[0].id : null;
    if (!societyId) {
      societyId = crypto.randomUUID();
      await conn.query("INSERT INTO societies (id, tenant_id, name) VALUES (?, ?, ?)", [
        societyId,
        tenantId,
        `Askari Heights ${suffix}`
      ]);
    }

    // 3. Block
    const [blockRows] = await conn.query("SELECT id FROM blocks WHERE tenant_id = ?", [tenantId]) as any[];
    let blockId = blockRows.length > 0 ? blockRows[0].id : null;
    if (!blockId) {
      blockId = crypto.randomUUID();
      await conn.query("INSERT INTO blocks (id, society_id, tenant_id, name) VALUES (?, ?, ?, ?)", [
        blockId,
        societyId,
        tenantId,
        `Block ${suffix}`
      ]);
    }

    // 4. Unit
    const [unitRows] = await conn.query("SELECT id FROM units WHERE tenant_id = ?", [tenantId]) as any[];
    let unitId = unitRows.length > 0 ? unitRows[0].id : null;
    if (!unitId) {
      unitId = crypto.randomUUID();
      await conn.query("INSERT INTO units (id, society_id, block_id, tenant_id, unit_number, unit_type, status) VALUES (?, ?, ?, ?, ?, 'flat', 'occupied')", [
        unitId,
        societyId,
        blockId,
        tenantId,
        `101-${suffix}`
      ]);
    }

    // 5. Admin user (Society Admin)
    const adminEmail = `${emailPrefix}-admin@test.com`;
    const [adminCheck] = await conn.query("SELECT id FROM users WHERE email = ?", [adminEmail]) as any[];
    let adminUserId = adminCheck.length > 0 ? adminCheck[0].id : null;
    if (!adminUserId) {
      adminUserId = crypto.randomUUID();
      await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        adminUserId,
        adminEmail,
        passwordHash
      ]);
      await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, ?, '+1234567890', ?)", [
        adminUserId,
        `Admin ${suffix}`,
        `Askari Heights ${suffix}`,
        tenantId
      ]);
      await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'society_admin')", [
        crypto.randomUUID(),
        adminUserId
      ]);
    }

    // 6. Resident User
    const resEmail = `${emailPrefix}-resident@test.com`;
    const [resCheck] = await conn.query("SELECT id FROM users WHERE email = ?", [resEmail]) as any[];
    let resUserId = resCheck.length > 0 ? resCheck[0].id : null;
    if (!resUserId) {
      resUserId = crypto.randomUUID();
      await conn.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        resUserId,
        resEmail,
        passwordHash
      ]);
      await conn.query("INSERT INTO profiles (id, full_name, society_name, phone, tenant_id) VALUES (?, ?, ?, '+1234567890', ?)", [
        resUserId,
        `Resident ${suffix} Unique`,
        `Askari Heights ${suffix}`,
        tenantId
      ]);
      await conn.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'resident')", [
        crypto.randomUUID(),
        resUserId
      ]);

      const personId = crypto.randomUUID();
      await conn.query("INSERT INTO persons (id, tenant_id, full_name, email, phone, user_id) VALUES (?, ?, ?, ?, '+1234567890', ?)", [
        personId,
        tenantId,
        `Resident ${suffix} Unique`,
        resEmail,
        resUserId
      ]);

      await conn.query("INSERT INTO residents (id, tenant_id, unit_id, person_id, is_current, type) VALUES (?, ?, ?, ?, TRUE, ?)", [
        crypto.randomUUID(),
        tenantId,
        unitId,
        personId,
        res.type
      ]);
    }

    // 7. Unique Complaint
    const [compCheck] = await conn.query("SELECT id FROM complaints WHERE tenant_id = ?", [tenantId]) as any[];
    if (compCheck.length === 0) {
      await conn.query("INSERT INTO complaints (id, tenant_id, title, description, category, priority, status) VALUES (?, ?, ?, ?, 'general', 'medium', 'open')", [
        crypto.randomUUID(),
        tenantId,
        `Unique complaint in Society ${suffix}`,
        `This is a test complaint scoped strictly to Askari Heights ${suffix}.`
      ]);
    }

    // 8. Unique Poll
    const [pollCheck] = await conn.query("SELECT id FROM polls WHERE tenant_id = ?", [tenantId]) as any[];
    if (pollCheck.length === 0) {
      await conn.query(
        `INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at, is_anonymous, eligible_voters) 
         VALUES (?, ?, ?, 'single', '["Yes", "No"]', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), FALSE, 'all')`,
        [
          crypto.randomUUID(),
          tenantId,
          `Unique poll in Society ${suffix}`
        ]
      );
    }
  }

  await seedTestData(tenantAId, "A", "society-a");
  await seedTestData(tenantBId, "B", "society-b");

  console.log("[SEED-TEST] Seeding completed successfully!");
  await conn.end();
}

run().catch(console.error);
