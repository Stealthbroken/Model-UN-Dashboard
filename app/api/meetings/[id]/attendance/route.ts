import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncMinutesDoc } from "@/lib/minutes-sync";
import { requireUser, isDenied } from "@/lib/auth";

// POST /api/meetings/[id]/attendance — set an executive's present/absent state.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const meetingId = params.id;
  if (!meetingId) {
    return NextResponse.json({ error: "Bad meeting id" }, { status: 400 });
  }

  const { executiveId, present } = await request.json();
  if (!executiveId || typeof executiveId !== "string") {
    return NextResponse.json({ error: "executiveId is required" }, { status: 400 });
  }

  const record = await prisma.meetingAttendance.upsert({
    where: {
      meetingId_executiveId: { meetingId, executiveId },
    },
    create: { meetingId, executiveId, present: !!present },
    update: { present: !!present },
  });

  void syncMinutesDoc(meetingId);
  return NextResponse.json(record);
}
