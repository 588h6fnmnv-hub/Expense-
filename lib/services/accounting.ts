import {
  JournalEntry,
  LedgerEntry,
  Account
} from "@/lib/types";
import {
  companyCollectionRef,
  encodeFirestoreId
} from "@/lib/saas";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Creates a balanced journal entry and posts to the ledger.
 */
export async function createBalancedJournalEntry({
  companyId,
  date,
  reference,
  notes,
  lines,
  sourceType,
  sourceId,
  createdBy,
}: Omit<JournalEntry, "id">) {
  // 1. Validate balance
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`);
  }

  const journalRef = companyCollectionRef(companyId, "journal")!;
  const ledgerRef = companyCollectionRef(companyId, "ledger")!;
  const accountRef = companyCollectionRef(companyId, "accounts")!;

  const journalDoc = journalRef.doc();
  const journalId = journalDoc.id;

  const journalEntry: JournalEntry = {
    id: journalId,
    companyId,
    date,
    reference,
    notes,
    lines,
    sourceType,
    sourceId,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
  };

  // Use a transaction for atomic updates
  const db = journalRef.firestore;
  await db.runTransaction(async (transaction) => {
    // 2. Save journal entry
    transaction.set(journalDoc, journalEntry);

    // 3. Update account balances and create ledger entries
    for (const line of lines) {
      const accDocRef = accountRef.doc(encodeFirestoreId(line.accountId));
      const accDoc = await transaction.get(accDocRef);

      if (!accDoc.exists) {
        throw new Error(`Account not found: ${line.accountId}`);
      }

      const accountData = accDoc.data() as Account;
      const amount = line.debit - line.credit;
      const newBalance = accountData.balance + amount;

      // Update account balance
      transaction.update(accDocRef, {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Create ledger entry
      const ledgerDoc = ledgerRef.doc();
      const ledgerEntry: LedgerEntry = {
        id: ledgerDoc.id,
        companyId,
        accountId: line.accountId,
        date,
        journalEntryId: journalId,
        debit: line.debit,
        credit: line.credit,
        balance: newBalance,
        note: line.note || notes,
        createdAt: FieldValue.serverTimestamp(),
      };
      transaction.set(ledgerDoc, ledgerEntry);
    }
  });

  return journalEntry;
}

/**
 * Auto-create accounts if they don't exist.
 */
export async function ensureDefaultAccounts(companyId: string) {
  const accountRef = companyCollectionRef(companyId, "accounts")!;

  const defaults: Omit<Account, "id" | "companyId" | "balance">[] = [
    { name: "Cash", type: "Asset", isGroup: false },
    { name: "Bank", type: "Asset", isGroup: false },
    { name: "Accounts Receivable", type: "Asset", isGroup: false },
    { name: "Inventory", type: "Asset", isGroup: false },
    { name: "Accounts Payable", type: "Liability", isGroup: false },
    { name: "Sales", type: "Income", isGroup: false },
    { name: "Project Income", type: "Income", isGroup: false },
    { name: "Material Expense", type: "Expense", isGroup: false },
    { name: "Labour Expense", type: "Expense", isGroup: false },
    { name: "Petrol Expense", type: "Expense", isGroup: false },
    { name: "Other Expense", type: "Expense", isGroup: false },
    { name: "Equity", type: "Equity", isGroup: false },
  ];

  for (const def of defaults) {
    const docId = encodeFirestoreId(def.name);
    const docRef = accountRef.doc(docId);
    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({
        ...def,
        id: docId,
        companyId,
        balance: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
}
