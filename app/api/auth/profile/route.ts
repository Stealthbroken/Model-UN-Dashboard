import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/db";
import { SessionData, sessionOptions, getSession } from "@/lib/session";
import { requireLogin } from "@/lib/auth";

/**
 * The "lightweight profile" — which executive this browser is acting as.
 * Stored in the session cookie so it survives across visits and can be read
 * server-side. Optionally gated by a per-exec bcrypt PIN.
 *
 *   GET    → { executiveId, name }               current profile (or nulls)
 *   POST   { executiveId, pin? }                 switch profile (verifies PIN)
 *   DELETE                                       clear profile ("switch user")
 *   PATCH  { newPin, currentPin? }               set/change/remove your PIN
 */

async function readExec(id: string) {
  try {
    return await prisma.executive.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

export async function GET() {
  const denied = await requireLogin();
  if (denied) return denied;
  const session = await getSession();
  const id = session.executiveId;
  if (!id) return NextResponse.json({ executiveId: null, name: null });
  const exec = await readExec(id);
  return NextResponse.json({
    executiveId: exec ? id : null,
    name: exec?.name ?? null,
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireLogin();
  if (denied) return denied;

  const { executiveId, pin } = await request.json();
  if (!executiveId || typeof executiveId !== "string") {
    return NextResponse.json({ error: "executiveId is required" }, { status: 400 });
  }

  const exec = await readExec(executiveId);
  if (!exec) return NextResponse.json({ error: "Unknown executive" }, { status: 404 });

  const pinHash = (exec as { pinHash?: string | null }).pinHash;
  if (pinHash) {
    if (!pin || typeof pin !== "string") {
      // Tell the client a PIN is needed without leaking whether the guess was close.
      return NextResponse.json({ error: "PIN required", pinRequired: true }, { status: 401 });
    }
    const ok = await bcrypt.compare(pin, pinHash);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect PIN", pinRequired: true }, { status: 401 });
    }
  }

  const response = NextResponse.json({
    executiveId,
    name: exec.name,
    hasPin: !!pinHash,
  });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.executiveId = executiveId;
  await session.save();
  return response;
}

export async function DELETE(request: NextRequest) {
  const denied = await requireLogin();
  if (denied) return denied;
  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.executiveId = null;
  await session.save();
  return response;
}

// Set / change / remove the PIN on the profile this browser is acting as. You
// can only change your own, and changing an existing PIN needs the old one.
export async function PATCH(request: NextRequest) {
  const denied = await requireLogin();
  if (denied) return denied;

  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const id = session.executiveId;
  if (!id) {
    return NextResponse.json({ error: "Pick your profile first." }, { status: 400 });
  }

  const exec = await readExec(id);
  if (!exec) return NextResponse.json({ error: "Unknown executive" }, { status: 404 });

  const body = await request.json();
  const currentPin = typeof body.currentPin === "string" ? body.currentPin : "";
  const newPinRaw = typeof body.newPin === "string" ? body.newPin.trim() : "";

  const existing = (exec as { pinHash?: string | null }).pinHash;
  if (existing) {
    const ok = await bcrypt.compare(currentPin, existing);
    if (!ok) return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  if (newPinRaw && !/^\d{4,8}$/.test(newPinRaw)) {
    return NextResponse.json({ error: "PIN must be 4–8 digits." }, { status: 400 });
  }

  const pinHash = newPinRaw ? await bcrypt.hash(newPinRaw, 10) : "";
  try {
    await prisma.executive.update({ where: { id }, data: { pinHash } });
  } catch {
    return NextResponse.json(
      { error: "Couldn't save the PIN. Run `npm run appwrite:setup` to add the pinHash field." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, hasPin: !!newPinRaw });
}
