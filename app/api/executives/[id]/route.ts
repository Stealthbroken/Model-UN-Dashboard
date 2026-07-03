import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSecgen } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireSecgen();
  if (denied) return denied;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const data = await request.json();

  // Admin PIN reset — clears a forgotten PIN so the person isn't locked out.
  if (data.resetPin === true) {
    try {
      await prisma.executive.update({ where: { id }, data: { pinHash: "" } });
    } catch {
      return NextResponse.json({ error: "Couldn't reset PIN." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const exec = await prisma.executive.update({
    where: { id },
    data: {
      name: typeof data.name === "string" ? data.name.trim() : undefined,
      role: typeof data.role === "string" ? data.role.trim() : undefined,
      email:
        data.email === null
          ? null
          : typeof data.email === "string"
            ? data.email.trim() || null
            : undefined,
      active: typeof data.active === "boolean" ? data.active : undefined,
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : undefined,
    },
  });
  const { pinHash, ...safe } = exec as typeof exec & { pinHash?: string | null };
  return NextResponse.json({ ...safe, hasPin: !!pinHash });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireSecgen();
  if (denied) return denied;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await prisma.executive.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
