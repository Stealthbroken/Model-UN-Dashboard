/**
 * Guard for the cron endpoints.
 *
 * These are triggered by an internal fetch from server.js, but they live at
 * public URLs and they send email / post to Classroom — so an open POST is a
 * spam vector. Two ways to authorize:
 *
 *   1. `CRON_SECRET` is set → require `Authorization: Bearer <secret>`.
 *      This is the right setup in production; server.js sends the header.
 *   2. `CRON_SECRET` is unset → accept loopback-looking requests only. A proxy
 *      (Render, any CDN) always sets x-forwarded-for on external traffic, so
 *      this keeps local development zero-config without exposing production.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export function cronRequestAllowed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";

  if (secret) {
    const header = request.headers.get("authorization") || "";
    const prefix = "Bearer ";
    if (!header.startsWith(prefix)) return false;
    return safeEqual(header.slice(prefix.length), secret);
  }

  // No secret configured — accept only what looks like an internal call.
  if (request.headers.get("x-forwarded-for")) return false;
  const host = (request.headers.get("host") || "").toLowerCase();
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:") || host === "localhost";
}

/** Returns a 401 response when the request isn't an authorized cron trigger. */
export function denyCron(request: NextRequest): NextResponse | null {
  if (cronRequestAllowed(request)) return null;
  return NextResponse.json(
    { error: "This endpoint is triggered internally. Set CRON_SECRET to call it remotely." },
    { status: 401 },
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
