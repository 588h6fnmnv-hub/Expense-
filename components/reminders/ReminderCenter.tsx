"use client";

import { useMemo, useState } from "react";
import type { ProjectSite, ReminderItem } from "@/lib/types";

type ReminderCenterProps = {
  reminders: ReminderItem[];
  projects: ProjectSite[];
  onCreateReminder: (reminder: Omit<ReminderItem, "id">) => void;
  onUpdateReminder: (reminderId: string, patch: Partial<ReminderItem>) => void;
  onDeleteReminder: (reminderId: string) => void;
};

type ReminderFilter = "today" | "overdue" | "upcoming" | "done";

type ReminderDraft = {
  title: string;
  type: NonNullable<ReminderItem["type"]>;
  dueDate: string;
  projectId: string;
  amount: string;
  note: string;
};

const reminderTypes: Array<{
  value: NonNullable<ReminderItem["type"]>;
  label: string;
}> = [
  { value: "payment", label: "Payment" },
  { value: "worker_payment", label: "Worker Pay" },
  { value: "material_reorder", label: "Material" },
  { value: "bill_due", label: "Bill Due" },
  { value: "general", label: "General" },
];

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const localDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const dateKey = (value = "") => value || localDateValue();

const reminderStatus = (reminder: ReminderItem, today = localDateValue()) => {
  if (reminder.done) return "done";
  if (dateKey(reminder.dueDate) < today) return "overdue";
  if (dateKey(reminder.dueDate) === today) return "today";
  return "upcoming";
};

const newReminderDraft = (): ReminderDraft => ({
  title: "",
  type: "payment",
  dueDate: localDateValue(),
  projectId: "",
  amount: "",
  note: "",
});

const cleanAmount = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

const typeLabel = (type: ReminderItem["type"]) =>
  reminderTypes.find((item) => item.value === type)?.label || "General";

const statusLabel: Record<ReminderFilter, string> = {
  today: "Today",
  overdue: "Overdue",
  upcoming: "Upcoming",
  done: "Done",
};

export default function ReminderCenter({
  reminders,
  projects,
  onCreateReminder,
  onUpdateReminder,
  onDeleteReminder,
}: ReminderCenterProps) {
  const [filter, setFilter] = useState<ReminderFilter>("today");
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [draft, setDraft] = useState<ReminderDraft>(newReminderDraft);
  const today = localDateValue();
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );
  const counts = reminders.reduce(
    (total, reminder) => {
      total[reminderStatus(reminder, today)] += 1;
      return total;
    },
    { today: 0, overdue: 0, upcoming: 0, done: 0 } as Record<ReminderFilter, number>
  );
  const visibleReminders = reminders
    .filter((reminder) => reminderStatus(reminder, today) === filter)
    .sort((left, right) => dateKey(left.dueDate).localeCompare(dateKey(right.dueDate)));
  const notificationReadyCount = reminders.filter(
    (reminder) => !reminder.done && reminder.notificationReady
  ).length;

  const createReminder = () => {
    const title = draft.title.trim();

    if (!title) return;

    onCreateReminder({
      title,
      type: draft.type,
      dueDate: draft.dueDate || today,
      projectId: draft.projectId,
      amount: cleanAmount(draft.amount),
      note: draft.note.trim(),
      done: false,
      notifyAt: draft.dueDate || today,
      notificationReady: true,
    });
    setDraft(newReminderDraft());
    setShowNewReminder(false);
    setFilter(reminderStatus({ title, dueDate: draft.dueDate, done: false, id: "draft" }, today));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
            Reminders
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">
            Reminder center
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowNewReminder((current) => !current)}
          className="rounded-2xl bg-black px-4 py-2 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
        >
          Add
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(statusLabel) as ReminderFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-[20px] p-3 text-left transition active:scale-[0.98] ${
              filter === item
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "liquid-surface"
            }`}
          >
            <p className="truncate text-[11px] font-bold opacity-70">
              {statusLabel[item]}
            </p>
            <p className="mt-1 text-lg font-black">{counts[item]}</p>
          </button>
        ))}
      </div>

      <div className="liquid-surface rounded-[22px] p-3 text-sm font-bold text-neutral-500">
        {notificationReadyCount} reminder
        {notificationReadyCount === 1 ? "" : "s"} ready for future notifications.
      </div>

      {showNewReminder && (
        <div className="liquid-surface space-y-3 rounded-[26px] p-4">
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Reminder title"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as ReminderDraft["type"],
                }))
              }
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none"
            >
              {reminderTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, dueDate: event.target.value }))
              }
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none"
            />
          </div>
          <select
            value={draft.projectId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, projectId: event.target.value }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none"
          >
            <option value="">No site selected</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            value={draft.amount}
            onChange={(event) =>
              setDraft((current) => ({ ...current, amount: event.target.value }))
            }
            placeholder="Amount"
            inputMode="decimal"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none"
          />
          <input
            value={draft.note}
            onChange={(event) =>
              setDraft((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Note"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none"
          />
          <button
            type="button"
            onClick={createReminder}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black active:scale-[0.98]"
          >
            Save Reminder
          </button>
        </div>
      )}

      <div className="space-y-2">
        {visibleReminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            projectName={projectNameById.get(reminder.projectId || "")}
            status={reminderStatus(reminder, today)}
            onToggleDone={() =>
              onUpdateReminder(reminder.id, {
                done: !reminder.done,
                notificationReady: reminder.done,
              })
            }
            onDelete={() => onDeleteReminder(reminder.id)}
          />
        ))}
        {visibleReminders.length === 0 && (
          <div className="liquid-surface rounded-[26px] p-6 text-center">
            <p className="font-black">No {statusLabel[filter].toLowerCase()} reminders</p>
            <p className="mt-1 text-sm font-semibold text-neutral-500">
              Payment, worker, material, and bill reminders will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ReminderCard({
  reminder,
  projectName,
  status,
  onToggleDone,
  onDelete,
}: {
  reminder: ReminderItem;
  projectName?: string;
  status: ReminderFilter;
  onToggleDone: () => void;
  onDelete: () => void;
}) {
  const statusTone =
    status === "overdue"
      ? "bg-red-500/10 text-red-500"
      : status === "today"
        ? "bg-amber-500/10 text-amber-600"
        : status === "done"
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-blue-500/10 text-blue-600";

  return (
    <div className="liquid-surface rounded-[26px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${statusTone}`}>
              {statusLabel[status]}
            </span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-black text-neutral-500">
              {typeLabel(reminder.type)}
            </span>
          </div>
          <h3 className="mt-2 truncate text-base font-black">{reminder.title}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-neutral-500">
            {reminder.dueDate}
            {projectName ? ` • ${projectName}` : ""}
          </p>
          {reminder.note && (
            <p className="mt-1 line-clamp-2 text-xs font-bold text-neutral-500">
              {reminder.note}
            </p>
          )}
        </div>
        {reminder.amount !== undefined && (
          <p className="shrink-0 text-right text-sm font-black">
            {rupee(reminder.amount)}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleDone}
          className="rounded-2xl bg-black px-3 py-2 text-xs font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
        >
          {reminder.done ? "Undo" : "Mark Done"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-500 active:scale-[0.98]"
        >
          Delete
        </button>
        {reminder.notificationReady && !reminder.done && (
          <span className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-600">
            Notification ready
          </span>
        )}
      </div>
    </div>
  );
}
