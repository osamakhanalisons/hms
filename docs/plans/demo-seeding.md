# HousingOS Demo Seeding System

> **DEMO DATA ONLY** — This dataset is entirely fictional and intended solely for
> application demonstration purposes. It is NOT an official registry of Askari
> housing communities in Pakistan. All resident names, CNICs, phone numbers,
> emails, payment references, and security data are fabricated.

---

## Quick Start

```bash
# Reset existing demo data, then reseed from scratch:
npm run seed:demo

# Reset/delete demo data only (no reseed):
npm run seed:demo:reset
```

Both commands require the MySQL connection environment variables:
```bash
$env:MYSQL_PORT="3308"
$env:MYSQL_PASSWORD="root123"
```

The seeder also auto-loads from `.env` in the project root.

---

## How It Works

The seeder script [`scripts/seed-demo.ts`](../scripts/seed-demo.ts) runs in 3 mandatory phases before seeding:

### Phase 1 — Audit
Before any deletion, the script audits the database and reports current counts of all demo-anchored records. **It never deletes before reporting.**

### Phase 2 — Safe Reset
Deletes only records anchored to:
- The 5 deterministic demo tenant UUIDs (see table below)
- Emails matching `%@demo.housingos.local`

**It never uses `DROP TABLE`, `TRUNCATE`, or touches non-demo data.**

Deletion follows FK dependency order (most-dependent tables first, tenants last).

### Phase 3 — Verify Clean State
After reset, runs `SELECT COUNT(*)` checks on all key tables. Only proceeds to seeding if every count is `0`. Reports:
- `✅ DEMO CLEANUP: PASS` — safe to reseed
- `❌ DEMO CLEANUP: FAILED` — aborts, prevents data corruption

---

## Demo Accounts

> **Password for all demo accounts: `Demo@12345`**

| Role | Email | Scope |
|------|-------|-------|
| **Super Admin** | `superadmin@demo.housingos.local` | Platform-wide |
| **Admin Alpha** | `admin.alpha@demo.housingos.local` | Askari 11 Lahore + Askari 10 Lahore |
| **Admin Beta** | `admin.beta@demo.housingos.local` | Askari 5 Karachi only |
| **Admin Gamma** | `admin.gamma@demo.housingos.local` | Askari 4 Karachi + Askari Rawalpindi |
| **Resident** | `resident.askari-11-lahore.001@demo.housingos.local` | Askari 11 Lahore |
| **Guard** | `guard.askari-11-lahore@demo.housingos.local` | Askari 11 Lahore |
| **Technician** | `technician.askari-11-lahore@demo.housingos.local` | Askari 11 Lahore |
| **Finance** | `finance.askari-11-lahore@demo.housingos.local` | Askari 11 Lahore |

Similar staff accounts exist per society (replace `askari-11-lahore` with the society slug).

---

## Society List

All names are publicly referenced Askari communities. DEMO layouts beneath them are fictional.

| # | Name | Tenant UUID | Plan | Layout |
|---|------|------------|------|--------|
| 1 | **Askari 11 Lahore Demo** | `de011000-0011-...` | enterprise | Apartments + Houses + Villas |
| 2 | **Askari 10 Lahore Demo** | `de010000-0010-...` | professional | Apartments only |
| 3 | **Askari 5 Karachi Demo** | `de005000-0005-...` | enterprise | Apartments + Houses + Villas |
| 4 | **Askari 4 Karachi Demo** | `de004000-0004-...` | growth | Apartments only |
| 5 | **Askari Rawalpindi Demo** | `de009000-0009-...` | growth | Apartments + Houses (heavy) |

---

## Property Hierarchy (per society)

```
Society
├── Apartment Area
│   ├── Block A
│   │   └── Building A-1
│   │       ├── Floor 1  →  A-101, A-102, A-103
│   │       ├── Floor 2  →  A-201, A-202, A-203
│   │       └── Floor 3  →  A-301, A-302, A-303
│   └── Block B
│       └── Building B-1
│           ├── Floor 1  →  B-101, B-102, B-103
│           ├── Floor 2  →  B-201, B-202, B-203
│           └── Floor 3  →  B-301, B-302, B-303
└── House / Villa Area        (layout-dependent)
    ├── H-01, H-02, H-03     (houses)
    └── V-01, V-02            (villas, where applicable)
```

---

## Seeded Modules

The following modules are activated for all 5 demo tenants:

`platform`, `property`, `residents`, `notifications`, `documents`, `reports`,
`ledger`, `payments`, `financial_transparency`, `budget`, `complaints`,
`maintenance`, `inventory`, `vendors`, `assets`, `visitor`, `gate`, `parking`,
`notice_board`, `community_forum`, `polls`, `events`, `amenities`, `governance`,
`utility_meters`

---

## Expected Record Counts (per society)

| Entity | Count |
|--------|-------|
| Units | 18–24 (varies by layout) |
| Residents | 15 |
| Vehicles | 15 |
| Parking slots | 18–20 |
| Parking allocations | 15 |
| Charge heads | 6 |
| Ledger entries | ~45–60 |
| Payments | ~8 |
| Complaints | 7 |
| Vendors | 5 |
| Assets | 7 |
| Work orders | 6 |
| Inventory items | 6 |
| Visitor passes | 6 |
| Domestic staff | 5 |
| Gate terminals | 2 |
| Entry/exit logs | 8–12 |
| Polls | 2–3 |
| Events | 3 |
| Amenities | 4 |
| Notices | 5 |
| Forum threads | 3 |
| Governance meetings | 1 |
| Budgets | 1 |

**Total across 5 societies:**

| Entity | Total |
|--------|-------|
| Societies | 5 |
| Demo users | ~104 |
| Units | ~106 |
| Residents | 75 |
| Ledger entries | ~305 |
| Payments | ~40 |
| Complaints | 35 |
| Visitor passes | 30 |
| Domestic staff | 25 |
| Assets | 35 |
| Work orders | 30 |
| Inventory items | 30 |
| Parking slots | 90 |
| Parking allocations | 75 |
| Vendors | 25 |
| Polls | 15 |
| Events | 20 |
| Amenities | 40 |
| Notices | 25 |
| Forum threads | 15 |
| Entry/exit logs | ~70 |

---

## Billing Scenarios (per unit)

The seeder creates 4 recurring billing patterns across units:

| Pattern | Charges | Payment | Outstanding |
|---------|---------|---------|-------------|
| `paid` | PKR 9,800 | PKR 9,800 | PKR 0 |
| `partial` | PKR 7,300 | PKR 4,380 | PKR 2,920 |
| `unpaid` | PKR 9,800 | PKR 0 | PKR 9,800 |
| `overdue` | PKR 9,800 | PKR 0 | PKR 9,800 |

Payment methods cycle through: `cash`, `bank_transfer`, `cheque`, `online`.

Receipt numbers follow the pattern: `REC-DEMO-{SOCIETYCODE}-{SEQUENCE}` (globally unique).

---

## Integrity Checks

After seeding, the script automatically verifies:

1. ✅ No orphan units (society must exist)
2. ✅ No orphan residents (unit must exist)
3. ✅ No orphan ledger entries (unit must exist)
4. ✅ No orphan payments (unit must exist)
5. ✅ No orphan visitor passes (resident must exist)
6. ✅ No duplicate poll votes (`uniq_poll_user`)
7. ✅ No cross-tenant resident/unit mismatch
8. ✅ No orphan domestic staff (resident must exist)
9. ✅ No duplicate staff codes per tenant

---

## Tenant Isolation Design

- **Super Admin** (`superadmin@demo.housingos.local`): no `tenant_id` binding; accesses all societies via the platform selector.
- **Admin Alpha**: mapped to Askari 11 + Askari 10 via `society_admin_tenants` pivot.
- **Admin Beta**: mapped to Askari 5 Karachi only.
- **Admin Gamma**: mapped to Askari 4 + Askari Rawalpindi.
- **Residents/Staff**: scoped to a single tenant; cannot access other societies' data.

All data is strictly tenant-scoped. The seeder never creates cross-tenant FK references.

---

## What Is Demo Data

The following identifiers are used to anchor all demo records for safe cleanup:

| Anchor | Value |
|--------|-------|
| Email domain | `@demo.housingos.local` |
| Tenant IDs | `de011000-...`, `de010000-...`, `de005000-...`, `de004000-...`, `de009000-...` |
| Vehicle plates | `DEMO-{SOCIETYCODE}-NNN` |
| Receipt numbers | `REC-DEMO-{SOCIETYCODE}-NNNN` |
| Staff codes | `DS-{SOCIETYCODE}-NNNNN` |
| Visitor codes | `VP-{SOCIETYCODE}-NNNN` |
| SKU codes | `INV-{SOCIETYCODE}-*` |

---

## Build & TypeScript Status

- **`npm run build`**: ✅ Exit code 0 (no new errors introduced by seeder)
- **`npx tsc --noEmit`**: Pre-existing type errors in application routes are unrelated to the seeder script. The seeder itself is type-safe.

---

## Client Demo Flow

```
1. Login: superadmin@demo.housingos.local / Demo@12345
   → Platform dashboard → All Societies view

2. Select: Askari 11 Lahore Demo
   → Property (Block A + Block B + Houses + Villas)
   → Residents (15 residents, mixed owners/tenants)
   → Billing (4 payment pattern variants)
   → Payments (cash/bank/cheque/online)
   → Complaints (7 open/in-progress/resolved)
   → Maintenance (7 assets, 6 work orders)
   → Visitors (6 passes + entry/exit logs)
   → Domestic Staff (5 staff with gate logs)
   → Polls (community votes)
   → Events (AGM, Sports Day)
   → Amenities (Hall, Gym, Pool, Court)
   → Notices (5 society notices)
   → Forum (3 threads + replies)

3. Switch Society Selector → Askari 5 Karachi Demo
   → Verify completely different dataset

4. Logout → Login: admin.alpha@demo.housingos.local
   → Society selector shows: Askari 11 + Askari 10
   → Cannot access Askari 5 or other societies

5. Logout → Login: admin.beta@demo.housingos.local
   → Only Askari 5 Karachi accessible

6. Logout → Login: resident.askari-11-lahore.001@demo.housingos.local
   → My Unit, My Billing, My Visitors, My Domestic Staff
   → Community Polls, Events, Amenity bookings
```
