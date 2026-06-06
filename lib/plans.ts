export type PlanType = "Starter" | "Pro" | "Business";

export type PlanLimitKey =
  | "projects"
  | "workers"
  | "materials"
  | "supervisors"
  | "exports"
  | "reports";

export type PlanLimits = {
  projects: number;
  workers: number;
  materials: number;
  supervisors: number;
  exports: number;
  reports: number;
  analytics: boolean;
  whatsappReports: boolean;
  multiSupervisor?: boolean;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  Starter: {
    projects: 5,
    workers: 25,
    materials: 150,
    supervisors: 2,
    exports: 4,
    reports: 6,
    analytics: false,
    whatsappReports: true,
  },
  Pro: {
    projects: 25,
    workers: 150,
    materials: 1000,
    supervisors: 10,
    exports: 100,
    reports: 60,
    analytics: true,
    whatsappReports: true,
  },
  Business: {
    projects: -1,
    workers: -1,
    materials: -1,
    supervisors: -1,
    exports: -1,
    reports: -1,
    analytics: true,
    whatsappReports: true,
    multiSupervisor: true,
  },
};

export const PLAN_ORDER: PlanType[] = ["Starter", "Pro", "Business"];

export type WorkspaceRole = "owner" | "admin" | "supervisor" | "worker";
export type LegacyWorkspaceRole = "manager" | "accountant" | "viewer";
export type AppRole = WorkspaceRole | LegacyWorkspaceRole;

export const WORKSPACE_ROLES: AppRole[] = [
  "owner",
  "admin",
  "supervisor",
  "worker",
  "manager",
  "accountant",
  "viewer",
];

export type WorkerSubRole =
  | "Supervisor"
  | "Electrician"
  | "Plumber"
  | "Mason"
  | "Carpenter"
  | "Painter"
  | "Helper"
  | "Tile Worker"
  | "Driver"
  | "Welder"
  | "Site Engineer"
  | "Other";

export const WORKER_SUB_ROLES: WorkerSubRole[] = [
  "Supervisor",
  "Electrician",
  "Plumber",
  "Mason",
  "Carpenter",
  "Painter",
  "Helper",
  "Tile Worker",
  "Driver",
  "Welder",
  "Site Engineer",
  "Other",
];

export const normalizePlan = (value: unknown): PlanType => {
  if (value === "Business" || value === "Pro" || value === "Starter") {
    return value;
  }

  return "Starter";
};

export const isUnlimitedLimit = (limit: number) => limit < 0;

export const isLimitReached = ({
  plan,
  key,
  currentCount,
}: {
  plan: PlanType;
  key: PlanLimitKey;
  currentCount: number;
}) => {
  const limit = PLAN_LIMITS[plan][key];
  return !isUnlimitedLimit(limit) && currentCount >= limit;
};

export const formatLimit = (limit: number) =>
  isUnlimitedLimit(limit) ? "Unlimited" : limit.toLocaleString("en-IN");

export const nextUpgradePlan = (plan: PlanType): PlanType | null => {
  const index = PLAN_ORDER.indexOf(plan);
  return index >= 0 && index < PLAN_ORDER.length - 1
    ? PLAN_ORDER[index + 1]
    : null;
};

export const limitReachedMessage = ({
  plan,
  key,
}: {
  plan: PlanType;
  key: PlanLimitKey;
}) => {
  const nextPlan = nextUpgradePlan(plan);
  const label =
    key === "projects"
      ? "sites/projects"
      : key === "exports"
        ? "backup/export"
        : key;

  return nextPlan
    ? `${plan} plan limit reached for ${label}. Upgrade to ${nextPlan} to add more.`
    : `${plan} plan has no remaining ${label} capacity.`;
};

export const normalizeWorkerSubRole = (value: unknown): WorkerSubRole => {
  if (typeof value !== "string") return "Other";
  const match = WORKER_SUB_ROLES.find((role) => role === value.trim());
  return match || "Other";
};

export const buildInvitePlaceholder = ({
  companyId,
  role,
  workerSubRole,
}: {
  companyId: string;
  role: Extract<WorkspaceRole, "supervisor" | "worker">;
  workerSubRole?: WorkerSubRole;
}) => {
  const code = [
    companyId.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "COMPANY",
    role === "worker" ? "WORKER" : "SUP",
    Math.random().toString(36).slice(2, 8).toUpperCase(),
  ].join("-");

  const params = new URLSearchParams({
    companyId,
    role,
    code,
  });

  if (workerSubRole) {
    params.set("workerSubRole", workerSubRole);
  }

  return {
    code,
    link: `/join?${params.toString()}`,
  };
};
