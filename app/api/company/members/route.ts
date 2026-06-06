import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeWorkerSubRole } from "@/lib/plans";
import { memberDocIdForEmail, memberRef, normalizeRole } from "@/lib/saas";
import { logAuditEntry } from "@/lib/audit-log";
import { requirePermission } from "@/lib/permissions";
import {
  cleanDisplayText,
  isValidEmail,
  jsonError,
  jsonRouteError,
  normalizeEmail,
  parseJsonObject,
  requireValidCompanyId,
} from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = requireValidCompanyId(searchParams.get("companyId"));

    await requirePermission({
      companyId,
      action: "members:read",
    });

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const membersSnap = await db
      .collection("companies")
      .doc(encodeURIComponent(companyId))
      .collection("members")
      .get();

    const members = membersSnap.docs.map((d) => ({
      ...(d.data() as Record<string, unknown>),
      id: d.id,
    }));

    return NextResponse.json({ ok: true, members });
  } catch (error) {
    return jsonRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = normalizeEmail(session?.user?.email);
    if (!email) return jsonError("Not signed in", 401);

    const body = await parseJsonObject(request);
    const companyId = requireValidCompanyId(body.companyId);
    const memberEmail = normalizeEmail(body.memberEmail);

    if (!isValidEmail(memberEmail)) return jsonError("memberEmail is invalid", 400);

    await requirePermission({
      companyId,
      action: "members:write",
    });

    const role = normalizeRole(body.role);
    if (!role) return jsonError("role is invalid", 400);
    const workerSubRole =
      role === "worker" ? normalizeWorkerSubRole(body.workerSubRole) : undefined;
    const assignedSupervisor =
      typeof body.assignedSupervisor === "string"
        ? body.assignedSupervisor.trim().slice(0, 240)
        : "";

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    // member doc is for memberEmailLower
    const memberDoc = memberRef(companyId, memberEmail);

    if (!memberDoc) return jsonError("Firebase admin is not configured", 503);

    const memberId = memberDocIdForEmail(memberEmail);

    const createdAt = (await import("firebase-admin/firestore")).FieldValue.serverTimestamp();
    const updatedAt = createdAt;

    const before = null;

    await db.runTransaction(async (tx) => {
      // create/merge member doc
      tx.set(memberDoc, {
        id: memberId,
        companyId,
        email: memberEmail,
        role,
        displayName: cleanDisplayText(body.displayName, 120) || memberEmail,
        invitedBy: email,
        assignedSupervisor,
        workerSubRole: workerSubRole || null,
        status: "active",
        createdAt,
        updatedAt,
      });

      // audit
      // (audit write is best-effort outside tx to avoid cross-transaction complexity)
    });

    await logAuditEntry({
      companyId,
      action: "create",
      collection: "members",
      documentId: memberId,
      userId: email,
      before,
      after: {
        id: memberId,
        companyId,
        email: memberEmail,
        role,
        displayName: cleanDisplayText(body.displayName, 120) || memberEmail,
        invitedBy: email,
        assignedSupervisor,
        workerSubRole: workerSubRole || null,
        status: "active",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonRouteError(error);
  }
}
