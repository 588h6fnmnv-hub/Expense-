import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const isFirebaseAdminConfigured = Boolean(
  projectId && clientEmail && privateKey
);

let adminDb: ReturnType<typeof getFirestore> | null = null;

export const getAdminDb = () => {
  if (adminDb) return adminDb;

  if (!isFirebaseAdminConfigured) {
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
