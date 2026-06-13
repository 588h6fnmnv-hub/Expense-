import { NextRequest } from "next/server";
import {
  createCompanyCollectionDocument,
  listCompanyCollection,
} from "@/lib/company-crud";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  return listCompanyCollection({
    request,
    companyId,
    collectionName: "suppliers",
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  return createCompanyCollectionDocument({
    request,
    companyId,
    collectionName: "suppliers",
  });
}
