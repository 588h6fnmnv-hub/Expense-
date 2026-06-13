import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

export const cleanCompanyId = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 80) : "";

export const isValidCompanyId = (value: string) =>
  Boolean(value) && /^[A-Za-z0-9_-]+$/.test(value);

export const requireValidCompanyId = (value: unknown) => {
  const companyId = cleanCompanyId(value);

  if (!isValidCompanyId(companyId)) {
    throw Object.assign(new Error("companyId is invalid"), { status: 400 });
  }

  return companyId;
};

export const cleanDisplayText = (value: unknown, max = 240) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/<\/?script\b[^>]*>/gi, "")
        .trim()
        .slice(0, max)
    : "";

const MAX_JSON_BODY_BYTES = 1_000_000;

export const parseJsonObject = async (request: Request) => {
  const contentType = request.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Content-Type must be application/json"), { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw Object.assign(new Error("Request body is too large"), { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }

  return body as Record<string, unknown>;
};

export const getClientIp = (request: Request) =>
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type SecurityEventType =
  | "auth_attempt"
  | "auth_failure"
  | "api_error"
  | "rate_limit"
  | "suspicious_traffic";

export const logSecurityEvent = async ({
  type,
  request,
  companyId,
  userEmail,
  metadata,
}: {
  type: SecurityEventType;
  request?: Request;
  companyId?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
}) => {
  const db = getAdminDb();
  if (!db) return;

  try {
    await db.collection("securityEvents").add({
      type,
      companyId: companyId || null,
      userEmail: userEmail || null,
      ipHash: request ? sha256(getClientIp(request)) : null,
      userAgent: request?.headers.get("user-agent")?.slice(0, 300) || null,
      path: request ? new URL(request.url).pathname : null,
      metadata: metadata || {},
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Security logging is best-effort and must never break the request path.
  }
};

export const enforceRateLimit = async ({
  request,
  key,
  limit,
  windowMs,
  userEmail,
}: {
  request: Request;
  key: string;
  limit: number;
  windowMs: number;
  userEmail?: string;
}) => {
  const db = getAdminDb();
  if (!db) return;

  const now = Date.now();
  const cutoff = now - windowMs;
  const ipHash = sha256(getClientIp(request));
  const safeKey = `${key}:${ipHash}:${userEmail ? sha256(userEmail) : "anon"}`.slice(0, 400);
  const ref = db.collection("securityEvents").doc("rateLimits").collection("buckets").doc(safeKey);

  const exceeded = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const raw = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    const attempts = Array.isArray(raw?.attempts)
      ? (raw.attempts as unknown[]).filter((t) => typeof t === "number" && t >= cutoff)
      : [];
    const updated = [...attempts, now];
    tx.set(ref, { key, attempts: updated, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return updated.length > limit;
  });

  if (exceeded) {
    await logSecurityEvent({
      type: "rate_limit",
      request,
      userEmail,
      metadata: { key, limit, windowMs },
    });
    throw Object.assign(new Error("Too many requests. Please try again later."), { status: 429 });
  }
};

const sensitiveKeys = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
  "privateKey",
  "authorization",
  "cookie",
  "referralCode",
  "inviteLink",
  "inviteToken",
  "code",
]);

export const redactSensitive = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeys.has(key) || /token|secret|password|private|credential|referral|invite|code/i.test(key)
        ? "[REDACTED]"
        : redactSensitive(item),
    ])
  );
};

export const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export const errorStatus = (error: unknown) => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : 500;
};

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

export const jsonRouteError = async (error: unknown, request?: Request) => {
  const status = errorStatus(error);
  if (status >= 500 || status === 401 || status === 403 || status === 429) {
    await logSecurityEvent({
      type: status === 429 ? "rate_limit" : status >= 500 ? "api_error" : "auth_failure",
      request,
      metadata: { status, message: errorMessage(error) },
    });
  }
  return jsonError(errorMessage(error), status);
};
