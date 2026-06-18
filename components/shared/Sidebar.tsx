"use client";

import React from "react";
import type { ThemeMode, DashboardTab } from "@/lib/types";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelect: (tab: DashboardTab) => void;
  theme: ThemeMode;
  companyName?: string;
  onLogout?: () => void;
};

type NavItem = {
  id: DashboardTab;
  label: string;
  icon: string;
};

const homeItems: NavItem[] = [
  { id: "Home", label: "Home", icon: "home" },
  { id: "Sites", label: "Sites", icon: "foundation" },
  { id: "People", label: "People", icon: "group" },
  { id: "Money", label: "Money", icon: "payments" },
  { id: "Analytics", label: "Analytics", icon: "pie_chart" },
  { id: "DeliveryDashboard", label: "Delivery Dashboard", icon: "pie_chart" },
  { id: "Ratio", label: "Ratio", icon: "pie_chart" },
  { id: "DailyReport", label: "Daily Report", icon: "inventory" },
  { id: "DailyCashReport", label: "Daily Cash Report", icon: "inventory" },
  { id: "GroupAnalytics", label: "Group Analytics", icon: "inventory" },
];

const salesItems: NavItem[] = [
  { id: "POS", label: "POS", icon: "receipt_long" },
  { id: "PriceChecker", label: "Price Checker", icon: "receipt_long" },
  { id: "ZeevOrders", label: "Zeev Orders", icon: "chat_bubble" },
  { id: "SalesReceipt", label: "Sales Receipt", icon: "description" },
  { id: "SalesOrder", label: "Sales Order", icon: "description" },
  { id: "Quotation", label: "Quotation", icon: "description" },
  { id: "RouteSales", label: "Route Sales", icon: "description" },
];

export default function Sidebar({
  isOpen,
  onClose,
  activeTab,
  onSelect,
  theme,
  companyName,
  onLogout,
}: SidebarProps) {
  const initial = companyName ? companyName.charAt(0).toUpperCase() : "B";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-[70] w-72 max-w-[80vw] transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          theme === "dark"
            ? "bg-background border-r border-white/10 text-on-surface"
            : "bg-white border-r border-black/5 text-black"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full transition"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <div className="w-10 h-10 bg-neutral-300 rounded-full flex items-center justify-center text-background font-black text-xl">
              {initial}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">rss_feed</span>
            <span className="material-symbols-outlined opacity-50">person</span>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-70px)]">
          {/* Company Selector */}
          <div className="relative">
            <button className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined text-xl">store</span>
                <span className="truncate">{companyName || "Primary Sales"}</span>
              </div>
              <span className="material-symbols-outlined">unfold_more</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 opacity-30">
              search
            </span>
            <input
              type="text"
              placeholder="Search"
              className="w-full h-11 bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 outline-none focus:border-primary transition"
            />
          </div>

          {/* Navigation Sections */}
          <nav className="space-y-6 pb-4">
            <div>
              <h3 className="text-xs font-bold opacity-30 uppercase px-3 mb-2 tracking-widest">
                Home
              </h3>
              <div className="space-y-1">
                {homeItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      activeTab === item.id
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-white/5 opacity-70"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold opacity-30 uppercase px-3 mb-2 tracking-widest">
                Sales
              </h3>
              <div className="space-y-1">
                {salesItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      activeTab === item.id
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-white/5 opacity-70"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontVariationSettings: activeTab === item.id ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      {item.icon}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {onLogout && (
            <div className="pt-4 border-t border-white/5 pb-8">
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-red-500/10 text-red-500"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="text-sm font-bold">Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
