"use client";

/**
 * "Subscribe" affordance for the calendar page.
 *
 * Subscribing (vs. downloading the .ics) is what makes new and edited meetings
 * show up automatically in someone's own calendar. The subscribe URL carries
 * the CALENDAR_FEED_TOKEN so calendar apps — which can't send our login cookie
 * — can still read the feed. The page only renders this for signed-in users,
 * so surfacing the token here matches how it's meant to be shared.
 */
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

export function CalendarSubscribe({
  feedUrl,
  hasToken,
}: {
  /** Full https feed URL, token included when configured. */
  feedUrl: string;
  /** CALENDAR_FEED_TOKEN is set, so the URL works without a login. */
  hasToken: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // webcal:// opens the OS default calendar app straight into "subscribe".
  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success("Subscribe URL copied.");
    } catch {
      toast.info("Couldn't copy automatically — select the URL and copy it.");
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Subscribe so new and updated meetings sync into your calendar automatically"
      >
        📆 Subscribe
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-gray-900">Subscribe to meetings</p>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
            A subscription updates itself — new and edited meetings appear in your calendar
            automatically. Downloading the file only imports a one-time snapshot.
          </p>

          {hasToken ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input flex-1 font-mono text-[11px]"
                />
                <button
                  onClick={copy}
                  className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                >
                  Copy
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Add to Google Calendar
                </a>
                <a
                  href={webcalUrl}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Apple Calendar
                </a>
              </div>

              <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
                In Google Calendar you can also pick <em>Other calendars → From URL</em> and paste
                the link above. Google refreshes external calendars every several hours.
              </p>
            </>
          ) : (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Set <code className="font-mono">CALENDAR_FEED_TOKEN</code> in the environment to enable
              subscribing. Without it, calendar apps can&apos;t read the feed.
            </p>
          )}

          <div className="mt-3 border-t border-gray-100 pt-2">
            <a
              href={feedUrl}
              className="text-xs text-gray-500 hover:text-primary-700"
              download="mun-meetings.ics"
            >
              Or download a one-time .ics file
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
