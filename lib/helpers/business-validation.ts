import type {
  DailyWorkReport,
  MaterialItem,
  PersonAccount,
  ProjectSite,
  ReminderItem,
  Transaction,
} from "@/lib/types";

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const hasPositiveAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
};

export const validateTransactionDraft = (
  tx: Omit<Transaction, "id">
): string | null => {
  if (!clean(tx.title)) return "Add a transaction title.";
  if (!hasPositiveAmount(tx.amount)) return "Enter a valid transaction amount.";
  if (!clean(tx.date)) return "Choose a transaction date.";
  if (tx.method !== "Cash" && !clean(tx.selectedCard)) {
    return "Choose a payment source.";
  }
  return null;
};

export const validateWorkerDraft = (
  worker: Omit<PersonAccount, "id" | "entries">
): string | null => {
  if (!clean(worker.name)) return "Add a worker name.";
  if (worker.projectId !== undefined && typeof worker.projectId !== "string") {
    return "Choose a valid assigned site.";
  }
  return null;
};

export const validateSiteDraft = (site: Omit<ProjectSite, "id">): string | null => {
  if (!clean(site.name)) return "Add a site name.";
  if (Number(site.budget || 0) < 0) return "Site budget cannot be negative.";
  return null;
};

export const validateMaterialDraft = (
  material: Omit<MaterialItem, "id">
): string | null => {
  if (!clean(material.name)) return "Add a material name.";
  if (Number(material.quantity || 0) < 0) return "Material quantity cannot be negative.";
  if (Number(material.rate || 0) < 0) return "Material rate cannot be negative.";
  return null;
};

export const validateReminderDraft = (
  reminder: Omit<ReminderItem, "id">
): string | null => {
  if (!clean(reminder.title)) return "Add a reminder title.";
  if (!clean(reminder.dueDate)) return "Choose a reminder due date.";
  return null;
};

export const validateDailyReportDraft = (
  report: Omit<DailyWorkReport, "id">
): string | null => {
  if (!clean(report.workerName)) return "Choose a worker.";
  if (!clean(report.workDescription)) return "Add work done today.";
  if (!clean(report.date)) return "Choose a report date.";
  return null;
};

const normalizedText = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sameDayOrNear = (left = "", right = "") => {
  if (!left || !right) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return left === right;
  }

  return Math.abs(leftDate.getTime() - rightDate.getTime()) <= 24 * 60 * 60 * 1000;
};

export const findPossibleDuplicateTransaction = (
  tx: Omit<Transaction, "id">,
  existingTransactions: Transaction[]
) => {
  const txSource = clean(tx.sourceId);
  const txTitle = normalizedText(tx.title || tx.person || tx.toAccount);

  return (
    existingTransactions.find((existing) => {
      if (txSource && existing.sourceId === txSource) return true;

      const sameAmount = Math.abs(Number(existing.amount) - Number(tx.amount)) < 0.01;
      const sameProject = (existing.projectId || "") === (tx.projectId || "");
      const sameDate = sameDayOrNear(existing.date, tx.date);
      const existingTitle = normalizedText(
        existing.title || existing.person || existing.toAccount
      );
      const titleMatches =
        Boolean(txTitle && existingTitle) &&
        (txTitle === existingTitle ||
          txTitle.includes(existingTitle) ||
          existingTitle.includes(txTitle));

      return sameAmount && sameDate && sameProject && titleMatches;
    }) || null
  );
};
