# Security Architecture

AT-BMS maintains a defense-in-depth approach to protect multi-tenant integrity.

## Protection Pillars
1. **Authentication Gateways**: All routes inspect active HttpOnly sessions.
2. **Server Function Validation**: Server functions enforce permission levels using custom check wrappers (`requirePermission`).
3. **IDOR Mitigation**: Queries consistently match keys against the user's validated `tenant_id` context instead of relying on client-supplied parameters.
