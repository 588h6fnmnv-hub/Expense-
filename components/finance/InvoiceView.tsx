"use client";

import React from "react";
import type { Invoice, ThemeMode } from "@/lib/types";

type InvoiceViewProps = {
  invoices: Invoice[];
  theme: ThemeMode;
};

export default function InvoiceView({ invoices, theme }: InvoiceViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold">Invoices</h2>
        <button className="px-4 py-2 bg-primary text-background rounded-full font-bold text-sm">
          + New Invoice
        </button>
      </div>

      <div className="space-y-3">
        {invoices.length > 0 ? (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`p-5 rounded-[2rem] border transition-all ${
                theme === "dark"
                  ? "bg-neutral-900/50 border-white/10"
                  : "bg-white border-black/5 shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold opacity-40 uppercase">Invoice to</p>
                  <h3 className="text-lg font-bold">{invoice.customerName}</h3>
                  <p className="text-sm opacity-60">Date: {invoice.date}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    invoice.status === "Paid" ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"
                  }`}>
                    {invoice.status}
                  </span>
                  <p className="text-xl font-black mt-2">
                    ₹{invoice.total.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center opacity-40">
            <span className="material-symbols-outlined text-6xl mb-2">description</span>
            <p>No invoices yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
