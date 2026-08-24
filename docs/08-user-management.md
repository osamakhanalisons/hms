# User Management

User management controls who can access the portal and what data they can interact with.

## User Creation Flow
1. **Request**: Admin submits details via the User Form.
2. **Server Function**: Calls `createTenantUserFn`.
3. **Database Checks**:
   - Verifies if the email already exists in the global `users` table.
   - If yes, assigns the existing user profile a role inside the current `tenant_id` (allowing cross-society accounts).
   - If no, hashes a default password and inserts a new row in `users`.
4. **Profile Linking**: Adds a record in `profiles` linked to the active `tenant_id`.
5. **Roles Allocation**: Maps the user to their designated roles in `user_roles`.

## Account Deactivation
Deactivating a user marks their role assignments as inactive but retains their profile data to preserve audit trail integrity on old financial ledger transactions.
