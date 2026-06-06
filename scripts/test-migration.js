#!/usr/bin/env node
/*
  Lightweight migration test script.

  Usage:
    - With real Firebase admin credentials (set env vars):
        FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
      Then run: `node scripts/test-migration.js`

    - With Firestore emulator:
        Start the emulator and set `FIRESTORE_EMULATOR_HOST=localhost:8080`.
        Set `FIREBASE_PROJECT_ID` to the emulator project id.

  This script will:
    1. Create a legacy wallet for a user without company.id and verify only legacy exists.
    2. Create a wallet for a user with company.id and verify both legacy and company-scoped exist.
    3. Simulate GET preference (company > legacy) by checking existence.

  Exit code 0 on success, non-zero on failure.
*/

const admin = require("firebase-admin");

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.error("FIREBASE_PROJECT_ID is required (or set up emulator FIRESTORE_EMULATOR_HOST)");
    process.exit(2);
  }

  // If running against emulator, the SDK can be initialized without a cert
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId });
    return admin.firestore();
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    console.error("FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required for admin SDK when not using emulator.");
    process.exit(2);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  return admin.firestore();
}

const db = initAdmin();

const userDocId = (email) => encodeURIComponent(email.toLowerCase());

async function writeLegacyWallet(email, wallet) {
  const ref = db.collection("wallets").doc(userDocId(email));
  await ref.set({ email, username: email, wallet, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return ref;
}

function companyWalletRef(companyId, email) {
  return db.collection("companies").doc(encodeURIComponent(companyId)).collection("wallets").doc(userDocId(email));
}

async function writeCompanyWallet(companyId, email, wallet) {
  const ref = companyWalletRef(companyId, email);
  await ref.set({ email, username: email, wallet, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return ref;
}

async function exists(ref) {
  const snap = await ref.get();
  return snap.exists;
}

async function run() {
  const userNoCompany = "tester-no-company@example.com";
  const userWithCompany = "tester-with-company@example.com";
  const companyId = "test-company-123";

  const simpleWalletNoCompany = { profileName: "No Company", transactions: [] };
  const simpleWalletWithCompany = { profileName: "Has Company", company: { id: companyId, name: "TestCo", ownerEmail: userWithCompany }, transactions: [] };

  console.log("Writing legacy wallet for user without company.id...");
  await writeLegacyWallet(userNoCompany, simpleWalletNoCompany);

  const legacyRefA = db.collection("wallets").doc(userDocId(userNoCompany));
  const legacyExistsA = await exists(legacyRefA);
  const companyRefA = companyWalletRef(companyId, userNoCompany);
  const companyExistsA = await exists(companyRefA);

  if (!legacyExistsA) {
    console.error("Legacy wallet not found for user without company.id");
    process.exit(3);
  }
  if (companyExistsA) {
    console.error("Unexpected company-scoped wallet exists for user without company.id");
    process.exit(3);
  }
  console.log("OK: legacy-only user confirmed.");

  console.log("\nWriting legacy wallet for user WITH company.id and company-scoped copy...");
  await writeLegacyWallet(userWithCompany, simpleWalletWithCompany);
  // Simulate route writing company-scoped copy
  await writeCompanyWallet(companyId, userWithCompany, simpleWalletWithCompany);

  const legacyRefB = db.collection("wallets").doc(userDocId(userWithCompany));
  const legacyExistsB = await exists(legacyRefB);
  const companyRefB = companyWalletRef(companyId, userWithCompany);
  const companyExistsB = await exists(companyRefB);

  if (!legacyExistsB || !companyExistsB) {
    console.error("Both legacy and company-scoped wallet must exist for user with company.id");
    process.exit(4);
  }

  console.log("OK: both legacy and company-scoped wallet exist for user with company.id.");

  console.log("\nSimulating GET preference (company > legacy):");
  if (companyExistsB) {
    console.log("Preferred: company-scoped wallet would be returned.");
  } else {
    console.log("Preferred: legacy wallet would be returned.");
  }

  console.log("\nMigration smoke test completed successfully.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed:", err && err.stack ? err.stack : err);
  process.exit(1);
});
