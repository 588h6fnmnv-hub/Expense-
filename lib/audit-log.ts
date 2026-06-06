import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { encodeFirestoreId } from "@/lib/saas";

export type AuditAction = "create" | "update" | "delete" | "migrate";

export type AuditLogEntry = {
  companyId: string;
  action: AuditAction;
  collection: string;
  documentId?: string;
  userId?: string;
  userEmail?: string;
  before?: unknown | null;
  after?: unknown | null;
};

export const logAuditEntry = async ({
  companyId,
  action,
  collection,
  documentId,
  userId,
  userEmail,
  before,
  after,
}: AuditLogEntry) => {
  const db = getAdminDb();
  if (!db) return;

  try {
    await db
      .collection("companies")
      .doc(encodeFirestoreId(companyId))
      .collection("auditLogs")
      .add({
        action,
        collection,
        documentId: documentId || null,
        userId: userId || userEmail || null,
        userEmail: userEmail || null,
        timestamp: FieldValue.serverTimestamp(),
        before: before === undefined ? null : before,
        after: after === undefined ? null : after,
      });
  } catch (error) {
    // Audit logging is best-effort and should not break business operations.
    // eslint-disable-next-line no-console
    console.error("audit-log failed", error);
  }
};
