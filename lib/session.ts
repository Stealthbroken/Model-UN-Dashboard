import { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
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
  },
};

// The actual user-typed password (NOT padded) — used for login comparison
export const userPassword = process.env.SESSION_PASSWORD || "";

// Optional separate password that grants Sec-Gen privileges (managing
// executives, configuring shared drive). If unset, the panel cannot be
// unlocked — set it in .env.local to enable.
export const secgenPassword = process.env.SECGEN_PASSWORD || "";

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

// Server-side helper: read the current session in RSCs / route handlers.
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

export async function getSession(): Promise<SessionData> {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  return {
    isLoggedIn: !!session.isLoggedIn,
    isSecgen: !!session.isSecgen,
  };
}
