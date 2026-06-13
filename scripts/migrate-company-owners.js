#!/usr/bin/env node
/*
  Migration script: populate companyOwners/{encodeURIComponent(email)} documents
  from existing companies collection.

  Usage:
    node scripts/migrate-company-owners.js           # dry-run (no writes)
    node scripts/migrate-company-owners.js --write   # actually write companyOwners docs

  Behavior:
  - Scans all documents in `companies`.
  - For each company with ownerEmail, computes ownerId = encodeURIComponent(ownerEmail.toLowerCase()).
  - If companyOwners/{ownerId} exists, it is not overwritten; logs duplicates.
  - Writes documents with { email, companyId, createdAt, migratedAt } when --write provided.
  - Logs summary at end.

  Requires Firebase Admin env vars:
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

async function migrate({ write }) {
  console.log(`Starting companyOwners migration (write=${write})`);

  const companiesSnap = await db.collection("companies").get();
  console.log(`Found ${companiesSnap.size} companies`);

  let written = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const doc of companiesSnap.docs) {
    const data = doc.data() || {};
    const companyId = data.id || doc.id;
    const ownerEmailRaw = data.ownerEmail || "";
    const ownerEmail = String(ownerEmailRaw || "").trim().toLowerCase();

    if (!ownerEmail) {
      console.log(`Skipping company ${companyId}: no ownerEmail`);
      skipped += 1;
      continue;
    }

    const ownerId = encodeId(ownerEmail);
    const ownerRef = db.collection("companyOwners").doc(ownerId);
    const ownerSnap = await ownerRef.get();

    if (ownerSnap.exists) {
      const existing = ownerSnap.data() || {};
      if (existing.companyId && existing.companyId !== companyId) {
        console.warn(`Duplicate ownerEmail: ${ownerEmail} -> existing company ${existing.companyId}, current company ${companyId}`);
        duplicates += 1;
      } else {
        console.log(`Skipping existing owner doc for ${ownerEmail} -> company ${existing.companyId || '(unknown)'}`);
      }
      skipped += 1;
      continue;
    }

    console.log(`Will create companyOwners/${ownerId} -> ${ownerEmail} => ${companyId}`);

    if (write) {
      await ownerRef.set(
        {
          email: ownerEmail,
          companyId: companyId,
          createdAt: FieldValue.serverTimestamp(),
          migratedAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );
      written += 1;
    }
  }

  console.log(`Done. written=${written}, skipped=${skipped}, duplicates=${duplicates}`);
}

async function main() {
  const writeFlag = process.argv.includes("--write");
  try {
    await migrate({ write: writeFlag });
    if (!writeFlag) {
      console.log("Dry-run complete. To apply changes, re-run with --write.");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
}

main();
