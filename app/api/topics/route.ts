import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDenied, requireUser } from "@/lib/auth";
import {
  isTopicStatus,
  normalizeCategory,
  normalizeDifficulty,
  normalizeStatus,
  validateGuideUrl,
} from "@/lib/topics";
import { extractDocId } from "@/lib/topics";

const BULK_LIMIT = 100;

export async function GET() {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const topics = await prisma.topic.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(topics);
}

export async function POST(request: NextRequest) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Give the topic a title." }, { status: 400 });
  }

  const guide = validateGuideUrl(data.guideUrl ?? null);
  if (!guide.ok) return NextResponse.json({ error: guide.error }, { status: 400 });

  const topic = await prisma.topic.create({
    data: {
      title: title.slice(0, 280),
      description: typeof data.description === "string" ? data.description.trim().slice(0, 1_900) : "",
      category: normalizeCategory(data.category),
      difficulty: normalizeDifficulty(data.difficulty),
      status: normalizeStatus(data.status ?? "idea"),
      notes: typeof data.notes === "string" ? data.notes.slice(0, 3_900) : "",
      source: data.source === "ai" || data.source === "curated" ? data.source : "manual",
      guideUrl: guide.value ?? null,
      guideDocId: guide.value ? extractDocId(guide.value) : null,
      guideCreatedAt: guide.value ? new Date() : null,
      voters: [],
      voteCount: 0,
    },
  });
  return NextResponse.json(topic, { status: 201 });
}

/**
 * PATCH { ids, patch } — bulk status change from the Topic Bank's multi-select.
 * One request instead of one per row.
 */
export async function PATCH(request: NextRequest) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));
  const ids = normalizeIds(data.ids);
  if ("error" in ids) return NextResponse.json({ error: ids.error }, { status: 400 });

  const status = data.patch?.status;
  if (!isTopicStatus(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const usedAt = status === "used" ? new Date() : null;
  const updated = await Promise.all(
    ids.value.map((id) =>
      prisma.topic
        .update({ where: { id }, data: { status, usedAt } })
        .catch(() => null),
    ),
  );

  const topics = updated.filter((t): t is NonNullable<typeof t> => t !== null);
  return NextResponse.json({ topics, updated: topics.length, requested: ids.value.length });
}

/** DELETE { ids } — bulk delete from the multi-select. */
export async function DELETE(request: NextRequest) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));
  const ids = normalizeIds(data.ids);
  if ("error" in ids) return NextResponse.json({ error: ids.error }, { status: 400 });

  const results = await Promise.all(
    ids.value.map((id) =>
      prisma.topic
        .delete({ where: { id } })
        .then(() => true)
        .catch(() => false),
    ),
  );
  const deleted = results.filter(Boolean).length;
  return NextResponse.json({ deleted, requested: ids.value.length });
}

function normalizeIds(raw: unknown): { value: string[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Select at least one topic." };
  }
  const ids = Array.from(
    new Set(raw.filter((v): v is string => typeof v === "string" && v.length > 0)),
  );
  if (ids.length === 0) return { error: "Select at least one topic." };
  if (ids.length > BULK_LIMIT) {
    return { error: `That's more than ${BULK_LIMIT} topics at once.` };
  }
  return { value: ids };
}
