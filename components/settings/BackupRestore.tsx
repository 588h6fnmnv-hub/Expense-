"use client";

import { useState } from "react";
import type { CompanyProfile, WalletData } from "@/lib/types";

type BackupRestoreProps = {
  company: CompanyProfile | null;
  wallet: WalletData;
  onImportBackup: (payload: unknown) => Promise<string>;
  onExportCloudBackup?: () => Promise<unknown>;
};

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const backupFileName = (companyName = "ledge") =>
  `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}-backup.json`;

const countItems = (value: unknown) => (Array.isArray(value) ? value.length : 0);

const backupReviewSummary = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Unknown backup contents.";
  }

  const record = payload as Record<string, unknown>;
  const wallet =
    record.wallet && typeof record.wallet === "object" && !Array.isArray(record.wallet)
      ? (record.wallet as Record<string, unknown>)
      : record;
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {};

  return [
    `Transactions: ${countItems(wallet.transactions || data.transactions)}`,
    `Sites: ${countItems(wallet.projects || data.sites)}`,
    `Workers: ${countItems(wallet.personAccounts || data.workers)}`,
    `Materials: ${countItems(wallet.materials || data.materials)}`,
    `Reminders: ${countItems(wallet.reminders || data.reminders)}`,
    `Reports: ${countItems(wallet.dailyReports || data.dailyReports)}`,
  ].join("\n");
};

export default function BackupRestore({
  company,
  wallet,
  onImportBackup,
  onExportCloudBackup,
}: BackupRestoreProps) {
  const [status, setStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
  }>({
    tone: "neutral",
    message: "Export before major imports or device changes.",
  });
  const [busy, setBusy] = useState(false);

  const localBackup = {
    format: "ledge-company-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    companyId: company?.id || wallet.company?.id || "",
    company: company || wallet.company,
    wallet,
    data: {
      transactions: wallet.transactions,
      sites: wallet.projects,
      workers: wallet.personAccounts,
      materials: wallet.materials,
      reminders: wallet.reminders,
      dailyReports: wallet.dailyReports,
      employeeInvites: wallet.employeeInvites,
      accountBalances: wallet.accountBalances,
    },
  };

  const exportLocal = () => {
    downloadJson(backupFileName(company?.name || wallet.company?.name), localBackup);
    setStatus({
      tone: "success",
      message: "Backup JSON exported from this device.",
    });
  };

  const exportCloud = async () => {
    if (!onExportCloudBackup) {
      setStatus({
        tone: "error",
        message: "Cloud backup is unavailable for this company.",
      });
      return;
    }

    setBusy(true);
    setStatus({ tone: "neutral", message: "Preparing cloud backup..." });

    try {
      const payload = await onExportCloudBackup();
      downloadJson(backupFileName(company?.name || wallet.company?.name), payload);
      setStatus({
        tone: "success",
        message: "Cloud backup JSON exported.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Cloud backup export failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    setStatus({ tone: "neutral", message: "Validating backup file..." });

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Backup file must contain a JSON object.");
      }

      const confirmed = window.confirm(
        `Review backup before import:\n\n${backupReviewSummary(
          payload
        )}\n\nKnown IDs/source IDs will be merged where possible. Continue?`
      );

      if (!confirmed) {
        setStatus({ tone: "neutral", message: "Backup import cancelled." });
        return;
      }

      const message = await onImportBackup(payload);

      setStatus({ tone: "success", message });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Backup import failed. Check the JSON file and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="liquid-surface rounded-[28px] p-5">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
        Backup
      </p>
      <h2 className="mt-2 text-2xl font-black">Backup & restore</h2>
      <p className="mt-1 text-sm font-semibold text-neutral-500">
        Export company data as JSON and restore safely without duplicating known records.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportLocal}
          disabled={busy}
          className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={exportCloud}
          disabled={busy || !onExportCloudBackup}
          className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black active:scale-[0.98] disabled:opacity-50"
        >
          Cloud JSON
        </button>
      </div>

      <label className="mt-3 block rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-center text-sm font-black active:scale-[0.98] dark:bg-white/5">
        Import Backup JSON
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      <p
        className={`mt-3 rounded-2xl p-3 text-sm font-bold ${
          status.tone === "success"
            ? "bg-emerald-500/10 text-emerald-600"
            : status.tone === "error"
              ? "bg-red-500/10 text-red-500"
              : "bg-black/5 text-neutral-500"
        }`}
      >
        {status.message}
      </p>
    </div>
  );
}
