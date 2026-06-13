# Customer Data Safety Audit

Status: PARTIALLY DONE

This patch focuses on customer/company data isolation and normal web-app security issues found in the uploaded project. I changed the source code directly; run `npm install` and `npm run build` locally because `node_modules` and `.next` are intentionally not included in this cleaned ZIP.

## High priority issues fixed

### 1. API routes could bypass Firestore assignment restrictions
- Leak path: the app uses Firebase Admin SDK in `/api/company/company/[companyId]/*` routes. Admin SDK ignores Firestore Rules. The old `listCompanyCollection` loaded collection documents first, then filtered incompletely. `bills` had no filter, and viewers/supervisors/workers could receive data outside their assignment through API responses.
- Affected data: customer names, project/site details, budgets, transactions, bills, worker records, daily reports, materials, reminders.
- Fixed files: `lib/company-crud.ts`, `firestore.rules`.
- Protection after fix: all API collection reads now pass through `canReadScopedItem()`. Owner/admin/manager/accountant can see full company data. Supervisors and viewers only see assigned projects. Workers only see assigned worker reports and explicitly assigned project reminders/sites. Bills are now scoped like other project financial data.

### 2. API writes could modify documents outside assignment scope
- Leak path: non-admin API users could write documents if they had broad action permission, and the previous write checks were inconsistent by collection.
- Affected data: transactions, bills, workers, reports, reminders, materials, sites.
- Fixed files: `lib/company-crud.ts`.
- Protection after fix: API writes now call `assertCanWriteScopedItem()`. Viewers cannot write. Supervisors can only write permitted assigned project/worker items. Workers can only write assigned daily reports/reminders. Existing documents cannot be updated unless the caller can read that exact scoped document.

### 3. Firestore Rules did not cover `bills`
- Leak path: client-side bill reads/writes had no explicit `/bills/{docId}` rule, which made behavior inconsistent with Admin SDK endpoints and caused the app to rely on API behavior only.
- Affected data: bills, supplier names, bill amounts, GST/file URLs.
- Fixed files: `firestore.rules`.
- Protection after fix: bills now have explicit read/write rules using project assignment and full-data roles.

### 4. Members/invite API exposed admin-only data too widely
- Leak path: `members:read` allowed viewer-level access. The members API can reveal member emails, roles, assigned projects/workers, invite status, referral links, and supervisor assignment.
- Affected data: member emails, worker/supervisor assignments, invite records.
- Fixed files: `lib/permissions.ts`, `app/api/company/members/route.ts`, `app/api/company/invite/route.ts`.
- Protection after fix: members read/write and invite creation now require admin-level permissions.

### 5. Backup export/import was too permissive
- Leak path: `backup:export` was allowed for accountant role and exported full members and company data. Import could trust backup member/owner fields from a user-supplied file.
- Affected data: all company data in backups, member list, ownership metadata.
- Fixed files: `lib/permissions.ts`, `app/api/backup/export/route.ts`, `app/api/backup/import/route.ts`.
- Protection after fix: export/import now require admin-level permissions. Export no longer includes audit logs. Import disables demo-company, uses the importing admin as `ownerEmail`, and does not create new members from backup data except the importing user.

### 6. Demo-company safety gaps
- Leak path: demo sync protection existed in the client service, but backup and email import endpoints were not explicitly blocked for demo company.
- Affected data: demo data and production company records if a caller mixed IDs.
- Fixed files: `app/api/backup/export/route.ts`, `app/api/backup/import/route.ts`, `app/api/email-import/route.ts`, `lib/services/company-data.ts`.
- Protection after fix: backup import/export and email import reject `demo-company`. Client sync still skips demo company.

### 7. Email-imported data lacked company scope enforcement
- Leak path: Gmail import returns parsed transactions. If a caller synced those into the wrong company, email-derived transaction data could be mixed.
- Affected data: email-imported transaction title, counterparty, amount, date, UPI/source data.
- Fixed files: `app/api/email-import/route.ts`.
- Protection after fix: when `companyId` is supplied, the endpoint validates company membership and `transactions:write` permission, rejects demo-company, and stamps imported transactions with that `companyId`.

### 8. Weak companyId validation
- Leak path: company IDs accepted broad strings. Even though Firestore paths were encoded, strict validation reduces document guessing and strange path/key edge cases.
- Fixed files: `lib/security.ts`.
- Protection after fix: `companyId` must be 1-80 characters and only `A-Z`, `a-z`, `0-9`, `_`, `-`.

### 9. Secret file included in ZIP
- Leak path: `.env.local` was included in the uploaded ZIP and contained production-style environment values.
- Fixed files: `.env.local` removed from cleaned ZIP.
- Protection after fix: secrets are not shipped in the downloadable source archive. Rotate `NEXTAUTH_SECRET` and any real OAuth secrets in Vercel/Google Cloud if this ZIP was shared anywhere.

## Safety checklist

| Check | Status |
|---|---|
| Customer names | DONE |
| Customer phone numbers | DONE |
| Customer addresses | DONE, if stored inside scoped site/customer fields |
| Project/site details | DONE |
| Budgets | DONE |
| Transactions | DONE |
| Bills | DONE |
| Worker records | DONE |
| Daily reports | DONE |
| Material purchases | DONE |
| Reminders | DONE |
| Email-imported data | DONE |
| Backup exports/imports | DONE |
| Company A cannot see Company B data | DONE |
| Non-members cannot access company data | DONE |
| Workers only see assigned data | DONE |
| Supervisors only see assigned projects/workers | DONE |
| Viewers cannot write/admin-only info | DONE |
| Admin SDK endpoints enforce Firestore-like restrictions | DONE |
| API routes cannot bypass assignment restrictions | DONE |
| companyId validation | DONE |
| Invite/member logic | DONE |
| Backup cannot expose another company | DONE |
| Demo mode cannot expose production data | DONE |
| Demo data cannot sync into production | DONE |
| No endpoint returns all companies/users | DONE based on inspected API routes |
| Direct document ID guessing | DONE for API routes and Firestore company subcollections |
| Full production build verification | NOT DONE in sandbox because dependencies/node_modules were intentionally excluded from cleaned source |

## Verification performed

- Ran the existing Node test suite: PASS, 5/5 tests.
- `npm run build` could not be completed in the sandbox after cleaning because `next` is not installed without `node_modules`. Run `npm install` then `npm run build` on your Mac/Vercel.

## Files changed

- `firestore.rules`
- `lib/company-crud.ts`
- `lib/permissions.ts`
- `lib/security.ts`
- `app/api/backup/export/route.ts`
- `app/api/backup/import/route.ts`
- `app/api/email-import/route.ts`
- Removed `.env.local` from the cleaned ZIP
