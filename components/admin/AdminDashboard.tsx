"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { CompanyProfile, WalletData } from "@/lib/types";

type AdminUserSummary = {
  id: string;
  username: string;
  email: string;
  role: string;
  companyId: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
};

type AdminCompany = {
  id: string;
  name: string;
  ownerEmail: string;
  plan: string;
  suspended: boolean;
  createdAt?: unknown;
};

type AdminDashboardProps = {
  users: unknown[]; // fallback type compatibility
  company: CompanyProfile | null;
  wallet: WalletData;
  storageStatusLabel: string;
  isOnline: boolean;
  isFirebaseConfigured: boolean;
  adminUsername: string;
};

const maskEmail = (email = "") => {
  const [name, domain] = email.split("@");

  if (!name || !domain) return "Hidden";

  return `${name.slice(0, 2)}***@${domain}`;
};

export default function AdminDashboard({
  storageStatusLabel,
  isOnline,
  isFirebaseConfigured,
  adminUsername,
}: AdminDashboardProps) {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [dbUsers, setDbUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  // Create forms state
  const [companyName, setCompanyName] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  // Password reset forms state
  const [selectedUsername, setSelectedUsername] = useState("");
  const [newTempPassword, setNewTempPassword] = useState("");

  const showToast = useCallback((msg: string, tone: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastTone(tone);
    setTimeout(() => setToastMessage(""), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/companies");
      const data = await res.json();
      if (res.ok) {
        setCompanies(data.companies || []);
        setDbUsers(data.users || []);
      } else {
        showToast(data.error || "Failed to load admin data", "error");
      }
    } catch {
      showToast("Network error. Failed to load admin data.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !ownerUsername || !tempPassword) {
      showToast("Please fill in all fields.", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "create-company",
          companyName,
          ownerUsername,
          tempPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Company & Owner successfully created!", "success");
        setCompanyName("");
        setOwnerUsername("");
        setTempPassword("");
        fetchData();
      } else {
        showToast(data.error || "Failed to create company", "error");
      }
    } catch {
      showToast("Network error. Failed to create company.", "error");
    }
  };

  const handleToggleSuspend = async (companyId: string, currentSuspended: boolean) => {
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "suspend-company",
          companyId,
          suspend: !currentSuspended,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(currentSuspended ? "Company unsuspended!" : "Company suspended!", "success");
        fetchData();
      } else {
        showToast(data.error || "Failed to update suspension status", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm("Are you sure you want to delete this company? This action cannot be undone.")) return;

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "delete-company",
          companyId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Company deleted!", "success");
        fetchData();
      } else {
        showToast(data.error || "Failed to delete company", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  };

  const handleResetOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUsername || !newTempPassword) {
      showToast("Please select a username and enter a temporary password.", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reset-owner-password",
          ownerUsername: selectedUsername,
          tempPassword: newTempPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Owner password reset successfully. Forced change active.", "success");
        setSelectedUsername("");
        setNewTempPassword("");
      } else {
        showToast(data.error || "Failed to reset password", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Super Admin header */}
      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Super Admin Panel
        </p>
        <h2 className="mt-2 text-2xl font-black">Platform Administration</h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Create companies, initialize Owner accounts, suspend/delete companies, and reset passwords.
        </p>
      </div>

      {/* Grid of operational controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Create Company / Owner Form */}
        <div className="liquid-surface text-neutral-950 rounded-[28px] p-5 space-y-4">
          <h3 className="text-lg font-black">Provision New Company</h3>
          <p className="text-xs font-semibold opacity-60">
            Registers a company and generates a corresponding company Owner account. Owner will be forced to change password at first login.
          </p>
          <form onSubmit={handleCreateCompany} className="space-y-3">
            <div>
              <label className="block text-xs font-black uppercase text-emerald-500 mb-1">Company Name</label>
              <input
                type="text"
                required
                placeholder="e.g. ABC Constructions"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-emerald-500 mb-1">Owner Username</label>
              <input
                type="text"
                required
                placeholder="e.g. abcowner"
                value={ownerUsername}
                onChange={(e) => setOwnerUsername(e.target.value)}
                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-emerald-500 mb-1">Temporary Password</label>
              <input
                type="text"
                required
                placeholder="e.g. Temp@1234"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
              />
            </div>
            <button
              type="submit"
              className="btn-hover-effect w-full h-11 bg-primary text-background rounded-xl text-xs font-bold transition shadow-md"
            >
              Provision Workspace
            </button>
          </form>
        </div>

        {/* Reset Owner Password Form */}
        <div className="liquid-surface text-neutral-950 rounded-[28px] p-5 space-y-4">
          <h3 className="text-lg font-black">Reset Owner Password</h3>
          <p className="text-xs font-semibold opacity-60">
            Resets a company Owner&apos;s password to a temporary state, forcing them to choose a new password upon their next login.
          </p>
          <form onSubmit={handleResetOwnerPassword} className="space-y-3">
            <div>
              <label className="block text-xs font-black uppercase text-emerald-500 mb-1">Owner Username</label>
              <input
                type="text"
                required
                placeholder="e.g. abcowner"
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-emerald-500 mb-1">New Temporary Password</label>
              <input
                type="text"
                required
                placeholder="e.g. Temp@5678"
                value={newTempPassword}
                onChange={(e) => setNewTempPassword(e.target.value)}
                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
              />
            </div>
            <button
              type="submit"
              className="btn-hover-effect w-full h-11 bg-amber-500 text-black rounded-xl text-xs font-bold transition shadow-md"
            >
              Reset and Force Change
            </button>
          </form>
        </div>
      </div>

      {/* Companies List */}
      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5 space-y-4">
        <h3 className="text-lg font-black">Active Companies</h3>
        <p className="text-xs font-semibold opacity-60">
          List of registered companies on this platform instance. Suspending a company blocks authentication for all of its users.
        </p>

        {loading ? (
          <div className="text-center py-6 opacity-50 font-bold">Loading system data...</div>
        ) : companies.length === 0 ? (
          <div className="text-center py-6 opacity-50 font-bold">No companies provisioned yet.</div>
        ) : (
          <div className="space-y-3">
            {companies.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl bg-black/5 p-4 border border-black/5 dark:bg-white/5 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{c.name}</span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        c.suspended
                          ? "bg-red-500/10 text-red-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}
                    >
                      {c.suspended ? "Suspended" : "Active"}
                    </span>
                  </div>
                  <p className="text-xs opacity-50 font-semibold mt-0.5">
                    Owner: {c.ownerEmail} · ID: {c.id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSuspend(c.id, c.suspended)}
                    className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition"
                  >
                    {c.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCompany(c.id)}
                    className="rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 text-xs font-bold transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support diagnostics / overview */}
      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5 space-y-3">
        <h3 className="text-sm font-black text-neutral-500 uppercase tracking-widest">Support & Diagnostics</h3>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5 text-xs font-semibold">
          <span>Active super admin:</span>
          <span className="font-bold">{maskEmail(adminUsername)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5 text-xs font-semibold">
          <span>Network state / Firebase:</span>
          <span className="font-bold">{isOnline ? "Online" : "Offline"} · {isFirebaseConfigured ? "Firebase OK" : "No Firebase"}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5 text-xs font-semibold">
          <span>Total Database User Records:</span>
          <span className="font-bold">{dbUsers.length}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5 text-xs font-semibold">
          <span>Sync State:</span>
          <span className="font-bold">{storageStatusLabel}</span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-[110] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-black shadow-2xl ${
            toastTone === "success" ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
