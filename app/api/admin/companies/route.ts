import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { jsonError, jsonRouteError } from "@/lib/security";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// Guard: verify that caller is a platform super-admin
async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "super-admin") {
    throw Object.assign(new Error("Unauthorized. Super Admin access required."), { status: 403 });
  }
  return session.user.email || "super-admin";
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    // Get all companies
    const companiesSnap = await db.collection("companies").get();
    const companies = companiesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Get all users
    const usersSnap = await db.collection("users").get();
    const users = usersSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        username: data.username || d.id,
        email: data.email || "",
        role: data.role || "worker",
        companyId: data.companyId || "",
        active: data.active !== false,
        mustChangePassword: Boolean(data.mustChangePassword),
        lastLogin: data.lastLogin || "",
      };
    });

    return NextResponse.json({ ok: true, companies, users });
  } catch (error) {
    return jsonRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const adminEmail = await requireSuperAdmin();
    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const body = await request.json().catch(() => ({}));
    const { type } = body;

    const FieldValue = (await import("firebase-admin/firestore")).FieldValue;
    const timestamp = FieldValue.serverTimestamp();

    if (type === "create-company") {
      const { companyName, ownerUsername, tempPassword } = body;

      if (!companyName || !ownerUsername || !tempPassword) {
        return jsonError("Missing required parameters.", 400);
      }

      const normalizedUsername = ownerUsername.trim().toLowerCase();

      // Check if username already exists in usernames collection or users collection
      const usernameDocRef = db.collection("usernames").doc(normalizedUsername);
      const usernameSnap = await usernameDocRef.get();
      if (usernameSnap.exists) {
        return jsonError(`Username '${ownerUsername}' is already taken.`, 400);
      }

      const companyId = crypto.randomUUID();
      const ownerEmail = `${normalizedUsername}@ledge.local`;
      const passwordHash = bcrypt.hashSync(tempPassword, 10);

      await db.runTransaction(async (tx) => {
        // Create company document
        const companyRef = db.collection("companies").doc(companyId);
        tx.set(companyRef, {
          id: companyId,
          name: companyName,
          ownerEmail,
          plan: "Pro",
          suspended: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        // Create owner user document
        const userRef = db.collection("users").doc(ownerEmail);
        tx.set(userRef, {
          id: ownerEmail,
          username: normalizedUsername,
          email: ownerEmail,
          passwordHash,
          role: "owner",
          companyId,
          active: true,
          mustChangePassword: true,
          createdBy: adminEmail,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        // Create username lookup doc
        tx.set(usernameDocRef, {
          email: ownerEmail,
          createdAt: timestamp,
        });

        // Create the company owner members subcollection doc to align with multi-tenant company CRUD
        const memberRef = db.collection("companies").doc(companyId).collection("members").doc(normalizedUsername);
        tx.set(memberRef, {
          id: normalizedUsername,
          companyId,
          email: ownerEmail,
          role: "owner",
          displayName: companyName + " Owner",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });

      return NextResponse.json({ ok: true, companyId });
    }

    if (type === "suspend-company") {
      const { companyId, suspend } = body;
      if (!companyId) return jsonError("companyId is required", 400);

      const companyRef = db.collection("companies").doc(companyId);
      await companyRef.update({
        suspended: suspend === true,
        updatedAt: timestamp,
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "delete-company") {
      const { companyId } = body;
      if (!companyId) return jsonError("companyId is required", 400);

      // Simple delete company doc (users are suspended or can be deleted manually)
      await db.collection("companies").doc(companyId).delete();
      return NextResponse.json({ ok: true });
    }

    if (type === "reset-owner-password") {
      const { ownerUsername, tempPassword } = body;
      if (!ownerUsername || !tempPassword) return jsonError("Missing parameters", 400);

      const normalizedUsername = ownerUsername.trim().toLowerCase();
      const usernameSnap = await db.collection("usernames").doc(normalizedUsername).get();
      if (!usernameSnap.exists) return jsonError("Username not found", 404);

      const ownerEmail = usernameSnap.data()?.email;
      if (!ownerEmail) return jsonError("Email not resolved", 404);

      const passwordHash = bcrypt.hashSync(tempPassword, 10);
      await db.collection("users").doc(ownerEmail).update({
        passwordHash,
        mustChangePassword: true,
        updatedAt: timestamp,
      });

      return NextResponse.json({ ok: true });
    }

    return jsonError("Invalid action type", 400);
  } catch (error) {
    return jsonRouteError(error);
  }
}
