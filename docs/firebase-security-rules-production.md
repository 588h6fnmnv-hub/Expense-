# Firebase Security Rules - Production Recommendations

This app now treats company data as the primary SaaS boundary:

- `companies/{companyId}`
- `companies/{companyId}/members/{lowercaseEmail}`
- `companies/{companyId}/transactions/{transactionId}`
- `companies/{companyId}/sites/{siteId}`
- `companies/{companyId}/workers/{workerId}`
- `companies/{companyId}/materials/{materialId}`
- `companies/{companyId}/bills/{billId}`
- `companies/{companyId}/reminders/{reminderId}`
- `companies/{companyId}/wallets/{lowercaseEmail}`
- `companies/{companyId}/auditLogs/{auditLogId}`

Legacy per-user `wallets/{encodedEmail}` documents should remain a migration fallback only. New production clients should read/write through company-scoped APIs or company-scoped Firestore paths.

## Role Model

Roles are stored in `companies/{companyId}/members/{lowercaseEmail}.role`:

- `owner`: full company administration, members, import/export, admin stats
- `manager`: company write access without ownership-only controls
- `accountant`: transactions, sites, workers, materials, bills, reminders, reports, backup export
- `viewer`: read-only access

Recommended minimum permissions:

| Action | Minimum role |
| --- | --- |
| Read company data | viewer |
| Create/update transactions | accountant |
| Create/update sites/projects | accountant |
| Create/update workers/accounts | accountant |
| Create/update materials | accountant |
| Create/update reminders | accountant |
| Export backup | accountant |
| Import backup | owner |
| Invite/manage members | owner |
| View admin stats | owner |

## Recommended Rules Shape

Use this as a production starting point. Keep server-only operations behind Next.js API routes that use Firebase Admin SDK and the app permission helpers.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null && request.auth.token.email is string;
    }

    function userEmail() {
      return request.auth.token.email.lower();
    }

    function memberPath(companyId) {
      return /databases/$(database)/documents/companies/$(companyId)/members/$(userEmail());
    }

    function member(companyId) {
      return get(memberPath(companyId)).data;
    }

    function isMember(companyId) {
      return signedIn() && exists(memberPath(companyId));
    }

    function role(companyId) {
      return member(companyId).role;
    }

    function roleRank(value) {
      return value == "owner" ? 4 :
        value == "manager" ? 3 :
        value == "accountant" ? 2 :
        value == "viewer" ? 1 : 0;
    }

    function atLeast(companyId, minRole) {
      return isMember(companyId) && roleRank(role(companyId)) >= roleRank(minRole);
    }

    function sameCompany(companyId) {
      return !("companyId" in request.resource.data) ||
        request.resource.data.companyId == companyId;
    }

    match /companies/{companyId} {
      allow read: if atLeast(companyId, "viewer");
      allow create: if false;
      allow update: if atLeast(companyId, "manager");
      allow delete: if false;

      match /members/{memberEmail} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update, delete: if atLeast(companyId, "owner");
      }

      match /transactions/{docId} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update: if atLeast(companyId, "accountant") && sameCompany(companyId);
        allow delete: if atLeast(companyId, "manager");
      }

      match /sites/{docId} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update: if atLeast(companyId, "accountant") && sameCompany(companyId);
        allow delete: if atLeast(companyId, "manager");
      }

      match /workers/{docId} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update: if atLeast(companyId, "accountant") && sameCompany(companyId);
        allow delete: if atLeast(companyId, "manager");
      }

      match /materials/{docId} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update: if atLeast(companyId, "accountant") && sameCompany(companyId);
        allow delete: if atLeast(companyId, "manager");
      }

      match /bills/{docId} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update: if atLeast(companyId, "accountant") && sameCompany(companyId);
        allow delete: if atLeast(companyId, "manager");
      }

      match /reminders/{docId} {
        allow read: if atLeast(companyId, "viewer");
        allow create, update: if atLeast(companyId, "accountant") && sameCompany(companyId);
        allow delete: if atLeast(companyId, "manager");
      }

      match /wallets/{walletEmail} {
        allow read, write: if signedIn() &&
          walletEmail == userEmail() &&
          atLeast(companyId, "viewer");
      }

      match /auditLogs/{auditId} {
        allow read: if atLeast(companyId, "accountant");
        allow write: if false;
      }
    }

    match /wallets/{walletId} {
      allow read, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Production Checklist

- Keep member document IDs as lowercase email addresses. Do not URL-encode member IDs in new data.
- Keep all company-owned documents carrying the matching `companyId` field where practical.
- Use API routes for privileged actions: company creation, member invites, backup import/export, audit writes, and admin stats.
- Do not allow direct client writes to `auditLogs`.
- Keep legacy `wallets` disabled in final Firestore rules once migration is complete.
- Test these rules in the Firebase Emulator with owner, manager, accountant, viewer, non-member, and signed-out users before deployment.
