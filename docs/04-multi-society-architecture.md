# Multi-Society Architecture

AT-BMS is designed as a SaaS platform where multiple independent societies coexist on the same software instance and database.

## Society Scoping & Isolation
- **Cookie Resolution**: When a user logs in, their session cookie containing their credentials and active `tenant_id` is validated.
- **Multi-Society Admin**: If a user is a `society_admin` for multiple societies, they are presented with a society switcher. The switching action updates their active `tenant_id` cookie context.
- **Isolation Checks**: Every backend server function reads the caller's active `tenant_id` from the session and appends it as a condition (e.g. `WHERE tenant_id = ?`) on all database operations. This prevents IDOR (Insecure Direct Object Reference) vulnerabilities.
