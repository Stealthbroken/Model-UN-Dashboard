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
      body: JSON.stringify({
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
      body: JSON.stringify({ action: "email", to, subject, body }),
    });

    if (!res.ok) return { ok: false, error: `Apps Script returned ${res.status}` };
    const data = await res.json();
    return { ok: !!data.ok, error: data.error };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
      body: JSON.stringify({
        action: "createMinutesDoc",
        title: data.title,
        date: data.date,
        location: data.location,
        agenda: data.agenda || null,
        executives: data.executives,
        sharedDriveId: data.sharedDriveId || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apps Script returned ${res.status}: ${text}` };
    }

    const json = await res.json();
    return {
      ok: !!json.ok,
      error: json.error,
      docId: json.docId,
      docUrl: json.docUrl,
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
      body: JSON.stringify({
        action: "updateMinutesDoc",
        docId,
        title: data.title,
        date: data.date,
        location: data.location,
        agenda: data.agenda || null,
        executives: data.executives,
      }),
    });
    if (!res.ok) return { ok: false, error: `Apps Script returned ${res.status}` };
    const json = await res.json();
    return { ok: !!json.ok, error: json.error };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
