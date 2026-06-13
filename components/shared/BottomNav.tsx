"use client";

import type { ThemeMode } from "@/lib/types";

export type BottomNavItem =
  | "Home"
  | "Sites"
  | "People"
  | "Add"
  | "Money"
  | "Settings"
  | "Admin";

type BottomNavProps = {
  items: readonly BottomNavItem[];
  activeTab: string;
  hasOpenForm: boolean;
  theme: ThemeMode;
  onSelect: (item: BottomNavItem) => void;
};

const iconForItem = (item: BottomNavItem) => {
  switch (item) {
    case "Home":
      return "home";
    case "Sites":
      return "foundation";
    case "People":
      return "group";
    case "Add":
      return "add_circle";
    case "Money":
      return "payments";
    case "Settings":
      return "settings";
    case "Admin":
      return "shield_person";
    default:
      return "info";
  }
};

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
      style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      className={`fixed bottom-0 left-0 right-0 w-full z-50 flex justify-around items-center h-16 px-2 overflow-hidden border-t backdrop-blur-xl transition-all duration-300 ${
        theme === "dark"
          ? "border-white/10 bg-background/80 text-on-surface"
          : "border-black/5 bg-white/80 text-black"
      }`}
    >
      {items.map((item) => {
        const isActive =
          activeTab === item ||
          (item === "Home" && activeTab === "Account") ||
          (item === "Add" && hasOpenForm);

        return (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            aria-current={isActive ? "page" : undefined}
            aria-label={item === "Add" ? "Add transaction" : item}
            className={`flex flex-col items-center justify-center min-w-0 flex-1 transition-all duration-200 active:scale-90 ${
              isActive
                ? theme === "dark"
                  ? "text-primary"
                  : "text-black"
                : "text-apple-silver hover:text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={{
                fontVariationSettings: isActive
                  ? "'FILL' 1, 'wght' 500"
                  : "'FILL' 0, 'wght' 400",
              }}
            >
              {iconForItem(item)}
            </span>
            <span className="font-label-sm text-[10px] mt-1 truncate max-w-[64px] tracking-tight hidden sm:block">
              {item}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
