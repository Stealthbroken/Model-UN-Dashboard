import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/meetings/[id]/attendance — set an executive's present/absent state.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const meetingId = parseInt(params.id);
  if (isNaN(meetingId)) {
    return NextResponse.json({ error: "Bad meeting id" }, { status: 400 });
  }

  const { executiveId, present } = await request.json();
  if (!executiveId) {
    return NextResponse.json({ error: "executiveId is required" }, { status: 400 });
  }

  const record = await prisma.meetingAttendance.upsert({
    where: {
      meetingId_executiveId: { meetingId, executiveId: Number(executiveId) },
    },
    create: { meetingId, executiveId: Number(executiveId), present: !!present },
    update: { present: !!present },
  });

  return NextResponse.json(record);
}
