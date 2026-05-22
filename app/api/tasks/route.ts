import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncMinutesDoc } from "@/lib/minutes-sync";

function normalizePriority(p?: string): "high" | "medium" | "low" {
  return p === "high" || p === "low" ? p : "medium";
}

// A date-only string ("YYYY-MM-DD") is anchored at local noon so the calendar
// day doesn't drift when displayed in another timezone.
function parseDueDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/tasks?executiveId=N — all tasks for one executive, with meeting info.
export async function GET(request: NextRequest) {
  const executiveId = Number(request.nextUrl.searchParams.get("executiveId"));
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
