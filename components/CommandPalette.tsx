"use client";

/**
 * ⌘K / Ctrl-K palette: jump to any page, or search meetings, topics, tasks and
 * people. Navigation entries match locally and appear instantly; record hits
 * come from /api/search behind a short debounce.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

interface SearchHit {
  kind: "meeting" | "topic" | "task" | "executive";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface Entry {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  group: string;
}

const KIND_META: Record<SearchHit["kind"], { icon: string; group: string }> = {
  meeting: { icon: "📅", group: "Meetings" },
  topic: { icon: "💡", group: "Topics" },
  task: { icon: "✅", group: "Tasks" },
  executive: { icon: "👥", group: "People" },
};

const DEBOUNCE_MS = 180;

export function CommandPalette({ navItems }: { navItems: { href: string; label: string; icon: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Global hotkey */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isPaletteKey = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isPaletteKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Reset + focus each time it opens */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  /* Debounced remote search, cancelling in-flight requests as you type */
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await api<{ hits: SearchHit[] }>(
        `/api/search?q=${encodeURIComponent(term)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setHits(res.ok ? res.data.hits : []);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const entries = useMemo<Entry[]>(() => {
    const term = query.trim().toLowerCase();
    const nav: Entry[] = navItems
      .filter((n) => !term || n.label.toLowerCase().includes(term))
      .map((n) => ({
        id: `nav:${n.href}`,
        icon: n.icon,
        title: n.label,
        subtitle: "Go to page",
        href: n.href,
        group: "Navigate",
      }));

    const records: Entry[] = hits.map((h) => ({
      id: `${h.kind}:${h.id}`,
      icon: KIND_META[h.kind].icon,
      title: h.title,
      subtitle: h.subtitle,
      href: h.href,
      group: KIND_META[h.kind].group,
    }));

    return [...nav, ...records];
  }, [navItems, hits, query]);

  useEffect(() => {
    setActive(0);
  }, [entries.length]);

  const go = useCallback(
    (entry: Entry | undefined) => {
      if (!entry) return;
      setOpen(false);
      router.push(entry.href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
    }
  }

  /* Keep the highlighted row in view when arrowing past the fold */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
      >
        <span>🔍</span>
        <span className="flex-1 text-left">Search…</span>
        <kbd className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-gray-300 bg-white text-gray-500">
          ⌘K
        </kbd>
      </button>
    );
  }

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh] bg-gray-900/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Search and navigate"
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-gray-100">
          <span className="text-gray-400">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search meetings, topics, tasks, people…"
            className="flex-1 py-3.5 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
          />
          {loading && <span className="text-[11px] text-gray-400">searching…</span>}
        </div>

        <div ref={listRef} className="max-h-[min(24rem,60vh)] overflow-y-auto py-1.5">
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              {query.trim().length < 2
                ? "Type at least 2 characters to search."
                : "No matches."}
            </p>
          ) : (
            entries.map((entry, i) => {
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;
              return (
                <div key={entry.id}>
                  {showGroup && (
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {entry.group}
                    </p>
                  )}
                  <button
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(entry)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left ${
                      i === active ? "bg-primary-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="shrink-0">{entry.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-900 truncate">{entry.title}</span>
                      <span className="block text-xs text-gray-500 truncate">{entry.subtitle}</span>
                    </span>
                    {i === active && <span className="text-[10px] text-gray-400">↵</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
