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
