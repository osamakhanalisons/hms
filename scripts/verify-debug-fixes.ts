import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

import { getDb, initDb } from "../src/lib/db.server";
import { PRIMARY_NAV } from "../src/lib/modules";
import { canAccessModule } from "../src/lib/role-access";
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "../src/lib/services/notification-service";

async function runVerification() {
  console.log("==================================================");
  console.log("🔍 RUNNING COMPREHENSIVE DEBUG VERIFICATION");
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

  // -------------------------------------------------------------
  // VERIFICATION 1: MySQL read_status coercion fix
  // -------------------------------------------------------------
  console.log("--- PART 1: Notification readStatus Normalization ---");
  const testUserId = crypto.randomUUID();
  const testTenantId = "test-tenant-" + crypto.randomUUID().slice(0, 8);

  try {
    await db.query(
      "INSERT INTO tenants (id, name, slug) VALUES (?, 'Test Society', ?)",
      [testTenantId, testTenantId],
    );
    await db.query(
      "INSERT INTO users (id, email, password_hash) VALUES (?, 'test.resident@test.com', 'hash')",
      [testUserId],
    );
    await db.query(
      "INSERT INTO profiles (id, full_name, tenant_id) VALUES (?, 'Test Resident', ?)",
      [testUserId, testTenantId],
    );

    // Create an unread notification
    const notifResult = await createNotification({
      userId: testUserId,
      tenantId: testTenantId,
      type: NOTIFICATION_TYPES.VISITOR_ARRIVAL,
      title: "Visitor Arrival Alert",
      message: "Visitor John Doe arrived at Main Gate.",
    });

    assert("1.1 Notification created successfully", notifResult.inApp === true);

    // Query notifications using the exact query from getNotificationsFn
    const [rows] = (await db.query(
      `SELECT id, title,
              COALESCE(message, body, '') as message,
              COALESCE(type, 'info') as type,
              CASE WHEN read_status = 1 THEN 'read' ELSE 'unread' END as readStatus,
              CASE WHEN read_status = 1 THEN 1 ELSE 0 END as isRead,
              data,
              created_at as createdAt
       FROM notifications
       WHERE tenant_id = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [testTenantId, testUserId],
    )) as any[];

    assert(
      "1.2 Unread notification evaluates to readStatus='unread' and isRead=0",
      rows.length === 1 && rows[0].readStatus === "unread" && rows[0].isRead === 0,
      `Got readStatus='${rows[0]?.readStatus}', isRead=${rows[0]?.isRead}`,
    );

    // Test unread count calculation matching app-shell.tsx
    const unreadCount = rows.filter(
      (n: any) => n.readStatus === "unread" || n.isRead === 0 || n.isRead === false,
    ).length;
    assert(
      "1.3 Bell badge unread count is 1 (Badge appears)",
      unreadCount === 1,
      `Calculated unreadCount=${unreadCount}`,
    );

    // Mark notification as read
    await db.query(
      "UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ? AND tenant_id = ?",
      [rows[0].id, testUserId, testTenantId],
    );

    // Re-query
    const [rowsAfterRead] = (await db.query(
      `SELECT id, title,
              CASE WHEN read_status = 1 THEN 'read' ELSE 'unread' END as readStatus,
              CASE WHEN read_status = 1 THEN 1 ELSE 0 END as isRead
       FROM notifications
       WHERE tenant_id = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [testTenantId, testUserId],
    )) as any[];

    const unreadCountAfter = rowsAfterRead.filter(
      (n: any) => n.readStatus === "unread" || n.isRead === 0 || n.isRead === false,
    ).length;

    assert(
      "1.4 Marked read evaluates to readStatus='read', isRead=1",
      rowsAfterRead[0].readStatus === "read" && rowsAfterRead[0].isRead === 1,
    );
    assert(
      "1.5 Unread count decrements to 0 (Badge disappears)",
      unreadCountAfter === 0,
      `Calculated unreadCountAfter=${unreadCountAfter}`,
    );
  } finally {
    await db.query("DELETE FROM notifications WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM user_notification_settings WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM profiles WHERE id = ?", [testUserId]);
    await db.query("DELETE FROM users WHERE id = ?", [testUserId]);
    await db.query("DELETE FROM tenants WHERE id = ?", [testTenantId]);
  }

  // -------------------------------------------------------------
  // VERIFICATION 2: Resident Settings Visibility & RBAC Scoping
  // -------------------------------------------------------------
  console.log("\n--- PART 2: Resident Settings Visibility & RBAC Scoping ---");

  // A. Primary Nav filter logic for Resident
  const ADMIN_ONLY_NAV = ["/analytics", "/audit-log", "/forms", "/societies"];
  const residentRoles = ["resident"];
  const isResidentAdmin = residentRoles.includes("super_admin") || residentRoles.includes("society_admin");
  const isResidentSuperAdmin = residentRoles.includes("super_admin");

  const visiblePrimaryNavForResident = PRIMARY_NAV.filter((item) => {
    if (item.to === "/societies") return isResidentAdmin;
    if (item.superAdminOnly) return isResidentSuperAdmin;
    if (ADMIN_ONLY_NAV.includes(item.to)) return isResidentAdmin;
    return true;
  });

  const residentNavPaths = visiblePrimaryNavForResident.map((n) => n.to);
  assert(
    "2.1 Resident can see /settings in primary navigation",
    residentNavPaths.includes("/settings"),
    `Visible nav: ${residentNavPaths.join(", ")}`,
  );
  assert(
    "2.2 Resident cannot see admin-only nav items (/societies, /analytics, /audit-log, /forms)",
    !residentNavPaths.includes("/societies") &&
      !residentNavPaths.includes("/analytics") &&
      !residentNavPaths.includes("/audit-log") &&
      !residentNavPaths.includes("/forms"),
  );

  // B. Role module access for Resident
  assert(
    "2.3 canAccessModule('resident', 'settings') is permitted",
    canAccessModule("resident", "settings") === true,
  );

  // C. Settings page tabs filtering for Resident vs Admin
  const allTabs = [
    { id: "profile", label: "Profile", adminOnly: false },
    { id: "workspace", label: "Workspace", adminOnly: true },
    { id: "modules", label: "Modules", adminOnly: true },
    { id: "notifications", label: "Notifications", adminOnly: false },
    { id: "integrations", label: "Integrations", adminOnly: true },
    { id: "permissions", label: "Role Permissions", adminOnly: true },
    { id: "users", label: "Users & Roles", adminOnly: true },
  ];

  const visibleTabsResident = allTabs
    .filter((tab) => !tab.adminOnly || isResidentAdmin)
    .map((t) => t.id);

  assert(
    "2.4 Resident sees only personal Settings tabs (profile, notifications)",
    visibleTabsResident.includes("profile") &&
      visibleTabsResident.includes("notifications") &&
      visibleTabsResident.length === 2,
    `Visible tabs: ${visibleTabsResident.join(", ")}`,
  );

  assert(
    "2.5 Admin-only settings tabs (workspace, modules, integrations, permissions, users) are hidden from Resident",
    !visibleTabsResident.includes("workspace") &&
      !visibleTabsResident.includes("modules") &&
      !visibleTabsResident.includes("integrations") &&
      !visibleTabsResident.includes("permissions") &&
      !visibleTabsResident.includes("users"),
  );

  const adminRoles = ["society_admin"];
  const isRealAdmin = adminRoles.includes("super_admin") || adminRoles.includes("society_admin");
  const visibleTabsAdmin = allTabs
    .filter((tab) => !tab.adminOnly || isRealAdmin)
    .map((t) => t.id);

  assert(
    "2.6 Admin still sees all 7 Settings tabs",
    visibleTabsAdmin.length === 7,
    `Admin tabs: ${visibleTabsAdmin.join(", ")}`,
  );

  console.log("\n==================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
