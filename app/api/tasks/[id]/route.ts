import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const data = await request.json();
  const patch: {
    description?: string;
    completed?: boolean;
    completedAt?: Date | null;
  } = {};

  if (typeof data.description === "string") {
    patch.description = data.description.trim();
  }
  if (typeof data.completed === "boolean") {
    patch.completed = data.completed;
    patch.completedAt = data.completed ? new Date() : null;
  }

  const task = await prisma.task.update({ where: { id }, data: patch });
  return NextResponse.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
