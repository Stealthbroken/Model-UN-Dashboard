import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDenied, listAccountExecs, requireSecgen } from "@/lib/auth";
import { issueInvite, toAccountSummary } from "@/lib/accounts";

/**
 * POST — (re)send a set-password invite. Doubles as the password-reset path:
 * issuing a new invite supersedes the old link without touching the current
 * password until the new link is actually used.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  const execs = await listAccountExecs();
  const exec = execs.find((e) => e.id === params.id);
  if (!exec) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!exec.username) {
    return NextResponse.json(
      { error: `${exec.name} doesn't have an account yet — create one first.` },
      { status: 400 },
    );
  }

  const invite = await issueInvite(exec);
  const updated = await prisma.executive.findUnique({ where: { id: exec.id } });
  return NextResponse.json({
    invite,
    account: updated ? toAccountSummary(updated) : null,
  });
}
