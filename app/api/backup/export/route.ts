import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { requirePermission } from "@/lib/permissions";
import {
  jsonError,
  jsonRouteError,
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

    await requirePermission({
      companyId,
      action: "backup:export",
    });

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

    const company = companySnap.data() || null;

    const members = membersSnap.docs.map((d) => d.data());

    // For now, export data only if collections exist (some may be absent in early phases).
    const transactions = transactionsSnap?.docs?.map((d) => d.data()) || [];
    const sites = sitesSnap?.docs?.map((d) => d.data()) || [];
    const workers = workersSnap?.docs?.map((d) => d.data()) || [];
    const materials = materialsSnap?.docs?.map((d) => d.data()) || [];
    const bills = billsSnap?.docs?.map((d) => d.data()) || [];
    const reminders = remindersSnap?.docs?.map((d) => d.data()) || [];
    const dailyReports = dailyReportsSnap?.docs?.map((d) => d.data()) || [];
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
    return jsonRouteError(error);
  }
}
