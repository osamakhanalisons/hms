# Module Activation Gates

Modules are enabled or disabled per tenant to support tiered SaaS subscriptions.

## Activation Gates
- Database state is maintained in `tenant_modules`.
- The frontend wraps active pages inside a `ModuleGate` component.
- The gate queries the active modules list, redirecting users to an "Access Denied" page if a module is disabled for their society.
- Backend server functions verify module states before completing database executions.
