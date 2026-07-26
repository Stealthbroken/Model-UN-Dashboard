import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isAccountRole, roleCanManageOwners } from "@/lib/session";
import { isDenied, listAccountExecs, requireSecgen, suggestUsername } from "@/lib/auth";
import { issueInvite, toAccountSummary, validateUsername } from "@/lib/accounts";

/** GET — the roster with account state attached. Sec-Gen only. */
export async function GET() {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  const execs = await listAccountExecs();
  return NextResponse.json(execs.map(toAccountSummary));
}

/**
 * POST — give an existing roster entry a login and email them an invite link.
 * Body: { executiveId, username?, accountRole?, sendInvite? }
 */
export async function POST(request: NextRequest) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  const actor = gate.user;

  const data = await request.json().catch(() => ({}));
  const executiveId = typeof data.executiveId === "string" ? data.executiveId : "";
  if (!executiveId) {
    return NextResponse.json({ error: "Pick who the account is for." }, { status: 400 });
  }

  const execs = await listAccountExecs();
  const exec = execs.find((e) => e.id === executiveId);
  if (!exec) {
    return NextResponse.json({ error: "That person isn't on the roster." }, { status: 404 });
  }
  if (exec.username) {
    return NextResponse.json(
      { error: `${exec.name} already has an account (${exec.username}).` },
      { status: 409 },
    );
  }

  const accountRole = isAccountRole(data.accountRole) ? data.accountRole : "member";
  if (accountRole === "owner" && !roleCanManageOwners(actor.role)) {
    return NextResponse.json(
      { error: "Only an owner can create another owner account." },
      { status: 403 },
    );
  }

  // Fall back to a generated handle so the common case is one click.
  const requested = typeof data.username === "string" && data.username.trim()
    ? data.username
    : await suggestUsername(exec.email || exec.name);
  const check = await validateUsername(requested, exec.id);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  await prisma.executive.update({
    where: { id: exec.id },
    data: {
      username: check.value,
      accountRole,
      accountActive: true,
      passwordHash: null,
    },
  });

  // Re-read so the invite email carries the username we just assigned.
  const updated = await prisma.executive.findUnique({ where: { id: exec.id } });
  if (!updated) {
    return NextResponse.json({ error: "Account creation failed." }, { status: 500 });
  }

  const invite = data.sendInvite === false ? null : await issueInvite(updated);
  const fresh = await prisma.executive.findUnique({ where: { id: exec.id } });

  return NextResponse.json(
    { account: toAccountSummary(fresh ?? updated), invite },
    { status: 201 },
  );
}
