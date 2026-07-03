import { prisma } from "@/lib/db";
import Link from "next/link";
import { fmtTime } from "@/lib/format";
import { MeetingsTabs } from "@/components/MeetingsTabs";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonth(param?: string): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const { year, month } = parseMonth(searchParams.month);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  const meetings = await prisma.meeting.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, title: true, type: true, archivedAt: true },
  });

  const byDay = new Map<number, typeof meetings>();
  for (const m of meetings) {
    const day = new Date(m.date).getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(m);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  const prevMonth = monthParam(new Date(year, month - 1, 1));
  const nextMonth = monthParam(new Date(year, month + 1, 1));

  return (
    <div>
      <MeetingsTabs />
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            All meetings this month, color-coded by type.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </Link>
          <span className="text-sm font-semibold text-gray-900 min-w-[9rem] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Next →
          </Link>
          <Link
            href="/calendar"
            className="px-3 py-1.5 text-sm text-primary-600 hover:underline"
          >
            Today
          </Link>
          <a
            href="/api/calendar/ics"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Download an .ics file — or subscribe in Google Calendar with /api/calendar/ics?token=… (see README)"
          >
            📆 iCal
          </a>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-sky-200 border border-sky-300" /> Regular
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-200 border border-purple-300" /> Exec
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center">
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayMeetings = day ? byDay.get(day) || [] : [];
            const isToday = day === todayDay;
            return (
              <div
                key={i}
                className={`min-h-[6rem] border-b border-r border-gray-100 p-1.5 ${
                  day ? "" : "bg-gray-50"
                }`}
              >
                {day && (
                  <>
                    <div
                      className={`text-xs mb-1 font-medium ${
                        isToday
                          ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white"
                          : "text-gray-400"
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayMeetings.map((m) => (
                        <Link
                          key={m.id}
                          href={`/meetings/${m.id}`}
                          className={`block text-[11px] leading-tight px-1.5 py-1 rounded truncate transition-colors ${
                            m.type === "exec"
                              ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
                              : "bg-sky-100 text-sky-800 hover:bg-sky-200"
                          } ${m.archivedAt ? "opacity-50" : ""}`}
                          title={m.title}
                        >
                          {fmtTime(m.date)} {m.title}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
