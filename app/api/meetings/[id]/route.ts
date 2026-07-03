import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLogin } from "@/lib/auth";
import { syncMinutesDoc } from "@/lib/minutes-sync";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireLogin();
  if (denied) return denied;
  const id = params.id;
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

  // Title / date / agenda live in the minutes doc — keep it in sync.
  void syncMinutesDoc(id);
  return NextResponse.json(meeting);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireLogin();
  if (denied) return denied;
  const id = params.id;
  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
