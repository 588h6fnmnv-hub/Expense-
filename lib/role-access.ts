import type {
  CompanyProfile,
  DailyWorkReport,
  EmployeeInvite,
  EmployeeRole,
  EmployeeSession,
  MaterialItem,
  PersonAccount,
  ProjectSite,
  ReminderItem,
  SaaSRole,
  Transaction,
} from "@/lib/types";

export type AccessRole = Extract<
  SaaSRole,
  "owner" | "admin" | "supervisor" | "worker"
>;

export type AccessPermission =
  | "finance:read"
  | "transactions:write"
  | "sites:read"
  | "sites:write"
  | "materials:read"
  | "materials:write"
  | "workers:read"
  | "workers:write"
  | "dailyReports:read"
  | "dailyReports:write"
  | "reminders:read"
  | "reminders:write"
  | "reports:read"
  | "settings:read"
  | "billing:read"
  | "invites:write"
  | "admin:read";

export type AccessContext = {
  role: AccessRole;
  employee?: EmployeeSession | null;
  assignedProjectIds: string[];
  assignedWorkerIds: string[];
  workerId?: string;
};

const ownerPermissions = new Set<AccessPermission>([
  "finance:read",
  "transactions:write",
  "sites:read",
  "sites:write",
  "materials:read",
  "materials:write",
  "workers:read",
  "workers:write",
  "dailyReports:read",
  "dailyReports:write",
  "reminders:read",
  "reminders:write",
  "reports:read",
  "settings:read",
  "billing:read",
  "invites:write",
  "admin:read",
]);

const supervisorPermissions = new Set<AccessPermission>([
  "sites:read",
  "materials:read",
  "workers:read",
  "dailyReports:read",
  "dailyReports:write",
  "reminders:read",
]);

const workerPermissions = new Set<AccessPermission>([
  "sites:read",
  "dailyReports:read",
  "dailyReports:write",
]);

export const normalizeAccessRole = (
  role?: CompanyProfile["role"] | SaaSRole | EmployeeRole | string | null
): AccessRole => {
  const clean = String(role || "owner").trim().toLowerCase();

  if (clean === "admin") return "admin";
  if (clean === "supervisor") return "supervisor";
  if (clean === "worker") return "worker";
  return "owner";
};

export const roleLabel = (role: AccessRole) =>
  role === "owner"
    ? "Owner"
    : role === "admin"
      ? "Admin"
      : role === "supervisor"
        ? "Supervisor"
        : "Worker";

export const buildAccessContext = ({
  companyRole,
  employee,
}: {
  companyRole?: CompanyProfile["role"] | null;
  employee?: EmployeeSession | null;
}): AccessContext => {
  const role = employee?.role || normalizeAccessRole(companyRole);

  return {
    role,
    employee,
    assignedProjectIds: employee?.assignedProjectIds || [],
    assignedWorkerIds: employee?.assignedWorkerIds || [],
    workerId: employee?.workerId,
  };
};

export const canAccess = (
  context: Pick<AccessContext, "role">,
  permission: AccessPermission
) => {
  if (context.role === "owner" || context.role === "admin") {
    return ownerPermissions.has(permission);
  }

  if (context.role === "supervisor") {
    return supervisorPermissions.has(permission);
  }

  return workerPermissions.has(permission);
};

const isOwnerLike = (context: Pick<AccessContext, "role">) =>
  context.role === "owner" || context.role === "admin";

const matchesAssignedProject = (
  context: AccessContext,
  projectId?: string
) => {
  if (isOwnerLike(context)) return true;
  if (!projectId) return false;
  return context.assignedProjectIds.includes(projectId);
};

const workerIdentityMatches = (
  worker: PersonAccount,
  employee?: EmployeeInvite | EmployeeSession | null
) => {
  if (!employee) return false;
  return (
    Boolean(employee.workerId && worker.id === employee.workerId) ||
    Boolean(employee.displayName && worker.name === employee.displayName) ||
    Boolean(employee.code && worker.referralCode === employee.code)
  );
};

export const filterProjectsForAccess = (
  projects: ProjectSite[],
  context: AccessContext
) => {
  if (isOwnerLike(context)) return projects;
  return projects.filter((project) =>
    context.assignedProjectIds.includes(project.id)
  );
};

export const filterWorkersForAccess = (
  workers: PersonAccount[],
  context: AccessContext
) => {
  if (isOwnerLike(context)) return workers;

  if (context.role === "worker") {
    return workers.filter(
      (worker) =>
        workerIdentityMatches(worker, context.employee) ||
        context.assignedWorkerIds.includes(worker.id)
    );
  }

  return workers.filter(
    (worker) =>
      context.assignedWorkerIds.includes(worker.id) ||
      matchesAssignedProject(context, worker.projectId) ||
      worker.assignedSupervisor === context.employee?.code ||
      worker.assignedSupervisor === context.employee?.displayName ||
      worker.assignedSupervisor === context.employee?.workerId
  );
};

export const filterTransactionsForAccess = (
  transactions: Transaction[],
  context: AccessContext
) => {
  if (isOwnerLike(context)) return transactions;
  if (context.role === "worker") return [];
  return transactions.filter((transaction) =>
    matchesAssignedProject(context, transaction.projectId)
  );
};

export const filterMaterialsForAccess = (
  materials: MaterialItem[],
  context: AccessContext
) => {
  if (isOwnerLike(context)) return materials;
  if (context.role === "worker") return [];
  return materials.filter((material) =>
    matchesAssignedProject(context, material.projectId)
  );
};

export const filterRemindersForAccess = (
  reminders: ReminderItem[],
  context: AccessContext
) => {
  if (isOwnerLike(context)) return reminders;
  if (context.role === "worker") return [];
  return reminders.filter((reminder) =>
    matchesAssignedProject(context, reminder.projectId)
  );
};

export const filterDailyReportsForAccess = (
  reports: DailyWorkReport[],
  context: AccessContext
) => {
  if (isOwnerLike(context)) return reports;

  if (context.role === "worker") {
    return reports.filter(
      (report) =>
        Boolean(context.workerId && report.workerId === context.workerId) ||
        report.workerName === context.employee?.displayName
    );
  }

  return reports.filter(
    (report) =>
      matchesAssignedProject(context, report.projectId) ||
      context.assignedWorkerIds.includes(report.workerId || "")
  );
};
