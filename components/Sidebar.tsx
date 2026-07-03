"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
}

// Primary day-to-day pages. Meetings/Calendar/Past are one entry now — the
// in-page tab bar switches between the three views.
const mainNav: NavItem[] = [
  { href: "/", icon: "🏠", label: "Dashboard" },
  { href: "/meetings", icon: "📅", label: "Meetings" },
  { href: "/my-tasks", icon: "✅", label: "My Tasks" },
  { href: "/topics", icon: "💡", label: "Topic Bank" },
];

// Admin / less-frequent tools.
const manageNav: NavItem[] = [
  { href: "/stats", icon: "📊", label: "Exec Stats" },
  { href: "/executives", icon: "👥", label: "Sec-Gen Panel" },
  { href: "/instagram", icon: "📷", label: "Instagram" },
];

const shortcuts: NavItem[] = [
  { href: "https://app.slack.com/client/T09DZJJ5UE5", icon: "💬", label: "Slack", external: true },
  { href: "https://classroom.google.com/u/0/c/NDI4NzY3NDUzNzNa", icon: "📚", label: "Classroom", external: true },
  { href: "https://drive.google.com/drive/u/0/folders/1K5Q-qlF0RIVPJGQaIViOYQQTHYpJrR_x", icon: "🗄️", label: "Drive", external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever navigation happens.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname === "/login") return null;

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-3 bg-white border-b border-gray-200 px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-bold text-gray-900">MUN Dashboard</span>
      </header>

      {/* Mobile drawer backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: static on desktop, slide-over drawer on mobile */}
      <aside
        className={`w-64 bg-white border-r border-gray-200 p-6 flex flex-col
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 overflow-y-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:min-h-screen lg:z-auto`}
      >
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">MUN Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Executive Team</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-6">
          <NavSection items={mainNav} pathname={pathname} />

          <NavGroup label="Manage">
            <NavSection items={manageNav} pathname={pathname} />
          </NavGroup>

          <NavGroup label="Shortcuts">
            <NavSection items={shortcuts} pathname={pathname} />
          </NavGroup>
        </nav>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Thursdays · 11:10 AM · Room 137</p>
          <ThemeToggle />
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

// The Meetings entry stays highlighted across its sibling views.
const MEETINGS_CLUSTER = ["/meetings", "/calendar", "/archive"];

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive =
          !item.external &&
          (item.href === "/meetings"
            ? MEETINGS_CLUSTER.some((p) => pathname === p || pathname.startsWith(`${p}/`))
            : pathname === item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.external && <span className="text-[10px] text-gray-400">↗</span>}
          </Link>
        );
      })}
    </div>
  );
}
