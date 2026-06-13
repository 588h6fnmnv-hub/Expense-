import { useState } from "react";
import { Transaction } from "@/lib/types";

const categoryOptions = [
  "⛽ Petrol",
  "👤 Person",
  "👷 Worker Salary",
  "🏗️ Materials",
  "🚕 Transport",
  "🧾 Bills",
  "🛠️ Tools",
  "❔ Other",
];

const categoryName = (category = "") =>
  category.replace(/^[^\w₹A-Za-z0-9]+ /, "").trim() || "Other";

const inferCategory = (
  title = "",
  type: string = "Expense"
) => {
  if (title && title.includes && title.includes("category:")) {
    return title.split("category:")[1].trim();
  }

  if (type === "Income" || title.toLowerCase().startsWith("person -")) {
    return "👤 Person";
  }

  const lower = title.toLowerCase();
  return (
    categoryOptions.find((category) =>
      lower.includes(categoryName(category).toLowerCase())
    ) || "❔ Other"
  );
};

const sourceAccount = (tx: Transaction) =>
  tx.method === "Cash" ? "Cash" : tx.selectedCard || tx.method;

const targetName = (tx: Transaction) =>
  tx.person || tx.title.replace(/^person\s*-\s*/i, "") || categoryName(tx.category);

const moneyLeavesAccount = (tx: Transaction) =>
  tx.type === "Expense" || tx.type === "Pay Out";

const cleanMovementName = (value = "") => value.trim();

const isSelfAccount = (value: string, tx: Transaction) => {
  const lower = cleanMovementName(value).toLowerCase();
  const selected = cleanMovementName(tx.selectedCard || "").toLowerCase();

  return Boolean(
    lower &&
      (["you", "account", "cash", "upi", "card"].includes(lower) ||
        lower === tx.method.toLowerCase() ||
        (selected && lower === selected))
  );
};

const transactionMovement = (tx: Transaction) => {
  const moneyOut = moneyLeavesAccount(tx);
  const fallbackFrom = moneyOut ? sourceAccount(tx) : targetName(tx);
  const fallbackTo = moneyOut ? targetName(tx) : sourceAccount(tx);
  const savedFrom = cleanMovementName(tx.fromAccount || fallbackFrom);
  const savedTo = cleanMovementName(tx.toAccount || fallbackTo);
  const fromLooksSelf = isSelfAccount(savedFrom, tx);
  const toLooksSelf = isSelfAccount(savedTo, tx);

  if (!moneyOut && fromLooksSelf && !toLooksSelf) {
    return {
      from: savedTo,
      to: savedFrom,
      label: "Payment In",
    };
  }

  if (moneyOut && toLooksSelf && !fromLooksSelf) {
    return {
      from: savedTo,
      to: savedFrom,
      label: "Payment Out",
    };
  }

  return {
    from: savedFrom,
    to: savedTo,
    label: moneyOut ? "Payment Out" : "Payment In",
  };
};

const isPlaceholderParty = (value = "") =>
  /^(sender|merchant|account)$/i.test(value.trim());

export default function TransactionCard({
  tx,
  onDelete,
  onUpdate,
  readOnly = false,
}: {
  tx: Transaction;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<Transaction>) => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExpense = moneyLeavesAccount(tx);
  const sign = isExpense ? "-" : "+";
  const category = tx.category || inferCategory(tx.title, tx.type);
  const categoryIsUnknown = !tx.category || category === "❔ Other";
  const { from, to, label } = transactionMovement(tx);
  const badgeText = isExpense ? "OUT" : "IN";
  const accountDetail =
    tx.selectedCard && tx.selectedCard !== tx.method ? ` • ${tx.selectedCard}` : "";
  const showMovement = Boolean(
    from && to && !isPlaceholderParty(from) && !isPlaceholderParty(to)
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setExpanded((current) => !current);
        }
      }}
      className="liquid-surface text-neutral-950 w-full rounded-[26px] p-4 text-left transition duration-300 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[11px] font-black tracking-wide ${
              isExpense
                ? "bg-rose-500/10 text-rose-600"
                : "bg-emerald-500/10 text-emerald-700"
            }`}
          >
            {badgeText}
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-extrabold">
              {tx.title}
            </h3>

            <p className="mt-1 truncate text-sm text-neutral-500">
              {label} • {tx.method}
              {accountDetail}
            </p>

            {showMovement && (
              <p className="mt-1 truncate text-xs font-bold text-neutral-400">
                {from} -&gt; {to}
              </p>
            )}

            <p className="mt-1 text-xs text-neutral-400">
              {tx.date}
              {tx.time ? ` • ${tx.time}` : ""}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`font-extrabold ${
              isExpense
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            {sign}₹{tx.amount}
          </p>

          {!readOnly && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                const confirmDelete = confirm(
                  "Delete this transaction?"
                );

                if (confirmDelete) {
                  onDelete(tx.id);
                }
              }}
              className="mt-3 inline-block rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-neutral-500 active:scale-95"
              aria-label={`Delete ${tx.title}`}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-3 rounded-3xl bg-black/5 p-4 text-sm">
          {showMovement && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-bold text-neutral-400">From</p>
                <p className="mt-1 font-extrabold">{from}</p>
              </div>

              <div>
                <p className="font-bold text-neutral-400">To</p>
                <p className="mt-1 font-extrabold">{to}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-bold text-neutral-400">Movement</p>
              <p className="mt-1 font-extrabold">{label}</p>
            </div>

            <div>
              <p className="font-bold text-neutral-400">Method</p>
              <p className="mt-1 font-extrabold">{tx.method}</p>
            </div>
          </div>

          <div>
            <p className="font-bold text-neutral-400">Date & Time</p>
            <p className="mt-1 font-extrabold">
              {tx.date}
              {tx.time ? ` • ${tx.time}` : ""}
            </p>
          </div>

          {categoryIsUnknown && onUpdate ? (
            <label className="block">
              <span className="font-bold text-neutral-400">Choose category</span>
              <select
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white p-3 font-bold outline-none"
                value={tx.category || "❔ Other"}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const value = event.target.value;
                  onUpdate(tx.id, {
                    category: value,
                    title:
                      tx.title === "Expense" || tx.title === "Email transaction"
                        ? categoryName(value)
                        : tx.title,
                  });
                }}
              >
                {categoryOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : (
            <div>
              <p className="font-bold text-neutral-400">Category</p>
              <p className="mt-1 font-extrabold">{category}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
