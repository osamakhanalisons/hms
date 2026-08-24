# Document Repository

A secure file repository for society blueprints, NOCs, and meeting minutes.

## Security Policies
- **Extension Blockade**: The server strictly rejects executable file uploads (e.g. `.exe`, `.bat`, `.js`) by inspecting both file names and mime-types.
- **Size Caps**: File uploads are limited to 10MB per file.
- **Role Isolation**: Sensitive files (like financial audits) are restricted to admin roles.
