import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const isFirebaseAdminConfigured = Boolean(
  projectId && clientEmail && privateKey
);

if (!isFirebaseAdminConfigured && process.env.NODE_ENV === "production") {
  console.warn("[firebase-admin] Missing credentials for production. Admin SDK will not be initialized.");
}

let adminDb: ReturnType<typeof getFirestore> | null = null;

export const getAdminDb = () => {
  if (adminDb) return adminDb;

  if (!isFirebaseAdminConfigured) {
    console.warn("[firebase-admin] Attempted to get Admin DB without configuration.");
    return null;
  }

  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey!,
      }),
    });

  adminDb = getFirestore(app);
  return adminDb;
};
