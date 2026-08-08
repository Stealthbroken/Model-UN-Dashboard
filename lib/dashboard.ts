/**
 * Dashboard aggregation.
 *
 * Everything the home page shows is derived from four collection reads, joined
 * and tallied in memory. A club's dataset is small (hundreds of rows), so this
 * is both simpler and far fewer round-trips than issuing a query per widget —
 * the previous page did a count per meeting row just to label task totals.
 */
import { cache } from "react";
import { prisma } from "@/lib/db";
import { sortByDueThenPriority, toMeetingCard } from "@/lib/dashboard-utils";
export type { MeetingCard, ReadinessCheck } from "@/lib/dashboard-utils";
import type { MeetingCard } from "@/lib/dashboard-utils";

export interface DashboardAction {
  id: string;
  kind: "task" | "meeting";
  title: string;
  detail: string;
  href: string;
  urgency: "overdue" | "soon" | "upcoming";
  owner: string | null;
  completable: boolean;
}

export interface ExecStanding {
  id: string;
  name: string;
  role: string;
  openTasks: number;
  overdueTasks: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number | null;
  attendedCount: number;
  attendanceRate: number | null;
}

export interface AttendancePoint {
  meetingId: string;
  date: string;
  title: string;
  present: number;
  total: number;
  rate: number | null;
}

export interface OverdueTask {
  id: string;
  description: string;
  dueDate: string;
  daysLate: number;
  execName: string;
  meetingId: string;
  meetingTitle: string;
  priority: string;
}

export interface ActivityItem {
  id: string;
  execName: string;
  description: string;
  completedAt: string;
  meetingId: string;
}

export interface MyTaskItem {
  id: string;
  description: string;
  dueDate: string | null;
  priority: string;
  overdue: boolean;
  meetingId: string;
  meetingTitle: string;
}

export interface DashboardData {
  nextMeeting: MeetingCard | null;
  upcoming: MeetingCard[];
  openTasks: number;
  overdueCount: number;
  completionRate: number | null;
  execMeetingCount: number;
  attendanceTrend: AttendancePoint[];
  averageAttendance: number | null;
  standings: ExecStanding[];
  overdue: OverdueTask[];
  activity: ActivityItem[];
  myTasks: MyTaskItem[] | null;
  myName: string | null;
  actions: DashboardAction[];
}

const UPCOMING_LIMIT = 5;
const TREND_LENGTH = 8;
const OVERDUE_LIMIT = 6;
const ACTIVITY_LIMIT = 6;
const MY_TASKS_LIMIT = 6;

export const getDashboardData = cache(
  async (viewerExecId: string | null, canManageTeam = false): Promise<DashboardData> => {
    const now = new Date();

    const [meetings, tasks, attendance, executives] = await Promise.all([
      prisma.meeting.findMany({
        orderBy: { date: "asc" },
        include: { topicGuide: true, announcement: true },
      }),
      prisma.task.findMany({}),
      prisma.meetingAttendance.findMany({}),
      prisma.executive.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    ]);

    const execById = new Map(executives.map((e) => [e.id, e]));
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const activeExecs = executives.filter((e) => e.active);

    /* ── Task indexes ── */
    const tasksByMeeting = groupBy(tasks, (t) => t.meetingId);
    const tasksByExec = groupBy(tasks, (t) => t.executiveId);

    const openTasks = tasks.filter((t) => !t.completed);
    const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate < now);
    const doneTasks = tasks.filter((t) => t.completed);
    const completionRate =
      tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : null;

    /* ── Meetings ── */
    const live = meetings.filter((m) => !m.archivedAt);
    const upcomingRaw = live.filter((m) => m.date >= now);
    const upcoming = upcomingRaw
      .slice(0, UPCOMING_LIMIT)
      .map((m) => toMeetingCard(m, tasksByMeeting.get(m.id) ?? []));

    /* ── Attendance trend over the most recent exec meetings ── */
    const attendanceByMeeting = groupBy(attendance, (a) => a.meetingId);
    const execMeetings = meetings.filter((m) => m.type === "exec");
    const pastExecMeetings = execMeetings.filter((m) => m.date <= now);

    const attendanceTrend: AttendancePoint[] = pastExecMeetings
      .slice(-TREND_LENGTH)
      .map((m) => {
        const rows = attendanceByMeeting.get(m.id) ?? [];
        const present = rows.filter((a) => a.present).length;
        return {
          meetingId: m.id,
          date: m.date.toISOString(),
          title: m.title,
          present,
          total: rows.length,
          // No attendance rows means it was never taken — that's unknown, not
          // 0%, so it stays out of the bars and out of the average below.
          rate: rows.length > 0 ? Math.round((present / rows.length) * 100) : null,
        };
      });

    const ratedPoints = attendanceTrend.filter((p) => p.rate !== null);
    const averageAttendance =
      ratedPoints.length > 0
        ? Math.round(ratedPoints.reduce((sum, p) => sum + (p.rate ?? 0), 0) / ratedPoints.length)
        : null;

    /* ── Per-exec standings ── */
    const attendanceByExec = groupBy(attendance, (a) => a.executiveId);
    const execMeetingCount = pastExecMeetings.length;

    const standings: ExecStanding[] = activeExecs
      .map((e) => {
        const own = tasksByExec.get(e.id) ?? [];
        const done = own.filter((t) => t.completed).length;
        const open = own.filter((t) => !t.completed);
        const attended = (attendanceByExec.get(e.id) ?? []).filter((a) => a.present).length;
        return {
          id: e.id,
          name: e.name,
          role: e.role,
          openTasks: open.length,
          overdueTasks: open.filter((t) => t.dueDate && t.dueDate < now).length,
          totalTasks: own.length,
          doneTasks: done,
          completionRate: own.length > 0 ? Math.round((done / own.length) * 100) : null,
          attendedCount: attended,
          attendanceRate:
            execMeetingCount > 0 ? Math.round((attended / execMeetingCount) * 100) : null,
        };
      })
      .sort(
        (a, b) =>
          b.overdueTasks - a.overdueTasks ||
          (b.completionRate ?? -1) - (a.completionRate ?? -1) ||
          a.name.localeCompare(b.name),
      );

    /* ── Overdue list, most late first ── */
    const overdue: OverdueTask[] = overdueTasks
      .slice()
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .slice(0, OVERDUE_LIMIT)
      .map((t) => ({
        id: t.id,
        description: t.description,
        dueDate: (t.dueDate as Date).toISOString(),
        daysLate: Math.max(
          1,
          Math.floor((now.getTime() - (t.dueDate as Date).getTime()) / 86_400_000),
        ),
        execName: execById.get(t.executiveId)?.name ?? "Unassigned",
        meetingId: t.meetingId,
        meetingTitle: meetingById.get(t.meetingId)?.title ?? "Meeting",
        priority: t.priority,
      }));

    /* ── Recent completions ── */
    const activity: ActivityItem[] = doneTasks
      .filter((t) => t.completedAt)
      .sort((a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime())
      .slice(0, ACTIVITY_LIMIT)
      .map((t) => ({
        id: t.id,
        execName: execById.get(t.executiveId)?.name ?? "Someone",
        description: t.description,
        completedAt: (t.completedAt as Date).toISOString(),
        meetingId: t.meetingId,
      }));

    /* ── The viewer's own open tasks ── */
    let myTasks: MyTaskItem[] | null = null;
    let myName: string | null = null;
    if (viewerExecId && execById.has(viewerExecId)) {
      myName = execById.get(viewerExecId)!.name;
      myTasks = (tasksByExec.get(viewerExecId) ?? [])
        .filter((t) => !t.completed)
        .sort(sortByDueThenPriority)
        .slice(0, MY_TASKS_LIMIT)
        .map((t) => ({
          id: t.id,
          description: t.description,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          priority: t.priority,
          overdue: !!t.dueDate && t.dueDate < now,
          meetingId: t.meetingId,
          meetingTitle: meetingById.get(t.meetingId)?.title ?? "Meeting",
        }));
    }

    const personalActions: DashboardAction[] = (myTasks ?? []).map((task) => ({
      id: task.id,
      kind: "task",
      title: task.description,
      detail: task.dueDate
        ? `${task.overdue ? "Overdue" : "Due"} ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(task.dueDate))}`
        : task.meetingTitle,
      href: `/meetings/${task.meetingId}`,
      urgency: task.overdue ? "overdue" : task.dueDate ? "soon" : "upcoming",
      owner: "You",
      completable: true,
    }));

    const teamActions: DashboardAction[] = overdue
      .filter((task) => !viewerExecId || canManageTeam || task.execName === myName)
      .map((task) => ({
        id: task.id,
        kind: "task",
        title: task.description,
        detail: `${task.daysLate}d overdue · ${task.meetingTitle}`,
        href: `/meetings/${task.meetingId}`,
        urgency: "overdue",
        owner: task.execName,
        completable: false,
      }));

    const seen = new Set<string>();
    const actions = [...personalActions, ...teamActions].filter((action) => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    }).slice(0, 7);

    return {
      nextMeeting: upcoming[0] ?? null,
      upcoming,
      openTasks: openTasks.length,
      overdueCount: overdueTasks.length,
      completionRate,
      execMeetingCount,
      attendanceTrend,
      averageAttendance,
      standings,
      overdue,
      activity,
      myTasks,
      myName,
      actions,
    };
  },
);

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
