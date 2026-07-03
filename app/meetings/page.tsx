import { prisma } from "@/lib/db";
import Link from "next/link";
import { MeetingCreator } from "@/components/MeetingCreator";
import { MeetingsTabs } from "@/components/MeetingsTabs";
import { fmtDateLong, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type TypeFilter = "regular" | "exec" | null;

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const now = new Date();
  const typeFilter: TypeFilter =
    searchParams.type === "exec"
      ? "exec"
      : searchParams.type === "regular"
        ? "regular"
        : null;

  const meetings = await prisma.meeting.findMany({
    where: {
      date: { gte: now },
      archivedAt: null,
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: { date: "asc" },
    include: {
      topicGuide: { select: { id: true } },
      announcement: { select: { id: true, status: true } },
      _count: { select: { tasks: true } },
    },
  });

  return (
    <div>
      <MeetingsTabs />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click a meeting to manage it. Regular meetings handle topic guides and
            Classroom posts; exec meetings handle tasks and minutes.
          </p>
        </div>
        <MeetingCreator />
      </div>

      {/* Type filter tabs */}
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm mb-4">
        <FilterTab label="All" href="/meetings" active={typeFilter === null} />
        <FilterTab label="Regular" href="/meetings?type=regular" active={typeFilter === "regular"} />
        <FilterTab label="Exec" href="/meetings?type=exec" active={typeFilter === "exec"} />
      </div>

      <div className="space-y-3">
        {meetings.map((m, idx) => {
          const isExec = m.type === "exec";
          const isNext = idx === 0;

          return (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className={`block bg-white rounded-xl border p-5 hover:border-primary-300 transition-colors ${
                isNext ? "border-primary-400 ring-1 ring-primary-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isNext && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase">
                        Next up
                      </span>
                    )}
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                        isExec ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {isExec ? "Exec" : "Regular"}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {fmtDateLong(m.date)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {fmtTime(m.date)} • {m.location}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {isExec ? (
                    <>
                      <StatusPill done={!!m.minutesDocUrl} label="Minutes" />
                      <CountPill count={m._count.tasks} label="tasks" />
                    </>
                  ) : (
                    <>
                      <StatusPill done={!!m.topicGuide} label="Topic Guide" />
                      <StatusPill done={!!m.announcement} label="Classroom" />
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {meetings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-3">
              No upcoming {typeFilter ?? ""} meetings.
            </p>
            <p className="text-xs text-gray-400">
              Use the &quot;+ New Meeting&quot; button to create one or schedule a recurring series.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-md transition-colors ${
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
}

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        done ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-green-600" : "bg-amber-500"}`} />
      {label}
    </span>
  );
}

function CountPill({ count, label }: { count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      {count} {label}
    </span>
  );
}
