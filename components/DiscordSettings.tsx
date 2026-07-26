"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";

export function DiscordSettings({ initialUrl }: { initialUrl: string }) {
  const toast = useToast();
  const [draft, setDraft] = useState(initialUrl);
  const [saved, setSaved] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const dirty = draft.trim() !== saved.trim();

  async function save() {
    setSaving(true);
    setMessage(null);
    setIsError(false);
    const res = await api<{ webhookUrl: string }>("/api/settings/discord", {
      method: "PATCH",
      body: { webhookUrl: draft },
    });
    setSaving(false);

    if (!res.ok) {
      setIsError(true);
      setMessage(res.error);
      toast.error(res.error);
      return;
    }
    setSaved(res.data.webhookUrl);
    setDraft(res.data.webhookUrl);
    const done = res.data.webhookUrl ? "Webhook saved." : "Webhook cleared.";
    setMessage(done);
    toast.success(done);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-semibold text-gray-900">Discord Webhook</h2>
        {message && (
          <span className={`text-xs ${isError ? "text-red-600" : "text-green-600"}`}>
            {message}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Lets each meeting&apos;s announcement be mirrored to a Discord channel. In
        Discord: <span className="font-medium">Channel → Edit → Integrations →
        Webhooks → New Webhook → Copy URL</span>.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="input flex-1 text-sm font-mono"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {saved && (
        <p className="text-[11px] text-gray-400 mt-1.5">
          A webhook is configured. Leave the field blank and Save to remove it.
        </p>
      )}
    </div>
  );
}
