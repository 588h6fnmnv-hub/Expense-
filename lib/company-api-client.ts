export {
  listCompanyDocuments,
  postCompanyDocument,
  syncWalletToCompanySubcollections,
  walletToCompanyCollections,
} from "@/lib/services/company-data";
export type {
  CompanyDataCollectionName as CompanyApiCollectionName,
  CompanySyncResult,
} from "@/lib/services/company-data";
