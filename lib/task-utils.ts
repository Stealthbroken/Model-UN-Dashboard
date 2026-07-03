export function normalizePriority(p?: string): "high" | "medium" | "low" {
  return p === "high" || p === "low" ? p : "medium";
}

// A date-only string ("YYYY-MM-DD") is anchored at local noon so the calendar
// day doesn't drift when displayed in another timezone.
export function parseDueDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
