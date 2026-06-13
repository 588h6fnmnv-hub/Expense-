# Security Hardening Report

## Implemented

- Hardened NextAuth Google OAuth:
  - Requires Google `email_verified` before sign-in.
  - Uses JWT sessions with 8-hour expiry and 15-minute update age.
  - Uses secure, HTTP-only session cookie naming in production.
  - Keeps Google OAuth access/refresh tokens server-side only; they are no longer returned in the browser session object.
  - Logs auth attempts and refresh failures to `securityEvents`.

- Added request validation and input safety:
  - Central JSON parser now rejects non-JSON bodies and bodies over 1 MB.
  - Text cleaning removes control characters and script tags.
  - Company IDs and email addresses are strictly validated.
  - Company document payload sanitizer rejects unsafe prototype keys and no longer accepts invite/referral secrets from worker payloads.
  - Bill file URLs must be HTTPS.

- Added abuse protection:
  - Firestore-backed rate limiter for sensitive API actions.
  - Middleware rate limiting for `/api/*` and `/api/auth/*`.
  - Rate limits added for company creation, invites, invite joining, backups, wallet reads/writes, admin stats, email import, and company CRUD APIs.

- Strengthened IDOR and ownership checks:
  - Company API routes still require membership and role permissions.
  - Workers can only read assigned sites, assigned workers, assigned daily reports, scoped materials, and scoped reminders.
  - Scoped write checks reject writes outside the caller's assigned project/worker scope.
  - Existing document updates check whether the caller can read the existing document before allowing modification.

- Hardened secrets handling:
  - Removed hard-coded Firebase web config fallback values from source code.
  - Added secret-related patterns to `.gitignore`.
  - Backup export now recursively redacts tokens, invite links, referral codes, private keys, API keys, and credentials from all exported collections, not only members.

- Secure deployment changes:
  - Added HTTPS redirect middleware in production when proxy headers indicate HTTP.
  - Added global security headers and HSTS preload.
  - Added stricter production CSP by removing `unsafe-eval` in production.
  - API responses are no-store.
  - Storage rules deny direct writes; uploads should go through backend validation.
  - Firestore rules deny client access to `companyOwners` and `securityEvents`.

## Notes

- This project uses Google OAuth, not username/password auth. Therefore password hashing and password-reset-token expiry are not applicable unless a credentials/password provider is added later.
- Firebase Web config values are public identifiers by design, but they should not be hard-coded. Restrict the Firebase API key in Google Cloud by HTTP referrer and allowed APIs.
- Firestore Admin SDK still requires server-only `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` environment variables.
- Direct Firestore client access is restricted by Firestore Rules, but production should still rely on backend API routes for privileged writes and all import/export operations.
