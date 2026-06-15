"use client";

import type { CompanyProfile, ThemeMode } from "@/lib/types";

type DashboardHeaderProps = {
  appName: string;
  company: CompanyProfile | null;
  displayName: string;
  userImage?: string;
  storageStatusLabel: string;
  theme: ThemeMode;
  onThemeToggle: () => void;
  onMenuToggle: () => void;
};

export default function DashboardHeader({
  appName,
  company,
  displayName,
  userImage,
  storageStatusLabel,
  theme,
  onThemeToggle,
  onMenuToggle,
}: DashboardHeaderProps) {
  const isSynced = storageStatusLabel.toLowerCase().includes("synced");
  const isPending =
    storageStatusLabel.toLowerCase().includes("saving") ||
    storageStatusLabel.toLowerCase().includes("checking");

  const statusBadgeClass = isSynced
    ? "bg-success-green/10 border-success-green/20 text-success-green"
    : isPending
    ? "bg-warning-amber/10 border-warning-amber/20 text-warning-amber animate-pulse"
    : "bg-danger-red/10 border-danger-red/20 text-danger-red";

  const statusIcon = isSynced ? "sync" : isPending ? "pending" : "cloud_off";

  const initial = displayName ? displayName.charAt(0).toUpperCase() : "L";

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 backdrop-blur-xl border-b flex items-center justify-between px-margin-mobile h-16 transition-all duration-300 ${
        theme === "dark"
          ? "bg-background/80 border-white/10 text-on-surface"
          : "bg-white/80 border-black/5 text-black"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-white/10 flex items-center justify-center transition active:scale-95 duration-200"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined text-2xl leading-none">
            menu
          </span>
        </button>

        {userImage ? (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">
            <img
              alt={displayName}
              className="w-full h-full object-cover"
              src={userImage}
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/10 shrink-0 text-sm font-bold">
            {initial}
          </div>
        )}
        <div className="flex flex-col justify-center">
          <h1 className="font-headline-lg-mobile text-base md:text-lg font-black tracking-tight leading-none text-neutral-950">
            {company?.name || appName}
          </h1>
          <p className="text-[10px] text-neutral-500 font-semibold mt-0.5 leading-none">
            {displayName} • {company?.plan || "Starter"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass}`}
        >
          <span className="material-symbols-outlined text-[12px] leading-none">
            {statusIcon}
          </span>
          <span className="truncate max-w-[120px]">{storageStatusLabel}</span>
        </div>

        <button
          type="button"
          onClick={onThemeToggle}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition active:scale-95 duration-200"
          aria-label="Toggle theme"
        >
          <span className="material-symbols-outlined text-lg leading-none">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </div>
    </header>
  );
}
