"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmtDateCompact } from "@/lib/format";
import { TOPIC_CATEGORIES, TOPIC_DIFFICULTIES } from "@/lib/topic-seeds";

// Dates round-trip through JSON, so they arrive as strings here.
interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  status: string;
  notes: string;
  meetingId: string | null;
  usedAt: string | null;
  createdAt: string;
  source: string;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  type: string;
}

interface Suggestion {
  title: string;
  description: string;
  category: string;
  difficulty: "intro" | "standard" | "advanced";
  source: "curated" | "ai";
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "idea",        label: "Ideas" },
  { key: "shortlisted", label: "Shortlist" },
  { key: "used",        label: "Used" },
  { key: "archived",    label: "Archived" },
];

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea", shortlisted: "Shortlisted", used: "Used", archived: "Archived",
};
const STATUS_COLORS: Record<string, string> = {
  idea:        "bg-amber-100 text-amber-800",
  shortlisted: "bg-blue-100 text-blue-800",
  used:        "bg-green-100 text-green-800",
  archived:    "bg-gray-100 text-gray-600",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  intro:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  standard: "bg-amber-50 text-amber-700 border-amber-200",
  advanced: "bg-red-50 text-red-700 border-red-200",
};

export function TopicBank({
  initial, meetings, aiEnabled,
}: {
  initial: Topic[];
  meetings: Meeting[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>(initial);
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null);

  const meetingById = useMemo(() => {
    const m = new Map<string, Meeting>();
    for (const x of meetings) m.set(x.id, x);
    return m;
  }, [meetings]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: topics.length };
    for (const t of topics) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [topics]);

  const visible = useMemo(() => {
    if (filter === "all") return topics;
    return topics.filter((t) => t.status === filter);
  }, [topics, filter]);

  // ─── mutations ──────────────────────────────────────────────────────────

  async function createTopic(input: Partial<Topic>) {
    const res = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return;
    const created: Topic = await res.json();
    setTopics((cur) => [created, ...cur]);
    router.refresh();
  }

  async function patchTopic(id: string, patch: Partial<Topic>) {
    // Optimistic update.
    setTopics((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } as Topic : t)));
    const res = await fetch(`/api/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated: Topic = await res.json();
      setTopics((cur) => cur.map((t) => (t.id === id ? updated : t)));
    }
    router.refresh();
  }

  async function deleteTopic(id: string) {
    if (!confirm("Delete this topic? This can't be undone.")) return;
    setTopics((cur) => cur.filter((t) => t.id !== id));
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function loadSuggestions() {
    setSuggesting(true);
    setSuggestNotice(null);
    try {
      const res = await fetch("/api/topics/suggest", { method: "POST" });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      if (!data.aiEnabled) {
        setSuggestNotice("AI suggestions are off (set OPENAI_API_KEY to enable). Showing curated picks only.");
      }
    } catch {
      setSuggestNotice("Couldn't load suggestions. Try again in a moment.");
    } finally {
      setSuggesting(false);
    }
  }

  async function adoptSuggestion(s: Suggestion) {
    await createTopic({
      title: s.title,
      description: s.description,
      category: s.category,
      difficulty: s.difficulty,
      status: "idea",
      source: s.source,
    });
    setSuggestions((cur) => cur?.filter((x) => x.title !== s.title) ?? null);
  }

  // ─── render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topic Bank</h1>
          <p className="text-sm text-gray-500 mt-1">
            Brainstorm and rotate through MUN debate topics. Promote ideas through the shortlist, mark them used when one runs at a meeting.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSuggestions}
            disabled={suggesting}
            className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            title={aiEnabled ? "Mix of curated + AI suggestions" : "Curated only — set OPENAI_API_KEY to enable AI"}
          >
            {suggesting ? "Thinking…" : "✨ Suggest topics"}
          </button>
          <button
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            + New topic
          </button>
        </div>
      </div>

      {/* Suggestions panel */}
      {suggestions !== null && (
        <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-primary-900">
              Suggested topics{" "}
              <span className="text-primary-700/70 font-normal">
                ({suggestions.length} — curated + {aiEnabled ? "AI" : "more curated"})
              </span>
            </h2>
            <button
              onClick={() => setSuggestions(null)}
              className="text-xs text-primary-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
          {suggestNotice && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mb-2">
              {suggestNotice}
            </p>
          )}
          {suggestions.length === 0 ? (
            <p className="text-sm text-gray-500">No fresh ideas right now. Try again later.</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <SuggestionCard key={s.title} suggestion={s} onAdopt={() => adoptSuggestion(s)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* New topic form */}
      {adding && (
        <div className="mb-4">
          <TopicForm
            submitLabel="Add topic"
            onSubmit={async (payload) => {
              await createTopic(payload);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] text-gray-400">{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Topic list */}
      {visible.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">
            {topics.length === 0
              ? "No topics yet. Try ✨ Suggest topics above or add your own."
              : `No topics in "${STATUS_TABS.find((t) => t.key === filter)?.label}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) =>
            editingId === t.id ? (
              <TopicForm
                key={t.id}
                initial={t}
                submitLabel="Save"
                onSubmit={async (payload) => {
                  await patchTopic(t.id, payload);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TopicCard
                key={t.id}
                topic={t}
                meetings={meetings}
                meetingTitle={t.meetingId ? meetingById.get(t.meetingId)?.title ?? "(removed)" : null}
                onPatch={(patch) => patchTopic(t.id, patch)}
                onEdit={() => { setEditingId(t.id); setAdding(false); }}
                onDelete={() => deleteTopic(t.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────────── */

function TopicCard({
  topic, meetings, meetingTitle, onPatch, onEdit, onDelete,
}: {
  topic: Topic;
  meetings: Meeting[];
  meetingTitle: string | null;
  onPatch: (patch: Partial<Topic>) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pickingMeeting, setPickingMeeting] = useState(false);

  function changeStatus(next: string) {
    if (next === "used" && !topic.meetingId) {
      setPickingMeeting(true);
      return;
    }
    onPatch({ status: next });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLORS[topic.status]}`}>
              {STATUS_LABEL[topic.status] ?? topic.status}
            </span>
            {topic.category && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                {topic.category}
              </span>
            )}
            {topic.difficulty && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${DIFFICULTY_COLORS[topic.difficulty] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                {topic.difficulty}
              </span>
            )}
            {topic.source === "ai" && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200" title="Adopted from an AI suggestion">
                ✨ AI
              </span>
            )}
            {topic.source === "curated" && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200" title="Adopted from the curated bank">
                Curated
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 leading-snug">{topic.title}</h3>
          {topic.description && (
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{topic.description}</p>
          )}
          {topic.notes && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer select-none">Notes</summary>
              <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{topic.notes}</p>
            </details>
          )}
          {topic.status === "used" && topic.meetingId && (
            <p className="text-xs text-gray-500 mt-2">
              Used at:{" "}
              <Link href={`/meetings/${topic.meetingId}`} className="text-primary-600 hover:underline">
                {meetingTitle}
              </Link>
              {topic.usedAt && <span className="text-gray-400"> · {fmtDateCompact(topic.usedAt)}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <select
            value={topic.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
          >
            <option value="idea">Idea</option>
            <option value="shortlisted">Shortlist</option>
            <option value="used">Used</option>
            <option value="archived">Archived</option>
          </select>
          <div className="flex gap-1 text-xs">
            <button onClick={onEdit} className="px-2 py-0.5 text-gray-500 hover:text-primary-700">
              Edit
            </button>
            <button onClick={onDelete} className="px-2 py-0.5 text-gray-400 hover:text-red-600">
              Delete
            </button>
          </div>
        </div>
      </div>

      {pickingMeeting && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Which meeting was this used at?</span>
          <select
            className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              onPatch({ status: "used", meetingId: id });
              setPickingMeeting(false);
            }}
          >
            <option value="" disabled>Select a meeting…</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {fmtDateCompact(m.date)} — {m.title}
              </option>
            ))}
          </select>
          <button
            onClick={() => setPickingMeeting(false)}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion, onAdopt,
}: {
  suggestion: Suggestion;
  onAdopt: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-primary-100 p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {suggestion.category && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
              {suggestion.category}
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${DIFFICULTY_COLORS[suggestion.difficulty] || ""}`}>
            {suggestion.difficulty}
          </span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              suggestion.source === "ai"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            {suggestion.source === "ai" ? "✨ AI" : "Curated"}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug">{suggestion.title}</p>
        {suggestion.description && (
          <p className="text-xs text-gray-600 mt-0.5">{suggestion.description}</p>
        )}
      </div>
      <button
        onClick={onAdopt}
        className="text-xs px-2.5 py-1 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 transition-colors shrink-0"
      >
        + Add
      </button>
    </div>
  );
}

function TopicForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial?: Partial<Topic>;
  submitLabel: string;
  onSubmit: (payload: Partial<Topic>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title,       setTitle]       = useState(initial?.title       ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category,    setCategory]    = useState(initial?.category    ?? "");
  const [difficulty,  setDifficulty]  = useState(initial?.difficulty  ?? "standard");
  const [notes,       setNotes]       = useState(initial?.notes       ?? "");
  const [saving,      setSaving]      = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      difficulty,
      notes: notes.trim(),
    });
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Topic title (e.g. The future of NATO expansion)"
        className="input"
      />
      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="One-sentence framing for the debate (optional)"
        className="input text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input text-sm"
        >
          <option value="">Category (optional)</option>
          {TOPIC_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="input text-sm"
        >
          {TOPIC_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Private notes (research links, why we picked it, etc.)"
        className="input text-sm"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
