"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: string;
}

const PAGES: PaletteItem[] = [
  { id: "nav-dashboard", label: "Dashboard", hint: "Page", href: "/", icon: "🏠" },
  { id: "nav-meetings", label: "Meetings", hint: "Page", href: "/meetings", icon: "📅" },
  { id: "nav-calendar", label: "Calendar", hint: "Page", href: "/calendar", icon: "🗓️" },
  { id: "nav-archive", label: "Past Meetings", hint: "Page", href: "/archive", icon: "🗂️" },
  { id: "nav-my-tasks", label: "My Tasks", hint: "Page", href: "/my-tasks", icon: "✅" },
  { id: "nav-topics", label: "Topic Bank", hint: "Page", href: "/topics", icon: "💡" },
  { id: "nav-stats", label: "Exec Stats", hint: "Page", href: "/stats", icon: "📊" },
  { id: "nav-executives", label: "Sec-Gen Panel", hint: "Page", href: "/executives", icon: "👥" },
  { id: "nav-instagram", label: "Instagram", hint: "Page", href: "/instagram", icon: "📷" },
];

interface MeetingRow {
  id: string;
  date: string;
  title: string;
  type: string;
}

/**
 * Ctrl/Cmd+K quick switcher: jump to any page or any meeting by typing.
 * Meetings load lazily the first time the palette opens.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [meetings, setMeetings] = useState<MeetingRow[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((cur) => !cur);
        setQuery("");
        setActive(0);
      } else if (e.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (meetings === null) {
        fetch("/api/meetings")
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => setMeetings(Array.isArray(data) ? data : []))
          .catch(() => setMeetings([]));
      }
    }
  }, [open, meetings]);

  // Close on navigation.
  useEffect(() => {
    close();
  }, [pathname, close]);

  const items = useMemo(() => {
    const meetingItems: PaletteItem[] = (meetings ?? []).map((m) => {
      const d = new Date(m.date);
      const dateLabel = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return {
        id: `meeting-${m.id}`,
        label: `${dateLabel} — ${m.title}`,
        hint: m.type === "exec" ? "Exec meeting" : "Meeting",
        href: `/meetings/${m.id}`,
        icon: m.type === "exec" ? "🟣" : "🔵",
      };
    });
    const all = [...PAGES, ...meetingItems];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 12);
    return all
      .filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
      .slice(0, 12);
  }, [meetings, query]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      router.push(items[active].href);
      close();
    }
  }

  if (pathname === "/login" || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-start justify-center pt-[15vh] px-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKey}
          placeholder="Jump to a page or meeting…"
          className="w-full px-4 py-3 text-sm border-b border-gray-100 focus:outline-none"
          aria-label="Search pages and meetings"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-gray-400 text-center">No matches.</li>
          ) : (
            items.map((item, i) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    router.push(item.href);
                    close();
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left ${
                    i === active ? "bg-primary-50 text-primary-800" : "text-gray-700"
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {item.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          ↑↓ to navigate · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}
