"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SecgenLockButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function lock() {
    setBusy(true);
    await fetch("/api/auth/secgen", { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={lock}
      disabled={busy}
      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-50"
    >
      🔒 Lock panel
    </button>
  );
}
