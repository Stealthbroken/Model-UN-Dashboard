import { prisma } from "@/lib/db";
import Link from "next/link";
import { MeetingCreator } from "@/components/MeetingCreator";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const meetings = await prisma.meeting.findMany({
    where: { date: { gte: now }, archivedAt: null },
    orderBy: { date: "asc" },
    include: {
      // Only need existence — never pull the PDF blob into a list view.
      topicGuide: { select: { id: true } },
      announcement: true,
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click a meeting to manage its topic guide and Classroom announcement.
          </p>
        </div>
        <MeetingCreator />
      </div>

      <div className="space-y-3">
        {meetings.map((m, idx) => {
          const hasGuide = !!m.topicGuide;
          const hasAnnouncement = !!m.announcement;
          const completion = [hasGuide, hasAnnouncement].filter(Boolean).length;
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
                  <div className="flex items-center gap-2 mb-2">
                    {isNext && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase">
                        Next up
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {completion}/2 ready
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {m.date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {m.date.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    • {m.location}
                  </p>
                </div>

                {/* Status pills */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <StatusPill done={hasGuide} label="Topic Guide" />
                  <StatusPill done={hasAnnouncement} label="Classroom" />
                </div>
              </div>
            </Link>
          );
        })}

        {meetings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-3">No upcoming meetings.</p>
            <p className="text-xs text-gray-400">Use the "+ New Meeting" button to create one or schedule a recurring series.</p>
          </div>
        )}
      </div>
    </div>
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
