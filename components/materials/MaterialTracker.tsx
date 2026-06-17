"use client";

import { useMemo, useState } from "react";
import { MATERIAL_CATEGORIES } from "@/lib/construction";
import type { MaterialCategory, MaterialItem, ProjectSite, ReminderItem } from "@/lib/types";

type MaterialTrackerProps = {
  materials: MaterialItem[];
  projects: ProjectSite[];
  reminders: ReminderItem[];
  onCreateMaterial: (material: Omit<MaterialItem, "id">) => void;
  onUpdateMaterial: (materialId: string, patch: Partial<MaterialItem>) => void;
  onDeleteMaterial: (materialId: string) => void;
  onCreateReminder: (reminder: Omit<ReminderItem, "id">) => void;
};

type MaterialDraft = {
  name: string;
  category: MaterialCategory;
  projectId: string;
  quantity: string;
  unit: string;
  rate: string;
  supplier: string;
  lowStockAt: string;
  note: string;
};

type StockDraft = {
  amount: string;
};

const rupee = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;

const localDateValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const numberValue = (value: string | number | undefined) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const remainingStock = (material: MaterialItem) =>
  Math.max(0, material.quantity - (material.usedQuantity || 0));

const isLowStock = (material: MaterialItem) =>
  (material.lowStockAt || 0) > 0 && remainingStock(material) <= (material.lowStockAt || 0);

const newMaterialDraft = (): MaterialDraft => ({
  name: "",
  category: "Other",
  projectId: "",
  quantity: "",
  unit: "pcs",
  rate: "",
  supplier: "",
  lowStockAt: "",
  note: "",
});

export default function MaterialTracker({
  materials,
  projects,
  reminders,
  onCreateMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onCreateReminder,
}: MaterialTrackerProps) {
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const [draft, setDraft] = useState<MaterialDraft>(newMaterialDraft);
  const [stockDrafts, setStockDrafts] = useState<Record<string, StockDraft>>({});
  const [activeMaterialId, setActiveMaterialId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | "All">("All");
  const projectNameById = useMemo(
    () => new Map((projects || []).map((project) => [project.id, project.name])),
    [projects]
  );
  const safeMaterials = materials || [];
  const activeMaterial =
    safeMaterials.find((material) => material.id === activeMaterialId) ||
    safeMaterials.filter((material) =>
      categoryFilter === "All" ? true : (material.category || "Other") === categoryFilter
    )[0] ||
    null;
  const filteredMaterials = safeMaterials.filter((material) =>
    categoryFilter === "All" ? true : (material.category || "Other") === categoryFilter
  );
  const lowStockItems = safeMaterials.filter(isLowStock);
  const remainingValue = safeMaterials.reduce(
    (total, material) => total + (remainingStock(material) || 0) * (material.rate || 0),
    0
  );
  const usedValue = safeMaterials.reduce(
    (total, material) => total + (material.usedQuantity || 0) * (material.rate || 0),
    0
  );
  const siteLinkedCount = safeMaterials.filter((material) => material && material.projectId).length;
  const categoryReports = MATERIAL_CATEGORIES.map((category) => {
    const items = safeMaterials.filter((material) => material && (material.category || "Other") === category);
    return {
      category,
      count: items.length,
      value: items.reduce((total, material) => total + (remainingStock(material) || 0) * (material.rate || 0), 0),
      low: items.filter(isLowStock).length,
    };
  }).filter((item) => item.count > 0);
  const siteCategoryUsage = (projects || [])
    .map((project) => {
      if (!project) return null;
      const items = safeMaterials.filter((material) => material && material.projectId === project.id);
      return {
        id: project.id,
        name: project.name,
        categories: MATERIAL_CATEGORIES.map((category) => ({
          category,
          usedValue: items
            .filter((material) => material && (material.category || "Other") === category)
            .reduce((total, material) => total + (material.usedQuantity || 0) * (material.rate || 0), 0),
        })).filter((item) => item.usedValue > 0),
      };
    })
    .filter((site): site is NonNullable<typeof site> => !!site && site.categories.length > 0);
  const supplierGroups = Array.from(
    safeMaterials.reduce((groups, material) => {
      if (material) {
        const supplier = material.supplier || "No supplier";
        groups.set(supplier, [...(groups.get(supplier) || []), material]);
      }
      return groups;
    }, new Map<string, MaterialItem[]>())
  ).sort((left, right) => left[0].localeCompare(right[0]));

  const createMaterial = () => {
    const name = draft.name.trim();

    if (!name) return;

    onCreateMaterial({
      name,
      category: draft.category,
      projectId: draft.projectId,
      quantity: numberValue(draft.quantity),
      usedQuantity: 0,
      lowStockAt: numberValue(draft.lowStockAt),
      unit: draft.unit.trim() || "pcs",
      rate: numberValue(draft.rate),
      supplier: draft.supplier.trim(),
      date: localDateValue(),
      note: draft.note.trim(),
    });
    setDraft(newMaterialDraft());
    setShowNewMaterial(false);
  };

  const stockAmount = (materialId: string) =>
    numberValue(stockDrafts[materialId]?.amount || "");

  const clearStockDraft = (materialId: string) =>
    setStockDrafts((current) => ({
      ...current,
      [materialId]: { amount: "" },
    }));

  const addStock = (material: MaterialItem) => {
    const amount = stockAmount(material.id);
    if (!amount) return;

    onUpdateMaterial(material.id, {
      quantity: material.quantity + amount,
      date: localDateValue(),
    });
    clearStockDraft(material.id);
  };

  const stockOut = (material: MaterialItem) => {
    const amount = stockAmount(material.id);
    if (!amount) return;

    onUpdateMaterial(material.id, {
      usedQuantity: Math.min(material.quantity, (material.usedQuantity || 0) + amount),
      date: localDateValue(),
    });
    clearStockDraft(material.id);
  };

  const createReorderReminder = (material: MaterialItem) => {
    const existingReminder = reminders.find(
      (reminder) =>
        !reminder.done &&
        reminder.title.toLowerCase() === `reorder ${material.name}`.toLowerCase()
    );

    if (existingReminder) return;

    onCreateReminder({
      title: `Reorder ${material.name}`,
      type: "material_reorder",
      dueDate: localDateValue(),
      projectId: material.projectId,
      amount: Math.max(0, (material.lowStockAt || 0) - remainingStock(material)) * material.rate,
      note: material.supplier
        ? `Supplier: ${material.supplier}`
        : "Material stock is below reorder level.",
      done: false,
      targetId: material.id,
      notifyAt: localDateValue(),
      notificationReady: true,
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">
            Materials
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">
            Stock tracker
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowNewMaterial((current) => !current)}
          className="rounded-2xl bg-black px-4 py-2 text-sm font-black text-white active:scale-[0.98] dark:bg-white dark:text-black"
        >
          Add
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="liquid-surface text-neutral-950 rounded-[22px] p-3">
          <p className="text-[11px] font-bold text-neutral-500">Remaining</p>
          <p className="mt-1 truncate text-sm font-black">
            {rupee(remainingValue)}
          </p>
        </div>
        <div className="liquid-surface text-neutral-950 rounded-[22px] p-3">
          <p className="text-[11px] font-bold text-neutral-500">Used</p>
          <p className="mt-1 truncate text-sm font-black text-red-500">
            {rupee(usedValue)}
          </p>
        </div>
        <div className="liquid-surface text-neutral-950 rounded-[22px] p-3">
          <p className="text-[11px] font-bold text-neutral-500">Low</p>
          <p className="mt-1 text-sm font-black text-amber-600">
            {lowStockItems.length}
          </p>
        </div>
      </div>

      {showNewMaterial && (
        <div className="liquid-surface text-neutral-950 space-y-3 rounded-[26px] p-4">
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Material name"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          />
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as MaterialCategory,
              }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          >
            {MATERIAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={draft.projectId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, projectId: event.target.value }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          >
            <option value="">No site selected</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.quantity}
              onChange={(event) =>
                setDraft((current) => ({ ...current, quantity: event.target.value }))
              }
              placeholder="Stock in"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
            />
            <input
              value={draft.unit}
              onChange={(event) =>
                setDraft((current) => ({ ...current, unit: event.target.value }))
              }
              placeholder="Unit"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.rate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, rate: event.target.value }))
              }
              placeholder="Rate"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
            />
            <input
              value={draft.lowStockAt}
              onChange={(event) =>
                setDraft((current) => ({ ...current, lowStockAt: event.target.value }))
              }
              placeholder="Low at"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
            />
          </div>
          <input
            value={draft.supplier}
            onChange={(event) =>
              setDraft((current) => ({ ...current, supplier: event.target.value }))
            }
            placeholder="Supplier"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          />
          <input
            value={draft.note}
            onChange={(event) =>
              setDraft((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Note"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          />
          <button
            type="button"
            onClick={createMaterial}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black active:scale-[0.98]"
          >
            Save Material
          </button>
        </div>
      )}

      {materials.length === 0 && (
        <div className="liquid-surface text-neutral-950 rounded-[26px] p-6 text-center">
          <p className="font-black">No materials yet</p>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Add materials to track stock in, stock used, suppliers, and reorder levels.
          </p>
        </div>
      )}

      {materials.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(["All", ...MATERIAL_CATEGORIES] as Array<MaterialCategory | "All">).map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black ${
                    categoryFilter === category
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-black/5 text-neutral-500 dark:bg-white/5"
                  }`}
                >
                  {category}
                </button>
              )
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filteredMaterials.map((material) => {
              const remaining = remainingStock(material);
              const selected = activeMaterial?.id === material.id;

              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => setActiveMaterialId(material.id)}
                  className={`min-w-[150px] rounded-[22px] p-3 text-left transition active:scale-[0.98] ${
                    selected
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "liquid-surface text-neutral-950"
                  }`}
                >
                  <p className="truncate text-sm font-black">{material.name}</p>
                  <p className="mt-1 text-sm font-black">
                    {remaining} {material.unit}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-bold opacity-70">
                    {material.category || "Other"} · {projectNameById.get(material.projectId || "") || "Unassigned"}
                  </p>
                </button>
              );
            })}
          </div>

          {activeMaterial && (
            <MaterialCard
              material={activeMaterial}
              projects={projects}
              projectName={projectNameById.get(activeMaterial.projectId || "")}
              stockDraft={stockDrafts[activeMaterial.id]?.amount || ""}
              onStockDraftChange={(amount) =>
                setStockDrafts((current) => ({
                  ...current,
                  [activeMaterial.id]: { amount },
                }))
              }
              onStockIn={() => addStock(activeMaterial)}
              onStockOut={() => stockOut(activeMaterial)}
              onUpdate={(patch) => onUpdateMaterial(activeMaterial.id, patch)}
              onDelete={() => onDeleteMaterial(activeMaterial.id)}
              onCreateReorderReminder={() => createReorderReminder(activeMaterial)}
            />
          )}

          {lowStockItems.length > 0 && (
            <div className="liquid-surface text-neutral-950 rounded-[26px] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Low stock alert</p>
                  <p className="text-xs font-semibold text-neutral-500">
                    Reorder level reached
                  </p>
                </div>
                <p className="text-xs font-black text-amber-600">
                  {lowStockItems.length}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {lowStockItems.slice(0, 4).map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{material.name}</p>
                      <p className="text-xs font-bold text-neutral-500">
                        {remainingStock(material)} {material.unit} left
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => createReorderReminder(material)}
                      className="shrink-0 rounded-xl bg-black px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-black"
                    >
                      Reminder
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MaterialReports
            categoryReports={categoryReports}
            siteCategoryUsage={siteCategoryUsage}
            supplierGroups={supplierGroups}
          />

          <div className="text-center text-xs font-bold text-neutral-500">
            {siteLinkedCount} of {materials.length} material item
            {materials.length === 1 ? "" : "s"} linked to sites.
          </div>
        </>
      )}
    </section>
  );
}

function MaterialCard({
  material,
  projects,
  projectName,
  stockDraft,
  onStockDraftChange,
  onStockIn,
  onStockOut,
  onUpdate,
  onDelete,
  onCreateReorderReminder,
}: {
  material: MaterialItem;
  projects: ProjectSite[];
  projectName?: string;
  stockDraft: string;
  onStockDraftChange: (amount: string) => void;
  onStockIn: () => void;
  onStockOut: () => void;
  onUpdate: (patch: Partial<MaterialItem>) => void;
  onDelete: () => void;
  onCreateReorderReminder: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const remaining = remainingStock(material);
  const low = isLowStock(material);
  const totalValue = remaining * material.rate;

  return (
    <div className="liquid-surface text-neutral-950 rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
              low
                ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            {low ? "Low stock" : "In stock"}
          </p>
          <h3 className="mt-2 truncate text-xl font-black">{material.name}</h3>
          <p className="mt-1 truncate text-sm font-semibold text-neutral-500">
            {material.category || "Other"} • {projectName || "No site"} • {material.supplier || "No supplier"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black">
            {remaining} {material.unit}
          </p>
          <p className="text-[11px] font-bold text-neutral-500">remaining</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SummaryCell label="Stock In" value={`${material.quantity} ${material.unit}`} />
        <SummaryCell
          label="Used"
          value={`${material.usedQuantity || 0} ${material.unit}`}
          tone="text-red-500"
        />
        <SummaryCell label="Rate" value={rupee(material.rate)} />
        <SummaryCell
          label="Stock Value"
          value={rupee(totalValue)}
          tone="text-emerald-600"
        />
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          value={stockDraft}
          onChange={(event) => onStockDraftChange(event.target.value)}
          placeholder="Qty"
          inputMode="decimal"
          className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
        />
        <button
          type="button"
          onClick={onStockIn}
          className="rounded-2xl bg-emerald-500 px-3 py-3 text-xs font-black text-black active:scale-[0.98]"
        >
          In
        </button>
        <button
          type="button"
          onClick={onStockOut}
          className="rounded-2xl bg-red-500/10 px-3 py-3 text-xs font-black text-red-500 active:scale-[0.98]"
        >
          Out
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className="rounded-2xl bg-black/5 px-3 py-2 text-xs font-black text-neutral-600"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          onClick={onCreateReorderReminder}
          className="rounded-2xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-600"
        >
          Reorder Reminder
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-500"
        >
          Delete
        </button>
      </div>

      {editing && (
        <div className="mt-3 grid gap-2">
          <select
            value={material.projectId || ""}
            onChange={(event) => onUpdate({ projectId: event.target.value })}
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          >
            <option value="">No site selected</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={material.category || "Other"}
            onChange={(event) =>
              onUpdate({ category: event.target.value as MaterialCategory })
            }
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          >
            {MATERIAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            value={material.supplier || ""}
            onChange={(event) => onUpdate({ supplier: event.target.value })}
            placeholder="Supplier"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={material.rate || ""}
              onChange={(event) => onUpdate({ rate: numberValue(event.target.value) })}
              placeholder="Rate"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
            />
            <input
              value={material.lowStockAt || ""}
              onChange={(event) =>
                onUpdate({ lowStockAt: numberValue(event.target.value) })
              }
              placeholder="Low stock"
              inputMode="decimal"
              className="min-w-0 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
            />
          </div>
          <input
            value={material.note || ""}
            onChange={(event) => onUpdate({ note: event.target.value })}
            placeholder="Note"
            className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-neutral-950 placeholder:text-neutral-400 outline-none"
          />
        </div>
      )}
    </div>
  );
}

function MaterialReports({
  categoryReports,
  siteCategoryUsage,
  supplierGroups,
}: {
  categoryReports: Array<{
    category: MaterialCategory;
    count: number;
    value: number;
    low: number;
  }>;
  siteCategoryUsage: Array<{
    id: string;
    name: string;
    categories: Array<{ category: MaterialCategory; usedValue: number }>;
  }>;
  supplierGroups: Array<[string, MaterialItem[]]>;
}) {
  return (
    <div className="space-y-3">
      <div className="liquid-surface text-neutral-950 rounded-[26px] p-4">
        <p className="text-sm font-black">Category stock value</p>
        <div className="mt-3 space-y-2">
          {categoryReports.map((item) => (
            <div
              key={item.category}
              className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{item.category}</p>
                <p className="text-xs font-bold text-neutral-500">
                  {item.count} item{item.count === 1 ? "" : "s"} · {item.low} low
                </p>
              </div>
              <p className="shrink-0 text-sm font-black">{rupee(item.value)}</p>
            </div>
          ))}
          {categoryReports.length === 0 && (
            <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
              Category reports will appear after materials are added.
            </p>
          )}
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[26px] p-4">
        <p className="text-sm font-black">Site-wise category usage</p>
        <div className="mt-3 space-y-2">
          {siteCategoryUsage.slice(0, 5).map((site) => (
            <div key={site.id} className="rounded-2xl bg-black/5 p-3">
              <p className="text-sm font-black">{site.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {site.categories.map((item) => (
                  <span
                    key={item.category}
                    className="rounded-xl bg-white/70 px-2 py-1 text-xs font-black text-neutral-600 dark:bg-black/20 dark:text-neutral-200"
                  >
                    {item.category}: {rupee(item.usedValue)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {siteCategoryUsage.length === 0 && (
            <p className="rounded-2xl bg-black/5 p-4 text-sm font-bold text-neutral-500">
              Used material value will group by site and category.
            </p>
          )}
        </div>
      </div>

      <div className="liquid-surface text-neutral-950 rounded-[26px] p-4">
        <p className="text-sm font-black">Supplier-wise materials</p>
        <div className="mt-3 space-y-2">
          {supplierGroups.slice(0, 6).map(([supplier, items]) => (
            <div
              key={supplier}
              className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{supplier}</p>
                <p className="truncate text-xs font-bold text-neutral-500">
                  {items.map((item) => item.name).join(", ")}
                </p>
              </div>
              <p className="shrink-0 text-xs font-black text-neutral-500">
                {items.length}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone = "text-black",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl bg-black/5 p-3">
      <p className="text-xs font-bold text-neutral-500">{label}</p>
      <p className={`mt-1 truncate font-black ${tone}`}>{value}</p>
    </div>
  );
}
