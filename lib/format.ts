/**
 * Shared date / time formatting. Dates use DD/MM/YYYY throughout the app.
 */

/** "20/06/2026" */
export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "20/06" — compact, for badges */
export function fmtDateCompact(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** "Thursday, 20/06/2026" — keeps the weekday for prominent headers */
export function fmtDateLong(d: Date | string): string {
  const date = new Date(d);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  return `${weekday}, ${fmtDate(date)}`;
}

/** "Thu, 20/06" — short weekday + compact date for list rows */
export function fmtDateRow(d: Date | string): string {
  const date = new Date(d);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  return `${weekday}, ${fmtDateCompact(date)}`;
}

/** "11:10 AM" */
export function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "20/06/2026 · 11:10 AM" */
export function fmtDateTime(d: Date | string): string {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}
