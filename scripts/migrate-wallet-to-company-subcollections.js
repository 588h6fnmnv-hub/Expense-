#!/usr/bin/env node
/*
  Migrates legacy wallets/{userEmail}.wallet arrays into:
  companies/{companyId}/{transactions,sites,materials,reminders}

  Safe behavior:
  - Does not delete old wallets.
  - Uses deterministic doc ids where possible.
  - Can be run repeatedly.
  - Requires Firebase Admin env vars:
    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
*/

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.");
  process.exit(1);
}

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

const db = getFirestore(app);
const encodeId = (value) => encodeURIComponent(String(value || "").trim());
const memberIdForEmail = (email) => String(email || "").trim().toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);

const collectionMap = [
  ["transactions", "transactions"],
  ["projects", "sites"],
  ["materials", "materials"],
  ["reminders", "reminders"],
];

async function migrateWalletDoc(doc) {
  const data = doc.data() || {};
  const wallet = data.wallet || data;
  const companyId = wallet?.company?.id;
  const ownerEmail = String(wallet?.company?.ownerEmail || data.email || doc.id).toLowerCase();

  if (!companyId) {
    console.log(`Skipping ${doc.id}: no wallet.company.id`);
    return { skipped: 1, written: 0 };
  }

  const companyRef = db.collection("companies").doc(encodeId(companyId));
  const companyPayload = {
    id: companyId,
    name: wallet?.company?.name || "Ledge Company",
    ownerEmail,
    plan: wallet?.company?.plan || "Free",
    migratedFromWallet: doc.id,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await companyRef.set(
    {
      ...companyPayload,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await companyRef.collection("members").doc(memberIdForEmail(ownerEmail)).set(
    {
      id: memberIdForEmail(ownerEmail),
      companyId,
      email: ownerEmail,
      role: "owner",
      displayName: wallet?.profileName || "Owner",
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  let written = 0;
  let batch = db.batch();
  let batchCount = 0;

  const flush = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  };

  for (const [walletKey, collectionName] of collectionMap) {
    for (const item of asArray(wallet[walletKey])) {
      const id = encodeId(item?.id || `${walletKey}-${written}-${Date.now()}`);
      const ref = companyRef.collection(collectionName).doc(id);
      batch.set(
        ref,
        {
          ...item,
          id: item?.id || id,
          companyId,
          migratedFromWallet: doc.id,
          migratedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written += 1;
      batchCount += 1;

      if (batchCount >= 400) {
        await flush();
      }
    }
  }

  await companyRef.collection("auditLogs").add({
    action: "migrate",
    collection: "wallet",
    documentId: doc.id,
    userEmail: ownerEmail,
    timestamp: FieldValue.serverTimestamp(),
    before: null,
    after: { companyId, written },
  });

  await flush();
  console.log(`Migrated ${doc.id} -> companies/${companyId}: ${written} docs`);
  return { skipped: 0, written };
}

async function main() {
  const onlyWallet = process.argv.find((arg) => arg.startsWith("--wallet="))?.split("=")[1];
  const snap = onlyWallet
    ? { docs: [await db.collection("wallets").doc(onlyWallet).get()].filter((d) => d.exists) }
    : await db.collection("wallets").get();

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const doc of snap.docs) {
    const result = await migrateWalletDoc(doc);
    totalWritten += result.written;
    totalSkipped += result.skipped;
  }

  console.log(`Done. Written: ${totalWritten}. Skipped: ${totalSkipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
