"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";

/**
 * Where generated topic-guide Docs are filed. Blank falls back to the minutes
 * shared drive, then to the Apps Script owner's My Drive.
 */
export function TopicGuideSettings({
  initialFolderId,
  docsEnabled,
}: {
  initialFolderId: string;
  docsEnabled: boolean;
}) {
  const toast = useToast();
  const [folderId, setFolderId] = useState(initialFolderId);
  const [saved, setSaved] = useState(initialFolderId);
  const [saving, setSaving] = useState(false);

  const dirty = folderId.trim() !== saved;

  async function save() {
    setSaving(true);
    const res = await api<{ folderId: string }>("/api/settings/topic-guide", {
      method: "PATCH",
      body: { folderId },
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setFolderId(res.data.folderId);
    setSaved(res.data.folderId);
    toast.success(
      res.data.folderId ? "Topic guide folder saved." : "Topic guide folder cleared.",
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900">Topic guide Docs</h2>
      <p className="text-sm text-gray-500 mt-0.5">
        Drive folder for Docs created by <strong>Create guide doc</strong> in the Topic Bank.
        Leave blank to use the minutes shared drive.
      </p>

      {!docsEnabled && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>APPS_SCRIPT_URL isn&apos;t set</strong>, so Docs can&apos;t be generated. Topics
          can still link to Docs you paste in by hand.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          placeholder="Folder ID, or paste the Drive folder URL"
          className="input flex-1 min-w-[14rem] font-mono text-xs"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
