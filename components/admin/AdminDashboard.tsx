"use client";

import type { CompanyProfile, WalletData } from "@/lib/types";

type AdminUserSummary = {
  username: string;
  email: string;
  lastLogin: string;
};

type AdminDashboardProps = {
  users: AdminUserSummary[];
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

const shortId = (value = "") =>
  value ? `${value.slice(0, 8)}${value.length > 8 ? "..." : ""}` : "Not set";

const uniqueUsers = (users: AdminUserSummary[]) =>
  Array.from(
    new Map(
      users
        .filter((user) => user.email || user.username)
        .map((user) => [user.email || user.username, user])
    ).values()
  );

const countActiveCompanies = (company: CompanyProfile | null) => (company ? 1 : 0);

const planCounts = (company: CompanyProfile | null) => ({
  starter: !company || company.plan === "Starter" ? countActiveCompanies(company) : 0,
  pro: company?.plan === "Pro" ? 1 : 0,
});

const StatCard = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) => (
  <div className="rounded-3xl bg-white/80 p-4 text-neutral-950 shadow dark:bg-white/5">
    <p className="text-xs font-bold text-neutral-500">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
    <p className="mt-1 text-xs font-semibold text-neutral-500">{helper}</p>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5">
    <p className="text-sm font-bold text-neutral-500">{label}</p>
    <p className="truncate text-right text-sm font-black">{value}</p>
  </div>
);

export default function AdminDashboard({
  users,
  company,
  wallet,
  storageStatusLabel,
  isOnline,
  isFirebaseConfigured,
  adminUsername,
}: AdminDashboardProps) {
  const safeUsers = uniqueUsers(users);
  const companies = countActiveCompanies(company);
  const plans = planCounts(company);
  const activeUser = safeUsers[0];
  const loginDates = safeUsers
    .map((user) => user.lastLogin)
    .filter(Boolean)
    .sort();
  const latestLogin = loginDates[loginDates.length - 1];

  return (
    <div className="space-y-4">
      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Admin
        </p>
        <h2 className="mt-2 text-2xl font-black">Production dashboard</h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Safe operational overview for support, company health, and debugging.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Users"
          value={safeUsers.length}
          helper="Registered on this device"
        />
        <StatCard
          label="Companies"
          value={companies}
          helper="Visible to this admin session"
        />
        <StatCard
          label="Transactions"
          value={wallet.transactions.length}
          helper="Current company wallet"
        />
        <StatCard
          label="Open Reminders"
          value={wallet.reminders.filter((reminder) => !reminder.done).length}
          helper="Not marked done"
        />
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-sm font-black">User / company overview</p>
        <div className="mt-3 space-y-2">
          <InfoRow label="Active admin" value={maskEmail(adminUsername)} />
          <InfoRow label="Latest login" value={latestLogin || "No login recorded"} />
          <InfoRow
            label="Company"
            value={company?.name || "No company loaded"}
          />
          <InfoRow label="Company ID" value={shortId(company?.id)} />
          <InfoRow
            label="Primary user"
            value={activeUser ? maskEmail(activeUser.email || activeUser.username) : "Hidden"}
          />
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-sm font-black">Plan overview</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <p className="text-xs font-bold text-neutral-500">Starter</p>
            <p className="mt-1 text-xl font-black">{plans.starter}</p>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-3">
            <p className="text-xs font-bold text-neutral-500">Pro</p>
            <p className="mt-1 text-xl font-black text-emerald-600">
              {plans.pro}
            </p>
          </div>
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-sm font-black">Recent activity</p>
        <div className="mt-3 space-y-2">
          <InfoRow
            label="Activity feed"
            value="Audit log connection pending"
          />
          <InfoRow
            label="Last local change"
            value={`${wallet.transactions.length + wallet.projects.length + wallet.materials.length} records loaded`}
          />
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[28px] p-5">
        <p className="text-sm font-black">Support / debug</p>
        <div className="mt-3 space-y-2">
          <InfoRow label="Network" value={isOnline ? "Online" : "Offline"} />
          <InfoRow label="Sync" value={storageStatusLabel} />
          <InfoRow
            label="Firebase client"
            value={isFirebaseConfigured ? "Configured" : "Not configured"}
          />
          <InfoRow label="Sites" value={String(wallet.projects.length)} />
          <InfoRow label="Workers" value={String(wallet.personAccounts.length)} />
          <InfoRow label="Materials" value={String(wallet.materials.length)} />
        </div>
      </div>
    </div>
  );
}
