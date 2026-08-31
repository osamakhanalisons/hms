import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getCookie, setCookie, deleteCookie, getEvent } from "vinxi/http";
import { getUserRoles, getTenantScoping } from "./auth-helper";
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

// In-memory rate limiter for login
const loginAttemptMap = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(identifier: string): void {
  const now = Date.now();
  const record = loginAttemptMap.get(identifier);

  if (record && now < record.resetAt) {
    if (record.count >= 5) {
      const minutesLeft = Math.ceil((record.resetAt - now) / 60000);
      throw new Error(
        `Too many login attempts. Please try again in ${minutesLeft} minute(s).`,
      );
    }
  } else if (record && now >= record.resetAt) {
    loginAttemptMap.delete(identifier);
  }
}

function recordFailedLogin(identifier: string): void {
  const now = Date.now();
  const record = loginAttemptMap.get(identifier);

  if (record && now < record.resetAt) {
    record.count++;
  } else {
    loginAttemptMap.set(identifier, {
      count: 1,
      resetAt: now + 15 * 60 * 1000, // 15 minutes
    });
  }
}

function clearLoginAttempts(identifier: string): void {
  loginAttemptMap.delete(identifier);
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
      societyCode: z.string().optional(), // slug to join an existing society
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

    // Check if there is an unlinked person record for this email and link it
    const [personRows] = (await db.query(
      "SELECT id, tenant_id FROM persons WHERE email = ? AND user_id IS NULL LIMIT 1",
      [data.email],
    )) as any[];

    if (personRows.length > 0) {
      const existingPerson = personRows[0];

      // Always link person → user
      await db.query("UPDATE persons SET user_id = ? WHERE id = ?", [
        userId,
        existingPerson.id,
      ]);

      // Always sync tenant_id to profile if the person belongs to a society
      if (existingPerson.tenant_id) {
        await db.query(
          "UPDATE profiles SET tenant_id = ? WHERE id = ?",
          [existingPerson.tenant_id, userId],
        );
        tenantId = existingPerson.tenant_id; // keep in scope for societyCode fallback
      }
    }

    // If user provided a society code (slug) and profile.tenant_id is still null, resolve it
    if (data.societyCode && !tenantId) {
      const [tenantRows] = (await db.query(
        "SELECT id FROM tenants WHERE slug = ? LIMIT 1",
        [data.societyCode.trim()],
      )) as any[];
      if (tenantRows.length > 0) {
        await db.query(
          "UPDATE profiles SET tenant_id = ? WHERE id = ?",
          [tenantRows[0].id, userId],
        );
        tenantId = tenantRows[0].id;
      }
    }

    // Create session (24 hours expiry)
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
      sessionToken,
      userId,
      expiresAt,
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session_token=${sessionToken}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Strict; Max-Age=${60 * 60 * 24}`,
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
    const clientIp =
      request?.headers?.get("x-forwarded-for") ||
      request?.headers?.get("cf-connecting-ip") ||
      data.email;

    checkLoginRateLimit(clientIp);

    const db = getDb();

    const [users] = (await db.query("SELECT id, password_hash FROM users WHERE email = ?", [
      data.email,
    ])) as any[];

    if (users.length === 0 || !verifyPassword(data.password, users[0].password_hash)) {
      recordFailedLogin(clientIp);
      throw new Error("Invalid email or password");
    }

    clearLoginAttempts(clientIp);

    const userId = users[0].id;

    // Check if the user's society (tenant) is active before allowing login.
    // super_admin users have no tenant_id in profiles so they are never blocked.
    const [profileRows] = (await db.query(
      `SELECT p.tenant_id, t.is_active, t.name
       FROM profiles p
       LEFT JOIN tenants t ON t.id = p.tenant_id
       WHERE p.id = ?
       LIMIT 1`,
      [userId],
    )) as any[];

    if (profileRows.length > 0 && profileRows[0].tenant_id) {
      const tenantActive = profileRows[0].is_active;
      // MySQL returns TINYINT(1) as 0/1 (or a Buffer). Treat any falsy as inactive.
      if (!tenantActive) {
        throw new Error(
          `Your society "${profileRows[0].name}" has been deactivated. Please contact the platform administrator.`,
        );
      }
    }

    // Create session (24 hours expiry)
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
      sessionToken,
      userId,
      expiresAt,
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session_token=${sessionToken}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Strict; Max-Age=${60 * 60 * 24}`,
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
        tenantId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const limit = data?.limit ?? 200;

    // Check user role first to decide if they can view all submissions (for admins)
    const roles = await getUserRoles(userId);
    const isAdmin = roles.includes("super_admin") || roles.includes("society_admin");

    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "p.tenant_id");

    let query = `
      SELECT fs.id, fs.module_key, fs.form_key, fs.form_title, fs.created_at, fs.user_id 
      FROM form_submissions fs
      JOIN profiles p ON p.id = fs.user_id
      WHERE ${sqlFilter}
    `;
    const params: any[] = [...sqlParams];

    if (!isAdmin) {
      query += " AND fs.user_id = ? ";
      params.push(userId);
    }

    query += " ORDER BY fs.created_at DESC LIMIT ?";
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

export const getDashboardKpisFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const { sqlFilter: cFilter, sqlParams: cParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: oFilter, sqlParams: oParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: wFilter, sqlParams: wParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");
    const { sqlFilter: vFilter, sqlParams: vParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");

    const [[cRow]] = (await db.query(
      `SELECT COUNT(*) AS cnt FROM complaints WHERE ${cFilter} AND status NOT IN ('resolved','closed')`,
      cParams,
    )) as any[];

    const [[oRow]] = (await db.query(
      `SELECT COUNT(DISTINCT unit_id) AS cnt FROM ledger_entries
       WHERE ${oFilter} AND balance_after > 0`,
      oParams,
    )) as any[];

    const [[wRow]] = (await db.query(
      `SELECT COUNT(*) AS cnt FROM maintenance_work_orders WHERE ${wFilter} AND status IN ('open','in_progress')`,
      wParams,
    )) as any[];

    const [[vRow]] = (await db.query(
      `SELECT COUNT(*) AS cnt FROM visitor_passes WHERE ${vFilter} AND DATE(expected_at) = CURDATE() AND status = 'active'`,
      vParams,
    )) as any[];

    return {
      openComplaints: Number(cRow?.cnt ?? 0),
      overdueUnits: Number(oRow?.cnt ?? 0),
      pendingWorkOrders: Number(wRow?.cnt ?? 0),
      visitorsToday: Number(vRow?.cnt ?? 0),
    };
  });

// ─── PHASE 3: REAL MONTHLY COLLECTIONS ────────────────────────────────────

export const getRealCollectionsFn = createServerFn({ method: "GET" })
  .validator(z.object({ tenantId: z.string().optional() }).optional())
  .handler(async ({ data, request }) => {
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();
    const { sqlFilter, sqlParams } = await getTenantScoping(request, data?.tenantId, "tenant_id");

    // Last 6 calendar months of total payments
    const [rows] = (await db.query(
      `SELECT
         DATE_FORMAT(payment_date, '%Y-%m') AS month_key,
         DATE_FORMAT(payment_date, '%b')    AS label,
         SUM(amount) / 100000              AS amount_lakh
       FROM payments
       WHERE ${sqlFilter}
         AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month_key, label
       ORDER BY month_key ASC`,
      sqlParams,
    )) as any[];

    return rows as { month_key: string; label: string; amount_lakh: number }[];
  });

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
    
    // Admin check - audit logs are sensitive
    const [roleRows] = (await db.query(
      "SELECT role FROM user_roles WHERE user_id = ? AND role IN ('super_admin','society_admin')",
      [userId],
    )) as any[];
    if (roleRows.length === 0) throw new Error("Forbidden - Admin access required");
    
    const isSuperAdmin = roleRows.some((r: any) => r.role === "super_admin");
    const { sqlFilter, sqlParams } = await getTenantScoping(request, undefined, "al.tenant_id");

    let query = `
      SELECT al.*, u.email AS actor_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${sqlFilter}
    `;
    const params: any[] = [...sqlParams];

    if (data?.moduleKey) {
      query += " AND (al.entity_type = ? OR al.action LIKE ?)";
      params.push(data.moduleKey, `%${data.moduleKey}%`);
    }
    if (data?.actionType) {
      query += " AND al.action LIKE ?";
      params.push(`%${data.actionType}%`);
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

export const fixResidentLinksAdminFn = createServerFn({ method: "POST" }).handler(async ({ request }) => {
  const userId = await getSessionUser(request);
  if (!userId) throw new Error("Unauthorized");

  const db = getDb();
  const [roleRows] = (await db.query(
    "SELECT role FROM user_roles WHERE user_id = ? AND role IN ('super_admin','society_admin')",
    [userId],
  )) as any[];
  if (roleRows.length === 0) throw new Error("Forbidden - Admin access required");

  const [result] = (await db.query(`
    UPDATE persons p
    INNER JOIN users u ON u.email = p.email
    SET p.user_id = u.id
    WHERE p.user_id IS NULL
    AND p.email IS NOT NULL
    AND p.email != ''
  `)) as any[];

  return { success: true, affectedRows: result?.affectedRows ?? 0 };
});

export const changePasswordFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }),
  )
  .handler(async (ctx: any) => {
    const { data, request } = ctx;
    const userId = await getSessionUser(request);
    if (!userId) throw new Error("Unauthorized");

    const db = getDb();

    // Fetch user hash
    const [users] = (await db.query("SELECT password_hash FROM users WHERE id = ?", [userId])) as any[];
    if (users.length === 0) throw new Error("User not found");

    const currentHash = users[0].password_hash;
    if (!verifyPassword(data.currentPassword, currentHash)) {
      throw new Error("Incorrect current password");
    }

    const newHash = hashPassword(data.newPassword);
    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);

    return { success: true };
  });

