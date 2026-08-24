# Phase 3 Community Modules Implementation & Security Hardening Plan

This plan documents the security, RBAC, voter eligibility, double-booking validation, index additions, voter details view, and historical cascade updates applied to the AT-BMS Community modules.

---

## 1. Security & RBAC Hardening
- **Authorization Gating:** Gated all server functions in `src/lib/api/community.ts` using the core `requirePermission` mechanism.
- **Module Verification:** Enforced module activation gates through the existing `requirePermission` logic on the backend.
- **Permission Actions Mapping:**
  - Forum: `community_forum` (view / create)
  - Polls: `polls` (view / create)
  - Events: `events` (view / create)
  - Amenities: `amenities` (view for listing and booking, create for administrative setups)

---

## 2. Poll Voter Eligibility & Details View
- **Voter Eligibility:** Validates the current user has a resident profile in the active tenant. Enforces `eligible_voters = 'owners'` restriction where only residents with `type = 'owner'` may vote. Allows both owners and tenants to vote if `eligible_voters = 'all'`.
- **Voter Details View:** Authorized Admins (`super_admin`, `society_admin`) can view a detailed list of voters for each poll, showing voter name, email, selected option, and vote date/time. Residents are strictly blocked on both the frontend UI and the backend API from seeing other users' votes.

---

## 3. Booking Conflict Rules (Amenities Booking)
- Implemented transaction-safe double-booking prevention in `createBookingFn`.
- Bookings conflict if:
  `existing.start_time < requested.end_time AND existing.end_time > requested.startTime`
- Adjacent slots (e.g. 10:00-11:00 and 11:00-12:00) are allowed.
- Validated that bookings stay within the amenity's configured opening and closing hours.
- Verified that requested guests count does not exceed the amenity capacity limit.

---

## 4. Event RSVP Capacity Restrictions
- Implemented transaction-safe capacity enforcement in `rsvpEventFn`.
- Total confirmed/accepted attendees (including guests) cannot exceed the event capacity.
- Excludes the user's existing RSVP count when updating their status to prevent self-double-counting.

---

## 5. Database Foreign Key Changes
- Updated historical user-referencing constraints from `ON DELETE CASCADE` to `ON DELETE SET NULL`:
  - `complaints.submitted_by`
  - `complaint_comments.author_id`
  - `notices.author_id`
- Modified corresponding columns to allow `NULL` values.
- Retained `notice_reads.user_id` as `ON DELETE CASCADE` because read receipts are transient state.

---

## 6. Forum Content Retention Decision
- Decided to retain `ON DELETE CASCADE` for `forum_threads.author_id` and `forum_replies.author_id`. In this social context, posts are considered user-owned content, matching standard privacy right-to-forget patterns.

---

## 7. Composite Indexes Added
- Added composite index `idx_bookings_conflict` on `amenity_bookings(amenity_id, booking_date, status, start_time, end_time)` to optimize overlap conflict queries.
