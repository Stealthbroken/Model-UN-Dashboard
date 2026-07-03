"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fmtDateCompact } from "@/lib/format";

interface Exec {
  id: string;
  name: string;
  role: string;
  hasPin: boolean;
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

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-gray-300",
};

export function MyTasksView({
  executives,
  initialExecId,
  initialExecName,
}: {
  executives: Exec[];
  initialExecId: string | null;
  initialExecName: string | null;
}) {
  const [execId, setExecId] = useState<string | null>(initialExecId);
  const [execName, setExecName] = useState<string | null>(initialExecName);
  const [tasks, setTasks] = useState<TaskWithMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Profile switching
  const [pinPrompt, setPinPrompt] = useState<Exec | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [managePin, setManagePin] = useState(false);

  const activeExec = executives.find((e) => e.id === execId) ?? null;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?executiveId=${id}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setError("Couldn't load your tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (execId) load(execId);
    else setTasks([]);
  }, [execId, load]);

  // Pick a profile. If it's PIN-protected, open the prompt; otherwise set it.
  function pick(id: string) {
    if (!id) return;
    const exec = executives.find((e) => e.id === id);
    if (!exec) return;
    if (exec.hasPin) {
      setPinPrompt(exec);
      setPinValue("");
      setPinError(null);
    } else {
      void setProfile(id, null);
    }
  }

  async function setProfile(id: string, pin: string | null) {
    setPinSaving(true);
    setPinError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executiveId: id, pin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.pinRequired) {
          setPinError(pin ? "Incorrect PIN." : "This profile needs a PIN.");
          return;
        }
        setError(data?.error || "Couldn't switch profile.");
        return;
      }
      setExecId(id);
      setExecName(data?.name ?? null);
      setPinPrompt(null);
      setPinValue("");
    } finally {
      setPinSaving(false);
    }
  }

  async function switchProfile() {
    await fetch("/api/auth/profile", { method: "DELETE" });
    setExecId(null);
    setExecName(null);
    setTasks([]);
    setManagePin(false);
  }

  async function toggle(task: TaskWithMeeting) {
    setBusy(task.id);
    setTasks((cur) =>
      cur.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    } catch {
      setTasks((cur) =>
        cur.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)),
      );
      setError("Couldn't update that task — try again.");
    } finally {
      setBusy(null);
    }
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const overdue = open.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date(),
  ).length;

  // ── No profile selected: show the picker ──────────────────────────────────
  if (!execId) {
    return (
      <>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <label htmlFor="exec-pick" className="block text-sm font-medium text-gray-700 mb-2">
            Who are you?
          </label>
          <select
            id="exec-pick"
            defaultValue=""
            onChange={(e) => pick(e.target.value)}
            className="input text-base py-3"
          >
            <option value="">— Select your name —</option>
            {executives.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.role ? ` (${e.role})` : ""}
                {e.hasPin ? " 🔒" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-2">
            We&apos;ll remember you on this device until you switch.
          </p>
        </div>
        {pinPrompt && (
          <PinDialog
            title={`Enter ${pinPrompt.name}'s PIN`}
            value={pinValue}
            onValueChange={setPinValue}
            error={pinError}
            saving={pinSaving}
            confirmLabel="Continue"
            onConfirm={() => setProfile(pinPrompt.id, pinValue)}
            onCancel={() => setPinPrompt(null)}
          />
        )}
      </>
    );
  }

  // ── Profile active ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Identity bar */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">Viewing tasks for</p>
          <p className="font-semibold text-gray-900 truncate">
            {execName || activeExec?.name}
            {activeExec?.hasPin && <span className="ml-1.5 text-xs text-gray-400">🔒</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setManagePin(true)}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            {activeExec?.hasPin ? "Change PIN" : "Set PIN"}
          </button>
          <button
            onClick={switchProfile}
            className="text-xs text-primary-600 hover:underline"
          >
            Switch
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => execId && load(execId)}
            className="text-sm text-red-700 hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
      ) : (
        <>
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

          {open.length > 0 && (
            <div className="space-y-2">
              {open.map((t) => (
                <TaskCard key={t.id} task={t} busy={busy === t.id} onToggle={toggle} />
              ))}
            </div>
          )}

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

      {managePin && (
        <ManagePinDialog
          hasPin={!!activeExec?.hasPin}
          onClose={() => setManagePin(false)}
          onSaved={(hasPin) => {
            // Reflect the new PIN state locally without a full reload.
            if (activeExec) activeExec.hasPin = hasPin;
            setManagePin(false);
          }}
        />
      )}
    </div>
  );
}

function PinDialog({
  title,
  value,
  onValueChange,
  error,
  saving,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  value: string;
  onValueChange: (v: string) => void;
  error: string | null;
  saving: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xs bg-white rounded-xl shadow-2xl border border-gray-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          placeholder="PIN"
          className="input text-base tracking-widest text-center"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:underline">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || !value}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManagePinDialog({
  hasPin,
  onClose,
  onSaved,
}: {
  hasPin: boolean;
  onClose: () => void;
  onSaved: (hasPin: boolean) => void;
}) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(remove: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin: remove ? "" : newPin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Couldn't save PIN.");
        return;
      }
      onSaved(!!data?.hasPin);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xs bg-white rounded-xl shadow-2xl border border-gray-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 mb-1">
          {hasPin ? "Change your PIN" : "Set a PIN"}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          A PIN keeps others from picking your profile and checking off your tasks.
        </p>
        {hasPin && (
          <input
            type="password"
            inputMode="numeric"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            placeholder="Current PIN"
            className="input text-base mb-2"
          />
        )}
        <input
          type="password"
          inputMode="numeric"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder="New PIN (4–8 digits)"
          className="input text-base"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex items-center justify-between gap-2 mt-4">
          {hasPin ? (
            <button
              onClick={() => submit(true)}
              disabled={saving}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              Remove PIN
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:underline">
              Cancel
            </button>
            <button
              onClick={() => submit(false)}
              disabled={saving || !newPin}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>
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
        className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:outline-none ${
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
