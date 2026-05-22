import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMinutesDoc } from "@/lib/appscript";
import { getMinutesDocSettings } from "@/lib/settings";
import { buildMinutesPayload } from "@/lib/minutes-sync";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const [payload, settings] = await Promise.all([
    buildMinutesPayload(id),
    getMinutesDocSettings(),
  ]);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await createMinutesDoc({
    ...payload,
    sharedDriveId: settings.useSharedDrive ? settings.sharedDriveId : null,
  });
  if (!result.ok || !result.docId) {
    return NextResponse.json(
      { error: result.error || "Failed to create doc" },
      { status: 502 },
    );
  }

  const updated = await prisma.meeting.update({
    where: { id },
    data: {
      minutesDocId: result.docId,
      minutesDocUrl: result.docUrl,
      minutesDocCreatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    docId: result.docId,
    docUrl: result.docUrl,
    meeting: updated,
  });
}
