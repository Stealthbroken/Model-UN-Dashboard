import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLogin } from "@/lib/auth";
import { TOPIC_CATEGORIES, TOPIC_DIFFICULTIES } from "@/lib/topic-seeds";

const STATUSES = ["idea", "shortlisted", "used", "archived"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireLogin();
  if (denied) return denied;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const data = await request.json();
  const patch: Record<string, unknown> = {};

  if (typeof data.title === "string") patch.title = data.title.trim().slice(0, 280);
  if (typeof data.description === "string") patch.description = data.description.trim().slice(0, 1_900);
  if (typeof data.notes === "string") patch.notes = data.notes.slice(0, 3_900);
  if (typeof data.category === "string") {
    patch.category = (TOPIC_CATEGORIES as readonly string[]).includes(data.category)
      ? data.category
      : data.category.trim().slice(0, 60);
  }
  if (typeof data.difficulty === "string" && (TOPIC_DIFFICULTIES as readonly string[]).includes(data.difficulty)) {
    patch.difficulty = data.difficulty;
  }
  if (typeof data.status === "string" && (STATUSES as readonly string[]).includes(data.status)) {
    patch.status = data.status;
    // Stamp usedAt when moving INTO "used"; clear it when moving out.
    if (data.status === "used") patch.usedAt = new Date();
    else patch.usedAt = null;
  }
  if ("meetingId" in data) {
    patch.meetingId = typeof data.meetingId === "string" && data.meetingId ? data.meetingId : null;
  }

  const topic = await prisma.topic.update({ where: { id }, data: patch });
  return NextResponse.json(topic);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireLogin();
  if (denied) return denied;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
