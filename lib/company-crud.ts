import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { logAuditEntry } from "@/lib/audit-log";
import { errorToMessage, errorToStatus, requirePermission, type Role } from "@/lib/permissions";
import { requireValidCompanyId } from "@/lib/security";
import {
  CompanyCollectionName,
  cleanString,
  companyCollectionRef,
  encodeFirestoreId,
  sanitizeCompanyDocumentPayload,
} from "@/lib/saas";

const listLimit = (request: NextRequest) => {
  const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.floor(limit), 1), 250);
};

const recordValue = (item: Record<string, unknown>, key: string) =>
  typeof item[key] === "string" || typeof item[key] === "number"
    ? String(item[key])
    : "";

type ScopedPermission = {
  role: Role;
  email: string;
  member?: Record<string, unknown> | null;
  assignedProjectIds?: string[];
  assignedWorkerIds?: string[];
};

const isFullCompanyDataRole = (role: Role) =>
  role === "owner" || role === "admin" || role === "manager" || role === "accountant";

const canReadScopedItem = ({
  collectionName,
  item,
  permission,
}: {
  collectionName: CompanyCollectionName;
  item: Record<string, unknown> & { id: string };
  permission: ScopedPermission;
}) => {
  if (isFullCompanyDataRole(permission.role)) return true;

  const assignedProjectIds = permission.assignedProjectIds || [];
  const assignedWorkerIds = permission.assignedWorkerIds || [];
  const projectId = recordValue(item, "projectId") || recordValue(item, "siteId");
  const workerId = recordValue(item, "workerId") || recordValue(item, "employeeId");

  if (permission.role === "viewer") {
    // Viewers get read-only, non-admin project data only when explicitly assigned.
    if (collectionName === "sites") return assignedProjectIds.includes(item.id);
    if (["transactions", "materials", "bills", "reminders", "dailyReports"].includes(collectionName)) {
      return Boolean(projectId) && assignedProjectIds.includes(projectId);
    }
    return false;
  }

  if (permission.role === "supervisor") {
    if (collectionName === "sites") return assignedProjectIds.includes(item.id);
    if (collectionName === "workers") return assignedWorkerIds.includes(item.id) || (Boolean(projectId) && assignedProjectIds.includes(projectId));
    if (["transactions", "materials", "bills", "reminders"].includes(collectionName)) return Boolean(projectId) && assignedProjectIds.includes(projectId);
    if (collectionName === "dailyReports") return (Boolean(projectId) && assignedProjectIds.includes(projectId)) || (Boolean(workerId) && assignedWorkerIds.includes(workerId));
    return false;
  }

  if (permission.role === "worker") {
    if (collectionName === "sites") return assignedProjectIds.includes(item.id);
    if (collectionName === "workers") return assignedWorkerIds.includes(item.id);
    if (collectionName === "dailyReports") return Boolean(workerId) && assignedWorkerIds.includes(workerId);
    if (collectionName === "reminders") return Boolean(projectId) && assignedProjectIds.includes(projectId);
    return false;
  }

  return false;
};

const assertCanWriteScopedItem = ({
  collectionName,
  payload,
  permission,
}: {
  collectionName: CompanyCollectionName;
  payload: Record<string, unknown>;
  permission: ScopedPermission;
}) => {
  if (permission.role === "owner" || permission.role === "admin" || permission.role === "manager" || permission.role === "accountant") {
    return;
  }

  const assignedProjectIds = permission.assignedProjectIds || [];
  const assignedWorkerIds = permission.assignedWorkerIds || [];
  const projectId = recordValue(payload, "projectId") || recordValue(payload, "siteId");
  const workerId = recordValue(payload, "workerId") || recordValue(payload, "employeeId");

  if (permission.role === "viewer") {
    throw Object.assign(new Error("Forbidden: viewers cannot write company data"), { status: 403 });
  }

  if (permission.role === "supervisor") {
    if (collectionName === "workers") {
      if (projectId && assignedProjectIds.includes(projectId)) return;
      if (workerId && assignedWorkerIds.includes(workerId)) return;
      throw Object.assign(new Error("Forbidden: supervisor is not assigned to this worker/project"), { status: 403 });
    }
    if (collectionName === "dailyReports" || collectionName === "reminders") {
      if (projectId && assignedProjectIds.includes(projectId)) return;
    }
    throw Object.assign(new Error("Forbidden: supervisor cannot write this data"), { status: 403 });
  }

  if (permission.role === "worker") {
    if (collectionName === "dailyReports") {
      if (workerId && assignedWorkerIds.includes(workerId)) return;
      throw Object.assign(new Error("Forbidden: worker is not assigned to this report"), { status: 403 });
    }
    if (collectionName === "reminders") {
      if (projectId && assignedProjectIds.includes(projectId)) return;
    }
    throw Object.assign(new Error("Forbidden: worker cannot write this data"), { status: 403 });
  }

  throw Object.assign(new Error("Forbidden"), { status: 403 });
};

export const listCompanyCollection = async ({
  request,
  companyId,
  collectionName,
}: {
  request: NextRequest;
  companyId: string;
  collectionName: CompanyCollectionName;
}) => {
  try {
    const safeCompanyId = requireValidCompanyId(companyId);

    const permission = (await requirePermission({
      companyId: safeCompanyId,
      action: `${collectionName}:read`,
    })) as ScopedPermission;

    const collectionRef = companyCollectionRef(safeCompanyId, collectionName);
    if (!collectionRef) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 500 });
    }

    const snapshot = await collectionRef.limit(listLimit(request)).get();

    const items = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => canReadScopedItem({ collectionName, item, permission }));

    return NextResponse.json({ companyId: safeCompanyId, collection: collectionName, items });
  } catch (error) {
    return NextResponse.json({ error: errorToMessage(error) }, { status: errorToStatus(error) });
  }
};

export const createCompanyCollectionDocument = async ({
  request,
  companyId,
  collectionName,
}: {
  request: NextRequest;
  companyId: string;
  collectionName: CompanyCollectionName;
}) => {
  try {
    const safeCompanyId = requireValidCompanyId(companyId);
    const permission = (await requirePermission({
      companyId: safeCompanyId,
      action: `${collectionName}:write`,
    })) as ScopedPermission;
    const { email } = permission;
    const collectionRef = companyCollectionRef(safeCompanyId, collectionName);
    if (!collectionRef) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 500 });
    }

    const body = await request.json();
    const data = sanitizeCompanyDocumentPayload({ collectionName, payload: body });
    const requestedId = body && typeof body === "object" && "id" in body ? cleanString((body as Record<string, unknown>).id, 180) : "";

    const basePayload: Record<string, unknown> = {
      ...data,
      companyId: safeCompanyId,
      updatedBy: email,
      updatedAt: FieldValue.serverTimestamp(),
    };

    assertCanWriteScopedItem({ collectionName, payload: basePayload, permission });

    const docRef = requestedId ? collectionRef.doc(encodeFirestoreId(requestedId)) : collectionRef.doc();
    const existing = await docRef.get();

    if (existing.exists) {
      const existingData = { id: docRef.id, ...(existing.data() as Record<string, unknown>) };
      if (!canReadScopedItem({ collectionName, item: existingData, permission })) {
        throw Object.assign(new Error("Forbidden: cannot modify document outside assigned scope"), { status: 403 });
      }
    }

    await docRef.set(
      {
        ...basePayload,
        createdBy: existing.exists ? existing.data()?.createdBy || email : email,
        createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const saved = await docRef.get();
    const after = { id: docRef.id, ...saved.data() };

    await logAuditEntry({
      companyId: safeCompanyId,
      action: existing.exists ? "update" : "create",
      collection: collectionName,
      documentId: docRef.id,
      userEmail: email,
      before: existing.exists ? existing.data() : null,
      after,
    });

    return NextResponse.json({ companyId: safeCompanyId, item: after }, { status: existing.exists ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: errorToMessage(error) }, { status: errorToStatus(error) });
  }
};

export const deleteCompanyCollectionDocument = async ({
  companyId,
  collectionName,
  documentId,
}: {
  companyId: string;
  collectionName: CompanyCollectionName;
  documentId: string;
}) => {
  try {
    const safeCompanyId = requireValidCompanyId(companyId);
    const permission = (await requirePermission({ companyId: safeCompanyId, action: `${collectionName}:write` })) as ScopedPermission;

    if (!(permission.role === "owner" || permission.role === "admin" || permission.role === "manager")) {
      throw Object.assign(new Error("Forbidden: delete requires admin/manager access"), { status: 403 });
    }

    const collectionRef = companyCollectionRef(safeCompanyId, collectionName);
    if (!collectionRef) return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 500 });

    const docRef = collectionRef.doc(encodeFirestoreId(documentId));
    const existing = await docRef.get();
    if (!existing.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await docRef.delete();

    await logAuditEntry({ companyId: safeCompanyId, action: "delete", collection: collectionName, documentId, userEmail: permission.email, before: existing.data() });

    return NextResponse.json({ companyId: safeCompanyId, deleted: documentId });
  } catch (error) {
    return NextResponse.json({ error: errorToMessage(error) }, { status: errorToStatus(error) });
  }
};
