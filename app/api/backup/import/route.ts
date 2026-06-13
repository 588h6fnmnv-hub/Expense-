import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { requirePermission } from "@/lib/permissions";
import { getAdminDb } from "@/lib/firebase-admin";
import { logAuditEntry } from "@/lib/audit-log";
import { normalizePlan, normalizeWorkerSubRole } from "@/lib/plans";
import {
  type CompanyCollectionName,
  cleanString,
  companyCollectionNames,
  companyCollectionRef,
  encodeFirestoreId,
  memberDocIdForEmail,
  normalizeRole,
  sanitizeCompanyDocumentPayload,
} from "@/lib/saas";
import {
  cleanDisplayText,
  isValidEmail,
  enforceRateLimit,
  jsonError,
  jsonRouteError,
  normalizeEmail,
  parseJsonObject,
  requireValidCompanyId,
} from "@/lib/security";

export const runtime = "nodejs";

type BackupImportBody = {
  companyId?: string;
  company?: unknown;
  members?: unknown;
  data?: unknown;
};

type MemberLike = {
  email?: unknown;
  role?: unknown;
  displayName?: unknown;
  invitedBy?: unknown;
  assignedSupervisor?: unknown;
  workerSubRole?: unknown;
  referralCode?: unknown;
  inviteLink?: unknown;
  status?: unknown;
};

const importableCollections = companyCollectionNames;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stableBackupId = (
  collectionName: CompanyCollectionName,
  item: Record<string, unknown>
) => {
  const explicitId = cleanString(item.id, 180);
  if (explicitId) return explicitId;

  const sourceId = collectionName === "transactions" ? cleanString(item.sourceId, 180) : "";
  if (sourceId) return sourceId;

  const identity = [
    collectionName,
    cleanString(item.name, 160),
    cleanString(item.title, 160),
    cleanString(item.date, 40),
    cleanString(item.dueDate, 40),
    cleanString(item.projectId, 160),
    String(item.amount ?? ""),
  ].join("|");

  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
};

const importCollection = async ({
  companyId,
  collectionName,
  rawItems,
  userEmail,
}: {
  companyId: string;
  collectionName: CompanyCollectionName;
  rawItems: unknown;
  userEmail: string;
}) => {
  const collectionRef = companyCollectionRef(companyId, collectionName);
  if (!collectionRef) {
    throw Object.assign(new Error("Firebase admin is not configured"), {
      status: 503,
    });
  }

  const items = Array.isArray(rawItems) ? rawItems : [];
  const seenIds = new Set<string>();
  let imported = 0;
  let skipped = 0;
  let merged = 0;

  const { FieldValue } = await import("firebase-admin/firestore");

  for (const item of items) {
    if (!isPlainRecord(item)) {
      skipped += 1;
      continue;
    }

    try {
      const documentId = stableBackupId(collectionName, item);
      if (!documentId || seenIds.has(documentId)) {
        skipped += 1;
        continue;
      }
      seenIds.add(documentId);

      const docRef = collectionRef.doc(encodeFirestoreId(documentId));
      const beforeSnap = await docRef.get();
      const payload = sanitizeCompanyDocumentPayload({
        collectionName,
        payload: item,
      });

      await docRef.set(
        {
          ...payload,
          companyId,
          source: cleanString(item.source, 80) || "backup-import",
          updatedBy: userEmail,
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: beforeSnap.exists
            ? beforeSnap.data()?.createdBy || userEmail
            : userEmail,
          createdAt: beforeSnap.exists
            ? beforeSnap.data()?.createdAt || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      imported += 1;
      if (beforeSnap.exists) merged += 1;
    } catch {
      skipped += 1;
    }
  }

  if (imported > 0) {
    await logAuditEntry({
      companyId,
      action: "migrate",
      collection: collectionName,
      userEmail,
      after: { imported, merged, skipped, source: "backup-import" },
    });
  }

  return { imported, merged, skipped };
};

export async function POST(request: Request) {
  try {
    const body = (await parseJsonObject(request)) as BackupImportBody;

    // Do not trust companyId inside the backup payload. Require explicit target companyId.
    if (!body.companyId) return jsonError("companyId is required", 400);
    const companyId = requireValidCompanyId(body.companyId);

    if (companyId === "demo-company") {
      return jsonError("Backup import is disabled for demo company", 403);
    }

    const permission = await requirePermission({
      companyId,
      action: "backup:import",
    });
    await enforceRateLimit({ request, key: "backup:import", limit: 3, windowMs: 60 * 60_000, userEmail: permission.email });

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    if (!body.company || typeof body.company !== "object") {
      return jsonError("company is required", 400);
    }

    const companyObj = body.company as Record<string, unknown>;
    const companyName = cleanDisplayText(companyObj.name, 120);
    const ownerEmail = permission.email;

    if (!companyName || !isValidEmail(ownerEmail)) {
      return jsonError("company.name is required", 400);
    }

    const companyDocRef = db
      .collection("companies")
      .doc(encodeURIComponent(companyId));

    // Import within a transaction where possible.
    await db.runTransaction(async (tx) => {
      const existingCompany = await tx.get(companyDocRef);
      const timestamp = (await import("firebase-admin/firestore")).FieldValue.serverTimestamp();

      if (!existingCompany.exists) {
        tx.set(
          companyDocRef,
          {
            id: companyId,
            name: companyName,
            ownerEmail,
            plan: normalizePlan(companyObj.plan),
            createdAt: timestamp,
          },
          { merge: true }
        );
      } else {
        // Preserve existing ownerEmail; do not overwrite current company owner
        tx.set(
          companyDocRef,
          {
            id: companyId,
            name: companyName,
            plan: normalizePlan(companyObj.plan),
            // leave ownerEmail unchanged
          },
          { merge: true }
        );
      }
    });

    const members = Array.isArray(body.members) ? (body.members as unknown[]) : [];
    let importedMembers = 0;
    let mergedMembers = 0;

    // Best-effort member writes (transactions for each member to avoid huge txn)
    for (const m of members) {
      if (!m || typeof m !== "object") continue;

      const memberLike = m as MemberLike;

      const email = normalizeEmail(memberLike.email);
      if (!isValidEmail(email)) continue;

      const memberId = memberDocIdForEmail(email);
      const memberRef = db
        .collection("companies")
        .doc(encodeURIComponent(companyId))
        .collection("members")
        .doc(memberId);

      const beforeSnap = await memberRef.get();
      const before = beforeSnap.exists ? beforeSnap.data() : null;

      // Backup import must not create or privilege users from an uploaded file.
      // Existing members keep their current role; the importing admin keeps their current role (do not trust backup role).
      if (!beforeSnap.exists && email !== permission.email) continue;
      const role = email === permission.email ? permission.role : (normalizeRole(before?.role) || "viewer");

      // Avoid repeated dynamic import inside loop for FieldValue.
      const { FieldValue } = await import("firebase-admin/firestore");

      const displayName = cleanDisplayText(memberLike.displayName, 120) || email;
      const invitedBy = normalizeEmail(memberLike.invitedBy) || null;
      const assignedSupervisor = cleanString(memberLike.assignedSupervisor, 240);
      const workerSubRole =
        role === "worker" ? normalizeWorkerSubRole(memberLike.workerSubRole) : undefined;
      // Do NOT import referral codes or invite links from backups
      // const referralCode = cleanString(memberLike.referralCode, 120);
      // const inviteLink = cleanString(memberLike.inviteLink, 500);

      const status =
        memberLike.status === "disabled" || memberLike.status === "invited"
          ? memberLike.status
          : "active";

      await memberRef.set(
        {
          id: memberId,
          companyId,
          email,
          role,
          displayName,
          invitedBy,
          assignedSupervisor,
          workerSubRole: workerSubRole || null,
          // referralCode and inviteLink intentionally omitted
          status,
          createdAt: before && typeof before === "object" && "createdAt" in before ? (before as { createdAt?: unknown }).createdAt : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await logAuditEntry({
        companyId,
        action: beforeSnap.exists ? "update" : "create",
        collection: "members",
        documentId: memberId,
        userId: undefined,
        before,
        after: {
          id: memberId,
          companyId,
          email,
          role,
        },
      });

      importedMembers += 1;
      if (beforeSnap.exists) mergedMembers += 1;
    }

    const data = isPlainRecord(body.data) ? body.data : {};
    const importedCollections: Record<
      string,
      { imported: number; merged: number; skipped: number }
    > = {};

    for (const collectionName of importableCollections) {
      importedCollections[collectionName] = await importCollection({
        companyId,
        collectionName,
        rawItems: data[collectionName],
        userEmail: permission.email,
      });
    }

    // Audit top-level import
    try {
      await logAuditEntry({
        companyId,
        action: "import",
        collection: "backup",
        userEmail: permission.email,
        before: null,
        after: { importedMembers, mergedMembers, collections: Object.keys(importedCollections) },
      });
    } catch {
      // best-effort
    }

    return NextResponse.json({
      ok: true,
      companyId,
      importedMembers,
      mergedMembers,
      collections: importedCollections,
    });
  } catch (error) {
    return jsonRouteError(error, request);
  }
}
