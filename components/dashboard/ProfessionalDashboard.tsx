"use client";

type ProfessionalDashboardProps = {
  companyName?: string;
  totalBalance?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  totalWorkers?: number;
  totalProjects?: number;
  totalMaterials?: number;
};

const formatMoney = (amount = 0) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

export default function ProfessionalDashboard({
  companyName = "Ledge",
  totalBalance = 0,
  monthlyIncome = 0,
  monthlyExpense = 0,
  totalWorkers = 0,
  totalProjects = 0,
  totalMaterials = 0,
}: ProfessionalDashboardProps) {
  const profit = monthlyIncome - monthlyExpense;

  return (
    <section className="space-y-5">
      <div className="rounded-[32px] border border-black/5 bg-white/80 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500">
              Construction SaaS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {companyName}
            </h1>

            <p className="mt-2 max-w-xl text-sm font-medium text-neutral-500">
              Professional construction business management dashboard with
              worker tracking, project management, expenses, materials, and
              business analytics.
            </p>
          </div>

          <div className="rounded-3xl bg-emerald-500 p-5 text-black shadow-xl">
            <p className="text-xs font-black uppercase tracking-widest">
              Total Balance
            </p>

            <p className="mt-2 text-3xl font-black">
              {formatMoney(totalBalance)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-3xl bg-slate-100 p-5 dark:bg-white/5">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
              Monthly Income
            </p>

            <p className="mt-3 text-2xl font-black text-emerald-500">
              {formatMoney(monthlyIncome)}
            </p>
          </div>

          <div className="rounded-3xl bg-slate-100 p-5 dark:bg-white/5">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
              Monthly Expense
            </p>

            <p className="mt-3 text-2xl font-black text-red-500">
              {formatMoney(monthlyExpense)}
            </p>
          </div>

          <div className="rounded-3xl bg-slate-100 p-5 dark:bg-white/5">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-500">
              Profit
            </p>

            <p className="mt-3 text-2xl font-black text-cyan-500">
              {formatMoney(profit)}
            </p>
          </div>

          <div className="rounded-3xl bg-black p-5 text-white dark:bg-white dark:text-black">
            <p className="text-xs font-black uppercase tracking-wider opacity-70">
              Projects
            </p>

            <p className="mt-3 text-2xl font-black">{totalProjects}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            Workers
          </p>

          <p className="mt-3 text-4xl font-black">{totalWorkers}</p>

          <p className="mt-2 text-sm font-medium text-neutral-500">
            Active workers currently managed inside the system.
          </p>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            Materials
          </p>

          <p className="mt-3 text-4xl font-black">{totalMaterials}</p>

          <p className="mt-2 text-sm font-medium text-neutral-500">
            Material inventory and supplier management records.
          </p>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
            Business Status
          </p>

          <p className="mt-3 text-2xl font-black text-emerald-500">
            Operational
          </p>

          <p className="mt-2 text-sm font-medium text-neutral-500">
            System running normally with cloud-ready SaaS structure.
          </p>
        </div>
      </div>
    </section>
  );
}