"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
}

const dashboardNav: NavItem[] = [
  { href: "/", icon: "🏠", label: "Dashboard" },
  { href: "/meetings", icon: "📅", label: "Meetings" },
  { href: "/calendar", icon: "🗓️", label: "Calendar" },
  { href: "/archive", icon: "🗂️", label: "Past Meetings" },
  { href: "/my-tasks", icon: "✅", label: "My Tasks" },
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

  if (pathname === "/login") return null;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">MUN Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Executive Team</p>
      </div>

      <nav className="flex-1 space-y-6">
        <NavSection items={dashboardNav} pathname={pathname} />

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5">
            Shortcuts
          </p>
          <NavSection items={shortcuts} pathname={pathname} />
        </div>
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
  );
}

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="space-y-1">
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
