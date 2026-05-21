"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RichTextEditor } from "@/components/RichTextEditor";

interface TopicGuide {
  id: number;
  filename: string;
  path: string;
}

interface ClassroomAnnouncement {
  id: number;
  body: string;
  scheduledFor: string | null;
  status: string;
  sentAt: string | null;
}

interface Task {
  id: number;
  description: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  meetingId: number;
  executiveId: number;
}

interface Executive {
  id: number;
  name: string;
  role: string;
  email: string | null;
  active: boolean;
  sortOrder: number;
}

interface Meeting {
  id: number;
  date: string;
  title: string;
  location: string;
  agenda: string | null;
  notes: string | null;
  responsibleEmail: string | null;
  archivedAt: string | null;
  minutesDocId: string | null;
  minutesDocUrl: string | null;
  minutesDocCreatedAt: string | null;
  topicGuide: TopicGuide | null;
  announcement: ClassroomAnnouncement | null;
  tasks: Task[];
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultAnnouncementTime(meetingDate: Date): string {
  const d = new Date(meetingDate);
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return toLocalInputValue(d);
}

export function MeetingDetail({
  meeting,
  executives,
  previousUnfinishedCount,
}: {
  meeting: Meeting;
  executives: Executive[];
  previousUnfinishedCount: number;
}) {
  const router = useRouter();
  const meetingDate = new Date(meeting.date);

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← All meetings
      </Link>

      {/* Meeting Header */}
      <MeetingHeader meeting={meeting} onUpdate={() => router.refresh()} />

      {/* Executives & Tasks */}
      <div className="mt-6">
        <ExecutivesTasksSection
          meeting={meeting}
          executives={executives}
          previousUnfinishedCount={previousUnfinishedCount}
          onChange={() => router.refresh()}
        />
      </div>

      {/* Minutes Doc */}
      <div className="mt-6">
        <MinutesDocSection meeting={meeting} onChange={() => router.refresh()} />
      </div>

      {/* Two Subsections (Instagram now lives in its own tab) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TopicGuideSection
          meetingId={meeting.id}
          guide={meeting.topicGuide}
          onChange={() => router.refresh()}
        />
        <ClassroomSection
          meetingId={meeting.id}
          announcement={meeting.announcement}
          defaultTime={defaultAnnouncementTime(meetingDate)}
          onChange={() => router.refresh()}
        />
      </div>
    </div>
  );
}

/* ───────── Executives & Tasks Section ───────── */
function ExecutivesTasksSection({
  meeting,
  executives,
  previousUnfinishedCount,
  onChange,
}: {
  meeting: Meeting;
  executives: Executive[];
  previousUnfinishedCount: number;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const tasksByExec = new Map<number, Task[]>();
  for (const t of meeting.tasks) {
    if (!tasksByExec.has(t.executiveId)) tasksByExec.set(t.executiveId, []);
    tasksByExec.get(t.executiveId)!.push(t);
  }

  // Group orphans (tasks whose exec has been deactivated/deleted)
  const activeExecIds = new Set(executives.map((e) => e.id));
  const orphanTasks = meeting.tasks.filter((t) => !activeExecIds.has(t.executiveId));

  const totalTasks = meeting.tasks.length;
  const completedTasks = meeting.tasks.filter((t) => t.completed).length;

  async function toggleTask(task: Task) {
    setBusy(`toggle-${task.id}`);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    setBusy(null);
    onChange();
  }

  async function addTask(executiveId: number, description: string) {
    if (!description.trim()) return;
    setBusy(`add-${executiveId}`);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: meeting.id, executiveId, description }),
    });
    setBusy(null);
    onChange();
  }

  async function deleteTask(taskId: number) {
    setBusy(`del-${taskId}`);
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setBusy(null);
    onChange();
  }

  async function copyFromLast() {
    setBusy("copy");
    setMessage(null);
    const res = await fetch(`/api/meetings/${meeting.id}/copy-tasks`, { method: "POST" });
    const data = await res.json();
    setMessage(
      data.copied
        ? `Copied ${data.copied} unfinished task${data.copied === 1 ? "" : "s"} from the last meeting.`
        : data.message || "Nothing to copy.",
    );
    setBusy(null);
    onChange();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Executives &amp; Weekly Tasks</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {completedTasks}/{totalTasks} done
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyFromLast}
            disabled={busy === "copy" || previousUnfinishedCount === 0}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title={
              previousUnfinishedCount === 0
                ? "No unfinished tasks on the previous meeting."
                : `Copy ${previousUnfinishedCount} unfinished task(s) from the previous meeting`
            }
          >
            {busy === "copy" ? "Copying..." : `↻ Copy unfinished from last meeting (${previousUnfinishedCount})`}
          </button>
          <Link
            href="/executives"
            className="text-xs text-gray-500 hover:underline"
          >
            Manage roster →
          </Link>
        </div>
      </div>

      {message && (
        <p className="text-xs text-green-600 mb-2">{message}</p>
      )}

      {executives.length === 0 ? (
        <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4 text-center">
          No executives on the roster yet.{" "}
          <Link href="/executives" className="text-primary-600 hover:underline">
            Add some
          </Link>{" "}
          to start assigning weekly tasks.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {executives.map((e) => (
            <ExecutiveTaskRow
              key={e.id}
              exec={e}
              tasks={tasksByExec.get(e.id) || []}
              busy={busy}
              onToggle={toggleTask}
              onAdd={addTask}
              onDelete={deleteTask}
            />
          ))}
        </ul>
      )}

      {orphanTasks.length > 0 && (
        <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            Tasks from former executives ({orphanTasks.length})
          </p>
          <ul className="space-y-1">
            {orphanTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleTask(t)}
                  disabled={busy === `toggle-${t.id}`}
                />
                <span className={t.completed ? "line-through text-gray-400" : "text-gray-700"}>
                  {t.description}
                </span>
                <button
                  onClick={() => deleteTask(t.id)}
                  className="ml-auto text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExecutiveTaskRow({
  exec,
  tasks,
  busy,
  onToggle,
  onAdd,
  onDelete,
}: {
  exec: Executive;
  tasks: Task[];
  busy: string | null;
  onToggle: (t: Task) => void;
  onAdd: (executiveId: number, description: string) => void;
  onDelete: (id: number) => void;
}) {
  const [input, setInput] = useState("");
  const doneCount = tasks.filter((t) => t.completed).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(exec.id, input);
    setInput("");
  }

  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div>
          <span className="font-medium text-gray-900">{exec.name}</span>
          {exec.role && <span className="text-xs text-gray-500 ml-2">{exec.role}</span>}
        </div>
        <span className="text-[11px] text-gray-400">
          {doneCount}/{tasks.length}
        </span>
      </div>

      {tasks.length > 0 && (
        <ul className="space-y-1 mb-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm group">
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => onToggle(t)}
                disabled={busy === `toggle-${t.id}`}
                className="rounded"
              />
              <span className={t.completed ? "line-through text-gray-400" : "text-gray-700"}>
                {t.description}
              </span>
              <button
                onClick={() => onDelete(t.id)}
                className="ml-auto text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete task"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Add a task for ${exec.name.split(" ")[0]}...`}
          className="input flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy === `add-${exec.id}`}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {busy === `add-${exec.id}` ? "..." : "+ Add"}
        </button>
      </form>
    </li>
  );
}

/* ───────── Minutes Doc Section ───────── */
function MinutesDocSection({
  meeting,
  onChange,
}: {
  meeting: Meeting;
  onChange: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    if (meeting.minutesDocUrl) {
      if (
        !confirm(
          "Create a brand-new minutes doc? The existing doc will be left where it is in Drive — this dashboard will just point to the new one.",
        )
      )
        return;
    }
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/meetings/${meeting.id}/minutes`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Failed to create minutes doc.");
    }
    setCreating(false);
    onChange();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Meeting Minutes Doc</h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            meeting.minutesDocUrl ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {meeting.minutesDocUrl ? "ready" : "not created"}
        </span>
      </div>

      {meeting.minutesDocUrl ? (
        <div className="space-y-2">
          <a
            href={meeting.minutesDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary-600 hover:underline text-sm font-medium"
          >
            📄 Open minutes doc in Google Docs
          </a>
          {meeting.minutesDocCreatedAt && (
            <p className="text-xs text-gray-500">
              Created {new Date(meeting.minutesDocCreatedAt).toLocaleString()}
            </p>
          )}
          <button
            onClick={regenerate}
            disabled={creating}
            className="text-xs text-gray-500 hover:underline disabled:opacity-50"
          >
            {creating ? "Generating..." : "Regenerate (creates a new doc)"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            No minutes doc yet. Apps Script creates a templated Google Doc in your shared drive,
            pre-filled with the date, agenda, attendance, and weekly tasks.
          </p>
          <button
            onClick={regenerate}
            disabled={creating}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create minutes doc"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

/* ───────────── Meeting Header ───────────── */
function MeetingHeader({ meeting, onUpdate }: { meeting: Meeting; onUpdate: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: meeting.title,
    location: meeting.location,
    agenda: meeting.agenda || "",
    notes: meeting.notes || "",
    responsibleEmail: meeting.responsibleEmail || "",
  });
  const date = new Date(meeting.date);
  const isArchived = !!meeting.archivedAt;

  async function save() {
    await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditing(false);
    onUpdate();
  }

  async function archiveToggle() {
    await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isArchived ? "unarchive" : "archive" }),
    });
    onUpdate();
  }

  async function remove() {
    if (
      !confirm(
        "Permanently delete this meeting and its topic guide / announcement records? This cannot be undone.",
      )
    )
      return;
    const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h1>
            {isArchived && (
              <span className="text-[10px] uppercase font-semibold tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                Archived
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1">
            {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} • {meeting.location}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => (editing ? save() : setEditing(true))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {editing ? "Save" : "Edit"}
          </button>
          <button
            onClick={archiveToggle}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {isArchived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={remove}
            className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field label="Title">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Location">
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Agenda">
            <textarea
              rows={3}
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Responsible person email (gets reminder if no announcement scheduled by night before)">
            <input
              type="email"
              value={form.responsibleEmail}
              onChange={(e) => setForm({ ...form, responsibleEmail: e.target.value })}
              placeholder="exec@school.edu"
              className="input"
            />
          </Field>
        </div>
      ) : (
        <>
          {meeting.agenda && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Agenda</p>
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{meeting.agenda}</p>
            </div>
          )}
          {meeting.notes && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Notes</p>
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{meeting.notes}</p>
            </div>
          )}
          {meeting.responsibleEmail && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Responsible</p>
              <p className="text-gray-700 text-sm">{meeting.responsibleEmail}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────── Topic Guide Section ───────────── */
function TopicGuideSection({
  meetingId,
  guide,
  onChange,
}: {
  meetingId: number;
  guide: TopicGuide | null;
  onChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("meetingId", String(meetingId));
    await fetch("/api/topic-guide", { method: "POST", body: formData });
    setUploading(false);
    onChange();
  }

  async function handleDelete() {
    if (!guide) return;
    await fetch("/api/topic-guide", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: guide.id }),
    });
    onChange();
  }

  return (
    <Section title="Topic Guide" badge={guide ? "ready" : "missing"}>
      {guide ? (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900 truncate">{guide.filename}</p>
          </div>
          <iframe src={guide.path} className="w-full h-64 border border-gray-200 rounded-lg" title={guide.filename} />
          <div className="flex gap-2 text-sm">
            <a href={guide.path} download className="text-primary-600 hover:underline">Download</a>
            <button onClick={handleDelete} className="text-red-500 hover:underline ml-auto">Replace / Delete</button>
          </div>
        </div>
      ) : (
        <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors">
          <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFile} />
          <p className="text-sm text-gray-600">{uploading ? "Uploading..." : "Click to upload PDF"}</p>
        </label>
      )}
    </Section>
  );
}

/* ───────────── Classroom Section ───────────── */
function ClassroomSection({
  meetingId,
  announcement,
  defaultTime,
  onChange,
}: {
  meetingId: number;
  announcement: ClassroomAnnouncement | null;
  defaultTime: string;
  onChange: () => void;
}) {
  const [body, setBody] = useState(announcement?.body || "");
  const [scheduledFor, setScheduledFor] = useState(
    announcement?.scheduledFor
      ? toLocalInputValue(new Date(announcement.scheduledFor))
      : defaultTime,
  );
  const [saving, setSaving] = useState<null | "draft" | "schedule">(null);
  const [message, setMessage] = useState<string | null>(null);

  const locked = announcement?.status === "sent";

  async function save(action: "draft" | "schedule") {
    setSaving(action);
    setMessage(null);
    const res = await fetch("/api/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId,
        body,
        scheduledFor: action === "schedule" ? scheduledFor : null,
        status: action === "schedule" ? "pending" : "draft",
      }),
    });
    const data = await res.json();
    if (data.error) setMessage(`Error: ${data.error}`);
    else setMessage(action === "schedule" ? "Scheduled." : "Draft saved.");
    setSaving(null);
    onChange();
  }

  async function remove() {
    if (!announcement) return;
    const msg = locked
      ? "Remove this from the dashboard? The post will stay live in Google Classroom — this only frees up the slot here so you can plan a new one."
      : "Delete this announcement?";
    if (!confirm(msg)) return;
    await fetch("/api/classroom", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: announcement.id }),
    });
    setBody("");
    onChange();
  }

  const statusBadge = announcement
    ? announcement.status === "sent"
      ? "sent"
      : announcement.status === "failed"
        ? "failed"
        : announcement.status === "pending"
          ? "scheduled"
          : "draft"
    : "missing";

  return (
    <Section title="Classroom Announcement" badge={statusBadge}>
      <div className="space-y-3">
        <RichTextEditor
          value={body}
          onChange={setBody}
          disabled={locked}
          rows={8}
          placeholder="Announcement to post in Google Classroom..."
        />
        <p className="text-[11px] text-gray-500 leading-snug">
          Classroom only accepts plain text — formatting uses Unicode (𝐛𝐨𝐥𝐝, 𝑖𝑡𝑎𝑙𝑖𝑐, U̲n̲d̲e̲r̲l̲i̲n̲e̲, • bullets) so it survives the API.
        </p>
        <Field label={locked ? "Sent at" : "Schedule for (only used when scheduling)"}>
          <input
            type="datetime-local"
            disabled={locked}
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="input disabled:opacity-60"
          />
        </Field>
        {message && (
          <p className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </p>
        )}
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => save("draft")}
              disabled={!!saving || !body}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving === "draft" ? "Saving..." : "Save draft"}
            </button>
            <button
              onClick={() => save("schedule")}
              disabled={!!saving || !body || !scheduledFor}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving === "schedule" ? "Scheduling..." : announcement?.status === "pending" ? "Update schedule" : "Schedule"}
            </button>
            {announcement && (
              <button onClick={remove} className="text-sm text-red-500 hover:underline ml-auto">
                Delete
              </button>
            )}
          </div>
        )}
        {locked && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Already posted to Classroom — cannot be edited.
            </p>
            <button
              onClick={remove}
              className="text-xs text-red-500 hover:underline"
              title="Removes the record from this dashboard only — the Classroom post stays live."
            >
              Remove from dashboard (keeps Classroom post live)
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ───────────── Shared bits ───────────── */
function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    missing: "bg-amber-100 text-amber-800",
    ready: "bg-green-100 text-green-800",
    draft: "bg-gray-100 text-gray-700",
    scheduled: "bg-blue-100 text-blue-800",
    sent: "bg-green-100 text-green-800",
    posted: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[badge] || colors.missing}`}>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
