"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

type Mode = "account" | "team";

export function LoginForm({
  teamPasswordAllowed,
  unclaimed,
  next,
}: {
  teamPasswordAllowed: boolean;
  /** No Sec-Gen account exists yet — the team password still bootstraps setup. */
  unclaimed: boolean;
  next: string;
}) {
  const router = useRouter();
  // Default to the team password only while it's the only thing that works.
  const [mode, setMode] = useState<Mode>(
    teamPasswordAllowed && unclaimed ? "team" : "account",
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await api("/api/auth/login", {
      method: "POST",
      body: mode === "account" ? { identifier, password } : { password },
    });

    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      {unclaimed && teamPasswordAllowed && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <p className="font-semibold">First-time setup</p>
          <p className="mt-0.5">
            No Sec-Gen accounts exist yet. Sign in with the team password, then create
            accounts from the Sec-Gen Panel.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === "account" && (
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
              Username or email
            </label>
            <input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input"
              placeholder="firstname.lastname"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {mode === "account" ? "Password" : "Team password"}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder={mode === "account" ? "Your password" : "Shared team password"}
            autoComplete={mode === "account" ? "current-password" : "off"}
            autoFocus={mode === "team"}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {teamPasswordAllowed && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <button
            onClick={() => {
              setMode(mode === "account" ? "team" : "account");
              setError("");
              setPassword("");
            }}
            className="text-xs text-gray-500 hover:text-primary-600"
          >
            {mode === "account"
              ? "Use the shared team password instead"
              : "Sign in with your own account instead"}
          </button>
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-400 text-center leading-relaxed">
        No account yet? A Secretary-General can create one for you and email a setup link.
      </p>
    </div>
  );
}
