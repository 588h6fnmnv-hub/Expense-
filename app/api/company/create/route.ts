import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizePlan } from "@/lib/plans";
import { memberDocIdForEmail, memberRef } from "@/lib/saas";
import { logAuditEntry } from "@/lib/audit-log";
import {
  cleanDisplayText,
  jsonError,
  jsonRouteError,
  normalizeEmail,
  parseJsonObject,
} from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = normalizeEmail(session?.user?.email);

    if (!email) return jsonError("Not signed in", 401);

    const body = await parseJsonObject(request);
    const companyName = cleanDisplayText(body.name, 120);

    if (!companyName) return jsonError("company name is required", 400);

    // Generate stable server-side companyId
    const companyId = crypto.randomUUID();

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const companyDoc = db.collection("companies").doc(encodeURIComponent(companyId));
    const memberDoc = memberRef(companyId, email);

    if (!memberDoc) return jsonError("Firebase admin is not configured", 503);

    // Ensure this user isn't already an owner in a company via this endpoint.
    // (Optional behavior; can be removed if you support multi-company.)
    // We'll just proceed without checking to avoid extra reads.

    await db.runTransaction(async (tx) => {
      const timestamp = (await import("firebase-admin/firestore")).FieldValue.serverTimestamp();

      tx.set(companyDoc, {
        id: companyId,
        name: companyName,
        ownerEmail: email,
        plan: normalizePlan(body.plan),
        createdAt: timestamp,
      });

      tx.set(memberDoc, {
        id: memberDocIdForEmail(email),
        companyId,
        email,
        role: "owner",
        displayName: cleanDisplayText(session?.user?.name, 120) || email,
        invitedBy: null,
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    await logAuditEntry({
      companyId,
      action: "create",
      collection: "companies",
      documentId: companyId,
      userId: email,
      before: null,
      after: { id: companyId, name: companyName, ownerEmail: email },
    });

    return NextResponse.json({ ok: true, companyId });
  } catch (error) {
    return jsonRouteError(error);
  }
}
