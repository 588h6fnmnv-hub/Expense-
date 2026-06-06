import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { FieldValue } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { requirePermission } from "@/lib/permissions";
import {
  normalizeConstructionWorkerRole,
  normalizeMaterialCategory,
} from "@/lib/construction";
import { normalizePlan } from "@/lib/plans";
import { requireValidCompanyId } from "@/lib/security";
import {
  AccountBalances,
  CardItem,
  CompanyProfile,
  DailyWorkReport,
  MaterialItem,
  PaymentMethod,
  PersonAccount,
  PersonAccountEntry,
  ProjectExtraWork,
  ProjectSite,
  ReminderItem,
  Section,
  Transaction,
  TransactionType,
} from "@/lib/types";

export const runtime = "nodejs";

const transactionTypes: TransactionType[] = ["Income", "Expense", "Pay In", "Pay Out"];
const paymentMethods: PaymentMethod[] = ["UPI", "Cash", "Card"];
const sections: Section[] = ["Personal", "Business", "Account"];

const userDocId = (email: string) => encodeURIComponent(email.toLowerCase());

const numberOrZero = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const textOrEmpty = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 240) : "";

const personAccountNameKey = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const localDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const maskCardNumber = (value: unknown) => {
  const last4 = textOrEmpty(value).replace(/\D/g, "").slice(-4);
  return last4 ? `xxxx${last4}` : "";
};

const cardTypeOrUndefined = (value: unknown): CardItem["cardType"] =>
  value === "Credit" ? "Credit" : value === "Debit" ? "Debit" : undefined;

const normalizeTransactions = (value: unknown): Transaction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const transactions: Transaction[] = [];

  value.forEach((tx) => {
    if (!tx || typeof tx !== "object") {
      return;
    }

    const item = tx as Record<string, unknown>;
    const type = item.type;
    const method = item.method;
    const section = item.section;

    if (
      !transactionTypes.includes(type as TransactionType) ||
      !paymentMethods.includes(method as PaymentMethod) ||
      !sections.includes(section as Section)
    ) {
      return;
    }

    const id = textOrEmpty(item.id) || crypto.randomUUID();
    const sourceId =
      textOrEmpty(item.sourceId) ||
      (id.startsWith("email-") ? `gmail:${id.slice("email-".length)}` : "");

    transactions.push({
      id,
      companyId: textOrEmpty(item.companyId),
      sourceId,
      title: textOrEmpty(item.title) || "Untitled",
      amount: numberOrZero(item.amount),
      type: type as TransactionType,
      method: method as PaymentMethod,
      section: section as Section,
      selectedCard: textOrEmpty(item.selectedCard),
      category: textOrEmpty(item.category),
      person: textOrEmpty(item.person),
      fromAccount: textOrEmpty(item.fromAccount),
      toAccount: textOrEmpty(item.toAccount),
      projectId: textOrEmpty(item.projectId),
      date: textOrEmpty(item.date) || localDateValue(),
      time: textOrEmpty(item.time),
    });
  });

  return transactions;
};

const normalizeCards = (value: unknown): CardItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const cards: CardItem[] = [];

  value.forEach((card) => {
    if (!card || typeof card !== "object") {
      return;
    }

    const item = card as Record<string, unknown>;
    const name = textOrEmpty(item.name);
    const repaymentDay = numberOrZero(item.repaymentDay);

    if (!name) {
      return;
    }

    cards.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      name,
      number: maskCardNumber(item.number),
      expiry: textOrEmpty(item.expiry),
      cardType: cardTypeOrUndefined(item.cardType),
      repaymentDay:
        repaymentDay >= 1 && repaymentDay <= 31 ? repaymentDay : undefined,
      upiId: textOrEmpty(item.upiId),
    });
  });

  return cards;
};

const normalizeAccountBalances = (value: unknown): AccountBalances => {
  if (!value || typeof value !== "object") {
    return { cash: 0, upi: 0, upis: {}, cards: {} };
  }

  const item = value as Record<string, unknown>;
  const cards =
    item.cards && typeof item.cards === "object" && !Array.isArray(item.cards)
      ? Object.fromEntries(
          Object.entries(item.cards as Record<string, unknown>)
            .map(([name, amount]) => [textOrEmpty(name), numberOrZero(amount)])
            .filter(([name]) => name)
        )
      : {};
  const upis =
    item.upis && typeof item.upis === "object" && !Array.isArray(item.upis)
      ? Object.fromEntries(
          Object.entries(item.upis as Record<string, unknown>)
            .map(([name, amount]) => [textOrEmpty(name), numberOrZero(amount)])
            .filter(([name]) => name)
        )
      : {};

  return {
    cash: numberOrZero(item.cash),
    upi: numberOrZero(item.upi),
    upis,
    cards,
  };
};

const normalizePersonAccounts = (value: unknown): PersonAccount[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const accounts: PersonAccount[] = [];

  value.forEach((account) => {
    if (!account || typeof account !== "object") {
      return;
    }

    const item = account as Record<string, unknown>;
    const name = textOrEmpty(item.name);
    const amount = numberOrZero(item.amount);

    if (!name || amount < 0) {
      return;
    }

    const nextAccount: PersonAccount = {
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      companyId: textOrEmpty(item.companyId),
      name,
      phone: textOrEmpty(item.phone),
      amount,
      direction: item.direction === "Payable" ? "Payable" : "Receivable",
      note: textOrEmpty(item.note),
      date: textOrEmpty(item.date) || localDateValue(),
      entries: normalizePersonAccountEntries(item.entries),
      role: "worker",
      invitedBy: textOrEmpty(item.invitedBy),
      assignedSupervisor: textOrEmpty(item.assignedSupervisor),
      workerSubRole: normalizeConstructionWorkerRole(item.workerSubRole),
      projectId: textOrEmpty(item.projectId),
      dailyWage: Math.max(0, numberOrZero(item.dailyWage)),
      monthlyWage: Math.max(0, numberOrZero(item.monthlyWage)),
      status: item.status === "Inactive" ? "Inactive" : "Active",
      referralCode: textOrEmpty(item.referralCode),
    };
    const duplicateIndex = accounts.findIndex(
      (savedAccount) =>
        personAccountNameKey(savedAccount.name) === personAccountNameKey(name)
    );

    if (duplicateIndex >= 0) {
      const savedAccount = accounts[duplicateIndex];
      const savedOpening =
        savedAccount.direction === "Payable"
          ? -savedAccount.amount
          : savedAccount.amount;
      const nextOpening =
        nextAccount.direction === "Payable"
          ? -nextAccount.amount
          : nextAccount.amount;
      const mergedOpening = savedOpening + nextOpening;

      accounts[duplicateIndex] = {
        ...savedAccount,
        amount: Math.abs(mergedOpening),
        direction: mergedOpening < 0 ? "Payable" : "Receivable",
        note: [savedAccount.note, nextAccount.note].filter(Boolean).join(" / "),
        entries: [
          ...(savedAccount.entries || []),
          ...(nextAccount.entries || []),
        ],
      };
      return;
    }

    accounts.push(nextAccount);
  });

  return accounts;
};

const normalizePersonAccountEntries = (value: unknown): PersonAccountEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: PersonAccountEntry[] = [];

  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const item = entry as Record<string, unknown>;
    const amount = numberOrZero(item.amount);

    if (amount <= 0) {
      return;
    }

    entries.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      amount,
      direction: item.direction === "Credit" ? "Credit" : "Debit",
      method: paymentMethods.includes(item.method as PaymentMethod)
        ? (item.method as PaymentMethod)
        : "UPI",
      narration: textOrEmpty(item.narration),
      date: textOrEmpty(item.date) || localDateValue(),
      projectId: textOrEmpty(item.projectId),
    });
  });

  return entries;
};

const normalizeProjectExtras = (value: unknown): ProjectExtraWork[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const extras: ProjectExtraWork[] = [];

  value.forEach((extra) => {
    if (!extra || typeof extra !== "object") {
      return;
    }

    const item = extra as Record<string, unknown>;
    const title = textOrEmpty(item.title);
    const amount = numberOrZero(item.amount);

    if (!title || amount <= 0) {
      return;
    }

    extras.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      title,
      amount,
      date: textOrEmpty(item.date) || localDateValue(),
    });
  });

  return extras;
};

const normalizeProjects = (value: unknown): ProjectSite[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const projects: ProjectSite[] = [];

  value.forEach((project) => {
    if (!project || typeof project !== "object") {
      return;
    }

    const item = project as Record<string, unknown>;
    const name = textOrEmpty(item.name);

    if (!name) {
      return;
    }

    projects.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      companyId: textOrEmpty(item.companyId),
      name,
      budget: numberOrZero(item.budget),
      customer: textOrEmpty(item.customer),
      status:
        item.status === "Paused" || item.status === "Completed"
          ? item.status
          : "Active",
      note: textOrEmpty(item.note),
      date: textOrEmpty(item.date) || localDateValue(),
      extras: normalizeProjectExtras(item.extras),
    });
  });

  return projects;
};

const normalizeCompany = (value: unknown): CompanyProfile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const name = textOrEmpty(item.name);
  const ownerEmail = textOrEmpty(item.ownerEmail);

  if (!name && !ownerEmail) {
    return null;
  }

  const role =
    item.role === "Manager" ||
    item.role === "Accountant" ||
    item.role === "Viewer"
      ? item.role
      : "Owner";

  return {
    id: textOrEmpty(item.id) || crypto.randomUUID(),
    name: name || "My Company",
    ownerEmail,
    plan: normalizePlan(item.plan),
    role,
  };
};

const normalizeMaterials = (value: unknown): MaterialItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const materials: MaterialItem[] = [];

  value.forEach((material) => {
    if (!material || typeof material !== "object") {
      return;
    }

    const item = material as Record<string, unknown>;
    const name = textOrEmpty(item.name);

    if (!name) {
      return;
    }

    materials.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      companyId: textOrEmpty(item.companyId),
      projectId: textOrEmpty(item.projectId),
      category: normalizeMaterialCategory(item.category),
      name,
      quantity: Math.max(0, numberOrZero(item.quantity)),
      usedQuantity: Math.max(0, numberOrZero(item.usedQuantity)),
      lowStockAt: Math.max(0, numberOrZero(item.lowStockAt)),
      unit: textOrEmpty(item.unit) || "pcs",
      rate: Math.max(0, numberOrZero(item.rate)),
      supplier: textOrEmpty(item.supplier),
      date: textOrEmpty(item.date) || localDateValue(),
      note: textOrEmpty(item.note),
    });
  });

  return materials;
};

const normalizeReminders = (value: unknown): ReminderItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const reminders: ReminderItem[] = [];

  value.forEach((reminder) => {
    if (!reminder || typeof reminder !== "object") {
      return;
    }

    const item = reminder as Record<string, unknown>;
    const title = textOrEmpty(item.title);
    const type =
      item.type === "payment" ||
      item.type === "worker_payment" ||
      item.type === "material_reorder" ||
      item.type === "bill_due" ||
      item.type === "general"
        ? item.type
        : "general";

    if (!title) {
      return;
    }

    const amount =
      item.amount === undefined || item.amount === null
        ? undefined
        : Math.max(0, numberOrZero(item.amount));

    reminders.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      companyId: textOrEmpty(item.companyId),
      title,
      dueDate: textOrEmpty(item.dueDate) || localDateValue(),
      projectId: textOrEmpty(item.projectId),
      amount,
      note: textOrEmpty(item.note),
      done: Boolean(item.done),
      type,
      targetId: textOrEmpty(item.targetId),
      notifyAt: textOrEmpty(item.notifyAt),
      notificationReady: Boolean(item.notificationReady),
    });
  });

  return reminders;
};

const normalizeDailyReports = (value: unknown): DailyWorkReport[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const reports: DailyWorkReport[] = [];

  value.forEach((report) => {
    if (!report || typeof report !== "object") {
      return;
    }

    const item = report as Record<string, unknown>;
    const workerName = textOrEmpty(item.workerName);
    const workDescription = textOrEmpty(item.workDescription);

    if (!workerName && !workDescription) {
      return;
    }

    const status =
      item.status === "Submitted" || item.status === "Reviewed"
        ? item.status
        : "Draft";

    reports.push({
      id: textOrEmpty(item.id) || crypto.randomUUID(),
      companyId: textOrEmpty(item.companyId),
      date: textOrEmpty(item.date) || localDateValue(),
      projectId: textOrEmpty(item.projectId),
      workerId: textOrEmpty(item.workerId),
      workerName: workerName || "Worker",
      workerRole: normalizeConstructionWorkerRole(item.workerRole),
      workDescription: workDescription || "Daily work report",
      materialsUsed: textOrEmpty(item.materialsUsed),
      hoursWorked: Math.max(0, numberOrZero(item.hoursWorked)),
      paymentAdvance: Math.max(0, numberOrZero(item.paymentAdvance)),
      issues: textOrEmpty(item.issues),
      nextWorkPlan: textOrEmpty(item.nextWorkPlan),
      photosNote: textOrEmpty(item.photosNote),
      status,
      createdBy: textOrEmpty(item.createdBy),
      reviewedBy: textOrEmpty(item.reviewedBy),
      createdAt: textOrEmpty(item.createdAt),
      updatedAt: textOrEmpty(item.updatedAt),
    });
  });

  return reports;
};

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => textOrEmpty(item)).filter(Boolean)
    : [];

const normalizeWallet = (body: Record<string, unknown>) => ({
  profileName: textOrEmpty(body.profileName),
  transactions: normalizeTransactions(body.transactions),
  cards: normalizeCards(body.cards),
  upiAccounts: normalizeCards(body.upiAccounts),
  personAccounts: normalizePersonAccounts(body.personAccounts),
  projects: normalizeProjects(body.projects),
  company: normalizeCompany(body.company),
  materials: normalizeMaterials(body.materials),
  reminders: normalizeReminders(body.reminders),
  dailyReports: normalizeDailyReports(body.dailyReports),
  accountBalances: normalizeAccountBalances(body.accountBalances),
  personalBalance: numberOrZero(body.personalBalance),
  businessBalance: numberOrZero(body.businessBalance),
  theme: body.theme === "dark" ? "dark" : "light",
  deletedSourceIds: normalizeStringArray(body.deletedSourceIds),
});

const getWalletContext = async () => {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }

  const db = getAdminDb();

  if (!db) {
    return {
      error: NextResponse.json(
        { error: "Firebase is not configured", configured: false },
        { status: 503 }
      ),
    };
  }

  return {
    email,
    name: session.user?.name || email,
    ref: db.collection("wallets").doc(userDocId(email)),
  };
};

const companyWalletRef = (
  db: ReturnType<typeof getAdminDb>,
  companyId: string,
  email: string
) => {
  if (!db) return null;
  return db
    .collection("companies")
    .doc(encodeURIComponent(companyId))
    .collection("wallets")
    .doc(userDocId(email));
};

export async function GET() {
  const context = await getWalletContext();

  if ("error" in context) {
    return context.error;
  }

  const snapshot = await context.ref.get();
  const legacyWallet = snapshot.exists ? snapshot.data()?.wallet || null : null;

  // If the stored wallet indicates a company, try to read the company-scoped wallet
  if (legacyWallet && legacyWallet.company && legacyWallet.company.id) {
    try {
      const db = getAdminDb();
      if (db) {
        const companyId = requireValidCompanyId(legacyWallet.company.id);

        await requirePermission({
          companyId,
          action: "company:read",
        });

        const companyRef = companyWalletRef(
          db,
          companyId,
          context.email
        );

        if (!companyRef) return NextResponse.json({ configured: true, wallet: legacyWallet });

        const companySnap = await companyRef.get();
        const companyWallet = companySnap.exists
          ? (companySnap.data()?.wallet as unknown as typeof legacyWallet) || null
          : null;

        // Prefer company-scoped wallet but include legacy as fallback for migration
        return NextResponse.json({
          configured: true,
          wallet: companyWallet || legacyWallet,
          legacyWallet: companyWallet ? legacyWallet : null,
        });
      }
    } catch {
      // ignore and fall back to legacy wallet
    }
  }

  return NextResponse.json({ configured: true, wallet: legacyWallet });
}

export async function POST(request: Request) {
  const context = await getWalletContext();

  if ("error" in context) {
    return context.error;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const wallet = normalizeWallet(body);

  // Write to the legacy per-user wallets collection (migration fallback)
  await context.ref.set(
    {
      email: context.email,
      username: context.name,
      wallet,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // If the wallet contains a company id, also write to the company-scoped collection
  if (wallet.company && wallet.company.id) {
    const db = getAdminDb();
    if (db) {
      try {
        const companyId = requireValidCompanyId(wallet.company.id);

        await requirePermission({
          companyId,
          action: "company:write",
        });

        const companyRef = companyWalletRef(
          db,
          companyId,
          context.email
        );

        if (companyRef) {
          await companyRef.set(
            {
              email: context.email,
              username: context.name,
              wallet,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch {
        // If company write fails, keep legacy write as fallback; do not throw
      }
    }
  }

  return NextResponse.json({ ok: true, configured: true });
}
