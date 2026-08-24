# Database Table Catalog

This document lists all 57 database tables in the AT-BMS (HousingOS) system, grouped by architectural domains.

## 1. Security & Authentication
- `users`: Core login credentials.
  - `id` (VARCHAR(36), PK): UUID.
  - `email` (VARCHAR(255), UNIQUE): User's primary email.
  - `password_hash` (VARCHAR(255)): Scrypt-hashed password.
- `profiles`: Personal profiles linked with tenants.
  - `id` (VARCHAR(36), PK, FK -> users.id): UUID.
  - `full_name` (VARCHAR(255)): Full name.
  - `society_name` (VARCHAR(255)): Active society context.
  - `phone` (VARCHAR(50)): Contact number.
  - `tenant_id` (VARCHAR(36), FK -> tenants.id): Scoping identifier.
- `user_roles`: User assigned roles mapping.
  - `id` (VARCHAR(36), PK): UUID.
  - `user_id` (VARCHAR(36), FK -> users.id)
  - `role` (ENUM('super_admin', 'society_admin', 'resident', 'tenant', 'guard', 'technician', 'finance_head'))
- `custom_roles`: Tenant custom roles.
  - `id` (VARCHAR(36), PK)
  - `tenant_id` (VARCHAR(36))
  - `name` (VARCHAR(100))
- `role_permissions`: Overrides for custom role permissions.
  - `id` (VARCHAR(36), PK)
  - `role_id` (VARCHAR(36), FK)
  - `module_key` (VARCHAR(50))
  - `can_view` (BOOLEAN)
  - `can_create` (BOOLEAN)
  - `can_edit` (BOOLEAN)
  - `can_delete` (BOOLEAN)
- `sessions`: Auth sessions.
  - `id` (VARCHAR(36), PK)
  - `user_id` (VARCHAR(36), FK)
  - `expires_at` (DATETIME)

## 2. Properties & Tenant Isolation
- `tenants`: HousingOS SaaS customer instances.
  - `id` (VARCHAR(36), PK)
  - `name` (VARCHAR(255))
  - `slug` (VARCHAR(255), UNIQUE)
  - `plan` (ENUM('basic', 'standard', 'enterprise'))
- `tenant_modules`: Registered modules per society.
  - `id` (VARCHAR(36), PK)
  - `tenant_id` (VARCHAR(36))
  - `module_key` (VARCHAR(50))
  - `is_active` (BOOLEAN)
- `societies`: Society groupings under a tenant.
  - `id` (VARCHAR(36), PK)
  - `tenant_id` (VARCHAR(36))
  - `name` (VARCHAR(255))
- `blocks`: Structural sections within a society.
  - `id` (VARCHAR(36), PK)
  - `society_id` (VARCHAR(36), FK)
  - `tenant_id` (VARCHAR(36))
  - `name` (VARCHAR(255))
- `buildings`: Structures in blocks.
  - `id` (VARCHAR(36), PK)
  - `block_id` (VARCHAR(36), FK)
  - `tenant_id` (VARCHAR(36))
  - `name` (VARCHAR(255))
- `floors`: Verticals in buildings.
  - `id` (VARCHAR(36), PK)
  - `building_id` (VARCHAR(36), FK)
  - `tenant_id` (VARCHAR(36))
  - `name` (VARCHAR(255))
- `units`: Physical property flats/villas.
  - `id` (VARCHAR(36), PK)
  - `floor_id` (VARCHAR(36), FK)
  - `building_id` (VARCHAR(36), FK)
  - `block_id` (VARCHAR(36), FK)
  - `society_id` (VARCHAR(36), FK)
  - `tenant_id` (VARCHAR(36))
  - `unit_number` (VARCHAR(50))
  - `unit_type` (ENUM('flat', 'penthouse', 'villa', 'shop'))
  - `status` (ENUM('occupied', 'vacant', 'renovation', 'locked'))

## 3. Residents & Vehicles
- `persons`: Core identity directory.
  - `id` (VARCHAR(36), PK)
  - `tenant_id` (VARCHAR(36))
  - `user_id` (VARCHAR(36), FK)
  - `full_name` (VARCHAR(255))
  - `phone` (VARCHAR(50))
  - `email` (VARCHAR(255))
- `residents`: Residents profile links.
  - `id` (VARCHAR(36), PK)
  - `tenant_id` (VARCHAR(36))
  - `unit_id` (VARCHAR(36), FK)
  - `person_id` (VARCHAR(36), FK)
  - `type` (ENUM('owner', 'tenant'))
  - `is_current` (BOOLEAN)
- `resident_vehicles`: Parking/Gate whitelist vehicle plates.
  - `id` (VARCHAR(36), PK)
  - `tenant_id` (VARCHAR(36))
  - `unit_id` (VARCHAR(36), FK)
  - `plate_number` (VARCHAR(50))
  - `vehicle_type` (VARCHAR(50))

## 4. Financial Ledger & Payments
- `charge_heads`: Billing definitions.
  - `id`, `tenant_id`, `name`, `description`, `default_amount`
- `ledger_entries`: Billing ledger transactions list.
  - `id`, `tenant_id`, `unit_id`, `type`, `charge_head_id`, `amount`, `balance_after`
- `payments`: Resident payment recordings.
  - `id`, `tenant_id`, `unit_id`, `amount`, `payment_method`, `reference`, `notes`
- `wallets`: Pre-paid wallets per unit.
  - `id`, `tenant_id`, `unit_id`, `balance`

## 5. Complaints & Work Orders
- `complaints`: Resident tickets directory.
  - `id`, `tenant_id`, `title`, `description`, `category`, `priority`, `status`, `submitted_by`
- `complaint_comments`: Conversation threads on complaints.
  - `id`, `complaint_id`, `author_id`, `body`
- `complaint_history`: Audit trail for tickets status changes.
  - `id`, `complaint_id`, `status`, `changed_by`
- `work_orders`: Physical repair actions list.
  - `id`, `tenant_id`, `technician_id`, `asset_id`, `status`, `cost`
- `maintenance_schedules`: Recurrence checks patterns.
  - `id`, `tenant_id`, `asset_id`, `interval_days`, `last_run`

## 6. Gate Security & Visitors
- `visitor_passes`: Pre-authorized guest passes.
  - `id`, `tenant_id`, `visitor_name`, `pass_code`, `expires_at`
- `entry_exit_log`: Physical gate scanning histories.
  - `id`, `tenant_id`, `visitor_pass_id`, `scan_time`, `action_type`
- `gate_terminals`: Registered terminal tablets.
  - `id`, `tenant_id`, `name`, `status`
- `guard_patrols`: Checkpoints tour records.
  - `id`, `tenant_id`, `guard_name`, `checkpoint_name`
- `blacklist`: Blocked vehicle plate registrations.
  - `id`, `tenant_id`, `type`, `value`, `reason`

## 7. Community & Governance
- `forum_threads`: Discussions.
  - `id`, `tenant_id`, `author_id`, `category`, `title`, `body`
- `forum_replies`: Discussion posts.
  - `id`, `thread_id`, `author_id`, `body`
- `polls`: Votes metadata.
  - `id`, `tenant_id`, `question`, `options`, `closes_at`
- `poll_votes`: Individual votes registrations.
  - `id`, `poll_id`, `user_id`, `choice`
- `events`: Community calendars.
  - `id`, `tenant_id`, `title`, `starts_at`, `ends_at`
- `event_rsvps`: Attendance confirmations.
  - `id`, `event_id`, `user_id`, `status`
- `amenities`: Bookable properties items.
  - `id`, `tenant_id`, `name`, `capacity`, `charge_per_slot`
- `amenity_bookings`: Bookings schedule entries.
  - `id`, `tenant_id`, `amenity_id`, `user_id`, `booking_date`, `status`
- `governance_meetings`: Committee meetings records.
  - `id`, `tenant_id`, `title`, `scheduled_at`, `status`
- `governance_resolutions`: Passed/proposed policies items.
  - `id`, `tenant_id`, `meeting_id`, `title`, `status`

## 8. General Logs & Files
- `documents`: Upload metadata index.
  - `id`, `tenant_id`, `name`, `category`, `file_url`, `expiry_date`
- `notifications`: Alerts registry logs.
  - `id`, `user_id`, `title`, `body`, `is_read`
- `audit_logs`: Operations tracking logs.
  - `id`, `tenant_id`, `user_id`, `module_key`, `action`, `ip_address`
