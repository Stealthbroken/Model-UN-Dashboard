import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDenied, requireUser } from "@/lib/auth";
import { createDocFromHtml } from "@/lib/appscript";
import { renderTopicGuideHtml, topicGuideDocName } from "@/lib/doc-templates";
import {
  getMinutesDocSettings,
  getTopicGuideFolderId,
  getTopicGuideTemplate,
} from "@/lib/settings";

/**
 * POST — generate a pre-formatted Google Docs topic guide for this topic and
 * link it. Refuses to clobber an existing guide unless `replace: true`.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  if (!process.env.APPS_SCRIPT_URL) {
    return NextResponse.json(
      {
        error:
          "Google Docs isn't connected. Set APPS_SCRIPT_URL (see SETUP.md), or paste an " +
          "existing Doc link instead.",
      },
      { status: 503 },
    );
  }

  const topic = await prisma.topic.findUnique({ where: { id: params.id } });
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (topic.guideUrl && body.replace !== true) {
    return NextResponse.json(
      { error: "This topic already has a guide linked. Unlink it first, or choose Replace." },
      { status: 409 },
    );
  }

  // Prefer a dedicated topic-guide folder; fall back to the minutes shared
  // drive so guides at least land somewhere the team already shares.
  const [folderId, minutes, template] = await Promise.all([
    getTopicGuideFolderId(),
    getMinutesDocSettings(),
    getTopicGuideTemplate(),
  ]);
  const target = folderId || (minutes.useSharedDrive ? minutes.sharedDriveId : "");
  const docName = topicGuideDocName(template, topic.title);

  const result = await createDocFromHtml({
    name: docName,
    html: renderTopicGuideHtml(template, topic),
    folderId: target || null,
  });

  if (!result.ok || !result.docUrl) {
    return NextResponse.json(
      { error: result.error || "Google Docs didn't return a document." },
      { status: 502 },
    );
  }

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data: {
      guideUrl: result.docUrl,
      guideDocId: result.docId ?? null,
      guideTitle: docName.slice(0, 280),
      guideCreatedAt: new Date(),
    },
  });

  return NextResponse.json(
    { topic: updated, created: true, note: result.note ?? null },
    { status: 201 },
  );
}

/** DELETE — unlink the guide. The Google Doc itself is left untouched. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const updated = await prisma.topic.update({
    where: { id: params.id },
    data: { guideUrl: null, guideDocId: null, guideTitle: null, guideCreatedAt: null },
  });
  return NextResponse.json(updated);
}
