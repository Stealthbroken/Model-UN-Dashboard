/**
 * Session shape + iron-session config.
 *
 * Auth model: every person is an Executive row that may also carry an
 * *account* (username + passwordHash + accountRole). Sec-Gen access is a
 * permanent property of the account — there is no unlock prompt or shared PIN.
 *
 * `SESSION_PASSWORD` remains as a team-wide fallback so the club is never
 * locked out (see lib/auth.ts → resolveTeamPasswordRole for the rules).
 */
import { SessionOptions } from "iron-session";

/** Ordered least → most privileged. `secgen` and above see the Sec-Gen Panel. */
export type AccountRole = "member" | "secgen" | "owner";

export const ROLE_RANK: Record<AccountRole, number> = {
  member: 0,
  secgen: 1,
  owner: 2,
};

export const ROLE_LABEL: Record<AccountRole, string> = {
  member: "Member",
  secgen: "Secretary-General",
  owner: "Owner",
};

export function isAccountRole(v: unknown): v is AccountRole {
  return v === "member" || v === "secgen" || v === "owner";
}

/** True when the role may manage the roster, accounts, and integrations. */
export function roleCanSecgen(role: AccountRole | undefined | null): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK.secgen;
}

/** True when the role may grant/revoke other people's Sec-Gen access. */
export function roleCanManageAccounts(role: AccountRole | undefined | null): boolean {
  return !!role && ROLE_RANK[role] >= ROLE_RANK.secgen;
}

/** Only owners may change another *owner*, or hand out the owner role. */
export function roleCanManageOwners(role: AccountRole | undefined | null): boolean {
  return role === "owner";
}

export interface SessionData {
  isLoggedIn: boolean;
  /** Executive id of the signed-in account. Absent for team-password sessions. */
  userId?: string;
  /** Cached display name so the shell can render without a DB hit. */
  name?: string;
  /** Cached role. Privileged *writes* re-check against the DB (lib/auth.ts). */
  accountRole?: AccountRole;
  /** Signed in with the shared team password rather than a personal account. */
  viaTeamPassword?: boolean;
  /**
   * Legacy flag from the old shared-PIN model. Kept only so pre-existing
   * cookies deserialize cleanly; nothing reads it for authorization anymore.
   */
  isSecgen?: boolean;
}

// iron-session requires a 32+ char secret. We pad shorter passwords by repeating
// them so the team can use any password of any length they like.
function padPassword(pwd: string): string {
  if (!pwd) return "default-mun-dashboard-fallback-password-please-set-one";
  if (pwd.length >= 32) return pwd;
  let out = pwd;
  while (out.length < 32) out += pwd;
  return out;
}

export const sessionOptions: SessionOptions = {
  password: padPassword(process.env.SESSION_PASSWORD || ""),
  cookieName: "mun-dashboard-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
    // 30 days — the club signs in from shared school machines, so a long
    // session with an explicit "Log out" is friendlier than frequent re-auth.
    maxAge: 60 * 60 * 24 * 30,
  },
};

/** The shared team password (NOT padded) — compared verbatim at login. */
export const teamPassword = process.env.SESSION_PASSWORD || "";

export const defaultSession: SessionData = { isLoggedIn: false };
