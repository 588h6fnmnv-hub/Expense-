import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requirePermission } from "@/lib/permissions";
import { logAuditEntry } from "@/lib/audit-log";
import {
  enforceRateLimit,
  jsonError,
  jsonRouteError,
  redactSensitive,
  requireValidCompanyId,
} from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = requireValidCompanyId(searchParams.get("companyId"));

    if (companyId === "demo-company") {
      return jsonError("Backup export is disabled for demo company", 403);
    }

    const permission = await requirePermission({
      companyId,
      action: "backup:export",
    });

    await enforceRateLimit({ request, key: "backup:export", limit: 5, windowMs: 60 * 60_000, userEmail: permission.email });

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const cRef = db.collection("companies").doc(encodeURIComponent(companyId));

    const [
      companySnap,
      membersSnap,
      transactionsSnap,
      sitesSnap,
      workersSnap,
      materialsSnap,
      billsSnap,
      remindersSnap,
      dailyReportsSnap,
    ] = await Promise.all([
      cRef.get(),
      cRef.collection("members").get(),
      cRef.collection("transactions").get().catch(() => null),
      cRef.collection("sites").get().catch(() => null),
      cRef.collection("workers").get().catch(() => null),
      cRef.collection("materials").get().catch(() => null),
      cRef.collection("bills").get().catch(() => null),
      cRef.collection("reminders").get().catch(() => null),
      cRef.collection("dailyReports").get().catch(() => null),
    ]);

    if (!companySnap.exists) {
      return jsonError("Company not found", 404);
    }

    const company = redactSensitive(companySnap.data() || null);

    // Recursively strip invite secrets, tokens, API keys and credentials from all exported data.
    const members = membersSnap.docs.map((d) => redactSensitive(d.data()) as Record<string, unknown>);

    const sanitizeDocs = (snap: { docs?: Array<{ data: () => unknown }> } | null) =>
      snap?.docs?.map((d) => redactSensitive(d.data())) || [];

    const transactions = sanitizeDocs(transactionsSnap);
    const sites = sanitizeDocs(sitesSnap);
    const workers = sanitizeDocs(workersSnap);
    const materials = sanitizeDocs(materialsSnap);
    const bills = sanitizeDocs(billsSnap);
    const reminders = sanitizeDocs(remindersSnap);
    const dailyReports = sanitizeDocs(dailyReportsSnap);
    // Audit export action
    try {
      await logAuditEntry({
        companyId,
        action: "export",
        collection: "backup",
        userEmail: permission.email,
        before: null,
        after: { members: members.length },
      });
    } catch {
      // best-effort
    }

    return NextResponse.json({
      ok: true,
      format: "ledge-company-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      companyId,
      company,
      members,
      data: {
        transactions,
        sites,
        workers,
        materials,
        bills,
        reminders,
        dailyReports,
      },
    });
  } catch (error) {
    return jsonRouteError(error, request);
  }
}
