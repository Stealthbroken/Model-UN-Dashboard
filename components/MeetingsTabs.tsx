"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/meetings", label: "List" },
  { href: "/calendar", label: "Calendar" },
  { href: "/archive", label: "Past" },
];

/**
 * Sub-navigation shared by the three meeting views. Lets the sidebar carry a
 * single "Meetings" entry instead of three.
 */
export function MeetingsTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 inline-flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
