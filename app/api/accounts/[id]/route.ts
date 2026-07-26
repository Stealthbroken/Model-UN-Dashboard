import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isAccountRole, roleCanManageOwners } from "@/lib/session";
import { isDenied, listAccountExecs, normalizeRole, requireSecgen } from "@/lib/auth";
import {
  blocksLastSecgen,
  LAST_SECGEN_ERROR,
  revokeAccount,
  toAccountSummary,
  validateUsername,
} from "@/lib/accounts";

/**
 * PATCH — change an account's role, username, or enabled state.
 * Body: { accountRole?, username?, accountActive? }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  const actor = gate.user;

  const execs = await listAccountExecs();
  const exec = execs.find((e) => e.id === params.id);
  if (!exec) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const currentRole = normalizeRole(exec.accountRole);
  // Owners are the top of the tree — only another owner may touch one.
  if (currentRole === "owner" && !roleCanManageOwners(actor.role)) {
    return NextResponse.json(
      { error: "Only an owner can change an owner's account." },
      { status: 403 },
    );
  }

  const data = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (data.accountRole !== undefined) {
    if (!isAccountRole(data.accountRole)) {
      return NextResponse.json({ error: "Unknown role." }, { status: 400 });
    }
    if (data.accountRole === "owner" && !roleCanManageOwners(actor.role)) {
      return NextResponse.json(
        { error: "Only an owner can grant the owner role." },
        { status: 403 },
      );
    }
    // Demoting out of Sec-Gen: make sure someone is left holding the keys.
    if (data.accountRole === "member" && (await blocksLastSecgen(exec.id))) {
      return NextResponse.json({ error: LAST_SECGEN_ERROR }, { status: 409 });
    }
    patch.accountRole = data.accountRole;
  }

  if (data.accountActive !== undefined) {
    if (typeof data.accountActive !== "boolean") {
      return NextResponse.json({ error: "accountActive must be true or false." }, { status: 400 });
    }
    if (!data.accountActive && (await blocksLastSecgen(exec.id))) {
      return NextResponse.json({ error: LAST_SECGEN_ERROR }, { status: 409 });
    }
    patch.accountActive = data.accountActive;
  }

  if (data.username !== undefined) {
    const check = await validateUsername(data.username, exec.id);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    patch.username = check.value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await prisma.executive.update({ where: { id: exec.id }, data: patch });
  return NextResponse.json(toAccountSummary(updated));
}

/** DELETE — revoke the login. The person stays on the roster with their history. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  const actor = gate.user;

  const execs = await listAccountExecs();
  const exec = execs.find((e) => e.id === params.id);
  if (!exec) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (normalizeRole(exec.accountRole) === "owner" && !roleCanManageOwners(actor.role)) {
    return NextResponse.json(
      { error: "Only an owner can revoke an owner's account." },
      { status: 403 },
    );
  }
  if (await blocksLastSecgen(exec.id)) {
    return NextResponse.json({ error: LAST_SECGEN_ERROR }, { status: 409 });
  }

  await revokeAccount(exec.id);
  const updated = await prisma.executive.findUnique({ where: { id: exec.id } });
  return NextResponse.json(updated ? toAccountSummary(updated) : { ok: true });
}
