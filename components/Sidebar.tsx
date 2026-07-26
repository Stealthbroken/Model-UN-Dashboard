"use client";

/**
 * App shell: sidebar navigation, command palette, and the signed-in identity.
 * Collapses to a slide-over on small screens so the dashboard is usable from a
 * phone during meetings.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
  /** Hidden from accounts without Sec-Gen access. */
  secgenOnly?: boolean;
}

const dashboardNav: NavItem[] = [
  { href: "/", icon: "🏠", label: "Dashboard" },
  { href: "/meetings", icon: "📅", label: "Meetings" },
  { href: "/my-tasks", icon: "✅", label: "My Tasks" },
  { href: "/topics", icon: "💡", label: "Topic Bank" },
  //{ href: "/stats", icon: "📊", label: "Exec Stats" },
  //{ href: "/instagram", icon: "📷", label: "Instagram" },
  { href: "/executives", icon: "🔑", label: "Sec-Gen Panel", secgenOnly: true },
];

const shortcuts: NavItem[] = [
  //{ href: "https://app.slack.com/client/T09DZJJ5UE5", icon: "💬", label: "Slack", external: true },
  { href: "https://classroom.google.com/u/0/c/NDI4NzY3NDUzNzNa", icon: "🏫", label: "Classroom", external: true },
  { href: "https://drive.google.com/drive/u/0/folders/1K5Q-qlF0RIVPJGQaIViOYQQTHYpJrR_x", icon: "🗄️", label: "Drive", external: true },
];

export interface ShellUser {
  name: string;
  roleLabel: string;
  canSecgen: boolean;
  viaTeamPassword: boolean;
}

export function Sidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the slide-over on navigation — otherwise it covers the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock background scroll while the slide-over is up.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const visibleNav = dashboardNav.filter((item) => !item.secgenOnly || user.canSecgen);

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-bold text-gray-900">MUN Dashboard</span>
        <span className="ml-auto text-xs text-gray-400 truncate max-w-[8rem]">{user.name}</span>
      </header>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-gray-900/40"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarBody
              pathname={pathname}
              nav={visibleNav}
              user={user}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-gray-200 min-h-screen flex-col">
        <SidebarBody pathname={pathname} nav={visibleNav} user={user} />
      </aside>
    </>
  );
}

function SidebarBody({
  pathname,
  nav,
  user,
  onClose,
}: {
  pathname: string;
  nav: NavItem[];
  user: ShellUser;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col min-h-full p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">MUN Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Executive Team</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 -mr-1 -mt-1 text-xl leading-none text-gray-400 hover:text-gray-700"
            aria-label="Close menu"
          >
            ×
          </button>
        )}
      </div>

      <div className="mb-4">
        <CommandPalette navItems={nav.filter((n) => !n.external)} />
      </div>

      <nav className="flex-1 space-y-5">
        <NavSection items={nav} pathname={pathname} />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5">
            Shortcuts
          </p>
          <NavSection items={shortcuts} pathname={pathname} />
        </div>
      </nav>

      <div className="pt-4 mt-4 border-t border-gray-100 space-y-2">
        <Link
          href="/account"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
            pathname === "/account" ? "bg-primary-50" : "hover:bg-gray-100"
          }`}
        >
          <span className="w-7 h-7 shrink-0 rounded-full bg-primary-100 text-primary-800 text-xs font-bold flex items-center justify-center">
            {initials(user.name)}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-gray-900 truncate">{user.name}</span>
            <span className="block text-[11px] text-gray-500 truncate">
              {user.viaTeamPassword ? "Team password" : user.roleLabel}
            </span>
          </span>
        </Link>

        <p className="text-[11px] text-gray-400 px-3">Thursdays · 11:10 AM · Room 137</p>
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
    </div>
  );
}

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const isActive = !item.external && pathname === item.href;
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
