import { prisma } from "@/lib/db";
import { updateMinutesDoc } from "@/lib/appscript";

/**
 * Best-effort: refresh the "Weekly Tasks" section of a meeting's minutes Doc.
 * Safe to fire-and-forget — it swallows all errors and no-ops when the meeting
 * has no minutes Doc or isn't an exec meeting.
 */
export async function syncMinutesDoc(meetingId: number): Promise<void> {
  try {
    if (!process.env.APPS_SCRIPT_URL) return;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!meeting || meeting.type !== "exec" || !meeting.minutesDocId) return;

    const execs = await prisma.executive.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const executives = execs.map((e) => ({
      name: e.name,
      role: e.role,
      tasks: meeting.tasks
        .filter((t) => t.executiveId === e.id)
        .map((t) => ({ description: t.description, completed: t.completed })),
    }));

    await updateMinutesDoc(meeting.minutesDocId, executives);
  } catch {
    // best-effort — never disrupt the task operation that triggered this
  }
}
