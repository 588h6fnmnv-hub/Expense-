import { NextRequest, NextResponse } from "next/server";
import { getProfitAndLoss } from "@/lib/services/reports";
import { requirePermission } from "@/lib/permissions";
import { requireValidCompanyId } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await context.params;
    const safeCompanyId = requireValidCompanyId(companyId);

    await requirePermission({
      companyId: safeCompanyId,
      action: "finance:read",
    });

    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate") || new Date().toISOString().slice(0, 7) + "-01";
    const endDate = searchParams.get("endDate") || new Date().toISOString().slice(0, 10);

    const report = await getProfitAndLoss(safeCompanyId, startDate, endDate);
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
