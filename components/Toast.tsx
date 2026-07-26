"use client";

/**
 * App-wide toasts. Mounted once in the root layout; anything can raise one via
 * `useToast()`. Exists mainly so failed writes stop failing silently — the old
 * components discarded non-ok responses without telling anyone.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Optional copy-to-clipboard payload — used for invite links. */
  copy?: string;
}

interface ToastApi {
  success: (message: string, opts?: { copy?: string }) => void;
  error: (message: string) => void;
  info: (message: string, opts?: { copy?: string }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 5000;
const ERROR_DISMISS_MS = 9000; // errors linger — they're usually actionable

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, copy?: string) => {
      const id = nextId.current++;
      setToasts((cur) => [...cur.slice(-3), { id, tone, message, copy }]);
      const timer = setTimeout(
        () => dismiss(id),
        tone === "error" ? ERROR_DISMISS_MS : AUTO_DISMISS_MS,
      );
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push("success", m, o?.copy),
      error: (m) => push("error", m),
      info: (m, o) => push("info", m, o?.copy),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))]"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONES: Record<ToastTone, { wrap: string; icon: string }> = {
  success: { wrap: "bg-green-50 border-green-200 text-green-900", icon: "✓" },
  error: { wrap: "bg-red-50 border-red-200 text-red-900", icon: "!" },
  info: { wrap: "bg-primary-50 border-primary-200 text-primary-900", icon: "i" },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const tone = TONES[toast.tone];

  async function copy() {
    if (!toast.copy) return;
    try {
      await navigator.clipboard.writeText(toast.copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border shadow-lg px-3.5 py-3 text-sm animate-toast-in ${tone.wrap}`}
    >
      <span className="mt-px w-5 h-5 shrink-0 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold">
        {tone.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="leading-snug break-words">{toast.message}</p>
        {toast.copy && (
          <button
            onClick={copy}
            className="mt-1.5 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-lg leading-none opacity-50 hover:opacity-100"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
