# User Roles and Permissions Matrix

The platform implements a Role-Based Access Control (RBAC) system split into two levels: Platform Level and Tenant/Society Level.

| Role | Scope | Key Permissions |
|---|---|---|
| `super_admin` | Global | Full system access, society onboarding, global settings, log analysis. |
| `society_admin` | Tenant | Full control over the specific society (units, bills, resident user roles). |
| `resident` | Tenant (Unit) | View invoices, pay online, raise complaints, participate in polls and forum. |
| `tenant` | Tenant (Unit) | View bills, submit complaints, view forum (restricted compared to owner). |
| `guard` | Tenant (Gate) | Pre-registered visitor entry, exit log registration, blacklist alerts. |
| `technician` | Tenant (Maintenance) | Update assigned work orders, update inventory usage, resolve issues. |
| `finance_head` | Tenant (Finance) | View general ledger, trigger monthly maintenance charge heads, record payments. |

## Dynamic Roles
Custom roles can be created under the "Role Permissions" settings tab. These roles map to entries in the `custom_roles` and `role_permissions` tables, allowing fine-grained toggling of permissions (`can_view`, `can_create`, `can_edit`, `can_delete`) per module.
