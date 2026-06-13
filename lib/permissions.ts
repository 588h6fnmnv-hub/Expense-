import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { FieldValue } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { memberDocIdForEmail, encodeFirestoreId } from "@/lib/saas";
import { normalizePlan } from "@/lib/plans";
import { requireValidCompanyId } from "@/lib/security";

export type Role =
  | "owner"
  | "admin"
  | "supervisor"
  | "worker"
  | "manager"
  | "accountant"
  | "viewer";

export const roles: Role[] = [
  "owner",
  "admin",
  "supervisor",
  "worker",
  "manager",
  "accountant",
  "viewer",
];

export const roleLabels: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  supervisor: "Supervisor",
  worker: "Worker",
  manager: "Manager",
  accountant: "Accountant",
  viewer: "Viewer",
};

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && roles.includes(value as Role);

export const normalizeRole = (value: unknown): Role | null => {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return isRole(lower) ? lower : null;
};

export const roleToPermissionRank: Record<Role, number> = {
  owner: 4,
  admin: 4,
  manager: 3,
  supervisor: 2,
  accountant: 2,
  viewer: 1,
  worker: 0,
};

export const isAtLeastRole = (role: Role, minRole: Role) =>
  roleToPermissionRank[role] >= roleToPermissionRank[minRole];

const workerAllowedActions = new Set([
  "workerReports:write",
  "dailyReports:write",
  "tasks:write",
  "reminders:write",
]);

const supervisorDeniedActions = new Set([
  "admin:stats",
  "backup:export",
  "backup:import",
  "audit:read",
  "audit:write",
  "reports:analytics",
]);

export const canRolePerform = (role: Role, action: string) => {
  if (role === "owner" || role === "admin") return true;
  if (role === "worker") return workerAllowedActions.has(action);
  if (role === "supervisor" && supervisorDeniedActions.has(action)) return false;

  return isAtLeastRole(role, actionToMinRole[action] || "viewer");
};

export const minRoleForAction = (action: string) =>
  actionToMinRole[action] || "viewer";

export const actionToMinRole: Record<string, Role> = {
  "company:read": "viewer",
  "company:create": "owner",
  "company:write": "manager",
  "members:read": "admin",
  "members:write": "admin",
  "invite:create": "admin",
  "admin:stats": "owner",
  "backup:export": "admin",
  "backup:import": "admin",
  "audit:read": "accountant",
  "audit:write": "accountant",
  "transactions:read": "viewer",
  "transactions:write": "accountant",
  "sites:read": "viewer",
  "sites:write": "accountant",
  "workers:read": "viewer",
  "workers:write": "supervisor",
  "materials:read": "viewer",
  "materials:write": "accountant",
  "bills:read": "viewer",
  "bills:write": "accountant",
  "reminders:read": "viewer",
  "reminders:write": "supervisor",
  "dailyReports:read": "viewer",
  "dailyReports:write": "worker",
  "workerReports:write": "worker",
  "tasks:write": "worker",
  "reports:analytics": "accountant",
};

export type PermissionResult = {
  role: Role;
  email: string;
  member?: Record<string, unknown> | null;
  assignedProjectIds?: string[];
  assignedWorkerIds?: string[];
};

export const getUserEmail = async (): Promise<string | null> => {
  const session = await getServerSession(authOptions as NextAuthOptions);
  const email = session?.user?.email;
  return typeof email === "string" && email ? email.toLowerCase() : null;
};

export const getMemberRole = async ({
  companyId,
  memberEmail,
}: {
  companyId: string;
  memberEmail: string;
}): Promise<Role | null> => {
  const db = getAdminDb();
  if (!db) return null;

  const snap = await db
    .collection("companies")
    .doc(encodeFirestoreId(companyId))
    .collection("members")
    .doc(memberDocIdForEmail(memberEmail))
    .get();

  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return isRole(role) ? role : null;
};

const legacyWalletDocIdForEmail = (email: string) =>
  encodeURIComponent(email.toLowerCase());

const ensureLegacyWalletCompanyOwner = async ({
  companyId,
  email,
}: {
  companyId: string;
  email: string;
}): Promise<Role | null> => {
  const db = getAdminDb();
  if (!db) return null;

  const encodedCompanyId = encodeFirestoreId(companyId);
  const walletSnap = await db
    .collection("wallets")
    .doc(legacyWalletDocIdForEmail(email))
    .get();

  if (!walletSnap.exists) return null;

  const walletData = walletSnap.data()?.wallet as
    | {
        profileName?: unknown;
        company?: {
          id?: unknown;
          name?: unknown;
          ownerEmail?: unknown;
          plan?: unknown;
        };
      }
    | undefined;
  const company = walletData?.company;
  const walletCompanyId =
    typeof company?.id === "string" ? company.id.trim() : "";
  const ownerEmail =
    typeof company?.ownerEmail === "string"
      ? company.ownerEmail.toLowerCase()
      : email;

  if (walletCompanyId !== companyId || ownerEmail !== email) {
    return null;
  }

  const companyRef = db.collection("companies").doc(encodedCompanyId);
  const memberRef = companyRef.collection("members").doc(memberDocIdForEmail(email));
  const timestamp = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [companySnap, memberSnap] = await Promise.all([
      tx.get(companyRef),
      tx.get(memberRef),
    ]);

    if (!companySnap.exists) {
      tx.set(
        companyRef,
        {
          id: companyId,
          name:
            typeof company?.name === "string" && company.name.trim()
              ? company.name.trim()
              : "Ledge Company",
          ownerEmail: email,
          plan: normalizePlan(company?.plan),
          source: "legacy-wallet-fallback",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    }

    if (!memberSnap.exists) {
      tx.set(
        memberRef,
        {
          id: memberDocIdForEmail(email),
          companyId,
          email,
          role: "owner",
          displayName:
            typeof walletData?.profileName === "string" && walletData.profileName.trim()
              ? walletData.profileName.trim()
              : email,
          status: "active",
          source: "legacy-wallet-fallback",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    }
  });

  return "owner";
};

export const requireSignedInEmail = async () => {
  const email = await getUserEmail();
  if (!email) {
    throw Object.assign(new Error("Not signed in"), { status: 401 });
  }
  return email;
};

export const requirePermission = async ({
  companyId,
  action,
  allowSelfServiceCreateCompanyOwner = false,
}: {
  companyId: string;
  action: string;
  allowSelfServiceCreateCompanyOwner?: boolean;
}): Promise<PermissionResult> => {
  const safeCompanyId = requireValidCompanyId(companyId);
  const email = await requireSignedInEmail();
  const dbRole = await getMemberRole({ companyId: safeCompanyId, memberEmail: email });

  const role =
    dbRole ||
    (await ensureLegacyWalletCompanyOwner({
      companyId: safeCompanyId,
      email,
    }));

  if (!role) {
    if (allowSelfServiceCreateCompanyOwner && action === "company:create") {
      return { role: "owner", email };
    }
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  if (!canRolePerform(role, action)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  // Fetch member document if available so callers can apply assignment-level filters
  const db = getAdminDb();
  let member: Record<string, unknown> | null = null;
  let assignedProjectIds: string[] = [];
  let assignedWorkerIds: string[] = [];

  if (db) {
    try {
      const memberRef = db
        .collection("companies")
        .doc(encodeFirestoreId(safeCompanyId))
        .collection("members")
        .doc(memberDocIdForEmail(email));

      const snap = await memberRef.get();
      if (snap.exists) {
        // keep the raw member object for callers
        member = snap.data() as Record<string, unknown>;
        const pids = member?.assignedProjectIds;
        const wids = member?.assignedWorkerIds;
        if (Array.isArray(pids)) assignedProjectIds = pids.map((v) => String(v));
        if (Array.isArray(wids)) assignedWorkerIds = wids.map((v) => String(v));
      }
    } catch {
      // ignore member fetch errors; permission already validated
    }
  }

  return { role, email, member, assignedProjectIds, assignedWorkerIds };
};

export const errorToStatus = (error: unknown) => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : 500;
};

export const errorToMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";
