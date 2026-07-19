import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { jsonError, jsonRouteError, logSecurityEvent } from "@/lib/security";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// Helper to secure endpoints and check company isolation
async function validateCompanyAdminAccess(companyId: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw Object.assign(new Error("Not signed in"), { status: 401 });
  }

  const role = session.user.role;
  const sessionCompanyId = session.user.companyId;

  if (role !== "owner" && role !== "admin") {
    throw Object.assign(new Error("Forbidden. Owner or Admin permissions required."), { status: 403 });
  }

  if (sessionCompanyId !== companyId) {
    throw Object.assign(new Error("Forbidden. Multi-tenant company isolation violation."), { status: 403 });
  }

  return session.user.email || "owner";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || "";

    if (!companyId) return jsonError("companyId is required", 400);

    await validateCompanyAdminAccess(companyId);

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const usersSnap = await db.collection("users").where("companyId", "==", companyId).get();
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

    return NextResponse.json({ ok: true, users });
  } catch (error) {
    return jsonRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyId = body.companyId || "";

    if (!companyId) return jsonError("companyId is required", 400);

    const adminEmail = await validateCompanyAdminAccess(companyId);

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const { type } = body;

    const FieldValue = (await import("firebase-admin/firestore")).FieldValue;
    const timestamp = FieldValue.serverTimestamp();

    if (type === "create-user") {
      const { username, tempPassword, role, name } = body;

      if (!username || !tempPassword || !role) {
        return jsonError("Missing required parameters.", 400);
      }

      const normalizedUsername = username.trim().toLowerCase();

      // Enforce username uniqueness
      const usernameDocRef = db.collection("usernames").doc(normalizedUsername);
      const usernameSnap = await usernameDocRef.get();
      if (usernameSnap.exists) {
        return jsonError(`Username '${username}' is already taken.`, 400);
      }

      const userEmail = `${normalizedUsername}@ledge.local`;
      const passwordHash = bcrypt.hashSync(tempPassword, 10);

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(userEmail);
        tx.set(userRef, {
          id: userEmail,
          username: normalizedUsername,
          email: userEmail,
          name: name || username,
          passwordHash,
          role,
          companyId,
          active: true,
          mustChangePassword: true,
          createdBy: adminEmail,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        // Set username lookup
        tx.set(usernameDocRef, {
          email: userEmail,
          createdAt: timestamp,
        });

        // Also add/align to the company members subcollection
        const memberRef = db.collection("companies").doc(companyId).collection("members").doc(normalizedUsername);
        tx.set(memberRef, {
          id: normalizedUsername,
          companyId,
          email: userEmail,
          role,
          displayName: name || username,
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "edit-user") {
      const { username, active, role, name } = body;
      if (!username) return jsonError("username is required", 400);

      const normalizedUsername = username.trim().toLowerCase();
      const usernameSnap = await db.collection("usernames").doc(normalizedUsername).get();
      if (!usernameSnap.exists) return jsonError("Username not found", 404);

      const userEmail = usernameSnap.data()?.email;
      if (!userEmail) return jsonError("Email resolution failed", 404);

      const updates: Record<string, unknown> = {
        updatedAt: timestamp,
      };

      if (active !== undefined) updates.active = active === true;
      if (role !== undefined) updates.role = role;
      if (name !== undefined) updates.name = name;

      let isIsolated = true;

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(userEmail);
        const userSnap = await tx.get(userRef);

        if (!userSnap.exists) {
          isIsolated = false;
          return;
        }

        const userData = userSnap.data();
        if (userData?.companyId !== companyId) {
          isIsolated = false;
          return;
        }

        tx.update(userRef, updates);

        const memberRef = db.collection("companies").doc(companyId).collection("members").doc(normalizedUsername);
        const memberUpdates: Record<string, unknown> = {
          updatedAt: timestamp,
        };
        if (active !== undefined) memberUpdates.status = active ? "active" : "disabled";
        if (role !== undefined) memberUpdates.role = role;
        if (name !== undefined) memberUpdates.displayName = name;

        tx.update(memberRef, memberUpdates);
      });

      if (!isIsolated) {
        await logSecurityEvent({
          type: "suspicious_traffic",
          request,
          companyId,
          userEmail: adminEmail,
          metadata: {
            action: "edit-user",
            targetUsername: normalizedUsername,
            targetEmail: userEmail,
            error: "Cross-tenant access attempt blocked",
          },
        });
        return jsonError("Forbidden. Multi-tenant company isolation violation.", 403);
      }

      return NextResponse.json({ ok: true });
    }

    if (type === "reset-password") {
      const { username, tempPassword } = body;
      if (!username || !tempPassword) return jsonError("Missing parameters", 400);

      const normalizedUsername = username.trim().toLowerCase();
      const usernameSnap = await db.collection("usernames").doc(normalizedUsername).get();
      if (!usernameSnap.exists) return jsonError("Username not found", 404);

      const userEmail = usernameSnap.data()?.email;
      if (!userEmail) return jsonError("Email resolution failed", 404);

      const passwordHash = bcrypt.hashSync(tempPassword, 10);
      let isIsolated = true;

      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(userEmail);
        const userSnap = await tx.get(userRef);

        if (!userSnap.exists) {
          isIsolated = false;
          return;
        }

        const userData = userSnap.data();
        if (userData?.companyId !== companyId) {
          isIsolated = false;
          return;
        }

        tx.update(userRef, {
          passwordHash,
          mustChangePassword: true,
          updatedAt: timestamp,
        });
      });

      if (!isIsolated) {
        await logSecurityEvent({
          type: "suspicious_traffic",
          request,
          companyId,
          userEmail: adminEmail,
          metadata: {
            action: "reset-password",
            targetUsername: normalizedUsername,
            targetEmail: userEmail,
            error: "Cross-tenant access attempt blocked",
          },
        });
        return jsonError("Forbidden. Multi-tenant company isolation violation.", 403);
      }

      return NextResponse.json({ ok: true });
    }

    return jsonError("Invalid action type", 400);
  } catch (error) {
    return jsonRouteError(error, request);
  }
}
