import { prisma } from "@/lib/db";
import Link from "next/link";
import { fmtDateLong } from "@/lib/format";
import { MeetingsTabs } from "@/components/MeetingsTabs";

export const dynamic = "force-dynamic";

type TypeFilter = "regular" | "exec" | null;

export default async function ArchivePage({
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

  // Past meetings OR meetings that have been manually archived
  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [{ date: { lt: now } }, { archivedAt: { not: null } }],
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: { date: "desc" },
    include: {
      // Only need existence — never pull the PDF blob into a list view.
      topicGuide: { select: { id: true } },
      announcement: { select: { id: true } },
    },
  });

  return (
    <div>
      <MeetingsTabs />
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Past Meetings</h1>
      <p className="text-sm text-gray-500 mb-4">
        Archive of past and manually-archived meetings.
      </p>

      <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm mb-6">
        <FilterTab label="All" href="/archive" active={typeFilter === null} />
        <FilterTab label="Regular" href="/archive?type=regular" active={typeFilter === "regular"} />
        <FilterTab label="Exec" href="/archive?type=exec" active={typeFilter === "exec"} />
      </div>

      <div className="space-y-3">
        {meetings.map((m) => {
          const isExec = m.type === "exec";
          return (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900">
                      {fmtDateLong(m.date)}
                    </h2>
                    <span
                      className={`text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded ${
                        isExec ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {isExec ? "Exec" : "Regular"}
                    </span>
                    {m.archivedAt && (
                      <span className="text-[10px] uppercase font-semibold tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{m.location}</p>
                </div>
                <div className="flex gap-1.5 text-xs">
                  {isExec ? (
                    <>
                      {m.minutesDocUrl && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Minutes</span>}
                    </>
                  ) : (
                    <>
                      {m.topicGuide && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Guide</span>}
                      {m.announcement && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Announced</span>}
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {meetings.length === 0 && (
          <p className="text-gray-500 text-center py-12">No past meetings yet.</p>
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
