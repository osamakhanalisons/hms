# Deployment and Environment

Deployment directives for production and staging setups.

## Environment Variables
- `DATABASE_URL`: Primary MySQL connection URL parameters.
- `SESSION_SECRET`: Session signing token.
- `PORT`: Application listener port (default 3000).

## Docker Setup
- `docker-compose.yml` is included to run both MySQL and Vinxi web processes in isolated network containers.
