import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "@/lib/db.server";
import { getSessionUser, getUserTenantId, resolveTenantId } from "./auth-helper";
import {
  getUserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../services/notification-service";

export const getNotificationPreferencesFn = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const prefs = await getUserNotificationPreferences(userId);
    return prefs;
  },
);

export const updateNotificationPreferencesFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      emailAlerts: z.boolean(),
      whatsappAlerts: z.boolean(),
      visitorNotify: z.boolean(),
      maintenanceNotify: z.boolean(),
      billReminders: z.boolean(),
      inAppNotifications: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO user_notification_settings (
        id, user_id, email_alerts, whatsapp_alerts, visitor_notify,
        maintenance_notify, bill_reminders, in_app_notifications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email_alerts = VALUES(email_alerts),
        whatsapp_alerts = VALUES(whatsapp_alerts),
        visitor_notify = VALUES(visitor_notify),
        maintenance_notify = VALUES(maintenance_notify),
        bill_reminders = VALUES(bill_reminders),
        in_app_notifications = VALUES(in_app_notifications)`,
      [
        id,
        userId,
        data.emailAlerts,
        data.whatsappAlerts,
        data.visitorNotify,
        data.maintenanceNotify,
        data.billReminders,
        data.inAppNotifications,
      ],
    );

    return {
      success: true,
      preferences: data,
    };
  });

export const getNotificationsFn = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    let tenantId = await resolveTenantId(request).catch(() => null);
    if (!tenantId) {
      tenantId = await getUserTenantId(userId);
    }
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
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
      [tenantId, userId],
    )) as any[];

    return rows;
  },
);

export const markAsReadFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      notificationId: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    let tenantId = await resolveTenantId(request).catch(() => null);
    if (!tenantId) {
      tenantId = await getUserTenantId(userId);
    }
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    if (data.notificationId) {
      await db.query(
        "UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ? AND tenant_id = ?",
        [data.notificationId, userId, tenantId],
      );
    } else {
      await db.query(
        "UPDATE notifications SET read_status = 1 WHERE user_id = ? AND tenant_id = ?",
        [userId, tenantId],
      );
    }
    return { success: true };
  });
