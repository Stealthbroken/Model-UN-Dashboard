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

export interface MinutesDocExecutive {
  name: string;
  role: string;
  tasks: { description: string; completed: boolean }[];
}

export interface CreateMinutesDocOptions {
  title: string;
  date: string;
  location: string;
  agenda?: string | null;
  executives: MinutesDocExecutive[];
  sharedDriveId?: string | null;
}

export async function createMinutesDoc(
  opts: CreateMinutesDocOptions,
): Promise<{ ok: boolean; error?: string; docId?: string; docUrl?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: "Apps Script URL not configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createMinutesDoc",
        title: opts.title,
        date: opts.date,
        location: opts.location,
        agenda: opts.agenda || null,
        executives: opts.executives,
        sharedDriveId: opts.sharedDriveId || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apps Script returned ${res.status}: ${text}` };
    }

    const data = await res.json();
    return {
      ok: !!data.ok,
      error: data.error,
      docId: data.docId,
      docUrl: data.docUrl,
    };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Rewrites just the "Weekly Tasks" section of an existing minutes Doc — used
 * to keep the doc in sync as tasks are added/checked off in the dashboard.
 */
export async function updateMinutesDoc(
  docId: string,
  executives: MinutesDocExecutive[],
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: "Apps Script URL not configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateMinutesDoc", docId, executives }),
    });
    if (!res.ok) return { ok: false, error: `Apps Script returned ${res.status}` };
    const data = await res.json();
    return { ok: !!data.ok, error: data.error };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
