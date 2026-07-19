import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { jsonError, jsonRouteError, normalizeEmail } from "@/lib/security";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return jsonError("Not signed in", 401);
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!newPassword || newPassword.length < 6) {
      return jsonError("Password must be at least 6 characters.", 400);
    }

    const db = getAdminDb();
    if (!db) {
      return jsonError("Firebase admin is not configured", 503);
    }

    // Hash the password with bcryptjs
    const passwordHash = bcrypt.hashSync(newPassword, 10);

    const userRef = db.collection("users").doc(email);
    const snap = await userRef.get();

    if (!snap.exists) {
      // If doc not found, try query by email to find the true document
      const querySnap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (querySnap.empty) {
        return jsonError("User not found in system.", 404);
      }
      const doc = querySnap.docs[0];
      await doc.ref.update({
        passwordHash,
        mustChangePassword: false,
        updatedAt: (await import("firebase-admin/firestore")).FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.update({
        passwordHash,
        mustChangePassword: false,
        updatedAt: (await import("firebase-admin/firestore")).FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonRouteError(error);
  }
}
