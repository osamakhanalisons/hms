# Module Catalog

The application features a modular system structure where modules can be toggled on/off for each tenant.

| Module Key | Friendly Name | Primary Table | UI Route | Backend API |
|---|---|---|---|---|
| `platform` | Super Admin Panel | `tenants` | `/platform` | `platform.ts` |
| `property` | Property Management | `units`, `blocks` | `/property` | `property.ts` |
| `residents` | Resident Profiles | `residents` | `/residents` | `residents.ts` |
| `ledger` | Ledger & Bills | `ledger_entries` | `/ledger` | `ledger.ts` |
| `payments` | Payment Registry | `payments` | `/payments` | `payments.ts` |
| `complaints` | Complaint Tracker | `complaints` | `/complaints` | `complaints.ts` |
| `visitor` | Gate Security | `visitor_passes` | `/visitor` | `visitor.ts` |
| `parking` | Parking Spaces | `parking_slots` | `/parking` | `parking.ts` |
| `utility_meters` | Sub-meter Readings | `meter_readings` | `/utility-meters` | `utility-meters.ts` |
| `notice_board` | Announcements | `notices` | `/notices` | `notices.ts` |
| `community_forum`| Forum board | `forum_threads` | `/forum` | `community.ts` |
| `polls` | Surveys / Voting | `polls` | `/polls` | `community.ts` |
| `events` | Events Manager | `events` | `/events` | `community.ts` |
| `amenities` | Resource Bookings | `amenity_bookings` | `/amenities` | `community.ts` |
| `documents` | Legal Documents | `documents` | `/documents` | `documents.ts` |
| `vendors` | Vendors Directory | `vendors` | `/vendors` | `vendors.ts` |
| `inventory` | Inventory Stock | `inventory_items` | `/inventory` | `inventory.ts` |
| `projects` | Capital Projects | `projects` | `/projects` | `projects.ts` |
