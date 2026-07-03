import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions, secgenPassword } from "@/lib/session";
import { clientKey, rateLimit } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!rateLimit(`secgen:${clientKey(request)}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a minute." },
      { status: 429 },
    );
  }

  const { password } = await request.json();

  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!secgenPassword) {
    return NextResponse.json(
      { error: "Sec-Gen password not configured. Set SECGEN_PASSWORD in .env.local." },
      { status: 503 },
    );
  }
  if (!password || password !== secgenPassword) {
    return NextResponse.json({ error: "Invalid Sec-Gen password" }, { status: 401 });
  }

  session.isSecgen = true;
  await session.save();
  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.isSecgen = false;
  await session.save();
  return response;
}
