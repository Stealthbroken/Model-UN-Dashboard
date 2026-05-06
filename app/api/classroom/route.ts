import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { meetingId, body, scheduledFor, status } = await request.json();

  if (!meetingId || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // status: "draft" => not auto-posted; "pending" => cron will post when due
  const wantsSchedule = status === "pending";
  if (wantsSchedule && !scheduledFor) {
    return NextResponse.json({ error: "scheduledFor required when scheduling" }, { status: 400 });
  }

  const existing = await prisma.classroomAnnouncement.findUnique({ where: { meetingId } });
  if (existing?.status === "sent") {
    return NextResponse.json({ error: "Already sent — cannot edit" }, { status: 400 });
  }

  const nextStatus = wantsSchedule ? "pending" : "draft";

  const announcement = await prisma.classroomAnnouncement.upsert({
    where: { meetingId },
    create: {
      meeting: { connect: { id: meetingId } },
      body,
      scheduledFor: wantsSchedule ? new Date(scheduledFor) : null,
      status: nextStatus,
    },
    update: {
      body,
      scheduledFor: wantsSchedule ? new Date(scheduledFor) : null,
      status: nextStatus,
    },
  });

  return NextResponse.json(announcement, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await prisma.classroomAnnouncement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
