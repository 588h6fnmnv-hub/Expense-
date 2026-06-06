export const isMoneyIn = (tx) => tx.type === "Income" || tx.type === "Pay In";
export const isMoneyOut = (tx) => tx.type === "Expense" || tx.type === "Pay Out";

export const materialValue = (material) => {
  const quantity = material.usedQuantity && material.usedQuantity > 0
    ? material.usedQuantity
    : material.quantity;
  return Math.max(0, Number(quantity || 0)) * Math.max(0, Number(material.rate || 0));
};

export const siteFinancialSummary = ({
  project,
  transactions,
  materials,
  workers,
}) => {
  const projectTransactions = transactions.filter((tx) => tx.projectId === project.id);
  const incomeReceived = projectTransactions
    .filter(isMoneyIn)
    .reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const materialTransactions = projectTransactions
    .filter((tx) => isMoneyOut(tx) && tx.category === "🏗️ Materials")
    .reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const materialInventory = materials
    .filter((material) => material.projectId === project.id)
    .reduce((total, material) => total + materialValue(material), 0);
  const workerTransactions = projectTransactions
    .filter((tx) => isMoneyOut(tx) && tx.category === "👷 Worker Salary")
    .reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const workerLedger = workers.reduce(
    (total, worker) =>
      total +
      (worker.entries || [])
        .filter((entry) => entry.projectId === project.id && entry.direction === "Debit")
        .reduce((entryTotal, entry) => entryTotal + Number(entry.amount || 0), 0),
    0
  );
  const directExpenses = projectTransactions
    .filter(
      (tx) =>
        isMoneyOut(tx) &&
        tx.category !== "🏗️ Materials" &&
        tx.category !== "👷 Worker Salary"
    )
    .reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const extras = (project.extras || []).reduce(
    (total, extra) => total + Number(extra.amount || 0),
    0
  );
  const materialExpenses = Math.max(materialTransactions, materialInventory);
  const workerPayments = workerTransactions + workerLedger;
  const expenses = directExpenses + materialExpenses + workerPayments;
  const contractTotal = Number(project.budget || 0) + extras;

  return {
    budget: Number(project.budget || 0),
    incomeReceived,
    materialExpenses,
    workerPayments,
    expenses,
    profitLoss: incomeReceived - expenses,
    pendingFromCustomer: Math.max(contractTotal - incomeReceived, 0),
  };
};

export const transactionDuplicateKey = (tx) =>
  [
    (tx.sourceId || "").toLowerCase(),
    (tx.title || tx.person || tx.toAccount || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    Number(tx.amount || 0).toFixed(2),
    tx.date || "",
    tx.projectId || "",
  ].join("|");

export const isPossibleDuplicateTransaction = (tx, existing) => {
  const key = transactionDuplicateKey(tx);
  return existing.some((saved) => transactionDuplicateKey(saved) === key);
};

export const isPlanLimitReached = (limit, currentCount) =>
  Number(limit) >= 0 && currentCount >= Number(limit);

export const canRoleAccess = (role, permission) => {
  if (role === "owner" || role === "admin") return true;
  if (role === "supervisor") {
    return [
      "sites:read",
      "materials:read",
      "workers:read",
      "dailyReports:read",
      "dailyReports:write",
      "reminders:read",
    ].includes(permission);
  }
  if (role === "worker") {
    return ["sites:read", "dailyReports:read", "dailyReports:write"].includes(permission);
  }
  return false;
};

export const syncMaterialExpenseDraft = ({ tx, materials, companyId }) => {
  if (
    tx.category !== "🏗️ Materials" ||
    (tx.type !== "Expense" && tx.type !== "Pay Out")
  ) {
    return materials;
  }

  const name = (tx.title || "Material").trim();
  const projectId = tx.projectId || "";
  const index = materials.findIndex(
    (material) =>
      material.name.toLowerCase() === name.toLowerCase() &&
      (material.projectId || "") === projectId
  );

  if (index >= 0) {
    return materials.map((material, materialIndex) =>
      materialIndex === index
        ? {
            ...material,
            quantity: Number(material.quantity || 0) + 1,
            usedQuantity: Number(material.usedQuantity || 0) + 1,
          }
        : material
    );
  }

  return [
    ...materials,
    {
      id: "test-material",
      companyId,
      projectId,
      category: "Other",
      name,
      quantity: 1,
      usedQuantity: 1,
      lowStockAt: 0,
      unit: "entry",
      rate: Number(tx.amount || 0),
      supplier: tx.person || tx.toAccount || "",
      date: tx.date,
      note: "Synced from material expense",
    },
  ];
};
