# System Architecture

The AT-BMS application utilizes a modern, unified tech stack that combines the best of single-page apps (SPA) and server-side rendering (SSR).

## Frontend-Backend Integration via TanStack Start
- **Core Engine**: Vinxi runs the bundler, bundling both frontend assets and backend server functions.
- **Routing**: TanStack Router handles declarative, type-safe frontend routing. The file structure under `src/routes/` dynamically generates the client-side pages and paths.
- **Server Functions**: Instead of standard REST or GraphQL endpoints, we use TanStack Start server functions (`createServerFn`). These functions allow direct server-side calls (like database queries) to be imported and executed as simple async function calls in React.
- **Data Querying & Cache**: React Query (`@tanstack/react-query`) caches server responses, handles states (loading, error, success), and triggers mutations to keep the interface synchronized.

## Data Layer Architecture
- **Database Engine**: MySQL 8.x is the primary database, utilizing standard relationships and constraints.
- **Connection Pooling**: `mysql2/promise` maintains a connection pool, avoiding overhead on concurrent database operations.
- **Multi-Tenancy**: Scoped tables include a `tenant_id` field to enforce logical data segregation.
