"use client";

import BalanceCard from "@/components/BalanceCard";
import RowButton from "@/components/RowButton";
import type { TransactionType } from "@/lib/types";

type BalanceOverviewProps = {
  emoji: string;
  balance: number;
  spent: number;
  saved: number;
  monthIncome: number;
  monthSpent: number;
  selectedMonthLabel: string;
  canShowNextMonth: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onQuickAction: (nextForm: TransactionType | "Balance" | "Transfer") => void;
  onBalance: () => void;
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

export default function BalanceOverview({
  emoji,
  balance,
  spent,
  saved,
  monthIncome,
  monthSpent,
  selectedMonthLabel,
  canShowNextMonth,
  onPreviousMonth,
  onNextMonth,
  onQuickAction,
  onBalance,
}: BalanceOverviewProps) {
  return (
    <>
      <BalanceCard
        emoji={emoji}
        balance={balance}
        spent={spent}
        saved={saved}
        onClick={onBalance}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="liquid-surface rounded-[22px] p-3">
          <p className="text-[11px] font-bold text-neutral-500">Income</p>
          <p className="mt-1 truncate text-sm font-black text-emerald-600">
            {rupee(monthIncome)}
          </p>
        </div>
        <div className="liquid-surface rounded-[22px] p-3">
          <p className="text-[11px] font-bold text-neutral-500">Expense</p>
          <p className="mt-1 truncate text-sm font-black text-red-500">
            {rupee(monthSpent)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <RowButton
          title="Income"
          color="green"
          onClick={() => onQuickAction("Income")}
        />
        <RowButton
          title="Expense"
          color="red"
          onClick={() => onQuickAction("Expense")}
        />
        <RowButton
          title="Transfer"
          color="blue"
          onClick={() => onQuickAction("Transfer")}
        />
      </div>

      <div className="liquid-surface flex items-center justify-between rounded-[24px] p-3">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="rounded-2xl px-3 py-2 font-black"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-xs font-bold text-neutral-500">Month</p>
          <p className="font-black">{selectedMonthLabel}</p>
        </div>
        <button
          type="button"
          disabled={!canShowNextMonth}
          onClick={onNextMonth}
          className="rounded-2xl px-3 py-2 font-black disabled:opacity-30"
        >
          →
        </button>
      </div>
    </>
  );
}
