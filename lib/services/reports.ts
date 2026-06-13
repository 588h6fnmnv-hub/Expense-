import { LedgerEntry, Account } from "@/lib/types";
import { companyCollectionRef } from "@/lib/saas";

/**
 * Calculates Profit & Loss for a given period.
 */
export async function getProfitAndLoss(companyId: string, startDate: string, endDate: string) {
  const ledgerRef = companyCollectionRef(companyId, "ledger")!;
  const accountRef = companyCollectionRef(companyId, "accounts")!;

  // 1. Get all accounts
  const accountsSnapshot = await accountRef.get();
  const accounts = accountsSnapshot.docs.map(doc => doc.data() as Account);

  const incomeAccounts = accounts.filter(a => a.type === "Income");
  const expenseAccounts = accounts.filter(a => a.type === "Expense");

  // 2. Get ledger entries for the period
  const ledgerSnapshot = await ledgerRef
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  const entries = ledgerSnapshot.docs.map(doc => doc.data() as LedgerEntry);

  const calculateTotal = (accountIds: string[]) => {
    return entries
      .filter(e => accountIds.includes(e.accountId))
      .reduce((sum, e) => sum + (e.credit - e.debit), 0); // Income is credit - debit
  };

  const calculateExpenseTotal = (accountIds: string[]) => {
    return entries
      .filter(e => accountIds.includes(e.accountId))
      .reduce((sum, e) => sum + (e.debit - e.credit), 0); // Expense is debit - credit
  };

  const incomeDetails = incomeAccounts.map(a => ({
    name: a.name,
    total: calculateTotal([a.id])
  }));

  const expenseDetails = expenseAccounts.map(a => ({
    name: a.name,
    total: calculateExpenseTotal([a.id])
  }));

  const totalIncome = incomeDetails.reduce((sum, d) => sum + d.total, 0);
  const totalExpense = expenseDetails.reduce((sum, d) => sum + d.total, 0);

  return {
    period: { startDate, endDate },
    income: incomeDetails,
    expenses: expenseDetails,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense
  };
}

/**
 * Generates a Balance Sheet.
 */
export async function getBalanceSheet(companyId: string, date: string) {
  const accountRef = companyCollectionRef(companyId, "accounts")!;
  const accountsSnapshot = await accountRef.get();
  const accounts = accountsSnapshot.docs.map(doc => doc.data() as Account);

  const assets = accounts.filter(a => a.type === "Asset");
  const liabilities = accounts.filter(a => a.type === "Liability");
  const equity = accounts.filter(a => a.type === "Equity");

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

  return {
    date,
    assets: assets.map(a => ({ name: a.name, balance: a.balance })),
    liabilities: liabilities.map(a => ({ name: a.name, balance: a.balance })),
    equity: equity.map(a => ({ name: a.name, balance: a.balance })),
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
}
