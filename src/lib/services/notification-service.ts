import crypto from "node:crypto";
import { getDb } from "../db.server";

// ─── Normalized Notification Event Types ─────────────────────────────────────
export const NOTIFICATION_TYPES = {
  VISITOR_ARRIVAL: "visitor_arrival",
  DOMESTIC_STAFF_CHECKIN: "domestic_staff_checkin",
  DOMESTIC_STAFF_CHECKOUT: "domestic_staff_checkout",
  MAINTENANCE_UPDATE: "maintenance_update",
  BILL_GENERATED: "bill_generated",
  BILL_REMINDER: "bill_reminder",
  NOTICE_PUBLISHED: "notice_published",
  POLL_OPENED: "poll_opened",
  EVENT_REMINDER: "event_reminder",
  AMENITY_BOOKING: "amenity_booking",
  PAYMENT_RECEIVED: "payment_received",
  COMPLAINT_ESCALATED: "complaint_escalated",
  COMPLAINT_DUPLICATE_FLAGGED: "complaint_duplicate_flagged",
  FINANCIAL_ANOMALY_DETECTED: "financial_anomaly_detected",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface NotificationPreferences {
  emailAlerts: boolean;
  whatsappAlerts: boolean;
  visitorNotify: boolean;
  maintenanceNotify: boolean;
  billReminders: boolean;
  inAppNotifications: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailAlerts: true,
  whatsappAlerts: false,
  visitorNotify: true,
  maintenanceNotify: true,
  billReminders: true,
  inAppNotifications: true,
};

export interface CreateNotificationParams {
  userId: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationDispatchResult {
  inApp: boolean;
  email: { attempted: boolean; sent: boolean; reason?: string };
  whatsapp: { attempted: boolean; sent: boolean; reason?: string };
  skippedByUserPreference: boolean;
}

/**
 * Loads a user's notification preferences from the DB, falling back to defaults.
 */
export async function getUserNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const db = getDb();
  try {
    const [rows] = (await db.query(
      "SELECT email_alerts, whatsapp_alerts, visitor_notify, maintenance_notify, bill_reminders, in_app_notifications FROM user_notification_settings WHERE user_id = ?",
      [userId],
    )) as any[];

    if (rows.length === 0) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    const r = rows[0];
    return {
      emailAlerts: Boolean(r.email_alerts),
      whatsappAlerts: Boolean(r.whatsapp_alerts),
      visitorNotify: Boolean(r.visitor_notify),
      maintenanceNotify: Boolean(r.maintenance_notify),
      billReminders: Boolean(r.bill_reminders),
      inAppNotifications: Boolean(r.in_app_notifications),
    };
  } catch (err) {
    console.error(`[NotificationService] Failed to load preferences for user ${userId}:`, err);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Checks if the notification type is enabled by the user's category preferences.
 */
export function isTypeAllowedByPreferences(
  type: NotificationType,
  prefs: NotificationPreferences,
): boolean {
  switch (type) {
    case NOTIFICATION_TYPES.VISITOR_ARRIVAL:
    case NOTIFICATION_TYPES.DOMESTIC_STAFF_CHECKIN:
    case NOTIFICATION_TYPES.DOMESTIC_STAFF_CHECKOUT:
      return prefs.visitorNotify;

    case NOTIFICATION_TYPES.MAINTENANCE_UPDATE:
      return prefs.maintenanceNotify;

    case NOTIFICATION_TYPES.BILL_GENERATED:
    case NOTIFICATION_TYPES.BILL_REMINDER:
      return prefs.billReminders;

    case NOTIFICATION_TYPES.NOTICE_PUBLISHED:
    case NOTIFICATION_TYPES.POLL_OPENED:
    case NOTIFICATION_TYPES.EVENT_REMINDER:
    case NOTIFICATION_TYPES.AMENITY_BOOKING:
    case NOTIFICATION_TYPES.PAYMENT_RECEIVED:
    default:
      return true;
  }
}

/**
 * Email provider abstraction (SMTP / Resend / SendGrid).
 * Returns real status without pretending non-configured providers succeeded.
 */
export async function sendEmailNotification(
  userId: string,
  subject: string,
  content: string,
): Promise<{ sent: boolean; reason: string }> {
  // Check if real provider credentials exist
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  const hasResend = Boolean(process.env.RESEND_API_KEY);

  if (!hasSmtp && !hasResend) {
    console.warn(
      `[NotificationService:Email] Skipped email to user ${userId} — Email provider (SMTP/Resend) not configured.`,
    );
    return { sent: false, reason: "Email provider not configured in environment" };
  }

  // Future provider hook
  return { sent: false, reason: "Provider configured but transport handler pending" };
}

/**
 * WhatsApp provider abstraction (Twilio / Meta Graph API).
 * Returns real status without pretending non-configured providers succeeded.
 */
export async function sendWhatsAppNotification(
  userId: string,
  message: string,
): Promise<{ sent: boolean; reason: string }> {
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

  if (!hasTwilio) {
    console.warn(
      `[NotificationService:WhatsApp] Skipped WhatsApp to user ${userId} — WhatsApp provider (Twilio) not configured.`,
    );
    return { sent: false, reason: "WhatsApp provider not configured in environment" };
  }

  // Future provider hook
  return { sent: false, reason: "Provider configured but transport handler pending" };
}

/**
 * Central notification dispatcher.
 * Guaranteed to NEVER throw — failures in notifications do not fail business transactions.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<NotificationDispatchResult> {
  const result: NotificationDispatchResult = {
    inApp: false,
    email: { attempted: false, sent: false },
    whatsapp: { attempted: false, sent: false },
    skippedByUserPreference: false,
  };

  try {
    const { userId, tenantId, type, title, message, data } = params;
    if (!userId || !tenantId) {
      console.warn("[NotificationService] Aborting: userId and tenantId are required.");
      return result;
    }

    // 1. Load preferences
    const prefs = await getUserNotificationPreferences(userId);

    // 2. Check if category preference allows this notification
    if (!isTypeAllowedByPreferences(type, prefs)) {
      result.skippedByUserPreference = true;
      return result;
    }

    const db = getDb();

    // 3. In-App Notification
    if (prefs.inAppNotifications) {
      const id = crypto.randomUUID();
      const jsonData = data ? JSON.stringify(data) : null;
      await db.query(
        `INSERT INTO notifications (id, tenant_id, user_id, title, message, body, type, read_status, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?)`,
        [id, tenantId, userId, title, message, message, type, jsonData],
      );
      result.inApp = true;
    }

    // 4. Email Alert
    if (prefs.emailAlerts) {
      result.email.attempted = true;
      const emailRes = await sendEmailNotification(userId, title, message);
      result.email.sent = emailRes.sent;
      result.email.reason = emailRes.reason;
    }

    // 5. WhatsApp Alert
    if (prefs.whatsappAlerts) {
      result.whatsapp.attempted = true;
      const waRes = await sendWhatsAppNotification(userId, `${title}: ${message}`);
      result.whatsapp.sent = waRes.sent;
      result.whatsapp.reason = waRes.reason;
    }
  } catch (err) {
    console.error("[NotificationService] Uncaught error in createNotification:", err);
  }

  return result;
}

/**
 * Bulk notification creation for batch operations (e.g., bulk billing) to prevent N+1 queries.
 */
export async function createBulkNotifications(
  items: CreateNotificationParams[],
): Promise<number> {
  if (items.length === 0) return 0;

  try {
    const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean))];
    if (userIds.length === 0) return 0;

    const db = getDb();
    const [rows] = (await db.query(
      "SELECT user_id, email_alerts, whatsapp_alerts, visitor_notify, maintenance_notify, bill_reminders, in_app_notifications FROM user_notification_settings WHERE user_id IN (?)",
      [userIds],
    )) as any[];

    const prefMap = new Map<string, NotificationPreferences>();
    for (const r of rows) {
      prefMap.set(r.user_id, {
        emailAlerts: Boolean(r.email_alerts),
        whatsappAlerts: Boolean(r.whatsapp_alerts),
        visitorNotify: Boolean(r.visitor_notify),
        maintenanceNotify: Boolean(r.maintenance_notify),
        billReminders: Boolean(r.bill_reminders),
        inAppNotifications: Boolean(r.in_app_notifications),
      });
    }

    const inAppInserts: [string, string, string, string, string, string, string, boolean, string | null][] = [];

    for (const item of items) {
      const prefs = prefMap.get(item.userId) || { ...DEFAULT_NOTIFICATION_PREFERENCES };
      if (!isTypeAllowedByPreferences(item.type, prefs)) {
        continue;
      }

      if (prefs.inAppNotifications) {
        const id = crypto.randomUUID();
        const jsonData = item.data ? JSON.stringify(item.data) : null;
        inAppInserts.push([
          id,
          item.tenantId,
          item.userId,
          item.title,
          item.message,
          item.message,
          item.type,
          false,
          jsonData,
        ]);
      }

      if (prefs.emailAlerts) {
        sendEmailNotification(item.userId, item.title, item.message).catch(() => {});
      }
      if (prefs.whatsappAlerts) {
        sendWhatsAppNotification(item.userId, `${item.title}: ${item.message}`).catch(() => {});
      }
    }

    if (inAppInserts.length > 0) {
      await db.query(
        `INSERT INTO notifications (id, tenant_id, user_id, title, message, body, type, read_status, data)
         VALUES ?`,
        [inAppInserts],
      );
    }

    return inAppInserts.length;
  } catch (err) {
    console.error("[NotificationService] Error in createBulkNotifications:", err);
    return 0;
  }
}
