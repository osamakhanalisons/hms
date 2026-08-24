# API Server Functions Catalog

This document indexes the primary server functions defined in the `src/lib/api/` codebase.

## 1. Authentication & Security
- `loginFn` (POST): Validates credentials, creates session record, and writes HttpOnly session cookie.
- `logoutFn` (POST): Destroys session row and clears client session cookie.
- `getScopingSessionFn` (GET): Resolves authenticated user profile, active roles, and scoped `tenant_id`.
- `getMyPermissionsFn` (GET): Reads user roles, custom role overrides, and merges permissions schema.
- `createTenantUserFn` (POST): Super admin/society admin creates user profiles and assigns role mappings.

## 2. Property Tree & Societies
- `listAllSocietiesFn` (POST): Lists registered societies for Switcher panels.
- `createSocietyWithAdminFn` (POST): Provisions new society records along with the initial admin credentials.
- `toggleSocietyStatusFn` (POST): Enforces administrative deactivation/lockouts.
- `updateSocietyFn` (POST): Modifies name and addresses metadata.
- `updateUnitStatusFn` (POST): Switches status state parameter of a unit (vacant/occupied/renovation/locked).

## 3. Financial Statements
- `getLedgerEntriesFn` (GET): Queries transactions logs for statement panels.
- `recordPaymentFn` (POST): Saves payment records and resolves ledger credits.
- `runMonthlyChargesFn` (POST): Executes batch routine billing.
- `createChargeHeadFn` (POST): Registers new billing fee definitions.

## 4. Gated Security
- `getVisitorPassesFn` (GET): Lists active passes.
- `createVisitorPassFn` (POST): Allows residents to register guest entries.
- `recordGatePassVerificationFn` (POST): Guards verify pass codes and log scans.
- `addBlacklistFn` (POST): Registers blocked plates in blacklist.
- `checkBlacklistFn` (POST): Matches scanner inputs against blocked lists.

## 5. Operations & Work Orders
- `getComplaintsFn` (GET): Queries tickets catalog.
- `createComplaintFn` (POST): Saves new complaint tickets.
- `updateComplaintStatusFn` (POST): Updates status states of complaints.
- `createWorkOrderFn` (POST): Assigns maintenance technician orders.
- `createAmenityBookingFn` (POST): Checks timeslot availability and books amenities.
- `voteInPollFn` (POST): Records resident choices in survey polls.
