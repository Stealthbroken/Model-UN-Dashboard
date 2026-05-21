import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const data = await request.json();
  const meetingId = Number(data.meetingId);
  const executiveId = Number(data.executiveId);
  const description = typeof data.description === "string" ? data.description.trim() : "";

  if (!meetingId || !executiveId || !description) {
    return NextResponse.json(
      { error: "meetingId, executiveId, and description are required" },
      { status: 400 },
    );
  }

  const last = await prisma.task.findFirst({
    where: { meetingId, executiveId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      meetingId,
      executiveId,
      description,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
