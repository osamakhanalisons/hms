# Troubleshooting Common Errors

Solutions to common local environment issues:

### 1. Database Connection Refused
- **Fix**: Check if your MySQL server is running on port 3306. Check your `.env` parameters.

### 2. Permissions Cache Stale
- **Fix**: The client permissions hook caches database settings for 5 minutes. Trigger a browser hard refresh (`Ctrl + Shift + R`) to clear the active cache state.

### 3. Upload File Rejected
- **Fix**: Verify file format extensions. The system automatically blocks executable scripts (`.exe`, `.bat`).
