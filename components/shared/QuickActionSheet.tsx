"use client";

import React from "react";
import type { ThemeMode } from "@/lib/types";

type QuickAction = {
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
};

type QuickActionSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  actions: QuickAction[];
};

export default function QuickActionSheet({
  isOpen,
  onClose,
  theme,
  actions,
}: QuickActionSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-20 sm:pb-24">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`relative w-full max-w-md transform overflow-hidden rounded-[2.5rem] p-6 shadow-2xl transition-all animate-in slide-in-from-bottom duration-300 ${
          theme === "dark"
            ? "bg-neutral-900/90 border border-white/10 text-white"
            : "bg-white/90 border border-black/5 text-black"
        } backdrop-blur-2xl`}
      >
        <div className="flex flex-col items-center">
          <div
            className={`h-1.5 w-12 rounded-full mb-6 ${
              theme === "dark" ? "bg-white/20" : "bg-black/10"
            }`}
          />
          <h2 className="text-xl font-bold mb-8">Quick Actions</h2>

          <div className="grid grid-cols-3 gap-6 w-full mb-4">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-active:scale-90 ${action.color}`}
                >
                  <span className="material-symbols-outlined text-3xl text-white">
                    {action.icon}
                  </span>
                </div>
                <span className="text-xs font-semibold text-center opacity-80 group-hover:opacity-100">
                  {action.label}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className={`mt-4 w-full py-4 rounded-2xl font-bold text-center transition-colors ${
              theme === "dark"
                ? "bg-white/5 hover:bg-white/10"
                : "bg-black/5 hover:bg-black/10"
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
