/**
 * Topic Bank domain rules shared by the routes and the UI.
 */
import { TOPIC_CATEGORIES, TOPIC_DIFFICULTIES } from "@/lib/topic-seeds";

export const TOPIC_STATUSES = ["idea", "shortlisted", "used", "archived"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export function isTopicStatus(v: unknown): v is TopicStatus {
  return typeof v === "string" && (TOPIC_STATUSES as readonly string[]).includes(v);
}

export function normalizeStatus(v: unknown): TopicStatus {
  return isTopicStatus(v) ? v : "idea";
}

export function normalizeDifficulty(v: unknown): string {
  return typeof v === "string" && (TOPIC_DIFFICULTIES as readonly string[]).includes(v)
    ? v
    : "standard";
}

export function normalizeCategory(v: unknown): string {
  if (typeof v !== "string") return "";
  return (TOPIC_CATEGORIES as readonly string[]).includes(v) ? v : v.trim().slice(0, 60);
}

/* ─── Guide links ─────────────────────────────────────────────────────────── */

/** `value` is the normalized URL, or null when the field is being cleared. */
export type GuideUrlCheck =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Accepts any https link so teams can point at a Doc, a Drive PDF, or a shared
 * research folder — but rejects the http/javascript/data cases outright rather
 * than storing something that renders as an unsafe link.
 */
export function validateGuideUrl(raw: unknown): GuideUrlCheck {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Enter a link." };

  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > 1_900) return { ok: false, error: "That link is too long." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a link. Paste the full https:// URL." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Use an https:// link." };
  }
  return { ok: true, value: parsed.toString() };
}

/** True for links that will open in Google Docs — used to pick the right icon. */
export function isGoogleDocUrl(url: string | null): boolean {
  if (!url) return false;
  return /^https:\/\/(docs|drive)\.google\.com\//.test(url);
}

/** Extracts a Doc id from a Google Docs URL, when there is one. */
export function extractDocId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
