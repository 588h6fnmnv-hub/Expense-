"use client";

type HomeOverviewProps = {
  title?: string;
  subtitle?: string;
  balance?: number;
  projectsCount?: number;
  workersCount?: number;
  materialsCount?: number;
  income?: number;
  expense?: number;
};

const money = (amount = 0) => `₹${Math.round(amount).toLocaleString("en-IN")}`;

export default function HomeOverview({
  title = "Ledge",
  subtitle = "Construction Business Management",
  balance = 0,
  projectsCount = 0,
  workersCount = 0,
  materialsCount = 0,
  income = 0,
  expense = 0,
}: HomeOverviewProps) {
  const profit = income - expense;

  return (
    <div className="rounded-[30px] border border-black/5 bg-white/85 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
        Pro SaaS Dashboard
      </p>

      <h2 className="mt-2 text-2xl font-black tracking-tight">{title}</h2>

      <p className="mt-1 text-sm font-semibold text-neutral-500">{subtitle}</p>

      <div className="mt-5 rounded-2xl bg-emerald-500 p-4 text-black">
        <p className="text-xs font-black uppercase tracking-wider">Balance</p>
        <p className="mt-1 text-2xl font-black">{money(balance)}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Projects</p>
          <p className="mt-2 text-2xl font-black">{projectsCount}</p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Workers</p>
          <p className="mt-2 text-2xl font-black">{workersCount}</p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
          <p className="text-xs font-bold text-neutral-500">Materials</p>
          <p className="mt-2 text-2xl font-black">{materialsCount}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-emerald-500/15 p-4">
          <p className="text-xs font-bold text-neutral-500">Income</p>
          <p className="mt-2 text-lg font-black text-emerald-500">
            {money(income)}
          </p>
        </div>

        <div className="rounded-2xl bg-red-500/10 p-4">
          <p className="text-xs font-bold text-neutral-500">Expense</p>
          <p className="mt-2 text-lg font-black text-red-500">
            {money(expense)}
          </p>
        </div>

        <div className="rounded-2xl bg-black p-4 text-white dark:bg-white dark:text-black">
          <p className="text-xs font-bold opacity-70">Profit</p>
          <p className="mt-2 text-lg font-black">{money(profit)}</p>
        </div>
      </div>
    </div>
  );
}