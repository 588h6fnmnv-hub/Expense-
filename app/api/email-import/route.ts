import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { memberDocIdForEmail, memberRef, encodeFirestoreId, isValidRole } from "@/lib/saas";
import { logAuditEntry } from "@/lib/audit-log";
import {
  parseJsonObject,
  requireValidCompanyId,
  normalizeEmail,
  enforceRateLimit,
  jsonError,
  jsonRouteError,
} from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = normalizeEmail(session?.user?.email);
    if (!userEmail) return jsonError("Not signed in", 401);

    await enforceRateLimit({ request, key: "email-import", limit: 20, windowMs: 60_000, userEmail: userEmail });

    const body = await parseJsonObject(request);
    const companyId = requireValidCompanyId(body.companyId);

    // Limit code length before any processing to prevent DoS via huge strings (H1)
    const code = typeof body.code === "string" ? body.code.trim().slice(0, 80).toUpperCase() : "";
    if (!code) return jsonError("invite code is required", 400);

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    // --- Rate limiting for invite join attempts ---
    const rateLimitsCollection = db
      .collection("securityEvents")
      .doc("rateLimits")
      .collection("inviteJoinAttempts");
    const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    const IP_MAX = 10;
    const EMAIL_MAX = 5;
    const CODE_MAX = 5;

    // C1 FIX: Never trust the client-controllable x-forwarded-for header for rate limiting.
    // x-real-ip is set by the reverse proxy/CDN and cannot be spoofed by clients.
    // If your infra sets a different trusted header, change only this one line.
    const getClientIp = () => request.headers.get("x-real-ip") || "unknown";

    const sha256 = async (text: string) => {
      const { createHash } = await import("crypto");
      return createHash("sha256").update(text).digest("hex");
    };

    const makeKey = (prefix: string, value: string) => `${prefix}:${encodeURIComponent(value)}`;

    // Atomic rate limiter: check + record in one Firestore transaction to eliminate
    // the TOCTOU race between a non-atomic pre-check read and the subsequent write.
    // Returns { exceeded: true } if any key is over its limit (after recording the
    // attempt), or { exceeded: false, counts } with the new attempt counts.
    const checkAndRecordAttempt = async (
      keys: Array<{ key: string; max: number }>
    ): Promise<{ exceeded: boolean; counts: number[] }> => {
      try {
        return await db.runTransaction(async (tx) => {
          const now = Date.now();
          const cutoff = now - WINDOW_MS;
          const docRefs = keys.map(({ key }) => rateLimitsCollection.doc(key));
          const snaps = await Promise.all(docRefs.map((ref) => tx.get(ref)));

          const counts: number[] = [];

          for (let i = 0; i < keys.length; i++) {
            const snap = snaps[i];
            const raw = snap.exists ? (snap.data() as Record<string, unknown>) : null;
            const prev = raw && Array.isArray(raw.attempts)
              ? (raw.attempts as unknown[]).filter(
                  (t) => typeof t === "number" && (t as number) >= cutoff
                )
              : [];
            const updated = [...prev, now];
            tx.set(docRefs[i], { attempts: updated }, { merge: true });
            counts.push(updated.length);
          }

          // Check limits AFTER recording — if any key is over its max, the
          // attempt is still counted (prevents limit bypass via racing).
          const exceeded = keys.some(({ max }, i) => counts[i] > max);
          return { exceeded, counts };
        });
      } catch {
        // On Firestore error, fail open (don't block legitimate users).
        return { exceeded: false, counts: keys.map(() => 0) };
      }
    };

    const clientIp = getClientIp();
    const ipKey = makeKey("ip", clientIp);
    const emailKey = makeKey("email", userEmail);
    const codeHash = await sha256(code);
    const codeKey = makeKey("code", codeHash);

    const rateLimitKeys = [
      { key: ipKey,    max: IP_MAX },
      { key: emailKey, max: EMAIL_MAX },
      { key: codeKey,  max: CODE_MAX },
    ];

    const { exceeded: rateLimitExceeded, counts: rateLimitCounts } =
      await checkAndRecordAttempt(rateLimitKeys);

    if (rateLimitExceeded) {
      return NextResponse.json(
        { error: "Too many invite attempts. Please try again later." },
        { status: 429 }
      );
    }

    // recordFailedAttempt is now handled by checkAndRecordAttempt above;
    // this helper exists only for logging threshold events after failed joins.
    const getCount = (index: number) => rateLimitCounts[index] ?? 0;

    const logIfThresholdExceeded = async (
      keyType: string,
      keyValue: string,
      count: number,
      threshold: number
    ) => {
      if (count >= threshold) {
        try {
          await logAuditEntry({
            companyId,
            action: "security",
            collection: "inviteJoin",
            userEmail: userEmail,
            before: null,
            after: {
              event: "rate_limit_trigger",
              keyType,
              keyValue,
              count,
            },
          });
        } catch {
          // best-effort
        }
      }
    };

    const companyRef = db.collection("companies").doc(encodeFirestoreId(companyId));

    // Find the invite by referralCode
    const inviteSnap = await companyRef
      .collection("members")
      .where("referralCode", "==", code)
      .limit(1)
      .get();

    if (inviteSnap.empty) {
      await logIfThresholdExceeded("ip", clientIp, getCount(0), IP_MAX);
      await logIfThresholdExceeded("email", userEmail, getCount(1), EMAIL_MAX);
      await logIfThresholdExceeded("code", codeHash, getCount(2), CODE_MAX);
      return jsonError("Invite code not found or disabled.", 400);
    }

    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data() as Record<string, unknown>;

    const status = typeof invite.status === "string" ? invite.status : "";
    if (status === "disabled") {
      await logIfThresholdExceeded("ip", clientIp, getCount(0), IP_MAX);
      await logIfThresholdExceeded("email", userEmail, getCount(1), EMAIL_MAX);
      await logIfThresholdExceeded("code", codeHash, getCount(2), CODE_MAX);
      return jsonError("This invite has been disabled.", 400);
    }

    // Only allow acceptance of fresh invited codes. Once consumed, the invite
    // is marked active/used and the referralCode cleared to prevent reuse.
    if (status !== "invited") {
      await logIfThresholdExceeded("ip", clientIp, getCount(0), IP_MAX);
      await logIfThresholdExceeded("email", userEmail, getCount(1), EMAIL_MAX);
      await logIfThresholdExceeded("code", codeHash, getCount(2), CODE_MAX);
      return jsonError("Invite code not found or disabled.", 400);
    }

    // Verify that the invite was created for this authenticated email.
    const invitedEmail = typeof invite.email === "string" ? invite.email.trim().toLowerCase() : "";
    if (!invitedEmail || invitedEmail !== userEmail) {
      await logIfThresholdExceeded("ip", clientIp, getCount(0), IP_MAX);
      await logIfThresholdExceeded("email", userEmail, getCount(1), EMAIL_MAX);
      await logIfThresholdExceeded("code", codeHash, getCount(2), CODE_MAX);
      return jsonError("Invite code is not valid for this account.", 403);
    }

    // Check expiry
    const expiresAt: unknown = invite.expiresAt;
    if (expiresAt) {
      let expDate: Date | null = null;
      if (typeof (expiresAt as { toDate?: unknown })?.toDate === "function") {
        expDate = (expiresAt as { toDate: () => Date }).toDate();
      } else {
        const parsed = new Date(String(expiresAt));
        if (!isNaN(parsed.getTime())) expDate = parsed;
      }

      if (expDate && new Date() > expDate) {
        await logIfThresholdExceeded("ip", clientIp, getCount(0), IP_MAX);
        await logIfThresholdExceeded("email", userEmail, getCount(1), EMAIL_MAX);
        await logIfThresholdExceeded("code", codeHash, getCount(2), CODE_MAX);
        return jsonError("This invite has expired.", 400);
      }
    }

    // Determine final role: temporary invites must be worker
    const isTemporary = Boolean(invite.temporary === true || invite.temporary === "true");
    let finalRole = typeof invite.role === "string" ? invite.role.trim().toLowerCase() : "worker";
    if (isTemporary) finalRole = "worker";

    // Ensure role is valid and not elevated
    if (!isValidRole(finalRole)) finalRole = "worker";
    const disallowedForTemporary = new Set(["owner", "admin", "manager", "accountant", "viewer"]);
    if (isTemporary && disallowedForTemporary.has(finalRole)) {
      finalRole = "worker";
    }

    const assignedProjectIds = Array.isArray(invite.assignedProjectIds) ? invite.assignedProjectIds : [];
    const assignedWorkerIds = Array.isArray(invite.assignedWorkerIds) ? invite.assignedWorkerIds : [];

    const memberId = memberDocIdForEmail(userEmail);
    const memberDoc = memberRef(companyId, userEmail);
    if (!memberDoc) return jsonError("Firebase admin is not configured", 503);

    const FieldValue = (await import("firebase-admin/firestore")).FieldValue;

    let before: unknown | null = null;

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(memberDoc);
      before = existing.exists ? existing.data() : null;

      tx.set(
        memberDoc,
        {
          id: memberId,
          companyId,
          email: userEmail,
          role: finalRole,
          displayName:
            typeof session?.user?.name === "string" && session.user.name.trim()
              ? session.user.name.trim().slice(0, 120)
              : userEmail,
          invitedBy: typeof invite.invitedBy === "string" ? invite.invitedBy : invite.invitedBy || null,
          assignedSupervisor:
            typeof invite.assignedSupervisor === "string" ? invite.assignedSupervisor : null,
          workerSubRole: invite.workerSubRole || null,
          assignedProjectIds: assignedProjectIds,
          assignedWorkerIds: assignedWorkerIds,
          referralCode: invite.referralCode || null,
          inviteLink: invite.inviteLink || null,
          status: "active",
          temporary: isTemporary || false,
          createdAt: existing.exists
            ? existing.data()?.createdAt || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Mark the original invite as used and clear referral code/link to prevent reuse.
      try {
        const inviteRef = inviteDoc.ref;
        if (inviteRef) {
          tx.set(
            inviteRef,
            {
              status: "active",
              referralCode: null,
              inviteLink: null,
              usedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch {
        // ignore errors marking invite used; member creation should not fail for audit write errors
      }
    });

    await logAuditEntry({
      companyId,
      action: before ? "update" : "create",
      collection: "members",
      documentId: memberId,
      userId: userEmail,
      before,
      after: {
        id: memberId,
        companyId,
        email: userEmail,
        role: finalRole,
        invitedBy: invite.invitedBy || null,
        assignedProjectIds,
        assignedWorkerIds,
        temporary: isTemporary || false,
        status: "active",
      },
    });

    return NextResponse.json({ ok: true, role: finalRole });
  } catch (error) {
    return jsonRouteError(error, request);
  }
}