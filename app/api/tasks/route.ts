import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncMinutesDoc } from "@/lib/minutes-sync";
import { requireUser, isDenied } from "@/lib/auth";
import { normalizePriority, parseDueDate } from "@/lib/task-utils";

// GET /api/tasks?executiveId=N — all tasks for one executive, with meeting info.
export async function GET(request: NextRequest) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const executiveId = request.nextUrl.searchParams.get("executiveId");
  if (!executiveId) {
    return NextResponse.json({ error: "executiveId is required" }, { status: 400 });
  }
  const tasks = await prisma.task.findMany({
    where: { executiveId },
    include: {
      meeting: { select: { id: true, date: true, title: true, type: true } },
    },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const data = await request.json();
  const meetingId = typeof data.meetingId === "string" ? data.meetingId : "";
  const executiveId = typeof data.executiveId === "string" ? data.executiveId : "";
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
      priority: normalizePriority(data.priority),
      dueDate: parseDueDate(data.dueDate),
      label:
        typeof data.label === "string" && data.label.trim()
          ? data.label.trim()
          : null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  void syncMinutesDoc(task.meetingId);
  return NextResponse.json(task, { status: 201 });
}
