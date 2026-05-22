import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/appscript";

/**
 * Weekly digest: emails each executive their open tasks plus the next meeting.
 * Scheduled from server.js (Mondays); idempotency guard prevents double-sends.
 * Pass ?force=true to send immediately regardless of the guard (for testing).
 */
export async function POST(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "true";
  const DIGEST_KEY = "lastDigestSentAt";

  if (!force) {
    const last = await prisma.setting.findUnique({ where: { key: DIGEST_KEY } });
    if (last) {
      const daysSince = (Date.now() - new Date(last.value).getTime()) / 86_400_000;
      if (daysSince < 6) {
        return NextResponse.json({
          skipped: true,
          reason: "Digest already sent within the last 6 days",
        });
      }
    }
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

  await prisma.setting.upsert({
    where: { key: DIGEST_KEY },
    create: { key: DIGEST_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });

  return NextResponse.json({ sent: results.length, results });
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
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  let taskHtml: string;
  if (tasks.length === 0) {
    taskHtml = "<p>You have no open tasks. Nicely done! 🎉</p>";
  } else {
    const items = tasks
      .map((t) => {
        const due = t.dueDate
          ? ` — <em>due ${fmtDate(t.dueDate)}</em>`
          : "";
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
      <p>Here's your weekly MUN digest.</p>
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
