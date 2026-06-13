import type {
  MaterialItem,
  DailyWorkReport,
  PersonAccount,
  ProjectSite,
  ReminderItem,
  Transaction,
  WalletData,
} from "@/lib/types";

export type CompanyDataCollectionName =
  | "transactions"
  | "sites"
  | "workers"
  | "materials"
  | "bills"
  | "reminders"
  | "dailyReports";

export type CompanySyncResult = {
  collection: CompanyDataCollectionName;
  ok: number;
  failed: number;
};

type CompanyDocumentPayload = Record<string, unknown> & {
  id?: string;
  companyId?: string;
};

const companyApiPath = (
  companyId: string,
  collectionName: CompanyDataCollectionName
) =>
  `/api/company/company/${encodeURIComponent(companyId)}/${collectionName}`;

const withCompanyScope = <T extends CompanyDocumentPayload>(
  companyId: string,
  item: T,
  source = "wallet-sync"
) => ({
  ...item,
  companyId,
  source: item.source || source,
});

export const postCompanyDocument = async <T extends CompanyDocumentPayload>({
  companyId,
  collectionName,
  item,
}: {
  companyId: string;
  collectionName: CompanyDataCollectionName;
  item: T;
}) => {
  // Safety: do not post demo company data to remote collections
  if (companyId === "demo-company") {
    // skip posting demo data
    return { skipped: true } as unknown;
  }
  const response = await fetch(companyApiPath(companyId, collectionName), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCompanyScope(companyId, item)),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Failed to sync ${collectionName}`);
  }

  return payload;
};

export const listCompanyDocuments = async <T,>({
  companyId,
  collectionName,
}: {
  companyId: string;
  collectionName: CompanyDataCollectionName;
}): Promise<T[]> => {
  const response = await fetch(companyApiPath(companyId, collectionName), {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    items?: T[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Failed to load ${collectionName}`);
  }

  return Array.isArray(payload.items) ? payload.items : [];
};

const syncCollection = async ({
  companyId,
  collectionName,
  items,
}: {
  companyId: string;
  collectionName: CompanyDataCollectionName;
  items: CompanyDocumentPayload[];
}): Promise<CompanySyncResult> => {
  // Do not sync demo company data to remote
  if (companyId === "demo-company") {
    return { collection: collectionName, ok: items.length, failed: 0 };
  }

  let ok = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await postCompanyDocument({ companyId, collectionName, item });
      ok += 1;
    } catch {
      failed += 1;
    }
  }

  return { collection: collectionName, ok, failed };
};

const transactionToBill = (transaction: Transaction) => ({
  id: transaction.id,
  title: transaction.title,
  amount: transaction.amount,
  supplier:
    transaction.toAccount ||
    transaction.person ||
    transaction.title.replace(/^Bill - /, ""),
  billDate: transaction.date,
  projectId: transaction.projectId,
  note: transaction.category,
  source: "wallet-bill-sync",
});

const personAccountToWorker = (person: PersonAccount) => ({
  id: person.id,
  companyId: person.companyId,
  name: person.name,
  phone: person.phone,
  role: "worker",
  workerSubRole: person.workerSubRole || "Other",
  projectId: person.projectId,
  invitedBy: person.invitedBy,
  assignedSupervisor: person.assignedSupervisor,
  referralCode: person.referralCode,
  amount: person.amount,
  direction: person.direction,
  date: person.date,
  entries: person.entries || [],
  dailyWage: person.dailyWage || 0,
  monthlyWage: person.monthlyWage || 0,
  status: person.status || "Active",
  note: person.note,
  source: "wallet-person-sync",
});

export const walletToCompanyCollections = ({
  companyId,
  wallet,
}: {
  companyId: string;
  wallet: WalletData;
}) => ({
  transactions: wallet.transactions.map((item: Transaction) =>
    withCompanyScope(companyId, { ...item })
  ),
  sites: wallet.projects.map((item: ProjectSite) =>
    withCompanyScope(companyId, { ...item })
  ),
  workers: wallet.personAccounts.map((item: PersonAccount) =>
    withCompanyScope(companyId, personAccountToWorker(item))
  ),
  materials: wallet.materials.map((item: MaterialItem) =>
    withCompanyScope(companyId, { ...item })
  ),
  bills: wallet.transactions
    .filter((item) => item.category === "🧾 Bills")
    .map((item) => withCompanyScope(companyId, transactionToBill(item))),
  reminders: wallet.reminders.map((item: ReminderItem) =>
    withCompanyScope(companyId, { ...item })
  ),
  dailyReports: wallet.dailyReports.map((item: DailyWorkReport) =>
    withCompanyScope(companyId, { ...item })
  ),
});

export const syncWalletToCompanySubcollections = async ({
  companyId,
  wallet,
}: {
  companyId: string;
  wallet: WalletData;
}) => {
  if (!companyId) return [];

  const collections = walletToCompanyCollections({ companyId, wallet });

  return Promise.all([
    syncCollection({
      companyId,
      collectionName: "transactions",
      items: collections.transactions,
    }),
    syncCollection({ companyId, collectionName: "sites", items: collections.sites }),
    syncCollection({
      companyId,
      collectionName: "workers",
      items: collections.workers,
    }),
    syncCollection({
      companyId,
      collectionName: "materials",
      items: collections.materials,
    }),
    syncCollection({ companyId, collectionName: "bills", items: collections.bills }),
    syncCollection({
      companyId,
      collectionName: "reminders",
      items: collections.reminders,
    }),
    syncCollection({
      companyId,
      collectionName: "dailyReports",
      items: collections.dailyReports,
    }),
  ]);
};
