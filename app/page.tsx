import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { getDashboardData, type MeetingCard } from "@/lib/dashboard";
import { fmtDateCompact, fmtDateLong, fmtDateRow, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const data = await getDashboardData(user?.id ?? null);

  const firstName = data.myName?.split(" ")[0];

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {firstName ? `Hi ${firstName}` : "Dashboard"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">A quick look at what needs attention.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Next meeting"
          value={data.nextMeeting ? fmtDateCompact(data.nextMeeting.date) : "—"}
          hint={data.nextMeeting ? fmtTime(data.nextMeeting.date) : "nothing scheduled"}
          tone="primary"
        />
        <StatCard
          label="Open tasks"
          value={String(data.openTasks)}
          hint={data.completionRate === null ? "no tasks yet" : `${data.completionRate}% all-time done`}
          tone="amber"
        />
        <StatCard
          label="Overdue"
          value={String(data.overdueCount)}
          hint={data.overdueCount > 0 ? "needs chasing" : "all on time"}
          tone={data.overdueCount > 0 ? "red" : "green"}
        />
        <StatCard
          label="Avg attendance"
          value={data.averageAttendance === null ? "—" : `${data.averageAttendance}%`}
          hint={
            data.execMeetingCount > 0
              ? `across ${data.execMeetingCount} exec meeting${data.execMeetingCount === 1 ? "" : "s"}`
              : "no exec meetings yet"
          }
          tone="gray"
        />
      </div>

      {/* Your tasks — only when signed in with a personal account */}
      {data.myTasks && (
        <Panel
          title="Your open tasks"
          action={{ href: "/my-tasks", label: "All my tasks →" }}
          className="mb-6"
        >
          {data.myTasks.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing assigned to you. Nice and clear.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.myTasks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/meetings/${t.meetingId}`}
                    className="flex items-center gap-3 py-2 -mx-2 px-2 rounded hover:bg-gray-50"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        t.priority === "high"
                          ? "bg-red-500"
                          : t.priority === "low"
                            ? "bg-gray-300"
                            : "bg-amber-400"
                      }`}
                    />
                    <span className="flex-1 text-sm text-gray-800 truncate">{t.description}</span>
                    {t.dueDate && (
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${
                          t.overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t.overdue ? "Overdue · " : "Due "}
                        {fmtDateCompact(t.dueDate)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next meeting readiness */}
        <Panel title="Next meeting">
          {data.nextMeeting ? (
            <NextMeetingCard meeting={data.nextMeeting} />
          ) : (
            <p className="text-sm text-gray-400">No upcoming meeting scheduled.</p>
          )}
        </Panel>

        {/* Attendance trend */}
        <Panel title="Attendance trend" action={{ href: "/stats", label: "Exec stats →" }}>
          {data.attendanceTrend.length === 0 ? (
            <p className="text-sm text-gray-400">
              No exec meetings recorded yet — attendance shows up here once you take it.
            </p>
          ) : (
            <AttendanceChart points={data.attendanceTrend} />
          )}
        </Panel>
      </div>

      {/* Overdue alerts */}
      {data.overdue.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-red-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-800">
              Overdue tasks{" "}
              <span className="font-normal text-red-600/70">({data.overdueCount})</span>
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {data.overdue.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/meetings/${t.meetingId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 -mx-2 px-2 rounded hover:bg-gray-50"
                >
                  <span className="text-xs font-semibold text-red-700 shrink-0 w-16">
                    {t.daysLate}d late
                  </span>
                  <span className="flex-1 min-w-[10rem] text-sm text-gray-800 truncate">
                    {t.description}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{t.execName}</span>
                </Link>
              </li>
            ))}
          </ul>
          {data.overdueCount > data.overdue.length && (
            <p className="mt-2 text-xs text-gray-400">
              + {data.overdueCount - data.overdue.length} more overdue.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Upcoming meetings */}
        <Panel title="Upcoming meetings" action={{ href: "/meetings", label: "View all →" }}>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.upcoming.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <span
                      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                        m.type === "exec"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {m.type === "exec" ? "Exec" : "Reg"}
                    </span>
                    <span className="flex-1 text-sm text-gray-800 truncate">
                      {fmtDateRow(m.date)} — {m.title}
                    </span>
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        m.ready ? "text-green-600" : "text-amber-600"
                      }`}
                    >
                      {m.ready ? "Ready" : "Needs prep"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent activity */}
        <Panel title="Recent activity">
          {data.activity.length === 0 ? (
            <p className="text-sm text-gray-400">No completed tasks yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.activity.map((t) => (
                <li key={t.id} className="text-sm flex items-start gap-2">
                  <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                  <span className="text-gray-700">
                    <span className="font-medium">{t.execName}</span> completed &quot;
                    {t.description}&quot;
                    <span className="text-gray-400"> · {fmtDateCompact(t.completedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Team standings */}
      {data.standings.length > 0 && (
        <Panel
          title="Team workload"
          action={{ href: "/stats", label: "Full stats →" }}
          className="mt-6"
        >
          <ul className="divide-y divide-gray-100">
            {data.standings.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="flex-1 min-w-[8rem]">
                  <span className="text-sm text-gray-900">{s.name}</span>
                  {s.role && <span className="text-xs text-gray-400"> · {s.role}</span>}
                </span>
                {s.overdueTasks > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
                    {s.overdueTasks} overdue
                  </span>
                )}
                <span className="text-xs text-gray-500 shrink-0 w-20 text-right">
                  {s.openTasks} open
                </span>
                <span className="shrink-0 w-24">
                  <span className="block h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-primary-500"
                      style={{ width: `${s.completionRate ?? 0}%` }}
                    />
                  </span>
                </span>
                <span className="text-xs font-medium text-gray-700 shrink-0 w-9 text-right">
                  {s.completionRate === null ? "—" : `${s.completionRate}%`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ─── Presentational pieces ──────────────────────────────────────────────── */

function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs text-primary-600 hover:underline shrink-0">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function NextMeetingCard({ meeting }: { meeting: MeetingCard }) {
  return (
    <Link href={`/meetings/${meeting.id}`} className="block group">
      <p className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
        {fmtDateLong(meeting.date)}
      </p>
      <p className="text-sm text-gray-500 mb-3">
        {fmtTime(meeting.date)} • {meeting.location}
        {meeting.type === "exec" && <span className="text-purple-700"> • Exec</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {meeting.checks.map((c) => (
          <span
            key={c.label}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
              c.done ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            <span>{c.done ? "✓" : "○"}</span>
            {c.label}
          </span>
        ))}
      </div>
      {meeting.taskCount > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {meeting.doneCount} of {meeting.taskCount} tasks complete
        </p>
      )}
    </Link>
  );
}

function AttendanceChart({
  points,
}: {
  points: { meetingId: string; date: string; title: string; present: number; total: number; rate: number | null }[];
}) {
  return (
    <div>
      <div className="flex items-end gap-1.5 h-24">
        {points.map((p) => (
          <div key={p.meetingId} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {p.rate === null ? "—" : `${p.rate}%`}
            </span>
            <div
              className={`w-full rounded-t transition-colors min-h-[2px] ${
                p.rate === null
                  ? "bg-gray-200 group-hover:bg-gray-300"
                  : "bg-primary-500/80 group-hover:bg-primary-600"
              }`}
              style={{ height: `${Math.max(p.rate ?? 0, 2)}%` }}
              title={
                p.rate === null
                  ? `${p.title} — attendance not taken`
                  : `${p.title} — ${p.present}/${p.total} present`
              }
            />
            <span className="text-[9px] text-gray-400 whitespace-nowrap">
              {fmtDateCompact(p.date)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Share of the roster present at each of the last {points.length} exec meetings.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "amber" | "red" | "green" | "gray";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700 border-primary-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-800 border-red-200",
    green: "bg-green-50 text-green-800 border-green-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs uppercase tracking-wide mt-1.5">{label}</div>
      {hint && <div className="text-[11px] opacity-70 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}
