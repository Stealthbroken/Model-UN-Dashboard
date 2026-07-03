import { NextResponse } from "next/server";
import { prisma, type Task, type MeetingAttendance } from "@/lib/db";
import { requireLogin } from "@/lib/auth";

// CSV export of per-executive task completion + attendance (same numbers as
// the Exec Stats page), for sharing with teachers or archiving at year end.
export async function GET() {
  const denied = await requireLogin();
  if (denied) return denied;

  const [executives, execMeetingCount] = await Promise.all([
    prisma.executive.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        tasks: { select: { completed: true } },
        attendance: { select: { present: true } },
      },
    }),
    prisma.meeting.count({ where: { type: "exec" } }),
  ]);

  const header = [
    "Name",
    "Role",
    "Tasks assigned",
    "Tasks completed",
    "Completion rate (%)",
    "Meetings attended",
    "Exec meetings held",
    "Attendance rate (%)",
  ];

  const rows = executives.map((e) => {
    const tasks = e.tasks as Task[];
    const attendance = e.attendance as MeetingAttendance[];
    const done = tasks.filter((t) => t.completed).length;
    const attended = attendance.filter((a) => a.present).length;
    return [
      e.name,
      e.role,
      tasks.length,
      done,
      tasks.length > 0 ? Math.round((done / tasks.length) * 100) : "",
      attended,
      execMeetingCount,
      execMeetingCount > 0 ? Math.round((attended / execMeetingCount) * 100) : "",
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mun-exec-stats.csv"',
    },
  });
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
