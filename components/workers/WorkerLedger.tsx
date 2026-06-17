"use client";

import { useMemo, useState } from "react";
import { CONSTRUCTION_WORKER_ROLES } from "@/lib/construction";
import type {
  DailyWorkReport,
  PaymentMethod,
  PersonAccount,
  PersonAccountEntry,
  ProjectSite,
  SaaSRole,
  Transaction,
  WorkerSubRole,
} from "@/lib/types";

type WorkerLedgerProps = {
  workers: PersonAccount[];
  projects: ProjectSite[];
  transactions: Transaction[];
  dailyReports: DailyWorkReport[];
  companyName: string;
  accessRole: Extract<SaaSRole, "owner" | "admin" | "supervisor" | "worker">;
  canManageWorkers: boolean;
  canManageLedger: boolean;
  canReviewReports: boolean;
  onCreateWorker: (
    worker: Omit<PersonAccount, "id" | "entries"> & {
      entries?: PersonAccountEntry[];
    }
  ) => void;
  onUpdateWorker: (workerId: string, patch: Partial<PersonAccount>) => void;
  onCreateDailyReport: (report: Omit<DailyWorkReport, "id">) => void;
  onUpdateDailyReport: (
    reportId: string,
    patch: Partial<DailyWorkReport>
  ) => void;
  onAddEntry: (
    workerId: string,
    entry: Omit<PersonAccountEntry, "id">
  ) => void;
  onDeleteEntry: (workerId: string, entryId: string) => void;
};

type WorkerDraft = {
  name: string;
  phone: string;
  note: string;
  amount: string;
  direction: PersonAccount["direction"];
  workerSubRole: WorkerSubRole;
  projectId: string;
  dailyWage: string;
  status: PersonAccount["status"];
};

type EntryDraft = {
  amount: string;
  direction: PersonAccountEntry["direction"];
  method: PaymentMethod;
  date: string;
  projectId: string;
  narration: string;
};

type ReportDraft = {
  date: string;
  projectId: string;
  workerRole: WorkerSubRole;
  workDescription: string;
  materialsUsed: string;
  hoursWorked: string;
  paymentAdvance: string;
  issues: string;
  nextWorkPlan: string;
  photosNote: string;
  status: DailyWorkReport["status"];
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const localDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const cleanAmount = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const workerOpeningBalance = (worker: PersonAccount) =>
  worker.direction === "Receivable" ? worker.amount : -worker.amount;

const workerEntryAmount = (entry: PersonAccountEntry) =>
  entry.direction === "Debit" ? entry.amount : -entry.amount;

const workerBalance = (worker: PersonAccount) =>
  workerOpeningBalance(worker) +
  (worker.entries || []).reduce(
    (total, entry) => total + workerEntryAmount(entry),
    0
  );

const balanceCopy = (balance: number) =>
  balance > 0
    ? { label: "Advance balance", helper: "Worker owes company", tone: "text-emerald-600" }
    : balance < 0
      ? { label: "Payable", helper: "Company owes worker", tone: "text-red-500" }
      : { label: "Settled", helper: "No dues pending", tone: "text-neutral-500" };

const entryLabel = (entry: Pick<PersonAccountEntry, "direction">) =>
  entry.direction === "Debit" ? "Advance / paid" : "Wage due / adjustment";

const newWorkerDraft = (): WorkerDraft => ({
  name: "",
  phone: "",
  note: "",
  amount: "",
  direction: "Payable",
  workerSubRole: "Helper",
  projectId: "",
  dailyWage: "",
  status: "Active",
});

const newEntryDraft = (): EntryDraft => ({
  amount: "",
  direction: "Debit",
  method: "Cash",
  date: localDateValue(),
  projectId: "",
  narration: "",
});

const newReportDraft = (worker?: PersonAccount | null): ReportDraft => ({
  date: localDateValue(),
  projectId: worker?.projectId || "",
  workerRole: worker?.workerSubRole || "Helper",
  workDescription: "",
  materialsUsed: "",
  hoursWorked: "",
  paymentAdvance: "",
  issues: "",
  nextWorkPlan: "",
  photosNote: "",
  status: "Draft",
});

const dailyReportStatusTone: Record<DailyWorkReport["status"], string> = {
  Draft: "bg-amber-500/10 text-amber-600",
  Submitted: "bg-blue-500/10 text-blue-600",
  Reviewed: "bg-emerald-500/10 text-emerald-600",
};

export default function WorkerLedger({
  workers,
  projects,
  transactions,
  dailyReports,
  companyName,
  accessRole,
  canManageWorkers,
  canManageLedger,
  canReviewReports,
  onCreateWorker,
  onUpdateWorker,
  onCreateDailyReport,
  onUpdateDailyReport,
  onAddEntry,
  onDeleteEntry,
}: WorkerLedgerProps) {
  const [showNewWorker, setShowNewWorker] = useState(false);
  const [workerDraft, setWorkerDraft] = useState<WorkerDraft>(newWorkerDraft);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, EntryDraft>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, ReportDraft>>({});
  const [activeWorkerId, setActiveWorkerId] = useState("");

  const safeWorkers = useMemo(() => workers || [], [workers]);
  const safeProjects = useMemo(() => projects || [], [projects]);
  const safeTransactions = useMemo(() => transactions || [], [transactions]);
  const safeDailyReports = useMemo(() => dailyReports || [], [dailyReports]);

  const projectNameById = useMemo(
    () => new Map(safeProjects.map((project) => [project.id, project.name])),
    [safeProjects]
  );
  const activeWorker =
    safeWorkers.find((worker) => worker && worker.id === activeWorkerId) || safeWorkers[0] || null;
  const totalAdvance = safeWorkers.reduce((total, worker) => {
    if (!worker) return total;
    const balance = workerBalance(worker);
    return balance > 0 ? total + balance : total;
  }, 0);
  const totalPayable = safeWorkers.reduce((total, worker) => {
    if (!worker) return total;
    const balance = workerBalance(worker);
    return balance < 0 ? total + Math.abs(balance) : total;
  }, 0);
  const recentEntries = safeWorkers
    .flatMap((worker) => {
      if (!worker) return [];
      return (worker.entries || []).map((entry) => ({ ...entry, workerName: worker.name }));
    })
    .sort((left, right) => `${right.date} ${right.id}`.localeCompare(`${left.date} ${left.id}`))
    .slice(0, 4);
  const sitePayments = useMemo(() => {
    const bySite = new Map<string, number>();

    safeWorkers.forEach((worker) => {
      if (!worker) return;
      (worker.entries || []).forEach((entry) => {
        if (!entry || !entry.projectId || entry.direction !== "Debit") return;
        bySite.set(entry.projectId, (bySite.get(entry.projectId) || 0) + (entry.amount || 0));
      });
    });

    safeTransactions.forEach((tx) => {
      if (!tx || !tx.projectId || tx.category !== "👷 Worker Salary") return;
      bySite.set(tx.projectId, (bySite.get(tx.projectId) || 0) + (tx.amount || 0));
    });

    return Array.from(bySite.entries())
      .map(([projectId, amount]) => ({
        projectId,
        name: projectNameById.get(projectId) || "Unassigned site",
        amount,
      }))
      .sort((left, right) => right.amount - left.amount);
  }, [projectNameById, safeTransactions, safeWorkers]);

  const createWorker = () => {
    const name = workerDraft.name.trim();

    if (!name) return;

    onCreateWorker({
      name,
      phone: workerDraft.phone.trim(),
      note: workerDraft.note.trim(),
      amount: cleanAmount(workerDraft.amount),
      direction: workerDraft.direction,
      date: localDateValue(),
      entries: [],
      role: "worker",
      workerSubRole: workerDraft.workerSubRole,
      projectId: workerDraft.projectId,
      dailyWage: cleanAmount(workerDraft.dailyWage),
      status: workerDraft.status || "Active",
    });
    setWorkerDraft(newWorkerDraft());
    setShowNewWorker(false);
  };

  const submitDailyReport = (worker: PersonAccount) => {
    const draft = reportDrafts[worker.id] || newReportDraft(worker);
    const workDescription = draft.workDescription.trim();

    if (!workDescription) return;

    onCreateDailyReport({
      date: draft.date || localDateValue(),
      projectId: draft.projectId,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: draft.workerRole || worker.workerSubRole || "Other",
      workDescription,
      materialsUsed: draft.materialsUsed.trim(),
      hoursWorked: cleanAmount(draft.hoursWorked),
      paymentAdvance: cleanAmount(draft.paymentAdvance),
      issues: draft.issues.trim(),
      nextWorkPlan: draft.nextWorkPlan.trim(),
      photosNote: draft.photosNote.trim() || "Photos placeholder",
      status: draft.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setReportDrafts((current) => ({
      ...current,
      [worker.id]: newReportDraft(worker),
    }));
  };

  const submitEntry = (workerId: string) => {
    const draft = entryDrafts[workerId] || newEntryDraft();
    const amount = cleanAmount(draft.amount);

    if (!amount) return;

    onAddEntry(workerId, {
      amount,
      direction: draft.direction,
      method: draft.method,
      date: draft.date || localDateValue(),
      projectId: draft.projectId,
      narration: draft.narration.trim() || entryLabel(draft),
    });
    setEntryDrafts((current) => ({
      ...current,
      [workerId]: newEntryDraft(),
    }));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
            Workers
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">
            {accessRole === "worker" ? "Daily work reports" : "Worker ledger"}
          </h2>
        </div>
        {canManageWorkers && (
          <button
            type="button"
            onClick={() => setShowNewWorker((current) => !current)}
            className="rounded-2xl bg-black px-4 py-2 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
          >
            Add
          </button>
        )}
      </div>

      {canManageLedger && (
      <div className="grid grid-cols-2 gap-3">
        <div className="liquid-surface text-neutral-950 rounded-[22px] p-4">
          <p className="text-xs font-bold text-neutral-500">Payable</p>
          <p className="mt-1 text-lg font-black text-red-500">
            {rupee(totalPayable)}
          </p>
        </div>
        <div className="liquid-surface text-neutral-950 rounded-[22px] p-4">
          <p className="text-xs font-bold text-neutral-500">Advances</p>
          <p className="mt-1 text-lg font-black text-emerald-600">
            {rupee(totalAdvance)}
          </p>
        </div>
      </div>
      )}

      {canManageWorkers && showNewWorker && (
        <div className="liquid-surface text-neutral-950 space-y-3 rounded-[26px] p-4">
          <input
            value={workerDraft.name}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Worker name"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={workerDraft.phone}
              onChange={(event) =>
                setWorkerDraft((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="Phone"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            />
            <input
              value={workerDraft.amount}
              onChange={(event) =>
                setWorkerDraft((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="Opening"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            />
          </div>
          <select
            value={workerDraft.direction}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                direction: event.target.value as PersonAccount["direction"],
              }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            <option value="Payable">Opening payable to worker</option>
            <option value="Receivable">Opening advance from worker</option>
          </select>
          <select
            value={workerDraft.workerSubRole}
            onChange={(event) =>
              setWorkerDraft((current) => ({
                ...current,
                workerSubRole: event.target.value as WorkerSubRole,
              }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            {CONSTRUCTION_WORKER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={workerDraft.projectId}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, projectId: event.target.value }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            <option value="">No assigned site</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={workerDraft.dailyWage}
              onChange={(event) =>
                setWorkerDraft((current) => ({ ...current, dailyWage: event.target.value }))
              }
              placeholder="Daily wage"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            />
            <select
              value={workerDraft.status}
              onChange={(event) =>
                setWorkerDraft((current) => ({
                  ...current,
                  status: event.target.value as PersonAccount["status"],
                }))
              }
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <input
            value={workerDraft.note}
            onChange={(event) =>
              setWorkerDraft((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Note"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
          <button
            type="button"
            onClick={createWorker}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black active:scale-[0.98]"
          >
            Save Worker
          </button>
        </div>
      )}

      {safeWorkers.length === 0 && (
        <div className="liquid-surface text-neutral-950 rounded-[26px] p-6 text-center">
          <p className="font-black">No workers yet</p>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Add a worker to track advances, wages, site payments, and dues.
          </p>
        </div>
      )}

      {safeWorkers.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {safeWorkers.map((worker) => {
              if (!worker) return null;
              const balance = workerBalance(worker);
              const copy = balanceCopy(balance);
              const selected = activeWorker?.id === worker.id;

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => setActiveWorkerId(worker.id)}
                  className={`min-w-[148px] rounded-[22px] p-3 text-left transition active:scale-[0.98] ${
                    selected
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "liquid-surface"
                  }`}
                >
                  <p className="truncate text-sm font-black">{worker.name}</p>
                  {canManageLedger && (
                    <p className={`mt-1 text-sm font-black ${selected ? "" : copy.tone}`}>
                      {rupee(Math.abs(balance))}
                    </p>
                  )}
                  <p className="mt-1 truncate text-[11px] font-bold opacity-70">
                    {worker.workerSubRole || "Worker"}
                    {canManageLedger ? ` · ${copy.label}` : ""}
                  </p>
                </button>
              );
            })}
          </div>

          {activeWorker && (
            <WorkerCard
              worker={activeWorker}
              projects={safeProjects}
              projectNameById={projectNameById}
              entryDraft={entryDrafts[activeWorker.id] || newEntryDraft()}
              onEntryDraftChange={(patch) =>
                setEntryDrafts((current) => ({
                  ...current,
                  [activeWorker.id]: {
                    ...(current[activeWorker.id] || newEntryDraft()),
                    ...patch,
                  },
                }))
              }
              onSubmitEntry={() => submitEntry(activeWorker.id)}
              onUpdateWorker={(patch) => onUpdateWorker(activeWorker.id, patch)}
              onDeleteEntry={(entryId) => onDeleteEntry(activeWorker.id, entryId)}
              canManageWorker={canManageWorkers}
              canManageLedger={canManageLedger}
            />
          )}

          {activeWorker && (
            <DailyReportsPanel
              companyName={companyName}
              worker={activeWorker}
              projects={safeProjects}
              projectNameById={projectNameById}
              dailyReports={safeDailyReports}
              reportDraft={reportDrafts[activeWorker.id] || newReportDraft(activeWorker)}
              onReportDraftChange={(patch) =>
                setReportDrafts((current) => ({
                  ...current,
                  [activeWorker.id]: {
                    ...(current[activeWorker.id] || newReportDraft(activeWorker)),
                    ...patch,
                  },
                }))
              }
              onSubmitReport={() => submitDailyReport(activeWorker)}
              onUpdateDailyReport={onUpdateDailyReport}
              canReviewReports={canReviewReports}
              canTrackPayment={canManageLedger}
            />
          )}

          {canManageLedger && (
          <div className="liquid-surface text-neutral-950 rounded-[26px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">Recent history</p>
                <p className="text-xs font-semibold text-neutral-500">
                  Latest worker ledger rows
                </p>
              </div>
              <p className="text-xs font-black text-neutral-500">
                {recentEntries.length}
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {recentEntries.map((entry) => (
                <LedgerRow
                  key={`${entry.workerName}-${entry.id}`}
                  entry={entry}
                  workerName={entry.workerName}
                  projectName={
                    entry.projectId ? projectNameById.get(entry.projectId) : undefined
                  }
                />
              ))}
              {recentEntries.length === 0 && (
                <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
                  Payment history will appear after the first ledger row.
                </p>
              )}
            </div>
          </div>
          )}

          {canManageLedger && (
          <div className="liquid-surface text-neutral-950 rounded-[26px] p-4">
            <p className="text-sm font-black">Site-wise payments</p>
            <div className="mt-3 space-y-2">
              {sitePayments.map((site) => (
                <div
                  key={site.projectId}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3"
                >
                  <p className="truncate text-sm font-bold">{site.name}</p>
                  <p className="shrink-0 text-sm font-black">
                    {rupee(site.amount)}
                  </p>
                </div>
              ))}
              {sitePayments.length === 0 && (
                <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
                  Select a site while adding worker payments to see this summary.
                </p>
              )}
            </div>
          </div>
          )}
        </>
      )}
    </section>
  );
}

function WorkerCard({
  worker,
  projects,
  projectNameById,
  entryDraft,
  onEntryDraftChange,
  onSubmitEntry,
  onUpdateWorker,
  onDeleteEntry,
  canManageWorker,
  canManageLedger,
}: {
  worker: PersonAccount;
  projects: ProjectSite[];
  projectNameById: Map<string, string>;
  entryDraft: EntryDraft;
  onEntryDraftChange: (patch: Partial<EntryDraft>) => void;
  onSubmitEntry: () => void;
  onUpdateWorker: (patch: Partial<PersonAccount>) => void;
  onDeleteEntry: (entryId: string) => void;
  canManageWorker: boolean;
  canManageLedger: boolean;
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const balance = workerBalance(worker);
  const copy = balanceCopy(balance);
  const entries = [...(worker.entries || [])].sort((left, right) =>
    `${right.date} ${right.id}`.localeCompare(`${left.date} ${left.id}`)
  );

  return (
    <div className="liquid-surface text-neutral-950 rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black">{worker.name}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-neutral-500">
            {[
              worker.workerSubRole,
              worker.projectId ? projectNameById.get(worker.projectId) : "",
              worker.phone,
              worker.status || "Active",
            ].filter(Boolean).join(" • ") || "No phone or note"}
          </p>
        </div>
        {canManageLedger && (
          <div className="shrink-0 text-right">
            <p className={`font-black ${copy.tone}`}>{rupee(Math.abs(balance))}</p>
            <p className="text-[11px] font-bold text-neutral-500">{copy.helper}</p>
          </div>
        )}
      </div>

      {canManageWorker && (
        <button
          type="button"
          onClick={() => setEditingProfile((current) => !current)}
          className="mt-3 rounded-2xl bg-black/5 px-3 py-2 text-xs font-black text-neutral-600"
        >
          {editingProfile ? "Close Details" : "Edit Details"}
        </button>
      )}

      {canManageWorker && editingProfile && (
        <div className="mt-3 grid gap-2">
          <input
            value={worker.phone || ""}
            onChange={(event) => onUpdateWorker({ phone: event.target.value })}
            placeholder="Phone"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
          <select
            value={worker.workerSubRole || "Other"}
            onChange={(event) =>
              onUpdateWorker({ workerSubRole: event.target.value as WorkerSubRole })
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            {CONSTRUCTION_WORKER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            value={worker.projectId || ""}
            onChange={(event) => onUpdateWorker({ projectId: event.target.value })}
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            <option value="">No assigned site</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={worker.dailyWage || ""}
              onChange={(event) =>
                onUpdateWorker({ dailyWage: cleanAmount(event.target.value) })
              }
              placeholder="Daily wage"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            />
            <select
              value={worker.status || "Active"}
              onChange={(event) =>
                onUpdateWorker({ status: event.target.value as PersonAccount["status"] })
              }
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <input
            value={worker.note || ""}
            onChange={(event) => onUpdateWorker({ note: event.target.value })}
            placeholder="Note"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
        </div>
      )}

      {canManageLedger && (
      <div className="mt-4 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={entryDraft.amount}
            onChange={(event) => onEntryDraftChange({ amount: event.target.value })}
            placeholder="Amount"
            inputMode="decimal"
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
          <select
            value={entryDraft.direction}
            onChange={(event) =>
              onEntryDraftChange({
                direction: event.target.value as PersonAccountEntry["direction"],
              })
            }
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            <option value="Debit">Advance / paid</option>
            <option value="Credit">Wage due / adjustment</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={entryDraft.method}
            onChange={(event) =>
              onEntryDraftChange({ method: event.target.value as PaymentMethod })
            }
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
          </select>
          <input
            type="date"
            value={entryDraft.date}
            onChange={(event) => onEntryDraftChange({ date: event.target.value })}
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
        </div>
        <select
          value={entryDraft.projectId}
          onChange={(event) => onEntryDraftChange({ projectId: event.target.value })}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        >
          <option value="">No site selected</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <input
          value={entryDraft.narration}
          onChange={(event) => onEntryDraftChange({ narration: event.target.value })}
          placeholder="Narration"
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        />
        <button
          type="button"
          onClick={onSubmitEntry}
          className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black active:scale-[0.98]"
        >
          Add Ledger Row
        </button>
      </div>
      )}

      {canManageLedger && (
      <div className="mt-4 space-y-2">
        {entries.map((entry) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            projectName={
              entry.projectId ? projectNameById.get(entry.projectId) : undefined
            }
            onDelete={() => onDeleteEntry(entry.id)}
          />
        ))}
        {entries.length === 0 && (
          <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
            No payment history for this worker yet.
          </p>
        )}
      </div>
      )}
    </div>
  );
}

function LedgerRow({
  entry,
  workerName,
  projectName,
  onDelete,
}: {
  entry: PersonAccountEntry;
  workerName?: string;
  projectName?: string;
  onDelete?: () => void;
}) {
  const isAdvance = entry.direction === "Debit";

  return (
    <div className="rounded-2xl bg-black/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">
            {workerName ? `${workerName} • ` : ""}
            {entry.narration || entryLabel(entry)}
          </p>
          <p className="mt-1 truncate text-xs font-bold text-neutral-500">
            {entry.date} • {entry.method}
            {projectName ? ` • ${projectName}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-black ${isAdvance ? "text-emerald-600" : "text-red-500"}`}>
            {isAdvance ? "+" : "-"}
            {rupee(entry.amount)}
          </p>
          <p className="text-[11px] font-bold text-neutral-500">
            {entryLabel(entry)}
          </p>
        </div>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-2 rounded-xl px-2 py-1 text-xs font-black text-neutral-500"
        >
          Delete
        </button>
      )}
    </div>
  );
}

function DailyReportsPanel({
  companyName,
  worker,
  projects,
  projectNameById,
  dailyReports,
  reportDraft,
  onReportDraftChange,
  onSubmitReport,
  onUpdateDailyReport,
  canReviewReports,
  canTrackPayment,
}: {
  companyName: string;
  worker: PersonAccount;
  projects: ProjectSite[];
  projectNameById: Map<string, string>;
  dailyReports: DailyWorkReport[];
  reportDraft: ReportDraft;
  onReportDraftChange: (patch: Partial<ReportDraft>) => void;
  onSubmitReport: () => void;
  onUpdateDailyReport: (
    reportId: string,
    patch: Partial<DailyWorkReport>
  ) => void;
  canReviewReports: boolean;
  canTrackPayment: boolean;
}) {
  const [copiedReportId, setCopiedReportId] = useState("");
  const reportsByStatus = dailyReports.reduce(
    (counts, report) => ({
      ...counts,
      [report.status]: counts[report.status] + 1,
    }),
    { Draft: 0, Submitted: 0, Reviewed: 0 }
  );
  const groupedReports = useMemo(() => {
    const groups = new Map<string, DailyWorkReport[]>();

    dailyReports
      .slice()
      .sort((left, right) => `${right.date} ${right.id}`.localeCompare(`${left.date} ${left.id}`))
      .forEach((report) => {
        const siteName = report.projectId
          ? projectNameById.get(report.projectId) || "Unknown site"
          : "No site";
        const key = `${report.date} · ${siteName}`;
        groups.set(key, [...(groups.get(key) || []), report]);
      });

    return Array.from(groups.entries()).slice(0, 8);
  }, [dailyReports, projectNameById]);

  const reportText = (report: DailyWorkReport) => {
    const siteName = report.projectId
      ? projectNameById.get(report.projectId) || "Unknown site"
      : "No site";

    return [
      `${companyName} - Daily Work Report`,
      `Date: ${report.date}`,
      `Site: ${siteName}`,
      `Worker: ${report.workerName} (${report.workerRole})`,
      `Work Done: ${report.workDescription}`,
      `Materials Used: ${report.materialsUsed || "None"}`,
      `Issues: ${report.issues || "None"}`,
      `Next Plan: ${report.nextWorkPlan || "Not added"}`,
    ].join("\n");
  };

  const shareReport = async (report: DailyWorkReport) => {
    const text = reportText(report);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, "_blank", "noopener,noreferrer");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedReportId(report.id);
      window.setTimeout(() => setCopiedReportId(""), 1800);
    } catch {
      setCopiedReportId("");
    }
  };

  return (
    <div className="liquid-surface text-neutral-950 rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
            Daily Reports
          </p>
          <h3 className="mt-1 text-xl font-black">Construction work log</h3>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Submit site progress and share daily work updates.
          </p>
        </div>
        <div className="shrink-0 text-right text-xs font-black text-neutral-500">
          <p>Pending {reportsByStatus.Draft}</p>
          <p>Submitted {reportsByStatus.Submitted}</p>
          <p>Reviewed {reportsByStatus.Reviewed}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={reportDraft.date}
            onChange={(event) => onReportDraftChange({ date: event.target.value })}
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
          <select
            value={reportDraft.status}
            onChange={(event) =>
              onReportDraftChange({
                status: event.target.value as DailyWorkReport["status"],
              })
            }
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          >
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            {canReviewReports && <option value="Reviewed">Reviewed</option>}
          </select>
        </div>
        <select
          value={reportDraft.projectId}
          onChange={(event) => onReportDraftChange({ projectId: event.target.value })}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        >
          <option value="">No site selected</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={reportDraft.workerRole}
          onChange={(event) =>
            onReportDraftChange({ workerRole: event.target.value as WorkerSubRole })
          }
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        >
          {CONSTRUCTION_WORKER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <textarea
          value={reportDraft.workDescription}
          onChange={(event) => onReportDraftChange({ workDescription: event.target.value })}
          placeholder={`Today's work by ${worker.name}`}
          rows={3}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        />
        <textarea
          value={reportDraft.materialsUsed}
          onChange={(event) => onReportDraftChange({ materialsUsed: event.target.value })}
          placeholder="Materials used"
          rows={2}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        />
        <div className={`grid gap-2 ${canTrackPayment ? "grid-cols-2" : ""}`}>
          <input
            value={reportDraft.hoursWorked}
            onChange={(event) => onReportDraftChange({ hoursWorked: event.target.value })}
            placeholder="Hours worked"
            inputMode="decimal"
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
          />
          {canTrackPayment && (
            <input
              value={reportDraft.paymentAdvance}
              onChange={(event) =>
                onReportDraftChange({ paymentAdvance: event.target.value })
              }
              placeholder="Payment / advance"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
            />
          )}
        </div>
        <textarea
          value={reportDraft.issues}
          onChange={(event) => onReportDraftChange({ issues: event.target.value })}
          placeholder="Problems / issues"
          rows={2}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        />
        <textarea
          value={reportDraft.nextWorkPlan}
          onChange={(event) => onReportDraftChange({ nextWorkPlan: event.target.value })}
          placeholder="Next work plan"
          rows={2}
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        />
        <input
          value={reportDraft.photosNote}
          onChange={(event) => onReportDraftChange({ photosNote: event.target.value })}
          placeholder="Photos placeholder"
          className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 outline-none"
        />
        <button
          type="button"
          onClick={onSubmitReport}
          className="rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black active:scale-[0.98]"
        >
          Save Daily Report
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {groupedReports.map(([group, reports]) => (
          <div key={group} className="rounded-[24px] bg-black/5 p-3 dark:bg-white/5">
            <p className="text-sm font-black">{group}</p>
            <div className="mt-2 space-y-2">
              {reports.map((report) => (
                <div key={report.id} className="rounded-2xl bg-white/70 p-3 dark:bg-black/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {report.workerName} · {report.workerRole}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-neutral-500">
                        {report.workDescription}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${dailyReportStatusTone[report.status]}`}
                    >
                      {report.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => shareReport(report)}
                      className="rounded-xl bg-black px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-black"
                    >
                      Share Daily Report
                    </button>
                    {canReviewReports && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateDailyReport(report.id, {
                            status: report.status === "Reviewed" ? "Submitted" : "Reviewed",
                            reviewedBy: report.status === "Reviewed" ? "" : "Admin",
                            updatedAt: new Date().toISOString(),
                          })
                        }
                        className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-600"
                      >
                        {report.status === "Reviewed" ? "Undo Review" : "Mark Reviewed"}
                      </button>
                    )}
                    {copiedReportId === report.id && (
                      <span className="rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-600">
                        Copied
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {dailyReports.length === 0 && (
          <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
            Daily work reports will appear here grouped by date and site.
          </p>
        )}
      </div>
    </div>
  );
}
