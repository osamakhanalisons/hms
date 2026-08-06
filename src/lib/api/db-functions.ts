import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getCookie, setCookie, deleteCookie, getEvent } from "vinxi/http";
import { getDb } from "../db.server";

// Simple custom crypto helpers for password hashing
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === testHash;
}

// Session helper
async function getSessionUser(request?: Request) {
  if (!request) return null;
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const parts = c.trim().split("=");
      return [parts[0], parts.slice(1).join("=")];
    }),
  );
  const token = cookies["session_token"];
  if (!token) return null;

  const db = getDb();
  const [sessions] = (await db.query(
    "SELECT user_id, expires_at FROM sessions WHERE id = ? AND expires_at > NOW()",
    [token],
  )) as any[];

  if (sessions.length === 0) return null;
  return sessions[0].user_id as string;
}

export const signUpFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().min(1),
      societyName: z.string().optional(),
      role: z.enum(["resident", "tenant"]),
    }),
  )
  .handler(async ({ data, request }) => {
    const db = getDb();

    const allowedSelfSignup = ["resident", "tenant"] as const;
    if (!allowedSelfSignup.includes(data.role)) {
      throw new Error("This role cannot be self-assigned. Please contact your administrator.");
    }

    // Check if user already exists
    const [existing] = (await db.query("SELECT id FROM users WHERE email = ?", [
      data.email,
    ])) as any[];
    if (existing.length > 0) {
      throw new Error("Email already registered");
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(data.password);

    // Insert user
    await db.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      userId,
      data.email,
      passwordHash,
    ]);

    let tenantId: string | null = null;
    if (data.role === "super_admin" || data.role === "society_admin") {
      tenantId = crypto.randomUUID();
      const slug =
        (data.societyName || "society")
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") +
        "-" +
        tenantId.slice(0, 6);

      // Insert tenant
      await db.query(
        `INSERT INTO tenants (id, name, slug, plan, trial_ends_at)
         VALUES (?, ?, ?, 'professional', DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [tenantId, data.societyName || "HousingOS Society", slug],
      );

      // Seed default active modules
      const defaultModules = [
        "platform",
        "property",
        "residents",
        "notifications",
        "documents",
        "reports",
        "ledger",
        "payments",
        "complaints",
        "notice_board",
      ];
      for (const key of defaultModules) {
        await db.query(
          `INSERT IGNORE INTO tenant_modules (id, tenant_id, module_key, is_active, activated_at, activated_by)
           VALUES (?, ?, ?, TRUE, NOW(), ?)`,
          [crypto.randomUUID(), tenantId, key, userId],
        );
      }

      // Create initial society entry
      const societyId = crypto.randomUUID();
      await db.query("INSERT INTO societies (id, tenant_id, name) VALUES (?, ?, ?)", [
        societyId,
        tenantId,
        data.societyName || "HousingOS Society",
      ]);
    }

    // Insert profile
    await db.query(
      "INSERT INTO profiles (id, full_name, society_name, tenant_id) VALUES (?, ?, ?, ?)",
      [userId, data.fullName, data.societyName || null, tenantId],
    );

    // Insert role
    const roleId = crypto.randomUUID();
    await db.query("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
      roleId,
      userId,
      data.role,
    ]);

    // Create session
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
      sessionToken,
      userId,
      expiresAt,
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session_token=${sessionToken}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
      },
    });
  });

export const signInFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }) => {
    const db = getDb();

    const [users] = (await db.query("SELECT id, password_hash FROM users WHERE email = ?", [
      data.email,
    ])) as any[];

    if (users.length === 0 || !verifyPassword(data.password, users[0].password_hash)) {
      throw new Error("Invalid email or password");
    }

    const userId = users[0].id;

    // Create session
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
      sessionToken,
      userId,
      expiresAt,
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session_token=${sessionToken}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
      },
    });
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async ({ request }) => {
  const cookieHeader = request?.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const parts = c.trim().split("=");
        return [parts[0], parts.slice(1).join("=")];
      }),
    );
    const token = cookies["session_token"];
    if (token) {
      const db = getDb();
      await db.query("DELETE FROM sessions WHERE id = ?", [token]);
    }
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie":
        "session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
    },
  });
});

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) {
    return { session: null, user: null, profile: null, roles: [] };
  }

  const db = getDb();
  const [users] = (await db.query("SELECT id, email FROM users WHERE id = ?", [userId])) as any[];
  const [profiles] = (await db.query(
    "SELECT id, full_name, society_name, phone, avatar_url, tenant_id FROM profiles WHERE id = ?",
    [userId],
  )) as any[];
  const [roles] = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    userId,
  ])) as any[];

  if (users.length === 0) {
    return { session: null, user: null, profile: null, roles: [] };
  }

  const userObj = { id: users[0].id, email: users[0].email };
  const profileObj =
    profiles.length > 0
      ? {
          id: profiles[0].id,
          full_name: profiles[0].full_name,
          society_name: profiles[0].society_name,
          phone: profiles[0].phone,
          avatar_url: profiles[0].avatar_url,
          tenant_id: profiles[0].tenant_id,
        }
      : null;

  const rolesList = roles.map((r: any) => r.role);

  return {
    session: { user: userObj },
    user: userObj,
    profile: profileObj,
    roles: rolesList,
  };
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fullName: z.string().min(1),
      phone: z.string().optional(),
      societyName: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    await db.query("UPDATE profiles SET full_name = ?, phone = ?, society_name = ? WHERE id = ?", [
      data.fullName,
      data.phone || null,
      data.societyName || null,
      userId,
    ]);

    return { success: true };
  });

export const getSubmissionsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        limit: z.number().optional().default(200),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const limit = data?.limit ?? 200;

    // Check user role first to decide if they can view all submissions (for admins)
    const [roles] = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
      userId,
    ])) as any[];
    const rolesList = roles.map((r: any) => r.role);
    const isAdmin = rolesList.includes("super_admin") || rolesList.includes("society_admin");

    let query =
      "SELECT id, module_key, form_key, form_title, created_at, user_id FROM form_submissions ";
    let params: any[] = [];

    if (!isAdmin) {
      query += "WHERE user_id = ? ";
      params.push(userId);
    }

    query += "ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });

export const createSubmissionFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      moduleKey: z.string(),
      formKey: z.string(),
      formTitle: z.string().optional(),
      payload: z.any(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const id = crypto.randomUUID();

    await db.query(
      "INSERT INTO form_submissions (id, user_id, module_key, form_key, form_title, payload) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        userId,
        data.moduleKey,
        data.formKey,
        data.formTitle || null,
        JSON.stringify(data.payload),
      ],
    );

    return { success: true };
  });

// ─── PHASE 3: DASHBOARD KPIs ──────────────────────────────────────────────

export const getDashboardKpisFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const db = getDb();
  const [profiles] = (await db.query("SELECT tenant_id FROM profiles WHERE id = ?", [
    userId,
  ])) as any[];
  const tenantId = profiles[0]?.tenant_id ?? null;
  if (!tenantId)
    return { openComplaints: 0, overdueUnits: 0, pendingWorkOrders: 0, visitorsToday: 0 };

  const [[cRow]] = (await db.query(
    "SELECT COUNT(*) AS cnt FROM complaints WHERE tenant_id = ? AND status NOT IN ('resolved','closed')",
    [tenantId],
  )) as any[];

  const [[oRow]] = (await db.query(
    `SELECT COUNT(DISTINCT unit_id) AS cnt FROM ledger_entries
       WHERE tenant_id = ? AND balance_after > 0`,
    [tenantId],
  )) as any[];

  const [[wRow]] = (await db.query(
    "SELECT COUNT(*) AS cnt FROM maintenance_work_orders WHERE tenant_id = ? AND status IN ('open','in_progress')",
    [tenantId],
  )) as any[];

  const [[vRow]] = (await db.query(
    "SELECT COUNT(*) AS cnt FROM visitor_passes WHERE tenant_id = ? AND DATE(expected_at) = CURDATE() AND status = 'active'",
    [tenantId],
  )) as any[];

  return {
    openComplaints: Number(cRow?.cnt ?? 0),
    overdueUnits: Number(oRow?.cnt ?? 0),
    pendingWorkOrders: Number(wRow?.cnt ?? 0),
    visitorsToday: Number(vRow?.cnt ?? 0),
  };
});

// ─── PHASE 3: REAL MONTHLY COLLECTIONS ────────────────────────────────────

export const getRealCollectionsFn = createServerFn({ method: "GET" }).handler(
  async ({ request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const [profiles] = (await db.query("SELECT tenant_id FROM profiles WHERE id = ?", [
      userId,
    ])) as any[];
    const tenantId = profiles[0]?.tenant_id ?? null;
    if (!tenantId) return [];

    // Last 6 calendar months of total payments
    const [rows] = (await db.query(
      `SELECT
         DATE_FORMAT(payment_date, '%Y-%m') AS month_key,
         DATE_FORMAT(payment_date, '%b')    AS label,
         SUM(amount) / 100000              AS amount_lakh
       FROM payments
       WHERE tenant_id = ?
         AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month_key, label
       ORDER BY month_key ASC`,
      [tenantId],
    )) as any[];

    return rows as { month_key: string; label: string; amount_lakh: number }[];
  },
);

// ─── PHASE 3: AUDIT LOG ───────────────────────────────────────────────────

export const getAuditLogsFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        limit: z.number().optional().default(100),
        moduleKey: z.string().optional(),
        actionType: z.string().optional(),
        fromDate: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const [profiles] = (await db.query("SELECT tenant_id FROM profiles WHERE id = ?", [
      userId,
    ])) as any[];
    const tenantId = profiles[0]?.tenant_id ?? null;
    if (!tenantId) return [];

    let query = `
      SELECT al.*, u.email AS actor_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (data?.moduleKey) {
      query += " AND al.module_key = ?";
      params.push(data.moduleKey);
    }
    if (data?.actionType) {
      query += " AND al.action = ?";
      params.push(data.actionType);
    }
    if (data?.fromDate) {
      query += " AND al.created_at >= ?";
      params.push(data.fromDate);
    }

    query += " ORDER BY al.created_at DESC LIMIT ?";
    params.push(data?.limit ?? 100);

    const [rows] = (await db.query(query, params)) as any[];
    return rows;
  });
