import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  normalizeConstructionWorkerRole,
  normalizeMaterialCategory,
} from "@/lib/construction";
import type { SaaSRole } from "@/lib/types";

export type CompanyCollectionName =
  | "transactions"
  | "sites"
  | "workers"
  | "materials"
  | "bills"
  | "reminders"
  | "dailyReports";

export const companyCollectionNames: CompanyCollectionName[] = [
  "transactions",
  "sites",
  "workers",
  "materials",
  "bills",
  "reminders",
  "dailyReports",
];

export const isCompanyCollectionName = (
  value: string
): value is CompanyCollectionName =>
  companyCollectionNames.includes(value as CompanyCollectionName);

export function isValidRole(
  value: unknown
): value is SaaSRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "supervisor" ||
    value === "worker" ||
    value === "manager" ||
    value === "accountant" ||
    value === "viewer"
  );
}

export const normalizeRole = (
  value: unknown
): SaaSRole | null => {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return isValidRole(lower) ? lower : null;
};

export const encodeFirestoreId = (value: string) => encodeURIComponent(value.trim());

/**
 * Important: member ids intentionally use lowercase email, not encodeURIComponent(email).
 * Firestore security rules can read request.auth.token.email.toLowerCase(), but cannot URL encode it.
 * Firestore document ids can contain @ and . characters, so this keeps rules and backend aligned.
 */
export const memberDocIdForEmail = (email: string) => email.trim().toLowerCase();

export const nowServerTimestamp = () => FieldValue.serverTimestamp();

export const companyRef = (companyId: string) => {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("companies").doc(encodeFirestoreId(companyId));
};

export const memberRef = (companyId: string, memberEmailLower: string) => {
  const cRef = companyRef(companyId);
  if (!cRef) return null;
  return cRef.collection("members").doc(memberDocIdForEmail(memberEmailLower));
};

export const auditLogsCollectionRef = (companyId: string) => {
  const cRef = companyRef(companyId);
  if (!cRef) return null;
  return cRef.collection("auditLogs");
};

export const companyCollectionRef = (
  companyId: string,
  collectionName: CompanyCollectionName
) => {
  const cRef = companyRef(companyId);
  if (!cRef) return null;
  return cRef.collection(collectionName);
};

export const transactionsCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "transactions");

export const sitesCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "sites");

export const workersCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "workers");

export const materialsCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "materials");

export const billsCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "bills");

export const remindersCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "reminders");

export const dailyReportsCollectionRef = (companyId: string) =>
  companyCollectionRef(companyId, "dailyReports");

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const cleanString = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const cleanOptionalString = (value: unknown, max = 500) => {
  const text = cleanString(value, max);
  return text || undefined;
};

export const cleanNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const cleanBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const cleanWorkerLedgerEntries = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => {
          if (!isPlainObject(entry)) return null;
          const amount = cleanNumber(entry.amount);

          if (amount <= 0) return null;

          return {
            id: cleanString(entry.id, 160) || crypto.randomUUID(),
            amount,
            direction: entry.direction === "Credit" ? "Credit" : "Debit",
            method: ["UPI", "Cash", "Card"].includes(cleanString(entry.method, 40))
              ? cleanString(entry.method, 40)
              : "UPI",
            narration: cleanOptionalString(entry.narration, 500) || "",
            date: cleanString(entry.date, 40) || new Date().toISOString().slice(0, 10),
            projectId: cleanOptionalString(entry.projectId, 160),
          };
        })
        .filter(Boolean)
    : [];

const stripUnsafeKeys = (data: Record<string, unknown>) => {
  const copy: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (["__proto__", "constructor", "prototype"].includes(key)) return;
    if (value === undefined) return;
    copy[key] = value;
  });
  return copy;
};

export const sanitizeCompanyDocumentPayload = ({
  collectionName,
  payload,
}: {
  collectionName: CompanyCollectionName;
  payload: unknown;
}) => {
  if (!isPlainObject(payload)) {
    throw Object.assign(new Error("Invalid request body"), { status: 400 });
  }

  const raw = stripUnsafeKeys(payload);
  const common = {
    source: cleanOptionalString(raw.source, 80) || "api",
    note: cleanOptionalString(raw.note, 1000),
  };

  switch (collectionName) {
    case "transactions": {
      const title = cleanString(raw.title, 240) || "Untitled transaction";
      return {
        ...common,
        title,
        amount: cleanNumber(raw.amount),
        type: cleanString(raw.type, 40) || "Expense",
        method: cleanString(raw.method, 40) || "Cash",
        section: cleanString(raw.section, 40) || "Business",
        selectedCard: cleanOptionalString(raw.selectedCard, 160),
        category: cleanOptionalString(raw.category, 120),
        person: cleanOptionalString(raw.person, 160),
        fromAccount: cleanOptionalString(raw.fromAccount, 160),
        toAccount: cleanOptionalString(raw.toAccount, 160),
        projectId: cleanOptionalString(raw.projectId, 160),
        sourceId: cleanOptionalString(raw.sourceId, 240),
        date: cleanString(raw.date, 40) || new Date().toISOString().slice(0, 10),
        time: cleanOptionalString(raw.time, 40),
      };
    }
    case "sites": {
      const name = cleanString(raw.name, 240);
      if (!name) throw Object.assign(new Error("Site name is required"), { status: 400 });
      const status = cleanString(raw.status, 40) || "Active";
      return {
        ...common,
        name,
        budget: cleanNumber(raw.budget),
        customer: cleanOptionalString(raw.customer, 240),
        status: ["Active", "Paused", "Completed"].includes(status) ? status : "Active",
        date: cleanString(raw.date, 40) || new Date().toISOString().slice(0, 10),
      };
    }
    case "workers": {
      const name = cleanString(raw.name, 240);
      if (!name) throw Object.assign(new Error("Worker name is required"), { status: 400 });
      return {
        ...common,
        name,
        phone: cleanOptionalString(raw.phone, 40),
        role: "worker",
        workerSubRole: normalizeConstructionWorkerRole(raw.workerSubRole),
        projectId: cleanOptionalString(raw.projectId, 160),
        invitedBy: cleanOptionalString(raw.invitedBy, 240),
        assignedSupervisor: cleanOptionalString(raw.assignedSupervisor, 240),
        referralCode: cleanOptionalString(raw.referralCode, 120),
        amount: cleanNumber(raw.amount),
        direction: raw.direction === "Payable" ? "Payable" : "Receivable",
        date: cleanString(raw.date, 40) || new Date().toISOString().slice(0, 10),
        entries: cleanWorkerLedgerEntries(raw.entries),
        dailyWage: cleanNumber(raw.dailyWage),
        monthlyWage: cleanNumber(raw.monthlyWage),
        status: raw.status === "Inactive" ? "Inactive" : "Active",
      };
    }
    case "materials": {
      const name = cleanString(raw.name, 240);
      if (!name) throw Object.assign(new Error("Material name is required"), { status: 400 });
      return {
        ...common,
        projectId: cleanOptionalString(raw.projectId, 160),
        category: normalizeMaterialCategory(raw.category),
        name,
        quantity: cleanNumber(raw.quantity),
        usedQuantity: cleanNumber(raw.usedQuantity),
        lowStockAt: cleanNumber(raw.lowStockAt),
        unit: cleanString(raw.unit, 40) || "pcs",
        rate: cleanNumber(raw.rate),
        supplier: cleanOptionalString(raw.supplier, 240),
        date: cleanString(raw.date, 40) || new Date().toISOString().slice(0, 10),
      };
    }
    case "dailyReports": {
      const workerName = cleanString(raw.workerName, 240);
      const workDescription = cleanString(raw.workDescription, 2000);
      if (!workerName) throw Object.assign(new Error("Worker name is required"), { status: 400 });
      if (!workDescription) {
        throw Object.assign(new Error("Work description is required"), { status: 400 });
      }
      const status = cleanString(raw.status, 40);
      return {
        ...common,
        date: cleanString(raw.date, 40) || new Date().toISOString().slice(0, 10),
        projectId: cleanOptionalString(raw.projectId, 160),
        workerId: cleanOptionalString(raw.workerId, 160),
        workerName,
        workerRole: normalizeConstructionWorkerRole(raw.workerRole),
        workDescription,
        materialsUsed: cleanOptionalString(raw.materialsUsed, 1500),
        hoursWorked: cleanNumber(raw.hoursWorked),
        paymentAdvance: cleanNumber(raw.paymentAdvance),
        issues: cleanOptionalString(raw.issues, 1500),
        nextWorkPlan: cleanOptionalString(raw.nextWorkPlan, 1500),
        photosNote: cleanOptionalString(raw.photosNote, 500),
        status: ["Draft", "Submitted", "Reviewed"].includes(status)
          ? status
          : "Draft",
        createdBy: cleanOptionalString(raw.createdBy, 240),
        reviewedBy: cleanOptionalString(raw.reviewedBy, 240),
      };
    }
    case "bills": {
      const title = cleanString(raw.title, 240) || cleanString(raw.supplier, 240) || "Bill";
      return {
        ...common,
        projectId: cleanOptionalString(raw.projectId, 160),
        title,
        amount: cleanNumber(raw.amount),
        supplier: cleanOptionalString(raw.supplier, 240),
        billDate: cleanOptionalString(raw.billDate, 40) || cleanOptionalString(raw.date, 40),
        fileUrl: cleanOptionalString(raw.fileUrl, 1500),
        gstNumber: cleanOptionalString(raw.gstNumber, 80),
        gstAmount: cleanNumber(raw.gstAmount),
        ocrStatus: cleanOptionalString(raw.ocrStatus, 80) || "manual",
      };
    }
    case "reminders": {
      const title = cleanString(raw.title, 240);
      if (!title) throw Object.assign(new Error("Reminder title is required"), { status: 400 });
      const type = cleanString(raw.type, 40);
      return {
        ...common,
        title,
        dueDate: cleanString(raw.dueDate, 40) || new Date().toISOString().slice(0, 10),
        projectId: cleanOptionalString(raw.projectId, 160),
        amount: raw.amount === undefined ? undefined : cleanNumber(raw.amount),
        done: cleanBoolean(raw.done),
        type: ["payment", "worker_payment", "material_reorder", "bill_due", "general"].includes(type)
          ? type
          : "general",
        targetId: cleanOptionalString(raw.targetId, 160),
        notifyAt: cleanOptionalString(raw.notifyAt, 80),
        notificationReady: cleanBoolean(raw.notificationReady),
      };
    }
    default:
      return raw;
  }
};
