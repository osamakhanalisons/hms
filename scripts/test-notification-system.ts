import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

import { initDb, getDb } from "../src/lib/db.server";
import {
  getUserNotificationPreferences,
  createNotification,
  createBulkNotifications,
  NOTIFICATION_TYPES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  sendEmailNotification,
  sendWhatsAppNotification,
} from "../src/lib/services/notification-service";

async function runTests() {
  console.log("==================================================");
  console.log("🔔 RUNNING NOTIFICATION SYSTEM AUTOMATED TESTS");
  console.log("==================================================\n");

  await initDb();
  const db = getDb();

  // Create two distinct test tenants (Society A and Society B)
  const tenantA = "test-tenant-alpha-" + crypto.randomUUID().slice(0, 8);
  const tenantB = "test-tenant-beta-" + crypto.randomUUID().slice(0, 8);

  await db.query(
    "INSERT INTO tenants (id, name, slug) VALUES (?, 'Society Alpha', ?), (?, 'Society Beta', ?)",
    [tenantA, tenantA, tenantB, tenantB],
  );

  // Create two distinct test users (Resident A in Society A, Resident B in Society B)
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();

  await db.query(
    "INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'hash'), (?, ?, 'hash')",
    [userA, `user-a-${userA.slice(0, 6)}@test.com`, userB, `user-b-${userB.slice(0, 6)}@test.com`],
  );

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

  try {
    // -------------------------------------------------------------
    // TEST A: User opens Notifications settings -> Default preferences loaded
    // -------------------------------------------------------------
    const prefsA = await getUserNotificationPreferences(userA);
    assert(
      "TEST A: User preferences fallback to default if not yet saved in DB",
      prefsA.visitorNotify === true &&
        prefsA.maintenanceNotify === true &&
        prefsA.billReminders === true &&
        prefsA.emailAlerts === true &&
        prefsA.whatsappAlerts === false &&
        prefsA.inAppNotifications === true,
      JSON.stringify(prefsA),
    );

    // -------------------------------------------------------------
    // TEST B: User changes Visitor Alerts OFF -> Save -> Persists after refresh
    // -------------------------------------------------------------
    await db.query(
      `INSERT INTO user_notification_settings (
        id, user_id, email_alerts, whatsapp_alerts, visitor_notify,
        maintenance_notify, bill_reminders, in_app_notifications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE visitor_notify = VALUES(visitor_notify)`,
      [crypto.randomUUID(), userA, true, false, false, true, true, true],
    );

    const savedPrefsA = await getUserNotificationPreferences(userA);
    assert(
      "TEST B: User turns Visitor Alerts OFF -> Saved to DB -> Still OFF on reload",
      savedPrefsA.visitorNotify === false,
      `Expected visitorNotify=false, got ${savedPrefsA.visitorNotify}`,
    );

    // -------------------------------------------------------------
    // TEST C: Visitor checks in, visitor_notify = OFF -> No notification
    // -------------------------------------------------------------
    const initialNotifsCount = (
      (await db.query("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ?", [userA])) as any
    )[0][0].cnt;

    const dispatchResultC = await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.VISITOR_ARRIVAL,
      title: "Visitor Arrival",
      message: "Visitor Alice arrived",
    });

    const postCountC = (
      (await db.query("SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ?", [userA])) as any
    )[0][0].cnt;

    assert(
      "TEST C: Visitor check-in when visitor_notify = OFF -> No notification generated",
      dispatchResultC.skippedByUserPreference === true &&
        dispatchResultC.inApp === false &&
        postCountC === initialNotifsCount,
    );

    // -------------------------------------------------------------
    // TEST D: Visitor checks in, visitor_notify = ON -> Notification created
    // -------------------------------------------------------------
    await db.query("UPDATE user_notification_settings SET visitor_notify = TRUE WHERE user_id = ?", [
      userA,
    ]);

    const dispatchResultD = await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.VISITOR_ARRIVAL,
      title: "Visitor Arrival",
      message: "Visitor Bob has arrived at Gate 1.",
      data: { visitorName: "Bob", gate: "Gate 1" },
    });

    const [rowsD] = (await db.query(
      "SELECT * FROM notifications WHERE user_id = ? AND type = 'visitor_arrival' ORDER BY created_at DESC LIMIT 1",
      [userA],
    )) as any[];

    assert(
      "TEST D: Visitor check-in when visitor_notify = ON -> In-app notification created with metadata",
      dispatchResultD.inApp === true &&
        rowsD.length === 1 &&
        rowsD[0].title === "Visitor Arrival" &&
        rowsD[0].message.includes("Bob"),
    );

    // -------------------------------------------------------------
    // TEST E: Maintenance updated, maintenance_notify = ON -> Resident receives notification
    // -------------------------------------------------------------
    const dispatchResultE = await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.MAINTENANCE_UPDATE,
      title: "Maintenance Work Started",
      message: "Work has started on your maintenance request.",
      data: { complaintId: "comp-1" },
    });

    const [rowsE] = (await db.query(
      "SELECT * FROM notifications WHERE user_id = ? AND type = 'maintenance_update' ORDER BY created_at DESC LIMIT 1",
      [userA],
    )) as any[];

    assert(
      "TEST E: Maintenance update when maintenance_notify = ON -> Resident receives notification",
      dispatchResultE.inApp === true && rowsE.length === 1,
    );

    // -------------------------------------------------------------
    // TEST F: maintenance_notify = OFF -> No maintenance notification
    // -------------------------------------------------------------
    await db.query(
      "UPDATE user_notification_settings SET maintenance_notify = FALSE WHERE user_id = ?",
      [userA],
    );

    const prevECount = (
      (await db.query(
        "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND type = 'maintenance_update'",
        [userA],
      )) as any
    )[0][0].cnt;

    const dispatchResultF = await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.MAINTENANCE_UPDATE,
      title: "Maintenance Work Completed",
      message: "Work has finished.",
    });

    const postFCount = (
      (await db.query(
        "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND type = 'maintenance_update'",
        [userA],
      )) as any
    )[0][0].cnt;

    assert(
      "TEST F: Maintenance update when maintenance_notify = OFF -> Discarded",
      dispatchResultF.skippedByUserPreference === true && postFCount === prevECount,
    );

    // -------------------------------------------------------------
    // TEST G: bill_reminders = OFF -> No bill notification
    // -------------------------------------------------------------
    await db.query("UPDATE user_notification_settings SET bill_reminders = FALSE WHERE user_id = ?", [
      userA,
    ]);

    const dispatchResultG = await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.BILL_GENERATED,
      title: "New Bill Available",
      message: "Your August maintenance bill is ready.",
    });

    assert(
      "TEST G: Bill event when bill_reminders = OFF -> Discarded per user preference",
      dispatchResultG.skippedByUserPreference === true && dispatchResultG.inApp === false,
    );

    // -------------------------------------------------------------
    // TEST H: Multi-society isolation: Society A visitor notifies Society A resident only
    // -------------------------------------------------------------
    await db.query(
      "INSERT INTO user_notification_settings (id, user_id, visitor_notify) VALUES (?, ?, TRUE) ON DUPLICATE KEY UPDATE visitor_notify=TRUE",
      [crypto.randomUUID(), userB],
    );

    // Trigger visitor for Society A
    await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.VISITOR_ARRIVAL,
      title: "Society A Visitor",
      message: "Welcome to Society A",
    });

    // Check Society B resident received zero Society A alerts
    const [leakRows] = (await db.query(
      "SELECT * FROM notifications WHERE user_id = ? AND tenant_id = ?",
      [userB, tenantA],
    )) as any[];

    assert(
      "TEST H: Multi-society isolation -> Society A events never leak to Society B resident",
      leakRows.length === 0,
    );

    // -------------------------------------------------------------
    // TEST I & J: Security Scoping (Tenant and User ID Integrity)
    // -------------------------------------------------------------
    // Verify notifications table strictly isolates user_id and tenant_id
    const [userANotifsInTenantA] = (await db.query(
      "SELECT id FROM notifications WHERE user_id = ? AND tenant_id = ?",
      [userA, tenantA],
    )) as any[];

    const [userANotifsInTenantB] = (await db.query(
      "SELECT id FROM notifications WHERE user_id = ? AND tenant_id = ?",
      [userA, tenantB],
    )) as any[];

    assert(
      "TEST I & J: User & Tenant Scoping -> Queries scoped strictly by (tenant_id, user_id)",
      userANotifsInTenantA.length > 0 && userANotifsInTenantB.length === 0,
    );

    // -------------------------------------------------------------
    // TEST K: Email provider unavailable -> Core event still succeeds without throw
    // -------------------------------------------------------------
    await db.query("UPDATE user_notification_settings SET email_alerts = TRUE WHERE user_id = ?", [
      userA,
    ]);
    const emailResult = await sendEmailNotification(userA, "Test Subject", "Test Content");
    assert(
      "TEST K: Email provider abstraction gracefully reports not configured without throwing",
      emailResult.sent === false && typeof emailResult.reason === "string",
    );

    // -------------------------------------------------------------
    // TEST L: WhatsApp provider unavailable -> Core event still succeeds without throw
    // -------------------------------------------------------------
    await db.query("UPDATE user_notification_settings SET whatsapp_alerts = TRUE WHERE user_id = ?", [
      userA,
    ]);
    const waResult = await sendWhatsAppNotification(userA, "Test message");
    assert(
      "TEST L: WhatsApp provider abstraction gracefully reports not configured without throwing",
      waResult.sent === false && typeof waResult.reason === "string",
    );

    // -------------------------------------------------------------
    // TEST M: Unread count increments on new notification
    // -------------------------------------------------------------
    const [unreadBefore] = (await db.query(
      "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND (read_status = FALSE OR read_status = 0)",
      [userA],
    )) as any[];
    const countBefore = Number(unreadBefore[0].cnt);

    await createNotification({
      userId: userA,
      tenantId: tenantA,
      type: NOTIFICATION_TYPES.NOTICE_PUBLISHED,
      title: "Annual Society Meeting Notice",
      message: "Please attend the meeting this Sunday.",
    });

    const [unreadAfter] = (await db.query(
      "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND (read_status = FALSE OR read_status = 0)",
      [userA],
    )) as any[];
    const countAfter = Number(unreadAfter[0].cnt);

    assert(
      "TEST M: Unread count increments when new notification arrives",
      countAfter === countBefore + 1,
      `Before: ${countBefore}, After: ${countAfter}`,
    );

    // -------------------------------------------------------------
    // TEST N: Mark notification as read -> Unread count decrements
    // -------------------------------------------------------------
    const [latestNotif] = (await db.query(
      "SELECT id FROM notifications WHERE user_id = ? AND read_status = FALSE ORDER BY created_at DESC LIMIT 1",
      [userA],
    )) as any[];

    await db.query("UPDATE notifications SET read_status = TRUE WHERE id = ?", [latestNotif[0].id]);

    const [unreadFinal] = (await db.query(
      "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND (read_status = FALSE OR read_status = 0)",
      [userA],
    )) as any[];
    const countFinal = Number(unreadFinal[0].cnt);

    assert(
      "TEST N: Mark notification as read -> Unread count decreases",
      countFinal === countAfter - 1,
      `After: ${countAfter}, Final: ${countFinal}`,
    );
  } finally {
    // Clean up test data
    await db.query("DELETE FROM notifications WHERE user_id IN (?, ?)", [userA, userB]);
    await db.query("DELETE FROM user_notification_settings WHERE user_id IN (?, ?)", [userA, userB]);
    await db.query("DELETE FROM users WHERE id IN (?, ?)", [userA, userB]);
    await db.query("DELETE FROM tenants WHERE id IN (?, ?)", [tenantA, tenantB]);
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
