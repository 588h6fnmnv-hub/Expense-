import { NextRequest } from "next/server";
import {
  createCompanyCollectionDocument,
  listCompanyCollection,
} from "@/lib/company-crud";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  return listCompanyCollection({
    request,
    companyId: params.companyId,
    collectionName: "bills",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  return createCompanyCollectionDocument({
    request,
    companyId: params.companyId,
    collectionName: "bills",
  });
}
