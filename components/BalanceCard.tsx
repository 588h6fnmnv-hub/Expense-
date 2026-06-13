"use client";

import type { ThemeMode } from "@/lib/types";

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

type BalanceCardProps = {
  emoji: string;
  balance: number;
  spent: number;
  saved: number;
  monthIncome?: number;
  monthSpent?: number;
  theme?: ThemeMode;
  onClick: () => void;
};

export default function BalanceCard({
  emoji,
  balance,
  monthIncome = 0,
  monthSpent = 0,
  theme = "dark",
  onClick,
}: BalanceCardProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-label={`Operating balance ${rupee(balance)}`}
      className="w-full group text-left rounded-[24px] overflow-hidden bg-gradient-to-br from-white/10 to-transparent p-px transition duration-300 active:scale-[0.985] shadow-2xl relative select-none"
    >
      <div
        className={`w-full rounded-[23px] p-4 md:p-card-padding flex flex-col justify-between relative overflow-hidden min-h-[140px] md:min-h-[180px] transition-all duration-300 ${
          theme === "dark"
            ? "bg-surface-charcoal text-white"
            : "bg-white text-black border border-black/5"
        }`}
      >
        {/* Top row: label + small icon */}
        <div className="z-10 flex items-center justify-between w-full">
          <div className="min-w-0 pr-3">
            <p className="font-label-sm text-xs text-neutral-500 uppercase tracking-widest mb-0.5 truncate">
              {emoji} Operating Balance
            </p>
            <h3 className="font-display-lg text-2xl md:text-[40px] font-extrabold tracking-tighter text-neutral-950 truncate">
              {rupee(balance)}
            </h3>
          </div>
          <span className="material-symbols-outlined text-neutral-950 text-2xl leading-none flex-shrink-0 ml-2">
            account_balance_wallet
          </span>
        </div>

        {/* Bottom row: Income / Expenses compact */}
        <div className="z-10 grid grid-cols-2 gap-3 pt-3 border-t border-white/10 mt-3 w-full min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] leading-none text-success-green">arrow_upward</span>
            </div>
            <div className="min-w-0">
              <p className="font-label-sm text-[10px] text-neutral-500 uppercase tracking-wider mb-0 truncate">Income (MTD)</p>
              <p className="font-title-md text-sm font-bold truncate text-success-green">{rupee(monthIncome)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="font-label-sm text-[10px] text-neutral-500 uppercase tracking-wider mb-0 truncate">Expenses (MTD)</p>
              <p className="font-title-md text-sm font-bold truncate text-danger-red">{rupee(monthSpent)}</p>
            </div>
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] leading-none text-danger-red">arrow_downward</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
