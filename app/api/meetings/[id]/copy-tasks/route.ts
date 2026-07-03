import { NextRequest, NextResponse } from "next/server";
import { prisma, type Task } from "@/lib/db";
import { requireLogin } from "@/lib/auth";
import { syncMinutesDoc } from "@/lib/minutes-sync";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requireLogin();
  if (denied) return denied;
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

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

  const unfinished = (previous.tasks as Task[]).filter((t) => !t.completed);

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
    (t: Task) => !existingKey.has(`${t.executiveId}::${t.description}`),
  );

  if (toCreate.length === 0) {
    return NextResponse.json({ copied: 0, message: "All unfinished tasks are already on this meeting." });
  }

  const lastOrders = new Map<string, number>();
  const currentTasks = await prisma.task.findMany({
    where: { meetingId: id },
    select: { executiveId: true, sortOrder: true },
  });
  for (const t of currentTasks) {
    lastOrders.set(t.executiveId, Math.max(lastOrders.get(t.executiveId) ?? -1, t.sortOrder));
  }

  // Sort orders are assigned synchronously, so the creates can run in parallel.
  const creates = toCreate.map((t) => {
    const order = (lastOrders.get(t.executiveId) ?? -1) + 1;
    lastOrders.set(t.executiveId, order);
    return prisma.task.create({
      data: {
        meetingId: id,
        executiveId: t.executiveId,
        description: t.description,
        priority: t.priority,
        label: t.label,
        sortOrder: order,
      },
    });
  });
  await Promise.all(creates);

  void syncMinutesDoc(id);
  return NextResponse.json({ copied: toCreate.length });
}
