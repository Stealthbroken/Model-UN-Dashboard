import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncMinutesDoc } from "@/lib/minutes-sync";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const previous = await prisma.meeting.findFirst({
    where: { date: { lt: meeting.date } },
    orderBy: { date: "desc" },
    include: { tasks: true },
  });

  if (!previous) {
    return NextResponse.json({ copied: 0, message: "No previous meeting." });
  }

  const unfinished = previous.tasks.filter((t) => !t.completed);

  if (unfinished.length === 0) {
    return NextResponse.json({ copied: 0, message: "Nothing unfinished to carry over." });
  }

  // Avoid duplicating an identical (exec, description) already on this meeting
  const existing = await prisma.task.findMany({
    where: { meetingId: id },
    select: { executiveId: true, description: true },
  });
  const existingKey = new Set(existing.map((t) => `${t.executiveId}::${t.description}`));

  const toCreate = unfinished.filter(
    (t) => !existingKey.has(`${t.executiveId}::${t.description}`),
  );

  if (toCreate.length === 0) {
    return NextResponse.json({ copied: 0, message: "All unfinished tasks are already on this meeting." });
  }

  const lastOrders = new Map<number, number>();
  const currentTasks = await prisma.task.findMany({
    where: { meetingId: id },
    select: { executiveId: true, sortOrder: true },
  });
  for (const t of currentTasks) {
    lastOrders.set(t.executiveId, Math.max(lastOrders.get(t.executiveId) ?? -1, t.sortOrder));
  }

  for (const t of toCreate) {
    const order = (lastOrders.get(t.executiveId) ?? -1) + 1;
    lastOrders.set(t.executiveId, order);
    await prisma.task.create({
      data: {
        meetingId: id,
        executiveId: t.executiveId,
        description: t.description,
        priority: t.priority,
        label: t.label,
        sortOrder: order,
      },
    });
  }

  void syncMinutesDoc(id);
  return NextResponse.json({ copied: toCreate.length });
}
