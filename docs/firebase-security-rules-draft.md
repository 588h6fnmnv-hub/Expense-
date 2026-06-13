# Firebase Security Rules Draft

This draft documents the production rule model for company isolation and role-based access.
Adjust collection names to match the deployed Firestore structure before publishing rules.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null && request.auth.token.email is string;
    }

    function userEmail() {
      return request.auth.token.email.lower();
    }

    function memberDoc(companyId) {
      return /databases/$(database)/documents/companies/$(companyId)/members/$(userEmail());
    }

    function isMember(companyId) {
      return signedIn() && exists(memberDoc(companyId));
    }

    function role(companyId) {
      return isMember(companyId) ? get(memberDoc(companyId)).data.role : null;
    }

    function isOwnerOrAdmin(companyId) {
      return role(companyId) in ['owner', 'admin'];
    }

    function isSupervisor(companyId) {
      return role(companyId) == 'supervisor';
    }

    function isWorker(companyId) {
      return role(companyId) == 'worker';
    }

    function assignedProjects(companyId) {
      return get(memberDoc(companyId)).data.assignedProjectIds;
    }

    function assignedWorkers(companyId) {
      return get(memberDoc(companyId)).data.assignedWorkerIds;
    }

    function sameCompany(companyId) {
      return request.resource.data.companyId == companyId;
    }

    match /companies/{companyId} {
      allow read: if isMember(companyId);
      allow create, update, delete: if isOwnerOrAdmin(companyId);

      match /members/{memberId} {
        allow read: if isOwnerOrAdmin(companyId) || memberId == userEmail();
        allow create, update, delete: if isOwnerOrAdmin(companyId);
      }

      match /transactions/{docId} {
        allow read: if isOwnerOrAdmin(companyId)
          || (isSupervisor(companyId) && resource.data.projectId in assignedProjects(companyId));
        allow create, update, delete: if isOwnerOrAdmin(companyId) && sameCompany(companyId);
      }

      match /sites/{docId} {
        allow read: if isOwnerOrAdmin(companyId)
          || (isSupervisor(companyId) && docId in assignedProjects(companyId))
          || (isWorker(companyId) && docId in assignedProjects(companyId));
        allow create, update, delete: if isOwnerOrAdmin(companyId) && sameCompany(companyId);
      }

      match /workers/{docId} {
        allow read: if isOwnerOrAdmin(companyId)
          || (isSupervisor(companyId) && docId in assignedWorkers(companyId))
          || (isWorker(companyId) && docId in assignedWorkers(companyId));
        allow create, update, delete: if isOwnerOrAdmin(companyId) && sameCompany(companyId);
      }

      match /materials/{docId} {
        allow read: if isOwnerOrAdmin(companyId)
          || (isSupervisor(companyId) && resource.data.projectId in assignedProjects(companyId));
        allow create, update, delete: if isOwnerOrAdmin(companyId) && sameCompany(companyId);
      }

      match /reminders/{docId} {
        allow read: if isOwnerOrAdmin(companyId)
          || (isSupervisor(companyId) && resource.data.projectId in assignedProjects(companyId));
        allow create, update, delete: if isOwnerOrAdmin(companyId) && sameCompany(companyId);
      }

      match /dailyReports/{docId} {
        allow read: if isOwnerOrAdmin(companyId)
          || (isSupervisor(companyId) && resource.data.projectId in assignedProjects(companyId))
          || (isWorker(companyId) && resource.data.workerId in assignedWorkers(companyId));
        allow create, update: if sameCompany(companyId)
          && (isOwnerOrAdmin(companyId)
            || (isSupervisor(companyId) && request.resource.data.projectId in assignedProjects(companyId))
            || (isWorker(companyId) && request.resource.data.workerId in assignedWorkers(companyId)));
        allow delete: if isOwnerOrAdmin(companyId);
      }
    }

    match /wallets/{walletId} {
      allow read, write: if signedIn() && walletId == encodeURIComponent(userEmail());
    }
  }
}
```

Notes:
- Owner/Admin controls company settings, billing placeholders, invites, imports, exports, and destructive actions.
- Supervisors only read assigned sites, assigned workers, and site-related materials/reminders/reports.
- Workers only read assigned site context and their own worker/report records.
- API routes should continue validating `companyId`, caller membership, and role before writing server-side.
