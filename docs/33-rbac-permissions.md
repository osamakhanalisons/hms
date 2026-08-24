# Dynamic RBAC Merging

Permissions are dynamically computed by checking custom overrides.

## The Merging Algorithm
- A user can have multiple role assignments.
- During access checks, the system:
  1. Fetches static system defaults for assigned roles.
  2. Queries the `role_permissions` overrides table.
  3. Merges settings using an OR logic (if any single role allows access, the user is granted access).
- In-page checks use the custom react hook `usePermissions()` and the wrapper component `PermissionGate` for conditional rendering.
