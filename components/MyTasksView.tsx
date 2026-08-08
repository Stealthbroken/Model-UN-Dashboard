"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateCompact } from "@/lib/format";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";

interface Exec {
  id: string;
  name: string;
  role: string;
}

interface TaskWithMeeting {
  id: string;
  description: string;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  label: string | null;
  meeting: { id: string; date: string; title: string; type: string };
}

const STORAGE_KEY = "mun-my-tasks-exec";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-gray-300",
};

export function MyTasksView({
  executives,
  selfId,
}: {
  executives: Exec[];
  /** The signed-in account's roster id, when they have one. */
  selfId: string | null;
}) {
  const toast = useToast();
  const [execId, setExecId] = useState<string | null>(selfId);
  const [tasks, setTasks] = useState<TaskWithMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // Signed-in accounts are already scoped to themselves; only fall back to the
  // remembered pick for shared team-password sessions.
  useEffect(() => {
    if (selfId) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && executives.some((e) => e.id === saved)) {
      setExecId(saved);
    }
  }, [executives, selfId]);

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      const res = await api<TaskWithMeeting[]>(`/api/tasks?executiveId=${id}`);
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTasks(Array.isArray(res.data) ? res.data : []);
    },
    [toast],
  );

  useEffect(() => {
    if (execId) load(execId);
  }, [execId, load]);

  function pick(value: string) {
    if (!value) {
      setExecId(null);
      setTasks([]);
      return;
    }
    setExecId(value);
    setSwitching(false);
    localStorage.setItem(STORAGE_KEY, value);
  }

  async function toggle(task: TaskWithMeeting) {
    setBusy(task.id);
    setTasks((cur) =>
      cur.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
    );
    const res = await api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { completed: !task.completed },
    });
    setBusy(null);

    if (!res.ok) {
      // Put the checkbox back where it was — the write didn't land.
      setTasks((cur) =>
        cur.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)),
      );
      toast.error(res.error);
      return;
    }
    if (execId) load(execId);
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const overdue = open.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;
  const now = new Date();
  const dueSoonLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const overdueTasks = open.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const dueSoonTasks = open.filter((t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= dueSoonLimit);
  const laterTasks = open.filter((t) => t.dueDate && new Date(t.dueDate) > dueSoonLimit);
  const undatedTasks = open.filter((t) => !t.dueDate);

  return (
    <div className="space-y-4">
      {/* Exec picker — collapsed to a one-line switcher once we know who you are */}
      {selfId && !switching ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">
            Showing tasks for{" "}
            <span className="font-medium text-gray-900">
              {executives.find((e) => e.id === execId)?.name ?? "you"}
            </span>
          </span>
          <button
            onClick={() => setSwitching(true)}
            className="text-xs text-gray-400 hover:text-primary-600"
          >
            View someone else
          </button>
        </div>
      ) : (
        <select
          value={execId ?? ""}
          onChange={(e) => pick(e.target.value)}
          className="input text-base py-3"
        >
          <option value="">— Select your name —</option>
          {executives.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.role ? ` (${e.role})` : ""}
            </option>
          ))}
        </select>
      )}

      {execId === null ? (
        <p className="text-sm text-gray-400 text-center py-10">
          Choose your name above to load your tasks.
        </p>
      ) : loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-2 text-sm">
            <Stat label="Open" value={open.length} tone="amber" />
            <Stat label="Overdue" value={overdue} tone={overdue > 0 ? "red" : "gray"} />
            <Stat label="Done" value={done.length} tone="green" />
          </div>

          {open.length === 0 && done.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">
              No tasks assigned. Nice and clear!
            </p>
          )}

          <TaskGroup title="Overdue" tasks={overdueTasks} tone="danger" busy={busy} onToggle={toggle} />
          <TaskGroup title="Due soon" tasks={dueSoonTasks} tone="warning" busy={busy} onToggle={toggle} />
          <TaskGroup title="Later" tasks={laterTasks} busy={busy} onToggle={toggle} />
          <TaskGroup title="No date" tasks={undatedTasks} busy={busy} onToggle={toggle} />

          {/* Completed tasks */}
          {done.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer select-none">
                Completed ({done.length})
              </summary>
              <div className="space-y-2 mt-2">
                {done.map((t) => (
                  <TaskCard key={t.id} task={t} busy={busy === t.id} onToggle={toggle} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  tone = "neutral",
  busy,
  onToggle,
}: {
  title: string;
  tasks: TaskWithMeeting[];
  tone?: "neutral" | "warning" | "danger";
  busy: string | null;
  onToggle: (task: TaskWithMeeting) => void;
}) {
  if (!tasks.length) return null;
  const tones = { neutral: "text-gray-500", warning: "text-amber-700", danger: "text-red-700" };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={`text-xs font-bold uppercase tracking-[0.12em] ${tones[tone]}`}>{title}</h2>
        <span className="text-xs font-semibold text-gray-400">{tasks.length}</span>
      </div>
      <div className="space-y-2">{tasks.map((task) => <TaskCard key={task.id} task={task} busy={busy === task.id} onToggle={onToggle} />)}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "red" | "green" | "gray";
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-800 border-red-200",
    green: "bg-green-50 text-green-800 border-green-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <div className={`flex-1 rounded-lg border px-3 py-2 text-center ${tones[tone]}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function TaskCard({
  task,
  busy,
  onToggle,
}: {
  task: TaskWithMeeting;
  busy: boolean;
  onToggle: (t: TaskWithMeeting) => void;
}) {
  const overdue =
    !task.completed && !!task.dueDate && new Date(task.dueDate) < new Date();
  const meetingDate = new Date(task.meeting.date);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 bg-white ${
        overdue ? "border-red-200" : "border-gray-200"
      }`}
    >
      <button
        onClick={() => onToggle(task)}
        disabled={busy}
        className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
          task.completed
            ? "bg-primary-600 border-primary-600 text-white"
            : "border-gray-300 hover:border-primary-400"
        }`}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {task.completed && "✓"}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            task.completed ? "line-through text-gray-400" : "text-gray-900"
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${
              PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium
            }`}
          />
          {task.description}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Link
            href={`/meetings/${task.meeting.id}`}
            className="text-[11px] text-gray-500 hover:underline"
          >
            {fmtDateCompact(meetingDate)} · {task.meeting.title}
          </Link>
          {task.label && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {task.label}
            </span>
          )}
          {task.dueDate && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {overdue ? "Overdue · " : "Due "}
              {fmtDateCompact(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
