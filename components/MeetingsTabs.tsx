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
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm mb-5">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1 rounded-md transition-colors ${
              active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
