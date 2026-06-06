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

    await requirePermission({
      companyId,
      action: "admin:stats",
    });

    const db = getAdminDb();
    if (!db) return jsonError("Firebase admin is not configured", 503);

    const companyRef = db.collection("companies").doc(encodeURIComponent(companyId));

    const [membersSnap, auditSnap, transactionsSnap, sitesSnap, workersSnap, materialsSnap, billsSnap, remindersSnap] =
      await Promise.all([
        companyRef.collection("members").get(),
        companyRef.collection("auditLogs").get(),
        companyRef.collection("transactions").get().catch(() => null),
        companyRef.collection("sites").get().catch(() => null),
        companyRef.collection("workers").get().catch(() => null),
        companyRef.collection("materials").get().catch(() => null),
        companyRef.collection("bills").get().catch(() => null),
        companyRef.collection("reminders").get().catch(() => null),
      ]);

    return NextResponse.json({
      ok: true,
      companyId,
      members: membersSnap.size,
      auditLogs: auditSnap.size,
      transactions: transactionsSnap?.size ?? 0,
      sites: sitesSnap?.size ?? 0,
      workers: workersSnap?.size ?? 0,
      materials: materialsSnap?.size ?? 0,
      bills: billsSnap?.size ?? 0,
      reminders: remindersSnap?.size ?? 0,
    });
  } catch (error) {
    return jsonRouteError(error);
  }
}
