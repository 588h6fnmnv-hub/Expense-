"use client";

import type { CompanyProfile, ThemeMode } from "@/lib/types";

type DashboardHeaderProps = {
  appName: string;
  company: CompanyProfile | null;
  displayName: string;
  storageStatusLabel: string;
  theme: ThemeMode;
  onThemeToggle: () => void;
};

export default function DashboardHeader({
  appName,
  company,
  displayName,
  storageStatusLabel,
  theme,
  onThemeToggle,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          {company?.plan || "Starter"} Plan
        </p>

        <h1 className="mt-1 text-2xl font-black tracking-tight">
          {company?.name || appName}
        </h1>

        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Welcome back, {displayName}
        </p>
      </div>

      <div className="shrink-0 space-y-2 text-right">
        <div
          className={`rounded-2xl px-3 py-2 text-[11px] font-black leading-4 shadow-sm ${
            theme === "dark" ? "bg-white/10 text-white" : "bg-white text-black"
          }`}
        >
          {storageStatusLabel}
        </div>
        <button
          type="button"
          onClick={onThemeToggle}
          className={`rounded-2xl px-3 py-2 text-[11px] font-black shadow-sm ${
            theme === "dark" ? "bg-white text-black" : "bg-black text-white"
          }`}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </div>
  );
}
