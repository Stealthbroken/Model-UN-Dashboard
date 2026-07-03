import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Route-handler auth guards. The middleware only protects pages (its matcher
 * excludes /api), so every API route must check the session itself.
 *
 * Usage:
 *   const denied = await requireLogin();
 *   if (denied) return denied;
 */
export async function requireLogin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return null;
}

export async function requireSecgen(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session.isSecgen) {
    return NextResponse.json({ error: "Sec-Gen access required" }, { status: 403 });
  }
  return null;
}

/**
 * Cron endpoints can't carry a session cookie. If CRON_SECRET is set, the
 * caller must send it in the x-cron-secret header; if unset, the endpoint
 * stays open (fine for a localhost-only cron loop).
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ─── Naive in-memory rate limiter ──────────────────────────────────────────
// Good enough for a single-node deployment guarding password endpoints.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

export function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
