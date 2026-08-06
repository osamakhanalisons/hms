import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser, getUserTenantId } from "./auth-helper";

// Lightweight API Error with status for consistent handlers
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Reusable auth helper: returns user and tenant, throws ApiError on failure
async function requireAuth(request: Request) {
  const userId = await getSessionUser(request);
  if (!userId) throw new ApiError(401, "Unauthorized");
  const tenantId = await getUserTenantId(userId);
  if (!tenantId) throw new ApiError(404, "Not found");
  return { userId, tenantId } as { userId: string; tenantId: string };
}

// Strongly-typed row shapes used by tenant assertions
interface PollRow {
  id: string;
  tenant_id: string;
}
interface ThreadRow {
  id: string;
  tenant_id: string;
}
interface EventRow {
  id: string;
  tenant_id: string;
}
interface AmenityRow {
  id: string;
  tenant_id: string;
}

// Tenant assertion helpers: verify existence and ownership. Throw generic 404 on mismatch.
async function assertPollTenant(db: any, pollId: string, tenantId: string) {
  const res = await db.query("SELECT id, tenant_id FROM polls WHERE id = ?", [pollId]);
  const [rows] = res as unknown as [PollRow[], unknown];
  if (!rows || rows.length === 0 || rows[0].tenant_id !== tenantId) {
    throw new ApiError(404, "Not found");
  }
}

async function assertThreadTenant(db: any, threadId: string, tenantId: string) {
  const res = await db.query("SELECT id, tenant_id FROM forum_threads WHERE id = ?", [threadId]);
  const [rows] = res as unknown as [ThreadRow[], unknown];
  if (!rows || rows.length === 0 || rows[0].tenant_id !== tenantId) {
    throw new ApiError(404, "Not found");
  }
}

async function assertEventTenant(db: any, eventId: string, tenantId: string) {
  const res = await db.query("SELECT id, tenant_id FROM events WHERE id = ?", [eventId]);
  const [rows] = res as unknown as [EventRow[], unknown];
  if (!rows || rows.length === 0 || rows[0].tenant_id !== tenantId) {
    throw new ApiError(404, "Not found");
  }
}

async function assertAmenityTenant(db: any, amenityId: string, tenantId: string) {
  const res = await db.query("SELECT id, tenant_id FROM amenities WHERE id = ?", [amenityId]);
  const [rows] = res as unknown as [AmenityRow[], unknown];
  if (!rows || rows.length === 0 || rows[0].tenant_id !== tenantId) {
    throw new ApiError(404, "Not found");
  }
}

// Helper to get session user

// Helper to get tenant ID for user

// ─── COMMUNITY FORUM ────────────────────────────────────────────────────────

export interface ForumThread {
  id: string;
  tenant_id: string;
  author_id: string;
  author_name?: string;
  category: string;
  title: string;
  body: string;
  photo_url?: string;
  allow_comments: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForumReply {
  id: string;
  thread_id: string;
  author_id: string;
  author_name?: string;
  body: string;
  created_at: string;
}

export const getThreadsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const { userId, tenantId } = await requireAuth(request);
  const db = getDb();
  try {
    const res = await db.query(
      `SELECT t.*, p.full_name as author_name 
         FROM forum_threads t
         LEFT JOIN profiles p ON t.author_id = p.id
         WHERE t.tenant_id = ?
         ORDER BY t.created_at DESC`,
      [tenantId],
    );
    const [rows] = res as unknown as [ForumThread[], unknown];
    return rows;
  } catch (err: unknown) {
    console.error('getThreadsFn error', { err, userId });
    throw new ApiError(500, 'Internal server error');
  }
});

export const createThreadFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      category: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      photo_url: z.string().optional(),
      allow_comments: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    const id = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO forum_threads (id, tenant_id, author_id, category, title, body, photo_url, allow_comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tenantId,
          userId,
          data.category,
          data.title,
          data.body,
          data.photo_url || null,
          data.allow_comments !== false,
        ],
      );
      return { id };
    } catch (err: unknown) {
      console.error('createThreadFn error', { err, userId });
      throw new ApiError(500, 'Internal server error');
    }
  });

export const getRepliesFn = createServerFn({ method: "GET" })
  .validator(z.object({ threadId: z.string() }))
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    await assertThreadTenant(db, data.threadId, tenantId);
    try {
      const res = await db.query(
        `SELECT r.*, p.full_name as author_name
         FROM forum_replies r
         LEFT JOIN profiles p ON r.author_id = p.id
         WHERE r.thread_id = ?
         ORDER BY r.created_at ASC`,
        [data.threadId],
      );
      const [rows] = res as unknown as [ForumReply[], unknown];
      return rows;
    } catch (err: unknown) {
      console.error('getRepliesFn error', { err, userId, threadId: data.threadId });
      throw new ApiError(500, 'Internal server error');
    }
  });

export const addReplyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      threadId: z.string(),
      body: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    await assertThreadTenant(db, data.threadId, tenantId);
    const id = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO forum_replies (id, thread_id, author_id, body)
         VALUES (?, ?, ?, ?)`,
        [id, data.threadId, userId, data.body],
      );
      return { id };
    } catch (err: unknown) {
      console.error('addReplyFn error', { err, userId, threadId: data.threadId });
      throw new ApiError(500, 'Internal server error');
    }
  });

// ─── POLLS & VOTING ─────────────────────────────────────────────────────────

export interface Poll {
  id: string;
  tenant_id: string;
  question: string;
  type: "single" | "multi" | "agm";
  options: string[];
  opens_at: string;
  closes_at: string;
  is_anonymous: boolean;
  eligible_voters: "owners" | "all";
  created_at: string;
  user_vote?: string;
  results?: Record<string, number>;
}

export const getPollsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const { userId, tenantId } = await requireAuth(request);
  const db = getDb();
  try {
    const res = await db.query(`SELECT * FROM polls WHERE tenant_id = ? ORDER BY created_at DESC`, [tenantId]);
    const [pollsRows] = res as unknown as [any[], unknown];
    const polls = pollsRows as any[];
    for (const poll of polls) {
      if (typeof poll.options === "string") {
        poll.options = JSON.parse(poll.options);
      }

      // Get user's vote if any
      const voteRes = await db.query(`SELECT choice FROM poll_votes WHERE poll_id = ? AND user_id = ?`, [poll.id, userId]);
      const [voteRows] = voteRes as unknown as [any[], unknown];
      poll.user_vote = voteRows.length > 0 ? voteRows[0].choice : undefined;

      // Compile results
      const votesRes = await db.query(`SELECT choice, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY choice`, [poll.id]);
      const [votesRows] = votesRes as unknown as [any[], unknown];
      const results: Record<string, number> = {};
      poll.options.forEach((opt: string) => {
        results[opt] = 0;
      });
      votesRows.forEach((v: any) => {
        results[v.choice] = v.count;
      });
      poll.results = results;
    }
    return polls as Poll[];
  } catch (err: unknown) {
    console.error('getPollsFn error', { err, userId });
    throw new ApiError(500, 'Internal server error');
  }
});

export const castVoteFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pollId: z.string(),
      choice: z.string(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    await assertPollTenant(db, data.pollId, tenantId);
    try {
      await db.query(
        `INSERT INTO poll_votes (id, poll_id, user_id, choice)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE choice = ?`,
        [crypto.randomUUID(), data.pollId, userId, data.choice, data.choice],
      );
      return { success: true };
    } catch (err: unknown) {
      console.error('castVoteFn error', { err, userId, pollId: data.pollId });
      throw new ApiError(500, 'Internal server error');
    }
  });

// ─── EVENTS ─────────────────────────────────────────────────────────────────

export interface EventItem {
  id: string;
  tenant_id: string;
  title: string;
  cover_url?: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  allow_rsvp: boolean;
  capacity?: number;
  description?: string;
  created_at: string;
  user_rsvp?: string;
  rsvp_counts?: { yes: number; no: number; maybe: number };
}

export const getEventsFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const { userId, tenantId } = await requireAuth(request);
  const db = getDb();
  try {
    const res = await db.query(`SELECT * FROM events WHERE tenant_id = ? ORDER BY starts_at ASC`, [tenantId]);
    const [eventRows] = res as unknown as [any[], unknown];
    const events = eventRows as any[];
    for (const ev of events) {
      // Get user's RSVP status
      const rsvpRes = await db.query(`SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?`, [ev.id, userId]);
      const [rsvpRows] = rsvpRes as unknown as [any[], unknown];
      ev.user_rsvp = rsvpRows.length > 0 ? rsvpRows[0].status : undefined;

      // Get overall RSVP aggregates
      const countsRes = await db.query(`SELECT status, COUNT(*) as count FROM event_rsvps WHERE event_id = ? GROUP BY status`, [ev.id]);
      const [countsRows] = countsRes as unknown as [any[], unknown];
      const counts = { yes: 0, no: 0, maybe: 0 };
      countsRows.forEach((r: any) => {
        if (r.status === "yes" || r.status === "no" || r.status === "maybe") {
          counts[r.status as keyof typeof counts] = r.count;
        }
      });
      ev.rsvp_counts = counts;
    }
    return events as EventItem[];
  } catch (err: unknown) {
    console.error('getEventsFn error', { err, userId });
    throw new ApiError(500, 'Internal server error');
  }
});

export const rsvpEventFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      eventId: z.string(),
      status: z.enum(["yes", "no", "maybe"]),
      guestsCount: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    await assertEventTenant(db, data.eventId, tenantId);
    try {
      await db.query(
        `INSERT INTO event_rsvps (id, event_id, user_id, status, guests_count, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = ?, guests_count = ?, notes = ?`,
        [
          crypto.randomUUID(),
          data.eventId,
          userId,
          data.status,
          data.guestsCount ?? 0,
          data.notes || null,
          data.status,
          data.guestsCount ?? 0,
          data.notes || null,
        ],
      );
      return { success: true };
    } catch (err: unknown) {
      console.error('rsvpEventFn error', { err, userId, eventId: data.eventId });
      throw new ApiError(500, 'Internal server error');
    }
  });

// ─── AMENITIES ──────────────────────────────────────────────────────────────

export interface Amenity {
  id: string;
  tenant_id: string;
  name: string;
  category: "hall" | "gym" | "pool" | "court";
  capacity?: number;
  slot_minutes: number;
  open_time: string;
  close_time: string;
  charge_per_slot: number;
  refundable_deposit: number;
  rules?: string;
  is_active: boolean;
}

export interface AmenityBooking {
  id: string;
  tenant_id: string;
  amenity_id: string;
  amenity_name?: string;
  user_id: string;
  user_name?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  guests_count: number;
  purpose?: string;
  status: "pending" | "approved" | "cancelled" | "completed";
  created_at: string;
}

export const getAmenitiesFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const { userId, tenantId } = await requireAuth(request);
  const db = getDb();
  try {
    const res = await db.query(`SELECT * FROM amenities WHERE tenant_id = ? AND is_active = TRUE ORDER BY name ASC`, [tenantId]);
    const [rows] = res as unknown as [Amenity[], unknown];
    return rows;
  } catch (err: unknown) {
    console.error('getAmenitiesFn error', { err, userId });
    throw new ApiError(500, 'Internal server error');
  }
});

export const getBookingsFn = createServerFn({ method: "GET" })
  .validator(z.object({ myOnly: z.boolean().optional() }).optional())
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    try {
      let query = `
        SELECT b.*, a.name as amenity_name, p.full_name as user_name
        FROM amenity_bookings b
        JOIN amenities a ON b.amenity_id = a.id
        LEFT JOIN profiles p ON b.user_id = p.id
        WHERE b.tenant_id = ?
      `;
      const params: unknown[] = [tenantId];

      if (data?.myOnly) {
        query += ` AND b.user_id = ?`;
        params.push(userId as unknown);
      }

      query += ` ORDER BY b.booking_date DESC, b.start_time DESC`;
      const res = await db.query(query, params);
      const [rows] = res as unknown as [AmenityBooking[], unknown];
      return rows;
    } catch (err: unknown) {
      console.error('getBookingsFn error', { err, userId });
      throw new ApiError(500, 'Internal server error');
    }
  });

export const createBookingFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      amenityId: z.string(),
      bookingDate: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      guestsCount: z.number().int().nonnegative().optional(),
      purpose: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    // ensure amenity belongs to tenant
    await assertAmenityTenant(db, data.amenityId, tenantId);
    const id = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO amenity_bookings (id, tenant_id, amenity_id, user_id, booking_date, start_time, end_time, guests_count, purpose, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          id,
          tenantId,
          data.amenityId,
          userId,
          data.bookingDate,
          data.startTime,
          data.endTime,
          data.guestsCount ?? 0,
          data.purpose || null,
        ],
      );
      return { id };
    } catch (err: unknown) {
      console.error('createBookingFn error', { err, userId, amenityId: data.amenityId });
      throw new ApiError(500, 'Internal server error');
    }
  });

function formatDateForDb(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export const createPollFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      question: z.string().min(1),
      type: z.enum(["single", "multi", "agm"]).default("single"),
      options: z.array(z.string()).min(2),
      opensAt: z.string(),
      closesAt: z.string(),
      isAnonymous: z.boolean().default(false),
      eligibleVoters: z.enum(["owners", "all"]).default("all"),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    const id = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO polls (id, tenant_id, question, type, options, opens_at, closes_at, is_anonymous, eligible_voters)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tenantId,
          data.question,
          data.type,
          JSON.stringify(data.options),
          formatDateForDb(data.opensAt),
          formatDateForDb(data.closesAt),
          data.isAnonymous,
          data.eligibleVoters,
        ],
      );
      return { id };
    } catch (err: unknown) {
      console.error('createPollFn error', { err, userId });
      throw new ApiError(500, 'Internal server error');
    }
  });

export const createEventFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      coverUrl: z.string().optional(),
      startsAt: z.string(),
      endsAt: z.string(),
      venue: z.string().min(1),
      allowRsvp: z.boolean().default(true),
      capacity: z.number().int().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    const id = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO events (id, tenant_id, title, cover_url, starts_at, ends_at, venue, allow_rsvp, capacity, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tenantId,
          data.title,
          data.coverUrl || null,
          formatDateForDb(data.startsAt),
          formatDateForDb(data.endsAt),
          data.venue,
          data.allowRsvp,
          data.capacity || null,
          data.description || null,
        ],
      );
      return { id };
    } catch (err: unknown) {
      console.error('createEventFn error', { err, userId });
      throw new ApiError(500, 'Internal server error');
    }
  });

export const createAmenityFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      category: z.enum(["hall", "gym", "pool", "court"]).default("hall"),
      capacity: z.number().int().optional(),
      slotMinutes: z.number().int().default(60),
      openTime: z.string().default("08:00"),
      closeTime: z.string().default("22:00"),
      chargePerSlot: z.number().default(0),
      refundableDeposit: z.number().default(0),
      rules: z.string().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const { userId, tenantId } = await requireAuth(request);
    const db = getDb();
    const id = crypto.randomUUID();
    try {
      await db.query(
        `INSERT INTO amenities (id, tenant_id, name, category, capacity, slot_minutes, open_time, close_time, charge_per_slot, refundable_deposit, rules, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          id,
          tenantId,
          data.name,
          data.category,
          data.capacity || null,
          data.slotMinutes,
          data.openTime,
          data.closeTime,
          data.chargePerSlot,
          data.refundableDeposit,
          data.rules || null,
        ],
      );
      return { id };
    } catch (err: unknown) {
      console.error('createAmenityFn error', { err, userId });
      throw new ApiError(500, 'Internal server error');
    }
  });
