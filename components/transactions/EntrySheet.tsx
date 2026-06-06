"use client";

import { useEffect, useState } from "react";
import type {
  AccountBalances,
  CardItem,
  PaymentMethod,
  ProjectSite,
  Transaction,
  TransactionType,
} from "@/lib/types";

export type EntryFormPreset = {
  category?: string;
  name?: string;
  projectId?: string;
};

type BalanceDraft = {
  cash: string;
  upi: string;
  upis: Record<string, string>;
  cards: Record<string, string>;
};

type EntrySheetProps = {
  type: TransactionType | "Balance" | "Transfer";
  preset: EntryFormPreset;
  cards: CardItem[];
  upiAccounts: CardItem[];
  projects: ProjectSite[];
  currentBalances: AccountBalances;
  expenseCategories: string[];
  paymentMethods: PaymentMethod[];
  categoryName: (category?: string) => string;
  inferCategory: (
    title?: string,
    type?: TransactionType,
    cardName?: string,
    cards?: CardItem[]
  ) => string;
  cleanSourceName: (value?: string) => string;
  cardSourceLabel: (card: Pick<CardItem, "name" | "number">) => string;
  upiSourceLabel: (upi: Pick<CardItem, "name" | "upiId">) => string;
  localDateInputValue: () => string;
  localTimeInputValue: () => string;
  resolveTransactionMovement: (
    tx: Pick<
      Transaction,
      "type" | "method" | "title" | "selectedCard" | "category" | "person"
    > &
      Partial<Pick<Transaction, "fromAccount" | "toAccount">>
  ) => Pick<Transaction, "fromAccount" | "toAccount">;
  onModeChange: (nextForm: TransactionType | "Balance" | "Transfer") => void;
  onClose: () => void;
  onSaveTransaction: (tx: Omit<Transaction, "id">) => void;
  onSaveBalance: (balances: AccountBalances) => void;
};

export default function EntrySheet({
  type,
  preset,
  cards,
  upiAccounts,
  projects,
  currentBalances,
  expenseCategories,
  paymentMethods,
  categoryName,
  inferCategory,
  cleanSourceName,
  cardSourceLabel,
  upiSourceLabel,
  localDateInputValue,
  localTimeInputValue,
  resolveTransactionMovement,
  onModeChange,
  onClose,
  onSaveTransaction,
  onSaveBalance,
}: EntrySheetProps) {
  const [name, setName] = useState(preset.name || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [category, setCategory] = useState(
    preset.category || (type === "Income" ? "👤 Person" : "❔ Other")
  );
  const [paymentSource, setPaymentSource] = useState("");
  const [toSource, setToSource] = useState("");
  const [projectId, setProjectId] = useState(preset.projectId || "");
  const [selectedDate, setSelectedDate] = useState(localDateInputValue());
  const [selectedTime, setSelectedTime] = useState(localTimeInputValue());
  const [balanceDraft, setBalanceDraft] = useState<BalanceDraft>({
    cash: String(currentBalances.cash || ""),
    upi: String(currentBalances.upi || ""),
    upis: Object.fromEntries(
      Object.entries(currentBalances.upis || {}).map(([label, value]) => [
        label,
        String(value || ""),
      ])
    ),
    cards: Object.fromEntries(
      Object.entries(currentBalances.cards || {}).map(([label, value]) => [
        label,
        String(value || ""),
      ])
    ),
  });
  const [error, setError] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(Boolean(preset.category));
  const amountNumber = Number(amount);
  const isBalance = type === "Balance";
  const isTransfer = type === "Transfer";
  const isExpense = type === "Expense" || type === "Pay Out";
  const isMoneyInEntry = type === "Income" || type === "Pay In";
  const upiBalanceLabels = Array.from(
    new Set([
      ...upiAccounts.map(upiSourceLabel),
      ...Object.keys(currentBalances.upis || {}),
    ])
  ).filter(Boolean);
  const cardBalanceLabels = Array.from(
    new Set([
      ...cards.map(cardSourceLabel),
      ...Object.keys(currentBalances.cards || {}),
    ])
  ).filter(Boolean);
  const sourceOptions = [
    "Cash",
    "UPI",
    ...upiAccounts.map(upiSourceLabel),
    ...cards.map(cardSourceLabel),
  ].filter(Boolean);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    setCategory(
      preset.category ||
        (type === "Income" || type === "Pay In" ? "👤 Person" : "❔ Other")
    );
    setProjectId(preset.projectId || "");
    setName(preset.name || "");
    setCategoryTouched(Boolean(preset.category));
    setError("");
  }, [type, preset.category, preset.name, preset.projectId]);

  useEffect(() => {
    if (!isExpense || isTransfer || categoryTouched || preset.category) {
      return;
    }

    setCategory(inferCategory(name, type as TransactionType, paymentSource, cards));
  }, [
    cards,
    categoryTouched,
    inferCategory,
    isExpense,
    isTransfer,
    name,
    paymentSource,
    preset.category,
    type,
  ]);

  const save = () => {
    if (isBalance) {
      const cash = Number(balanceDraft.cash || 0);
      const upi = Number(balanceDraft.upi || 0);
      const upis = Object.fromEntries(
        Object.entries(balanceDraft.upis)
          .map(([label, value]) => [cleanSourceName(label), Number(value || 0)])
          .filter(([label, value]) =>
            Boolean(label) && Number.isFinite(value) && Number(value) >= 0
          )
      );
      const cardBalances = Object.fromEntries(
        Object.entries(balanceDraft.cards)
          .map(([label, value]) => [cleanSourceName(label), Number(value || 0)])
          .filter(([label, value]) =>
            Boolean(label) && Number.isFinite(value) && Number(value) >= 0
          )
      );
      const hasInvalidUpi = Object.values(balanceDraft.upis).some((value) => {
        const balanceAmount = Number(value || 0);
        return !Number.isFinite(balanceAmount) || balanceAmount < 0;
      });
      const hasInvalidCard = Object.values(balanceDraft.cards).some((value) => {
        const balanceAmount = Number(value || 0);
        return !Number.isFinite(balanceAmount) || balanceAmount < 0;
      });

      if (
        !Number.isFinite(cash) ||
        !Number.isFinite(upi) ||
        cash < 0 ||
        upi < 0 ||
        hasInvalidUpi ||
        hasInvalidCard
      ) {
        setError("Enter valid balance amounts.");
        return;
      }

      onSaveBalance({
        ...currentBalances,
        cash,
        upi,
        upis: upis as Record<string, number>,
        cards: cardBalances as Record<string, number>,
      });
      onClose();
      return;
    }

    if (!amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Enter an amount.");
      return;
    }

    const cleanName = name.trim();
    if (!isTransfer && !cleanName && category === "❔ Other") {
      setError("Add a short name or choose a category.");
      return;
    }

    if (!selectedDate) {
      setError("Choose a date.");
      return;
    }

    const selectedCard = method === "Cash" ? "" : cleanSourceName(paymentSource);

    if (method !== "Cash" && !selectedCard) {
      setError("Choose a payment source.");
      return;
    }

    if (isTransfer) {
      const fromAccount =
        method === "Cash" ? "Cash" : cleanSourceName(paymentSource);
      const targetAccount = cleanSourceName(toSource);

      if (!fromAccount || !targetAccount) {
        setError("Choose both accounts.");
        return;
      }

      onSaveTransaction({
        title: cleanName || "Transfer",
        amount: amountNumber,
        type: "Pay Out",
        method,
        section: "Account",
        selectedCard: fromAccount,
        category: "🔄 Transfer",
        person: "",
        fromAccount,
        toAccount: targetAccount,
        projectId,
        date: selectedDate,
        time: selectedTime,
      });
      onClose();
      return;
    }

    const transactionType = type as TransactionType;
    const inferredCategory = inferCategory(
      cleanName || category,
      transactionType,
      selectedCard,
      cards
    );
    const finalCategory =
      !categoryTouched && isExpense ? inferredCategory : category || inferredCategory;
    const title = cleanName || (isExpense ? categoryName(finalCategory) : "Income");
    const finalTitle = transactionType === "Income" ? `Person - ${title}` : title;
    const movement = resolveTransactionMovement({
      title: finalTitle,
      type: transactionType,
      method,
      selectedCard,
      category: finalCategory,
      person: isMoneyInEntry ? title : cleanName,
    });

    onSaveTransaction({
      title: finalTitle,
      amount: amountNumber,
      type: transactionType,
      method,
      section: "Account",
      selectedCard,
      category: isMoneyInEntry ? "👤 Person" : finalCategory,
      person: isMoneyInEntry ? title : cleanName,
      ...movement,
      projectId,
      date: selectedDate,
      time: selectedTime,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/35 px-3 pb-3 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="wallet-card max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[32px] bg-white p-5 text-black shadow-2xl dark:bg-neutral-900 dark:text-white"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-sheet-title"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300 dark:bg-white/20" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-500">
              Add
            </p>
            <h2 className="mt-1 text-2xl font-black">
              <span id="entry-sheet-title">
                {isBalance ? "Set Balance" : isTransfer ? "Transfer" : type}
              </span>
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-black text-neutral-500 dark:bg-white/10 dark:text-white/70"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["Expense", "Income", "Pay Out", "Pay In", "Transfer", "Balance"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={`rounded-2xl px-2 py-3 text-xs font-black transition active:scale-[0.97] ${
                type === item
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {isBalance ? (
            <>
              <input
                className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                aria-label="Cash balance"
                placeholder="Cash balance"
                inputMode="decimal"
                value={balanceDraft.cash}
                onChange={(event) =>
                  setBalanceDraft((current) => ({
                    ...current,
                    cash: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                aria-label="UPI balance"
                placeholder="Default UPI balance"
                inputMode="decimal"
                value={balanceDraft.upi}
                onChange={(event) =>
                  setBalanceDraft((current) => ({
                    ...current,
                    upi: event.target.value,
                  }))
                }
              />
              {upiBalanceLabels.map((label) => (
                <input
                  key={label}
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label={`${label} balance`}
                  placeholder={`${label} balance`}
                  inputMode="decimal"
                  value={balanceDraft.upis[label] || ""}
                  onChange={(event) =>
                    setBalanceDraft((current) => ({
                      ...current,
                      upis: {
                        ...current.upis,
                        [label]: event.target.value,
                      },
                    }))
                  }
                />
              ))}
              {cardBalanceLabels.map((label) => (
                <input
                  key={label}
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label={`${label} balance`}
                  placeholder={`${label} balance`}
                  inputMode="decimal"
                  value={balanceDraft.cards[label] || ""}
                  onChange={(event) =>
                    setBalanceDraft((current) => ({
                      ...current,
                      cards: {
                        ...current.cards,
                        [label]: event.target.value,
                      },
                    }))
                  }
                />
              ))}
            </>
          ) : (
            <>
              <input
                className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                aria-label={isTransfer ? "Transfer note" : isExpense ? "Expense name" : "Income payer"}
                placeholder={isTransfer ? "Transfer note" : isExpense ? "What did you pay for?" : "Who paid you?"}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                aria-label="Amount"
                placeholder="Amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />

              {!isTransfer && isExpense && (
                <select
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label="Expense category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setCategoryTouched(true);
                  }}
                >
                  {expenseCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMethod(item)}
                    className={`rounded-2xl p-3 text-sm font-black ${
                      method === item
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/60"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {method !== "Cash" && (
                <input
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label={isTransfer ? "From account" : "Payment source"}
                  list="entry-source-options"
                  placeholder={isTransfer ? "From account" : "Payment source"}
                  value={paymentSource}
                  onChange={(event) => setPaymentSource(event.target.value)}
                />
              )}

              {isTransfer && (
                <input
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label="To account"
                  list="entry-source-options"
                  placeholder="To account"
                  value={toSource}
                  onChange={(event) => setToSource(event.target.value)}
                />
              )}

              <datalist id="entry-source-options">
                {sourceOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>

              {projects.length > 0 && (
                <select
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label="Site"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  <option value="">No site</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label="Date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
                <input
                  className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-4 font-bold outline-none"
                  aria-label="Time"
                  type="time"
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                />
              </div>
            </>
          )}

          {error && (
            <p className="rounded-2xl bg-red-500/10 p-3 text-sm font-bold text-red-500">
              <span role="alert">{error}</span>
            </p>
          )}

          <button
            type="button"
            onClick={save}
            className="w-full rounded-3xl bg-black p-4 font-black text-white transition active:scale-[0.98] dark:bg-white dark:text-black"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
