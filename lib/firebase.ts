import { getApp, getApps, initializeApp } from "firebase/app";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { WalletData } from "@/lib/types";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCxSi8UxXevpcWQUwpqEC_75g5HyV0scFc",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "expense-tracker-639ee.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "expense-tracker-639ee",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "expense-tracker-639ee.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "712137183047",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:712137183047:web:fc6f152efa8c2531154662",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "default";

export const firebaseDb = firebaseApp
  ? getFirestore(firebaseApp, firestoreDatabaseId)
  : null;

const walletDocId = (email: string) => encodeURIComponent(email.toLowerCase());

export const loadFirebaseWallet = async (email: string) => {
  if (!firebaseDb) {
    throw new Error("Firebase is not configured");
  }

  const snapshot = await getDoc(doc(firebaseDb, "wallets", walletDocId(email)));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data().wallet as Partial<WalletData> | null;
};

export const subscribeFirebaseWallet = (
  email: string,
  onWallet: (wallet: Partial<WalletData> | null) => void,
  onError?: () => void
) => {
  if (!firebaseDb) {
    throw new Error("Firebase is not configured");
  }

  return onSnapshot(
    doc(firebaseDb, "wallets", walletDocId(email)),
    (snapshot) => {
      onWallet(snapshot.exists() ? (snapshot.data().wallet as Partial<WalletData> | null) : null);
    },
    () => onError?.()
  );
};

export const saveFirebaseWallet = async ({
  email,
  username,
  wallet,
}: {
  email: string;
  username: string;
  wallet: WalletData;
}) => {
  if (!firebaseDb) {
    throw new Error("Firebase is not configured");
  }

  await setDoc(
    doc(firebaseDb, "wallets", walletDocId(email)),
    {
      email,
      username,
      wallet,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
