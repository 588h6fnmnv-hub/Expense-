import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildInvitePlaceholder, normalizeWorkerSubRole } from "@/lib/plans";
import { memberDocIdForEmail, memberRef, normalizeRole } from "@/lib/saas";
import { logAuditEntry } from "@/lib/audit-log";
import { requirePermission, type Role } from "@/lib/permissions";
import {
  isValidEmail,
  jsonError,
  jsonRouteError,
  normalizeEmail,
  parseJsonObject,
  requireValidCompanyId,
} from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const callerEmail = normalizeEmail(session?.user?.email);
    if (!callerEmail) return jsonError("Not signed in", 401);

    const body = await parseJsonObject(request);
    const companyId = requireValidCompanyId(body.companyId);
    const memberEmail = normalizeEmail(body.memberEmail);

    if (!isValidEmail(memberEmail)) return jsonError("memberEmail is invalid", 400);

    await requirePermission({
      companyId,
      action: "invite:create",
    });

    const role: Role | null = normalizeRole(body.role) as Role | null;
    if (!role) return jsonError("role is invalid", 400);
    if (!["supervisor", "worker", "admin", "manager", "accountant", "viewer"].includes(role)) {
      return jsonError("Only admin, supervisor, and worker invites are supported", 400);
    }
    const workerSubRole =
      role === "worker" ? normalizeWorkerSubRole(body.workerSubRole) : undefined;
    const assignedSupervisor =
      typeof body.assignedSupervisor === "string"
        ? body.assignedSupervisor.trim().slice(0, 240)
        : "";
    const invitePlaceholder =
      role === "worker" || role === "supervisor"
        ? buildInvitePlaceholder({
            companyId,
            role,
            workerSubRole,
          })
        : null;

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const memberDocRef = memberRef(companyId, memberEmail);
    if (!memberDocRef) return jsonError("Firebase admin is not configured", 503);

    const memberId = memberDocIdForEmail(memberEmail);

    const createdAt = (await import("firebase-admin/firestore")).FieldValue.serverTimestamp();

    let before: unknown | null = null;

    const exists = await memberDocRef.get();
    before = exists.exists ? exists.data() : null;

    await memberDocRef.set(
      {
        id: memberId,
        companyId,
        email: memberEmail,
        role,
        invitedBy: callerEmail,
        assignedSupervisor,
        workerSubRole: workerSubRole || null,
        referralCode: invitePlaceholder?.code || null,
        inviteLink: invitePlaceholder?.link || null,
        status: "invited",
        createdAt,
        updatedAt: createdAt,
      },
      { merge: true }
    );

    await logAuditEntry({
      companyId,
      action: exists.exists ? "update" : "create",
      collection: "members",
      documentId: memberId,
      userId: callerEmail,
      before,
      after: {
        id: memberId,
        companyId,
        email: memberEmail,
        role,
        invitedBy: callerEmail,
        assignedSupervisor,
        workerSubRole: workerSubRole || null,
        referralCode: invitePlaceholder?.code || null,
        inviteLink: invitePlaceholder?.link || null,
        status: "invited",
      },
    });

    return NextResponse.json({ ok: true, invite: invitePlaceholder });
  } catch (error) {
    return jsonRouteError(error);
  }
}
