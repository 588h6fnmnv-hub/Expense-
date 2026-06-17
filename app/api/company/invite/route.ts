import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeWorkerSubRole } from "@/lib/plans";
import { memberDocIdForEmail, memberRef, normalizeRole } from "@/lib/saas";
import { logAuditEntry } from "@/lib/audit-log";
import { requirePermission, type Role } from "@/lib/permissions";
import {
  isValidEmail,
  enforceRateLimit,
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

    await enforceRateLimit({ request, key: "invite:create", limit: 20, windowMs: 60_000, userEmail: callerEmail });

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
    if (role === "owner") return jsonError("Cannot assign owner role directly", 403);
    if (!["supervisor", "worker", "admin", "manager", "accountant", "viewer"].includes(role)) {
      return jsonError("Only admin, supervisor, and worker invites are supported", 400);
    }
    const workerSubRole =
      role === "worker" ? normalizeWorkerSubRole(body.workerSubRole) : undefined;
    const assignedSupervisor =
      typeof body.assignedSupervisor === "string"
        ? body.assignedSupervisor.trim().slice(0, 240)
        : "";
    let invitePlaceholder: { code: string; link: string } | null = null;
    if (role === "worker" || role === "supervisor") {
      // Generate a cryptographically secure random referral code (>=128 bits)
      // Do not embed companyId or role in the visible code.
      const { randomBytes } = await import("crypto");
      const token = randomBytes(16).toString("hex");
      const code = token.toUpperCase();

      const params = new URLSearchParams({
        companyId,
        role,
        code,
      });

      if (workerSubRole) {
        params.set("workerSubRole", workerSubRole);
      }

      invitePlaceholder = {
        code,
        link: `/join?${params.toString()}`,
      };
    }

    // Set an expiresAt for invite links so they expire same-day (end of UTC day).
    // Also, enforce that temporary invites are worker-only by forcing role to 'worker'
    // when a temporary flag is provided.
    const now = new Date();
    const expiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const isTemporary = Boolean(body.temporary || body.temporaryInvite);
    const finalRole: Role = isTemporary ? ("worker" as Role) : role;

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const memberDocRef = memberRef(companyId, memberEmail);
    if (!memberDocRef) return jsonError("Firebase admin is not configured", 503);

    const exists = await memberDocRef.get();
    const existingData = exists.exists ? exists.data() : null;

    // Do not allow sending an invite to the company owner's email address.
    // This prevents accidental demotion or hijacking of the owner account
    // if an admin tries to re-invite the owner with a lower role.
    if (existingData?.role === "owner") {
      return jsonError("Cannot invite the company owner", 403);
    }

    const memberId = memberDocIdForEmail(memberEmail);

    const createdAt = (await import("firebase-admin/firestore")).FieldValue.serverTimestamp();

    const before = existingData;

    await memberDocRef.set(
      {
        id: memberId,
        companyId,
        email: memberEmail,
        role: finalRole,
        invitedBy: callerEmail,
        assignedSupervisor,
        workerSubRole: workerSubRole || null,
        referralCode: invitePlaceholder?.code || null,
        inviteLink: invitePlaceholder?.link || null,
        status: "invited",
        temporary: isTemporary || false,
        expiresAt: invitePlaceholder ? expiresAt : null,
        createdAt: before?.createdAt || createdAt,
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
        role: finalRole,
        invitedBy: callerEmail,
        assignedSupervisor,
        workerSubRole: workerSubRole || null,
        referralCode: invitePlaceholder?.code || null,
        inviteLink: invitePlaceholder?.link || null,
        temporary: isTemporary || false,
        expiresAt: invitePlaceholder ? expiresAt : null,
        status: "invited",
      },
    });

    return NextResponse.json({ ok: true, invite: invitePlaceholder });
  } catch (error) {
    return jsonRouteError(error, request);
  }
}
