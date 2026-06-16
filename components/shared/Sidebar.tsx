"use client";

import React from "react";
import type { ThemeMode, DashboardTab } from "@/lib/types";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelect: (tab: DashboardTab) => void;
  onLogout?: () => void;
  allowedTabs?: readonly DashboardTab[];
  theme: ThemeMode;
  companyName?: string;
};

type NavItem = {
  id: DashboardTab;
  label: string;
  icon: string;
};

const mainItems: NavItem[] = [
  { id: "Home", label: "Home", icon: "home" },
  { id: "Sites", label: "Sites", icon: "foundation" },
  { id: "People", label: "People", icon: "group" },
  { id: "Money", label: "Money", icon: "payments" },
  { id: "Account", label: "Account", icon: "account_balance_wallet" },
];

const systemItems: NavItem[] = [
  { id: "Settings", label: "Settings", icon: "settings" },
  { id: "Admin", label: "Admin", icon: "admin_panel_settings" },
];

export default function Sidebar({
  isOpen,
  onClose,
  activeTab,
  onSelect,
  onLogout,
  allowedTabs,
  theme,
  companyName,
}: SidebarProps) {
  const initial = companyName ? companyName.charAt(0).toUpperCase() : "L";

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
        } ${!isOpen ? "pointer-events-none" : ""} ${
          theme === "dark"
            ? "bg-background border-r border-white/10 text-on-surface"
            : "bg-white border-r border-black/5 text-black"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full transition"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-background font-black text-xl shrink-0">
              {initial}
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-bold truncate">{companyName || "Ledge"}</span>
              <span className="material-symbols-outlined text-sm opacity-50">expand_more</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-xl">wifi</span>
            <span className="material-symbols-outlined opacity-50 text-xl">person</span>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-70px)]">
          {/* Company Selector */}
          <div className="relative">
            <button className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
              <div className="flex items-center gap-2 text-emerald-500 font-bold">
                <span className="material-symbols-outlined text-xl">foundation</span>
                <span className="truncate">{companyName || "Ledge"}</span>
              </div>
              <span className="material-symbols-outlined">unfold_more</span>
            </button>
          </div>

          {/* Quick Action Button */}
          {(!allowedTabs || allowedTabs.includes("Add")) && (
            <button
              onClick={() => {
                onSelect("Add");
                onClose();
              }}
              className="w-full h-12 bg-primary text-background rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg mb-4"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Quick Action
            </button>
          )}

          {/* Search */}
          <div className="relative mb-6">
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
          <nav className="space-y-6 pb-8">
            <div>
              <div className="space-y-1">
                {mainItems
                  .filter((i) => !allowedTabs || allowedTabs.includes(i.id))
                  .map((item) => (
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

            {systemItems.some((i) => !allowedTabs || allowedTabs.includes(i.id)) && (
              <div>
                <h3 className="text-xs font-bold opacity-30 uppercase px-3 mb-2 tracking-widest">
                  System
                </h3>
                <div className="space-y-1">
                  {systemItems
                    .filter((i) => !allowedTabs || allowedTabs.includes(i.id))
                    .map((item) => (
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
            )}
          </nav>

          {/* Logout */}
          <div className="pt-4 border-t border-white/5">
            <button
              onClick={() => {
                if (onLogout) onLogout();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-sm font-bold">Log out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
