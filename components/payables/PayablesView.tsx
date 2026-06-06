"use client";

import type { ReactNode } from "react";
import type {
  MaterialItem,
  PersonAccount,
  ProjectSite,
} from "@/lib/types";

type PayablesViewProps = {
  workers: PersonAccount[];
  materials: MaterialItem[];
  projects: ProjectSite[];
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const projectName = (projects: ProjectSite[], projectId?: string) =>
  projects.find((project) => project.id === projectId)?.name || "No site";

const workerOpeningBalance = (worker: PersonAccount) =>
  worker.direction === "Receivable" ? worker.amount : -worker.amount;

const workerEntryAmount = (entry: NonNullable<PersonAccount["entries"]>[number]) =>
  entry.direction === "Debit" ? entry.amount : -entry.amount;

const workerBalance = (worker: PersonAccount) =>
  workerOpeningBalance(worker) +
  (worker.entries || []).reduce(
    (total, entry) => total + workerEntryAmount(entry),
    0
  );

const materialValue = (material: MaterialItem) => {
  const quantity =
    material.usedQuantity && material.usedQuantity > 0
      ? material.usedQuantity
      : material.quantity;

  return quantity * material.rate;
};

function PayableSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="liquid-surface rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black">{title}</h3>
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-neutral-500 dark:bg-white/10">
          {count}
        </span>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500 dark:bg-white/5">
      {label}
    </p>
  );
}

export default function PayablesView({
  workers,
  materials,
  projects,
}: PayablesViewProps) {
  const personPayables = workers.filter(
    (worker) => worker.direction === "Payable" && worker.amount > 0
  );
  const workerSalaryPayables = workers
    .map((worker) => ({ worker, balance: workerBalance(worker) }))
    .filter((item) => item.balance < 0);
  const materialBills = materials
    .filter((material) => materialValue(material) > 0)
    .sort((left, right) => materialValue(right) - materialValue(left));

  return (
    <div className="space-y-4">
      <div className="liquid-surface rounded-[28px] p-5">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
          Payables
        </p>
        <h2 className="mt-2 text-2xl font-black">Who must be paid</h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Person balances, worker salary dues, and material bills in one place.
        </p>
      </div>

      <PayableSection title="Person" count={personPayables.length}>
        {personPayables.map((person) => (
          <div
            key={person.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{person.name}</p>
              <p className="text-xs font-bold text-neutral-500">
                {projectName(projects, person.projectId)}
                {person.phone ? ` · ${person.phone}` : ""}
              </p>
            </div>
            <p className="shrink-0 text-sm font-black text-red-500">
              {rupee(person.amount)}
            </p>
          </div>
        ))}
        {personPayables.length === 0 && (
          <EmptyState label="No person payable balances right now." />
        )}
      </PayableSection>

      <PayableSection title="Worker Salary" count={workerSalaryPayables.length}>
        {workerSalaryPayables.map(({ worker, balance }) => (
          <div
            key={worker.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{worker.name}</p>
              <p className="text-xs font-bold text-neutral-500">
                {worker.workerSubRole || "Worker"} · {projectName(projects, worker.projectId)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-black text-red-500">
              {rupee(Math.abs(balance))}
            </p>
          </div>
        ))}
        {workerSalaryPayables.length === 0 && (
          <EmptyState label="No worker salary payable balances right now." />
        )}
      </PayableSection>

      <PayableSection title="Material Bills" count={materialBills.length}>
        {materialBills.slice(0, 12).map((material) => (
          <div
            key={material.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{material.name}</p>
              <p className="text-xs font-bold text-neutral-500">
                {material.supplier || "No supplier"} · {projectName(projects, material.projectId)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-black text-red-500">
              {rupee(materialValue(material))}
            </p>
          </div>
        ))}
        {materialBills.length === 0 && (
          <EmptyState label="No material bill records right now." />
        )}
      </PayableSection>
    </div>
  );
}
