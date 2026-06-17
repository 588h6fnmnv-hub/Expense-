"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type {
  CompanyProfile,
  DailyWorkReport,
  MaterialItem,
  PersonAccount,
  ProjectExtraWork,
  ProjectSite,
  ReminderItem,
  Transaction,
} from "@/lib/types";

type SitesViewProps = {
  projects: ProjectSite[];
  transactions: Transaction[];
  materials: MaterialItem[];
  reminders: ReminderItem[];
  workers: PersonAccount[];
  dailyReports: DailyWorkReport[];
  company: CompanyProfile | null;
  canManageSites?: boolean;
  onCreateSite: (site: Omit<ProjectSite, "id">) => void;
  onUpdate: (projectId: string, patch: Partial<ProjectSite>) => void;
  onDelete: (projectId: string) => void;
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const localDateValue = () => new Date().toISOString().slice(0, 10);

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const newExtraDraft = () => ({
  title: "",
  amount: "",
  date: localDateValue(),
});

const isMoneyIn = (tx: Transaction) =>
  tx.type === "Income" || tx.type === "Pay In";

const isMoneyOut = (tx: Transaction) =>
  tx.type === "Expense" || tx.type === "Pay Out";

const isWorkerPayment = (tx: Transaction) => tx.category === "👷 Worker Salary";

const isMaterialExpense = (tx: Transaction) => tx.category === "🏗️ Materials";

const isProjectLinkedTransaction = (tx: Transaction, projectId: string) =>
  tx.projectId === projectId ||
  ((tx as Transaction & { siteId?: string }).siteId || "") === projectId;

const materialUsedValue = (material: MaterialItem) => {
  const quantity =
    material.usedQuantity && material.usedQuantity > 0
      ? material.usedQuantity
      : material.quantity;

  return quantity * material.rate;
};

const statusStyles: Record<ProjectSite["status"], string> = {
  Active: "bg-emerald-500/10 text-emerald-600",
  Paused: "bg-amber-500/10 text-amber-600",
  Completed: "bg-blue-500/10 text-blue-600",
};

function SummaryCard({
  label,
  value,
  tone = "text-black",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/60 p-3 dark:bg-white/5">
      <p className="text-xs font-bold text-neutral-500">{label}</p>
      <p className={`mt-1 truncate font-black ${tone}`}>{value}</p>
    </div>
  );
}

function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black">
        <span>{title}</span>
        <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-black text-neutral-500 dark:bg-black/20">
          {count}
        </span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function EmptyDetail({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-white/60 p-3 text-sm font-bold text-neutral-500 dark:bg-black/20">
      {label}
    </p>
  );
}

export default function SitesView({
  projects,
  transactions,
  materials,
  reminders,
  workers,
  dailyReports,
  company,
  canManageSites = true,
  onCreateSite,
  onUpdate,
  onDelete,
}: SitesViewProps) {
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteDraft, setSiteDraft] = useState({
    name: "",
    budget: "",
    customer: "",
    note: "",
  });
  const [extraDrafts, setExtraDrafts] = useState<Record<string, ReturnType<typeof newExtraDraft>>>({});
  const [editingExtraIds, setEditingExtraIds] = useState<Record<string, string>>({});
  const [expandedSiteIds, setExpandedSiteIds] = useState<string[]>([]);

  const submitSite = () => {
    const name = siteDraft.name.trim();
    if (!name) return;

    const budget = Number(siteDraft.budget || 0);

    onCreateSite({
      name,
      budget: Number.isFinite(budget) && budget > 0 ? budget : 0,
      status: "Active",
      date: localDateValue(),
      customer: siteDraft.customer.trim(),
      note: siteDraft.note.trim(),
      extras: [],
    });

    setSiteDraft({ name: "", budget: "", customer: "", note: "" });
    setShowSiteForm(false);
  };

  const submitExtra = (project: ProjectSite) => {
    const draft = extraDrafts[project.id] || newExtraDraft();
    const title = draft.title.trim();
    const amount = Number(draft.amount || 0);

    if (!title || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const editingId = editingExtraIds[project.id];
    const nextExtra: ProjectExtraWork = {
      id: editingId || uid(),
      title,
      amount,
      date: draft.date || localDateValue(),
    };
    const extras = editingId
      ? (project.extras || []).map((extra) =>
          extra.id === editingId ? nextExtra : extra
        )
      : [...(project.extras || []), nextExtra];

    onUpdate(project.id, { extras });
    setExtraDrafts((current) => ({
      ...current,
      [project.id]: newExtraDraft(),
    }));
    setEditingExtraIds((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
  };

  const editExtra = (projectId: string, extra: ProjectExtraWork) => {
    setExtraDrafts((current) => ({
      ...current,
      [projectId]: {
        title: extra.title,
        amount: String(extra.amount || ""),
        date: extra.date || localDateValue(),
      },
    }));
    setEditingExtraIds((current) => ({ ...current, [projectId]: extra.id }));
  };

  const deleteExtra = (project: ProjectSite, extraId: string) => {
    onUpdate(project.id, {
      extras: (project.extras || []).filter((extra) => extra.id !== extraId),
    });
  };

  const safeProjects = projects || [];
  const safeTransactions = transactions || [];
  const safeMaterials = materials || [];
  const safeReminders = reminders || [];
  const safeWorkers = workers || [];
  const safeDailyReports = dailyReports || [];

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-white/80 p-5 shadow-xl dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Sites
        </p>
        <h2 className="mt-2 text-2xl font-black">
          {company?.name || "Construction Sites"}
        </h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Track project budget, expenses, materials and reminders.
        </p>
        {canManageSites && (
          <button
            type="button"
            onClick={() => setShowSiteForm((current) => !current)}
            className="mt-4 rounded-3xl bg-emerald-500 px-5 py-3 font-black text-black"
          >
            Add Site
          </button>
        )}

        {canManageSites && showSiteForm && (
          <div className="mt-4 grid gap-3 rounded-[24px] bg-black/5 p-4 dark:bg-white/5">
            <input
              value={siteDraft.name}
              onChange={(event) =>
                setSiteDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Site name"
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-black/40 dark:text-white"
            />
            <input
              value={siteDraft.budget}
              onChange={(event) =>
                setSiteDraft((current) => ({ ...current, budget: event.target.value }))
              }
              inputMode="decimal"
              placeholder="Budget amount"
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-black/40 dark:text-white"
            />
            <input
              value={siteDraft.customer}
              onChange={(event) =>
                setSiteDraft((current) => ({ ...current, customer: event.target.value }))
              }
              placeholder="Customer / client name"
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-black/40 dark:text-white"
            />
            <textarea
              value={siteDraft.note}
              onChange={(event) =>
                setSiteDraft((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="Note"
              className="min-h-[88px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-black/40 dark:text-white"
            />
            <button
              type="button"
              onClick={submitSite}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-black"
            >
              Save Site
            </button>
          </div>
        )}
      </div>

      {safeProjects.map((project) => {
        if (!project) return null;
        const projectTransactions = safeTransactions.filter(
          (tx) => tx && isProjectLinkedTransaction(tx, project.id)
        );
        const projectIncomeTransactions = projectTransactions.filter(isMoneyIn);
        const incomeReceived = projectIncomeTransactions.reduce(
          (total, tx) => total + (tx.amount || 0),
          0
        );
        const materialExpenseTransactions = projectTransactions.filter(
          (tx) => isMoneyOut(tx) && isMaterialExpense(tx)
        );
        const materialTransactionCost = materialExpenseTransactions.reduce(
          (total, tx) => total + (tx.amount || 0),
          0
        );
        const directExpenses = projectTransactions
          .filter(
            (tx) =>
              isMoneyOut(tx) && !isWorkerPayment(tx) && !isMaterialExpense(tx)
          )
          .reduce((total, tx) => total + (tx.amount || 0), 0);
        const projectMaterials = safeMaterials.filter(
          (material) => material && material.projectId === project.id
        );
        const materialInventoryCost = projectMaterials.reduce(
          (total, material) => total + (materialUsedValue(material) || 0),
          0
        );
        const materialCost = Math.max(materialInventoryCost, materialTransactionCost);
        const transactionWorkerPayments = projectTransactions
          .filter((tx) => isMoneyOut(tx) && isWorkerPayment(tx))
          .reduce((total, tx) => total + (tx.amount || 0), 0);
        const workerPaymentTransactions = projectTransactions.filter(
          (tx) => isMoneyOut(tx) && isWorkerPayment(tx)
        );
        const ledgerWorkerPaymentRows = safeWorkers.flatMap((worker) => {
          if (!worker) return [];
          return (worker.entries || [])
            .filter(
              (entry) =>
                entry && entry.projectId === project.id && entry.direction === "Debit"
            )
            .map((entry) => ({
              id: `${worker.id}-${entry.id}`,
              workerName: worker.name,
              date: entry.date,
              amount: entry.amount,
              narration: entry.narration,
            }));
        });
        const ledgerWorkerPayments = safeWorkers.reduce(
          (total, worker) => {
            if (!worker) return total;
            return total +
            (worker.entries || [])
              .filter(
                (entry) =>
                  entry && entry.projectId === project.id && entry.direction === "Debit"
              )
              .reduce((entryTotal, entry) => entryTotal + (entry.amount || 0), 0);
          },
          0
        );
        const workerPayments = transactionWorkerPayments + ledgerWorkerPayments;
        const projectReminders = safeReminders.filter(
          (reminder) => reminder && reminder.projectId === project.id && !reminder.done
        );
        const projectReports = safeDailyReports.filter(
          (report) => report && report.projectId === project.id
        );
        const projectWorkers = safeWorkers.filter(
          (worker) => worker && worker.projectId === project.id
        );
        const projectExpenses = projectTransactions.filter(isMoneyOut);
        const otherTransactions = projectTransactions.filter(
          (tx) =>
            !isMoneyIn(tx) &&
            !isWorkerPayment(tx) &&
            !isMaterialExpense(tx)
        );
        const extraCharges = (project.extras || []).reduce(
          (total, extra) => total + extra.amount,
          0
        );
        const contractTotal = project.budget + extraCharges;
        const siteIncome = incomeReceived;
        const siteExpenses = directExpenses + workerPayments + materialCost;
        const profitLoss = siteIncome - siteExpenses;
        const remainingAmount = Math.max(contractTotal - incomeReceived, 0);
        const profitTone = profitLoss >= 0 ? "text-emerald-600" : "text-red-500";
        const extraDraft = extraDrafts[project.id] || newExtraDraft();
        const editingExtraId = editingExtraIds[project.id];
        const isExpanded = expandedSiteIds.includes(project.id);

        return (
          <div
            key={project.id}
            className="rounded-[28px] bg-white/80 p-5 shadow-xl dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusStyles[project.status]}`}
                >
                  {project.status}
                </p>
                <h3 className="mt-1 text-xl font-black">{project.name}</h3>
                {project.customer && (
                  <p className="mt-1 text-sm font-semibold text-neutral-500">
                    {project.customer}
                  </p>
                )}
              </div>
              {canManageSites && (
                <select
                  value={project.status}
                  onChange={(event) =>
                    onUpdate(project.id, {
                      status: event.target.value as ProjectSite["status"],
                    })
                  }
                  className="rounded-2xl border border-black/5 bg-black px-3 py-2 text-xs font-black text-white outline-none dark:bg-white dark:text-black"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                </select>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryCard label="Budget" value={rupee(project.budget)} />
              <SummaryCard
                label="Income Received"
                value={rupee(siteIncome)}
                tone="text-emerald-600"
              />
              <SummaryCard
                label="Expenses"
                value={rupee(siteExpenses)}
                tone="text-red-500"
              />
              <SummaryCard
                label="Profit / Loss"
                value={rupee(profitLoss)}
                tone={profitTone}
              />
              <SummaryCard
                label="Pending From Customer"
                value={rupee(remainingAmount)}
                tone={remainingAmount > 0 ? "text-amber-600" : "text-emerald-600"}
              />
              <SummaryCard
                label="Extra Work"
                value={rupee(extraCharges)}
                tone="text-emerald-600"
              />
              <SummaryCard
                label="Worker Pay"
                value={rupee(workerPayments)}
                tone="text-red-500"
              />
              <SummaryCard
                label="Materials"
                value={`${projectMaterials.length} • ${rupee(materialCost)}`}
              />
              <SummaryCard
                label="Reminders"
                value={projectReminders.length}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setExpandedSiteIds((current) =>
                  current.includes(project.id)
                    ? current.filter((id) => id !== project.id)
                    : [...current, project.id]
                )
              }
              className="mt-4 w-full rounded-2xl bg-black px-4 py-3 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
            >
              {isExpanded ? "Hide Site Details" : "Open Site Details"}
            </button>

            {isExpanded && (
              <>
            <div className="mt-4 grid gap-2 text-sm">
              <DetailSection title="Income Received" count={projectIncomeTransactions.length}>
                {projectIncomeTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{tx.title}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {tx.date} • {tx.category || "Income"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-emerald-600">
                      {rupee(tx.amount)}
                    </p>
                  </div>
                ))}
                {projectIncomeTransactions.length === 0 && (
                  <EmptyDetail label="No customer payments linked to this site yet." />
                )}
              </DetailSection>

              <DetailSection title="Work Logs" count={projectReports.length}>
                {projectReports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <p className="font-black">
                      {report.workerName} • {report.workerRole}
                    </p>
                    <p className="mt-1 text-xs font-bold text-neutral-500">
                      {report.date} • {report.status}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                      {report.workDescription}
                    </p>
                  </div>
                ))}
                {projectReports.length === 0 && (
                  <EmptyDetail label="No work logs for this site yet." />
                )}
              </DetailSection>

              <DetailSection
                title="Material Expenses"
                count={projectMaterials.length + materialExpenseTransactions.length}
              >
                {materialExpenseTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{tx.title}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {tx.date} • transaction
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-red-500">
                      {rupee(tx.amount)}
                    </p>
                  </div>
                ))}
                {projectMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{material.name}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {material.category || "Other"} • {material.supplier || "No supplier"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-black text-red-500">
                      {rupee(materialUsedValue(material))}
                    </p>
                  </div>
                ))}
                {projectMaterials.length === 0 && materialExpenseTransactions.length === 0 && (
                  <EmptyDetail label="No material expenses linked to this site." />
                )}
              </DetailSection>

              <DetailSection
                title="Worker Payments"
                count={workerPaymentTransactions.length + ledgerWorkerPaymentRows.length}
              >
                {workerPaymentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{tx.title}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {tx.date} • transaction
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-red-500">
                      {rupee(tx.amount)}
                    </p>
                  </div>
                ))}
                {ledgerWorkerPaymentRows.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{entry.workerName}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {entry.date} • {entry.narration || "Ledger payment"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-red-500">
                      {rupee(entry.amount)}
                    </p>
                  </div>
                ))}
                {workerPaymentTransactions.length === 0 &&
                  ledgerWorkerPaymentRows.length === 0 && (
                    <EmptyDetail label="No worker payments linked to this site." />
                  )}
              </DetailSection>

              <DetailSection title="Expenses" count={projectExpenses.length}>
                {projectExpenses.slice(0, 8).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{tx.title}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {tx.date} • {tx.category || "Other"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-red-500">
                      {rupee(tx.amount)}
                    </p>
                  </div>
                ))}
                {projectExpenses.length === 0 && (
                  <EmptyDetail label="No expenses linked to this site." />
                )}
              </DetailSection>

              <DetailSection title="Other Transactions" count={otherTransactions.length}>
                {otherTransactions.slice(0, 8).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{tx.title}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {tx.date} • {tx.category || "Other"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black">
                      {rupee(tx.amount)}
                    </p>
                  </div>
                ))}
                {otherTransactions.length === 0 && (
                  <EmptyDetail label="No other site-linked transactions." />
                )}
              </DetailSection>

              <DetailSection title="Reminders" count={projectReminders.length}>
                {projectReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <p className="font-black">{reminder.title}</p>
                    <p className="mt-1 text-xs font-bold text-neutral-500">
                      {reminder.dueDate}
                      {reminder.amount !== undefined ? ` • ${rupee(reminder.amount)}` : ""}
                    </p>
                  </div>
                ))}
                {projectReminders.length === 0 && (
                  <EmptyDetail label="No pending reminders for this site." />
                )}
              </DetailSection>

              <DetailSection title="Workers" count={projectWorkers.length}>
                {projectWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-3 dark:bg-black/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{worker.name}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {worker.workerSubRole || "Worker"} • {worker.status || "Active"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-black">
                      {worker.direction} {rupee(worker.amount)}
                    </p>
                  </div>
                ))}
                {projectWorkers.length === 0 && (
                  <EmptyDetail label="No workers assigned to this site." />
                )}
              </DetailSection>

              {project.extras && project.extras.length > 0 && (
                <DetailSection title="Extra Work" count={project.extras.length}>
                  {project.extras.map((extra) => (
                    <div
                      key={extra.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2 dark:bg-black/20"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black">{extra.title}</p>
                        <p className="text-xs font-bold text-neutral-500">
                          {extra.date} • {rupee(extra.amount)}
                        </p>
                      </div>
                      <div className="shrink-0 space-x-2">
                        {canManageSites && (
                          <>
                            <button
                              type="button"
                              onClick={() => editExtra(project.id, extra)}
                              className="text-xs font-black text-neutral-500"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExtra(project, extra.id)}
                              className="text-xs font-black text-red-500"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </DetailSection>
              )}
            </div>

            {canManageSites && (
            <div className="mt-4 grid gap-2 rounded-2xl bg-black/5 p-3 dark:bg-white/5">
              <p className="text-xs font-bold text-neutral-500">
                {editingExtraId ? "Edit extra work" : "Add extra work"}
              </p>
              <input
                value={extraDraft.title}
                onChange={(event) =>
                  setExtraDrafts((current) => ({
                    ...current,
                    [project.id]: {
                      ...(current[project.id] || newExtraDraft()),
                      title: event.target.value,
                    },
                  }))
                }
                placeholder="Extra work title"
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-black/40 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={extraDraft.amount}
                  onChange={(event) =>
                    setExtraDrafts((current) => ({
                      ...current,
                      [project.id]: {
                        ...(current[project.id] || newExtraDraft()),
                        amount: event.target.value,
                      },
                    }))
                  }
                  inputMode="decimal"
                  placeholder="Amount"
                  className="min-w-0 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-black/40 dark:text-white"
                />
                <input
                  type="date"
                  value={extraDraft.date}
                  onChange={(event) =>
                    setExtraDrafts((current) => ({
                      ...current,
                      [project.id]: {
                        ...(current[project.id] || newExtraDraft()),
                        date: event.target.value,
                      },
                    }))
                  }
                  className="min-w-0 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold text-black outline-none dark:border-white/10 dark:bg-black/40 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => submitExtra(project)}
                className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-black"
              >
                {editingExtraId ? "Update Extra Work" : "Save Extra Work"}
              </button>
            </div>
            )}

            {canManageSites && (
              <button
                type="button"
                onClick={() => onDelete(project.id)}
                className="mt-4 rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-500"
              >
                Delete Site
              </button>
            )}
              </>
            )}
          </div>
        );
      })}

      {safeProjects.length === 0 && (
        <div className="rounded-3xl bg-white/80 p-6 text-center text-sm font-bold text-neutral-500 shadow dark:bg-white/5">
          No sites yet. Add your first construction site.
        </div>
      )}
    </div>
  );
}
