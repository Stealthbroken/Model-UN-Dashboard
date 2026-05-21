"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SecgenLock({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/secgen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to unlock");
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">Sec-Gen Panel</h1>
          <p className="text-sm text-gray-500 mt-1">
            Roster management and meeting-minutes settings are restricted to
            Secretaries-General.
          </p>
        </div>

        {configured ? (
          <form onSubmit={unlock} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sec-Gen password"
              className="input w-full"
              autoFocus
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? "Unlocking..." : "Unlock"}
            </button>
          </form>
        ) : (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="font-semibold">Not configured</p>
            <p className="mt-1">
              Set <code className="font-mono bg-white px-1 py-0.5 rounded">SECGEN_PASSWORD</code>{" "}
              in <code className="font-mono bg-white px-1 py-0.5 rounded">.env.local</code> and
              restart the server to enable this panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
