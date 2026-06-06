import type { ExpenseAnalyticsCategory, MaterialCategory, WorkerSubRole } from "@/lib/types";

export const CONSTRUCTION_WORKER_ROLES: WorkerSubRole[] = [
  "Supervisor",
  "Electrician",
  "Plumber",
  "Mason",
  "Carpenter",
  "Painter",
  "Helper",
  "Tile Worker",
  "Welder",
  "Driver",
  "Site Engineer",
  "Other",
];

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  "Cement",
  "Steel",
  "Sand",
  "Aggregate",
  "Bricks/Blocks",
  "Electrical",
  "Plumbing",
  "Paint",
  "Tiles",
  "Wood",
  "Hardware",
  "Tools",
  "Safety Items",
  "Other",
];

export const EXPENSE_ANALYTICS_CATEGORIES: ExpenseAnalyticsCategory[] = [
  "Petrol",
  "Materials",
  "Worker Salary",
  "Bills",
  "Transport",
  "Food",
  "Tools",
  "Rent",
  "Electricity",
  "Other",
];

export const normalizeConstructionWorkerRole = (value: unknown): WorkerSubRole => {
  if (typeof value !== "string") return "Other";
  const trimmed = value.trim();
  const match = CONSTRUCTION_WORKER_ROLES.find((role) => role === trimmed);
  return match || "Other";
};

export const normalizeMaterialCategory = (value: unknown): MaterialCategory => {
  if (typeof value !== "string") return "Other";
  const trimmed = value.trim();
  const match = MATERIAL_CATEGORIES.find((category) => category === trimmed);
  return match || "Other";
};

export const normalizeExpenseAnalyticsCategory = (
  category: unknown
): ExpenseAnalyticsCategory => {
  const label =
    typeof category === "string"
      ? category.replace(/^[^\w₹A-Za-z0-9]+ /, "").trim().toLowerCase()
      : "";

  if (label.includes("petrol") || label.includes("fuel")) return "Petrol";
  if (label.includes("material")) return "Materials";
  if (label.includes("worker") || label.includes("salary") || label.includes("labour")) {
    return "Worker Salary";
  }
  if (label.includes("bill")) return "Bills";
  if (label.includes("transport") || label.includes("taxi") || label.includes("travel")) {
    return "Transport";
  }
  if (label.includes("food") || label.includes("meal")) return "Food";
  if (label.includes("tool")) return "Tools";
  if (label.includes("rent")) return "Rent";
  if (label.includes("electric")) return "Electricity";

  return "Other";
};
