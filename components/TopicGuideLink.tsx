"use client";

/**
 * A topic's Google Docs topic guide. Two ways to get one:
 *   - Generate a pre-formatted Doc (background, key questions, bloc positions,
 *     sources) via Apps Script.
 *   - Paste a link to a Doc you already wrote.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import { isGoogleDocUrl } from "@/lib/topics";
import { fmtDate } from "@/lib/format";
import type { Topic } from "@/components/TopicBank";

export function TopicGuideLink({
  topic,
  docsEnabled,
  onChange,
}: {
  topic: Topic;
  docsEnabled: boolean;
  onChange: (topic: Topic) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.guideUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function generate(replace: boolean) {
    setBusy(true);
    const res = await api<{ topic: Topic }>(`/api/topics/${topic.id}/guide`, {
      method: "POST",
      body: { replace },
    });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onChange(res.data.topic);
    toast.success("Topic guide Doc created in Drive.", { copy: res.data.topic.guideUrl ?? undefined });
    router.refresh();
  }

  async function saveLink() {
    const value = draft.trim();
    setBusy(true);
    const res = await api<Topic>(`/api/topics/${topic.id}`, {
      method: "PATCH",
      body: { guideUrl: value || null },
    });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onChange(res.data);
    setEditing(false);
    toast.success(value ? "Topic guide linked." : "Topic guide link removed.");
    router.refresh();
  }

  async function unlink() {
    if (!confirm("Unlink this topic guide? The Google Doc itself isn't deleted.")) return;
    setBusy(true);
    const res = await api<Topic>(`/api/topics/${topic.id}/guide`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onChange(res.data);
    setDraft("");
    toast.success("Topic guide unlinked.");
    router.refresh();
  }

  /* ── Editing the pasted link ── */
  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          autoFocus
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveLink();
            if (e.key === "Escape") {
              setDraft(topic.guideUrl ?? "");
              setEditing(false);
            }
          }}
          placeholder="https://docs.google.com/document/d/…"
          className="input text-xs flex-1 min-w-[14rem]"
        />
        <button
          onClick={saveLink}
          disabled={busy}
          className="text-xs px-2 py-1 rounded-md bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setDraft(topic.guideUrl ?? "");
            setEditing(false);
          }}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  /* ── A guide is linked ── */
  if (topic.guideUrl) {
    const isDoc = isGoogleDocUrl(topic.guideUrl);
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <a
          href={topic.guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary-200 bg-primary-50 text-primary-800 font-medium hover:bg-primary-100 transition-colors max-w-full"
          title={topic.guideUrl}
        >
          <span>{isDoc ? "📄" : "🔗"}</span>
          <span className="truncate">{topic.guideTitle || "Topic guide"}</span>
          <span className="text-[10px] opacity-60">↗</span>
        </a>
        {topic.guideCreatedAt && (
          <span className="text-gray-400">linked {fmtDate(topic.guideCreatedAt)}</span>
        )}
        <button
          onClick={() => setEditing(true)}
          disabled={busy}
          className="text-gray-500 hover:text-primary-700 disabled:opacity-50"
        >
          Change link
        </button>
        <button
          onClick={unlink}
          disabled={busy}
          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
        >
          Unlink
        </button>
      </div>
    );
  }

  /* ── No guide yet ── */
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-400">No topic guide</span>
      {docsEnabled ? (
        <button
          onClick={() => generate(false)}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          title="Create a pre-formatted Google Doc with sections for background, key questions, bloc positions and sources"
        >
          {busy ? "Creating…" : "📄 Create guide doc"}
        </button>
      ) : (
        <span
          className="text-gray-400"
          title="Set APPS_SCRIPT_URL to generate Docs automatically (see SETUP.md)"
        >
          (Doc generation off)
        </span>
      )}
      <button
        onClick={() => setEditing(true)}
        disabled={busy}
        className="text-gray-500 hover:text-primary-700 disabled:opacity-50"
      >
        Paste a link
      </button>
    </div>
  );
}
