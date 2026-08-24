# Authentication and Sessions

Authentication uses HttpOnly cookies to protect session tokens against cross-site scripting (XSS) attacks.

## Session Lifecycle
1. **Login**: User enters credentials, checked against hashed values via `scrypt`.
2. **Session Generation**: A unique token is written to the `sessions` database table.
3. **Cookie Set**: The token is written to a cookie set with properties: `Secure`, `HttpOnly`, `SameSite=Lax`.
4. **Validation**: Every page load validates the session status against the database.
5. **Logout**: Deletes the database row and clears the cookie.
