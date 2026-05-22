import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/appscript";
import { getSession } from "@/lib/session";
import { fmtDate } from "@/lib/format";

/**
 * Weekly digest — emails each executive their open tasks plus the next meeting.
 * Manually triggered from the Sec-Gen panel (sec-gen access required).
 */
export async function POST() {
  const session = await getSession();
  if (!session.isSecgen) {
    return NextResponse.json({ error: "Sec-Gen access required" }, { status: 403 });
  }

  const now = new Date();

  const [execs, nextMeeting] = await Promise.all([
    prisma.executive.findMany({
      where: { active: true, email: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        tasks: {
          where: { completed: false },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
          include: { meeting: { select: { title: true, date: true } } },
        },
      },
    }),
    prisma.meeting.findFirst({
      where: { date: { gte: now }, archivedAt: null },
      orderBy: { date: "asc" },
    }),
  ]);

  if (execs.length === 0) {
    return NextResponse.json({
      sent: 0,
      results: [],
      message: "No active executives have an email address set.",
    });
  }

  const results: { exec: string; ok: boolean; error?: string }[] = [];

  for (const exec of execs) {
    if (!exec.email) continue;
    const html = composeDigest(exec.name, exec.tasks, nextMeeting);
    const result = await sendReminderEmail(
      exec.email,
      "Your MUN weekly digest",
      html,
    );
    results.push({ exec: exec.name, ok: result.ok, error: result.error });
  }

  const failures = results.filter((r) => !r.ok);
  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: failures.length,
    results,
  });
}

interface DigestTask {
  description: string;
  priority: string;
  dueDate: Date | null;
  meeting: { title: string; date: Date };
}

function composeDigest(
  name: string,
  tasks: DigestTask[],
  nextMeeting: { title: string; date: Date; location: string; agenda: string | null } | null,
): string {
  let taskHtml: string;
  if (tasks.length === 0) {
    taskHtml = "<p>You have no open tasks. Nicely done!</p>";
  } else {
    const items = tasks
      .map((t) => {
        const due = t.dueDate ? ` — <em>due ${fmtDate(t.dueDate)}</em>` : "";
        const overdue =
          t.dueDate && new Date(t.dueDate) < new Date()
            ? ' <strong style="color:#c0392b">(overdue)</strong>'
            : "";
        return `<li>${escapeHtml(t.description)}${due}${overdue}</li>`;
      })
      .join("");
    taskHtml = `<p>You have <strong>${tasks.length}</strong> open task${
      tasks.length === 1 ? "" : "s"
    }:</p><ul>${items}</ul>`;
  }

  const meetingHtml = nextMeeting
    ? `<p><strong>Next meeting:</strong> ${escapeHtml(nextMeeting.title)} — ${fmtDate(
        nextMeeting.date,
      )} in ${escapeHtml(nextMeeting.location)}.</p>${
        nextMeeting.agenda
          ? `<p><strong>Agenda:</strong><br>${escapeHtml(nextMeeting.agenda).replace(/\n/g, "<br>")}</p>`
          : ""
      }`
    : "<p>No upcoming meeting is scheduled.</p>";

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Here's your MUN digest.</p>
      ${taskHtml}
      ${meetingHtml}
      <p style="color:#888;font-size:12px">— MUN Dashboard</p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
