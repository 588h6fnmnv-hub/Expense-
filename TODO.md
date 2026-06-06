# SaaS backend architecture migration (Production)
## Phase/Scope: Company + Members + Permissions + Audit logs + Firestore rules

- [ ] Create/Update core backend helpers
  - [x] Update `lib/firebase-admin.ts` (server-only admin Firestore accessor)
  - [x] Create `lib/permissions.ts` (owner/manager/accountant/viewer RBAC)
  - [x] Create `lib/audit-log.ts` (create/update/delete auditLogs with before/after)
  - [x] Create `lib/saas.ts` (company/member/collection refs + shared backend helpers)

- [ ] Types
  - [x] Update `lib/types.ts` to add SaaS domain types (company/member/role/worker/material/bill/reminder/site/payroll)

- [ ] Security rules
  - [x] Create `firestore.rules` (company-scoped access + RBAC, auditLogs restricted to owner/manager/accountant)
  - [x] Create `storage.rules` (minimal correct setup for future bill storage paths)

- [ ] API routes (production SaaS)
  - [x] Create `app/api/company/create/route.ts`
  - [x] Create `app/api/company/members/route.ts`
  - [x] Create `app/api/company/invite/route.ts`
  - [x] Create `app/api/admin/stats/route.ts`
  - [x] Create `app/api/backup/export/route.ts`
  - [x] Create `app/api/backup/import/route.ts`

- [ ] Migration compatibility
  - [ ] Keep `app/api/wallet/route.ts` legacy fallback active (no removal in this phase)

- [ ] Verification
  - [ ] `next lint` + `next build`
  - [ ] Manual smoke tests:
    - [ ] create company -> owner member doc exists
    - [ ] members list endpoint respects role permissions
    - [ ] audit-log entries created on create/update/delete
    - [ ] viewer cannot read auditLogs via Firestore rules
