# Testing and QA Strategy

Our Quality Assurance strategy focuses on validating data boundaries and RBAC rules.

## Core Testing Scenarios
1. **Multi-Tenancy Segregation**: Verify that Society A users cannot access Society B database objects.
2. **Access Control Overrides**: Verify that updating a role's permissions immediately hides/reveals action buttons in the UI.
3. **Billing Edge Cases**: Verify correct wallet deductions and invoice adjustments for overpayments.
