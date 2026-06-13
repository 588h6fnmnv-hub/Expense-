"use client";

import BackupRestore from "@/components/settings/BackupRestore";
import PlanSystemPanel from "@/components/settings/PlanSystemPanel";
import type {
  CardItem,
  ActivityLogItem,
  CompanyProfile,
  EmployeeInvite,
  PersonAccount,
  PlanType,
  ProjectSite,
  WalletData,
} from "@/lib/types";

export type CardDraft = {
  name: string;
  number: string;
  expiry: string;
  cardType: NonNullable<CardItem["cardType"]>;
  repaymentDay: string;
};

type SettingsViewProps = {
  company: CompanyProfile | null;
  wallet: WalletData;
  projectsCount: number;
  workersCount: number;
  materialsCount: number;
  cards: CardItem[];
  cardDraft: CardDraft;
  employeeInvites: EmployeeInvite[];
  workers: PersonAccount[];
  projects: ProjectSite[];
  activityLog: ActivityLogItem[];
  dataHealthWarnings: string[];
  isImportingEmail: boolean;
  canExportCloudBackup: boolean;
  cardSourceLabel: (card: Pick<CardItem, "name" | "number">) => string;
  onCardDraftChange: (patch: Partial<CardDraft>) => void;
  onConnectGmailAccess: () => void;
  onImportEmailTransactions: () => void;
  onSaveCardDraft: () => void;
  onUpdateCard: (cardId: string, patch: Partial<CardItem>) => void;
  onPlanChange: (plan: PlanType) => void;
  onCreateEmployeeInvite: (input: {
    role: EmployeeInvite["role"];
    displayName: string;
    phone?: string;
    workerSubRole?: EmployeeInvite["workerSubRole"];
    workerId?: string;
    assignedSupervisor?: string;
    dailyWage?: number;
    monthlyWage?: number;
    workerStatus?: NonNullable<EmployeeInvite["workerStatus"]>;
    assignedProjectIds?: string[];
    assignedWorkerIds?: string[];
  }) => EmployeeInvite | null;
  onMessage: (message: string, tone?: "success" | "error") => void;
  onImportBackup: (payload: unknown) => Promise<string>;
  onExportCloudBackup?: () => Promise<unknown>;
};

export default function SettingsView({
  company,
  wallet,
  projectsCount,
  workersCount,
  materialsCount,
  cards,
  cardDraft,
  employeeInvites,
  workers,
  projects,
  activityLog,
  dataHealthWarnings,
  isImportingEmail,
  canExportCloudBackup,
  cardSourceLabel,
  onCardDraftChange,
  onConnectGmailAccess,
  onImportEmailTransactions,
  onSaveCardDraft,
  onUpdateCard,
  onPlanChange,
  onCreateEmployeeInvite,
  onMessage,
  onImportBackup,
  onExportCloudBackup,
}: SettingsViewProps) {
  return (
    <div className="space-y-4">
      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Settings
        </p>
        <h2 className="mt-2 text-2xl font-black">Account</h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Cloud sync, profile, imports, and company settings stay connected here.
        </p>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Gmail
        </p>
        <h2 className="mt-2 text-2xl font-black">Transaction Import</h2>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onConnectGmailAccess}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
          >
            Connect Gmail Access
          </button>
          <button
            type="button"
            disabled={isImportingEmail}
            onClick={onImportEmailTransactions}
            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black active:scale-[0.98] disabled:opacity-60"
          >
            {isImportingEmail ? "Importing..." : "Import Gmail Transactions"}
          </button>
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Cards
        </p>
        <h2 className="mt-2 text-2xl font-black">Repayment Settings</h2>

        <div className="mt-4 grid gap-2">
          <input
            value={cardDraft.name}
            onChange={(event) => onCardDraftChange({ name: event.target.value })}
            placeholder="Card name"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={cardDraft.number}
              onChange={(event) => onCardDraftChange({ number: event.target.value })}
              placeholder="Last 4 digits"
              inputMode="numeric"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
            />
            <input
              value={cardDraft.expiry}
              onChange={(event) => onCardDraftChange({ expiry: event.target.value })}
              placeholder="Expiry"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={cardDraft.cardType}
              onChange={(event) =>
                onCardDraftChange({
                  cardType: event.target.value as NonNullable<CardItem["cardType"]>,
                })
              }
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
            >
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
            <input
              value={cardDraft.repaymentDay}
              onChange={(event) =>
                onCardDraftChange({ repaymentDay: event.target.value })
              }
              placeholder="Repay day"
              inputMode="numeric"
              disabled={cardDraft.cardType !== "Credit"}
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none disabled:opacity-50 dark:border-white/10 dark:bg-white/10"
            />
          </div>
          <button
            type="button"
            onClick={onSaveCardDraft}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
          >
            Save Card
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-[22px] bg-black/5 p-3 dark:bg-white/5"
            >
              <p className="truncate text-sm font-black">
                {cardSourceLabel(card) || card.name}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={card.cardType || ""}
                  onChange={(event) =>
                    onUpdateCard(card.id, {
                      cardType:
                        event.target.value === "Credit" ||
                        event.target.value === "Debit"
                          ? event.target.value
                          : undefined,
                    })
                  }
                  className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none dark:border-white/10 dark:bg-white/10"
                >
                  <option value="">Type</option>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
                <input
                  value={card.repaymentDay || ""}
                  onChange={(event) =>
                    onUpdateCard(card.id, {
                      repaymentDay: Number(event.target.value || 0),
                    })
                  }
                  placeholder="Repay day"
                  inputMode="numeric"
                  disabled={card.cardType !== "Credit"}
                  className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-bold text-neutral-950 placeholder:text-neutral-400 outline-none disabled:opacity-50 dark:border-white/10 dark:bg-white/10"
                />
              </div>
            </div>
          ))}
          {cards.length === 0 && (
            <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500 dark:bg-white/5">
              Add a credit card to receive repayment reminders.
            </p>
          )}
        </div>
      </div>

      <PlanSystemPanel
        company={company}
        projectsCount={projectsCount}
        workersCount={workersCount}
        materialsCount={materialsCount}
        employeeInvites={employeeInvites}
        workers={workers}
        projects={projects}
        onPlanChange={onPlanChange}
        onCreateEmployeeInvite={onCreateEmployeeInvite}
        onMessage={onMessage}
      />

      <BackupRestore
        company={company}
        wallet={wallet}
        onImportBackup={onImportBackup}
        onExportCloudBackup={
          canExportCloudBackup ? onExportCloudBackup : undefined
        }
      />

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Health
        </p>
        <h2 className="mt-2 text-2xl font-black">Data health</h2>
        <div className="mt-4 space-y-2">
          {dataHealthWarnings.map((warning) => (
            <p
              key={warning}
              className="rounded-2xl bg-amber-500/10 p-3 text-sm font-bold text-amber-700 dark:text-amber-200"
            >
              {warning}
            </p>
          ))}
          {dataHealthWarnings.length === 0 && (
            <p className="rounded-2xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600">
              No obvious data issues found.
            </p>
          )}
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Activity
        </p>
        <h2 className="mt-2 text-2xl font-black">Recent activity</h2>
        <div className="mt-4 space-y-2">
          {activityLog.slice(0, 8).map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
              <p className="text-sm font-black">{entry.summary}</p>
              <p className="mt-1 text-xs font-bold text-neutral-500">
                {new Date(entry.timestamp).toLocaleString()} · {entry.changedBy || "local"}
              </p>
            </div>
          ))}
          {activityLog.length === 0 && (
            <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500 dark:bg-white/5">
              Activity will appear after creates, updates, imports, and deletes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
