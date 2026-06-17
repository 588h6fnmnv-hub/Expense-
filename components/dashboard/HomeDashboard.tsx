"use client";

import BalanceOverview from "@/components/dashboard/BalanceOverview";
import TransactionCard from "@/components/TransactionCard";
import type {
  CompanyProfile,
  ReminderItem,
  Transaction,
  TransactionType,
} from "@/lib/types";

type FormPreset = {
  category?: string;
  name?: string;
  projectId?: string;
};

export type HomeDashboardProps = {
  emoji: string;
  company: CompanyProfile | null;
  balance: number;
  spent: number;
  saved: number;
  transactions: Transaction[];
  selectedMonthLabel: string;
  canShowNextMonth: boolean;
  monthIncome: number;
  monthSpent: number;
  reminders: ReminderItem[];
  kpis?: Array<{ label: string; value: string; tone?: string }>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onQuickAction: (
    nextForm: TransactionType | "Balance" | "Transfer",
    preset?: FormPreset
  ) => void;
  onBalance: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Transaction>) => void;
};

const iconForKpi = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes("pending")) return "pending_actions";
  if (lower.includes("payable") || lower.includes("due")) return "engineering";
  if (lower.includes("stock") || lower.includes("inventory")) return "inventory_2";
  if (lower.includes("profit") || lower.includes("margin") || lower.includes("p&l")) return "trending_up";
  return "monitoring";
};

const colorForKpi = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes("pending")) return "text-apple-gold";
  if (lower.includes("payable") || lower.includes("due")) return "text-secondary-fixed-dim";
  if (lower.includes("stock") || lower.includes("inventory")) return "text-tertiary-fixed-dim";
  if (lower.includes("profit") || lower.includes("margin") || lower.includes("p&l")) return "text-success-green";
  return "text-neutral-500";
};

export default function HomeDashboard({
  emoji,
  company,
  balance,
  spent,
  saved,
  transactions,
  selectedMonthLabel,
  canShowNextMonth,
  monthIncome,
  monthSpent,
  reminders,
  kpis = [],
  onPreviousMonth,
  onNextMonth,
  onQuickAction,
  onBalance,
  onDelete,
  onUpdate,
}: HomeDashboardProps) {
  const pendingReminders = (reminders || []).filter((reminder) => reminder && !reminder.done);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <BalanceOverview
        emoji={emoji}
        balance={balance}
        spent={spent}
        saved={saved}
        monthIncome={monthIncome}
        monthSpent={monthSpent}
        selectedMonthLabel={selectedMonthLabel}
        canShowNextMonth={canShowNextMonth}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onQuickAction={onQuickAction}
        onBalance={onBalance}
      />

      {/* KPI Bento Grid */}
      {kpis.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((item) => (
            <div
              key={item.label}
              className="bg-surface-charcoal border border-white/10 rounded-xl p-4 transition-all duration-200 hover:border-white/20 active:scale-95 cursor-pointer flex flex-col justify-between min-h-[100px]"
            >
              <span
                className={`material-symbols-outlined text-xl ${colorForKpi(
                  item.label
                )}`}
              >
                {iconForKpi(item.label)}
              </span>
              <div className="mt-2">
                <p className="font-label-sm text-[11px] text-neutral-500 tracking-wide uppercase">
                  {item.label}
                </p>
                <h4 className="font-title-md text-base md:text-lg font-bold text-neutral-950 mt-0.5 truncate">
                  {item.value}
                </h4>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Critical Alerts / Pending Reminders Slider */}
      {pendingReminders.length > 0 && (
        <section className="space-y-3">
          <div className="flex justify-between items-end px-1">
            <h3 className="font-title-md text-sm md:text-base font-semibold text-neutral-950">
              Critical Alerts
            </h3>
            <span className="font-label-sm text-[10px] text-neutral-500 uppercase tracking-wider">
              {pendingReminders.length} pending
            </span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-margin-mobile px-margin-mobile no-scrollbar scroll-smooth">
            {pendingReminders.map((reminder) => {
              // Highlight alerts that have amounts or are overdue
              const hasHighRisk = reminder.amount && reminder.amount > 50000;
              const borderClass = hasHighRisk
                ? "border-danger-red/30 hover:border-danger-red/50"
                : "border-warning-amber/30 hover:border-warning-amber/50";
              const iconClass = hasHighRisk ? "text-danger-red" : "text-warning-amber";
              const bgIconClass = hasHighRisk ? "bg-danger-red/10" : "bg-warning-amber/10";

              return (
                <div
                  key={reminder.id}
                  className={`min-w-[260px] max-w-[280px] bg-surface-charcoal border rounded-2xl p-4 flex gap-4 items-center shrink-0 transition ${borderClass}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgIconClass}`}>
                    <span className={`material-symbols-outlined text-lg leading-none ${iconClass}`}>
                      {reminder.type === "material_reorder" ? "precision_manufacturing" : "warning"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-body-md font-semibold text-sm text-neutral-950 truncate">
                      {reminder.title}
                    </h5>
                    <p className="font-label-sm text-[11px] text-neutral-500 truncate mt-0.5">
                      Due: {reminder.dueDate}
                      {reminder.amount ? ` • ₹${reminder.amount.toLocaleString("en-IN")}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Transactions List */}
      <div className="space-y-4">
        <div className="flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-success-green">
              Transactions
            </p>
            <h2 className="mt-1 text-lg md:text-xl font-bold tracking-tight text-neutral-950">
              {company?.name || "Business"} activity
            </h2>
          </div>
          <p className="text-xs font-semibold text-neutral-500">
            {transactions.length} items
          </p>
        </div>

        <div className="bg-surface-charcoal border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {(transactions || []).slice(0, 10).map((tx) => (
            tx && <TransactionCard
              key={tx.id}
              tx={tx}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
          {(transactions || []).length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-neutral-500">
              No transactions yet. Add your first construction business entry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
