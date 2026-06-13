import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export type AuditEntry = {
  action: string;
  collection: string;
  documentId?: string;
  userId?: string;
  timestamp?: unknown;
  before?: unknown | null;
  after?: unknown | null;
};

export const logAudit = async (
  companyId: string,
  action: string,
  collection: string,
  documentId?: string,
  userId?: string,
  before?: unknown | null,
  after?: unknown | null
) => {
  const db = getAdminDb();
  if (!db) return;

  try {
    const col = db
      .collection("companies")
      .doc(encodeURIComponent(companyId))
      .collection("auditLogs");

    await col.add({
      action,
      collection,
      documentId: documentId || null,
      userId: userId || null,
      timestamp: FieldValue.serverTimestamp(),
      before: before || null,
      after: after || null,
    });
  } catch (err) {
    // Best-effort logging; swallow errors
    // eslint-disable-next-line no-console
    console.error("audit log failed", err);
  }
};
