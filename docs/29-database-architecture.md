# Database Architecture

MySQL is the underlying storage database engine.

## Database Configurations
- **Storage Engine**: InnoDB for transactional integrity, foreign key support, and row-level locking.
- **Foreign Key Constraints**: Standard cascading rules are used (`ON DELETE RESTRICT` on core tables like users and tenants to prevent accidental data loss).
- **Indexing Strategy**: Indexes are created on frequent search keys (e.g., `tenant_id`, `email`, `unit_id`) to maintain fast query times.
