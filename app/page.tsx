import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CheckCircle2, Circle, Clock3, Gauge, ListChecks, TrendingUp, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData, type MeetingCard } from "@/lib/dashboard";
import { fmtDateCompact, fmtDateLong, fmtDateRow, fmtTime } from "@/lib/format";
import { Card, Badge, ButtonLink, Progress, cn } from "@/components/ui";
import { DashboardActionList } from "@/components/DashboardActionList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const data = await getDashboardData(user?.id ?? null, user?.canSecgen ?? false);
  const firstName = data.myName?.split(" ")[0] ?? user?.name?.split(" ")[0];

  return (
    <div className="page-shell">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Executive workspace</p>
          <h1 className="page-heading mt-1">{firstName ? `Good to see you, ${firstName}.` : "Team dashboard"}</h1>
          <p className="mt-2 text-sm text-gray-500">Here’s the work that will keep the next meeting moving.</p>
        </div>
        <ButtonLink href="/meetings" tone="secondary"><CalendarDays size={17} />View meetings</ButtonLink>
      </header>

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-5 sm:p-6 lg:col-span-7">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><p className="section-kicker">Right now</p><h2 className="mt-1 text-xl font-bold text-gray-900">What needs attention</h2></div>
            {data.actions.length > 0 && <Badge tone={data.actions.some((item) => item.urgency === "overdue") ? "danger" : "warning"}>{data.actions.length} open</Badge>}
          </div>
          <DashboardActionList initial={data.actions} />
        </Card>

        <div className="lg:col-span-5">
          {data.nextMeeting ? <NextMeetingHero meeting={data.nextMeeting} /> : <NoMeeting />}
        </div>
      </div>

      <Card className="mt-5 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="section-kicker">Team pulse</p><h2 className="mt-1 text-lg font-bold text-gray-900">Progress at a glance</h2></div><Link href="/stats" className="text-sm font-semibold text-primary-700 hover:text-primary-900">Full stats →</Link></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Pulse icon={ListChecks} label="Open tasks" value={String(data.openTasks)} detail={data.completionRate === null ? "No history yet" : `${data.completionRate}% completed`} />
          <Pulse icon={Clock3} label="Overdue" value={String(data.overdueCount)} detail={data.overdueCount ? "Needs follow-up" : "All on time"} danger={data.overdueCount > 0} />
          <Pulse icon={Users} label="Attendance" value={data.averageAttendance === null ? "—" : `${data.averageAttendance}%`} detail={`${data.execMeetingCount} exec meetings`} />
          <Pulse icon={Gauge} label="Next meeting" value={data.nextMeeting?.ready ? "Ready" : "In prep"} detail={data.nextMeeting ? fmtDateCompact(data.nextMeeting.date) : "Not scheduled"} />
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle title="Coming up" href="/meetings" />
          {data.upcoming.length ? (
            <ul className="divide-y divide-gray-100">
              {data.upcoming.map((meeting) => (
                <li key={meeting.id}><Link href={`/meetings/${meeting.id}`} className="group flex items-center gap-3 rounded-xl py-3.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-100"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold", meeting.type === "exec" ? "bg-purple-100 text-purple-800" : "bg-sky-100 text-sky-800")}>{meeting.type === "exec" ? "EX" : "RG"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-primary-800">{meeting.title}</span><span className="mt-0.5 block text-xs text-gray-500">{fmtDateRow(meeting.date)} · {fmtTime(meeting.date)}</span></span><Badge tone={meeting.ready ? "success" : "warning"}>{meeting.ready ? "Ready" : "Needs prep"}</Badge></Link></li>
              ))}
            </ul>
          ) : <p className="py-8 text-center text-sm text-gray-500">No upcoming meetings yet.</p>}
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle title="Recent progress" />
          {data.activity.length ? (
            <ul className="space-y-4">
              {data.activity.map((item) => <li key={item.id} className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"><Check size={15} strokeWidth={3} /></span><span className="text-sm leading-relaxed text-gray-600"><strong className="font-semibold text-gray-900">{item.execName}</strong> completed “{item.description}”<span className="block text-xs text-gray-400">{fmtDateCompact(item.completedAt)}</span></span></li>)}
            </ul>
          ) : <p className="py-8 text-center text-sm text-gray-500">Completed work will appear here.</p>}
        </Card>
      </div>
    </div>
  );
}

function NextMeetingHero({ meeting }: { meeting: MeetingCard }) {
  const done = meeting.checks.filter((check) => check.done).length;
  const progress = Math.round((done / meeting.checks.length) * 100);
  const next = meeting.checks.find((check) => !check.done);
  return (
    <Card className="h-full overflow-hidden border-primary-900 bg-ink text-white shadow-xl shadow-primary-900/10">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-200">Next meeting</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{fmtDateLong(meeting.date)}</h2><p className="mt-1 text-sm text-primary-100">{fmtTime(meeting.date)} · {meeting.location}</p></div><Badge tone={meeting.type === "exec" ? "purple" : "primary"}>{meeting.type === "exec" ? "Exec" : "Regular"}</Badge></div>
        <div className="mt-6"><div className="mb-2 flex justify-between text-xs font-semibold text-primary-100"><span>Preparation</span><span>{done}/{meeting.checks.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-primary-300" style={{ width: `${progress}%` }} /></div></div>
        <ul className="mt-5 space-y-2.5">{meeting.checks.map((check) => <li key={check.id}><Link href={check.href} className="flex items-center gap-2.5 rounded-lg text-sm text-primary-50 hover:text-white">{check.done ? <CheckCircle2 size={17} className="text-green-300" /> : <Circle size={17} className="text-primary-300" />}<span className={check.done ? "text-primary-100 line-through decoration-primary-300/60" : "font-medium"}>{check.label}</span></Link></li>)}</ul>
      </div>
      <Link href={next?.href ?? `/meetings/${meeting.id}`} className="flex items-center justify-between border-t border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white transition hover:bg-white/10 sm:px-6"><span>{next ? `Next: ${next.label}` : "Open meeting workspace"}</span><ArrowRight size={17} /></Link>
    </Card>
  );
}

function NoMeeting() {
  return <Card className="flex h-full min-h-72 flex-col items-center justify-center p-7 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-800"><CalendarDays /></span><h2 className="mt-4 text-lg font-bold text-gray-900">Nothing scheduled</h2><p className="mt-1 max-w-xs text-sm text-gray-500">Create the next meeting so the team can start preparing.</p><ButtonLink href="/meetings" className="mt-5">Create a meeting</ButtonLink></Card>;
}

function Pulse({ icon: Icon, label, value, detail, danger = false }: { icon: typeof TrendingUp; label: string; value: string; detail: string; danger?: boolean }) {
  return <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4"><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", danger ? "bg-red-100 text-red-700" : "bg-primary-100 text-primary-800")}><Icon size={18} /></span><p className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900">{value}</p><p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p><p className={cn("mt-1 text-xs", danger ? "font-medium text-red-600" : "text-gray-400")}>{detail}</p></div>;
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">{title}</h2>{href && <Link href={href} className="text-sm font-semibold text-primary-700 hover:text-primary-900">View all →</Link>}</div>;
}
