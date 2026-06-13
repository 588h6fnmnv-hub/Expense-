# Ledge Production Roadmap

Ledge should stay simple, fast, and mobile-first while growing into a construction business SaaS for Indian contractors.

## Phase 1: Core SaaS Stability

- Keep the old login, Gmail import, Firebase sync, reports, PDF export, and local offline cache working.
- Store user-scoped wallet data in Firestore and keep local storage only as an offline cache.
- Add reliable JSON backup and restore.
- Keep PWA install support and offline shell caching.
- Add crash/error logging hooks before heavy feature expansion.

## Phase 2: Production Backend And Security

- Move sensitive writes behind protected API routes.
- Add request validation, rate limiting, and strict Firestore security rules.
- Create company-scoped collections for transactions, sites, workers, materials, bills, reminders, and reports.
- Add audit logs for create/update/delete operations.
- Clean environment variables and remove hardcoded production assumptions from local development.

## Phase 3: Company And Team Systems

- Support one owner company first, then multi-company workspaces.
- Add staff invitations and role permissions: Owner, Manager, Accountant, Viewer.
- Add user profile/account settings and protected admin routes.
- Add demo/test company mode for onboarding and sales.

## Phase 4: Construction Operations

- Complete site dashboards with budget, expenses, progress, photos, bills, workers, material usage, and profit.
- Complete worker database, payment history, payroll summaries, attendance, and subcontractor records.
- Complete material inventory with purchase history, usage history, low-stock alerts, supplier records, and site-wise reports.

## Phase 5: Automation And Documents

- Add real OCR for bill extraction: amount, GST, supplier, materials, date, and items.
- Add manual review before saving OCR output.
- Store bill/document files in cloud storage.
- Merge matching Gmail/bank transactions with bill uploads.
- Add scheduled reminders and WhatsApp-friendly sharing links.

## Phase 6: Billing And SaaS Operations

- Add Razorpay subscriptions for Free and Pro plans.
- Add feature gates, usage limits, billing status, invoices, and subscription analytics.
- Add admin dashboard for users, companies, revenue, active plans, recent signups, and usage.

## Phase 7: Analytics And Reporting

- Add monthly/yearly summaries, cash flow, project-wise profit/loss, pending payments, worker summaries, and material reports.
- Add Excel/CSV/PDF exports and scheduled automated reports.
- Add advanced search and large-dataset optimization.

## Phase 8: Enterprise And AI

- Add automatic database backups, disaster recovery, monitoring, CDN/image optimization, feature flags, and migration utilities.
- Add AI expense insights, voice entry, business assistant, smart recommendations, multi-language support, QR collection, GST/tax reporting, and client portal.
- Add public marketing site, SEO, changelog, support/helpdesk, feedback, referral, and reseller systems.
