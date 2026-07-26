import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSecgen, isDenied } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const data = await request.json();
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
  return NextResponse.json(exec);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await prisma.executive.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
