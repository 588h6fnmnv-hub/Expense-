"use client";

import React from "react";
import type { SupplierBill, ThemeMode } from "@/lib/types";

type BillViewProps = {
  bills: SupplierBill[];
  theme: ThemeMode;
};

export default function BillView({ bills, theme }: BillViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold">Supplier Bills</h2>
        <button className="px-4 py-2 bg-primary text-background rounded-full font-bold text-sm">
          + New Bill
        </button>
      </div>

      <div className="space-y-3">
        {bills.length > 0 ? (
          bills.map((bill) => (
            <div
              key={bill.id}
              className={`p-5 rounded-[2rem] border transition-all ${
                theme === "dark"
                  ? "bg-neutral-900/50 border-white/10"
                  : "bg-white border-black/5 shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold opacity-40 uppercase">Bill from</p>
                  <h3 className="text-lg font-bold">{bill.supplierName}</h3>
                  <p className="text-sm opacity-60">Due: {bill.dueDate}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    bill.status === "Paid" ? "bg-emerald-500/20 text-emerald-500" : "bg-danger-red/20 text-danger-red"
                  }`}>
                    {bill.status}
                  </span>
                  <p className="text-xl font-black mt-2 text-danger-red">
                    ₹{bill.total.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center opacity-40">
            <span className="material-symbols-outlined text-6xl mb-2">receipt_long</span>
            <p>No bills yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
