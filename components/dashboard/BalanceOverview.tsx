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
        monthIncome={monthIncome}
        monthSpent={monthSpent}
        onClick={onBalance}
      />

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

      <div className="glass-panel flex items-center justify-between rounded-xl px-4 py-2 border border-white/10">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 active:scale-95 text-neutral-500 hover:text-white transition"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Statement Period</p>
          <p className="font-semibold text-sm text-neutral-950">{selectedMonthLabel}</p>
        </div>
        <button
          type="button"
          disabled={!canShowNextMonth}
          onClick={onNextMonth}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 active:scale-95 text-neutral-500 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </>
  );
}
