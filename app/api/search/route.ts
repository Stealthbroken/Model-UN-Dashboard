import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDenied, requireUser } from "@/lib/auth";

/**
 * Global search behind the ⌘K palette. The dataset is a school club's worth of
 * rows, so we fetch each collection once and rank in memory — far cheaper than
 * a query per term, and it lets us do substring matching that Appwrite's
 * indexes don't offer.
 */

export interface SearchHit {
  kind: "meeting" | "topic" | "task" | "executive";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
}

const PER_KIND = 5;

export async function GET(request: NextRequest) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const [meetings, topics, tasks, execs] = await Promise.all([
    prisma.meeting.findMany({ orderBy: { date: "desc" } }),
    prisma.topic.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        meeting: { select: { id: true, title: true } },
        executive: { select: { name: true } },
      },
    }),
    prisma.executive.findMany({ orderBy: { name: "asc" } }),
  ]);

  const hits: SearchHit[] = [];

  for (const m of meetings) {
    const score = rank(q, m.title, m.agenda, m.location, m.notes);
    if (score > 0) {
      hits.push({
        kind: "meeting",
        id: m.id,
        title: m.title,
        subtitle: `${m.type === "exec" ? "Exec" : "Regular"} meeting · ${m.date.toLocaleDateString("en-GB")}`,
        href: `/meetings/${m.id}`,
        score,
      });
    }
  }

  for (const t of topics) {
    const score = rank(q, t.title, t.description, t.category, t.notes);
    if (score > 0) {
      hits.push({
        kind: "topic",
        id: t.id,
        title: t.title,
        subtitle: [t.category, t.difficulty, t.status].filter(Boolean).join(" · "),
        href: `/topics?focus=${t.id}`,
        score,
      });
    }
  }

  for (const t of tasks) {
    const score = rank(q, t.description, t.label);
    if (score > 0) {
      hits.push({
        kind: "task",
        id: t.id,
        title: t.description,
        subtitle: `${t.executive?.name ?? "Unassigned"}${t.completed ? " · done" : ""} · ${
          t.meeting?.title ?? "meeting"
        }`,
        href: `/meetings/${t.meetingId}`,
        score,
      });
    }
  }

  for (const e of execs) {
    const score = rank(q, e.name, e.role, e.email);
    if (score > 0) {
      hits.push({
        kind: "executive",
        id: e.id,
        title: e.name,
        subtitle: e.role || "Executive",
        href: `/stats?exec=${e.id}`,
        score,
      });
    }
  }

  // Keep the top few per kind so one busy collection can't crowd out the rest.
  const byKind = new Map<string, SearchHit[]>();
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    const list = byKind.get(hit.kind) ?? [];
    if (list.length < PER_KIND) {
      list.push(hit);
      byKind.set(hit.kind, list);
    }
  }

  const ordered: SearchHit[] = [];
  for (const kind of ["meeting", "topic", "task", "executive"] as const) {
    ordered.push(...(byKind.get(kind) ?? []));
  }

  return NextResponse.json({ hits: ordered });
}

/**
 * Cheap relevance: a prefix match on the primary field beats a word-boundary
 * match, which beats an anywhere-substring hit in a secondary field.
 */
function rank(q: string, primary: string | null, ...secondary: (string | null)[]): number {
  const head = (primary || "").toLowerCase();
  if (head === q) return 100;
  if (head.startsWith(q)) return 80;
  if (new RegExp(`\\b${escapeRe(q)}`).test(head)) return 60;
  if (head.includes(q)) return 40;

  for (const field of secondary) {
    const text = (field || "").toLowerCase();
    if (!text) continue;
    if (new RegExp(`\\b${escapeRe(q)}`).test(text)) return 25;
    if (text.includes(q)) return 15;
  }
  return 0;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
