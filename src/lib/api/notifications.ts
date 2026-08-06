import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "@/lib/db.server";



export const getNotificationsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) throw new Error("No tenant");

  const db = getDb();
  const [rows] = (await db.query(
    "SELECT id, title, message, type, read_status as readStatus, created_at as createdAt FROM notifications WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    [tenantId],
  )) as any[];
  return rows;
});

export const markAsReadFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      notificationId: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");
    const tenantId = await getUserTenantId(userId);
    if (!tenantId) throw new Error("No tenant");

    const db = getDb();
    if (data.notificationId) {
      await db.query(
        "UPDATE notifications SET read_status = 'read' WHERE id = ? AND tenant_id = ?",
        [data.notificationId, tenantId],
      );
    } else {
      await db.query("UPDATE notifications SET read_status = 'read' WHERE tenant_id = ?", [
        tenantId,
      ]);
    }
    return { success: true };
  });
