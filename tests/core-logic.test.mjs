import test from "node:test";
import assert from "node:assert/strict";
import {
  isPlanLimitReached,
  isPossibleDuplicateTransaction,
  canRoleAccess,
  siteFinancialSummary,
  syncMaterialExpenseDraft,
} from "../lib/helpers/core-logic.mjs";

test("siteFinancialSummary calculates income, expenses, profit, and pending customer amount", () => {
  const summary = siteFinancialSummary({
    project: { id: "site-1", budget: 100000, extras: [{ amount: 10000 }] },
    transactions: [
      { projectId: "site-1", type: "Income", amount: 60000 },
      { projectId: "site-1", type: "Expense", category: "🏗️ Materials", amount: 12000 },
      { projectId: "site-1", type: "Expense", category: "👷 Worker Salary", amount: 8000 },
      { projectId: "site-1", type: "Expense", category: "❔ Other", amount: 3000 },
    ],
    materials: [{ projectId: "site-1", quantity: 10, usedQuantity: 10, rate: 1000 }],
    workers: [{ entries: [{ projectId: "site-1", direction: "Debit", amount: 4000 }] }],
  });

  assert.equal(summary.incomeReceived, 60000);
  assert.equal(summary.materialExpenses, 12000);
  assert.equal(summary.workerPayments, 12000);
  assert.equal(summary.expenses, 27000);
  assert.equal(summary.profitLoss, 33000);
  assert.equal(summary.pendingFromCustomer, 50000);
});

test("material expense sync creates and updates material rows", () => {
  const tx = {
    title: "Cement",
    amount: 5000,
    type: "Expense",
    category: "🏗️ Materials",
    projectId: "site-1",
    date: "2026-05-15",
  };
  const created = syncMaterialExpenseDraft({ tx, materials: [], companyId: "company-1" });
  assert.equal(created.length, 1);
  assert.equal(created[0].name, "Cement");
  assert.equal(created[0].projectId, "site-1");

  const updated = syncMaterialExpenseDraft({ tx, materials: created, companyId: "company-1" });
  assert.equal(updated[0].quantity, 2);
  assert.equal(updated[0].usedQuantity, 2);
});

test("duplicate transaction detection uses title, amount, date, source, and project", () => {
  const saved = [
    {
      sourceId: "gmail:1",
      title: "ABC Cement",
      amount: 1200,
      date: "2026-05-15",
      projectId: "site-1",
    },
  ];

  assert.equal(
    isPossibleDuplicateTransaction(
      {
        sourceId: "gmail:1",
        title: "ABC Cement",
        amount: 1200,
        date: "2026-05-15",
        projectId: "site-1",
      },
      saved
    ),
    true
  );
});

test("plan limit enforcement blocks only finite reached limits", () => {
  assert.equal(isPlanLimitReached(5, 5), true);
  assert.equal(isPlanLimitReached(5, 4), false);
  assert.equal(isPlanLimitReached(-1, 1000), false);
});

test("role permission assumptions keep workers scoped to own work area", () => {
  assert.equal(canRoleAccess("worker", "dailyReports:write"), true);
  assert.equal(canRoleAccess("worker", "finance:read"), false);
  assert.equal(canRoleAccess("supervisor", "settings:read"), false);
});
