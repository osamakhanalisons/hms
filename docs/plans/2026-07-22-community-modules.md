# Community Modules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement full end-to-end features for the four remaining Community-related modules: Community Forum, Polls & AGM Voting, Events, and Amenities Booking.

**Architecture:** Extend the multi-tenant, toggleable architecture to the community space. Database tables will include `tenant_id` to keep them securely sandboxed under each society tenant, and view routes will hide themselves if the corresponding module is not active.

**Tech Stack:** React, TanStack Start (Vinxi), Tailwind CSS / shadcn (UI), MySQL (via `mysql2/promise` pool).

---

### Task 1: Database Schema Extension

**Files:**

- Modify: `src/lib/db.server.ts`

**Step 1: Write SQL tables for Community Forum, Polls, Events, and Amenities**
Add the following tables in `initDb()`:

- `forum_threads`: `id`, `tenant_id`, `author_id` (users.id), `category`, `title`, `body`, `photo_url`, `allow_comments`, `created_at`, `updated_at`.
- `forum_replies`: `id`, `thread_id`, `author_id`, `body`, `created_at`.
- `polls`: `id`, `tenant_id`, `question`, `type` (single/multi/agm), `options` (JSON array of strings), `opens_at`, `closes_at`, `is_anonymous`, `eligible_voters` (owners/all), `created_at`.
- `poll_votes`: `id`, `poll_id`, `user_id`, `choice` (string), `created_at`, UNIQUE KEY `uniq_poll_user` (`poll_id`, `user_id`).
- `events`: `id`, `tenant_id`, `title`, `cover_url`, `starts_at`, `ends_at`, `venue`, `allow_rsvp`, `capacity`, `description`, `created_at`.
- `event_rsvps`: `id`, `event_id`, `user_id`, `status` (y/n/maybe), `guests_count`, `notes`, `created_at`, UNIQUE KEY `uniq_event_user` (`event_id`, `user_id`).
- `amenities`: `id`, `tenant_id`, `name`, `category` (hall/gym/pool/court), `capacity`, `slot_minutes`, `open_time` (TIME), `close_time` (TIME), `charge_per_slot` (DECIMAL), `refundable_deposit` (DECIMAL), `rules` (TEXT), `is_active` (BOOLEAN).
- `amenity_bookings`: `id`, `tenant_id`, `amenity_id`, `user_id`, `booking_date` (DATE), `start_time` (TIME), `end_time` (TIME), `guests_count`, `purpose`, `status` (pending/approved/cancelled/completed), `created_at`.

---

### Task 2: API Layer Implementation

**Files:**

- Create: `src/lib/api/community.ts`

**Step 1: Write backend query functions**
Implement server functions for:

- Forum: `getThreads(tenantId)`, `createThread(tenantId, userId, data)`, `addReply(threadId, userId, body)`.
- Polls: `getPolls(tenantId, userId)`, `castVote(pollId, userId, choice)`.
- Events: `getEvents(tenantId)`, `rsvpEvent(eventId, userId, status, guests, notes)`.
- Amenities: `getAmenities(tenantId)`, `createBooking(tenantId, amenityId, userId, bookingDate, start, end, guests, purpose)`.

---

### Task 3: Routes & UI Implementation

**Files:**

- Create: `src/routes/forum.tsx`
- Create: `src/routes/polls.tsx`
- Create: `src/routes/events.tsx`
- Create: `src/routes/amenities.tsx`

**Step 1: Build front-end routes**

- `/forum`: List categories, threads. Add a "Start Thread" dialog. Display replies below each thread in a clean, modern aesthetic.
- `/polls`: Interactive cards showing open polls, ability to vote, and live bar chart displays of current results (using SVGs/CSS progress bars).
- `/events`: Card-based calendar showing upcoming events, quick RSVP toggles, guest count indicators.
- `/amenities`: List registered amenities with slot bookings. Modern calendar grid view to book available slots.

---

### Task 4: Module Registry Navigation

**Files:**

- Modify: `src/lib/modules.ts`
- Modify: `src/components/app-sidebar.tsx`

**Step 1: Add dedicated routes**
Map `community_forum`, `polls`, `events`, and `amenities` to their respective routes:

```typescript
export const DEDICATED_ROUTES: Record<string, string> = {
  // ...
  community_forum: "/forum",
  polls: "/polls",
  events: "/events",
  amenities: "/amenities",
};
```

Add shortcut items under Community navigation in `app-sidebar.tsx`.

---

### Task 5: Seed Script Update & Build Verification

**Files:**

- Modify: `scripts/seed.ts`

**Step 1: Add seed data**
Seed several threads, open polls, society events (e.g. Independence Day, Annual AGM), and basic amenities (Swimming Pool, Banquet Hall) with active bookings.

**Step 2: Verification**
Run: `npm run build` and `npx tsx scripts/seed.ts` to verify everything builds and runs flawlessly.
