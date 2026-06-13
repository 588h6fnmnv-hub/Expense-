# Ledge patch: frontend to company collections

Replace/copy these files into your project. This patch keeps the old wallet fallback working and adds safe mirroring into production company subcollections.

## Added clean API paths

New paths are:

- `/api/company/[companyId]/transactions`
- `/api/company/[companyId]/sites`
- `/api/company/[companyId]/workers`
- `/api/company/[companyId]/materials`
- `/api/company/[companyId]/bills`
- `/api/company/[companyId]/reminders`

The older accidentally-nested paths can remain for now, but new frontend code uses the clean paths above.

## What changed

- `lib/company-crud.ts` now supports deterministic upsert when `id` is provided. This prevents duplicate documents when syncing the same wallet items repeatedly.
- `lib/company-api-client.ts` was added for browser-side company collection calls.
- `app/page.tsx` now mirrors the current wallet data into company subcollections after the normal wallet save flow.

## Run after replacing

```bash
npm run build
```

If build passes:

```bash
git add .
git commit -m "Connect frontend to company collections"
git push origin main
```

## Important

This is still a safe migration bridge. The old wallet system stays active. After testing, the next phase is reading the UI directly from company subcollections instead of the big wallet object.
