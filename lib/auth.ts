/**
 * Server-side auth: session reads, account lookup, and role enforcement.
 *
 * Authorization rules in one place:
 *   - Reads are gated on `session.isLoggedIn` (middleware already redirects).
 *   - Privileged writes call `requireSecgen()`, which re-reads the account from
 *     the database rather than trusting the cookie. That way revoking someone's
 *     Sec-Gen access takes effect immediately instead of at their next login.
 */
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

import { prisma, type Executive } from "@/lib/db";
import {
  sessionOptions,
  teamPassword,
  isAccountRole,
  roleCanSecgen,
  type AccountRole,
  type SessionData,
} from "@/lib/session";

const BCRYPT_ROUNDS = 10;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** The signed-in person, resolved against the roster. */
export interface CurrentUser {
  id: string | null;
  name: string;
  role: AccountRole;
  /** Signed in with the shared team password instead of a personal account. */
  viaTeamPassword: boolean;
  canSecgen: boolean;
}

/* ─── Session ─────────────────────────────────────────────────────────────── */

/** Cookie-only session read. Cheap; safe for layout/nav rendering. */
export const getSession = cache(async (): Promise<SessionData> => {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  return {
    isLoggedIn: !!session.isLoggedIn,
    userId: session.userId,
    name: session.name,
    accountRole: isAccountRole(session.accountRole) ? session.accountRole : undefined,
    viaTeamPassword: !!session.viaTeamPassword,
  };
});

/**
 * Session + a fresh roster read, so the role reflects the database rather than
 * whatever was true when the cookie was minted. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.isLoggedIn) return null;

  if (session.userId) {
    const exec = await findExecById(session.userId);
    // Account deleted or login revoked mid-session → treat as signed out.
    if (!exec || !exec.accountActive || !exec.passwordHash) return null;
    const role = normalizeRole(exec.accountRole);
    return {
      id: exec.id,
      name: exec.name,
      role,
      viaTeamPassword: false,
      canSecgen: roleCanSecgen(role),
    };
  }

  // Team-password session: privilege depends on whether accounts exist yet.
  const role = await resolveTeamPasswordRole();
  return {
    id: null,
    name: "Team access",
    role,
    viaTeamPassword: true,
    canSecgen: roleCanSecgen(role),
  };
});

/* ─── Bootstrap / team-password rules ─────────────────────────────────────── */

/**
 * A team-password login is a *bootstrap* path, not a permanent back door:
 *
 *   - No Sec-Gen account exists yet → grant `owner`, so whoever installs the
 *     dashboard can create the first accounts. (Otherwise nobody could.)
 *   - At least one exists → grant `member`. From then on, Sec-Gen powers
 *     require a personal account, which is the whole point of the change.
 */
export const resolveTeamPasswordRole = cache(async (): Promise<AccountRole> => {
  return (await hasPrivilegedAccount()) ? "member" : "owner";
});

/** True once someone holds a usable Sec-Gen (or owner) account. */
export const hasPrivilegedAccount = cache(async (): Promise<boolean> => {
  const execs = await listAccountExecs();
  return execs.some(
    (e) => !!e.passwordHash && e.accountActive !== false && roleCanSecgen(normalizeRole(e.accountRole)),
  );
});

/** Whether signing in with the shared team password is still permitted. */
export async function teamPasswordLoginAllowed(): Promise<boolean> {
  if (!teamPassword) return false;
  // Always allowed while unclaimed, so a fresh install can be set up.
  if (!(await hasPrivilegedAccount())) return true;
  const row = await prisma.setting.findUnique({ where: { key: "allowTeamPassword" } });
  return row?.value !== "false";
}

/* ─── Roster helpers ─────────────────────────────────────────────────────── */

export function normalizeRole(v: unknown): AccountRole {
  return isAccountRole(v) ? v : "member";
}

/** All execs, cached per request — the roster is small enough to scan. */
export const listAccountExecs = cache(async (): Promise<Executive[]> => {
  return prisma.executive.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

async function findExecById(id: string): Promise<Executive | null> {
  const execs = await listAccountExecs();
  return execs.find((e) => e.id === id) ?? null;
}

/** Normalized login handle: trimmed, lowercased. */
export function normalizeUsername(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

/**
 * Resolve a typed identifier to an account. Accepts the username or the
 * account's email address, both case-insensitively — people type whichever
 * they remember.
 */
export async function findAccountByIdentifier(identifier: string): Promise<Executive | null> {
  const key = normalizeUsername(identifier);
  if (!key) return null;
  const execs = await listAccountExecs();
  return (
    execs.find((e) => normalizeUsername(e.username) === key) ??
    execs.find((e) => normalizeUsername(e.email) === key) ??
    null
  );
}

/** Suggests a free username from a name/email, e.g. "Ada Lovelace" → "ada.lovelace". */
export async function suggestUsername(nameOrEmail: string): Promise<string> {
  const raw = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const base =
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "member";

  const execs = await listAccountExecs();
  const taken = new Set(execs.map((e) => normalizeUsername(e.username)).filter(Boolean));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}.${randomBytes(3).toString("hex")}`;
}

/* ─── Passwords ───────────────────────────────────────────────────────────── */

export interface PasswordCheck {
  ok: boolean;
  error?: string;
}

/** Deliberately light: an 8-char floor, no character-class theatre. */
export function validatePassword(pwd: unknown): PasswordCheck {
  if (typeof pwd !== "string" || pwd.length === 0) {
    return { ok: false, error: "Enter a password." };
  }
  if (pwd.length < 8) {
    return { ok: false, error: "Use at least 8 characters." };
  }
  if (pwd.length > 200) {
    return { ok: false, error: "That password is too long." };
  }
  return { ok: true };
}

export async function hashPassword(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, BCRYPT_ROUNDS);
}

export async function verifyPassword(pwd: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(pwd, hash);
  } catch {
    return false;
  }
}

/** Constant-time compare for the shared team password. */
export function matchesTeamPassword(candidate: unknown): boolean {
  if (!teamPassword || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(teamPassword);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ─── Invite tokens ───────────────────────────────────────────────────────── */

export interface IssuedInvite {
  /** Raw token — goes in the emailed link and is never stored. */
  token: string;
  /** SHA-256 of the token — this is what lands in the database. */
  tokenHash: string;
  expiresAt: Date;
}

export function issueInviteToken(): IssuedInvite {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Finds the account a raw invite token belongs to, if it hasn't expired. */
export async function findAccountByInviteToken(token: string): Promise<Executive | null> {
  if (!token) return null;
  const tokenHash = hashInviteToken(token);
  const execs = await prisma.executive.findMany({});
  const exec = execs.find((e) => e.inviteTokenHash === tokenHash);
  if (!exec) return null;
  if (!exec.inviteExpiresAt || exec.inviteExpiresAt.getTime() < Date.now()) return null;
  return exec;
}

export function inviteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/invite/${token}`;
}

/* ─── Route guards ────────────────────────────────────────────────────────── */

/** 401 unless signed in. Returns the user on success. */
export async function requireUser(): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { user };
}

/**
 * 403 unless the signed-in account currently holds Sec-Gen. Re-reads the
 * roster, so a demotion applies to in-flight sessions immediately.
 */
export async function requireSecgen(): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (!user.canSecgen) {
    return {
      error: NextResponse.json(
        { error: "Sec-Gen access required. Ask a Secretary-General to grant it to your account." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

/** 403 unless the account is an owner — required to touch other owners. */
export async function requireOwner(): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (user.role !== "owner") {
    return { error: NextResponse.json({ error: "Owner access required" }, { status: 403 }) };
  }
  return { user };
}

/** Narrowing helper so routes can write `if (isDenied(gate)) return gate.error`. */
export function isDenied<T>(gate: { error: NextResponse } | T): gate is { error: NextResponse } {
  return typeof gate === "object" && gate !== null && "error" in gate;
}
