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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const data = await request.json();
  const patch: {
    description?: string;
    completed?: boolean;
    completedAt?: Date | null;
    priority?: string;
    dueDate?: Date | null;
    label?: string | null;
  } = {};

  if (typeof data.description === "string") {
    patch.description = data.description.trim();
  }
  if (typeof data.completed === "boolean") {
    patch.completed = data.completed;
    patch.completedAt = data.completed ? new Date() : null;
  }
  if (typeof data.priority === "string") {
    patch.priority = normalizePriority(data.priority);
  }
  if ("dueDate" in data) {
    patch.dueDate = parseDueDate(data.dueDate);
  }
  if ("label" in data) {
    patch.label =
      typeof data.label === "string" && data.label.trim()
        ? data.label.trim()
        : null;
  }

  const task = await prisma.task.update({ where: { id }, data: patch });
  void syncMinutesDoc(task.meetingId);
  return NextResponse.json(task);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  // Capture the meeting before deleting so the minutes doc can be re-synced.
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { meetingId: true },
  });
  await prisma.task.delete({ where: { id } });
  if (existing) void syncMinutesDoc(existing.meetingId);
  return NextResponse.json({ ok: true });
}
