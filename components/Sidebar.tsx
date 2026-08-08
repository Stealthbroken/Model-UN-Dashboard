"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive, BarChart3, BookOpen, CalendarDays, Camera, CheckSquare2, ExternalLink,
  Globe2, Home, Menu, Settings2, Users, X, type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { cn } from "@/components/ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  paletteIcon: string;
  external?: boolean;
  match?: string[];
  secgenOnly?: boolean;
}

const primaryNav: NavItem[] = [
  { href: "/", icon: Home, paletteIcon: "H", label: "Home" },
  { href: "/meetings", icon: CalendarDays, paletteIcon: "M", label: "Meetings", match: ["/meetings", "/calendar", "/archive"] },
  { href: "/my-tasks", icon: CheckSquare2, paletteIcon: "T", label: "My Tasks" },
  { href: "/topics", icon: BookOpen, paletteIcon: "B", label: "Topics" },
];

const toolsNav: NavItem[] = [
  { href: "/stats", icon: BarChart3, paletteIcon: "S", label: "Team Stats" },
  { href: "/instagram", icon: Camera, paletteIcon: "I", label: "Instagram" },
];

const adminNav: NavItem[] = [
  { href: "/executives", icon: Settings2, paletteIcon: "A", label: "Sec-Gen Settings", secgenOnly: true },
];

const shortcuts: NavItem[] = [
  { href: "https://classroom.google.com/u/0/c/NDI4NzY3NDUzNzNa", icon: Users, paletteIcon: "C", label: "Classroom", external: true },
  { href: "https://drive.google.com/drive/u/0/folders/1K5Q-qlF0RIVPJGQaIViOYQQTHYpJrR_x", icon: Archive, paletteIcon: "D", label: "Drive", external: true },
];

export interface ShellUser {
  name: string;
  roleLabel: string;
  canSecgen: boolean;
  viaTeamPassword: boolean;
}

export function Sidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleAdmin = adminNav.filter((item) => !item.secgenOnly || user.canSecgen);
  const paletteItems = [...primaryNav, ...toolsNav, ...visibleAdmin].map((item) => ({ href: item.href, label: item.label, icon: item.paletteIcon }));

  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [moreOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Brand compact />
        <Link href="/account" className="ml-auto rounded-full bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-900">{initials(user.name)}</Link>
      </header>

      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-gray-100 px-5 py-5"><Brand /></div>
        <div className="px-4 pt-4"><CommandPalette navItems={paletteItems} /></div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <NavSection items={primaryNav} pathname={pathname} />
          <NavGroup label="Tools"><NavSection items={toolsNav} pathname={pathname} /></NavGroup>
          {visibleAdmin.length > 0 && <NavGroup label="Administration"><NavSection items={visibleAdmin} pathname={pathname} /></NavGroup>}
          <NavGroup label="Shortcuts"><NavSection items={shortcuts} pathname={pathname} /></NavGroup>
        </nav>
        <AccountFooter user={user} pathname={pathname} />
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-gray-200 bg-white/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden" aria-label="Primary navigation">
        {primaryNav.map((item) => <MobileNavItem key={item.href} item={item} pathname={pathname} />)}
        <button type="button" onClick={() => setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-gray-500" aria-expanded={moreOpen}><Menu size={21} aria-hidden="true" />More</button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-ink/45 lg:hidden" onClick={() => setMoreOpen(false)}>
          <section className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-8 pt-3 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label="More navigation">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <div className="mb-4 flex items-center justify-between"><Brand compact /><button type="button" onClick={() => setMoreOpen(false)} className="btn btn-quiet !min-h-9 !px-2" aria-label="Close menu"><X size={20} /></button></div>
            <CommandPalette navItems={paletteItems} />
            <div className="mt-5 grid grid-cols-2 gap-2">{[...toolsNav, ...visibleAdmin, ...shortcuts].map((item) => <SheetLink key={item.href} item={item} pathname={pathname} />)}</div>
            <div className="mt-5 border-t border-gray-100 pt-4"><AccountFooter user={user} pathname={pathname} mobile /></div>
          </section>
        </div>
      )}
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="flex items-center gap-3 text-gray-900"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white shadow-sm"><Globe2 size={21} aria-hidden="true" /></span><span><span className={cn("block font-extrabold leading-none tracking-tight", compact ? "text-sm" : "text-base")}>IRHS Model UN</span>{!compact && <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.17em] text-primary-700">Executive workspace</span>}</span></Link>;
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-6"><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{label}</p>{children}</div>;
}

function NavSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return <div className="space-y-1">{items.map((item) => <DesktopNavItem key={item.href} item={item} pathname={pathname} />)}</div>;
}

function activeFor(item: NavItem, pathname: string) {
  if (item.external) return false;
  if (item.match) return item.match.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
}

function DesktopNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = activeFor(item, pathname);
  return <Link href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-primary-100 text-primary-900" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")}><Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" /><span className="flex-1">{item.label}</span>{item.external && <ExternalLink size={13} className="text-gray-400" />}</Link>;
}

function MobileNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = activeFor(item, pathname);
  return <Link href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold", active ? "text-primary-800" : "text-gray-500")}><Icon size={21} strokeWidth={active ? 2.6 : 2} aria-hidden="true" />{item.label.replace("My ", "")}</Link>;
}

function SheetLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  return <Link href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} className={cn("flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-sm font-semibold", activeFor(item, pathname) ? "border-primary-200 bg-primary-50 text-primary-900" : "border-gray-200 text-gray-700")}><Icon size={19} />{item.label}</Link>;
}

function AccountFooter({ user, pathname, mobile = false }: { user: ShellUser; pathname: string; mobile?: boolean }) {
  return <div className={cn(!mobile && "border-t border-gray-100 p-3")}><Link href="/account" className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", pathname === "/account" ? "bg-primary-50" : "hover:bg-gray-100")}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-xs font-extrabold text-primary-900">{initials(user.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{user.name}</span><span className="block truncate text-[11px] text-gray-500">{user.viaTeamPassword ? "Shared team access" : user.roleLabel}</span></span></Link><ThemeToggle /><form action="/api/auth/logout" method="POST"><button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600">Log out</button></form></div>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
