"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";

export function DigestPanel() {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function send() {
    if (
      !confirm(
        "Email every active executive (with an email set) their open tasks and the next meeting?",
      )
    )
      return;
    setSending(true);
    setMessage(null);
    setIsError(false);
    const res = await api<{ sent: number; failed?: number; message?: string }>("/api/digest", {
      method: "POST",
    });
    setSending(false);

    if (!res.ok) {
      setIsError(true);
      setMessage(res.error);
      toast.error(res.error);
      return;
    }
    if (res.data.sent === 0) {
      const note = res.data.message || "No digests were sent.";
      setMessage(note);
      toast.info(note);
      return;
    }
    const failNote = res.data.failed ? ` (${res.data.failed} failed)` : "";
    const summary = `Digest sent to ${res.data.sent} executive${
      res.data.sent === 1 ? "" : "s"
    }.${failNote}`;
    setMessage(summary);
    setIsError(!!res.data.failed);
    // Partial failures are still worth an error toast — some execs got nothing.
    if (res.data.failed) toast.error(summary);
    else toast.success(summary);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="font-semibold text-gray-900">Weekly Digest</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Emails each executive their open tasks plus the next meeting. Sent
            manually — only when you click below.
          </p>
        </div>
        <button
          onClick={send}
          disabled={sending}
          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 shrink-0"
        >
          {sending ? "Sending…" : "Send digest now"}
        </button>
      </div>
      {message && (
        <p className={`text-xs mt-1 ${isError ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
