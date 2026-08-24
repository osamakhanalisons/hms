# AT-BMS / HousingOS Complete Documentation Portal

Welcome to the HousingOS / AT-BMS documentation portal. This directory contains comprehensive documentation detailing the architecture, security mechanisms, database design, modules, and deployment setup for the Multi-Society Building Management System.

## Technology Stack
- **Core Framework**: React, TanStack Start (Vinxi-powered SSR / Server Functions)
- **Database**: MySQL 8.x
- **State Management**: TanStack Query (React Query)
- **Permissions**: Custom Role-Based Access Control (RBAC) with dynamic overrides
- **Styling**: Vanilla CSS / TailwindCSS CSS variables configuration

## Documentation Index

### Overview & Lifecycle
- [01-project-overview.md](01-project-overview.md) — Roman Urdu & technical descriptions of core domains.
- [02-system-architecture.md](02-system-architecture.md) — System flow, data layer, TanStack Start server functions.
- [03-user-roles-and-permissions.md](03-user-roles-and-permissions.md) — Platform vs Tenant roles matrix.
- [04-multi-society-architecture.md](04-multi-society-architecture.md) — Multi-society admin assignment and cookie resolution.
- [05-society-lifecycle.md](05-society-lifecycle.md) — Tenant onboarding, active cycles, deactivation.
- [06-property-hierarchy.md](06-property-hierarchy.md) — Society > Block > Building > Floor > Unit model validation.

### Feature & Module Documentation
- [07-module-catalog.md](07-module-catalog.md) — Table of all modules, databases, routes, and implementation status.
- [08-user-management.md](08-user-management.md) — Tenant-level user and role assignment flow.
- [09-resident-management.md](09-resident-management.md) — Onboarding, occupied vs vacant, vehicles, move-out.
- [10-billing-and-ledger.md](10-billing-and-ledger.md) — Invoicing, charge heads, ledger entries, wallets.
- [11-payments.md](11-payments.md) — Manual allocations and planned gateway integrations.
- [12-complaints.md](12-complaints.md) — Resident complaints and Kanban progress tracking.
- [13-maintenance.md](13-maintenance.md) — Work orders, preventative plans, technician scoping.
- [14-assets.md](14-assets.md) — Asset registry and preventative triggers.
- [15-visitors-and-gate-security.md](15-visitors-and-gate-security.md) — Pre-registered QR codes, gate entry checks, blacklist alerts.
- [16-parking.md](16-parking.md) — Slot configuration, tenant mappings, and masking privacy.
- [17-utility-meters.md](17-utility-meters.md) — Sub-meter readings and billing integrations.
- [18-vendors.md](18-vendors.md) — Registry, RFQs, purchase orders, invoices.
- [19-inventory.md](19-inventory.md) — Parts catalogs, stock movements.
- [20-project-management.md](20-project-management.md) — Long-term capital projects, milestones, expenses.
- [21-community-forum.md](21-community-forum.md) — Resident discussions.
- [22-polls-and-voting.md](22-polls-and-voting.md) — Society-wide voting and opinion polls.
- [23-events.md](23-events.md) — Calendar management and RSVP tracking.
- [24-amenities-booking.md](24-amenities-booking.md) — Resource bookings, slot collision prevention.
- [25-notice-board.md](25-notice-board.md) — Targeted announcements.
- [26-documents.md](26-documents.md) — Upload, storage, extension validation (.exe blockade).

### Architecture & Security Details
- [27-security-architecture.md](27-security-architecture.md) — IDOR, parent scoping validation, security controls.
- [28-tenant-isolation.md](28-tenant-isolation.md) — SQL scoping filters, session validations.
- [29-database-architecture.md](29-database-architecture.md) — Database design overview, integrity rules.
- [30-database-table-catalog.md](30-database-table-catalog.md) — Exhaustive schema catalog for all tables.
- [31-api-catalog.md](31-api-catalog.md) — Vinxi server functions endpoint mapping.
- [32-authentication-and-sessions.md](32-authentication-and-sessions.md) — HttpOnly cookie sessions, expiry rules.
- [33-rbac-permissions.md](33-rbac-permissions.md) — Dynamic database permissions merge.
- [34-module-activation.md](34-module-activation.md) — Tenant module gating mechanisms.
- [35-audit-logging.md](35-audit-logging.md) — Tracking security and change events.
- [36-frontend-navigation.md](36-frontend-navigation.md) — Role-specific sidebar routes.
- [37-forms-catalog.md](37-forms-catalog.md) — Built-in form renderer configurations.

### Operations & Maintenance
- [38-testing-and-qa.md](38-testing-and-qa.md) — Testing strategy.
- [39-browser-testing-checklist.md](39-browser-testing-checklist.md) — Step-by-step client validation checklist.
- [40-known-issues-and-gaps.md](40-known-issues-and-gaps.md) — Incomplete features, TODOs, TS errors audit.
- [41-implementation-history.md](41-implementation-history.md) — Development timeline.
- [42-deployment-and-environment.md](42-deployment-and-environment.md) — Setup requirements, ports, config variables.
- [43-developer-setup.md](43-developer-setup.md) — Running locally, seeders, compilers.
- [44-troubleshooting.md](44-troubleshooting.md) — Common runtime issues and solutions.
- [45-final-project-status.md](45-final-project-status.md) — Final scorecard.

## Where Should I Start?

### Developer
1. Go to [43-developer-setup.md](43-developer-setup.md) to set up your MySQL and TanStack Start dev environment.
2. Read [02-system-architecture.md](02-system-architecture.md) and [28-tenant-isolation.md](28-tenant-isolation.md) to understand how multi-tenancy is enforced.

### QA Tester
1. Check [38-testing-and-qa.md](38-testing-and-qa.md) to understand the testing landscape.
2. Walk through [39-browser-testing-checklist.md](39-browser-testing-checklist.md) to run manual test suites.

### Project Manager
1. Read [01-project-overview.md](01-project-overview.md) to align on core terms.
2. Inspect [45-final-project-status.md](45-final-project-status.md) to check what features are completed.

### Admin
1. Read [04-multi-society-architecture.md](04-multi-society-architecture.md) to see how tenant contexts function.
