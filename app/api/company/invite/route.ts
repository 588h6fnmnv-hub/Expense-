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
    if ((role as string) === "owner") return jsonError("Cannot assign owner role directly", 403);
    if (!["supervisor", "worker", "admin", "manager", "accountant", "viewer"].includes(role)) {
      return jsonError("Only staff roles (admin, manager, accountant, etc) or worker roles are supported for invites", 400);
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

    const { FieldValue } = await import("firebase-admin/firestore");
    const timestamp = FieldValue.serverTimestamp();

    const memberId = memberDocIdForEmail(memberEmail);
    let before: Record<string, unknown> | null = null;
    let alreadyExists = false;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(memberDocRef);
      before = snap.exists ? (snap.data() as Record<string, unknown>) : null;
      alreadyExists = snap.exists;

      // Demotion protection: Never allow an Admin (or other role) to re-invite/demote a company Owner.
      if (before?.role === "owner") {
        throw Object.assign(new Error("Cannot invite the company owner"), { status: 403 });
      }

      tx.set(
        memberDocRef,
        {
          id: memberId,
          companyId,
          email: memberEmail,
          role: finalRole,
          invitedBy: before?.invitedBy || callerEmail,
          assignedSupervisor,
          workerSubRole: workerSubRole || null,
          referralCode: invitePlaceholder?.code || null,
          inviteLink: invitePlaceholder?.link || null,
          status: "invited",
          temporary: isTemporary || false,
          expiresAt: invitePlaceholder ? expiresAt : null,
          createdAt: before?.createdAt || timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    });

    await logAuditEntry({
      companyId,
      action: alreadyExists ? "update" : "create",
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
