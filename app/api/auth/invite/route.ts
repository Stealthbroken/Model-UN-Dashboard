import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";

import { SessionData, sessionOptions } from "@/lib/session";
import { findAccountByInviteToken, normalizeRole, validatePassword } from "@/lib/auth";
import { completeInvite } from "@/lib/accounts";

const INVALID = "This invite link is invalid or has expired. Ask a Secretary-General to resend it.";

/** GET ?token= — validate a link before showing the set-password form. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const exec = await findAccountByInviteToken(token);
  if (!exec) return NextResponse.json({ valid: false, error: INVALID }, { status: 404 });

  return NextResponse.json({
    valid: true,
    name: exec.name,
    username: exec.username,
    accountRole: normalizeRole(exec.accountRole),
    /** True when they already had a password — i.e. this is a reset, not a first setup. */
    isReset: !!exec.passwordHash,
  });
}

/** POST { token, password } — consume the invite, set the password, sign in. */
export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({}));
  const token = typeof data.token === "string" ? data.token : "";
  const password = typeof data.password === "string" ? data.password : "";

  const exec = await findAccountByInviteToken(token);
  if (!exec) return NextResponse.json({ error: INVALID }, { status: 404 });

  const check = validatePassword(password);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  await completeInvite(exec.id, password);

  // Sign them straight in — no reason to make them retype what they just chose.
  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.isLoggedIn = true;
  session.userId = exec.id;
  session.name = exec.name;
  session.accountRole = normalizeRole(exec.accountRole);
  session.viaTeamPassword = false;
  await session.save();

  return response;
}
