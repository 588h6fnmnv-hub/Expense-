"use client";

import React, { useState } from "react";
import type { ThemeMode } from "@/lib/types";

type FinancialReportsProps = {
  theme: ThemeMode;
};

export default function FinancialReports({ theme }: FinancialReportsProps) {
  const [activeReport, setActiveTab] = useState<"P&L" | "Balance Sheet" | "Cash Flow" | "Trial Balance">("P&L");

  return (
    <div className="space-y-6">
      <div className={`flex overflow-x-auto p-1 rounded-2xl no-scrollbar ${
        theme === "dark" ? "bg-white/5" : "bg-black/5"
      }`}>
        {["P&L", "Balance Sheet", "Cash Flow", "Trial Balance"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as "P&L" | "Balance Sheet" | "Cash Flow" | "Trial Balance")}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold transition-all whitespace-nowrap px-4 ${
              activeReport === tab
                ? theme === "dark" ? "bg-primary text-background shadow-lg" : "bg-white text-black shadow-md"
                : "text-apple-silver hover:opacity-80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={`p-6 rounded-[2.5rem] border ${
        theme === "dark" ? "bg-neutral-900/50 border-white/10" : "bg-white border-black/5 shadow-sm"
      }`}>
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black">{activeReport}</h2>
          <div className="text-sm opacity-50 font-bold">This Month</div>
        </div>

        {/* Placeholder for report data */}
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="font-bold opacity-60">Total Income</span>
            <span className="font-black text-emerald-500">₹0</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="font-bold opacity-60">Total Expenses</span>
            <span className="font-black text-danger-red">₹0</span>
          </div>
          <div className="flex justify-between items-center pt-4">
            <span className="text-xl font-black">Net Profit</span>
            <span className="text-2xl font-black text-primary">₹0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
