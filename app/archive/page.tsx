import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const now = new Date();
  // Past meetings OR meetings that have been manually archived
  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [{ date: { lt: now } }, { archivedAt: { not: null } }],
    },
    orderBy: { date: "desc" },
    include: {
      // Only need existence — never pull the PDF blob into a list view.
      topicGuide: { select: { id: true } },
      announcement: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Past Meetings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Archive of past and manually-archived meetings.
      </p>

      <div className="space-y-3">
        {meetings.map((m) => (
          <Link
            key={m.id}
            href={`/meetings/${m.id}`}
            className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">
                    {m.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </h2>
                  {m.archivedAt && (
                    <span className="text-[10px] uppercase font-semibold tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{m.location}</p>
              </div>
              <div className="flex gap-1.5 text-xs">
                {m.topicGuide && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Guide</span>}
                {m.announcement && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Announced</span>}
              </div>
            </div>
          </Link>
        ))}
        {meetings.length === 0 && (
          <p className="text-gray-500 text-center py-12">No past meetings yet.</p>
        )}
      </div>
    </div>
  );
}
