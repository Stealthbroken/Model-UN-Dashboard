import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

async function requireSecgen() {
  const session = await getSession();
  if (!session.isSecgen) {
    return NextResponse.json({ error: "Sec-Gen access required" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  // GET stays open so the meeting page can show exec names + assign tasks.
  // Mutations below all require sec-gen.
  const execs = await prisma.executive.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(execs);
}

export async function POST(request: NextRequest) {
  const denied = await requireSecgen();
  if (denied) return denied;
  const data = await request.json();
  if (!data.name || typeof data.name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const last = await prisma.executive.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = (last?.sortOrder ?? -1) + 1;

  const exec = await prisma.executive.create({
    data: {
      name: data.name.trim(),
      role: (data.role || "").trim(),
      email: data.email ? data.email.trim() : null,
      sortOrder: nextOrder,
    },
  });
  return NextResponse.json(exec, { status: 201 });
}
