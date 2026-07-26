import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";

import { prisma } from "@/lib/db";
import { SessionData, sessionOptions } from "@/lib/session";
import {
  findAccountByIdentifier,
  matchesTeamPassword,
  normalizeRole,
  resolveTeamPasswordRole,
  teamPasswordLoginAllowed,
  verifyPassword,
} from "@/lib/auth";

/**
 * Two ways in:
 *   1. Personal account — `{ identifier, password }`. Sec-Gen access follows
 *      the account's role, permanently.
 *   2. Shared team password — `{ password }`. A bootstrap/fallback path; it
 *      only carries Sec-Gen powers while no Sec-Gen account exists yet.
 */

// Simple in-memory throttle. Resets on deploy, which is fine — it exists to
// blunt online guessing, not to be an audit trail.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function throttleKey(request: NextRequest, identifier: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${ip}::${identifier}`;
}

function isThrottled(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  rec.count += 1;
}

export async function POST(request: NextRequest) {
  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  }

  const key = throttleKey(request, identifier.toLowerCase());
  if (isThrottled(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  // ── 1. Personal account ────────────────────────────────────────────────
  if (identifier) {
    const exec = await findAccountByIdentifier(identifier);
    const valid = exec ? await verifyPassword(password, exec.passwordHash) : false;

    if (!exec || !valid) {
      recordFailure(key);
      // Same message either way — don't reveal which usernames exist.
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    if (exec.accountActive === false) {
      return NextResponse.json(
        { error: "This account has been disabled. Ask a Secretary-General to re-enable it." },
        { status: 403 },
      );
    }

    attempts.delete(key);
    const role = normalizeRole(exec.accountRole);

    session.isLoggedIn = true;
    session.userId = exec.id;
    session.name = exec.name;
    session.accountRole = role;
    session.viaTeamPassword = false;
    await session.save();

    // Best-effort — a failed timestamp write shouldn't block sign-in.
    prisma.executive
      .update({ where: { id: exec.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {});

    return response;
  }

  // ── 2. Shared team password ────────────────────────────────────────────
  if (!(await teamPasswordLoginAllowed())) {
    return NextResponse.json(
      { error: "Team-password sign-in is off. Sign in with your own account." },
      { status: 403 },
    );
  }
  if (!matchesTeamPassword(password)) {
    recordFailure(key);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  attempts.delete(key);
  session.isLoggedIn = true;
  session.userId = undefined;
  session.name = "Team access";
  session.accountRole = await resolveTeamPasswordRole();
  session.viaTeamPassword = true;
  await session.save();

  return response;
}
