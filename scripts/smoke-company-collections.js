#!/usr/bin/env node
/*
  Lightweight smoke helper for company collection architecture.
  Use with Firestore emulator when possible:
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-ledge node scripts/smoke-company-collections.js
*/

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-ledge";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const app = getApps()[0] || initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST || !clientEmail || !privateKey
    ? { projectId }
    : { credential: cert({ projectId, clientEmail, privateKey }) }
);
const db = getFirestore(app);

const emailA = "owner-a@example.com";
const emailB = "owner-b@example.com";
const collections = ["transactions", "sites", "workers", "materials", "bills", "reminders"];

async function seedCompany(companyId, email) {
  const companyRef = db.collection("companies").doc(companyId);
  await companyRef.set({ id: companyId, name: companyId, ownerEmail: email, plan: "Free" }, { merge: true });
  await companyRef.collection("members").doc(email).set({ email, role: "owner", status: "active", createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return companyRef;
}

async function main() {
  const companyA = await seedCompany("smoke-a", emailA);
  await seedCompany("smoke-b", emailB);

  for (const collectionName of collections) {
    const ref = await companyA.collection(collectionName).add({
      title: `Smoke ${collectionName}`,
      name: `Smoke ${collectionName}`,
      amount: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Failed to create ${collectionName}`);
  }

  await companyA.collection("auditLogs").add({
    action: "create",
    collection: "smoke",
    timestamp: FieldValue.serverTimestamp(),
  });

  console.log("Smoke passed: company collections + audit log can be created through Admin SDK.");
  console.log("Cross-company unauthorized checks must be validated with firestore.rules tests or client SDK + Auth emulator.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
