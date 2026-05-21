import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMinutesDoc } from "@/lib/appscript";
import { getMinutesDocSettings } from "@/lib/settings";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [execs, settings] = await Promise.all([
    prisma.executive.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getMinutesDocSettings(),
  ]);

  const payload = {
    title: meeting.title,
    date: meeting.date.toISOString(),
    location: meeting.location,
    agenda: meeting.agenda,
    executives: execs.map((e) => ({
      name: e.name,
      role: e.role,
      tasks: meeting.tasks
        .filter((t) => t.executiveId === e.id)
        .map((t) => ({ description: t.description, completed: t.completed })),
    })),
    sharedDriveId: settings.useSharedDrive ? settings.sharedDriveId : null,
  };

  const result = await createMinutesDoc(payload);
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
