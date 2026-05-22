"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Exec {
  id: number;
  name: string;
  role: string;
}

interface TaskWithMeeting {
  id: number;
  description: string;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  label: string | null;
  meeting: { id: number; date: string; title: string; type: string };
}

const STORAGE_KEY = "mun-my-tasks-exec";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-gray-300",
};

export function MyTasksView({ executives }: { executives: Exec[] }) {
  const [execId, setExecId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TaskWithMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && executives.some((e) => e.id === Number(saved))) {
      setExecId(Number(saved));
    }
  }, [executives]);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    const res = await fetch(`/api/tasks?executiveId=${id}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (execId) load(execId);
  }, [execId, load]);

  function pick(value: string) {
    const id = Number(value);
    if (!id) {
      setExecId(null);
      setTasks([]);
      return;
    }
    setExecId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  async function toggle(task: TaskWithMeeting) {
    setBusy(task.id);
    setTasks((cur) =>
      cur.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    setBusy(null);
    if (execId) load(execId);
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const overdue = open.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;

  return (
    <div className="space-y-4">
      {/* Exec picker */}
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

          {/* Open tasks */}
          {open.length > 0 && (
            <div className="space-y-2">
              {open.map((t) => (
                <TaskCard key={t.id} task={t} busy={busy === t.id} onToggle={toggle} />
              ))}
            </div>
          )}

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
            {meetingDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            · {task.meeting.title}
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
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
