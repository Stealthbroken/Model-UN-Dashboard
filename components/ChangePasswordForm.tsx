"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";

export function ChangePasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && next.length >= 8 && confirm === next && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);

    const res = await api("/api/auth/password", {
      method: "POST",
      body: { currentPassword: current, newPassword: next },
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password updated.");
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-3">Change password</h2>
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm text-gray-700">Current password</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input mt-1"
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">New password</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="input mt-1"
            autoComplete="new-password"
            required
          />
          <span className="mt-1 block text-xs text-gray-400">At least 8 characters.</span>
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input mt-1"
            autoComplete="new-password"
            required
          />
          {mismatch && (
            <span className="mt-1 block text-xs text-red-600">Passwords don&apos;t match.</span>
          )}
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
