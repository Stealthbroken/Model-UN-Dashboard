"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayLocalDateTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function plusMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function MeetingCreator() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shrink-0"
      >
        + New Meeting
      </button>
      {open && <Modal onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"single" | "recurring">("single");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Single
  const [singleDate, setSingleDate] = useState(todayLocalDateTime());
  const [singleTitle, setSingleTitle] = useState("MUN Meeting");
  const [singleLocation, setSingleLocation] = useState("Room 137");

  // Recurring
  const [startDate, setStartDate] = useState(todayLocalDate());
  const [endDate, setEndDate] = useState(plusMonths(3));
  const [dayOfWeek, setDayOfWeek] = useState(4); // Thu
  const [hour, setHour] = useState(11);
  const [minute, setMinute] = useState(10);
  const [recTitle, setRecTitle] = useState("Weekly MUN Meeting");
  const [recLocation, setRecLocation] = useState("Room 137");

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    const payload =
      tab === "single"
        ? {
            mode: "single",
            date: singleDate,
            title: singleTitle,
            location: singleLocation,
          }
        : {
            mode: "recurring",
            startDate,
            endDate,
            dayOfWeek,
            hour,
            minute,
            title: recTitle,
            location: recLocation,
          };

    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${data.error || "failed"}`);
      setSubmitting(false);
      return;
    }
    if (tab === "recurring") {
      setMessage(
        `Created ${data.created} meeting${data.created === 1 ? "" : "s"}` +
          (data.skipped ? `, skipped ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"}` : ""),
      );
    } else {
      setMessage("Meeting created.");
    }
    setSubmitting(false);
    router.refresh();
    setTimeout(onClose, 600);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">New meeting</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm">
            <TabBtn active={tab === "single"} onClick={() => setTab("single")}>
              Single
            </TabBtn>
            <TabBtn active={tab === "recurring"} onClick={() => setTab("recurring")}>
              Recurring weekly
            </TabBtn>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {tab === "single" ? (
            <>
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Title">
                <input
                  type="text"
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={singleLocation}
                  onChange={(e) => setSingleLocation(e.target.value)}
                  className="input"
                />
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Day of week">
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDayOfWeek(i)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        dayOfWeek === i
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hour (24h)">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={hour}
                    onChange={(e) => setHour(parseInt(e.target.value || "0"))}
                    className="input"
                  />
                </Field>
                <Field label="Minute">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value || "0"))}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Title">
                <input
                  type="text"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={recLocation}
                  onChange={(e) => setRecLocation(e.target.value)}
                  className="input"
                />
              </Field>
              <p className="text-xs text-gray-500">
                Existing meetings on conflicting dates are skipped, not overwritten.
              </p>
            </>
          )}

          {message && (
            <p className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : tab === "single" ? "Create meeting" : "Create series"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md transition-colors ${
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
