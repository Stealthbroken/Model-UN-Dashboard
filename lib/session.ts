import { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
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

export const defaultSession: SessionData = {
  isLoggedIn: false,
};
