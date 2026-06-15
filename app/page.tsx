"use client";

import { signIn as googleSignIn, signOut, useSession } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import TabErrorBoundary from "@/components/shared/TabErrorBoundary";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Sidebar from "@/components/shared/Sidebar";
import HomeDashboard from "@/components/dashboard/HomeDashboard";
import SettingsView, { type CardDraft } from "@/components/settings/SettingsView";
import EntrySheet from "@/components/transactions/EntrySheet";
import MaterialTracker from "@/components/materials/MaterialTracker";
import ReminderCenter from "@/components/reminders/ReminderCenter";
import ReportsView from "@/components/reports/ReportsView";
import SitesView from "@/components/sites/SitesView";
import WorkersTab from "@/components/workers/WorkersTab";
import QuickActionSheet from "@/components/shared/QuickActionSheet";
import PeopleDashboard from "@/components/people/PeopleDashboard";
import FinancialReports from "@/components/reports/FinancialReports";
import AttendanceTracker from "@/components/workers/AttendanceTracker";
import PayrollSummary from "@/components/workers/PayrollSummary";
import {
  normalizeConstructionWorkerRole,
  normalizeMaterialCategory,
} from "@/lib/construction";
import {
  isFirebaseConfigured,
  loadFirebaseWallet,
  saveFirebaseWallet,
  subscribeFirebaseWallet,
} from "@/lib/firebase";
import {
  syncWalletToCompanySubcollections,
} from "@/lib/company-api-client";
import {
  isLimitReached,
  limitReachedMessage,
  normalizePlan,
  type PlanLimitKey,
} from "@/lib/plans";
import {
  findPossibleDuplicateTransaction,
  validateDailyReportDraft,
  validateMaterialDraft,
  validateReminderDraft,
  validateSiteDraft,
  validateTransactionDraft,
  validateWorkerDraft,
} from "@/lib/helpers/business-validation";
import {
  buildAccessContext,
  canAccess,
  filterDailyReportsForAccess,
  filterMaterialsForAccess,
  filterProjectsForAccess,
  filterRemindersForAccess,
  filterTransactionsForAccess,
  filterWorkersForAccess,
  normalizeAccessRole,
  roleLabel,
} from "@/lib/role-access";
import {
  AccountBalances,
  ActivityLogItem,
  CompanyProfile,
  CardItem,
  DailyWorkReport,
  EmployeeInvite,
  EmployeeSession,
  PaymentMethod,
  PersonAccount,
  PersonAccountEntry,
  MaterialCategory,
  MaterialItem,
  ProjectExtraWork,
  ProjectSite,
  ReminderItem,
  ThemeMode,
  Transaction,
  TransactionType,
  WalletData,
  Customer,
  Supplier,
  Invoice,
  SupplierBill,
  Attendance,
  PayrollRun,
} from "@/lib/types";

const expenseCategories = [
  "⛽ Petrol",
  "👤 Person",
  "👷 Worker Salary",
  "🏗️ Materials",
  "🚕 Transport",
  "🧾 Bills",
  "🛠️ Tools",
  "❔ Other",
];

const categoryName = (category = "") =>
  category.replace(/^[^\w₹A-Za-z0-9]+ /, "").trim() || "Other";

const inferCategory = (title = "", type: TransactionType = "Expense", cardName = "", cards: CardItem[] = []) => {
  if (
    type === "Income" ||
    type === "Pay In" ||
    title.toLowerCase().startsWith("person -")
  ) {
    return "👤 Person";
  }

  const lower = title.toLowerCase();

  // First check for card-based categorization
  if (cardName) {
    const cardCategory = inferCategoryFromCard(cardName, cards, type);
    if (cardCategory) return cardCategory;
  }

  // Enhanced pattern matching for common transaction types
  const patterns = {
    "⛽ Petrol": ["petrol", "fuel", "diesel", "bpcl", "hpcl", "indian oil", "shell", "gas station"],
    "👤 Person": ["person", "customer", "client", "advance", "token"],
    "👷 Worker Salary": ["worker", "salary", "labour", "labor", "wage", "mason", "helper", "carpenter", "painter", "plumber", "electrician"],
    "🏗️ Materials": ["cement", "steel", "sand", "brick", "bricks", "paint", "pipe", "pipes", "tile", "tiles", "hardware", "material"],
    "🚕 Transport": ["transport", "lorry", "truck", "auto", "taxi", "diesel trip", "delivery", "loading"],
    "🧾 Bills": ["bill", "invoice", "receipt", "gst", "electricity", "water"],
    "🛠️ Tools": ["tool", "drill", "cutter", "machine", "equipment"],
  };

  for (const [category, keywords] of Object.entries(patterns)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return category;
    }
  }

  // Check existing categories as fallback
  const match = expenseCategories.find((category) =>
    lower.includes(categoryName(category).toLowerCase())
  );

  return match || "❔ Other";
};

const inferPerson = (title = "") => {
  const match = title.match(/^person\s*-\s*(.+)$/i);
  return match?.[1]?.trim() || "";
};

const inferCategoryFromCard = (cardName: string, cards: CardItem[], type: TransactionType) => {
  if (type !== "Expense") return null;

  const card = cards.find(c => cardSourceLabel(c).toLowerCase() === cardName.toLowerCase());
  if (!card) return null;

  // Categorize based on card type
  if (card.cardType === "Credit") {
    // Credit cards often used for larger purchases, entertainment, travel
    return "🏪 Shopping"; // Could be refined based on transaction patterns
  } else if (card.cardType === "Debit") {
    // Debit cards often used for daily expenses
    return "🍔 Food"; // Could be refined
  }

  return null;
};

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const localDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const localTimeInputValue = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const transactionMonth = (tx: Transaction) => tx.date?.slice(0, 7) || monthKey();

const formatMonth = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const moveMonth = (key: string, offset: number) => {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + offset, 1));
};

const DEMO_ADMIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_ADMIN === "true";
const TEMP_DOMAIN_USERNAME =
  process.env.NEXT_PUBLIC_DEMO_ADMIN_USERNAME || "expense-admin";
const DEMO_USER = "demo-company@ledge.local";
const APP_NAME = "Ledge";
import { type DashboardTab } from "@/lib/types";
type FormPreset = {
  category?: string;
  name?: string;
  projectId?: string;
};
type ReportAccount = {
  id: string;
  label: string;
  icon: string;
  amount: number;
  transactions: Transaction[];
};
type LedgerAccount = ReportAccount & {
  openingBalance: number;
};
type AdminUser = {
  username: string;
  email: string;
  lastLogin: string;
};
type StorageStatus =
  | "local"
  | "loading"
  | "saving"
  | "synced"
  | "offline"
  | "unconfigured"
  | "error";
type WalletInput = Partial<Omit<WalletData, "accountBalances">> & {
  accountBalances?: Partial<AccountBalances>;
};

const emptyWalletData = (): WalletData => ({
  profileName: "",
  transactions: [],
  cards: [],
  upiAccounts: [],
  personAccounts: [],
  projects: [],
  company: null,
  materials: [],
  reminders: [],
  dailyReports: [],
  accountBalances: emptyAccountBalances(),
  personalBalance: 0,
  businessBalance: 0,
  theme: "dark",
  deletedSourceIds: [],
  employeeInvites: [],
  activityLog: [],
});

const demoWalletData = (): WalletData => {
  const today = localDateInputValue();
  const projects: ProjectSite[] = [
    {
      id: "demo-site-green-heights",
      name: "Green Heights Villas",
      budget: 1850000,
      customer: "Ramesh Nair",
      status: "Active",
      note: "G+1 villa finishing, Kundalahalli",
      date: "2026-05-02",
      extras: [
        {
          id: "demo-extra-porch",
          title: "Front porch granite",
          amount: 85000,
          date: "2026-05-09",
        },
      ],
    },
    {
      id: "demo-site-lakshmi",
      name: "Lakshmi Nilayam Renovation",
      budget: 720000,
      customer: "Priya Menon",
      status: "Active",
      note: "Kitchen, bathroom, terrace waterproofing",
      date: "2026-04-28",
      extras: [
        {
          id: "demo-extra-waterproofing",
          title: "Extra terrace slope correction",
          amount: 38000,
          date: "2026-05-07",
        },
      ],
    },
  ];

  return {
    profileName: "Demo Company",
    company: {
      id: "demo-company",
      name: "Shree BuildCare Contractors",
      ownerEmail: DEMO_USER,
      plan: "Pro",
      role: "Owner",
    },
    employeeInvites: [],
    activityLog: [],
    cards: [
      {
        id: "demo-card-hdfc",
        name: "HDFC Business Debit",
        number: "xxxx4218",
        expiry: "2029-08",
        cardType: "Debit",
      },
    ],
    upiAccounts: [
      {
        id: "demo-upi-phonepe",
        name: "PhonePe Business",
        upiId: "shreebuildcare@ybl",
      },
    ],
    projects,
    materials: [
      {
        id: "demo-mat-cement",
        projectId: projects[0].id,
        category: "Cement",
        name: "UltraTech Cement",
        quantity: 220,
        usedQuantity: 148,
        lowStockAt: 40,
        unit: "bags",
        rate: 420,
        supplier: "Sri Balaji Cement",
        date: "2026-05-06",
        note: "Second floor slab and plaster",
      },
      {
        id: "demo-mat-steel",
        projectId: projects[0].id,
        category: "Steel",
        name: "TMT Steel 12mm",
        quantity: 2800,
        usedQuantity: 2100,
        lowStockAt: 350,
        unit: "kg",
        rate: 64,
        supplier: "Kaveri Steel Traders",
        date: "2026-05-04",
      },
      {
        id: "demo-mat-tiles",
        projectId: projects[1].id,
        category: "Tiles",
        name: "Kajaria Floor Tiles",
        quantity: 960,
        usedQuantity: 420,
        lowStockAt: 120,
        unit: "sqft",
        rate: 82,
        supplier: "City Ceramics",
        date: "2026-05-08",
      },
      {
        id: "demo-mat-sand",
        projectId: projects[0].id,
        category: "Sand",
        name: "M Sand",
        quantity: 9,
        usedQuantity: 6,
        lowStockAt: 2,
        unit: "loads",
        rate: 14500,
        supplier: "Anjaneya Aggregates",
        date: "2026-05-05",
      },
    ],
    personAccounts: [
      {
        id: "demo-worker-imran",
        name: "Imran Mason",
        phone: "919876543210",
        workerSubRole: "Mason",
        projectId: projects[0].id,
        dailyWage: 1200,
        status: "Active",
        amount: 0,
        direction: "Receivable",
        note: "Mason team lead",
        date: "2026-05-01",
        entries: [
          {
            id: "demo-worker-imran-1",
            amount: 18000,
            direction: "Debit",
            method: "UPI",
            narration: "Week 1 labour payment",
            date: "2026-05-04",
            projectId: projects[0].id,
          },
          {
            id: "demo-worker-imran-2",
            amount: 12000,
            direction: "Credit",
            method: "Cash",
            narration: "Advance adjusted",
            date: "2026-05-10",
            projectId: projects[0].id,
          },
        ],
      },
      {
        id: "demo-worker-suresh",
        name: "Suresh Helper",
        phone: "919845112233",
        workerSubRole: "Helper",
        projectId: projects[1].id,
        dailyWage: 900,
        status: "Active",
        amount: 4500,
        direction: "Payable",
        note: "Daily wage helper",
        date: "2026-05-02",
        entries: [
          {
            id: "demo-worker-suresh-1",
            amount: 3000,
            direction: "Debit",
            method: "Cash",
            narration: "Three days wage",
            date: "2026-05-08",
            projectId: projects[1].id,
          },
        ],
      },
      {
        id: "demo-worker-manjunath",
        name: "Manjunath Electrician",
        phone: "919900112244",
        workerSubRole: "Electrician",
        projectId: projects[1].id,
        dailyWage: 1600,
        status: "Active",
        amount: 12000,
        direction: "Payable",
        note: "Wiring balance",
        date: "2026-05-03",
        entries: [],
      },
      {
        id: "demo-worker-salma",
        name: "Salma Painter",
        phone: "919611223344",
        workerSubRole: "Painter",
        projectId: projects[1].id,
        dailyWage: 1400,
        status: "Inactive",
        amount: 7000,
        direction: "Receivable",
        note: "Paint material advance",
        date: "2026-05-05",
        entries: [],
      },
      {
        id: "demo-worker-raju",
        name: "Raju Plumber",
        phone: "919742009988",
        workerSubRole: "Plumber",
        projectId: projects[0].id,
        dailyWage: 1500,
        status: "Active",
        amount: 6000,
        direction: "Payable",
        note: "Bathroom pipeline work",
        date: "2026-05-06",
        entries: [
          {
            id: "demo-worker-raju-1",
            amount: 4000,
            direction: "Credit",
            method: "UPI",
            narration: "Advance paid",
            date: "2026-05-09",
            projectId: projects[0].id,
          },
        ],
      },
    ],
    reminders: [
      {
        id: "demo-reminder-client",
        title: "Collect 2nd stage payment from Ramesh",
        dueDate: today,
        projectId: projects[0].id,
        amount: 350000,
        note: "Share site summary before calling",
        done: false,
      },
      {
        id: "demo-reminder-cement",
        title: "Order cement before stock drops",
        dueDate: "2026-05-13",
        projectId: projects[0].id,
        amount: 45000,
        note: "Ask Balaji for morning delivery",
        done: false,
      },
      {
        id: "demo-reminder-electrician",
        title: "Pay electrician balance",
        dueDate: "2026-05-14",
        projectId: projects[1].id,
        amount: 12000,
        note: "After DB board check",
        done: false,
      },
      {
        id: "demo-reminder-bill",
        title: "Upload paint shop bill",
        dueDate: "2026-05-11",
        projectId: projects[1].id,
        amount: 18500,
        note: "Photo is in WhatsApp",
        done: true,
      },
    ],
    dailyReports: [
      {
        id: "demo-report-imran-1",
        date: today,
        projectId: projects[0].id,
        workerId: "demo-worker-imran",
        workerName: "Imran Mason",
        workerRole: "Mason",
        workDescription: "Completed wall plaster prep and checked slab curing.",
        materialsUsed: "Cement 12 bags, M Sand half load",
        hoursWorked: 8,
        paymentAdvance: 0,
        issues: "Need extra scaffolding for rear wall.",
        nextWorkPlan: "Start rear wall plaster tomorrow morning.",
        photosNote: "Photos placeholder",
        status: "Submitted",
        createdBy: "Supervisor",
        createdAt: today,
        updatedAt: today,
      },
    ],
    transactions: sortTransactionsByDateTime([
      {
        id: "demo-tx-client-1",
        title: "Person - Ramesh Nair",
        amount: 650000,
        type: "Income",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "👤 Person",
        person: "Ramesh Nair",
        fromAccount: "Ramesh Nair",
        toAccount: "shreebuildcare@ybl",
        projectId: projects[0].id,
        date: "2026-05-02",
        time: "10:15",
      },
      {
        id: "demo-tx-client-2",
        title: "Person - Priya Menon",
        amount: 280000,
        type: "Income",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "👤 Person",
        person: "Priya Menon",
        fromAccount: "Priya Menon",
        toAccount: "shreebuildcare@ybl",
        projectId: projects[1].id,
        date: "2026-05-03",
        time: "17:25",
      },
      {
        id: "demo-tx-cement",
        title: "UltraTech Cement",
        amount: 92400,
        type: "Expense",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "🏗️ Materials",
        person: "",
        fromAccount: "shreebuildcare@ybl",
        toAccount: "Sri Balaji Cement",
        projectId: projects[0].id,
        date: "2026-05-06",
        time: "08:40",
      },
      {
        id: "demo-tx-steel",
        title: "TMT Steel 12mm",
        amount: 179200,
        type: "Expense",
        method: "Card",
        section: "Account",
        selectedCard: "HDFC Business Debit xxxx4218",
        category: "🏗️ Materials",
        person: "",
        fromAccount: "HDFC Business Debit xxxx4218",
        toAccount: "Kaveri Steel Traders",
        projectId: projects[0].id,
        date: "2026-05-04",
        time: "12:20",
      },
      {
        id: "demo-tx-labour-1",
        title: "Person - Imran Mason",
        amount: 18000,
        type: "Expense",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "👷 Worker Salary",
        person: "Imran Mason",
        fromAccount: "shreebuildcare@ybl",
        toAccount: "Imran Mason",
        projectId: projects[0].id,
        date: "2026-05-04",
        time: "19:30",
      },
      {
        id: "demo-tx-labour-2",
        title: "Person - Suresh Helper",
        amount: 3000,
        type: "Expense",
        method: "Cash",
        section: "Account",
        selectedCard: "",
        category: "👷 Worker Salary",
        person: "Suresh Helper",
        fromAccount: "Cash",
        toAccount: "Suresh Helper",
        projectId: projects[0].id,
        date: "2026-05-08",
        time: "18:10",
      },
      {
        id: "demo-tx-bill-paint",
        title: "Bill - Asian Paints dealer",
        amount: 18500,
        type: "Expense",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "🧾 Bills",
        person: "R K Paints",
        fromAccount: "shreebuildcare@ybl",
        toAccount: "R K Paints",
        projectId: projects[1].id,
        date: "2026-05-10",
        time: "11:05",
      },
      {
        id: "demo-tx-bill-sand",
        title: "Bill - M Sand delivery",
        amount: 43500,
        type: "Expense",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "🧾 Bills",
        person: "Anjaneya Aggregates",
        fromAccount: "shreebuildcare@ybl",
        toAccount: "Anjaneya Aggregates",
        projectId: projects[0].id,
        date: "2026-05-05",
        time: "07:50",
      },
      {
        id: "demo-tx-petrol",
        title: "Petrol site visits",
        amount: 2400,
        type: "Expense",
        method: "UPI",
        section: "Account",
        selectedCard: "shreebuildcare@ybl",
        category: "⛽ Petrol",
        person: "",
        fromAccount: "shreebuildcare@ybl",
        toAccount: "Indian Oil",
        projectId: projects[0].id,
        date: "2026-05-09",
        time: "09:15",
      },
      {
        id: "demo-tx-tiles",
        title: "Kajaria Floor Tiles",
        amount: 78720,
        type: "Expense",
        method: "Card",
        section: "Account",
        selectedCard: "HDFC Business Debit xxxx4218",
        category: "🏗️ Materials",
        person: "",
        fromAccount: "HDFC Business Debit xxxx4218",
        toAccount: "City Ceramics",
        projectId: projects[1].id,
        date: "2026-05-08",
        time: "15:20",
      },
    ]),
    accountBalances: {
      cash: 42500,
      upi: 0,
      upis: {
        "shreebuildcare@ybl": 386000,
      },
      cards: {
        "HDFC Business Debit xxxx4218": 215000,
      },
    },
    personalBalance: 0,
    businessBalance: 643500,
    theme: "dark",
    deletedSourceIds: [],
  };
};

const parseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const emptyAccountBalances = (): AccountBalances => ({
  cash: 0,
  upi: 0,
  upis: {},
  cards: {},
});

const toMoney = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const cleanSourceName = (value = "") => value.trim().slice(0, 80);
const personAccountNameKey = (value = "") =>
  cleanSourceName(value).replace(/\s+/g, " ").toLowerCase();

const isMoneyInType = (type: TransactionType) =>
  type === "Income" || type === "Pay In";

const isMoneyOutType = (type: TransactionType) =>
  type === "Expense" || type === "Pay Out";

const movementAccountName = (
  tx: Pick<Transaction, "method" | "selectedCard">
) => (tx.method === "Cash" ? "Cash" : cleanSourceName(tx.selectedCard || tx.method));

const movementPartyName = (
  tx: Pick<Transaction, "title" | "category" | "person">
) =>
  cleanSourceName(
    tx.person ||
    tx.title.replace(/^person\s*-\s*/i, "") ||
    categoryName(tx.category)
  );

const isSelfMovementName = (
  value: string,
  tx: Pick<Transaction, "method" | "selectedCard">
) => {
  const lower = cleanSourceName(value).toLowerCase();
  const selected = cleanSourceName(tx.selectedCard || "").toLowerCase();

  return Boolean(
    lower &&
    (["you", "account", "cash", "upi", "card"].includes(lower) ||
      lower === tx.method.toLowerCase() ||
      (selected && lower === selected))
  );
};

const resolveTransactionMovement = (
  tx: Pick<
    Transaction,
    "type" | "method" | "title" | "selectedCard" | "category" | "person"
  > &
    Partial<Pick<Transaction, "fromAccount" | "toAccount">>
) => {
  const accountName = movementAccountName(tx);
  const partyName = movementPartyName(tx);
  const fallbackFrom = isMoneyOutType(tx.type) ? accountName : partyName;
  const fallbackTo = isMoneyOutType(tx.type) ? partyName : accountName;
  const fromAccount = cleanSourceName(tx.fromAccount || fallbackFrom);
  const toAccount = cleanSourceName(tx.toAccount || fallbackTo);
  const fromLooksSelf = isSelfMovementName(fromAccount, tx);
  const toLooksSelf = isSelfMovementName(toAccount, tx);

  if (isMoneyInType(tx.type) && fromLooksSelf && !toLooksSelf) {
    return {
      fromAccount: toAccount,
      toAccount: fromAccount,
    };
  }

  if (isMoneyOutType(tx.type) && toLooksSelf && !fromLooksSelf) {
    return {
      fromAccount: toAccount,
      toAccount: fromAccount,
    };
  }

  return {
    fromAccount,
    toAccount,
  };
};




const cardLast4 = (number = "") => number.replace(/\D/g, "").slice(-4);

const maskCardNumber = (number = "") => {
  const last4 = cardLast4(number);
  return last4 ? `xxxx${last4}` : "";
};

const cardSourceLabel = (card: Pick<CardItem, "name" | "number">) => {
  const mask = maskCardNumber(card.number || "");
  return cleanSourceName([card.name, mask].filter(Boolean).join(" "));
};

const upiSourceLabel = (upi: Pick<CardItem, "name" | "upiId">) =>
  cleanSourceName(upi.upiId || upi.name);

const daysUntilMonthDay = (day?: number) => {
  if (!day) {
    return null;
  }

  const today = new Date();
  const due = new Date(today.getFullYear(), today.getMonth(), day);

  if (due < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    due.setMonth(due.getMonth() + 1);
  }

  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.round((due.getTime() - todayStart.getTime()) / 86_400_000);
};

const transactionTypes: TransactionType[] = [
  "Income",
  "Expense",
  "Pay In",
  "Pay Out",
];
const paymentMethods: PaymentMethod[] = ["UPI", "Cash", "Card"];
const sections = ["Personal", "Business", "Account"];

const cleanText = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 240)
    : fallback;

const isJunkTransaction = (title = "") => {
  const lower = title.toLowerCase();
  const junkPatterns = [
    /\b(otp|one time password|verification code)\b/i,
    /\b(redeem|redemption|coupon|voucher|reward|rewards|cashback|promo|offer|gift|benefits|samsung|products)\b/i,
    /\b(alert|notification|update|reminder|due date)\b/i,
    /\b(failed|declined|unsuccessful|pending|processing|cancelled|reversal|chargeback)\b/i,
    /\b(statement|bill generated|available limit)\b/i,
    /\b(login|sign in|profile|settings)\b/i,
    /\b(subscription|plan|billing|invoice|receipt)\b/i,
    /\b(error|issue|problem|trouble)\b/i
  ];
  return junkPatterns.some(pattern => pattern.test(lower));
};

const cleanCardType = (value: unknown): CardItem["cardType"] =>
  value === "Credit" ? "Credit" : value === "Debit" ? "Debit" : undefined;

const normalizeTransactions = (value: unknown): Transaction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: Transaction[] = [];

  value.forEach((tx) => {
    if (!tx || typeof tx !== "object") {
      return;
    }

    const item = tx as Record<string, unknown>;
    let type = transactionTypes.includes(item.type as TransactionType)
      ? (item.type as TransactionType)
      : "Expense";
    const method = paymentMethods.includes(item.method as PaymentMethod)
      ? (item.method as PaymentMethod)
      : "UPI";
    const section = sections.includes(item.section as string)
      ? (item.section as Transaction["section"])
      : "Account";
    const title = cleanText(item.title, type === "Income" ? "Income" : "Expense");

    if (isJunkTransaction(title)) {
      return;
    }

    const rawDate = cleanText(item.date, localDateInputValue());
    const date = rawDate.includes("T") ? rawDate.slice(0, 10) : rawDate;
    const rawTime = cleanText(item.time);
    const time =
      rawTime || (rawDate.includes("T") ? rawDate.slice(11, 16) : "");
    const selectedCard = cleanText(item.selectedCard);
    const category = cleanText(item.category, inferCategory(title, type));
    const person = cleanText(item.person, inferPerson(title));
    const rawFromAccount = cleanText(item.fromAccount);
    const rawToAccount = cleanText(item.toAccount);

    if (
      category === "🔄 Transfer" &&
      type === "Pay Out" &&
      rawToAccount &&
      ((selectedCard &&
        selectedCard.toLowerCase() === rawToAccount.toLowerCase()) ||
        (method === "Cash" && rawToAccount.toLowerCase() === "cash"))
    ) {
      type = "Pay In";
    }

    const movement = resolveTransactionMovement({
      title,
      type,
      method,
      selectedCard,
      category,
      person,
      fromAccount: rawFromAccount,
      toAccount: rawToAccount,
    });

    const id = cleanText(item.id, uid());
    const sourceId =
      cleanText(item.sourceId) ||
      (id.startsWith("email-") ? `gmail:${id.slice("email-".length)}` : "");

    normalized.push({
      id,
      companyId: cleanText(item.companyId),
      sourceId,
      title,
      amount: toMoney(item.amount),
      type,
      method,
      section,
      selectedCard,
      category,
      person,
      ...movement,
      projectId: cleanText(item.projectId),
      date,
      time,
    });
  });

  return normalized;
};

const normalizeCards = (value: unknown): CardItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: CardItem[] = [];

  value.forEach((card) => {
    if (!card || typeof card !== "object") {
      return;
    }

    const item = card as Record<string, unknown>;
    const name = cleanText(item.name);
    const repaymentDay = Number(item.repaymentDay || 0);

    if (name) {
      normalized.push({
        id: cleanText(item.id, uid()),
        name,
        number: maskCardNumber(cleanText(item.number)),
        expiry: cleanText(item.expiry),
        cardType: cleanCardType(item.cardType),
        repaymentDay:
          Number.isFinite(repaymentDay) && repaymentDay >= 1 && repaymentDay <= 31
            ? repaymentDay
            : undefined,
        upiId: cleanText(item.upiId),
      });
    }
  });

  return normalized;
};

const normalizePersonAccountEntries = (value: unknown): PersonAccountEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: PersonAccountEntry[] = [];

  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const item = entry as Record<string, unknown>;
    const amount = toMoney(item.amount);

    if (amount <= 0) {
      return;
    }

    normalized.push({
      id: cleanText(item.id, uid()),
      amount,
      direction: item.direction === "Credit" ? "Credit" : "Debit",
      method: paymentMethods.includes(item.method as PaymentMethod)
        ? (item.method as PaymentMethod)
        : "UPI",
      narration: cleanText(item.narration),
      date: cleanText(item.date, localDateInputValue()),
      projectId: cleanText(item.projectId),
    });
  });

  return normalized;
};

const normalizePersonAccounts = (value: unknown): PersonAccount[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: PersonAccount[] = [];

  value.forEach((account) => {
    if (!account || typeof account !== "object") {
      return;
    }

    const item = account as Record<string, unknown>;
    const name = cleanSourceName(cleanText(item.name));
    const amount = toMoney(item.amount);

    if (!name || amount < 0) {
      return;
    }

    const nextAccount: PersonAccount = {
      id: cleanText(item.id, uid()),
      companyId: cleanText(item.companyId),
      name,
      phone: cleanText(item.phone),
      amount,
      direction: item.direction === "Payable" ? "Payable" : "Receivable",
      note: cleanText(item.note),
      date: cleanText(item.date, localDateInputValue()),
      entries: normalizePersonAccountEntries(item.entries),
      role: "worker",
      invitedBy: cleanText(item.invitedBy),
      assignedSupervisor: cleanText(item.assignedSupervisor),
      workerSubRole: normalizeConstructionWorkerRole(item.workerSubRole),
      projectId: cleanText(item.projectId),
      dailyWage: toMoney(item.dailyWage),
      monthlyWage: toMoney(item.monthlyWage),
      status: item.status === "Inactive" ? "Inactive" : "Active",
      referralCode: cleanText(item.referralCode),
    };
    const duplicateIndex = normalized.findIndex(
      (savedAccount) =>
        personAccountNameKey(savedAccount.name) === personAccountNameKey(name)
    );

    if (duplicateIndex >= 0) {
      const savedAccount = normalized[duplicateIndex];
      const savedOpening =
        savedAccount.direction === "Payable"
          ? -savedAccount.amount
          : savedAccount.amount;
      const nextOpening =
        nextAccount.direction === "Payable"
          ? -nextAccount.amount
          : nextAccount.amount;
      const mergedOpening = savedOpening + nextOpening;

      normalized[duplicateIndex] = {
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

    normalized.push(nextAccount);
  });

  return normalized;
};

const normalizeProjectExtras = (value: unknown): ProjectExtraWork[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((extra) => {
      if (!extra || typeof extra !== "object") {
        return null;
      }

      const item = extra as Record<string, unknown>;
      const title = cleanText(item.title);
      const amount = toMoney(item.amount);

      if (!title || amount <= 0) {
        return null;
      }

      return {
        id: cleanText(item.id, uid()),
        title,
        amount,
        date: cleanText(item.date, localDateInputValue()),
      } satisfies ProjectExtraWork;
    })
    .filter(Boolean) as ProjectExtraWork[];
};

const normalizeProjects = (value: unknown): ProjectSite[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((project) => {
      if (!project || typeof project !== "object") {
        return null;
      }

      const item = project as Record<string, unknown>;
      const name = cleanText(item.name);

      if (!name) {
        return null;
      }

      const status =
        item.status === "Paused" || item.status === "Completed"
          ? item.status
          : "Active";

      return {
        id: cleanText(item.id, uid()),
        companyId: cleanText(item.companyId),
        name,
        budget: toMoney(item.budget),
        customer: cleanText(item.customer),
        status,
        note: cleanText(item.note),
        date: cleanText(item.date, localDateInputValue()),
        extras: normalizeProjectExtras(item.extras),
      } satisfies ProjectSite;
    })
    .filter(Boolean) as ProjectSite[];
};

const normalizeAccountBalances = (
  value: Partial<AccountBalances> | undefined,
  legacyBalance = 0
): AccountBalances => {
  const hasSavedBalances = Boolean(value);
  const cardSource =
    value?.cards && typeof value.cards === "object" && !Array.isArray(value.cards)
      ? value.cards
      : {};
  const upiSource =
    value?.upis && typeof value.upis === "object" && !Array.isArray(value.upis)
      ? value.upis
      : {};
  const cards = Object.fromEntries(
    Object.entries(cardSource)
      .map(([name, amount]) => [cleanSourceName(name), toMoney(amount)])
      .filter(([name]) => name)
  );
  const upis = Object.fromEntries(
    Object.entries(upiSource)
      .map(([name, amount]) => [cleanSourceName(name), toMoney(amount)])
      .filter(([name]) => name)
  );

  return {
    cash: toMoney(value?.cash ?? (hasSavedBalances ? 0 : legacyBalance)),
    upi: toMoney(value?.upi),
    upis,
    cards,
  };
};

const isMoneyIn = (tx: Transaction) =>
  isMoneyInType(tx.type);

const isMoneyOut = (tx: Transaction) =>
  isMoneyOutType(tx.type);

const isTransferTransaction = (tx: Pick<Transaction, "category" | "title">) =>
  tx.category === "🔄 Transfer" || /^transfer\b/i.test(tx.title);

const transactionAmount = (tx: Transaction) =>
  isMoneyIn(tx) ? tx.amount : isMoneyOut(tx) ? -tx.amount : 0;

const sortTransactionsByDateTime = (items: Transaction[]) =>
  [...items].sort((left, right) => {
    const rightKey = `${right.date || ""} ${right.time || ""}`;
    const leftKey = `${left.date || ""} ${left.time || ""}`;
    return rightKey.localeCompare(leftKey);
  });

const cardLabelForTransaction = (tx: Transaction) =>
  cleanSourceName(tx.selectedCard || "Card");

const accountKey = (label: string) =>
  cleanSourceName(label).toLowerCase() || "account";

const transactionLedgerLabel = (tx: Transaction) => {
  if (isTransferTransaction(tx)) {
    const movement = resolveTransactionMovement(tx);
    const transferAccount = isMoneyIn(tx)
      ? cleanSourceName(tx.selectedCard || movement.toAccount)
      : cleanSourceName(tx.selectedCard || movement.fromAccount);

    if (transferAccount) {
      return transferAccount;
    }
  }

  if (tx.method === "Cash") {
    return "Cash";
  }

  if (tx.method === "UPI") {
    return cleanSourceName(tx.selectedCard || "UPI");
  }

  return cardLabelForTransaction(tx);
};

const transactionLedgerIcon = (tx: Pick<Transaction, "method">) =>
  tx.method === "Cash" ? "💵" : tx.method === "UPI" ? "📲" : "💳";

const buildLedgerAccounts = (
  balances: AccountBalances,
  cards: CardItem[],
  upiAccounts: CardItem[],
  transactions: Transaction[]
): LedgerAccount[] => {
  const ledger = new Map<string, LedgerAccount>();
  const ensureAccount = (label: string, icon: string, openingBalance = 0) => {
    const clean = cleanSourceName(label);
    const id = `${icon}:${accountKey(clean)}`;
    const existing = ledger.get(id);

    if (existing) {
      existing.openingBalance += openingBalance;
      existing.amount += openingBalance;
      return existing;
    }

    const account: LedgerAccount = {
      id,
      label: clean,
      icon,
      openingBalance,
      amount: openingBalance,
      transactions: [],
    };

    ledger.set(id, account);
    return account;
  };

  ensureAccount("Cash", "💵", balances.cash);
  ensureAccount("UPI", "📲", balances.upi);
  Object.entries(balances.upis || {}).forEach(([label, amount]) => {
    ensureAccount(label, "📲", amount);
  });
  upiAccounts.forEach((upi) => ensureAccount(upiSourceLabel(upi), "📲"));
  Object.entries(balances.cards || {}).forEach(([label, amount]) => {
    ensureAccount(label, "💳", amount);
  });
  cards.forEach((card) => ensureAccount(cardSourceLabel(card), "💳"));

  transactions.forEach((tx) => {
    const label = transactionLedgerLabel(tx);
    const account = ensureAccount(label, transactionLedgerIcon(tx));

    account.amount += transactionAmount(tx);
    account.transactions.push(tx);
  });

  return Array.from(ledger.values())
    .filter(
      (account) =>
        account.openingBalance !== 0 ||
        account.amount !== 0 ||
        account.transactions.length > 0 ||
        account.label === "Cash" ||
        account.label === "UPI"
    )
    .sort((left, right) => {
      const order = (account: LedgerAccount) =>
        account.label === "Cash" ? 0 : account.label === "UPI" ? 1 : 2;

      return order(left) - order(right) || left.label.localeCompare(right.label);
    });
};

const normalizeCompany = (value: unknown): CompanyProfile | null => {
  if (!value || typeof value !== "object") return null;
  const company = value as Partial<CompanyProfile>;
  const name = cleanText(company.name);
  const ownerEmail = cleanText(company.ownerEmail);

  if (!name && !ownerEmail) return null;

  return {
    id: cleanText(company.id) || uid(),
    name: name || "My Company",
    ownerEmail,
    plan: normalizePlan(company.plan),
    role:
      company.role === "Admin" ||
        company.role === "Supervisor" ||
        company.role === "Worker" ||
        company.role === "Manager" ||
        company.role === "Accountant" ||
        company.role === "Viewer"
        ? company.role
        : "Owner",
  };
};

const normalizeMaterials = (value: unknown): MaterialItem[] =>
  Array.isArray(value)
    ? value
      .map((item) => {
        const material = item as Partial<MaterialItem>;
        const name = cleanText(material.name);

        if (!name) return null;

        return {
          id: cleanText(material.id) || uid(),
          companyId: cleanText(material.companyId),
          projectId: cleanText(material.projectId),
          category: normalizeMaterialCategory(material.category),
          name,
          quantity: toMoney(material.quantity),
          usedQuantity: Math.min(
            toMoney(material.quantity),
            Math.max(0, toMoney(material.usedQuantity))
          ),
          lowStockAt: Math.max(0, toMoney(material.lowStockAt)),
          unit: cleanText(material.unit, "pcs"),
          rate: toMoney(material.rate),
          supplier: cleanText(material.supplier),
          date: cleanText(material.date) || localDateInputValue(),
          note: cleanText(material.note),
        };
      })
      .filter(Boolean) as MaterialItem[]
    : [];

const normalizeReminders = (value: unknown): ReminderItem[] =>
  Array.isArray(value)
    ? value
      .map((item) => {
        const reminder = item as Partial<ReminderItem>;
        const title = cleanText(reminder.title);
        const type =
          reminder.type === "payment" ||
            reminder.type === "worker_payment" ||
            reminder.type === "material_reorder" ||
            reminder.type === "bill_due" ||
            reminder.type === "general"
            ? reminder.type
            : "general";

        if (!title) return null;

        return {
          id: cleanText(reminder.id) || uid(),
          companyId: cleanText(reminder.companyId),
          title,
          dueDate: cleanText(reminder.dueDate) || localDateInputValue(),
          projectId: cleanText(reminder.projectId),
          amount:
            reminder.amount === undefined || reminder.amount === null
              ? undefined
              : toMoney(reminder.amount),
          note: cleanText(reminder.note),
          done: Boolean(reminder.done),
          type,
          targetId: cleanText(reminder.targetId),
          notifyAt: cleanText(reminder.notifyAt),
          notificationReady: Boolean(reminder.notificationReady),
        };
      })
      .filter(Boolean) as ReminderItem[]
    : [];

const normalizeDailyReports = (value: unknown): DailyWorkReport[] =>
  Array.isArray(value)
    ? value
      .map((item) => {
        const report = item as Partial<DailyWorkReport>;
        const workerName = cleanText(report.workerName);
        const workDescription = cleanText(report.workDescription);

        if (!workerName && !workDescription) return null;

        const status =
          report.status === "Submitted" || report.status === "Reviewed"
            ? report.status
            : "Draft";

        return {
          id: cleanText(report.id) || uid(),
          companyId: cleanText(report.companyId),
          date: cleanText(report.date) || localDateInputValue(),
          projectId: cleanText(report.projectId),
          workerId: cleanText(report.workerId),
          workerName: workerName || "Worker",
          workerRole: normalizeConstructionWorkerRole(report.workerRole),
          workDescription: workDescription || "Daily work report",
          materialsUsed: cleanText(report.materialsUsed),
          hoursWorked: Math.max(0, toMoney(report.hoursWorked)),
          paymentAdvance: Math.max(0, toMoney(report.paymentAdvance)),
          issues: cleanText(report.issues),
          nextWorkPlan: cleanText(report.nextWorkPlan),
          photosNote: cleanText(report.photosNote),
          status,
          createdBy: cleanText(report.createdBy),
          reviewedBy: cleanText(report.reviewedBy),
          createdAt: cleanText(report.createdAt),
          updatedAt: cleanText(report.updatedAt),
        };
      })
      .filter(Boolean) as DailyWorkReport[]
    : [];

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.map((item) => cleanText(item)).filter(Boolean))
      )
    : [];

const normalizeEmployeeInvites = (value: unknown): EmployeeInvite[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((invite) => {
      if (!invite || typeof invite !== "object") {
        return null;
      }

      const item = invite as Record<string, unknown>;
      const role = normalizeAccessRole(cleanText(item.role));
      const employeeRole =
        role === "supervisor" || role === "worker" ? role : null;
      const code = cleanText(item.code).toUpperCase();
      const companyId = cleanText(item.companyId);
      const ownerUser = cleanText(item.ownerUser);
      const displayName = cleanText(item.displayName, roleLabel(role));

      if (!code || !companyId || !ownerUser || !employeeRole) {
        return null;
      }

      return {
        id: cleanText(item.id) || uid(),
        companyId,
        ownerUser,
        code,
        role: employeeRole,
        displayName,
        phone: cleanText(item.phone),
        workerSubRole:
          employeeRole === "worker" || employeeRole === "supervisor"
            ? normalizeConstructionWorkerRole(item.workerSubRole)
            : undefined,
        workerId: cleanText(item.workerId),
        assignedSupervisor: cleanText(item.assignedSupervisor),
        dailyWage: toMoney(item.dailyWage),
        monthlyWage: toMoney(item.monthlyWage),
        workerStatus: item.workerStatus === "Inactive" ? "Inactive" : "Active",
        assignedProjectIds: normalizeStringList(item.assignedProjectIds),
        assignedWorkerIds: normalizeStringList(item.assignedWorkerIds),
        status: item.status === "disabled" ? "disabled" : "active",
        createdAt: cleanText(item.createdAt, new Date().toISOString()),
      } satisfies EmployeeInvite;
    })
    .filter(Boolean) as EmployeeInvite[];
};

const normalizeActivityLog = (value: unknown): ActivityLogItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const action = cleanText(item.action) as ActivityLogItem["action"];
      const entityType = cleanText(item.entityType) as ActivityLogItem["entityType"];
      const summary = cleanText(item.summary);

      if (!action || !entityType || !summary) return null;

      return {
        id: cleanText(item.id) || uid(),
        timestamp: cleanText(item.timestamp, new Date().toISOString()),
        action,
        entityType,
        entityId: cleanText(item.entityId),
        summary,
        changedBy: cleanText(item.changedBy),
      } satisfies ActivityLogItem;
    })
    .filter(Boolean)
    .slice(0, 100) as ActivityLogItem[];
};

const normalizeWalletData = (value: WalletInput | null): WalletData => {
  const wallet = value || {};
  const legacyBalance = Number(wallet.businessBalance || wallet.personalBalance || 0);

  return {
    profileName:
      typeof wallet.profileName === "string"
        ? wallet.profileName.slice(0, 80)
        : "",
    transactions: normalizeTransactions(wallet.transactions),
    cards: normalizeCards(wallet.cards),
    upiAccounts: normalizeCards(wallet.upiAccounts),
    personAccounts: normalizePersonAccounts(wallet.personAccounts),
    projects: normalizeProjects(wallet.projects),
    company: normalizeCompany(wallet.company),
    materials: normalizeMaterials(wallet.materials),
    reminders: normalizeReminders(wallet.reminders),
    dailyReports: normalizeDailyReports(wallet.dailyReports),
    accountBalances: normalizeAccountBalances(
      wallet.accountBalances,
      legacyBalance
    ),
    personalBalance: Number(wallet.personalBalance || 0),
    businessBalance: Number(wallet.businessBalance || 0),
    theme: wallet.theme === "dark" ? "dark" : "light",
    deletedSourceIds: Array.isArray(wallet.deletedSourceIds)
      ? wallet.deletedSourceIds
        .map((sourceId) => cleanText(sourceId))
        .filter(Boolean)
      : [],
    employeeInvites: normalizeEmployeeInvites(wallet.employeeInvites),
    activityLog: normalizeActivityLog(wallet.activityLog),
  };
};

const isBackupRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const backupArray = (value: unknown) => (Array.isArray(value) ? value : []);

const mergeByKey = <T,>(
  current: T[],
  incoming: T[],
  keyForItem: (item: T) => string
) => {
  const merged = new Map<string, T>();

  current.forEach((item, index) => {
    merged.set(keyForItem(item) || `current-${index}`, item);
  });
  incoming.forEach((item, index) => {
    merged.set(keyForItem(item) || `incoming-${index}`, item);
  });

  return Array.from(merged.values());
};

const transactionBackupKey = (transaction: Transaction) =>
  transaction.sourceId || transaction.id;

const namedBackupKey = (item: { id: string; name?: string }) =>
  item.id || item.name || "";

const reminderBackupKey = (reminder: ReminderItem) =>
  reminder.id || `${reminder.title}:${reminder.dueDate}:${reminder.projectId || ""}`;

const dailyReportBackupKey = (report: DailyWorkReport) =>
  report.id ||
  `${report.date}:${report.projectId || ""}:${report.workerName}:${report.workDescription}`;

const backupPayloadToWallet = (
  payload: unknown,
  currentWallet: WalletData
): { wallet: WalletData; serverPayload: Record<string, unknown> | null } => {
  if (!isBackupRecord(payload)) {
    throw new Error("Backup file must contain a JSON object.");
  }

  const data = isBackupRecord(payload.data) ? payload.data : {};
  const rawWallet = isBackupRecord(payload.wallet)
    ? payload.wallet
    : backupArray(payload.transactions).length ||
      backupArray(payload.projects).length ||
      backupArray(payload.personAccounts).length
      ? payload
      : null;
  const hasCompanyData =
    backupArray(data.transactions).length ||
    backupArray(data.sites).length ||
    backupArray(data.workers).length ||
    backupArray(data.materials).length ||
    backupArray(data.reminders).length ||
    backupArray(data.dailyReports).length;

  if (!rawWallet && !hasCompanyData) {
    throw new Error("Backup format is not recognized.");
  }

  const incomingWalletInput = rawWallet
    ? (rawWallet as WalletInput)
    : ({
      ...currentWallet,
      company: isBackupRecord(payload.company)
        ? payload.company
        : currentWallet.company,
      transactions: data.transactions,
      projects: data.sites,
      personAccounts: data.workers,
      materials: data.materials,
      reminders: data.reminders,
      dailyReports: data.dailyReports,
    } as WalletInput);
  const incomingWallet = normalizeWalletData(incomingWalletInput);
  const mergedWallet = normalizeWalletData({
    ...currentWallet,
    ...incomingWallet,
    company: incomingWallet.company || currentWallet.company,
    transactions: sortTransactionsByDateTime(
      mergeByKey(
        currentWallet.transactions,
        incomingWallet.transactions,
        transactionBackupKey
      )
    ),
    cards: mergeByKey(currentWallet.cards, incomingWallet.cards, namedBackupKey),
    upiAccounts: mergeByKey(
      currentWallet.upiAccounts,
      incomingWallet.upiAccounts,
      namedBackupKey
    ),
    personAccounts: mergeByKey(
      currentWallet.personAccounts,
      incomingWallet.personAccounts,
      namedBackupKey
    ),
    projects: mergeByKey(currentWallet.projects, incomingWallet.projects, namedBackupKey),
    materials: mergeByKey(
      currentWallet.materials,
      incomingWallet.materials,
      namedBackupKey
    ),
    reminders: mergeByKey(
      currentWallet.reminders,
      incomingWallet.reminders,
      reminderBackupKey
    ),
    dailyReports: mergeByKey(
      currentWallet.dailyReports,
      incomingWallet.dailyReports,
      dailyReportBackupKey
    ),
    employeeInvites: mergeByKey(
      currentWallet.employeeInvites,
      incomingWallet.employeeInvites,
      (invite) => invite.code || invite.id
    ),
    activityLog: mergeByKey(
      currentWallet.activityLog,
      incomingWallet.activityLog,
      (entry) => entry.id
    ).slice(0, 100),
    deletedSourceIds: Array.from(
      new Set([...currentWallet.deletedSourceIds, ...incomingWallet.deletedSourceIds])
    ),
  });
  const serverPayload = {
    companyId: mergedWallet.company?.id || "",
    company: mergedWallet.company,
    members: backupArray(payload.members),
    data: {
      transactions: mergedWallet.transactions,
      sites: mergedWallet.projects,
      workers: mergedWallet.personAccounts,
      materials: mergedWallet.materials,
      bills: backupArray(data.bills),
      reminders: mergedWallet.reminders,
      dailyReports: mergedWallet.dailyReports,
    },
  };

  return { wallet: mergedWallet, serverPayload };
};

const storageKey = (username: string) =>
  `walletData:${encodeURIComponent(username.toLowerCase())}`;

const readLegacyWallet = (): WalletData =>
  normalizeWalletData({
    transactions: parseJson<Transaction[]>(
      localStorage.getItem("transactions"),
      []
    ),
    cards: parseJson<CardItem[]>(localStorage.getItem("cards"), []),
    upiAccounts: parseJson<CardItem[]>(
      localStorage.getItem("upiAccounts"),
      []
    ),
    personAccounts: parseJson<PersonAccount[]>(
      localStorage.getItem("personAccounts"),
      []
    ),
    projects: parseJson<ProjectSite[]>(localStorage.getItem("projects"), []),
    materials: parseJson<MaterialItem[]>(localStorage.getItem("materials"), []),
    reminders: parseJson<ReminderItem[]>(localStorage.getItem("reminders"), []),
    company: parseJson<CompanyProfile | null>(localStorage.getItem("company"), null),
    accountBalances: parseJson<Partial<AccountBalances> | undefined>(
      localStorage.getItem("accountBalances"),
      undefined
    ),
    personalBalance: Number(localStorage.getItem("personalBalance") || 0),
    businessBalance: Number(localStorage.getItem("businessBalance") || 0),
    profileName: localStorage.getItem("profileName") || "",
    theme:
      (localStorage.getItem("theme") as ThemeMode | null) === "light"
        ? "light"
        : "dark",
    deletedSourceIds: parseJson<string[]>(localStorage.getItem("deletedSourceIds"), []),
    employeeInvites: parseJson<EmployeeInvite[]>(
      localStorage.getItem("employeeInvites"),
      []
    ),
    activityLog: parseJson<ActivityLogItem[]>(
      localStorage.getItem("activityLog"),
      []
    ),
  });

const readLocalWallet = (username: string): WalletData => {
  const savedWallet = parseJson<Partial<WalletData> | null>(
    localStorage.getItem(storageKey(username)),
    null
  );

  return savedWallet ? normalizeWalletData(savedWallet) : readLegacyWallet();
};

const legacyWalletKeys = [
  "transactions",
  "cards",
  "upiAccounts",
  "personAccounts",
  "projects",
  "materials",
  "reminders",
  "company",
  "accountBalances",
  "personalBalance",
  "businessBalance",
  "profileName",
  "theme",
  "deletedSourceIds",
  "employeeInvites",
  "activityLog",
];

const writeLocalWallet = (username: string, wallet: WalletData) => {
  localStorage.setItem(storageKey(username), JSON.stringify(wallet));
  legacyWalletKeys.forEach((key) => localStorage.removeItem(key));
};

const employeeInviteRegistryKey = "employeeInviteRegistry";
const employeeSessionKey = "employeeSession";

const readEmployeeInviteRegistry = (): EmployeeInvite[] =>
  normalizeEmployeeInvites(
    parseJson<EmployeeInvite[]>(localStorage.getItem(employeeInviteRegistryKey), [])
  );

const writeEmployeeInviteRegistry = (invites: EmployeeInvite[]) => {
  localStorage.setItem(
    employeeInviteRegistryKey,
    JSON.stringify(normalizeEmployeeInvites(invites))
  );
};

const upsertEmployeeInviteRegistry = (invite: EmployeeInvite) => {
  const current = readEmployeeInviteRegistry();
  writeEmployeeInviteRegistry([
    invite,
    ...current.filter((item) => item.code !== invite.code && item.id !== invite.id),
  ]);
};

const readEmployeeSession = (): EmployeeSession | null => {
  const session = parseJson<EmployeeSession | null>(
    localStorage.getItem(employeeSessionKey),
    null
  );
  const normalized = normalizeEmployeeInvites(session ? [session] : [])[0];

  return normalized
    ? {
        ...normalized,
        loginAt: cleanText(session?.loginAt, new Date().toISOString()),
      }
    : null;
};

const writeEmployeeSession = (session: EmployeeSession | null) => {
  if (!session) {
    localStorage.removeItem(employeeSessionKey);
    return;
  }

  localStorage.setItem(employeeSessionKey, JSON.stringify(session));
};

const pendingWriteKey = (username: string) =>
  `walletPendingWrites:${encodeURIComponent(username.toLowerCase())}`;

const markPendingWrite = (username: string) => {
  const pending = parseJson<string[]>(localStorage.getItem(pendingWriteKey(username)), []);
  const nextWriteId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(
    pendingWriteKey(username),
    JSON.stringify(Array.from(new Set([...pending, nextWriteId])).slice(-25))
  );
};

const clearPendingWrites = (username: string) => {
  localStorage.removeItem(pendingWriteKey(username));
};

const hasPendingWrites = (username: string) =>
  parseJson<string[]>(localStorage.getItem(pendingWriteKey(username)), []).length > 0;

const withFirebaseTimeout = async <T,>(
  request: Promise<T>,
  timeoutMs = 8000
) => {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Firebase request timed out")),
      timeoutMs
    );
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer!);
  }
};

const storageStatusText: Record<StorageStatus, string> = {
  local: "Local only",
  loading: "Checking cloud",
  saving: "Saving to Firebase",
  synced: "Synced to Firebase",
  offline: "Offline cache",
  unconfigured: "Firebase setup needed",
  error: "Cloud sync paused",
};



export default function Home() {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [inviteCodeDraft, setInviteCodeDraft] = useState("");
  const [savedUser, setSavedUser] = useState("");
  const [employeeSession, setEmployeeSession] = useState<EmployeeSession | null>(null);
  const [profileName, setProfileName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [registeredUsers, setRegisteredUsers] = useState<AdminUser[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [tab, setTab] = useState<DashboardTab>("Home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [upiAccounts, setUpiAccounts] = useState<CardItem[]>([]);
  const [personAccounts, setPersonAccounts] = useState<PersonAccount[]>([]);
  const [projects, setProjects] = useState<ProjectSite[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyWorkReport[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices] = useState<Invoice[]>([]);
  const [supplierBills] = useState<SupplierBill[]>([]);
  const [attendance] = useState<Attendance[]>([]);
  const [payrollRuns] = useState<PayrollRun[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalances>(
    emptyAccountBalances()
  );
  const [personalBalance, setPersonalBalance] = useState(0);
  const [businessBalance, setBusinessBalance] = useState(0);
  const [form, setForm] = useState<null | TransactionType | "Balance" | "Transfer">(null);
  const [formPreset, setFormPreset] = useState<FormPreset>({});
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [deletedSourceIds, setDeletedSourceIds] = useState<string[]>([]);
  const [employeeInvites, setEmployeeInvites] = useState<EmployeeInvite[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [walletReady, setWalletReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("local");
  const [isOnline, setIsOnline] = useState(true);
  const [isImportingEmail, setIsImportingEmail] = useState(false);
  const [cardDraft, setCardDraft] = useState<CardDraft>({
    name: "",
    number: "",
    expiry: "",
    cardType: "Credit" as NonNullable<CardItem["cardType"]>,
    repaymentDay: "",
  });
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email || "";
  const sessionName = session?.user?.name || sessionEmail;
  const walletStorageUser = employeeSession?.ownerUser || savedUser;

  const applyWalletData = useCallback((wallet: WalletData) => {
    const normalizedWallet = normalizeWalletData(wallet);
    setProfileName(normalizedWallet.profileName);
    setNameDraft(normalizedWallet.profileName);
    setTransactions(normalizedWallet.transactions);
    setCards(normalizedWallet.cards);
    setUpiAccounts(normalizedWallet.upiAccounts);
    setPersonAccounts(normalizedWallet.personAccounts);
    setProjects(normalizedWallet.projects);
    setCompany(normalizedWallet.company);
    setMaterials(normalizedWallet.materials);
    setReminders(normalizedWallet.reminders);
    setDailyReports(normalizedWallet.dailyReports);
    setAccountBalances(normalizedWallet.accountBalances);
    setPersonalBalance(normalizedWallet.personalBalance);
    setBusinessBalance(normalizedWallet.businessBalance);
    setTheme(normalizedWallet.theme);
    setDeletedSourceIds(normalizedWallet.deletedSourceIds);
    setEmployeeInvites(normalizedWallet.employeeInvites);
    setActivityLog(normalizedWallet.activityLog);
  }, []);

  const currentWalletData = useMemo<WalletData>(
    () => ({
      profileName,
      transactions,
      cards,
      upiAccounts,
      personAccounts,
      projects,
      company,
      materials,
      reminders,
      dailyReports,
      accountBalances,
      personalBalance,
      businessBalance,
      theme,
      deletedSourceIds,
      employeeInvites,
      activityLog,
    }),
    [
      profileName,
      transactions,
      cards,
      upiAccounts,
      personAccounts,
      projects,
      company,
      materials,
      reminders,
      dailyReports,
      accountBalances,
      personalBalance,
      businessBalance,
      theme,
      deletedSourceIds,
      employeeInvites,
      activityLog,
    ]
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    setRegisteredUsers(
      parseJson<AdminUser[]>(localStorage.getItem("adminUsers"), [])
    );

    const inviteCode = new URLSearchParams(window.location.search)
      .get("invite")
      ?.trim()
      .toUpperCase();

    if (inviteCode) {
      setInviteCodeDraft(inviteCode);
    }
  }, []);

  useEffect(() => {
    employeeInvites.forEach((invite) => {
      if (invite.status === "active") {
        upsertEmployeeInviteRegistry(invite);
      }
    });
  }, [employeeInvites]);

  useEffect(() => {
    const updateOnlineState = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!sessionEmail) {
      const authMode = localStorage.getItem("authMode");
      const localUsername = localStorage.getItem("username") || "";

      if (authMode === "employee") {
        const session = readEmployeeSession();

        if (session?.ownerUser && session.status === "active") {
          const wallet = readLocalWallet(session.ownerUser);

          setEmployeeSession(session);
          applyWalletData(wallet);
          setSavedUser(localUsername || `employee:${session.code}`);
          setProfileName(session.displayName);
          setNameDraft(session.displayName);
          setShowWelcome(false);
          setStorageStatus("local");
          setWalletReady(true);
          setTab(session.role === "worker" ? "People" : "Sites");
          return;
        }
      }

      if (authMode === "demo" && localUsername === DEMO_USER) {
        const wallet = readLocalWallet(DEMO_USER);

        setEmployeeSession(null);
        applyWalletData(wallet.profileName ? wallet : demoWalletData());
        setSavedUser(DEMO_USER);
        setProfileName(wallet.profileName || "Demo Company");
        setNameDraft(wallet.profileName || "Demo Company");
        setShowWelcome(false);
        setStorageStatus("local");
        setWalletReady(true);
        return;
      }

      localStorage.removeItem("username");
      localStorage.removeItem("authMode");
      writeEmployeeSession(null);
      setSavedUser("");
      setEmployeeSession(null);
      setProfileName("");
      setNameDraft("");
      setShowWelcome(false);
      setStorageStatus("local");
      setWalletReady(false);
      applyWalletData(readLegacyWallet());
    }
  }, [status, sessionEmail, applyWalletData]);

  useEffect(() => {
    const googleEmail = sessionEmail;
    if (!googleEmail || savedUser) return;

    const userRecord = {
      username: googleEmail,
      email: googleEmail,
      lastLogin: new Date().toISOString(),
    };
    const nextUsers = [
      userRecord,
      ...registeredUsers.filter((user) => user.username !== googleEmail),
    ];

    localStorage.setItem("username", googleEmail);
    localStorage.setItem("authMode", "google");
    writeEmployeeSession(null);
    localStorage.setItem("adminUsers", JSON.stringify(nextUsers));
    setRegisteredUsers(nextUsers);
    setEmployeeSession(null);
    setSavedUser(googleEmail);
    setShowWelcome(false);
  }, [sessionEmail, savedUser, registeredUsers]);

  useEffect(() => {
    if (!sessionName || profileName) {
      return;
    }

    setNameDraft(sessionName);
  }, [sessionName, profileName]);

  useEffect(() => {
    if (!savedUser || !profileName || company || employeeSession) {
      return;
    }

    setCompany({
      id: uid(),
      name: `${profileName}'s Company`,
      ownerEmail: sessionEmail || savedUser,
      plan: "Starter",
      role: "Owner",
    });
  }, [savedUser, profileName, sessionEmail, company, employeeSession]);

  useEffect(() => {
    if (!savedUser) {
      return;
    }

    let cancelled = false;

    const loadWallet = async () => {
      setWalletReady(false);
      applyWalletData(readLocalWallet(walletStorageUser));

      if (!employeeSession && sessionEmail && savedUser === sessionEmail) {
        if (!isOnline) {
          setStorageStatus("offline");
          if (!cancelled) {
            setWalletReady(true);
          }
          return;
        }

        setStorageStatus("loading");

        try {
          if (cancelled) {
            return;
          }

          if (!isFirebaseConfigured) {
            setStorageStatus("unconfigured");
            return;
          }

          const wallet = await withFirebaseTimeout(
            loadFirebaseWallet(sessionEmail)
          );

          if (wallet) {
            applyWalletData(normalizeWalletData(wallet));
            setStorageStatus("synced");
          } else {
            setStorageStatus("saving");
          }
        } catch {
          if (!cancelled) {
            setStorageStatus("error");
          }
        }
      } else {
        setStorageStatus("local");
      }

      if (!cancelled) {
        setWalletReady(true);
      }
    };

    loadWallet();

    return () => {
      cancelled = true;
    };
  }, [savedUser, walletStorageUser, employeeSession, sessionEmail, isOnline, applyWalletData]);

  useEffect(() => {
    if (!savedUser || !walletReady) {
      return;
    }

    writeLocalWallet(walletStorageUser, currentWalletData);
    if (!employeeSession && savedUser === sessionEmail && (!isOnline || storageStatus === "error")) {
      markPendingWrite(savedUser);
    }
  }, [savedUser, walletStorageUser, employeeSession, sessionEmail, isOnline, storageStatus, walletReady, currentWalletData]);

  useEffect(() => {
    if (!savedUser || employeeSession || savedUser !== sessionEmail || !walletReady) {
      return;
    }

    let cancelled = false;
    const saveTimer = window.setTimeout(async () => {
      const authMode = typeof window !== "undefined" ? localStorage.getItem("authMode") : null;
      const isDemoAuth = authMode === "demo";
      const isDemoUser = savedUser === DEMO_USER;
      const isDemoCompany = company?.id === "demo-company";

      if (!isOnline) {
        setStorageStatus("offline");
        return;
      }

      setStorageStatus("saving");

      try {
        if (!isFirebaseConfigured) {
          setStorageStatus("unconfigured");
          return;
        }

        // Prevent demo/local data from syncing to real Firebase
        if (isDemoAuth || isDemoUser || isDemoCompany) {
          // skip saving demo wallet to remote
          if (!cancelled) setStorageStatus("local");
        } else {
          await withFirebaseTimeout(
            saveFirebaseWallet({
              email: sessionEmail,
              username: profileName || sessionName,
              wallet: currentWalletData,
            })
          );
        }

        if (!cancelled) {
          clearPendingWrites(savedUser);
          setStorageStatus("synced");
        }
      } catch {
        if (!cancelled) {
          setStorageStatus("error");
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(saveTimer);
    };
  }, [
    savedUser,
    employeeSession,
    sessionEmail,
    sessionName,
    profileName,
    isOnline,
    walletReady,
    currentWalletData,
    company?.id,
  ]);

  useEffect(() => {
    const authMode = typeof window !== "undefined" ? localStorage.getItem("authMode") : null;
    const isDemoAuth = authMode === "demo";
    const isDemoUser = savedUser === DEMO_USER;
    const isDemoCompany = company?.id === "demo-company";

    if (
      !savedUser ||
      employeeSession ||
      savedUser !== sessionEmail ||
      !walletReady ||
      !isOnline ||
      !company?.id ||
      isDemoAuth ||
      isDemoUser ||
      isDemoCompany
    ) {
      return;
    }

    let cancelled = false;
    const syncTimer = window.setTimeout(async () => {
      try {
        await syncWalletToCompanySubcollections({
          companyId: company.id,
          wallet: currentWalletData,
        });
      } catch {
        if (!cancelled) {
          markPendingWrite(savedUser);
        }
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(syncTimer);
    };
  }, [
    savedUser,
    employeeSession,
    sessionEmail,
    walletReady,
    isOnline,
    company?.id,
    currentWalletData,
  ]);

  useEffect(() => {
    if (
      !savedUser ||
      employeeSession ||
      savedUser !== sessionEmail ||
      !walletReady ||
      !isOnline ||
      !isFirebaseConfigured
    ) {
      return;
    }

    try {
      return subscribeFirebaseWallet(
        sessionEmail,
        (wallet) => {
          if (!wallet || hasPendingWrites(savedUser)) {
            return;
          }

          applyWalletData(normalizeWalletData(wallet));
          setStorageStatus("synced");
        },
        () => setStorageStatus("error")
      );
    } catch {
      setStorageStatus("error");
    }
  }, [savedUser, employeeSession, sessionEmail, walletReady, isOnline, applyWalletData]);

  const accessContext = useMemo(
    () =>
      buildAccessContext({
        companyRole: company?.role,
        employee: employeeSession,
      }),
    [company?.role, employeeSession]
  );
  const canViewFinance = canAccess(accessContext, "finance:read");
  const canWriteTransactions = canAccess(accessContext, "transactions:write");
  const canManageSites = canAccess(accessContext, "sites:write");
  const canManageWorkers =
    accessContext.role === "owner" || accessContext.role === "admin";
  const canViewSettings = canAccess(accessContext, "settings:read");
  const visibleProjects = useMemo(
    () => filterProjectsForAccess(projects, accessContext),
    [projects, accessContext]
  );
  const visibleWorkers = useMemo(
    () => filterWorkersForAccess(personAccounts, accessContext),
    [personAccounts, accessContext]
  );
  const visibleTransactions = useMemo(
    () => filterTransactionsForAccess(transactions, accessContext),
    [transactions, accessContext]
  );
  const visibleMaterials = useMemo(
    () => filterMaterialsForAccess(materials, accessContext),
    [materials, accessContext]
  );
  const visibleReminders = useMemo(
    () => filterRemindersForAccess(reminders, accessContext),
    [reminders, accessContext]
  );
  const visibleDailyReports = useMemo(
    () => filterDailyReportsForAccess(dailyReports, accessContext),
    [dailyReports, accessContext]
  );
  const selectedMonthTransactions = useMemo(
    () => visibleTransactions.filter((t) => transactionMonth(t) === selectedMonth),
    [visibleTransactions, selectedMonth]
  );
  const reportTransactions = selectedMonthTransactions;

  const ledgerAccounts = useMemo(
    () => buildLedgerAccounts(accountBalances, cards, upiAccounts, visibleTransactions),
    [accountBalances, cards, upiAccounts, visibleTransactions]
  );

  const repaymentReminders = useMemo(
    () =>
      cards
        .filter((card) => card.cardType === "Credit")
        .map((card) => ({
          card,
          daysLeft: daysUntilMonthDay(card.repaymentDay),
        }))
        .filter(
          (reminder): reminder is { card: CardItem; daysLeft: number } =>
            reminder.daysLeft !== null &&
            reminder.daysLeft >= 0 &&
            reminder.daysLeft <= 2
        ),
    [cards]
  );

  const selectedMonthExternalTransactions = selectedMonthTransactions.filter(
    (tx) => !isTransferTransaction(tx)
  );
  const accountMonthIncome = selectedMonthExternalTransactions
    .filter(isMoneyIn)
    .reduce((total, tx) => total + tx.amount, 0);
  const accountMonthSpent = selectedMonthExternalTransactions
    .filter(isMoneyOut)
    .reduce((total, tx) => total + tx.amount, 0);

  const accountCurrent = ledgerAccounts.reduce(
    (total, account) => total + account.amount,
    0
  );
  const currentMonth = monthKey();
  const canShowNextMonth = selectedMonth < currentMonth;

  const reportAccounts = useMemo<ReportAccount[]>(
    () =>
      ledgerAccounts.map((account) => ({
        ...account,
        transactions: account.transactions.filter(
          (tx) => transactionMonth(tx) === selectedMonth
        ),
      })),
    [ledgerAccounts, selectedMonth]
  );
  const dataHealthWarnings = useMemo(() => {
    const warnings: string[] = [];
    const siteIds = new Set(projects.map((project) => project.id));

    const unlinkedTransactions = transactions.filter(
      (tx) =>
        (tx.type === "Expense" || tx.type === "Income" || tx.type === "Pay In" || tx.type === "Pay Out") &&
        !tx.projectId
    ).length;
    if (unlinkedTransactions) warnings.push(`${unlinkedTransactions} transaction(s) have no site selected.`);

    const materialsWithoutSupplier = materials.filter((material) => !material.supplier).length;
    if (materialsWithoutSupplier) warnings.push(`${materialsWithoutSupplier} material item(s) have no supplier.`);

    const workersWithoutSite = personAccounts.filter((worker) => !worker.projectId || !siteIds.has(worker.projectId)).length;
    if (workersWithoutSite) warnings.push(`${workersWithoutSite} worker(s) have no valid assigned site.`);

    const creditCardsWithoutRepayDay = cards.filter(
      (card) => card.cardType === "Credit" && !card.repaymentDay
    ).length;
    if (creditCardsWithoutRepayDay) warnings.push(`${creditCardsWithoutRepayDay} credit card(s) need repayment day.`);

    const duplicateCount = transactions.filter((tx, index) =>
      Boolean(findPossibleDuplicateTransaction(tx, transactions.slice(0, index)))
    ).length;
    if (duplicateCount) warnings.push(`${duplicateCount} transaction(s) look like possible duplicates.`);

    return warnings;
  }, [cards, materials, personAccounts, projects, transactions]);
  const dashboardKpis = useMemo(() => {
    const pendingCustomerAmount = visibleProjects.reduce((total, project) => {
      const income = visibleTransactions
        .filter((tx) => tx.projectId === project.id && isMoneyIn(tx))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const extras = (project.extras || []).reduce(
        (sum, extra) => sum + extra.amount,
        0
      );
      return total + Math.max(project.budget + extras - income, 0);
    }, 0);
    const workerPayable = visibleWorkers.reduce((total, worker) => {
      const opening = worker.direction === "Payable" ? -worker.amount : worker.amount;
      const entries = (worker.entries || []).reduce(
        (sum, entry) =>
          sum + (entry.direction === "Debit" ? entry.amount : -entry.amount),
        0
      );
      const balance = opening + entries;
      return balance < 0 ? total + Math.abs(balance) : total;
    }, 0);
    const materialStockValue = visibleMaterials.reduce(
      (total, material) =>
        total +
        Math.max(0, material.quantity - (material.usedQuantity || 0)) * material.rate,
      0
    );
    const rankedSites = visibleProjects
      .map((project) => {
        const siteTx = visibleTransactions.filter((tx) => tx.projectId === project.id);
        const income = siteTx.filter(isMoneyIn).reduce((sum, tx) => sum + tx.amount, 0);
        const expense = siteTx.filter(isMoneyOut).reduce((sum, tx) => sum + tx.amount, 0);
        return { name: project.name, profit: income - expense };
      })
      .sort((left, right) => right.profit - left.profit);
    const bestSite = rankedSites[0];

    return [
      { label: "Customer Pending", value: rupee(pendingCustomerAmount), tone: "text-amber-600" },
      { label: "Worker Payable", value: rupee(workerPayable), tone: "text-red-500" },
      { label: "Material Stock", value: rupee(materialStockValue), tone: "text-emerald-600" },
      {
        label: "Top Site P/L",
        value: bestSite ? `${bestSite.name}: ${rupee(bestSite.profit)}` : "No sites",
        tone: bestSite && bestSite.profit < 0 ? "text-red-500" : "text-emerald-600",
      },
    ];
  }, [visibleMaterials, visibleProjects, visibleTransactions, visibleWorkers]);
  const isAdmin = DEMO_ADMIN_ENABLED && savedUser === TEMP_DOMAIN_USERNAME;
  const allowedTabs: DashboardTab[] = useMemo(() => {
    if (accessContext.role === "worker") {
      return ["Account", "People"];
    }

    if (accessContext.role === "supervisor") {
      return ["Account", "Sites", "People"];
    }

    const base: DashboardTab[] = [
      "Home",
      "Account",
      "Sites",
      "People",
      "Money",
      "Add",
      "Settings",
      "Analytics",
      "DeliveryDashboard",
      "Ratio",
      "DailyReport",
      "DailyCashReport",
      "GroupAnalytics",
      "POS",
      "PriceChecker",
      "ZeevOrders",
      "SalesReceipt",
      "SalesOrder",
      "Quotation",
      "RouteSales",
    ];

    if (isAdmin) {
      base.push("Admin");
    }

    return base;
  }, [accessContext.role, isAdmin]);

  const displayName =
    employeeSession?.displayName || profileName || savedUser;
  const syncNotice =
    !isOnline
      ? "Offline mode: changes are saved locally and will sync when internet returns."
      : storageStatus === "error"
        ? "Firebase sync is paused. Local cache is still saving changes."
        : walletStorageUser && hasPendingWrites(walletStorageUser)
          ? "Local changes are waiting to sync."
          : "";
  const showToast = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
  }, []);
  const addActivity = useCallback(
    (entry: Omit<ActivityLogItem, "id" | "timestamp" | "changedBy">) => {
      setActivityLog((current) =>
        [
          {
            id: uid(),
            timestamp: new Date().toISOString(),
            changedBy: employeeSession?.displayName || savedUser || "local",
            ...entry,
          },
          ...current,
        ].slice(0, 100)
      );
    },
    [employeeSession?.displayName, savedUser]
  );
  const guardPlanLimit = useCallback(
    (key: PlanLimitKey, currentCount: number) => {
      const plan = company?.plan || "Starter";

      if (!isLimitReached({ plan, key, currentCount })) {
        return true;
      }

      showToast(limitReachedMessage({ plan, key }), "error");
      setTab("Settings");
      return false;
    },
    [company?.plan, showToast]
  );

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!savedUser || allowedTabs.includes(tab)) {
      return;
    }

    setTab(allowedTabs[0] || "Home");
    closeForm();
  }, [savedUser, allowedTabs, tab]);


  const openForm = (
    nextForm: TransactionType | "Balance" | "Transfer",
    preset: FormPreset = {}
  ) => {
    if (!canWriteTransactions) {
      showToast("This role cannot add finance entries.", "error");
      return;
    }

    setFormPreset(preset);
    setForm(nextForm);
  };
  const startDemoCompany = () => {
    const wallet = demoWalletData();

    localStorage.setItem("username", DEMO_USER);
    localStorage.setItem("authMode", "demo");
    writeEmployeeSession(null);
    writeLocalWallet(DEMO_USER, wallet);
    applyWalletData(wallet);
    setEmployeeSession(null);
    setSavedUser(DEMO_USER);
    setProfileName(wallet.profileName);
    setNameDraft(wallet.profileName);
    setAcceptedTerms(true);
    setLoginError("");
    setShowWelcome(false);
    setWalletReady(true);
    setStorageStatus("local");
    setTab("Home");
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    localStorage.removeItem("username");
    localStorage.removeItem("authMode");
    writeEmployeeSession(null);
    localStorage.removeItem("profileName");
    setSavedUser("");
    setEmployeeSession(null);
    setProfileName("");
    setNameDraft("");
    setAcceptedTerms(false);
    setLoginError("");
    setShowWelcome(false);
    setTab("Home");
    setStorageStatus("local");
    setWalletReady(false);
    applyWalletData(emptyWalletData());
  };
  const closeForm = () => {
    setForm(null);
    setFormPreset({});
  };
  const importBackup = useCallback(
    async (payload: unknown) => {
      const { wallet, serverPayload } = backupPayloadToWallet(
        payload,
        currentWalletData
      );

      applyWalletData(wallet);
      setStorageStatus(savedUser === sessionEmail ? "saving" : "local");

      let cloudMessage = "";

      if (
        serverPayload?.companyId &&
        savedUser === sessionEmail &&
        sessionEmail &&
        isOnline
      ) {
        try {
          const response = await fetch("/api/backup/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(serverPayload),
          });
          const result = (await response.json().catch(() => ({}))) as {
            error?: string;
            importedMembers?: number;
            collections?: Record<string, { imported?: number }>;
          };

          if (!response.ok) {
            cloudMessage = ` Local restore complete. Cloud restore skipped: ${result.error || "backup API failed"}.`;
          } else {
            const importedCollections = Object.values(result.collections || {}).reduce(
              (total, item) => total + (item.imported || 0),
              0
            );
            cloudMessage = ` Cloud import checked ${importedCollections} record(s).`;
          }
        } catch {
          cloudMessage = " Local restore complete. Cloud restore will retry through sync.";
        }
      }

      const message = `Backup imported safely. Known records were merged by ID/source where possible.${cloudMessage}`;
      addActivity({
        action: "backup:import",
        entityType: "backup",
        summary: "Backup imported and merged",
      });
      showToast("Backup imported", "success");
      return message;
    },
    [
      applyWalletData,
      currentWalletData,
      isOnline,
      savedUser,
      sessionEmail,
      showToast,
      addActivity,
    ]
  );
  const exportCloudBackup = useCallback(async () => {
    if (!company?.id) {
      throw new Error("Create or load a company before exporting cloud backup.");
    }

    const response = await fetch(
      `/api/backup/export?companyId=${encodeURIComponent(company.id)}`,
      { cache: "no-store" }
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "Cloud backup export failed.");
    }

    return payload;
  }, [company?.id]);
  const connectGmailAccess = () => {
    void googleSignIn(
      "google",
      undefined,
      {
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        scope:
          "openid email profile https://www.googleapis.com/auth/gmail.readonly",
      }
    );
  };
  const startEmployeeLogin = async () => {
    const code = inviteCodeDraft.trim().toUpperCase();

    if (!code) {
      setLoginError("Enter your invite code.");
      return;
    }

    const invite = readEmployeeInviteRegistry().find(
      (item) => item.code.toUpperCase() === code && item.status === "active"
    );

    if (!invite) {
      setLoginError("Invite code not found or disabled.");
      return;
    }

    // Call secure join API to validate invite and create/activate member server-side.
    try {
      const resp = await fetch("/api/company/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: invite.companyId, code: invite.code }),
      });

      const payload = (await resp.json().catch(() => ({}))) as { error?: string; ok?: boolean; role?: string };

      if (!resp.ok) {
        // If not signed in, instruct user to sign in; otherwise show server error
        if (resp.status === 401) {
          setLoginError("Sign in required to accept invite. Please sign in and try again.");
          return;
        }

        setLoginError(payload.error || "Invite acceptance failed.");
        return;
      }

      const finalRole = payload.role || invite.role || "worker";

      const session: EmployeeSession = {
        ...invite,
        role: finalRole as EmployeeSession["role"],
        loginAt: new Date().toISOString(),
      };

      // Load owner's local wallet and proceed with existing local session behavior
      const wallet = readLocalWallet(invite.ownerUser);

      writeEmployeeSession(session);
      localStorage.setItem("username", `employee:${invite.code}`);
      localStorage.setItem("authMode", "employee");
      setEmployeeSession(session);
      applyWalletData(wallet);
      setSavedUser(`employee:${invite.code}`);
      setProfileName(invite.displayName);
      setNameDraft(invite.displayName);
      setAcceptedTerms(true);
      setLoginError("");
      setShowWelcome(false);
      setWalletReady(true);
      setStorageStatus("local");
      setTab(finalRole === "worker" ? "People" : "Sites");
    } catch {
      setLoginError("Invite acceptance failed.");
      return;
    }
  };
  const importEmailTransactions = useCallback(async () => {
    if (isImportingEmail) return;

    setIsImportingEmail(true);
    try {
      const response = await fetch("/api/email-import", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        scanned?: number;
        matched?: number;
        transactions?: Transaction[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Gmail import failed.");
      }

      const imported = normalizeTransactions(payload.transactions || []);
      const deletedKeys = new Set(deletedSourceIds);
      const existingKeys = new Set(
        transactions.map((tx) => transactionBackupKey(tx))
      );
      const incomingKeys = new Set<string>();
      const additions = imported
        .filter((tx) => {
          const key = transactionBackupKey(tx);
          if (
            !key ||
            deletedKeys.has(key) ||
            existingKeys.has(key) ||
            incomingKeys.has(key) ||
            findPossibleDuplicateTransaction(tx, transactions)
          ) {
            return false;
          }
          incomingKeys.add(key);
          return true;
        })
        .map((tx) => ({
          ...tx,
          id: tx.id || uid(),
          companyId: tx.companyId || company?.id,
        }));

      if (additions.length > 0) {
        setTransactions((current) =>
          sortTransactionsByDateTime([...additions, ...current])
        );
      }

      showToast(
        additions.length > 0
          ? `Imported ${additions.length} Gmail transaction${additions.length === 1 ? "" : "s"}`
          : "No new Gmail transactions found",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Gmail import failed.",
        "error"
      );
    } finally {
      setIsImportingEmail(false);
    }
  }, [
    company?.id,
    deletedSourceIds,
    isImportingEmail,
    showToast,
    transactions,
  ]);
  const saveCardDraft = () => {
    const name = cleanText(cardDraft.name);
    const repaymentDay = Number(cardDraft.repaymentDay || 0);
    const hasRepaymentDay =
      cardDraft.cardType === "Credit" &&
      Number.isFinite(repaymentDay) &&
      repaymentDay >= 1 &&
      repaymentDay <= 31;

    if (!name) {
      showToast("Add a card name.", "error");
      return;
    }

    if (cardDraft.cardType === "Credit" && !hasRepaymentDay) {
      showToast("Enter a repayment day from 1 to 31.", "error");
      return;
    }

    setCards((current) => [
      ...current,
      {
        id: uid(),
        name,
        number: maskCardNumber(cleanText(cardDraft.number)),
        expiry: cleanText(cardDraft.expiry),
        cardType: cardDraft.cardType,
        repaymentDay: hasRepaymentDay ? repaymentDay : undefined,
      },
    ]);
    setCardDraft({
      name: "",
      number: "",
      expiry: "",
      cardType: "Credit",
      repaymentDay: "",
    });
    showToast("Card saved", "success");
  };
  const updateCard = (cardId: string, patch: Partial<CardItem>) => {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const nextCardType =
          patch.cardType === "Credit" || patch.cardType === "Debit"
            ? patch.cardType
            : patch.cardType === undefined
              ? card.cardType
              : undefined;
        const nextRepaymentDay =
          nextCardType === "Credit"
            ? patch.repaymentDay === undefined
              ? card.repaymentDay
              : patch.repaymentDay
            : undefined;

        return {
          ...card,
          ...patch,
          name:
            patch.name === undefined ? card.name : cleanText(patch.name, card.name),
          number:
            patch.number === undefined
              ? card.number
              : maskCardNumber(cleanText(patch.number)),
          expiry:
            patch.expiry === undefined ? card.expiry : cleanText(patch.expiry),
          cardType: nextCardType,
          repaymentDay:
            nextCardType === "Credit" &&
            nextRepaymentDay !== undefined &&
            nextRepaymentDay >= 1 &&
            nextRepaymentDay <= 31
              ? nextRepaymentDay
              : undefined,
        };
      })
    );
  };
  const saveProfileName = () => {
    const clean = nameDraft.trim();

    if (!clean) {
      setLoginError("Enter your name.");
      return;
    }

    setProfileName(clean);
    setNameDraft(clean);
    setLoginError("");
    setShowWelcome(false);
  };

  const createEmployeeInvite = (input: {
    role: EmployeeInvite["role"];
    displayName: string;
    phone?: string;
    workerSubRole?: EmployeeInvite["workerSubRole"];
    workerId?: string;
    assignedSupervisor?: string;
    dailyWage?: number;
    monthlyWage?: number;
    workerStatus?: EmployeeInvite["workerStatus"];
    assignedProjectIds?: string[];
    assignedWorkerIds?: string[];
  }) => {
    if (!company?.id) {
      showToast("Create or load a company before generating invite codes.", "error");
      return null;
    }

    const displayName = cleanText(input.displayName, roleLabel(input.role));
    if (!displayName) {
      showToast("Add a worker name before generating invite.", "error");
      return null;
    }

    const assignedProjectIds = Array.from(
      new Set(
        (input.assignedProjectIds || [])
          .map((projectId) => cleanText(projectId))
          .filter((projectId) =>
            projects.some((project) => project.id === projectId)
          )
      )
    );
    const assignedWorkerIds = Array.from(
      new Set(
        (input.assignedWorkerIds || [])
          .map((workerId) => cleanText(workerId))
          .filter((workerId) =>
            personAccounts.some((worker) => worker.id === workerId)
          )
      )
    );

    if (input.role === "supervisor") {
      const supervisorCount = personAccounts.filter(
        (worker) => worker.workerSubRole === "Supervisor"
      ).length;
      if (!guardPlanLimit("supervisors", supervisorCount)) return null;
    }

    const codePrefix = input.role === "worker" ? "WORKER" : "SUP";
    const code = `${codePrefix}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    const invite: EmployeeInvite = {
      id: uid(),
      companyId: company.id,
      ownerUser: walletStorageUser || savedUser,
      code,
      role: input.role,
      displayName,
      phone: cleanText(input.phone),
      workerSubRole:
        input.role === "worker" || input.role === "supervisor"
          ? normalizeConstructionWorkerRole(input.workerSubRole)
          : undefined,
      workerId: cleanText(input.workerId),
      assignedSupervisor: cleanText(input.assignedSupervisor),
      dailyWage: Math.max(0, input.dailyWage || 0),
      monthlyWage: Math.max(0, input.monthlyWage || 0),
      workerStatus: input.workerStatus || "Active",
      assignedProjectIds,
      assignedWorkerIds,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    setEmployeeInvites((current) => [
      invite,
      ...current.filter((item) => item.code !== invite.code),
    ]);
    upsertEmployeeInviteRegistry(invite);

    if (invite.workerId) {
      setPersonAccounts((current) =>
        current.map((worker) =>
          worker.id === invite.workerId
            ? {
                ...worker,
                phone: invite.phone || worker.phone,
                workerSubRole: invite.workerSubRole || worker.workerSubRole,
                assignedSupervisor:
                  invite.assignedSupervisor || worker.assignedSupervisor,
                projectId: invite.assignedProjectIds[0] || worker.projectId,
                dailyWage: invite.dailyWage || worker.dailyWage,
                monthlyWage: invite.monthlyWage || worker.monthlyWage,
                status: invite.workerStatus || worker.status || "Active",
                referralCode: invite.code,
              }
            : worker
        )
      );
    } else {
      const workerId = uid();
      const assignedProjectId = invite.assignedProjectIds[0] || "";

      invite.workerId = workerId;
      invite.assignedWorkerIds =
        invite.role === "worker"
          ? [workerId]
          : Array.from(new Set([workerId, ...invite.assignedWorkerIds]));
      setEmployeeInvites((current) =>
        current.map((item) => (item.id === invite.id ? invite : item))
      );
      upsertEmployeeInviteRegistry(invite);
      setPersonAccounts((current) => [
        ...current,
        {
          id: workerId,
          companyId: company.id,
          name: invite.displayName,
          phone: invite.phone,
          amount: 0,
          direction: "Payable",
          note: "",
          date: localDateInputValue(),
          entries: [],
          role: "worker",
          assignedSupervisor: invite.assignedSupervisor,
          workerSubRole:
            invite.role === "supervisor"
              ? "Supervisor"
              : invite.workerSubRole || "Other",
          projectId: assignedProjectId,
          dailyWage: invite.dailyWage || 0,
          monthlyWage: invite.monthlyWage || 0,
          status: invite.workerStatus || "Active",
          referralCode: invite.code,
        },
      ]);
    }

    showToast(`${roleLabel(invite.role)} invite code ready`, "success");
    return invite;
  };

  const createWorker = (
    worker: Omit<PersonAccount, "id" | "entries"> & {
      entries?: PersonAccountEntry[];
    }
  ) => {
    const validationError = validateWorkerDraft(worker);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    if (!guardPlanLimit("workers", personAccounts.length)) return;

    setPersonAccounts((current) => [
      ...current,
      {
        id: uid(),
        ...worker,
        companyId: company?.id || worker.companyId,
        role: "worker",
        phone: cleanText(worker.phone),
        note: cleanText(worker.note),
        invitedBy: cleanText(worker.invitedBy),
        assignedSupervisor: cleanText(worker.assignedSupervisor),
        workerSubRole: worker.workerSubRole || "Other",
        projectId: cleanText(worker.projectId),
        dailyWage: Math.max(0, worker.dailyWage || 0),
        monthlyWage: Math.max(0, worker.monthlyWage || 0),
        status: worker.status || "Active",
        referralCode: cleanText(worker.referralCode),
        entries: worker.entries || [],
      },
    ]);
    addActivity({
      action: "worker:create",
      entityType: "worker",
      summary: `Worker added: ${worker.name}`,
    });
  };

  const updateWorker = (workerId: string, patch: Partial<PersonAccount>) => {
    addActivity({
      action: "worker:update",
      entityType: "worker",
      entityId: workerId,
      summary: "Worker updated",
    });
    setPersonAccounts((current) =>
      current.map((worker) =>
        worker.id === workerId
          ? {
            ...worker,
            ...patch,
            phone:
              patch.phone === undefined ? worker.phone : cleanText(patch.phone),
            note:
              patch.note === undefined ? worker.note : cleanText(patch.note),
            projectId:
              patch.projectId === undefined
                ? worker.projectId
                : cleanText(patch.projectId),
            workerSubRole: patch.workerSubRole || worker.workerSubRole || "Other",
            dailyWage:
              patch.dailyWage === undefined
                ? worker.dailyWage
                : Math.max(0, patch.dailyWage),
            monthlyWage:
              patch.monthlyWage === undefined
                ? worker.monthlyWage
                : Math.max(0, patch.monthlyWage),
            status: patch.status || worker.status || "Active",
          }
          : worker
      )
    );
  };

  const createDailyReport = (report: Omit<DailyWorkReport, "id">) => {
    const validationError = validateDailyReportDraft(report);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    setDailyReports((current) => [
      {
        id: uid(),
        companyId: company?.id || report.companyId,
        ...report,
        projectId: cleanText(report.projectId),
        workerId: cleanText(report.workerId),
        workerName: cleanText(report.workerName, "Worker"),
        workerRole: normalizeConstructionWorkerRole(report.workerRole),
        workDescription: cleanText(report.workDescription, "Daily work report"),
        materialsUsed: cleanText(report.materialsUsed),
        hoursWorked: Math.max(0, report.hoursWorked || 0),
        paymentAdvance: Math.max(0, report.paymentAdvance || 0),
        issues: cleanText(report.issues),
        nextWorkPlan: cleanText(report.nextWorkPlan),
        photosNote: cleanText(report.photosNote),
        status: report.status || "Draft",
        updatedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    addActivity({
      action: "report:create",
      entityType: "report",
      summary: `Report submitted for ${report.workerName}`,
    });
  };

  const updateDailyReport = (
    reportId: string,
    patch: Partial<DailyWorkReport>
  ) =>
    setDailyReports((current) =>
      current.map((report) =>
        report.id === reportId
          ? {
            ...report,
            ...patch,
            projectId:
              patch.projectId === undefined
                ? report.projectId
                : cleanText(patch.projectId),
            workerRole: patch.workerRole
              ? normalizeConstructionWorkerRole(patch.workerRole)
              : report.workerRole,
            status: patch.status || report.status,
            updatedAt: new Date().toISOString(),
          }
          : report
      )
    );

  const addWorkerEntry = (
    workerId: string,
    entry: Omit<PersonAccountEntry, "id">
  ) =>
    setPersonAccounts((current) =>
      current.map((worker) =>
        worker.id === workerId
          ? {
            ...worker,
            entries: [
              {
                id: uid(),
                ...entry,
                narration: cleanText(entry.narration),
                projectId: cleanText(entry.projectId),
              },
              ...(worker.entries || []),
            ],
          }
          : worker
      )
    );

  const deleteWorkerEntry = (workerId: string, entryId: string) =>
    setPersonAccounts((current) =>
      current.map((worker) =>
        worker.id === workerId
          ? {
            ...worker,
            entries: (worker.entries || []).filter(
              (entry) => entry.id !== entryId
            ),
          }
          : worker
      )
    );

  const createMaterial = (material: Omit<MaterialItem, "id">) => {
    const validationError = validateMaterialDraft(material);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    if (!guardPlanLimit("materials", materials.length)) return;

    setMaterials((current) => [
      ...current,
      {
        id: uid(),
        ...material,
        companyId: company?.id || material.companyId,
        projectId: cleanText(material.projectId),
        category: normalizeMaterialCategory(material.category),
        name: cleanText(material.name),
        unit: cleanText(material.unit, "pcs"),
        supplier: cleanText(material.supplier),
        note: cleanText(material.note),
        quantity: Math.max(0, material.quantity || 0),
        usedQuantity: Math.max(0, material.usedQuantity || 0),
        lowStockAt: Math.max(0, material.lowStockAt || 0),
        rate: Math.max(0, material.rate || 0),
      },
    ]);
    addActivity({
      action: "material:create",
      entityType: "material",
      summary: `Material added: ${material.name}`,
    });
  };

  const updateMaterial = (materialId: string, patch: Partial<MaterialItem>) => {
    addActivity({
      action: "material:update",
      entityType: "material",
      entityId: materialId,
      summary: "Material updated",
    });
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId
          ? {
            ...material,
            ...patch,
            projectId:
              patch.projectId === undefined
                ? material.projectId
                : cleanText(patch.projectId),
            category:
              patch.category === undefined
                ? material.category
                : normalizeMaterialCategory(patch.category),
            name:
              patch.name === undefined
                ? material.name
                : cleanText(patch.name, material.name),
            unit:
              patch.unit === undefined ? material.unit : cleanText(patch.unit, "pcs"),
            supplier:
              patch.supplier === undefined
                ? material.supplier
                : cleanText(patch.supplier),
            note:
              patch.note === undefined ? material.note : cleanText(patch.note),
            quantity:
              patch.quantity === undefined
                ? material.quantity
                : Math.max(0, patch.quantity),
            usedQuantity:
              patch.usedQuantity === undefined
                ? material.usedQuantity
                : Math.min(
                  patch.quantity ?? material.quantity,
                  Math.max(0, patch.usedQuantity)
                ),
            lowStockAt:
              patch.lowStockAt === undefined
                ? material.lowStockAt
                : Math.max(0, patch.lowStockAt),
            rate:
              patch.rate === undefined ? material.rate : Math.max(0, patch.rate),
          }
          : material
      )
    );
  };

  const deleteMaterial = (materialId: string) => {
    if (!window.confirm("Delete this material record?")) return;
    addActivity({
      action: "material:delete",
      entityType: "material",
      entityId: materialId,
      summary: "Material deleted",
    });
    setMaterials((current) =>
      current.filter((material) => material.id !== materialId)
    );
  };

  const materialCategoryFromTitle = (value = ""): MaterialCategory => {
    const lower = value.toLowerCase();

    if (/\bcement\b/.test(lower)) return "Cement";
    if (/\bsteel|tmt|rod\b/.test(lower)) return "Steel";
    if (/\bsand|m[-\s]?sand\b/.test(lower)) return "Sand";
    if (/\baggregate|jelly|gravel\b/.test(lower)) return "Aggregate";
    if (/\bbrick|block\b/.test(lower)) return "Bricks/Blocks";
    if (/\belectric|wire|switch|cable\b/.test(lower)) return "Electrical";
    if (/\bplumb|pipe|cpvc|pvc|tap\b/.test(lower)) return "Plumbing";
    if (/\bpaint|primer|putty\b/.test(lower)) return "Paint";
    if (/\btile|tiles|granite|marble\b/.test(lower)) return "Tiles";
    if (/\bwood|ply|door\b/.test(lower)) return "Wood";
    if (/\bhardware|screw|nail|hinge\b/.test(lower)) return "Hardware";
    if (/\btool|drill|cutter\b/.test(lower)) return "Tools";
    if (/\bsafety|helmet|glove|shoe\b/.test(lower)) return "Safety Items";
    return normalizeMaterialCategory(value);
  };

  const syncMaterialFromExpense = (tx: Omit<Transaction, "id">) => {
    if (
      (tx.category !== "🏗️ Materials" &&
        materialCategoryFromTitle(tx.title || tx.person) === "Other") ||
      (tx.type !== "Expense" && tx.type !== "Pay Out")
    ) {
      return;
    }

    const materialName = cleanText(tx.title || tx.person, "Material");
    const supplier = cleanText(tx.person || tx.toAccount);
    const projectId = cleanText(tx.projectId);

    setMaterials((current) => {
      const existingIndex = current.findIndex(
        (material) =>
          material.name.toLowerCase() === materialName.toLowerCase() &&
          (material.projectId || "") === projectId &&
          (material.supplier || "") === supplier
      );

      if (existingIndex >= 0) {
        return current.map((material, index) => {
          if (index !== existingIndex) return material;

          const nextQuantity = Math.max(1, (material.quantity || 0) + 1);
          const currentValue = (material.quantity || 0) * (material.rate || 0);
          const nextValue = currentValue + tx.amount;

          return {
            ...material,
            quantity: nextQuantity,
            usedQuantity: Math.max(0, (material.usedQuantity || 0) + 1),
            rate: nextValue / nextQuantity,
            date: tx.date || material.date,
            note: cleanText(material.note || "Synced from material expense"),
          };
        });
      }

      return [
        ...current,
        {
          id: uid(),
          companyId: company?.id,
          projectId,
          category: materialCategoryFromTitle(materialName),
          name: materialName,
          quantity: 1,
          usedQuantity: 1,
          lowStockAt: 0,
          unit: "entry",
          rate: tx.amount,
          supplier,
          date: tx.date || localDateInputValue(),
          note: "Synced from material expense",
        },
      ];
    });
  };

  const createReminder = (reminder: Omit<ReminderItem, "id">) => {
    const validationError = validateReminderDraft(reminder);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    setReminders((current) => [
      {
        id: uid(),
        companyId: company?.id || reminder.companyId,
        title: cleanText(reminder.title, "Material reorder"),
        dueDate: cleanText(reminder.dueDate, localDateInputValue()),
        projectId: cleanText(reminder.projectId),
        amount: reminder.amount,
        note: cleanText(reminder.note),
        done: Boolean(reminder.done),
        type: reminder.type || "general",
        targetId: cleanText(reminder.targetId),
        notifyAt: cleanText(reminder.notifyAt),
        notificationReady: Boolean(reminder.notificationReady),
      },
      ...current,
    ]);
    addActivity({
      action: "reminder:create",
      entityType: "reminder",
      summary: `Reminder added: ${reminder.title}`,
    });
  };

  const updateReminder = (reminderId: string, patch: Partial<ReminderItem>) => {
    addActivity({
      action: "reminder:update",
      entityType: "reminder",
      entityId: reminderId,
      summary: patch.done ? "Reminder completed" : "Reminder updated",
    });
    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === reminderId
          ? {
            ...reminder,
            ...patch,
            title:
              patch.title === undefined
                ? reminder.title
                : cleanText(patch.title, reminder.title),
            dueDate:
              patch.dueDate === undefined
                ? reminder.dueDate
                : cleanText(patch.dueDate, localDateInputValue()),
            projectId:
              patch.projectId === undefined
                ? reminder.projectId
                : cleanText(patch.projectId),
            note:
              patch.note === undefined ? reminder.note : cleanText(patch.note),
            targetId:
              patch.targetId === undefined
                ? reminder.targetId
                : cleanText(patch.targetId),
            notifyAt:
              patch.notifyAt === undefined
                ? reminder.notifyAt
                : cleanText(patch.notifyAt),
            amount:
              patch.amount === undefined ? reminder.amount : patch.amount,
            done:
              patch.done === undefined ? reminder.done : patch.done,
            type: patch.type || reminder.type || "general",
            notificationReady:
              patch.notificationReady === undefined
                ? reminder.notificationReady
                : patch.notificationReady,
          }
          : reminder
      )
    );
  };

  const deleteReminder = (reminderId: string) => {
    if (!window.confirm("Delete this reminder?")) return;
    addActivity({
      action: "reminder:delete",
      entityType: "reminder",
      entityId: reminderId,
      summary: "Reminder deleted",
    });
    setReminders((current) =>
      current.filter((reminder) => reminder.id !== reminderId)
    );
  };

  if (!savedUser) {
    return (
      <div className="relative min-h-screen text-on-surface flex items-center justify-center p-6 bg-black overflow-x-hidden">
        {/* Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="gradient-sphere -top-[200px] -left-[200px] opacity-40 animate-pulse" style={{ animationDuration: "8s" }} />
          <div className="gradient-sphere top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
          <div className="gradient-sphere -bottom-[300px] -right-[200px] opacity-30 animate-pulse" style={{ animationDuration: "12s" }} />
          <div
            className="absolute inset-0 z-[-1] opacity-20 grayscale brightness-50 contrast-125 bg-cover bg-center"
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCn0xDxN--ST1Q6vMi7PP4YQoZk1388wX0GGOwahVV1bLZuVV76pnZGdbbdhM5x88Iur10T1sbv4pZXZOKR0pIUxvpsHBFVapwpZTBjeJ3v8kzH2LVg0zylZ7SwbTDduIZN4_SWUQj7tCOqBJAbNxzWrfxuV8OIfDhx9xNn4Ox6PzAzOr9zX5NrE7wow4ici1_Jw6lDGWEiHfNboDqh9AsbLh6G9Aew-X7ul1KnbupCnVf2o3Caz39bUnFyqJ7iFUBC2HkCkbblXzc')" }}
          />
        </div>

        <main className="relative z-10 w-full max-w-[480px] flex flex-col items-center">
          {/* Brand Header */}
          <div className="text-center mb-10 space-y-4">
            <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center shadow-2xl mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <span className="material-symbols-outlined text-background text-4xl leading-none">foundation</span>
            </div>
            <h1 className="font-display-lg text-4xl md:text-5xl font-black text-primary tracking-tighter">
              {APP_NAME}
            </h1>
            <p className="font-body-lg text-sm md:text-base text-apple-silver max-w-[320px] mx-auto">
              Construction finance, sites, workers, and reports in one place.
            </p>
          </div>

          {/* Glass Login Card */}
          <div className="glass-card w-full rounded-[2rem] p-6 md:p-8 flex flex-col gap-6">
            <div className="space-y-4">
              {/* Google Login */}
              <button
                type="button"
                className="btn-hover-effect w-full h-14 bg-primary text-background rounded-xl flex items-center justify-center gap-3 font-semibold shadow-lg text-base"
                onClick={() => {
                  if (!acceptedTerms) {
                    setLoginError("Please read and agree before using Google sign in.");
                    return;
                  }
                  googleSignIn("google");
                }}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="currentColor"></path>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 py-1">
                <div className="h-[1px] flex-1 bg-white/10" />
                <span className="font-label-sm text-xs text-apple-silver uppercase tracking-widest">or</span>
                <div className="h-[1px] flex-1 bg-white/10" />
              </div>

              {/* Demo and Invite Code block */}
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={startDemoCompany}
                  className="btn-hover-effect w-full h-12 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-body-md text-sm text-primary flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">rocket_launch</span>
                  Open Demo Company
                </button>

                <div className="flex flex-col gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                  <input
                    value={inviteCodeDraft}
                    onChange={(event) => {
                      setInviteCodeDraft(event.target.value.toUpperCase());
                      setLoginError("");
                    }}
                    placeholder="Supervisor / worker invite code"
                    className="w-full h-11 bg-transparent border-0 outline-none text-primary text-sm font-semibold placeholder-white/20 px-2"
                  />
                  <button
                    type="button"
                    onClick={startEmployeeLogin}
                    className="btn-hover-effect w-full h-10 bg-primary text-background rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">vpn_key</span>
                    Continue with Invite Code
                  </button>
                </div>

                <a
                  href="/demo"
                  className="btn-hover-effect w-full h-12 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-body-md text-sm text-primary flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">visibility</span>
                  View public demo page
                </a>
              </div>
            </div>

            {/* Terms and Consent */}
            <div className="flex items-start gap-3 px-1">
              <input
                type="checkbox"
                id="terms"
                className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  setLoginError("");
                }}
              />
              <label htmlFor="terms" className="font-label-sm text-xs text-apple-silver leading-relaxed cursor-pointer select-none">
                By continuing, you agree that this app stores wallet entries, balances, cards, and reports. 
                Read the <span className="text-primary hover:underline underline-offset-4 decoration-white/30 cursor-pointer">Terms of Service</span> and <span className="text-primary hover:underline underline-offset-4 decoration-white/30 cursor-pointer">Privacy Policy</span>.
              </label>
            </div>

            {loginError && (
              <p className="rounded-xl bg-danger-red/10 border border-danger-red/20 p-3 text-sm font-semibold text-danger-red text-center">
                {loginError}
              </p>
            )}
          </div>

          <footer className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <a className="font-label-sm text-xs text-on-surface hover:text-primary transition-colors" href="#">Documentation</a>
            <a className="font-label-sm text-xs text-on-surface hover:text-primary transition-colors" href="#">System Status</a>
            <a className="font-label-sm text-xs text-on-surface hover:text-primary transition-colors" href="#">Contact Support</a>
          </footer>
        </main>
      </div>
    );
  }

  if (!profileName) {
    return (
      <div className="relative min-h-screen text-on-surface flex items-center justify-center p-6 bg-black overflow-x-hidden">
        {/* Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="gradient-sphere -top-[200px] -left-[200px] opacity-40 animate-pulse" style={{ animationDuration: "8s" }} />
          <div className="gradient-sphere top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
          <div className="gradient-sphere -bottom-[300px] -right-[200px] opacity-30 animate-pulse" style={{ animationDuration: "12s" }} />
          <div
            className="absolute inset-0 z-[-1] opacity-20 grayscale brightness-50 contrast-125 bg-cover bg-center"
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCn0xDxN--ST1Q6vMi7PP4YQoZk1388wX0GGOwahVV1bLZuVV76pnZGdbbdhM5x88Iur10T1sbv4pZXZOKR0pIUxvpsHBFVapwpZTBjeJ3v8kzH2LVg0zylZ7SwbTDduIZN4_SWUQj7tCOqBJAbNxzWrfxuV8OIfDhx9xNn4Ox6PzAzOr9zX5NrE7wow4ici1_Jw6lDGWEiHfNboDqh9AsbLh6G9Aew-X7ul1KnbupCnVf2o3Caz39bUnFyqJ7iFUBC2HkCkbblXzc')" }}
          />
        </div>

        <main className="relative z-10 w-full max-w-[480px] flex flex-col items-center">
          <div className="text-center mb-10 space-y-4">
            <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center shadow-2xl mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <span className="material-symbols-outlined text-background text-4xl leading-none">person</span>
            </div>
            <h1 className="font-display-lg text-4xl font-black text-primary tracking-tighter">
              Create your profile
            </h1>
            <p className="font-body-lg text-sm text-apple-silver max-w-[320px] mx-auto">
              Signed in with {savedUser}
            </p>
          </div>

          <div className="glass-card w-full rounded-[2rem] p-6 md:p-8 flex flex-col gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveProfileName();
              }}
              className="flex flex-col gap-4"
            >
              <input
                className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 text-primary text-sm font-semibold outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                placeholder="Enter your name"
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setLoginError("");
                }}
              />

              {loginError && (
                <p className="rounded-xl bg-danger-red/10 border border-danger-red/20 p-3 text-sm font-semibold text-danger-red text-center">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="btn-hover-effect w-full h-14 bg-primary text-background rounded-xl font-bold flex items-center justify-center shadow-lg text-base"
              >
                Continue
              </button>

              <button
                type="button"
                onClick={async () => {
                  await signOut({ redirect: false });
                  localStorage.removeItem("username");
                  localStorage.removeItem("authMode");
                  writeEmployeeSession(null);
                  localStorage.removeItem("profileName");
                  setSavedUser("");
                  setEmployeeSession(null);
                  setProfileName("");
                  setNameDraft("");
                  setAcceptedTerms(false);
                  setLoginError("");
                  setShowWelcome(false);
                  setTab("Home");
                  setStorageStatus("local");
                  setWalletReady(false);
                  applyWalletData(emptyWalletData());
                }}
                className="btn-hover-effect w-full h-12 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-body-md text-sm text-primary flex items-center justify-center gap-2"
              >
                Use another Google account
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="relative min-h-screen text-on-surface flex items-center justify-center p-6 bg-black overflow-x-hidden">
        {/* Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="gradient-sphere -top-[200px] -left-[200px] opacity-40 animate-pulse" style={{ animationDuration: "8s" }} />
          <div className="gradient-sphere top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
          <div className="gradient-sphere -bottom-[300px] -right-[200px] opacity-30 animate-pulse" style={{ animationDuration: "12s" }} />
          <div
            className="absolute inset-0 z-[-1] opacity-20 grayscale brightness-50 contrast-125 bg-cover bg-center"
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCn0xDxN--ST1Q6vMi7PP4YQoZk1388wX0GGOwahVV1bLZuVV76pnZGdbbdhM5x88Iur10T1sbv4pZXZOKR0pIUxvpsHBFVapwpZTBjeJ3v8kzH2LVg0zylZ7SwbTDduIZN4_SWUQj7tCOqBJAbNxzWrfxuV8OIfDhx9xNn4Ox6PzAzOr9zX5NrE7wow4ici1_Jw6lDGWEiHfNboDqh9AsbLh6G9Aew-X7ul1KnbupCnVf2o3Caz39bUnFyqJ7iFUBC2HkCkbblXzc')" }}
          />
        </div>

        <main className="relative z-10 w-full max-w-[480px] flex flex-col items-center">
          <div className="text-center mb-10 space-y-4">
            <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-8 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
              <span className="material-symbols-outlined text-background text-5xl leading-none">foundation</span>
            </div>
            <p className="font-label-sm text-sm text-apple-silver uppercase tracking-widest">{APP_NAME}</p>
            <h1 className="font-display-lg text-4xl font-black text-primary tracking-tighter">
              {displayName}
            </h1>
          </div>

          <div className="w-full flex justify-center">
            <button
              onClick={() => setShowWelcome(false)}
              className="btn-hover-effect w-full max-w-xs h-14 bg-primary text-background rounded-full font-bold flex items-center justify-center gap-2 shadow-2xl text-base"
            >
              Get Started
              <span className="material-symbols-outlined text-xl leading-none">arrow_forward</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <main
      className={`min-h-screen w-full pt-24 pb-32 px-margin-mobile md:px-margin-desktop transition-all duration-500 ${theme === "dark"
        ? "bg-background text-on-surface"
        : "bg-neutral-50 text-black"
        }`}>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={tab}
        onSelect={(selectedTab) => {
          if (selectedTab === "Add") {
            if (!canWriteTransactions) {
              showToast("This role cannot add finance entries.", "error");
              return;
            }
            setIsQuickActionOpen(true);
            return;
          }
          setTab(selectedTab);
        }}
        onLogout={handleLogout}
        allowedTabs={allowedTabs}
        theme={theme}
        companyName={company?.name}
      />

      <DashboardHeader
        appName={APP_NAME}
        company={company}
        displayName={displayName}
        userImage={session?.user?.image || ""}
        storageStatusLabel={storageStatusText[storageStatus]}
        theme={theme}
        onThemeToggle={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
        onMenuToggle={() => setIsSidebarOpen(true)}
      />

      {!walletReady && (
        <div className="mt-4 liquid-surface rounded-[24px] p-4 text-sm font-bold text-neutral-500">
          Loading company workspace...
        </div>
      )}

      {syncNotice && (
        <div className="mt-4 rounded-[24px] bg-amber-100 p-4 text-sm font-extrabold text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          {syncNotice}
        </div>
      )}

      {canViewFinance && repaymentReminders.length > 0 && (
        <div className="mt-4 space-y-2">
          {repaymentReminders.map(({ card, daysLeft }) => (
            <div
              key={card.id}
              className="rounded-[24px] bg-amber-100 p-4 text-sm font-extrabold text-amber-800"
            >
              Credit card repayment for {card.name} is due{" "}
              {daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}.
            </div>
          ))}
        </div>
      )}

      <section className="mt-5">
        {canViewFinance && (tab === "Home" || tab === "Account" || tab === "Add") && (
          <TabErrorBoundary name="Home">
            <HomeDashboard
              emoji="🏦"
              company={company}
              balance={accountCurrent}
              spent={accountMonthSpent}
              saved={accountCurrent}
              transactions={selectedMonthExternalTransactions}
              selectedMonthLabel={formatMonth(selectedMonth)}
              canShowNextMonth={canShowNextMonth}
              monthIncome={accountMonthIncome}
              monthSpent={accountMonthSpent}
              reminders={visibleReminders}
              kpis={dashboardKpis}
              onPreviousMonth={() => setSelectedMonth(moveMonth(selectedMonth, -1))}
              onNextMonth={() => setSelectedMonth(moveMonth(selectedMonth, 1))}
              onQuickAction={openForm}
              onBalance={() => openForm("Balance")}
              onDelete={(id) => {
                if (!window.confirm("Delete this transaction?")) return;
                const tx = transactions.find(t => t.id === id);
                if (tx?.sourceId) {
                  setDeletedSourceIds((current) =>
                    current.includes(tx.sourceId!) ? current : [...current, tx.sourceId!]
                  );
                }
                setTransactions((current) => current.filter((t) => t.id !== id));
                addActivity({
                  action: "transaction:delete",
                  entityType: "transaction",
                  entityId: id,
                  summary: `Transaction deleted${tx?.title ? `: ${tx.title}` : ""}`,
                });
                showToast("Transaction deleted", "success");
              }}
              onUpdate={(id, patch) =>
                setTransactions((current) =>
                  current.map((tx) =>
                    tx.id === id ? { ...tx, ...patch } : tx
                  )
                )
              }
            />
          </TabErrorBoundary>
        )}

        {tab === "People" && (
          <TabErrorBoundary name="People">
            <div className="space-y-8">
              <PeopleDashboard
                customers={customers}
                suppliers={suppliers}
                theme={theme}
                onCreateCustomer={(c) => setCustomers(curr => [...curr, { ...c, id: uid() }])}
                onCreateSupplier={(s) => setSuppliers(curr => [...curr, { ...s, id: uid() }])}
              />

              <WorkersTab
                workers={visibleWorkers}
                projects={visibleProjects}
                transactions={visibleTransactions}
                dailyReports={visibleDailyReports}
                companyName={company?.name || "Business"}
                accessRole={accessContext.role}
                canManageWorkers={canManageWorkers}
                canManageLedger={canViewFinance}
                canReviewReports={accessContext.role !== "worker"}
                onCreateWorker={createWorker}
                onUpdateWorker={updateWorker}
                onCreateDailyReport={createDailyReport}
                onUpdateDailyReport={updateDailyReport}
                onAddEntry={addWorkerEntry}
                onDeleteEntry={deleteWorkerEntry}
              />

              <AttendanceTracker attendance={attendance} theme={theme} />
              <PayrollSummary payrollRuns={payrollRuns} theme={theme} />
            </div>
          </TabErrorBoundary>
        )}

        {canViewFinance && tab === "Money" && (
          <TabErrorBoundary name="Money">
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
                    <h3 className="text-sm font-bold opacity-50 uppercase mb-2">Accounts Receivable</h3>
                    <p className="text-3xl font-black text-emerald-500">₹{invoices.reduce((s, i) => s + (i.status !== 'Paid' ? i.total : 0), 0).toLocaleString('en-IN')}</p>
                 </div>
                 <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
                    <h3 className="text-sm font-bold opacity-50 uppercase mb-2">Accounts Payable</h3>
                    <p className="text-3xl font-black text-danger-red">₹{supplierBills.reduce((s, i) => s + (i.status !== 'Paid' ? i.total : 0), 0).toLocaleString('en-IN')}</p>
                 </div>
              </div>

              <FinancialReports theme={theme} />

              <MaterialTracker
                materials={visibleMaterials}
                projects={visibleProjects}
                reminders={visibleReminders}
                onCreateMaterial={createMaterial}
                onUpdateMaterial={updateMaterial}
                onDeleteMaterial={deleteMaterial}
                onCreateReminder={createReminder}
              />

              <ReportsView
                selectedMonthLabel={formatMonth(selectedMonth)}
                selectedMonthKey={selectedMonth}
                canShowNextMonth={canShowNextMonth}
                accounts={reportAccounts}
                reportTransactions={reportTransactions}
                totalBalance={accountCurrent}
                projects={visibleProjects}
                materials={visibleMaterials}
                workers={visibleWorkers}
                company={company}
                onPreviousMonth={() => setSelectedMonth(moveMonth(selectedMonth, -1))}
                onNextMonth={() => setSelectedMonth(moveMonth(selectedMonth, 1))}
              />

              <ReminderCenter
                reminders={visibleReminders}
                projects={visibleProjects}
                onCreateReminder={createReminder}
                onUpdateReminder={updateReminder}
                onDeleteReminder={deleteReminder}
              />
            </div>
          </TabErrorBoundary>
        )}

        {tab === "Sites" && (
          <TabErrorBoundary name="Sites">
          <SitesView
            projects={visibleProjects}
            transactions={visibleTransactions}
            materials={visibleMaterials}
            reminders={visibleReminders}
            workers={visibleWorkers}
            dailyReports={visibleDailyReports}
            company={company}
            canManageSites={canManageSites}
            onCreateSite={(site) => {
              const validationError = validateSiteDraft(site);
              if (validationError) {
                showToast(validationError, "error");
                return;
              }

              if (!guardPlanLimit("projects", projects.length)) return;

              setProjects((current) => [
                ...current,
                {
                  ...site,
                  id: uid(),
                  companyId: company?.id,
                  name: cleanText(site.name) || `New Site ${current.length + 1}`,
                  budget: Math.max(0, Number(site.budget || 0)),
                  customer: cleanText(site.customer),
                  note: cleanText(site.note),
                  date: site.date || localDateInputValue(),
                  extras: site.extras || [],
                },
              ]);
              addActivity({
                action: "site:create",
                entityType: "site",
                summary: `Site added: ${site.name}`,
              });
            }}
            onUpdate={(projectId, patch) => {
              addActivity({
                action: "site:update",
                entityType: "site",
                entityId: projectId,
                summary: "Site updated",
              });
              setProjects((current) =>
                current.map((project) =>
                  project.id === projectId
                    ? { ...project, ...patch }
                    : project
                )
              );
            }}
            onDelete={(projectId) => {
              if (!window.confirm("Delete this site and its site card? Linked records will remain in their tabs.")) return;
              addActivity({
                action: "site:delete",
                entityType: "site",
                entityId: projectId,
                summary: "Site deleted",
              });
              setProjects((current) =>
                current.filter((project) => project.id !== projectId)
              );
            }}
          />
          </TabErrorBoundary>
        )}

        {canViewSettings && tab === "Settings" && (
          <TabErrorBoundary name="Settings">
          <SettingsView
            company={company}
            wallet={currentWalletData}
            projectsCount={projects.length}
            workersCount={personAccounts.length}
            materialsCount={materials.length}
            cards={cards}
            cardDraft={cardDraft}
            employeeInvites={employeeInvites}
            workers={personAccounts}
            projects={projects}
            activityLog={activityLog}
            dataHealthWarnings={dataHealthWarnings}
            isImportingEmail={isImportingEmail}
            canExportCloudBackup={Boolean(company?.id && savedUser === sessionEmail && sessionEmail)}
            cardSourceLabel={cardSourceLabel}
            onCardDraftChange={(patch) =>
              setCardDraft((current) => ({ ...current, ...patch }))
            }
            onConnectGmailAccess={connectGmailAccess}
            onImportEmailTransactions={() => void importEmailTransactions()}
            onSaveCardDraft={saveCardDraft}
            onUpdateCard={updateCard}
            onPlanChange={(plan) =>
              setCompany((current) =>
                current
                  ? { ...current, plan }
                  : {
                    id: uid(),
                    name: `${profileName || savedUser || "My"} Company`,
                    ownerEmail: sessionEmail || savedUser,
                    plan,
                    role: "Owner",
                  }
              )
            }
            onCreateEmployeeInvite={createEmployeeInvite}
            onMessage={showToast}
            onImportBackup={importBackup}
            onExportCloudBackup={exportCloudBackup}
          />
          </TabErrorBoundary>
        )}

        {tab === "Admin" && isAdmin && (
          <AdminDashboard
            users={registeredUsers}
            company={company}
            wallet={currentWalletData}
            storageStatusLabel={storageStatusText[storageStatus]}
            isOnline={isOnline}
            isFirebaseConfigured={isFirebaseConfigured}
            adminUsername={savedUser}
          />
        )}

        {[
          "Analytics",
          "DeliveryDashboard",
          "Ratio",
          "DailyReport",
          "DailyCashReport",
          "GroupAnalytics",
          "POS",
          "PriceChecker",
          "ZeevOrders",
          "SalesReceipt",
          "SalesOrder",
          "Quotation",
          "RouteSales",
        ].includes(tab) && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">construction</span>
            </div>
            <h2 className="text-2xl font-black mb-2">{tab.replace(/([A-Z])/g, ' $1').trim()}</h2>
            <p className="opacity-50 max-w-xs">
              This module is currently being integrated into your construction workspace.
            </p>
          </div>
        )}
      </section>

      {form && canWriteTransactions && (
        <EntrySheet
          type={form}
          preset={formPreset}
          cards={cards}
          upiAccounts={upiAccounts}
          projects={projects}
          currentBalances={accountBalances}
          expenseCategories={expenseCategories}
          paymentMethods={paymentMethods}
          categoryName={categoryName}
          inferCategory={inferCategory}
          cleanSourceName={cleanSourceName}
          cardSourceLabel={cardSourceLabel}
          upiSourceLabel={upiSourceLabel}
          localDateInputValue={localDateInputValue}
          localTimeInputValue={localTimeInputValue}
          resolveTransactionMovement={resolveTransactionMovement}
          onModeChange={(nextForm) => setForm(nextForm)}
          onClose={closeForm}
          onSaveBalance={(balances) => {
            setAccountBalances(balances);
            showToast("Balance updated", "success");
          }}
          onSaveTransaction={(tx) => {
            const validationError = validateTransactionDraft(tx);
            if (validationError) {
              showToast(validationError, "error");
              return;
            }

            const duplicate = findPossibleDuplicateTransaction(tx, transactions);
            if (duplicate) {
              const saveAnyway = window.confirm(
                `Possible duplicate found: ${duplicate.title} for ₹${Math.round(
                  duplicate.amount
                ).toLocaleString("en-IN")} on ${duplicate.date}. Save this entry anyway?`
              );

              if (!saveAnyway) {
                showToast("Duplicate entry was not saved.", "error");
                return;
              }
            }

            syncMaterialFromExpense(tx);
            setTransactions((current) =>
              sortTransactionsByDateTime([
                { id: uid(), ...tx, companyId: tx.companyId || company?.id },
                ...current,
              ])
            );
            addActivity({
              action: "transaction:create",
              entityType: "transaction",
              summary: `Entry saved: ${tx.title}`,
            });
            showToast("Entry saved", "success");
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-black shadow-2xl ${toast.tone === "success"
              ? "bg-emerald-500 text-black"
              : "bg-red-500 text-white"
            }`}
        >
          {toast.message}
        </div>
      )}

      <QuickActionSheet
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        theme={theme}
        actions={[
          { label: "Expense", icon: "remove_circle", color: "bg-danger-red", onClick: () => openForm("Expense") },
          { label: "Income", icon: "add_circle", color: "bg-emerald-500", onClick: () => openForm("Income") },
          { label: "Transfer", icon: "sync_alt", color: "bg-blue-500", onClick: () => openForm("Transfer") },
          { label: "Site", icon: "foundation", color: "bg-amber-500", onClick: () => setTab("Sites") },
          { label: "Worker", icon: "person_add", color: "bg-purple-500", onClick: () => setTab("People") },
          { label: "Material", icon: "inventory_2", color: "bg-orange-500", onClick: () => setTab("Money") },
        ]}
      />

    </main>
  );
}
