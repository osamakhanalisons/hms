import crypto from "node:crypto";
import { getDb } from "../db.server";

// Verify password helper
function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return hash === testHash;
  } catch (e) {
    return false;
  }
}

// Authenticate helper to verify session token via Authorization header
async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const db = getDb();
  const [sessions] = (await db.query(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > NOW()",
    [token],
  )) as any[];

  if (sessions.length === 0) return null;
  const userId = sessions[0].user_id as string;

  // Get primary role
  const [roles] = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId])) as any[];
  const role = roles.length ? (roles[0].role as string) : "resident";

  // Get tenant ID
  const [profiles] = (await db.query("SELECT tenant_id, full_name FROM profiles WHERE id = ?", [userId])) as any[];
  const tenantId = profiles.length ? (profiles[0].tenant_id as string | null) : null;
  const fullName = profiles.length ? (profiles[0].full_name as string | null) : "";

  return { userId, tenantId, role, fullName, token };
}

export async function handleMobileRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/mobile/, "");
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const db = getDb();

  // 1. PUBLIC: POST /api/mobile/login
  if (path === "/login" && method === "POST") {
    try {
      const body = await request.json();
      const { email, password } = body;

      const [users] = (await db.query("SELECT id, password_hash FROM users WHERE email = ?", [
        email,
      ])) as any[];

      if (users.length === 0 || !verifyPassword(password, users[0].password_hash)) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const userId = users[0].id;

      // Create new session token
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
        sessionToken,
        userId,
        expiresAt,
      ]);

      // Fetch Profile & Primary Role
      const [profiles] = (await db.query("SELECT tenant_id, full_name FROM profiles WHERE id = ?", [userId])) as any[];
      const tenantId = profiles.length ? (profiles[0].tenant_id as string | null) : null;
      const fullName = profiles.length ? (profiles[0].full_name as string | null) : "";

      const [roles] = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId])) as any[];
      const role = roles.length ? (roles[0].role as string) : "resident";

      return new Response(
        JSON.stringify({
          token: sessionToken,
          user: { id: userId, email, fullName, role, tenantId },
        }),
        { status: 200, headers: corsHeaders },
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Login failed" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
  }

  // ALL OTHER ROUTES REQUIRE AUTHENTICATION
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const { userId, tenantId, role, fullName } = auth;

  // 2. GET /api/mobile/dashboard (Resident Core Information)
  if (path === "/dashboard" && method === "GET") {
    try {
      // Wallet and Ledger
      const [billedRows] = (await db.query(
        "SELECT SUM(amount) AS total FROM ledger_entries WHERE tenant_id = ? AND type = 'charge'",
        [tenantId],
      )) as any[];
      const [collectedRows] = (await db.query(
        "SELECT SUM(amount) AS total FROM payments WHERE tenant_id = ? AND status = 'cleared'",
        [tenantId],
      )) as any[];
      const totalBilled = Number(billedRows[0]?.total || 0);
      const totalCollected = Number(collectedRows[0]?.total || 0);
      const walletBalance = Math.max(0, totalBilled - totalCollected);

      const [ledgerRows] = (await db.query(
        `SELECT le.id, le.unit_id, le.type AS entry_type, le.amount, le.description, le.billing_period, le.balance_after, le.created_at
         FROM ledger_entries le
         WHERE le.tenant_id = ?
         ORDER BY le.created_at DESC LIMIT 10`,
        [tenantId],
      )) as any[];

      // Utility Bills
      const [utilityRows] = (await db.query(
        `SELECT mr.id, mr.meter_type, mr.current_reading, mr.reading_date, mr.charged_amount, mr.ledger_entry_id,
                u.unit_number, b.name AS block_name,
                CASE WHEN mr.ledger_entry_id IS NOT NULL THEN 'paid' ELSE 'unbilled' END AS billing_status
         FROM meter_readings mr
         JOIN units u ON u.id = mr.unit_id
         LEFT JOIN blocks b ON b.id = u.block_id
         WHERE mr.tenant_id = ?
         ORDER BY mr.reading_date DESC LIMIT 10`,
        [tenantId],
      )) as any[];

      // Notice Board
      const [notices] = (await db.query(
        "SELECT * FROM notices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 15",
        [tenantId],
      )) as any[];

      // Polls
      const [polls] = (await db.query(
        `SELECT p.*, 
          (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = p.id) AS total_votes,
          (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = p.id AND pv.user_id = ?) AS user_voted
         FROM polls p WHERE p.tenant_id = ? ORDER BY p.created_at DESC`,
        [userId, tenantId],
      )) as any[];

      // Booked Amenities
      const [amenities] = (await db.query(
        "SELECT * FROM amenities WHERE tenant_id = ? ORDER BY name ASC",
        [tenantId],
      )) as any[];

      const [bookings] = (await db.query(
        `SELECT ab.*, a.name AS amenity_name FROM amenity_bookings ab
         JOIN amenities a ON a.id = ab.amenity_id
         WHERE ab.tenant_id = ? AND ab.user_id = ? ORDER BY ab.booking_date DESC`,
        [tenantId, userId],
      )) as any[];

      // Visitor Passes
      const [visitors] = (await db.query(
        "SELECT * FROM visitor_passes WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 15",
        [tenantId],
      )) as any[];

      // Notifications
      const [notifications] = (await db.query(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
        [userId],
      )) as any[];

      // Complaints
      const [complaints] = (await db.query(
        "SELECT * FROM complaints WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 15",
        [tenantId],
      )) as any[];

      return new Response(
        JSON.stringify({
          fullName,
          role,
          wallet: {
            balance: walletBalance,
            totalBilled,
            totalCollected,
          },
          ledgers: ledgerRows,
          utilities: utilityRows,
          notices,
          polls,
          amenities,
          bookings,
          visitors,
          notifications,
          complaints,
        }),
        { status: 200, headers: corsHeaders },
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 3. POST /api/mobile/visitor-passes
  if (path === "/visitor-passes" && method === "POST") {
    try {
      const { visitorName, visitorPhone, expectedAt, visitorType, vehiclePlate } = await request.json();

      // Find Resident ID
      const [residents] = (await db.query(
        `SELECT r.id FROM residents r
         JOIN persons p ON p.id = r.person_id
         WHERE p.user_id = ? AND r.tenant_id = ?`,
        [userId, tenantId],
      )) as any[];

      const residentId = residents.length ? residents[0].id : null;
      if (!residentId) {
        return new Response(JSON.stringify({ error: "No resident profile found" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const passId = crypto.randomUUID();
      const passCode = Math.floor(100000 + Math.random() * 900000).toString();

      await db.query(
        `INSERT INTO visitor_passes (id, tenant_id, resident_id, visitor_name, visitor_phone, expected_at, pass_code, status, visitor_type, vehicle_plate, pre_registered)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, TRUE)`,
        [
          passId,
          tenantId,
          residentId,
          visitorName,
          visitorPhone || null,
          expectedAt || new Date().toISOString().slice(0, 19).replace("T", " "),
          passCode,
          visitorType || "one_time",
          vehiclePlate || null,
        ],
      );

      return new Response(JSON.stringify({ success: true, passCode, passId }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
    }
  }

  // 4. POST /api/mobile/complaints
  if (path === "/complaints" && method === "POST") {
    try {
      const body = await request.json();
      const category = typeof body.category === "string" ? body.category : "general";
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
      const description = typeof body.description === "string" ? body.description : "";

      if (!title) {
        return new Response(JSON.stringify({ error: "Title is required" }), { status: 400, headers: corsHeaders });
      }

      const complaintId = crypto.randomUUID();
      try {
        await db.query(
          `INSERT INTO complaints (id, tenant_id, category, title, description, status, submitted_by, created_by)
           VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
          [complaintId, tenantId, category, title, description, userId, userId],
        );
      } catch (sqlErr: any) {
        const msg = String(sqlErr?.message || sqlErr);
        if (msg.includes("Unknown column") || msg.includes("Data truncated")) {
          return new Response(
            JSON.stringify({ error: "Database schema issue: " + msg + ". Please run migration scripts: scripts/migrations/2026-08-05_add_missing_columns.sql" }),
            { status: 500, headers: corsHeaders },
          );
        }
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, complaintId }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Invalid payload" }), { status: 400, headers: corsHeaders });
    }
  }

  // 5. POST /api/mobile/polls/vote
  if (path === "/polls/vote" && method === "POST") {
    try {
      const body = await request.json();
      const pollId = body?.pollId;
      const optionSelected = body?.optionSelected;

      if (!pollId || !optionSelected) {
        return new Response(JSON.stringify({ error: "pollId and optionSelected are required" }), { status: 400, headers: corsHeaders });
      }

      const [existingVote] = (await db.query(
        "SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?",
        [pollId, userId],
      )) as any[];

      if (existingVote.length > 0) {
        return new Response(JSON.stringify({ error: "Already voted" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const voteId = crypto.randomUUID();
      try {
        await db.query(
          "INSERT INTO poll_votes (id, poll_id, user_id, choice, option_selected) VALUES (?, ?, ?, ?, ?)",
          [voteId, pollId, userId, optionSelected, optionSelected],
        );
      } catch (sqlErr: any) {
        const msg = String(sqlErr?.message || sqlErr);
        if (msg.includes("Unknown column") || msg.includes("Data truncated")) {
          return new Response(
            JSON.stringify({ error: "Database schema issue: " + msg + ". Please run migration scripts: scripts/migrations/2026-08-05_add_missing_columns.sql" }),
            { status: 500, headers: corsHeaders },
          );
        }
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Invalid payload" }), { status: 400, headers: corsHeaders });
    }
  }

  // 6. POST /api/mobile/amenities/book
  if (path === "/amenities/book" && method === "POST") {
    try {
      const body = await request.json();
      const amenityId = body?.amenityId;
      const bookingDate = body?.bookingDate;
      const startTime = body?.startTime || null;
      const endTime = body?.endTime || null;

      if (!amenityId || !bookingDate) {
        return new Response(JSON.stringify({ error: "amenityId and bookingDate are required" }), { status: 400, headers: corsHeaders });
      }

      const bookingId = crypto.randomUUID();
      try {
        await db.query(
          `INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [bookingId, tenantId, amenityId, userId, bookingDate, startTime, endTime],
        );
      } catch (sqlErr: any) {
        const msg = String(sqlErr?.message || sqlErr);
        if (msg.includes("Unknown column") || msg.includes("Data truncated")) {
          return new Response(
            JSON.stringify({ error: "Database schema issue: " + msg + ". Please run migration scripts: scripts/migrations/2026-08-05_add_missing_columns.sql" }),
            { status: 500, headers: corsHeaders },
          );
        }
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, bookingId }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Invalid payload" }), { status: 400, headers: corsHeaders });
    }
  }

  // 7. POST /api/mobile/notifications/read
  if (path === "/notifications/read" && method === "POST") {
    try {
      const { notificationId } = await request.json();

      await db.query("UPDATE notifications SET read_status = 'read' WHERE id = ? AND user_id = ?", [
        notificationId,
        userId,
      ]);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
    }
  }

  // 8. GET /api/mobile/maintenance/work-orders
  if (path === "/maintenance/work-orders" && method === "GET") {
    try {
      const [orders] = (await db.query(
        `SELECT w.*, a.name AS asset_name, NULL AS unit_number
         FROM maintenance_work_orders w
         LEFT JOIN assets a ON a.id = w.asset_id
         WHERE w.tenant_id = ? ORDER BY w.created_at DESC`,
        [tenantId],
      )) as any[];

      return new Response(JSON.stringify(orders), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 9. POST /api/mobile/maintenance/work-orders/update
  if (path === "/maintenance/work-orders/update" && method === "POST") {
    try {
      const { orderId, status, actualCost } = await request.json();

      if (status === "resolved") {
        await db.query(
          "UPDATE maintenance_work_orders SET status = ?, actual_cost = ?, resolved_at = NOW() WHERE id = ?",
          [status, actualCost || 0.0, orderId],
        );
      } else {
        await db.query(
          "UPDATE maintenance_work_orders SET status = ? WHERE id = ?",
          [status, orderId],
        );
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: "Endpoint not found" }), {
    status: 404,
    headers: corsHeaders,
  });
}
