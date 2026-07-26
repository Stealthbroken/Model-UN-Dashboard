/**
 * Browser-side fetch wrapper. Every call returns a discriminated result rather
 * than throwing, so callers can surface a real message instead of swallowing a
 * non-ok response — which is what most of this app used to do.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON body. Omit for GET/DELETE. */
  body?: unknown;
  signal?: AbortSignal;
}

const GENERIC_ERROR = "Something went wrong. Check your connection and try again.";

export async function api<T = unknown>(url: string, opts: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, signal } = opts;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Cancelled." };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const payload = await readJson(res);

  if (!res.ok) {
    const message =
      (isRecord(payload) && typeof payload.error === "string" && payload.error) ||
      statusMessage(res.status);
    return { ok: false, error: message };
  }

  return { ok: true, data: payload as T };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function statusMessage(status: number): string {
  if (status === 401) return "Your session expired. Reload the page and sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item no longer exists — try refreshing.";
  if (status === 409) return "That conflicts with the current state. Refresh and retry.";
  if (status === 429) return "Too many requests. Give it a moment.";
  if (status >= 500) return "The server hit an error. Try again in a moment.";
  return GENERIC_ERROR;
}
