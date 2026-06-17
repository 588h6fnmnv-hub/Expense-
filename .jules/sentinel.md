## 2025-05-14 - Admin SDK RBAC Bypass: Owner Demotion
**Vulnerability:** Admins (or any role with `members:write` permission) could demote a company `owner` to a lower role because the backend API used the Firebase Admin SDK, which bypasses Firestore security rules, and lacked server-side checks for role seniority.
**Learning:** Even with Firestore rules in place, backend routes using elevated privileges (Admin SDK) must explicitly implement "seniority" checks to prevent lower-privileged administrative roles from affecting higher-privileged ones.
**Prevention:** Always fetch the existing state of a record within a transaction and verify that the caller has sufficient privilege to modify the specific target's existing role, especially when protecting 'owner' status.
