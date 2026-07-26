import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDenied, requireUser } from "@/lib/auth";
import {
  extractDocId,
  isTopicStatus,
  normalizeCategory,
  normalizeDifficulty,
  validateGuideUrl,
} from "@/lib/topics";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const data = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof data.title === "string") {
    const title = data.title.trim();
    if (!title) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    patch.title = title.slice(0, 280);
  }
  if (typeof data.description === "string") patch.description = data.description.trim().slice(0, 1_900);
  if (typeof data.notes === "string") patch.notes = data.notes.slice(0, 3_900);
  if (typeof data.category === "string") patch.category = normalizeCategory(data.category);
  if (typeof data.difficulty === "string") patch.difficulty = normalizeDifficulty(data.difficulty);

  if (data.status !== undefined) {
    if (!isTopicStatus(data.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    patch.status = data.status;
    // Stamp usedAt when moving INTO "used"; clear it when moving out.
    patch.usedAt = data.status === "used" ? new Date() : null;
  }

  if ("meetingId" in data) {
    patch.meetingId =
      typeof data.meetingId === "string" && data.meetingId ? data.meetingId : null;
  }

  // Guide link pasted in (or cleared) by hand.
  if ("guideUrl" in data) {
    const check = validateGuideUrl(data.guideUrl);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    patch.guideUrl = check.value;
    if (check.value === null) {
      patch.guideDocId = null;
      patch.guideTitle = null;
      patch.guideCreatedAt = null;
    } else {
      // Only Docs the dashboard generated keep a docId; a pasted Docs link gets
      // its id extracted so we can still recognize it, but nothing re-syncs it.
      patch.guideDocId = extractDocId(check.value);
      patch.guideCreatedAt = new Date();
    }
  }
  if (typeof data.guideTitle === "string") {
    patch.guideTitle = data.guideTitle.trim().slice(0, 280) || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const topic = await prisma.topic.update({ where: { id }, data: patch });
  return NextResponse.json(topic);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
