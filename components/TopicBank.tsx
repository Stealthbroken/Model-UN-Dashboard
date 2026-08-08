"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { fmtDateCompact } from "@/lib/format";
import { TOPIC_CATEGORIES, TOPIC_DIFFICULTIES } from "@/lib/topic-seeds";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import { TopicGuideLink } from "@/components/TopicGuideLink";
import { Plus, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/components/ui";

// Dates round-trip through JSON, so they arrive as strings here.
export interface Topic {
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
  guideUrl: string | null;
  guideDocId: string | null;
  guideTitle: string | null;
  guideCreatedAt: string | null;
  voters: string[];
  voteCount: number;
}

export interface TopicMeeting {
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

type SortKey = "newest" | "votes" | "title" | "difficulty";

/**
 * Topics saved before the voting fields existed come back with `voters` and
 * `voteCount` unset, which would crash `voters.includes(...)`. Everything
 * entering component state passes through here so the rest of the file can
 * treat both as present.
 */
function normalizeTopic(t: Topic): Topic {
  return {
    ...t,
    voters: Array.isArray(t.voters) ? t.voters : [],
    voteCount: typeof t.voteCount === "number" ? t.voteCount : 0,
  };
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "idea", label: "Ideas" },
  { key: "shortlisted", label: "Shortlist" },
  { key: "used", label: "Used" },
  { key: "archived", label: "Archived" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea", shortlisted: "Shortlisted", used: "Used", archived: "Archived",
};
const STATUS_COLORS: Record<string, string> = {
  idea: "bg-amber-100 text-amber-800",
  shortlisted: "bg-blue-100 text-blue-800",
  used: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  intro: "bg-emerald-50 text-emerald-700 border-emerald-200",
  standard: "bg-amber-50 text-amber-700 border-amber-200",
  advanced: "bg-red-50 text-red-700 border-red-200",
};
const DIFFICULTY_ORDER: Record<string, number> = { intro: 0, standard: 1, advanced: 2 };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "votes", label: "Most votes" },
  { key: "title", label: "A–Z" },
  { key: "difficulty", label: "Difficulty" },
];

export function TopicBank({
  initial,
  meetings,
  aiEnabled,
  docsEnabled,
  viewerId,
  focusId,
}: {
  initial: Topic[];
  meetings: TopicMeeting[];
  aiEnabled: boolean;
  /** Apps Script is configured, so guide Docs can be generated. */
  docsEnabled: boolean;
  /** null for shared team-password sessions — voting is disabled for those. */
  viewerId: string | null;
  /** Topic to scroll to and highlight, e.g. arriving from the ⌘K palette. */
  focusId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [topics, setTopics] = useState<Topic[]>(() => initial.map(normalizeTopic));
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [onlyWithGuide, setOnlyWithGuide] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const meetingById = useMemo(
    () => new Map(meetings.map((m) => [m.id, m])),
    [meetings],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: topics.length };
    for (const t of topics) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [topics]);

  /** Categories actually in use, so the dropdown isn't a wall of unused options. */
  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of topics) if (t.category) set.add(t.category);
    for (const c of TOPIC_CATEGORIES) if (set.has(c)) set.add(c);
    return Array.from(set).sort();
  }, [topics]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = topics.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (category && t.category !== category) return false;
      if (difficulty && t.difficulty !== difficulty) return false;
      if (onlyWithGuide && !t.guideUrl) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sort === "votes") {
        return b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt);
      }
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "difficulty") {
        return (
          (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1) ||
          a.title.localeCompare(b.title)
        );
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return sorted;
  }, [topics, filter, query, category, difficulty, onlyWithGuide, sort]);

  const filtersActive =
    !!query.trim() || !!category || !!difficulty || onlyWithGuide || filter !== "all";

  /* Scroll to a topic linked from the command palette. */
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusId || focusedRef.current) return;
    const el = document.getElementById(`topic-${focusId}`);
    if (!el) return;
    focusedRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, visible]);

  /* Drop selections that scroll out of the current filter. */
  useEffect(() => {
    setSelected((cur) => {
      if (cur.size === 0) return cur;
      const visibleIds = new Set(visible.map((t) => t.id));
      const next = new Set(Array.from(cur).filter((id) => visibleIds.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [visible]);

  /* ─── mutations ─────────────────────────────────────────────────────────── */

  function replace(topic: Topic) {
    const next = normalizeTopic(topic);
    setTopics((cur) => cur.map((t) => (t.id === next.id ? next : t)));
  }

  async function createTopic(input: Partial<Topic>): Promise<boolean> {
    const res = await api<Topic>("/api/topics", { method: "POST", body: input });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setTopics((cur) => [normalizeTopic(res.data), ...cur]);
    router.refresh();
    return true;
  }

  async function patchTopic(id: string, patch: Partial<Topic>, successMsg?: string) {
    const before = topics.find((t) => t.id === id);
    // Optimistic — reverted below if the write fails.
    setTopics((cur) => cur.map((t) => (t.id === id ? ({ ...t, ...patch } as Topic) : t)));

    const res = await api<Topic>(`/api/topics/${id}`, { method: "PATCH", body: patch });
    if (!res.ok) {
      if (before) replace(before);
      toast.error(res.error);
      return;
    }
    replace(res.data);
    if (successMsg) toast.success(successMsg);
    router.refresh();
  }

  async function deleteTopic(topic: Topic) {
    if (!confirm(`Delete "${topic.title}"? This can't be undone.`)) return;
    const snapshot = topics;
    setTopics((cur) => cur.filter((t) => t.id !== topic.id));

    const res = await api(`/api/topics/${topic.id}`, { method: "DELETE" });
    if (!res.ok) {
      setTopics(snapshot);
      toast.error(res.error);
      return;
    }
    toast.success("Topic deleted.");
    router.refresh();
  }

  async function toggleVote(topic: Topic) {
    if (!viewerId) {
      toast.error("Voting needs your own account — ask a Sec-Gen to set one up.");
      return;
    }
    const hadVoted = topic.voters.includes(viewerId);
    const optimistic: Topic = {
      ...topic,
      voters: hadVoted ? topic.voters.filter((v) => v !== viewerId) : [...topic.voters, viewerId],
      voteCount: topic.voteCount + (hadVoted ? -1 : 1),
    };
    replace(optimistic);

    const res = await api<{ topic: Topic }>(`/api/topics/${topic.id}/vote`, { method: "POST" });
    if (!res.ok) {
      replace(topic);
      toast.error(res.error);
      return;
    }
    replace(res.data.topic);
  }

  async function scheduleTopic(topic: Topic, meetingId: string, markUsed: boolean) {
    setBusyId(topic.id);
    const res = await api<{
      topic: Topic;
      agendaUpdated: boolean;
      alreadyListed: boolean;
      agendaNote?: string;
      meetingTitle: string;
    }>(`/api/topics/${topic.id}/schedule`, {
      method: "POST",
      body: { meetingId, markUsed },
    });
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    replace(res.data.topic);
    const { agendaUpdated, alreadyListed, agendaNote, meetingTitle } = res.data;
    if (agendaNote) toast.info(agendaNote);
    else if (agendaUpdated) toast.success(`Added to the agenda for ${meetingTitle}.`);
    else if (alreadyListed) toast.info(`Already on the agenda for ${meetingTitle}.`);
    else toast.success(`Linked to ${meetingTitle}.`);
    router.refresh();
  }

  async function loadSuggestions() {
    setSuggesting(true);
    setSuggestNotice(null);
    const res = await api<{ suggestions: Suggestion[]; aiEnabled: boolean }>(
      "/api/topics/suggest",
      { method: "POST" },
    );
    setSuggesting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSuggestions(res.data.suggestions ?? []);
    if (!res.data.aiEnabled) {
      setSuggestNotice(
        "AI suggestions are off (set GEMINI_API_KEY to enable). Showing curated picks only.",
      );
    }
  }

  async function adoptSuggestion(s: Suggestion) {
    const created = await createTopic({
      title: s.title,
      description: s.description,
      category: s.category,
      difficulty: s.difficulty,
      status: "idea",
      source: s.source,
    });
    if (created) {
      setSuggestions((cur) => cur?.filter((x) => x.title !== s.title) ?? null);
    }
  }

  /* ─── bulk actions ──────────────────────────────────────────────────────── */

  async function bulkStatus(status: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const res = await api<{ topics: Topic[]; updated: number }>("/api/topics", {
      method: "PATCH",
      body: { ids, patch: { status } },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const byId = new Map(res.data.topics.map((t) => [t.id, normalizeTopic(t)]));
    setTopics((cur) => cur.map((t) => byId.get(t.id) ?? t));
    setSelected(new Set());
    toast.success(
      `Moved ${res.data.updated} topic${res.data.updated === 1 ? "" : "s"} to ${
        STATUS_LABEL[status] ?? status
      }.`,
    );
    router.refresh();
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} topic${ids.length === 1 ? "" : "s"}? This can't be undone.`)) {
      return;
    }

    const res = await api<{ deleted: number }>("/api/topics", {
      method: "DELETE",
      body: { ids },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const removed = new Set(ids);
    setTopics((cur) => cur.filter((t) => !removed.has(t.id)));
    setSelected(new Set());
    toast.success(`Deleted ${res.data.deleted} topic${res.data.deleted === 1 ? "" : "s"}.`);
    router.refresh();
  }

  function toggleSelected(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setCategory("");
    setDifficulty("");
    setOnlyWithGuide(false);
    setFilter("all");
  }

  /* ─── render ────────────────────────────────────────────────────────────── */

  return (
    <div className="page-shell">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">Build the agenda</p>
          <h1 className="page-heading mt-1">Topic bank</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Brainstorm and rotate through debate topics. Vote to rank them, attach a Google Docs
            topic guide, and push the winner straight onto a meeting agenda.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSuggestions}
            disabled={suggesting}
            className="btn btn-secondary"
            title={aiEnabled ? "Mix of curated + AI suggestions" : "Curated only — set GEMINI_API_KEY to enable AI"}
          >
            <Sparkles size={16} aria-hidden="true" />{suggesting ? "Thinking…" : "Suggest topics"}
          </button>
          <button
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="btn btn-primary"
          >
            <Plus size={16} aria-hidden="true" />New topic
          </button>
        </div>
      </div>

      {/* Suggestions panel */}
      {suggestions !== null && (
        <div className="mb-5 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-primary-900">
              Suggested topics{" "}
              <span className="text-primary-700/70 font-normal">
                ({suggestions.length} — curated + {aiEnabled ? "AI" : "more curated"})
              </span>
            </h2>
            <button onClick={() => setSuggestions(null)} className="text-xs text-primary-700 hover:underline">
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
              const ok = await createTopic(payload);
              if (ok) setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <button type="button" onClick={() => setFiltersOpen((value) => !value)} className="btn btn-secondary mb-3 w-full md:hidden" aria-expanded={filtersOpen}><SlidersHorizontal size={17} />Filters{filtersActive && <span className="h-2 w-2 rounded-full bg-primary-600" />}</button>

      {/* Search + filters */}
      <div className={cn("mb-4 space-y-2.5", filtersOpen ? "block" : "hidden md:block")}>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, framing, notes…"
              className="input pl-8"
              aria-label="Search topics"
            />
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-auto text-sm"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {usedCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="input w-auto text-sm"
            aria-label="Filter by difficulty"
          >
            <option value="">Any difficulty</option>
            {TOPIC_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input w-auto text-sm"
            aria-label="Sort topics"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>Sort: {o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-gray-100 p-1 text-sm">
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
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithGuide}
              onChange={(e) => setOnlyWithGuide(e.target.checked)}
              className="rounded border-gray-300"
            />
            Has a guide
          </label>
          {filtersActive && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-primary-600">
              Clear filters
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {visible.length} of {topics.length} shown
          </span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5">
          <span className="text-sm font-medium text-primary-900">
            {selected.size} selected
          </span>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {(["idea", "shortlisted", "used", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => bulkStatus(s)}
                className="text-xs px-2 py-1 rounded-md bg-white border border-primary-200 text-primary-800 hover:bg-primary-100"
              >
                → {STATUS_LABEL[s]}
              </button>
            ))}
            <button
              onClick={bulkDelete}
              className="text-xs px-2 py-1 rounded-md bg-white border border-red-200 text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-2 py-1 text-primary-700 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Topic list */}
      {visible.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">
            {topics.length === 0
              ? "No topics yet. Try ✨ Suggest topics above or add your own."
              : "No topics match these filters."}
          </p>
          {filtersActive && topics.length > 0 && (
            <button onClick={clearFilters} className="mt-2 text-sm text-primary-600 hover:underline">
              Clear filters
            </button>
          )}
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
                  await patchTopic(t.id, payload, "Topic updated.");
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
                viewerId={viewerId}
                docsEnabled={docsEnabled}
                busy={busyId === t.id}
                highlighted={focusId === t.id}
                checked={selected.has(t.id)}
                onCheck={() => toggleSelected(t.id)}
                onPatch={(patch, msg) => patchTopic(t.id, patch, msg)}
                onGuideChange={replace}
                onVote={() => toggleVote(t)}
                onSchedule={(meetingId, markUsed) => scheduleTopic(t, meetingId, markUsed)}
                onEdit={() => { setEditingId(t.id); setAdding(false); }}
                onDelete={() => deleteTopic(t)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────────────── */

function TopicCard({
  topic, meetings, meetingTitle, viewerId, docsEnabled, busy, highlighted, checked,
  onCheck, onPatch, onGuideChange, onVote, onSchedule, onEdit, onDelete,
}: {
  topic: Topic;
  meetings: TopicMeeting[];
  meetingTitle: string | null;
  viewerId: string | null;
  docsEnabled: boolean;
  busy: boolean;
  highlighted: boolean;
  checked: boolean;
  onCheck: () => void;
  onPatch: (patch: Partial<Topic>, successMsg?: string) => void;
  onGuideChange: (topic: Topic) => void;
  onVote: () => void;
  onSchedule: (meetingId: string, markUsed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const hasVoted = !!viewerId && topic.voters.includes(viewerId);

  function changeStatus(next: string) {
    // Marking "used" needs a meeting to attribute it to.
    if (next === "used" && !topic.meetingId) {
      setScheduling(true);
      return;
    }
    onPatch({ status: next }, `Moved to ${STATUS_LABEL[next] ?? next}.`);
  }

  return (
    <div
      id={`topic-${topic.id}`}
      className={`bg-white rounded-xl border shadow-sm p-4 transition-colors ${
        highlighted ? "border-primary-400 ring-2 ring-primary-100" : "border-gray-200"
      } ${busy ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          className="mt-1 rounded border-gray-300 shrink-0"
          aria-label={`Select ${topic.title}`}
        />

        {/* Vote button */}
        <button
          onClick={onVote}
          disabled={!viewerId}
          title={
            viewerId
              ? hasVoted ? "Remove your vote" : "Vote for this topic"
              : "Voting needs your own account"
          }
          className={`shrink-0 w-11 flex flex-col items-center justify-center rounded-lg border py-1 transition-colors ${
            hasVoted
              ? "border-primary-300 bg-primary-50 text-primary-700"
              : "border-gray-200 text-gray-500 hover:border-primary-300 hover:text-primary-600"
          } disabled:opacity-40 disabled:hover:border-gray-200`}
        >
          <span className="text-xs leading-none">▲</span>
          <span className="text-sm font-bold leading-tight">{topic.voteCount}</span>
        </button>

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

          {/* Google Docs topic guide */}
          <div className="mt-2.5">
            <TopicGuideLink topic={topic} docsEnabled={docsEnabled} onChange={onGuideChange} />
          </div>

          {topic.notes && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer select-none">Notes</summary>
              <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{topic.notes}</p>
            </details>
          )}

          {topic.meetingId && (
            <p className="text-xs text-gray-500 mt-2">
              {topic.status === "used" ? "Used at" : "Scheduled for"}:{" "}
              <Link href={`/meetings/${topic.meetingId}`} className="text-primary-600 hover:underline">
                {meetingTitle}
              </Link>
              {topic.usedAt && <span className="text-gray-400"> · {fmtDateCompact(topic.usedAt)}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <select
            value={topic.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
            aria-label="Topic status"
          >
            <option value="idea">Idea</option>
            <option value="shortlisted">Shortlist</option>
            <option value="used">Used</option>
            <option value="archived">Archived</option>
          </select>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setScheduling((v) => !v)}
              className="px-2 py-0.5 text-gray-500 hover:text-primary-700"
              title="Attach to a meeting and add it to that agenda"
            >
              Schedule
            </button>
            <button onClick={onEdit} className="px-2 py-0.5 text-gray-500 hover:text-primary-700">
              Edit
            </button>
            <button onClick={onDelete} className="px-2 py-0.5 text-gray-400 hover:text-red-600">
              Delete
            </button>
          </div>
        </div>
      </div>

      {scheduling && (
        <SchedulePicker
          meetings={meetings}
          busy={busy}
          onCancel={() => setScheduling(false)}
          onPick={(meetingId, markUsed) => {
            onSchedule(meetingId, markUsed);
            setScheduling(false);
          }}
        />
      )}
    </div>
  );
}

function SchedulePicker({
  meetings, busy, onCancel, onPick,
}: {
  meetings: TopicMeeting[];
  busy: boolean;
  onCancel: () => void;
  onPick: (meetingId: string, markUsed: boolean) => void;
}) {
  const [meetingId, setMeetingId] = useState("");
  const [markUsed, setMarkUsed] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <p className="text-xs text-gray-500">
        Attach to a meeting — the topic is appended to that meeting&apos;s agenda.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white flex-1 min-w-[12rem]"
        >
          <option value="">Select a meeting…</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {fmtDateCompact(m.date)} — {m.title}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={markUsed}
            onChange={(e) => setMarkUsed(e.target.checked)}
            className="rounded border-gray-300"
          />
          Mark as used
        </label>
        <button
          onClick={() => meetingId && onPick(meetingId, markUsed)}
          disabled={!meetingId || busy}
          className="text-xs px-2.5 py-1 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to agenda"}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, onAdopt }: { suggestion: Suggestion; onAdopt: () => void }) {
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
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "standard");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [guideUrl, setGuideUrl] = useState(initial?.guideUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      difficulty,
      notes: notes.trim(),
      guideUrl: guideUrl.trim() || null,
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
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input text-sm">
          <option value="">Category (optional)</option>
          {TOPIC_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input text-sm">
          {TOPIC_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <input
        value={guideUrl}
        onChange={(e) => setGuideUrl(e.target.value)}
        placeholder="Topic guide link (Google Doc URL — optional)"
        className="input text-sm"
        type="url"
      />
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Private notes (research links, why we picked it, etc.)"
        className="input text-sm"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
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
