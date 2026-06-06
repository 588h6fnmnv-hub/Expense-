import { NextResponse } from "next/server";

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const parseJsonObject = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }

  return body as Record<string, unknown>;
};

export const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export const errorStatus = (error: unknown) => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : 500;
};

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

export const jsonRouteError = (error: unknown) =>
  jsonError(errorMessage(error), errorStatus(error));
