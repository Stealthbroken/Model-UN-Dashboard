import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions, userPassword } from "@/lib/session";

export async function POST(request: NextRequest) {
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
