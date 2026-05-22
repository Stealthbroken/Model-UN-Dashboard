import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();

  const [nextMeeting, openTasks, overdueTasks, upcoming, recentDone] =
    await Promise.all([
      prisma.meeting.findFirst({
        where: { date: { gte: now }, archivedAt: null },
        orderBy: { date: "asc" },
        include: {
          topicGuide: { select: { id: true } },
          announcement: true,
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.count({ where: { completed: false } }),
      prisma.task.count({ where: { completed: false, dueDate: { lt: now } } }),
      prisma.meeting.findMany({
        where: { date: { gte: now }, archivedAt: null },
        orderBy: { date: "asc" },
        take: 5,
        include: {
          topicGuide: { select: { id: true } },
          announcement: true,
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.findMany({
        where: { completed: true, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 6,
        include: {
          executive: { select: { name: true } },
          meeting: { select: { id: true, title: true } },
        },
      }),
    ]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          A quick look at what needs attention.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Next meeting"
          value={
            nextMeeting
              ? new Date(nextMeeting.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—"
          }
          tone="primary"
        />
        <StatCard label="Open tasks" value={String(openTasks)} tone="amber" />
        <StatCard
          label="Overdue tasks"
          value={String(overdueTasks)}
          tone={overdueTasks > 0 ? "red" : "gray"}
        />
        <StatCard
          label="Upcoming"
          value={String(upcoming.length)}
          tone="gray"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next meeting + prep */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Next meeting</h2>
          {nextMeeting ? (
            <Link href={`/meetings/${nextMeeting.id}`} className="block group">
              <p className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                {new Date(nextMeeting.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {new Date(nextMeeting.date).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                • {nextMeeting.location}
              </p>
              <div className="flex flex-wrap gap-2">
                {nextMeeting.type === "exec" ? (
                  <>
                    <PrepChip done={!!nextMeeting.minutesDocUrl} label="Minutes doc" />
                    <PrepChip
                      done={nextMeeting._count.tasks > 0}
                      label={`${nextMeeting._count.tasks} tasks`}
                    />
                  </>
                ) : (
                  <>
                    <PrepChip done={!!nextMeeting.topicGuide} label="Topic guide" />
                    <PrepChip done={!!nextMeeting.announcement} label="Classroom post" />
                  </>
                )}
              </div>
            </Link>
          ) : (
            <p className="text-sm text-gray-400">No upcoming meeting scheduled.</p>
          )}
        </div>

        {/* Recently completed */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Recent activity</h2>
          {recentDone.length === 0 ? (
            <p className="text-sm text-gray-400">No completed tasks yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentDone.map((t) => (
                <li key={t.id} className="text-sm flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span className="text-gray-700">
                    <span className="font-medium">{t.executive.name}</span> completed
                    &quot;{t.description}&quot;
                    {t.completedAt && (
                      <span className="text-gray-400">
                        {" "}
                        ·{" "}
                        {new Date(t.completedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Needs attention */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Upcoming meetings</h2>
          <Link href="/meetings" className="text-xs text-primary-600 hover:underline">
            View all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map((m) => {
              const isExec = m.type === "exec";
              const ready = isExec
                ? !!m.minutesDocUrl
                : !!m.topicGuide && !!m.announcement;
              return (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <span
                      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        isExec ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {isExec ? "Exec" : "Reg"}
                    </span>
                    <span className="flex-1 text-sm text-gray-800">
                      {new Date(m.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      — {m.title}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        ready ? "text-green-600" : "text-amber-600"
                      }`}
                    >
                      {ready ? "Ready" : "Needs prep"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "amber" | "red" | "gray";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700 border-primary-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-800 border-red-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs uppercase tracking-wide mt-1.5">{label}</div>
    </div>
  );
}

function PrepChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
        done ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      <span>{done ? "✓" : "○"}</span>
      {label}
    </span>
  );
}
