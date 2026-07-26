import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  getCurrentUser,
  hashPassword,
  listAccountExecs,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";

/** POST { currentPassword, newPassword } — change your own password. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.id) {
    return NextResponse.json(
      { error: "Team-password sessions have no personal password to change." },
      { status: 400 },
    );
  }

  const data = await request.json().catch(() => ({}));
  const currentPassword = typeof data.currentPassword === "string" ? data.currentPassword : "";
  const newPassword = typeof data.newPassword === "string" ? data.newPassword : "";

  const execs = await listAccountExecs();
  const exec = execs.find((e) => e.id === user.id);
  if (!exec) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (!(await verifyPassword(currentPassword, exec.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
  }

  const check = validatePassword(newPassword);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "That's your current password." }, { status: 400 });
  }

  await prisma.executive.update({
    where: { id: exec.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
