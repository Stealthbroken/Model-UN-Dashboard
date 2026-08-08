import type { Meeting, Task } from "@/lib/db";

export interface ReadinessCheck {
  id: string;
  label: string;
  done: boolean;
  href: string;
  importance: "required" | "recommended";
}

export interface MeetingCard {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
  taskCount: number;
  doneCount: number;
  checks: ReadinessCheck[];
  ready: boolean;
}

export function toMeetingCard(meeting: Meeting & { topicGuide?: unknown; announcement?: unknown }, tasks: Task[]): MeetingCard {
  const isExec = meeting.type === "exec";
  const doneCount = tasks.filter((task) => task.completed).length;
  const checks: ReadinessCheck[] = isExec
    ? [
        { id: "minutes", label: "Minutes doc", done: !!meeting.minutesDocUrl, href: `/meetings/${meeting.id}#minutes`, importance: "required" },
        { id: "agenda", label: "Agenda set", done: !!meeting.agenda?.trim(), href: `/meetings/${meeting.id}#prepare`, importance: "required" },
        { id: "tasks", label: `${tasks.length} tasks assigned`, done: tasks.length > 0, href: `/meetings/${meeting.id}#follow-up`, importance: "recommended" },
      ]
    : [
        { id: "agenda", label: "Agenda set", done: !!meeting.agenda?.trim(), href: `/meetings/${meeting.id}#prepare`, importance: "required" },
        { id: "guide", label: "Topic guide", done: !!meeting.topicGuide, href: `/meetings/${meeting.id}#topic-guide`, importance: "required" },
        { id: "publish", label: "Classroom post", done: !!meeting.announcement, href: `/meetings/${meeting.id}#publish`, importance: "recommended" },
      ];

  return { id: meeting.id, title: meeting.title, date: meeting.date.toISOString(), location: meeting.location, type: meeting.type, taskCount: tasks.length, doneCount, checks, ready: checks.every((check) => check.done) };
}

const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function sortByDueThenPriority(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate) {
    const difference = a.dueDate.getTime() - b.dueDate.getTime();
    if (difference !== 0) return difference;
  } else if (a.dueDate) return -1;
  else if (b.dueDate) return 1;
  return (PRIORITY_WEIGHT[a.priority] ?? 1) - (PRIORITY_WEIGHT[b.priority] ?? 1);
}
