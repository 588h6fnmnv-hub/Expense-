# Logic Restore Audit

This build is based on the original uploaded project logic, not the broken later UI patches.

Preserved logic systems checked in code:

- User login / saved user flow: `app/page.tsx`, `app/providers.tsx`, `app/api/auth/[...nextauth]`
- Demo company flow: `app/page.tsx`
- Firebase sync + local offline cache: `app/page.tsx`, `lib/firebase.ts`
- Wallet data normalization: `app/page.tsx`, `app/api/wallet/route.ts`
- Transactions: income, expense, pay in, pay out: `app/page.tsx`, `lib/types.ts`
- Cash / UPI / card balance logic: `app/page.tsx`
- Ledger/account calculation: `app/page.tsx`, `components/reports/ReportsView.tsx`
- Transfer detection: `app/page.tsx`
- Category auto-detection: `inferCategory()` in `app/page.tsx`
- Gmail transaction import: `app/api/email-import/route.ts`
- Duplicate source tracking: `sourceId` logic in `app/page.tsx`, API routes, `lib/types.ts`
- Person/worker payable-receivable logic: `components/workers/WorkerLedger.tsx`, `app/page.tsx`
- Worker roles: `lib/construction.ts`, `lib/types.ts`
- Daily work report logic: `components/workers/WorkerLedger.tsx`, `app/page.tsx`
- WhatsApp report text generation: `components/workers/WorkerLedger.tsx`
- Site/project management logic: `components/sites/SitesView.tsx`, `app/page.tsx`
- Site budget + profit/loss calculation: `components/sites/SitesView.tsx`
- Extra work tracking: `components/sites/SitesView.tsx`, `lib/types.ts`
- Material inventory logic: `components/materials/MaterialTracker.tsx`
- Material category system: `lib/construction.ts`, `lib/types.ts`
- Material low-stock alerts: `components/materials/MaterialTracker.tsx`, `app/page.tsx`
- Supplier/material usage tracking: `components/materials/MaterialTracker.tsx`
- Reminder system: `components/reminders/ReminderCenter.tsx`, `app/page.tsx`
- Credit card repayment reminders: `app/page.tsx`
- Monthly filtering/report logic: `app/page.tsx`, `components/reports/ReportsView.tsx`
- Expense category analytics: `components/reports/ReportsView.tsx`, `lib/construction.ts`
- Company/SaaS preparation: `lib/saas.ts`, `lib/company-crud.ts`, `lib/types.ts`
- Plan/role type preparation: `lib/plans.ts`, `lib/permissions.ts`, `lib/types.ts`
- Company subcollection sync: `lib/company-api-client.ts`, API routes, `app/page.tsx`
- Dark mode persistence: `app/page.tsx`, `DashboardHeader`, `BottomNav`

Intentional UI-only changes kept:

- `HomeSection` renamed/extracted as `HomeDashboard`.
- Bottom navigation copied to `components/shared/BottomNav.tsx`.
- Worker ledger/work log on Home dashboard are collapsed by default and expand on click.
- Site add form allows site name, budget, customer, and note.
- Person money is excluded from site income/profit calculation.

No add-form automation, category inference, Firebase sync, Gmail import, wallet normalization, worker ledger, material tracking, reports, or theme persistence logic was intentionally removed.
