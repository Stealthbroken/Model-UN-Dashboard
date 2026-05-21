"use client";

import { useState } from "react";

interface Settings {
  useSharedDrive: boolean;
  sharedDriveId: string;
}

export function MinutesDocSettings({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    setMessage(null);
    const next = { ...settings, ...patch };
    setSettings(next);
    const res = await fetch("/api/settings/minutes-doc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setMessage("Failed to save. Check sec-gen access.");
    } else {
      const data = await res.json();
      setSettings(data);
      setMessage("Saved.");
      setTimeout(() => setMessage(null), 1500);
    }
    setSaving(false);
  }

  const needsDriveId = settings.useSharedDrive && !settings.sharedDriveId.trim();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Meeting Minutes Doc</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Where Apps Script puts the auto-generated minutes Google Doc for each meeting.
          </p>
        </div>
        {message && (
          <span className="text-xs text-green-600">{message}</span>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.useSharedDrive}
            onChange={(e) => save({ useSharedDrive: e.target.checked })}
            disabled={saving}
            className="mt-0.5"
          />
          <div className="text-sm">
            <p className="font-medium text-gray-900">Use a Shared Drive</p>
            <p className="text-gray-500 text-xs">
              Off → docs are created in the script owner's My Drive. On → docs go in the
              shared drive you specify below.
            </p>
          </div>
        </label>

        {settings.useSharedDrive && (
          <div className="pl-6">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Shared Drive ID
            </label>
            <SharedDriveIdInput
              value={settings.sharedDriveId}
              onSave={(sharedDriveId) => save({ sharedDriveId })}
              disabled={saving}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Find this in the shared drive URL:{" "}
              <span className="font-mono">drive.google.com/drive/folders/THIS_PART</span>
            </p>
            {needsDriveId && (
              <p className="text-xs text-amber-700 mt-1">
                Add the ID or turn off the toggle — without it, docs will still fall back to
                My Drive.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SharedDriveIdInput({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft.trim() !== value.trim();

  return (
    <div className="flex gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. 0AHk9aLvBcdEFGHIJK"
        className="input flex-1 font-mono text-sm"
        disabled={disabled}
      />
      <button
        onClick={() => onSave(draft)}
        disabled={disabled || !dirty}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
