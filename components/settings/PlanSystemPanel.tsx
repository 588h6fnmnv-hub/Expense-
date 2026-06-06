"use client";

import { useMemo, useState } from "react";
import {
  formatLimit,
  nextUpgradePlan,
  PLAN_LIMITS,
  PLAN_ORDER,
  WORKER_SUB_ROLES,
  type PlanType,
  type WorkerSubRole,
} from "@/lib/plans";
import type {
  CompanyProfile,
  EmployeeInvite,
  PersonAccount,
  ProjectSite,
} from "@/lib/types";

type InvitePreview = {
  role: EmployeeInvite["role"];
  workerSubRole?: WorkerSubRole;
  code: string;
};

const inviteLinkForCode = (code: string) =>
  typeof window === "undefined"
    ? `/?invite=${encodeURIComponent(code)}`
    : `${window.location.origin}/?invite=${encodeURIComponent(code)}`;

type PlanSystemPanelProps = {
  company: CompanyProfile | null;
  projectsCount: number;
  workersCount: number;
  materialsCount: number;
  employeeInvites: EmployeeInvite[];
  workers: PersonAccount[];
  projects: ProjectSite[];
  onPlanChange: (plan: PlanType) => void;
  onCreateEmployeeInvite: (input: {
    role: EmployeeInvite["role"];
    displayName: string;
    phone?: string;
    workerSubRole?: WorkerSubRole;
    workerId?: string;
    assignedSupervisor?: string;
    dailyWage?: number;
    monthlyWage?: number;
    workerStatus?: NonNullable<EmployeeInvite["workerStatus"]>;
    assignedProjectIds?: string[];
    assignedWorkerIds?: string[];
  }) => EmployeeInvite | null;
  onMessage: (message: string, tone?: "success" | "error") => void;
};

const usageRows = ({
  plan,
  projectsCount,
  workersCount,
  materialsCount,
  supervisorsCount,
}: {
  plan: PlanType;
  projectsCount: number;
  workersCount: number;
  materialsCount: number;
  supervisorsCount: number;
}) => [
  {
    label: "Projects",
    count: projectsCount,
    limit: PLAN_LIMITS[plan].projects,
  },
  {
    label: "Workers",
    count: workersCount,
    limit: PLAN_LIMITS[plan].workers,
  },
  {
    label: "Materials",
    count: materialsCount,
    limit: PLAN_LIMITS[plan].materials,
  },
  {
    label: "Supervisors",
    count: supervisorsCount,
    limit: PLAN_LIMITS[plan].supervisors,
  },
  {
    label: "Exports",
    count: 0,
    limit: PLAN_LIMITS[plan].exports,
  },
  {
    label: "Reports",
    count: 0,
    limit: PLAN_LIMITS[plan].reports,
  },
];

export default function PlanSystemPanel({
  company,
  projectsCount,
  workersCount,
  materialsCount,
  employeeInvites,
  workers,
  projects,
  onPlanChange,
  onCreateEmployeeInvite,
  onMessage,
}: PlanSystemPanelProps) {
  const currentPlan = company?.plan || "Starter";
  const nextPlan = nextUpgradePlan(currentPlan);
  const supervisorsCount = workers.filter(
    (worker) => worker.workerSubRole === "Supervisor"
  ).length;
  const [workerSubRole, setWorkerSubRole] = useState<WorkerSubRole>("Helper");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [assignedProjectId, setAssignedProjectId] = useState("");
  const [assignedSupervisor, setAssignedSupervisor] = useState("");
  const [assignedWorkerId, setAssignedWorkerId] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [monthlyWage, setMonthlyWage] = useState("");
  const [workerStatus, setWorkerStatus] =
    useState<NonNullable<EmployeeInvite["workerStatus"]>>("Active");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);

  const rows = useMemo(
    () =>
      usageRows({
        plan: currentPlan,
        projectsCount,
        workersCount,
        materialsCount,
        supervisorsCount,
      }),
    [currentPlan, materialsCount, projectsCount, supervisorsCount, workersCount]
  );

  const createInvite = () => {
    if (!company?.id) {
      onMessage("Create or load a company before generating invite links.", "error");
      return;
    }

    const selectedWorker = workers.find((worker) => worker.id === assignedWorkerId);
    const employeeRole = workerSubRole === "Supervisor" ? "supervisor" : "worker";
    const projectIds =
      [selectedWorker?.projectId || assignedProjectId].filter(
        (projectId): projectId is string => Boolean(projectId)
      );
    const workerIds =
      employeeRole === "supervisor"
        ? workers
            .filter((worker) =>
              assignedProjectId ? worker.projectId === assignedProjectId : false
            )
            .map((worker) => worker.id)
        : selectedWorker?.id
          ? [selectedWorker.id]
          : [];
    const invite = onCreateEmployeeInvite({
      role: employeeRole,
      displayName:
        inviteName.trim() ||
        selectedWorker?.name ||
        workerSubRole,
      phone: invitePhone.trim() || selectedWorker?.phone,
      workerSubRole,
      workerId: selectedWorker?.id,
      assignedSupervisor,
      dailyWage: Number(dailyWage || 0),
      monthlyWage: Number(monthlyWage || 0),
      workerStatus,
      assignedProjectIds: projectIds,
      assignedWorkerIds: workerIds,
    });

    if (!invite) return;

    setInvitePreview(invite);
    setInviteName("");
    setInvitePhone("");
    setAssignedWorkerId("");
    setDailyWage("");
    setMonthlyWage("");
    setWorkerStatus("Active");
  };

  return (
    <section className="liquid-surface space-y-4 rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
            Plan
          </p>
          <h2 className="mt-1 text-xl font-black">Workspace access</h2>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Company admins own the plan. Workers and supervisors join under this workspace.
          </p>
        </div>
        <div className="rounded-2xl bg-black px-3 py-2 text-sm font-black text-white dark:bg-white dark:text-black">
          {currentPlan}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {rows.map((row) => {
          const usedText = `${row.count.toLocaleString("en-IN")} / ${formatLimit(row.limit)}`;
          return (
            <div key={row.label} className="rounded-[22px] bg-black/5 p-3 dark:bg-white/5">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-500">
                {row.label}
              </p>
              <p className="mt-1 text-sm font-black">{usedText}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const active = plan === currentPlan;
          return (
            <button
              key={plan}
              type="button"
              onClick={() => {
                if (active) return;
                onPlanChange(plan);
                onMessage(`${plan} plan selected. Payment gateway coming soon.`, "success");
              }}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition active:scale-[0.98] ${
                active
                  ? "bg-emerald-500 text-black"
                  : "bg-black/5 text-neutral-700 dark:bg-white/5 dark:text-neutral-200"
              }`}
            >
              {plan}
              <span className="block text-[11px] font-bold opacity-70">
                {active ? "Current plan" : "Coming soon"}
              </span>
            </button>
          );
        })}
      </div>

      {nextPlan && (
        <div className="rounded-[24px] border border-amber-400/40 bg-amber-100/80 p-4 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="text-sm font-black">Upgrade to {nextPlan}</p>
          <p className="mt-1 text-xs font-semibold opacity-80">
            Payment is a placeholder for now, ready for Razorpay or Stripe later.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        <input
          value={inviteName}
          onChange={(event) => setInviteName(event.target.value)}
          placeholder="Employee name"
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        />
        <input
          value={invitePhone}
          onChange={(event) => setInvitePhone(event.target.value)}
          placeholder="Phone / contact"
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        />
        <select
          value={assignedProjectId}
          onChange={(event) => setAssignedProjectId(event.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        >
          <option value="">No assigned site</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={assignedSupervisor}
          onChange={(event) => setAssignedSupervisor(event.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        >
          <option value="">No assigned supervisor</option>
          {workers
            .filter((worker) => worker.workerSubRole === "Supervisor")
            .map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
        </select>
        <select
          value={assignedWorkerId}
          onChange={(event) => {
            const workerId = event.target.value;
            const worker = workers.find((item) => item.id === workerId);
            setAssignedWorkerId(workerId);
            if (worker?.workerSubRole) setWorkerSubRole(worker.workerSubRole);
            if (worker?.projectId) setAssignedProjectId(worker.projectId);
            if (worker?.name && !inviteName) setInviteName(worker.name);
          }}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        >
          <option value="">No worker profile linked</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
        <select
          value={workerSubRole}
          onChange={(event) => setWorkerSubRole(event.target.value as WorkerSubRole)}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        >
          {WORKER_SUB_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={dailyWage}
            onChange={(event) => setDailyWage(event.target.value)}
            placeholder="Daily wage"
            inputMode="decimal"
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
          />
          <input
            value={monthlyWage}
            onChange={(event) => setMonthlyWage(event.target.value)}
            placeholder="Monthly wage"
            inputMode="decimal"
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
          />
        </div>
        <select
          value={workerStatus}
          onChange={(event) =>
            setWorkerStatus(
              event.target.value as NonNullable<EmployeeInvite["workerStatus"]>
            )
          }
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/10"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <button
          type="button"
          onClick={createInvite}
          className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
        >
          Generate Invite
        </button>
      </div>

      {invitePreview && (
        <div className="rounded-[24px] bg-black/5 p-4 dark:bg-white/5">
          <p className="text-sm font-black">
            {invitePreview.role === "worker" ? "Worker" : "Supervisor"} invite
            {invitePreview.workerSubRole ? ` · ${invitePreview.workerSubRole}` : ""}
          </p>
          <p className="mt-2 break-all rounded-2xl bg-white/70 p-3 text-xs font-black text-neutral-700 dark:bg-black/30 dark:text-neutral-200">
            {invitePreview.code}
          </p>
          <p className="mt-2 break-all text-xs font-semibold text-neutral-500">
            {inviteLinkForCode(invitePreview.code)}
          </p>
        </div>
      )}

      {employeeInvites.length > 0 && (
        <div className="space-y-2">
          {employeeInvites.slice(0, 6).map((invite) => (
            <div
              key={invite.id}
              className="rounded-[22px] bg-black/5 p-3 text-sm dark:bg-white/5"
            >
              <p className="font-black">
                {invite.displayName} · {invite.role === "worker" ? "Worker" : "Supervisor"}
              </p>
              <p className="mt-1 break-all text-xs font-bold text-neutral-500">
                {invite.code}
              </p>
              <p className="mt-1 break-all text-[11px] font-semibold text-neutral-500">
                {inviteLinkForCode(invite.code)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
