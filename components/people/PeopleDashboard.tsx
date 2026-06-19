"use client";

import React, { useState } from "react";
import type { Customer, Supplier, ThemeMode } from "@/lib/types";

type PeopleDashboardProps = {
  customers: Customer[];
  suppliers: Supplier[];
  theme: ThemeMode;
};

export default function PeopleDashboard({
  customers,
  suppliers,
  theme,
}: PeopleDashboardProps) {
  const [activeTab, setActiveTab] = useState<"Customers" | "Suppliers">("Customers");

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className={`flex p-1 rounded-2xl ${
        theme === "dark" ? "bg-white/5" : "bg-black/5"
      }`}>
        {["Customers", "Suppliers"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as "Customers" | "Suppliers")}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${
              activeTab === tab
                ? theme === "dark" ? "bg-primary text-background shadow-lg" : "bg-white text-black shadow-md"
                : "text-apple-silver hover:opacity-80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeTab === "Customers" ? (
          customers.length > 0 ? (
            customers.map((customer) => (
              <div
                key={customer.id}
                className={`p-5 rounded-[2rem] border transition-all hover:scale-[1.02] ${
                  theme === "dark"
                    ? "bg-neutral-900/50 border-white/10"
                    : "bg-white border-black/5 shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{customer.name}</h3>
                    <p className="text-sm opacity-60">{customer.phone || "No phone"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase font-bold opacity-50">Balance</p>
                    <p className={`text-xl font-black ${customer.balance >= 0 ? "text-emerald-500" : "text-danger-red"}`}>
                      ₹{Math.abs(customer.balance).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm">
                    Details
                  </button>
                  <button className="flex-1 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-sm">
                    Invoice
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center opacity-40">
              <span className="material-symbols-outlined text-6xl mb-2">person_off</span>
              <p>No customers yet</p>
            </div>
          )
        ) : (
          suppliers.length > 0 ? (
            suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className={`p-5 rounded-[2rem] border transition-all hover:scale-[1.02] ${
                  theme === "dark"
                    ? "bg-neutral-900/50 border-white/10"
                    : "bg-white border-black/5 shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{supplier.name}</h3>
                    <p className="text-sm opacity-60">{supplier.phone || "No phone"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase font-bold opacity-50">Payable</p>
                    <p className="text-xl font-black text-danger-red">
                      ₹{Math.abs(supplier.balance).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm">
                    Details
                  </button>
                  <button className="flex-1 py-2 rounded-xl bg-danger-red/10 text-danger-red font-bold text-sm">
                    Pay Bill
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center opacity-40">
              <span className="material-symbols-outlined text-6xl mb-2">local_shipping</span>
              <p>No suppliers yet</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
