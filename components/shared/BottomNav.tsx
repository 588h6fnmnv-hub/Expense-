"use client";

import type { ThemeMode } from "@/lib/types";

export type BottomNavItem =
  | "Home"
  | "Sites"
  | "Workers"
  | "Add"
  | "Materials"
  | "Reports"
  | "Settings"
  | "Admin";

type BottomNavProps = {
  items: readonly BottomNavItem[];
  activeTab: string;
  hasOpenForm: boolean;
  theme: ThemeMode;
  onSelect: (item: BottomNavItem) => void;
};

const iconForItem = (item: BottomNavItem) =>
  item === "Home"
    ? "⌂"
    : item === "Sites"
      ? "▦"
      : item === "Workers"
        ? "♟"
      : item === "Add"
        ? "+"
        : item === "Materials"
          ? "▤"
          : item === "Reports"
            ? "▥"
            : item === "Settings"
              ? "⚙"
              : "◎";

export default function BottomNav({
  items,
  activeTab,
  hasOpenForm,
  theme,
  onSelect,
}: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-md gap-1 border-t px-3 pb-4 pt-2 shadow-[0_-18px_45px_rgba(15,23,42,0.12)] backdrop-blur-2xl ${
        items.length === 8
          ? "grid-cols-8"
          : items.length === 7
            ? "grid-cols-7"
            : items.length === 6
              ? "grid-cols-6"
              : items.length === 5
                ? "grid-cols-5"
                : items.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-1"
      } ${
        theme === "dark"
          ? "border-white/10 bg-black/86"
          : "border-black/5 bg-white/86"
      }`}
    >
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSelect(item)}
          aria-current={
            activeTab === item ||
            (item === "Home" && activeTab === "Account") ||
            (item === "Add" && hasOpenForm)
              ? "page"
              : undefined
          }
          aria-label={item === "Add" ? "Add transaction" : item}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 text-[11px] font-black transition duration-200 active:scale-[0.96] ${
            activeTab === item ||
            (item === "Home" && activeTab === "Account") ||
            (item === "Add" && hasOpenForm)
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-neutral-500 dark:text-white/60"
          }`}
        >
          <span className="text-lg leading-none">{iconForItem(item)}</span>
          <span className="truncate leading-none">{item}</span>
        </button>
      ))}
    </nav>
  );
}
