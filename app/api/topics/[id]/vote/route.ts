import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST — toggle the signed-in account's vote on a topic. Voting needs a real
 * account: shared team-password sessions have no identity to attribute a vote
 * to, so one browser could otherwise stuff the ballot.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!user.id) {
    return NextResponse.json(
      { error: "Voting needs your own account — ask a Sec-Gen to set one up." },
      { status: 403 },
    );
  }

  const topic = await prisma.topic.findUnique({ where: { id: params.id } });
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const voters = Array.isArray(topic.voters) ? topic.voters : [];
  const hadVoted = voters.includes(user.id);
  const next = hadVoted ? voters.filter((v) => v !== user.id) : [...voters, user.id];

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data: { voters: next, voteCount: next.length },
  });

  return NextResponse.json({ topic: updated, voted: !hadVoted });
}
