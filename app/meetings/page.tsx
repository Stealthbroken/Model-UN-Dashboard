import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowRight, CalendarPlus, CheckCircle2, Circle, Clock3, MapPin } from "lucide-react";
import { MeetingCreator } from "@/components/MeetingCreator";
import { MeetingsTabs } from "@/components/MeetingsTabs";
import { Badge, EmptyState, Progress, cn } from "@/components/ui";
import { fmtDateLong, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";
type TypeFilter = "regular" | "exec" | null;

export default async function MeetingsPage({ searchParams }: { searchParams: { type?: string } }) {
  const now = new Date();
  const typeFilter: TypeFilter = searchParams.type === "exec" ? "exec" : searchParams.type === "regular" ? "regular" : null;
  const meetings = await prisma.meeting.findMany({
    where: { date: { gte: now }, archivedAt: null, ...(typeFilter ? { type: typeFilter } : {}) },
    orderBy: { date: "asc" },
    include: { topicGuide: { select: { id: true } }, announcement: { select: { id: true, status: true } }, _count: { select: { tasks: true } } },
  });

  return (
    <div className="page-shell">
      <MeetingsTabs />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="section-kicker">Plan and run</p><h1 className="page-heading mt-1">Upcoming meetings</h1><p className="mt-2 max-w-2xl text-sm text-gray-500">Preparation, attendance, publishing, and follow-up live together in each meeting workspace.</p></div>
        <MeetingCreator />
      </header>

      <div className="mb-5 inline-flex rounded-xl bg-gray-100 p-1 text-sm font-semibold" aria-label="Filter meetings by type">
        <FilterTab label="All" href="/meetings" active={typeFilter === null} />
        <FilterTab label="Regular" href="/meetings?type=regular" active={typeFilter === "regular"} />
        <FilterTab label="Exec" href="/meetings?type=exec" active={typeFilter === "exec"} />
      </div>

      {meetings.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {meetings.map((meeting, index) => {
            const isExec = meeting.type === "exec";
            const checks = isExec
              ? [{ label: "Agenda", done: !!meeting.agenda?.trim() }, { label: "Minutes doc", done: !!meeting.minutesDocUrl }, { label: "Tasks", done: meeting._count.tasks > 0 }]
              : [{ label: "Agenda", done: !!meeting.agenda?.trim() }, { label: "Topic guide", done: !!meeting.topicGuide }, { label: "Classroom post", done: !!meeting.announcement }];
            const done = checks.filter((check) => check.done).length;
            const progress = Math.round((done / checks.length) * 100);
            const next = checks.find((check) => !check.done);
            return (
              <Link key={meeting.id} href={`/meetings/${meeting.id}`} className={cn("surface-card group block p-5 transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-100 sm:p-6", index === 0 && "border-primary-300")}>
                <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-3 flex flex-wrap gap-2">{index === 0 && <Badge tone="primary">Next up</Badge>}<Badge tone={isExec ? "purple" : "neutral"}>{isExec ? "Executive" : "Regular"}</Badge></div><h2 className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-primary-800">{meeting.title || fmtDateLong(meeting.date)}</h2><p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500"><span className="inline-flex items-center gap-1.5"><Clock3 size={15} />{fmtDateLong(meeting.date)} · {fmtTime(meeting.date)}</span><span className="inline-flex items-center gap-1.5"><MapPin size={15} />{meeting.location}</span></p></div><ArrowRight size={20} className="mt-1 shrink-0 text-gray-300 transition group-hover:translate-x-1 group-hover:text-primary-700" /></div>
                <div className="mt-5"><div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-500"><span>Preparation</span><span>{done}/{checks.length}</span></div><Progress value={progress} label={`${progress}% prepared`} /></div>
                <div className="mt-4 flex flex-wrap gap-2">{checks.map((check) => <span key={check.label} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold", check.done ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800")}>{check.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}{check.label}</span>)}</div>
                <p className={cn("mt-4 border-t border-gray-100 pt-3 text-sm font-semibold", next ? "text-amber-700" : "text-green-700")}>{next ? `Next action: ${next.label}` : "Ready to go"}</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={CalendarPlus} title="No upcoming meetings" description={typeFilter ? `There are no upcoming ${typeFilter} meetings. Clear the filter or create one.` : "Create a meeting or recurring series so everyone knows what is coming next."} action={<MeetingCreator />} />
      )}
    </div>
  );
}

function FilterTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return <Link href={href} className={cn("rounded-lg px-3 py-1.5 transition", active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}>{label}</Link>;
}
