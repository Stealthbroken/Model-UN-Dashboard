import type { MinutesTemplate } from "@/lib/doc-templates";

/**
 * The Apps Script web app must be deployed with "Who has access: Anyone" so the
 * dashboard can reach it (Google can't authenticate our anonymous server call).
 * That means the deployment URL is the only thing standing between the public
 * and actions that send mail from the school account or post to Classroom.
 *
 * So we add a shared secret: the dashboard signs every request with
 * APPS_SCRIPT_SECRET, and the script rejects anything whose secret doesn't match
 * its SHARED_SECRET script property. Set both to the same value to lock it down.
 * If either side is unset the script stays open (for first-run), so configure it.
 */
function withSecret(payload: Record<string, unknown>): string {
  const secret = process.env.APPS_SCRIPT_SECRET;
  return JSON.stringify(secret ? { ...payload, secret } : payload);
}

interface PostAnnouncementOptions {
  body: string;
  materialUrl?: string | null;
  materialName?: string | null;
}

export async function postToClassroom(
  opts: PostAnnouncementOptions
): Promise<{ ok: boolean; error?: string; attachmentNote?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  const courseId = process.env.CLASSROOM_COURSE_ID;

  if (!url || !courseId) {
    return { ok: false, error: "Apps Script URL or Course ID not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: withSecret({
        action: "announce",
        courseId,
        body: opts.body,
        materialUrl: opts.materialUrl || null,
        materialName: opts.materialName || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apps Script returned ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { ok: !!data.ok, error: data.error, attachmentNote: data.attachmentNote };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function sendReminderEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: "Apps Script URL not configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: withSecret({ action: "email", to, subject, body }),
    });

    if (!res.ok) return { ok: false, error: `Apps Script returned ${res.status}` };
    const data = await res.json();
    return { ok: !!data.ok, error: data.error };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Apps Script reports a missing OAuth scope as a raw exception string, e.g.
 * "You do not have permission to call DocumentApp.create." That's accurate but
 * gives no idea what to do, and it happens every time the script starts using a
 * Google API it hasn't been authorized for — so translate it into the fix.
 */
function explainScriptError(error: string | undefined): string | undefined {
  if (!error) return error;
  if (/do not have permission|required permissions|not authorized|authorization is required/i.test(error)) {
    return (
      "Google Apps Script isn't authorized for this yet. Open the script, run any " +
      "function once to accept the new permissions, then redeploy (Deploy → Manage " +
      "deployments → edit → New version). See the README's Apps Script section. " +
      `Original error: ${error}`
    );
  }
  return error;
}

export interface MinutesDocTask {
  description: string;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  label: string | null;
}

export interface MinutesDocExecutive {
  name: string;
  role: string;
  present: boolean;
  tasks: MinutesDocTask[];
}

/** The full snapshot rendered into a minutes Doc — shared by create + update. */
export interface MinutesDocData {
  title: string;
  date: string;
  location: string;
  agenda?: string | null;
  executives: MinutesDocExecutive[];
  /**
   * Layout from the Sec-Gen Panel. Sent on update as well as create, because
   * the sync has to look for the *current* boundary heading to know which part
   * of the Doc it owns — a renamed heading would otherwise make it rebuild the
   * whole document and wipe the typed notes.
   */
  template?: MinutesTemplate;
  /** Pre-rendered Doc name from the template's title pattern. */
  docName?: string;
}

export async function createMinutesDoc(
  data: MinutesDocData & { sharedDriveId?: string | null },
): Promise<{ ok: boolean; error?: string; docId?: string; docUrl?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: "Apps Script URL not configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: withSecret({
        action: "createMinutesDoc",
        title: data.title,
        date: data.date,
        location: data.location,
        agenda: data.agenda || null,
        executives: data.executives,
        sharedDriveId: data.sharedDriveId || null,
        template: data.template || null,
        docName: data.docName || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apps Script returned ${res.status}: ${text}` };
    }

    const json = await res.json();
    return {
      ok: !!json.ok,
      error: explainScriptError(json.error),
      docId: json.docId,
      docUrl: json.docUrl,
    };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export interface CreateDocFromHtmlData {
  /** Doc name, without an extension. */
  name: string;
  /** Full document body as HTML — Drive converts it to a native Doc. */
  html: string;
  /** Drive folder to create it in. Falls back to the script owner's My Drive. */
  folderId?: string | null;
}

/**
 * Creates a Google Doc from HTML rendered by the dashboard.
 *
 * The document layout lives in lib/doc-templates.ts rather than in the Apps
 * Script, so editing a template never requires redeploying the script. It also
 * only needs the Drive scope: the previous DocumentApp approach additionally
 * required auth/documents, which isn't always grantable.
 */
export async function createDocFromHtml(
  data: CreateDocFromHtmlData,
): Promise<{ ok: boolean; error?: string; docId?: string; docUrl?: string; note?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: "Apps Script URL not configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: withSecret({
        action: "createDocFromHtml",
        name: data.name,
        html: data.html,
        folderId: data.folderId || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apps Script returned ${res.status}: ${text}` };
    }

    const json = await res.json();
    return {
      ok: !!json.ok,
      error: explainScriptError(json.error),
      docId: json.docId,
      docUrl: json.docUrl,
      // Set when the configured folder was unusable and Drive fell back to My Drive.
      note: json.note || undefined,
    };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Re-syncs the managed region of an existing minutes Doc (header, attendance,
 * agenda, weekly tasks) — the human-written Discussion Notes are left intact.
 */
export async function updateMinutesDoc(
  docId: string,
  data: MinutesDocData,
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: "Apps Script URL not configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: withSecret({
        action: "updateMinutesDoc",
        docId,
        title: data.title,
        date: data.date,
        location: data.location,
        agenda: data.agenda || null,
        executives: data.executives,
        template: data.template || null,
      }),
    });
    if (!res.ok) return { ok: false, error: `Apps Script returned ${res.status}` };
    const json = await res.json();
    return { ok: !!json.ok, error: explainScriptError(json.error) };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
