import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLogin, requireSecgen } from "@/lib/auth";

export async function GET() {
  // Any signed-in user can read the roster (the meeting page shows exec
  // names + assigns tasks). Mutations below all require sec-gen.
  const denied = await requireLogin();
  if (denied) return denied;
  const execs = await prisma.executive.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  // Never leak the PIN hash to the client — expose a boolean instead.
  const safe = execs.map((e) => {
    const { pinHash, ...rest } = e as typeof e & { pinHash?: string | null };
    return { ...rest, hasPin: !!pinHash };
  });
  return NextResponse.json(safe);
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
