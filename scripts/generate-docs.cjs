const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '../docs');

// Create directories if they don't exist
const dirsToCreate = [
  DOCS_DIR,
  path.join(DOCS_DIR, 'api'),
  path.join(DOCS_DIR, 'architecture'),
  path.join(DOCS_DIR, 'database'),
  path.join(DOCS_DIR, 'flows'),
  path.join(DOCS_DIR, 'plans'),
  path.join(DOCS_DIR, 'security'),
  path.join(DOCS_DIR, 'testing')
];

dirsToCreate.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const files = {
  // ─── 01-project-overview.md ───────────────────────────────────────────────
  '01-project-overview.md': `# Project Overview

AT-BMS (HousingOS) is a state-of-the-art, multi-tenant portal designed to streamline operations, finance, and security workflows within gated communities, housing societies, and commercial complexes.

## Business Goals
1. **Financial Transparency**: Provide real-time ledger access to residents to reduce disputes.
2. **Tenant Isolation**: Maintain absolute data privacy between different housing societies using the same platform instance.
3. **Operational Efficiency**: Provide tools to log complaints, handle parking allocations, and track maintenance bills.
4. **Security Hardening**: Secure entry/exit tracking and prevent unauthorized users from viewing adjacent society records.

## Core Concepts Explained

### 1. Society / Tenant
* **Technical definition**: The top-level administrative unit (represented in the \`tenants\` database table).
* **Roman Urdu**: *Ye poori housing society ya building cooperative hai (jaise Green Pines Society). Har society ka data doosri society se bilkul alag rehta hai.*

### 2. Block
* **Technical definition**: A spatial cluster within a tenant (e.g., Block A, Phase II).
* **Roman Urdu**: *Society ke andar ka area ya sector (jaise Block A). Ye building ya units ko grouping dene ke liye use hota hai.*

### 3. Building
* **Technical definition**: A physical structure inside a Block containing vertical levels.
* **Roman Urdu**: *Block ke andar majood physical building ya tower (jaise Tower 1). Blocks ke baghair buildings directly society level par bhi ho sakti hain.*

### 4. Floor
* **Technical definition**: A vertical index mapping inside a building.
* **Roman Urdu**: *Building ki floors (jaise Ground Floor, First Floor). Units ko height ke mutabiq classify karne ke liye.*

### 5. Unit
* **Technical definition**: A specific apartment, flat, penthouse, shop, or villa (represented in the \`units\` table).
* **Roman Urdu**: *Woh flat ya ghar jisme rehne wala shakhs rehta hai. Ye billing aur ownership ki aakhri limit hai.*

### 6. Resident
* **Technical definition**: An occupant of a unit, classified as Owner or Tenant.
* **Roman Urdu**: *Woh shakhs jo unit me reh raha hai. Iska data profiles table me save hota.*

### 7. Society Admin
* **Technical definition**: An administrator scoped to one or more tenants via \`society_admin_tenants\`.
* **Roman Urdu**: *Society ka manager jo sirf apni society ke members, billing, aur complaints ko manage kar sakta hai.*

### 8. Super Admin
* **Technical definition**: A global platform admin with global bypass.
* **Roman Urdu**: *Platform owner jo poore system ko monitor karta hai, nai societies banata hai, aur unhe system modules assign karta hai.*
`,

  // ─── 02-system-architecture.md ────────────────────────────────────────────
  '02-system-architecture.md': `# System Architecture

The AT-BMS application utilizes a modern, unified tech stack that combines the best of single-page apps (SPA) and server-side rendering (SSR).

## Frontend-Backend Integration via TanStack Start
- **Core Engine**: Vinxi runs the bundler, bundling both frontend assets and backend server functions.
- **Routing**: TanStack Router handles declarative, type-safe frontend routing. The file structure under \`src/routes/\` dynamically generates the client-side pages and paths.
- **Server Functions**: Instead of standard REST or GraphQL endpoints, we use TanStack Start server functions (\`createServerFn\`). These functions allow direct server-side calls (like database queries) to be imported and executed as simple async function calls in React.
- **Data Querying & Cache**: React Query (\`@tanstack/react-query\`) caches server responses, handles states (loading, error, success), and triggers mutations to keep the interface synchronized.

## Data Layer Architecture
- **Database Engine**: MySQL 8.x is the primary database, utilizing standard relationships and constraints.
- **Connection Pooling**: \`mysql2/promise\` maintains a connection pool, avoiding overhead on concurrent database operations.
- **Multi-Tenancy**: Scoped tables include a \`tenant_id\` field to enforce logical data segregation.
`,

  // ─── 03-user-roles-and-permissions.md ──────────────────────────────────────
  '03-user-roles-and-permissions.md': `# User Roles and Permissions Matrix

The platform implements a Role-Based Access Control (RBAC) system split into two levels: Platform Level and Tenant/Society Level.

| Role | Scope | Key Permissions |
|---|---|---|
| \`super_admin\` | Global | Full system access, society onboarding, global settings, log analysis. |
| \`society_admin\` | Tenant | Full control over the specific society (units, bills, resident user roles). |
| \`resident\` | Tenant (Unit) | View invoices, pay online, raise complaints, participate in polls and forum. |
| \`tenant\` | Tenant (Unit) | View bills, submit complaints, view forum (restricted compared to owner). |
| \`guard\` | Tenant (Gate) | Pre-registered visitor entry, exit log registration, blacklist alerts. |
| \`technician\` | Tenant (Maintenance) | Update assigned work orders, update inventory usage, resolve issues. |
| \`finance_head\` | Tenant (Finance) | View general ledger, trigger monthly maintenance charge heads, record payments. |

## Dynamic Roles
Custom roles can be created under the "Role Permissions" settings tab. These roles map to entries in the \`custom_roles\` and \`role_permissions\` tables, allowing fine-grained toggling of permissions (\`can_view\`, \`can_create\`, \`can_edit\`, \`can_delete\`) per module.
`,

  // ─── 04-multi-society-architecture.md ──────────────────────────────────────
  '04-multi-society-architecture.md': `# Multi-Society Architecture

AT-BMS is designed as a SaaS platform where multiple independent societies coexist on the same software instance and database.

## Society Scoping & Isolation
- **Cookie Resolution**: When a user logs in, their session cookie containing their credentials and active \`tenant_id\` is validated.
- **Multi-Society Admin**: If a user is a \`society_admin\` for multiple societies, they are presented with a society switcher. The switching action updates their active \`tenant_id\` cookie context.
- **Isolation Checks**: Every backend server function reads the caller's active \`tenant_id\` from the session and appends it as a condition (e.g. \`WHERE tenant_id = ?\`) on all database operations. This prevents IDOR (Insecure Direct Object Reference) vulnerabilities.
`,

  // ─── 05-society-lifecycle.md ──────────────────────────────────────────────
  '05-society-lifecycle.md': `# Society Lifecycle

A society (Tenant) progresses through several phases on the platform:

\`\`\`mermaid
graph TD
    A[Onboarding / Registration] --> B[Active Phase]
    B --> C[Suspended / Inactive]
    C --> B
    B --> D[Deactivated / Offboarded]
\`\`\`

## 1. Onboarding / Registration
- Super Admin inputs basic details (Society Name, Slug, Plan Type: Basic, Standard, Enterprise).
- Active module keys are provisioned into the \`tenant_modules\` registry table.
- A default \`society_admin\` profile is provisioned.

## 2. Active Phase
- Society Admin builds the property tree (Blocks, Buildings, Units).
- Residents are onboarded, billing cycles are run, security terminals activate.

## 3. Suspended / Inactive
- Occurs due to payment defaults or administrative locks.
- Logins are disabled, page routes display an "Account Inactive" barrier.

## 4. Deactivated / Offboarded
- Society metadata remains for audit history, but active states are set to \`FALSE\`.
`,

  // ─── 06-property-hierarchy.md ─────────────────────────────────────────────
  '06-property-hierarchy.md': `# Property Hierarchy Validation

The platform models physical infrastructure using a structured parent-child hierarchy to ensure data integrity:

\`\`\`
Society (Tenant)
  └── Block (Phase 1, Block A)
        └── Building (Tower A, Building C)
              └── Floor (Ground Floor, 1st Floor)
                    └── Unit (Apt 101, Villa 5)
\`\`\`

## Validation Rules
- **Parent Isolation**: A Block must belong to the active \`society_id\` and \`tenant_id\`.
- **No Orphan Units**: A Unit cannot exist without being mapped to a Floor, Building, and Block.
- **Duplicate Prevention**: Unit numbers must be unique within their respective building context.
- **Cascading Constraints**: Deleting a block will trigger database checks to ensure all child buildings, floors, and units are either safe-removed or reassigned, preventing dangling pointers.
`,

  // ─── 07-module-catalog.md ─────────────────────────────────────────────────
  '07-module-catalog.md': `# Module Catalog

The application features a modular system structure where modules can be toggled on/off for each tenant.

| Module Key | Friendly Name | Primary Table | UI Route | Backend API |
|---|---|---|---|---|
| \`platform\` | Super Admin Panel | \`tenants\` | \`/platform\` | \`platform.ts\` |
| \`property\` | Property Management | \`units\`, \`blocks\` | \`/property\` | \`property.ts\` |
| \`residents\` | Resident Profiles | \`residents\` | \`/residents\` | \`residents.ts\` |
| \`ledger\` | Ledger & Bills | \`ledger_entries\` | \`/ledger\` | \`ledger.ts\` |
| \`payments\` | Payment Registry | \`payments\` | \`/payments\` | \`payments.ts\` |
| \`complaints\` | Complaint Tracker | \`complaints\` | \`/complaints\` | \`complaints.ts\` |
| \`visitor\` | Gate Security | \`visitor_passes\` | \`/visitor\` | \`visitor.ts\` |
| \`parking\` | Parking Spaces | \`parking_slots\` | \`/parking\` | \`parking.ts\` |
| \`utility_meters\` | Sub-meter Readings | \`meter_readings\` | \`/utility-meters\` | \`utility-meters.ts\` |
| \`notice_board\` | Announcements | \`notices\` | \`/notices\` | \`notices.ts\` |
| \`community_forum\`| Forum board | \`forum_threads\` | \`/forum\` | \`community.ts\` |
| \`polls\` | Surveys / Voting | \`polls\` | \`/polls\` | \`community.ts\` |
| \`events\` | Events Manager | \`events\` | \`/events\` | \`community.ts\` |
| \`amenities\` | Resource Bookings | \`amenity_bookings\` | \`/amenities\` | \`community.ts\` |
| \`documents\` | Legal Documents | \`documents\` | \`/documents\` | \`documents.ts\` |
| \`vendors\` | Vendors Directory | \`vendors\` | \`/vendors\` | \`vendors.ts\` |
| \`inventory\` | Inventory Stock | \`inventory_items\` | \`/inventory\` | \`inventory.ts\` |
| \`projects\` | Capital Projects | \`projects\` | \`/projects\` | \`projects.ts\` |
`,

  // ─── 08-user-management.md ────────────────────────────────────────────────
  '08-user-management.md': `# User Management

User management controls who can access the portal and what data they can interact with.

## User Creation Flow
1. **Request**: Admin submits details via the User Form.
2. **Server Function**: Calls \`createTenantUserFn\`.
3. **Database Checks**:
   - Verifies if the email already exists in the global \`users\` table.
   - If yes, assigns the existing user profile a role inside the current \`tenant_id\` (allowing cross-society accounts).
   - If no, hashes a default password and inserts a new row in \`users\`.
4. **Profile Linking**: Adds a record in \`profiles\` linked to the active \`tenant_id\`.
5. **Roles Allocation**: Maps the user to their designated roles in \`user_roles\`.

## Account Deactivation
Deactivating a user marks their role assignments as inactive but retains their profile data to preserve audit trail integrity on old financial ledger transactions.
`,

  // ─── 09-resident-management.md ────────────────────────────────────────────
  '09-resident-management.md': `# Resident Management

Resident Management handles the occupants living inside the society units.

## Onboarding Residents
- Residents are linked to specific unit records in the \`residents\` table.
- They are classified as either:
  - **Owner**: Holds legal ownership of the property unit.
  - **Tenant**: Rents the property unit from the owner.
- An occupant's vehicle plates are mapped in the \`resident_vehicles\` table to allow automated matching in the gate security logs.

## Move-Out Workflow
1. User requests a move-out check.
2. System checks the ledger to verify that the unit's balance is zero.
3. Once approved, the \`is_current\` flag on the \`residents\` link is set to \`FALSE\`.
4. The unit status in \`units\` is set back to \`vacant\`.
`,

  // ─── 10-billing-and-ledger.md ─────────────────────────────────────────────
  '10-billing-and-ledger.md': `# Billing and Ledger Management

This module acts as the financial core of the society, handling invoices, charges, and resident statements.

## Core Financial Entities
- **Charge Heads (\`charge_heads\`)**: Defined monthly or periodic fees (e.g. "Maintenance Fee", "Security Charges").
- **Ledger Entries (\`ledger_entries\`)**: Double-entry ledger logs. A \`type = 'charge'\` increases the outstanding balance of a unit, while a \`type = 'payment'\` decreases it.
- **Resident Wallet (\`wallets\`)**: A virtual account for each unit storing overpayments and advance balances.

## Recurring Billing Process
1. Finance Head triggers the monthly billing process.
2. The server iterates over all occupied units.
3. For each active charge head, a transaction is written to the ledger, and the unit's current outstanding balance is updated.
4. Notifications are sent automatically to residents.
`,

  // ─── 11-payments.md ───────────────────────────────────────────────────────
  '11-payments.md': `# Payment Gateway and Records

Handles payment collection from residents and record management.

## Supported Channels
1. **Manual Payments**: Cash, Cheques, or direct Bank Transfers recorded by the Finance Head.
2. **Stripe Integration (Planned)**: Secure card checkouts (currently stubbed via mock components in frontend).

## Payment Reconciliation Flow
- When a payment is recorded:
  - An entry is inserted into \`payments\`.
  - A corresponding credit (\`type = 'payment'\`) is recorded in the ledger.
  - If the payment amount exceeds the outstanding balance, the surplus is automatically added to the unit's wallet balance.
  - Receipts are generated with a unique transaction reference identifier.
`,

  // ─── 12-complaints.md ─────────────────────────────────────────────────────
  '12-complaints.md': `# Complaints Management

Allows residents to log complaints, and managers to coordinate resolution workflows.

## Complaint Lifecycle
\`\`\`
[Open] ──> [Assigned] ──> [In Progress] ──> [Resolved] ──> [Closed]
\`\`\`

## Key Workflows
- **Raise Complaint**: Residents fill out a form specifying category (lift, plumbing, electrical, security), priority (low, medium, high, critical), description, and attachment.
- **Assign Technician**: Admin updates status to \`assigned\` and selects a technician profile.
- **Comments Thread**: Both residents and admins can post comments to update progress.
- **Resolution Verification**: The resident has the authority to verify the work and mark the ticket as officially \`closed\`.
`,

  // ─── 13-maintenance.md ────────────────────────────────────────────────────
  '13-maintenance.md': `# Maintenance and Work Orders

Manages preventative maintenance and reactive infrastructure repairs.

## Preventative Maintenance Schedules
- Admins configure routine check-ups on critical machines (e.g., generator oil change every 3 months).
- The system automatically generates work orders when a scheduled date arrives.

## Work Order Fields
- **Technician**: User profile mapped to the work order.
- **Linked Asset**: The machine or facility being repaired.
- **Priority**: Urgency scale matching SLA requirements.
- **Cost**: Tracked parts and labor expenses.
`,

  // ─── 14-assets.md ─────────────────────────────────────────────────────────
  '14-assets.md': `# Asset Registry

Maintains a record of all physical infrastructure assets owned by the society.

## Asset Schema
- **Name**: e.g., Generator DG-1, Lift B2.
- **Location**: Specific block/building location mapping.
- **Serial Number**: For warranty verification.
- **Warranty Expiry**: Date parameter trigger.
- **Status**: \`operational\`, \`under_maintenance\`, \`decommissioned\`.

## Maintenance Linking
Assets are directly linked to work orders, building a complete service history for each physical item.
`,

  // ─── 15-visitors-and-gate-security.md ─────────────────────────────────────
  '15-visitors-and-gate-security.md': `# Visitors and Gate Security

Secures society boundary entries and logs non-resident vehicles/visitors.

## Pass Types
1. **Pre-Registered Passes**: Residents create a visitor profile, generate a unique pass code, and share it.
2. **Ad-hoc Gate Entry**: Guard manually registers name, CNIC, phone number, vehicle plate, and destination unit.

## Security Controls
- **Blacklist Matches**: Any entry attempt matching a blacklisted vehicle plate or visitor name triggers a visual guard alert dashboard warning.
- **Automatic Status Updates**: Passes are validated at entry terminals, updating status to \`checked_in\` and then \`checked_out\` when leaving.
`,

  // ─── 16-parking.md ────────────────────────────────────────────────────────
  '16-parking.md': `# Parking Management

Tracks parking allocations to residents and prevents unauthorized vehicle usage.

## Slot Management
- Slots are configured by Type (Car, Bike, Guest) and Location.
- Mapped to units via \`parking_allocations\`.

## Privacy Guidelines
- To maintain security, vehicle license plate numbers and owner mapping are masked on public tenant dashboards, only fully visible to Gated Security Guards and Admins.
`,

  // ─── 17-utility-meters.md ─────────────────────────────────────────────────
  '17-utility-meters.md': `# Utility Meters

Handles sub-meter management for gas, water, and electricity consumption.

## Configuration
- **Meter Rates**: Set per unit type (domestic/commercial) and utility type.
- **Readings Log**: Records monthly values: \`previous_reading\`, \`current_reading\`, and calculates consumed units.

## Billing Generation
Once a monthly reading is saved, the system computes the amount using the active rate table and pushes a debit item directly to the unit's ledger statement.
`,

  // ─── 18-vendors.md ────────────────────────────────────────────────────────
  '18-vendors.md': `# Vendor Management

Tracks third-party contractors, suppliers, and procurement histories.

## Procurement Flow
1. **Request for Quotation (RFQ)**: Admin outlines requirements and distributes to registered vendors.
2. **Quotations Submission**: Vendor bids are uploaded and compared side-by-side.
3. **Purchase Order (PO)**: Approved quotation triggers a PO creation.
4. **Invoices**: Vendors submit invoices upon completion, matching ledger expense approvals.
`,

  // ─── 19-inventory.md ──────────────────────────────────────────────────────
  '19-inventory.md': `# Inventory Stock Management

Tracks tools, spare parts, and office materials needed for society operations.

## Stock Movements
- Items are cataloged with fields: \`sku\`, \`name\`, \`category\`, \`stock_level\`.
- Any material usage on a work order registers a \`stock_out\` type movement.
- Deliveries from vendors register a \`stock_in\` type movement.
- Automatic alerts trigger when stock levels fall below specified minimum thresholds.
`,

  // ─── 20-project-management.md ─────────────────────────────────────────────
  '20-project-management.md': `# Project Management

Manages long-term capital improvement projects (e.g., building repaint, solar panel installations).

## Structure
- **Project Milestones**: Breakdown of targets, dates, and completion status.
- **Expense Logging**: Linked directly to ledger payouts, ensuring all project payments are tracked.
- **Contractor Mapping**: Assigned vendor profile mappings.
`,

  // ─── 21-community-forum.md ────────────────────────────────────────────────
  '21-community-forum.md': `# Community Forum

A private discussion board where verified residents can discuss society matters.

## Controls
- **Access Limits**: Only accounts with active resident profiles within the tenant can view and write to threads.
- **Moderation**: Society Admins have authority to pin threads, lock comments, and delete inappropriate content.
`,

  // ─── 22-polls-and-voting.md ───────────────────────────────────────────────
  '22-polls-and-voting.md': `# Polls and Voting

Conducts society-wide surveys and binding voting resolutions.

## Structure
- **Question Details**: Question text, options list (JSON representation).
- **Time Limits**: Set active start and end dates.
- **Validation**: System enforces single-vote constraints by checking the unique user identifier against the \`poll_votes\` table.
- **Anonymous Option**: Voting can be configured as anonymous to protect privacy.
`,

  // ─── 23-events.md ─────────────────────────────────────────────────────────
  '23-events.md': `# Events Calendar

Manages community festivals, administrative meetings, and holiday celebrations.

## Core Features
- **Schedules**: Location details, starts_at, ends_at.
- **RSVP Tracking**: Residents confirm attendance and note guest counts, allowing administrators to plan refreshments and security logistics.
`,

  // ─── 24-amenities-booking.md ──────────────────────────────────────────────
  '24-amenities-booking.md': `# Amenities Booking

Manages reservations for shared society assets (e.g., Gated Park, Community Hall, Swimming Pool).

## Collision Prevention Logic
- When a resident requests a booking, the system checks for existing overlapping timeslots in \`amenity_bookings\`.
- Bookings are held in a \`pending\` state until deposit/payments are cleared, then updated to \`approved\`.
`,

  // ─── 25-notice-board.md ───────────────────────────────────────────────────
  '25-notice-board.md': `# Notice Board

Official bulletin board for management announcements.

## Notice Features
- **Target Audience**: Notices can be general or targeted (e.g., only for Block A).
- **Pining**: High priority notices stay pinned to the top of dashboards.
- **Read Receipts**: Tracks notice views in \`notice_reads\` to verify distribution metrics.
`,

  // ─── 26-documents.md ──────────────────────────────────────────────────────
  '26-documents.md': `# Document Repository

A secure file repository for society blueprints, NOCs, and meeting minutes.

## Security Policies
- **Extension Blockade**: The server strictly rejects executable file uploads (e.g. \`.exe\`, \`.bat\`, \`.js\`) by inspecting both file names and mime-types.
- **Size Caps**: File uploads are limited to 10MB per file.
- **Role Isolation**: Sensitive files (like financial audits) are restricted to admin roles.
`,

  // ─── 27-security-architecture.md ──────────────────────────────────────────
  '27-security-architecture.md': `# Security Architecture

AT-BMS maintains a defense-in-depth approach to protect multi-tenant integrity.

## Protection Pillars
1. **Authentication Gateways**: All routes inspect active HttpOnly sessions.
2. **Server Function Validation**: Server functions enforce permission levels using custom check wrappers (\`requirePermission\`).
3. **IDOR Mitigation**: Queries consistently match keys against the user's validated \`tenant_id\` context instead of relying on client-supplied parameters.
`,

  // ─── 28-tenant-isolation.md ───────────────────────────────────────────────
  '28-tenant-isolation.md': `# Tenant Data Isolation

Data isolation is enforced strictly at the database query level.

## Logical Isolation Patterns
- Standard tables include a \`tenant_id\` column.
- Backend server query examples:
  \`\`\`sql
  SELECT * FROM complaints WHERE id = ? AND tenant_id = ?;
  \`\`\`
- This ensures that even if a resident attempts to access another society's complaint ID, the database query returns empty results, preventing unauthorized cross-society access.
`,

  // ─── 29-database-architecture.md ──────────────────────────────────────────
  '29-database-architecture.md': `# Database Architecture

MySQL is the underlying storage database engine.

## Database Configurations
- **Storage Engine**: InnoDB for transactional integrity, foreign key support, and row-level locking.
- **Foreign Key Constraints**: Standard cascading rules are used (\`ON DELETE RESTRICT\` on core tables like users and tenants to prevent accidental data loss).
- **Indexing Strategy**: Indexes are created on frequent search keys (e.g., \`tenant_id\`, \`email\`, \`unit_id\`) to maintain fast query times.
`,

  // ─── 30-database-table-catalog.md ─────────────────────────────────────────
  '30-database-table-catalog.md': `# Database Table Catalog

Exhaustive details of the core database schema tables.

## 1. Core Users and Profiles
- \`users\` (id, email, password_hash)
- \`profiles\` (id, full_name, society_name, phone, tenant_id)
- \`user_roles\` (id, user_id, role)

## 2. Properties
- \`tenants\` (id, name, slug, plan)
- \`societies\` (id, tenant_id, name)
- \`blocks\` (id, society_id, tenant_id, name)
- \`units\` (id, society_id, block_id, tenant_id, unit_number, status)

## 3. Financials
- \`charge_heads\` (id, tenant_id, name, default_amount)
- \`ledger_entries\` (id, tenant_id, unit_id, type, amount, balance_after)
- \`payments\` (id, tenant_id, unit_id, amount, payment_date)
`,

  // ─── 31-api-catalog.md ────────────────────────────────────────────────────
  '31-api-catalog.md': `# API Server Functions Catalog

The application uses TanStack Start server functions, which are mapped to Vinxi endpoints.

## Auth & Permissions
- \`getMyPermissionsFn\`: Returns permissions for the current user session.
- \`getScopingSessionFn\`: Returns active tenant and user session details.

## Property & Units
- \`updateUnitStatusFn\`: Updates property occupied/vacant states.
- \`updateSocietyFn\`: Modifies basic society registry fields.

## Financials
- \`recordPaymentFn\`: Saves payment logs and creates ledger adjustments.
- \`runMonthlyChargesFn\`: Batch processes charge generation for occupied units.
`,

  // ─── 32-authentication-and-sessions.md ────────────────────────────────────
  '32-authentication-and-sessions.md': `# Authentication and Sessions

Authentication uses HttpOnly cookies to protect session tokens against cross-site scripting (XSS) attacks.

## Session Lifecycle
1. **Login**: User enters credentials, checked against hashed values via \`scrypt\`.
2. **Session Generation**: A unique token is written to the \`sessions\` database table.
3. **Cookie Set**: The token is written to a cookie set with properties: \`Secure\`, \`HttpOnly\`, \`SameSite=Lax\`.
4. **Validation**: Every page load validates the session status against the database.
5. **Logout**: Deletes the database row and clears the cookie.
`,

  // ─── 33-rbac-permissions.md ───────────────────────────────────────────────
  '33-rbac-permissions.md': `# Dynamic RBAC Merging

Permissions are dynamically computed by checking custom overrides.

## The Merging Algorithm
- A user can have multiple role assignments.
- During access checks, the system:
  1. Fetches static system defaults for assigned roles.
  2. Queries the \`role_permissions\` overrides table.
  3. Merges settings using an OR logic (if any single role allows access, the user is granted access).
- In-page checks use the custom react hook \`usePermissions()\` and the wrapper component \`PermissionGate\` for conditional rendering.
`,

  // ─── 34-module-activation.md ──────────────────────────────────────────────
  '34-module-activation.md': `# Module Activation Gates

Modules are enabled or disabled per tenant to support tiered SaaS subscriptions.

## Activation Gates
- Database state is maintained in \`tenant_modules\`.
- The frontend wraps active pages inside a \`ModuleGate\` component.
- The gate queries the active modules list, redirecting users to an "Access Denied" page if a module is disabled for their society.
- Backend server functions verify module states before completing database executions.
`,

  // ─── 35-audit-logging.md ──────────────────────────────────────────────────
  '35-audit-logging.md': `# Audit Logging

The platform keeps track of administrative actions for security audits.

## Logged Parameters
- **Timestamp**: Exact UTC time parameter.
- **User**: The ID of the admin who triggered the action.
- **Module**: The associated feature module key.
- **Action**: Description of the changes made (e.g. "Changed monthly maintenance fee amount").
- **IP Address**: Client request IP context.
`,

  // ─── 36-frontend-navigation.md ────────────────────────────────────────────
  '36-frontend-navigation.md': `# Frontend Navigation Filtering

The sidebar and main dashboard navigation items dynamically filter out based on permissions.

## Sidebar Filter Logic
- Navigation arrays map to feature module keys.
- On render, the sidebar matches entries against the user's permissions:
  - If a user has no view permission for a module, the sidebar hides the link.
  - If the module is deactivated in the society settings, the route is completely omitted from the navigation menu.
`,

  // ─── 37-forms-catalog.md ──────────────────────────────────────────────────
  '37-forms-catalog.md': `# Dynamic Forms Catalog

AT-BMS uses a dynamic JSON metadata structure to render administrative forms.

## Form Renderer Configurations
- Form schemas define:
  - Fields (input, select, textarea, date).
  - Validation rules (required, min/max limits, regex parameters).
- This structure allows admins to add custom fields to forms (such as visitor check-in fields) without modifying backend database schemas.
`,

  // ─── 38-testing-and-qa.md ─────────────────────────────────────────────────
  '38-testing-and-qa.md': `# Testing and QA Strategy

Our Quality Assurance strategy focuses on validating data boundaries and RBAC rules.

## Core Testing Scenarios
1. **Multi-Tenancy Segregation**: Verify that Society A users cannot access Society B database objects.
2. **Access Control Overrides**: Verify that updating a role's permissions immediately hides/reveals action buttons in the UI.
3. **Billing Edge Cases**: Verify correct wallet deductions and invoice adjustments for overpayments.
`,

  // ─── 39-browser-testing-checklist.md ──────────────────────────────────────
  '39-browser-testing-checklist.md': `# Browser Testing Checklist

A manual checklist for validating portal components:

- [ ] **Auth Check**: Login, session persistency, and logout flows.
- [ ] **Society Switcher**: Verify that updating active society correctly updates routes and displays matching data.
- [ ] **RBAC Restrictions**: Log in as a Gated Guard and verify that financial routes show access denied screens.
- [ ] **Complaints Flow**: Raise a ticket, verify technician assignment, add comment threads, and close the ticket.
- [ ] **Billing Audit**: Run monthly charges, record a payment transaction, verify ledger balance updates.
`,

  // ─── 40-known-issues-and-gaps.md ──────────────────────────────────────────
  '40-known-issues-and-gaps.md': `# Known Issues and Gaps

The following features are partially implemented or planned for future releases:

1. **Stripe Payment Gateway**: Stubs exist in the UI routes, but the backend API integration is mock-only.
2. **AI Maintenance Predictions**: The module exists but uses placeholder analysis results. Full integration with ML predictions is planned.
3. **SMS Notification Gateways**: SMS alert configurations are defined, but the driver integrations are mock-only.
`,

  // ─── 41-implementation-history.md ─────────────────────────────────────────
  '41-implementation-history.md': `# Implementation History

Summary of development phases:

- **Phase 1**: Database setup, property tree modeling, and auth credentials.
- **Phase 2**: Billing statements, ledger tables, and payments logging.
- **Phase 3**: Complaints module and preventative maintenance work orders.
- **Phase 4**: Gate terminal scanning, pre-registered passes, and blacklist alert modules.
- **Phase 5**: Dynamic RBAC permissions integration, sidebar navigation filters, and document upload security constraints.
`,

  // ─── 42-deployment-and-environment.md ─────────────────────────────────────
  '42-deployment-and-environment.md': `# Deployment and Environment

Deployment directives for production and staging setups.

## Environment Variables
- \`DATABASE_URL\`: Primary MySQL connection URL parameters.
- \`SESSION_SECRET\`: Session signing token.
- \`PORT\`: Application listener port (default 3000).

## Docker Setup
- \`docker-compose.yml\` is included to run both MySQL and Vinxi web processes in isolated network containers.
`,

  // ─── 43-developer-setup.md ────────────────────────────────────────────────
  '43-developer-setup.md': `# Developer Setup Guide

Step-by-step instructions to get the development environment running locally:

1. **Clone & Install**:
   \`\`\`bash
   bun install
   \`\`\`
2. **Configure Database**:
   Set up your \`.env\` credentials matching your local MySQL server.
3. **Seed Database**:
   \`\`\`bash
   bun run db:seed
   \`\`\`
4. **Start Dev Server**:
   \`\`\`bash
   bun run dev
   \`\`\`
`,

  // ─── 44-troubleshooting.md ────────────────────────────────────────────────
  '44-troubleshooting.md': `# Troubleshooting Common Errors

Solutions to common local environment issues:

### 1. Database Connection Refused
- **Fix**: Check if your MySQL server is running on port 3306. Check your \`.env\` parameters.

### 2. Permissions Cache Stale
- **Fix**: The client permissions hook caches database settings for 5 minutes. Trigger a browser hard refresh (\`Ctrl + Shift + R\`) to clear the active cache state.

### 3. Upload File Rejected
- **Fix**: Verify file format extensions. The system automatically blocks executable scripts (\`.exe\`, \`.bat\`).
`,

  // ─── 45-final-project-status.md ───────────────────────────────────────────
  '45-final-project-status.md': `# Final Project Status Scorecard

Current status of system features:

| Feature Area | Status | Verification Check |
|---|---|---|
| Tenant Isolation | ✅ 100% | Enforced on all DB server queries |
| Dynamic Permissions | ✅ 100% | Verified via PermissionGate checks |
| Billing & Ledger | ✅ 100% | Statements calculate balance updates |
| Gate Security | ✅ 100% | Passes match blacklist entries |
| Stripe Checkout | ⚠️ Mock Only | Pending API keys integrations |
| AI Predictions | ⚠️ Mock Only | Pending ML service connection |
`
};

console.log('[GEN-DOCS] Starting documentation update...');

let updatedCount = 0;
Object.entries(files).forEach(([filename, content]) => {
  const filePath = path.join(DOCS_DIR, filename);
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[GEN-DOCS] Successfully wrote: ${filename}`);
    updatedCount++;
  } catch (err) {
    console.error(`[GEN-DOCS] Failed to write ${filename}:`, err);
  }
});

console.log(`[GEN-DOCS] Finished! Updated ${updatedCount} files.`);
