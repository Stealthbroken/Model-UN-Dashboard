import { prisma } from "@/lib/db";
import { updateMinutesDoc, type MinutesDocData } from "@/lib/appscript";

/**
 * Builds the full minutes-doc snapshot for a meeting: header fields, per-exec
 * attendance, and each exec's tasks. Shared by create, regenerate, and sync so
 * the doc always reflects current meeting + exec data.
 */
export async function buildMinutesPayload(
  meetingId: number,
): Promise<MinutesDocData | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
      attendance: true,
    },
  });
  if (!meeting) return null;

  const execs = await prisma.executive.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const presentMap = new Map(meeting.attendance.map((a) => [a.executiveId, a.present]));

  return {
    title: meeting.title,
    date: meeting.date.toISOString(),
    location: meeting.location,
    agenda: meeting.agenda,
    executives: execs.map((e) => ({
      name: e.name,
      role: e.role,
      present: !!presentMap.get(e.id),
      tasks: meeting.tasks
        .filter((t) => t.executiveId === e.id)
        .map((t) => ({
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          label: t.label,
        })),
    })),
  };
}

/**
 * Best-effort: re-sync a meeting's minutes Doc. Safe to fire-and-forget — it
 * swallows all errors and no-ops when the meeting has no Doc or isn't exec.
 */
export async function syncMinutesDoc(meetingId: number): Promise<void> {
  try {
    if (!process.env.APPS_SCRIPT_URL) return;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { type: true, minutesDocId: true },
    });
    if (!meeting || meeting.type !== "exec" || !meeting.minutesDocId) return;

    const payload = await buildMinutesPayload(meetingId);
    if (!payload) return;

    await updateMinutesDoc(meeting.minutesDocId, payload);
  } catch {
    // best-effort — never disrupt the operation that triggered this
  }
}
