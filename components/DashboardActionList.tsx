"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, CheckSquare2 } from "lucide-react";
import type { DashboardAction } from "@/lib/dashboard";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import { cn } from "@/components/ui";

export function DashboardActionList({ initial }: { initial: DashboardAction[] }) {
  const [actions, setActions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function complete(action: DashboardAction) {
    const snapshot = actions;
    setBusy(action.id);
    setActions((current) => current.filter((item) => item.id !== action.id));
    const result = await api(`/api/tasks/${action.id}`, { method: "PATCH", body: { completed: true } });
    setBusy(null);
    if (!result.ok) {
      setActions(snapshot);
      toast.error(result.error);
      return;
    }
    toast.success("Task completed.");
    router.refresh();
  }

  if (!actions.length) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-700"><Check size={22} /></span>
        <p className="mt-3 font-semibold text-gray-900">You’re all caught up</p>
        <p className="mt-1 text-sm text-gray-500">No overdue or upcoming work needs attention.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {actions.map((action) => {
        const overdue = action.urgency === "overdue";
        return (
          <li key={`${action.kind}-${action.id}`} className="group flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
            {action.completable ? (
              <button type="button" onClick={() => complete(action)} disabled={busy === action.id} className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-gray-300 text-transparent transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-100" aria-label={`Complete ${action.title}`}>
                <Check size={15} strokeWidth={3} />
              </button>
            ) : (
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", overdue ? "bg-red-100 text-red-700" : "bg-primary-100 text-primary-700")}><AlertCircle size={16} /></span>
            )}
            <Link href={action.href} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-100">
              <span className="block text-sm font-semibold text-gray-900 group-hover:text-primary-800">{action.title}</span>
              <span className={cn("mt-0.5 block text-xs", overdue ? "font-medium text-red-600" : "text-gray-500")}>{action.detail}{action.owner && action.owner !== "You" ? ` · ${action.owner}` : ""}</span>
            </Link>
            <ArrowRight size={16} className="mt-1.5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
          </li>
        );
      })}
    </ul>
  );
}
