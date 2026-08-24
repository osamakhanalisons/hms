# Tenant Data Isolation

Data isolation is enforced strictly at the database query level.

## Logical Isolation Patterns
- Standard tables include a `tenant_id` column.
- Backend server query examples:
  ```sql
  SELECT * FROM complaints WHERE id = ? AND tenant_id = ?;
  ```
- This ensures that even if a resident attempts to access another society's complaint ID, the database query returns empty results, preventing unauthorized cross-society access.
