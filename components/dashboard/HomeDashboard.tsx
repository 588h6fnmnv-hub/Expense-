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
  const pendingReminders = reminders.filter((reminder) => !reminder.done);

  return (
    <div className="space-y-5">
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

      {pendingReminders.length > 0 && (
        <div className="rounded-[24px] bg-blue-100 p-4 text-blue-900">
          <p className="font-black">Pending reminders</p>
          <p className="mt-1 text-sm font-semibold">
            {pendingReminders.length} task(s) pending.
          </p>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {kpis.map((item) => (
            <div key={item.label} className="liquid-surface rounded-[22px] p-3">
              <p className="text-[11px] font-bold text-neutral-500">{item.label}</p>
              <p className={`mt-1 truncate text-sm font-black ${item.tone || ""}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
              Transactions
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              {company?.name || "Business"} activity
            </h2>
          </div>
          <p className="text-xs font-bold text-neutral-500">
            {transactions.length} item{transactions.length === 1 ? "" : "s"}
          </p>
        </div>

        {transactions.slice(0, 10).map((tx) => (
          <TransactionCard
            key={tx.id}
            tx={tx}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ))}
        {transactions.length === 0 && (
          <div className="liquid-surface rounded-[26px] p-6 text-center text-sm font-bold text-neutral-500">
            No transactions yet. Add your first construction business entry.
          </div>
        )}
      </div>
    </div>
  );
}
