import { prisma, type Task, type MeetingAttendance } from "@/lib/db";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
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

  const rows = executives
    .map((e) => {
      const tasks = e.tasks as Task[];
      const attendance = e.attendance as MeetingAttendance[];
      const total = tasks.length;
      const done = tasks.filter((t) => t.completed).length;
      const completionRate = total > 0 ? Math.round((done / total) * 100) : null;
      const attended = attendance.filter((a) => a.present).length;
      const attendanceRate =
        execMeetingCount > 0 ? Math.round((attended / execMeetingCount) * 100) : null;
      return { id: e.id, name: e.name, role: e.role, total, done, completionRate, attended, attendanceRate };
    })
    .sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1));

  return (
    <div className="page-shell max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Team pulse</p><h1 className="page-heading mt-1">Executive stats</h1>
          <p className="text-sm text-gray-500 mt-1">
            Task completion and attendance across all exec meetings.
          </p>
        </div>
        <a
          href="/api/stats/export"
          download
          className="btn btn-secondary shrink-0"
        >
          <Download size={16} />Export CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No executives on the roster yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className="surface-card p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                  {r.role && <p className="text-xs text-gray-500 truncate">{r.role}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric
                  label="Task completion"
                  rate={r.completionRate}
                  detail={`${r.done}/${r.total} tasks`}
                  color="bg-primary-500"
                />
                <Metric
                  label="Attendance"
                  rate={r.attendanceRate}
                  detail={`${r.attended}/${execMeetingCount} meetings`}
                  color="bg-green-500"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  rate,
  detail,
  color,
}: {
  label: string;
  rate: number | null;
  detail: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-900">
          {rate === null ? "—" : `${rate}%`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${rate ?? 0}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">{detail}</p>
    </div>
  );
}
