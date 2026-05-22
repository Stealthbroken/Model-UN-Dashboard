import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  const data = await request.json();

  // Action-style PATCH for archive / unarchive
  if (data.action === "archive") {
    const m = await prisma.meeting.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json(m);
  }
  if (data.action === "unarchive") {
    const m = await prisma.meeting.update({
      where: { id },
      data: { archivedAt: null },
    });
    return NextResponse.json(m);
  }

  // Otherwise: standard field edits
  const meeting = await prisma.meeting.update({
    where: { id },
    data: {
      title: data.title,
      location: data.location,
      agenda: data.agenda || null,
      notes: data.notes || null,
      responsibleEmail: data.responsibleEmail || null,
      type:
        data.type === "regular" || data.type === "exec" ? data.type : undefined,
    },
  });

  return NextResponse.json(meeting);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
