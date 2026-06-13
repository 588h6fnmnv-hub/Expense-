"use client";

import React from "react";
import type { PayrollRun, ThemeMode } from "@/lib/types";

type PayrollSummaryProps = {
  payrollRuns: PayrollRun[];
  theme: ThemeMode;
};

export default function PayrollSummary({ payrollRuns, theme }: PayrollSummaryProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold px-2">Payroll Summary</h2>
      <div className="space-y-3">
        {payrollRuns.length > 0 ? (
          payrollRuns.map((run) => (
            <div
              key={run.id}
              className={`p-5 rounded-[2rem] border ${
                theme === "dark" ? "bg-neutral-900/50 border-white/10" : "bg-white border-black/5 shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold">Worker ID: {run.workerId}</h3>
                  <p className="text-sm opacity-50">{run.periodStart} to {run.periodEnd}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold opacity-40 uppercase">Net Pay</p>
                  <p className="text-xl font-black text-primary">₹{run.netPay.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                  run.status === "Paid" ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"
                }`}>
                  {run.status}
                </span>
                <button className="text-primary font-bold">View Payslip</button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-8 opacity-40">No payroll runs found</p>
        )}
      </div>
    </div>
  );
}
