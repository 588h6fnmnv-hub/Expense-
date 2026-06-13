import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

const ipFor = (request: NextRequest) =>
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

const limitsForPath = (path: string) => {
  if (path.startsWith("/api/auth")) return 20;
  if (path.includes("/join") || path.includes("/invite")) return 30;
  if (path.includes("ai") || path.includes("generation")) return 20;
  if (path.startsWith("/api/")) return 180;
  return 300;
};

const isLimited = (key: string, limit: number) => {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const current = (buckets.get(key) || []).filter((time) => time >= cutoff);
  current.push(now);
  buckets.set(key, current);
  return current.length > limit;
};

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const proto = request.headers.get("x-forwarded-proto");

  if (process.env.NODE_ENV === "production" && proto && proto !== "https") {
    const httpsUrl = nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  if (nextUrl.pathname.startsWith("/api/")) {
    const key = `${ipFor(request)}:${nextUrl.pathname}`;
    if (isLimited(key, limitsForPath(nextUrl.pathname))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
