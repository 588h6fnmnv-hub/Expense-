"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useMemo, useState, type ReactNode } from "react";
import {
  EXPENSE_ANALYTICS_CATEGORIES,
  normalizeExpenseAnalyticsCategory,
} from "@/lib/construction";
import PayablesView from "@/components/payables/PayablesView";
import type {
  CompanyProfile,
  ExpenseAnalyticsCategory,
  MaterialItem,
  PersonAccount,
  PersonAccountEntry,
  ProjectSite,
  Transaction,
} from "@/lib/types";

type ReportAccount = {
  id: string;
  label: string;
  icon: string;
  amount: number;
  transactions: Transaction[];
};

type ReportsViewProps = {
  selectedMonthLabel: string;
  selectedMonthKey: string;
  canShowNextMonth: boolean;
  accounts: ReportAccount[];
  reportTransactions: Transaction[];
  totalBalance: number;
  projects: ProjectSite[];
  materials: MaterialItem[];
  workers: PersonAccount[];
  company: CompanyProfile | null;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const csvValue = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadTextFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const isMoneyIn = (tx: Transaction) =>
  tx.type === "Income" || tx.type === "Pay In";

const isMoneyOut = (tx: Transaction) =>
  tx.type === "Expense" || tx.type === "Pay Out";

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

const materialValue = (material: MaterialItem) =>
  Math.max(0, material.quantity - (material.usedQuantity || 0)) * material.rate;

export default function ReportsView({
  selectedMonthLabel,
  selectedMonthKey,
  canShowNextMonth,
  accounts,
  reportTransactions,
  totalBalance,
  projects,
  materials,
  workers,
  company,
  onPreviousMonth,
  onNextMonth,
}: ReportsViewProps) {
  const [analyticsSiteFilter, setAnalyticsSiteFilter] = useState("All");
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState<
    ExpenseAnalyticsCategory | "All"
  >("All");
  const safeReportTransactions = useMemo(() => reportTransactions || [], [reportTransactions]);
  const safeProjects = useMemo(() => projects || [], [projects]);
  const safeMaterials = useMemo(() => materials || [], [materials]);
  const safeWorkers = useMemo(() => workers || [], [workers]);

  const monthlyIncome = safeReportTransactions
    .filter(isMoneyIn)
    .reduce((total, tx) => total + (tx.amount || 0), 0);
  const monthlyExpense = safeReportTransactions
    .filter(isMoneyOut)
    .reduce((total, tx) => total + (tx.amount || 0), 0);
  const netTotal = monthlyIncome - monthlyExpense;
  const materialInventoryValue = safeMaterials.reduce(
    (total, material) => total + (materialValue(material) || 0),
    0
  );
  const categoryAnalytics = useMemo(() => {
    const expenseTransactions = safeReportTransactions.filter(isMoneyOut);
    const filteredExpenses = expenseTransactions.filter((tx) => {
      if (!tx) return false;
      const category = normalizeExpenseAnalyticsCategory(tx.category);
      const matchesSite =
        analyticsSiteFilter === "All" || tx.projectId === analyticsSiteFilter;
      const matchesCategory =
        analyticsCategoryFilter === "All" || category === analyticsCategoryFilter;

      return matchesSite && matchesCategory;
    });
    const total = filteredExpenses.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const rows = EXPENSE_ANALYTICS_CATEGORIES.map((category) => {
      const transactions = filteredExpenses.filter(
        (tx) => normalizeExpenseAnalyticsCategory(tx.category) === category
      );
      const amount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        category,
        amount,
        count: transactions.length,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      };
    }).filter((row) => row.amount > 0 || analyticsCategoryFilter === row.category);
    const top = [...rows].sort((left, right) => right.amount - left.amount)[0] || null;

    return {
      total,
      rows: rows.sort((left, right) => right.amount - left.amount),
      top,
      recent: filteredExpenses
        .slice()
        .sort((left, right) => `${right.date} ${right.time || ""}`.localeCompare(`${left.date} ${left.time || ""}`))
        .slice(0, 8),
    };
  }, [analyticsCategoryFilter, analyticsSiteFilter, safeReportTransactions]);
  const siteReports = safeProjects.map((project) => {
    if (!project) return null;
    const siteTransactions = safeReportTransactions.filter(
      (tx) => tx && tx.projectId === project.id
    );
    const income = siteTransactions
      .filter(isMoneyIn)
      .reduce((total, tx) => total + (tx.amount || 0), 0);
    const expense = siteTransactions
      .filter(isMoneyOut)
      .reduce((total, tx) => total + (tx.amount || 0), 0);
    const extras = (project.extras || []).reduce(
      (total, extra) => total + (extra?.amount || 0),
      0
    );
    const siteMaterials = safeMaterials.filter(
      (material) => material && material.projectId === project.id
    );
    const workerPaid = safeWorkers.reduce(
      (total, worker) => {
        if (!worker) return total;
        return total +
        (worker.entries || [])
          .filter(
            (entry) =>
              entry &&
              entry.projectId === project.id &&
              entry.direction === "Debit" &&
              entry.date.startsWith(selectedMonthKey)
          )
          .reduce((entryTotal, entry) => entryTotal + (entry.amount || 0), 0);
      },
      0
    );

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      budget: project.budget,
      income: income + extras,
      expense,
      profit: income + extras - expense,
      materials: siteMaterials.length,
      materialValue: siteMaterials.reduce(
        (total, material) => total + materialValue(material),
        0
      ),
      workerPaid,
    };
  });
  const workerReports = safeWorkers.map((worker) => {
    if (!worker) return null;
    const entries = (worker.entries || []).filter((entry) =>
      entry && entry.date.startsWith(selectedMonthKey)
    );
    const paid = entries
      .filter((entry) => entry && entry.direction === "Debit")
      .reduce((total, entry) => total + (entry.amount || 0), 0);
    const due = entries
      .filter((entry) => entry && entry.direction === "Credit")
      .reduce((total, entry) => total + (entry.amount || 0), 0);
    const balance = workerBalance(worker);

    return {
      id: worker.id,
      name: worker.name,
      paid,
      due,
      balance,
      rows: entries.length,
    };
  });
  const accountReports = (accounts || []).map((account) => {
    if (!account) return null;
    const income = (account.transactions || [])
      .filter(isMoneyIn)
      .reduce((total, tx) => total + (tx?.amount || 0), 0);
    const expense = (account.transactions || [])
      .filter(isMoneyOut)
      .reduce((total, tx) => total + (tx?.amount || 0), 0);

    return {
      ...account,
      income,
      expense,
      net: income - expense,
    };
  });
  const exportName = `${company?.name || "ledge"}-${selectedMonthKey}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const exportPdf = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`${company?.name || "Business"} Report`, 14, 16);
    doc.setFontSize(10);
    doc.text(selectedMonthLabel, 14, 24);

    autoTable(doc, {
      startY: 32,
      head: [["Monthly Summary", "Amount"]],
      body: [
        ["Income", rupee(monthlyIncome)],
        ["Expense", rupee(monthlyExpense)],
        ["Net", rupee(netTotal)],
        ["Account Balance", rupee(totalBalance)],
        ["Material Value", rupee(materialInventoryValue)],
      ],
    });

    autoTable(doc, {
      head: [["Site", "Budget", "Income", "Expense", "P/L", "Worker Pay"]],
      body: siteReports.filter((s): s is NonNullable<typeof s> => !!s).map((site) => [
        site.name,
        rupee(site.budget),
        rupee(site.income),
        rupee(site.expense),
        rupee(site.profit),
        rupee(site.workerPaid),
      ]),
    });

    autoTable(doc, {
      head: [["Worker", "Paid", "Due/Adj", "Balance", "Rows"]],
      body: workerReports.filter((w): w is NonNullable<typeof w> => !!w).map((worker) => [
        worker.name,
        rupee(worker.paid),
        rupee(worker.due),
        rupee(worker.balance),
        String(worker.rows),
      ]),
    });

    autoTable(doc, {
      head: [["Account", "Income", "Expense", "Net", "Balance"]],
      body: accountReports.filter((a): a is NonNullable<typeof a> => !!a).map((account) => [
        account.label,
        rupee(account.income),
        rupee(account.expense),
        rupee(account.net),
        rupee(account.amount),
      ]),
    });

    doc.save(`${exportName}-report.pdf`);
  };
  const exportCsv = () => {
    const rows = [
      ["Section", "Name", "Metric 1", "Metric 2", "Metric 3", "Metric 4"],
      ["Monthly", "Income", monthlyIncome, "Expense", monthlyExpense, netTotal],
      ...siteReports.filter((s): s is NonNullable<typeof s> => !!s).map((site) => [
        "Site",
        site.name,
        site.income,
        site.expense,
        site.profit,
        site.workerPaid,
      ]),
      ...workerReports.filter((w): w is NonNullable<typeof w> => !!w).map((worker) => [
        "Worker",
        worker.name,
        worker.paid,
        worker.due,
        worker.balance,
        worker.rows,
      ]),
      ...accountReports.filter((a): a is NonNullable<typeof a> => !!a).map((account) => [
        "Account",
        account.label,
        account.income,
        account.expense,
        account.net,
        account.amount,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");

    downloadTextFile(`${exportName}-report.csv`, csv, "text/csv;charset=utf-8");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-white/80 p-5 text-neutral-950 shadow-xl dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Reports
        </p>
        <h2 className="mt-2 text-2xl font-black">
          {company?.name || "Business"}
        </h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          {selectedMonthLabel} summary
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black active:scale-[0.98]"
          >
            Export CSV
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onPreviousMonth}
            className="rounded-2xl bg-white px-4 py-2 font-black text-black"
          >
            ←
          </button>
          <p className="font-black">{rupee(totalBalance)}</p>
          <button
            type="button"
            disabled={!canShowNextMonth}
            onClick={onNextMonth}
            className="rounded-2xl bg-white px-4 py-2 font-black text-black disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Income</p>
          <p className="mt-1 text-2xl font-black">
            {rupee(monthlyIncome)}
          </p>
        </div>
        <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Expense</p>
          <p className="mt-1 text-2xl font-black text-red-500">
            {rupee(monthlyExpense)}
          </p>
        </div>
        <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Net</p>
          <p
            className={`mt-1 text-2xl font-black ${
              netTotal >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {rupee(netTotal)}
          </p>
        </div>
        <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Transactions</p>
          <p className="mt-1 text-2xl font-black">
            {safeReportTransactions.length}
          </p>
        </div>
      </div>

      <ExpenseAnalyticsSection
        projects={safeProjects}
        siteFilter={analyticsSiteFilter}
        categoryFilter={analyticsCategoryFilter}
        total={categoryAnalytics.total}
        rows={categoryAnalytics.rows}
        topCategory={categoryAnalytics.top}
        recentTransactions={categoryAnalytics.recent}
        onSiteFilterChange={setAnalyticsSiteFilter}
        onCategoryFilterChange={setAnalyticsCategoryFilter}
      />

      <PayablesView
        workers={safeWorkers}
        materials={safeMaterials}
        projects={safeProjects}
      />

      <ReportSection title="Site-wise report">
        {siteReports.filter((s): s is NonNullable<typeof s> => !!s).map((site) => (
          <ReportCard
            key={site.id}
            title={site.name}
            helper={`${site.status} • ${site.materials} material item(s)`}
            rows={[
              ["Budget", rupee(site.budget)],
              ["Income", rupee(site.income)],
              ["Expenses", rupee(site.expense)],
              ["Profit / Loss", rupee(site.profit)],
              ["Worker Pay", rupee(site.workerPaid)],
              ["Material Value", rupee(site.materialValue)],
            ]}
          />
        ))}
        {siteReports.length === 0 && <EmptyReport label="No site reports yet." />}
      </ReportSection>

      <ReportSection title="Worker-wise report">
        {workerReports.filter((w): w is NonNullable<typeof w> => !!w).map((worker) => (
          <ReportCard
            key={worker.id}
            title={worker.name}
            helper={`${worker.rows} ledger row(s) this month`}
            rows={[
              ["Paid / Advance", rupee(worker.paid)],
              ["Due / Adjustment", rupee(worker.due)],
              ["Current Balance", rupee(worker.balance)],
            ]}
          />
        ))}
        {workerReports.length === 0 && <EmptyReport label="No worker reports yet." />}
      </ReportSection>

      <ReportSection title="Account-wise report">
        {accountReports.filter((a): a is NonNullable<typeof a> => !!a).map((account) => (
          <ReportCard
            key={account.id}
            title={`${account.icon} ${account.label}`}
            helper={`${account.transactions.length} transaction(s)`}
            rows={[
              ["Income", rupee(account.income)],
              ["Expense", rupee(account.expense)],
              ["Net", rupee(account.net)],
              ["Balance", rupee(account.amount)],
            ]}
          />
        ))}
      </ReportSection>

    </div>
  );
}

function ExpenseAnalyticsSection({
  projects,
  siteFilter,
  categoryFilter,
  total,
  rows,
  topCategory,
  recentTransactions,
  onSiteFilterChange,
  onCategoryFilterChange,
}: {
  projects: ProjectSite[];
  siteFilter: string;
  categoryFilter: ExpenseAnalyticsCategory | "All";
  total: number;
  rows: Array<{
    category: ExpenseAnalyticsCategory;
    amount: number;
    count: number;
    percentage: number;
  }>;
  topCategory: {
    category: ExpenseAnalyticsCategory;
    amount: number;
    count: number;
    percentage: number;
  } | null;
  recentTransactions: Transaction[];
  onSiteFilterChange: (siteId: string) => void;
  onCategoryFilterChange: (category: ExpenseAnalyticsCategory | "All") => void;
}) {
  return (
    <ReportSection title="Expense category analytics">
      <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={siteFilter}
            onChange={(event) => onSiteFilterChange(event.target.value)}
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
          >
            <option value="All">All sites</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) =>
              onCategoryFilterChange(event.target.value as ExpenseAnalyticsCategory | "All")
            }
            className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
          >
            <option value="All">All categories</option>
            {EXPENSE_ANALYTICS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <p className="text-xs font-bold text-neutral-500">Total spent</p>
            <p className="mt-1 text-lg font-black text-red-500">{rupee(total)}</p>
          </div>
          <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <p className="text-xs font-bold text-neutral-500">Top category</p>
            <p className="mt-1 truncate text-lg font-black">
              {topCategory ? topCategory.category : "None"}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.category} className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{row.category}</p>
                  <p className="text-xs font-bold text-neutral-500">
                    {row.count} transaction{row.count === 1 ? "" : "s"} ·{" "}
                    {row.percentage.toFixed(1)}%
                  </p>
                </div>
                <p className="shrink-0 text-sm font-black">{rupee(row.amount)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, row.percentage)}%` }}
                />
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <EmptyReport label="No expense category data for this filter." />
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm font-black">Recent matching transactions</p>
          <div className="mt-2 space-y-2">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{tx.title}</p>
                  <p className="truncate text-xs font-bold text-neutral-500">
                    {tx.date} · {normalizeExpenseAnalyticsCategory(tx.category)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-black text-red-500">
                  {rupee(tx.amount)}
                </p>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
                No recent transactions match this category filter.
              </p>
            )}
          </div>
        </div>
      </div>
    </ReportSection>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-black uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReportCard({
  title,
  helper,
  rows,
}: {
  title: string;
  helper: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black">{title}</p>
          <p className="mt-1 truncate text-xs font-semibold text-neutral-500">
            {helper}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <p className="text-xs font-bold text-neutral-500">{label}</p>
            <p className="mt-1 truncate text-sm font-black">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyReport({ label }: { label: string }) {
  return (
    <div className="rounded-3xl bg-white/80 p-6 text-center text-sm font-bold text-neutral-700 shadow dark:bg-white/5">
      {label}
    </div>
  );
}
