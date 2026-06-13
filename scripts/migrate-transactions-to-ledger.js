const { getAdminDb } = require("../lib/firebase-admin");
const { createBalancedJournalEntry, ensureDefaultAccounts } = require("../lib/services/accounting");

async function migrateTransactionsToLedger(companyId) {
  console.log(`Migrating transactions for company: ${companyId}`);

  await ensureDefaultAccounts(companyId);

  const db = getAdminDb();
  const txsSnapshot = await db.collection("companies").doc(companyId).collection("transactions").get();

  console.log(`Found ${txsSnapshot.size} transactions.`);

  for (const doc of txsSnapshot.docs) {
    const tx = doc.data();
    // Skip if already migrated or not a money transaction
    if (tx.migratedToLedger) continue;

    try {
      const amount = tx.amount;
      if (amount <= 0) continue;

      let debitAccount = "";
      let creditAccount = "";

      if (tx.type === "Income" || tx.type === "Pay In") {
        debitAccount = tx.method === "Cash" ? "Cash" : "Bank";
        creditAccount = tx.category === "👤 Person" ? "Accounts Receivable" : "Project Income";
      } else {
        creditAccount = tx.method === "Cash" ? "Cash" : "Bank";
        if (tx.category === "🏗️ Materials") debitAccount = "Material Expense";
        else if (tx.category === "👷 Worker Salary") debitAccount = "Labour Expense";
        else if (tx.category === "⛽ Petrol") debitAccount = "Petrol Expense";
        else debitAccount = "Other Expense";
      }

      await createBalancedJournalEntry({
        companyId,
        date: tx.date,
        reference: tx.title,
        notes: `Migrated from transaction ${doc.id}`,
        lines: [
          { accountId: encodeURIComponent(debitAccount), accountName: debitAccount, debit: amount, credit: 0 },
          { accountId: encodeURIComponent(creditAccount), accountName: creditAccount, debit: 0, credit: amount }
        ],
        sourceType: "transaction",
        sourceId: doc.id,
        createdBy: "system-migration",
      });

      await doc.ref.update({ migratedToLedger: true });
      console.log(`Migrated transaction ${doc.id}`);
    } catch (error) {
      console.error(`Failed to migrate transaction ${doc.id}:`, error.message);
    }
  }
}

// This is a template script. In a real scenario, we would iterate over all companies.
// For the purpose of this task, we will just provide the script.
if (require.main === module) {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error("Please provide a companyId");
    process.exit(1);
  }
  migrateTransactionsToLedger(companyId)
    .then(() => console.log("Migration complete"))
    .catch(err => console.error("Migration failed", err));
}
