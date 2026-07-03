import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions, userPassword } from "@/lib/session";
import { clientKey, rateLimit } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!rateLimit(`login:${clientKey(request)}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a minute." },
      { status: 429 },
    );
  }

  const { password } = await request.json();
  const expectedPassword = userPassword;

  if (!password || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.isLoggedIn = true;
  await session.save();

  return response;
}
