import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLogin } from "@/lib/auth";
import { TOPIC_CATEGORIES, TOPIC_DIFFICULTIES } from "@/lib/topic-seeds";

const STATUSES = ["idea", "shortlisted", "used", "archived"] as const;

function normalizeStatus(s: unknown): string {
  return typeof s === "string" && (STATUSES as readonly string[]).includes(s) ? s : "idea";
}

function normalizeDifficulty(d: unknown): string {
  return typeof d === "string" && (TOPIC_DIFFICULTIES as readonly string[]).includes(d) ? d : "standard";
}

function normalizeCategory(c: unknown): string {
  if (typeof c !== "string") return "";
  return (TOPIC_CATEGORIES as readonly string[]).includes(c) ? c : c.trim().slice(0, 60);
}

export async function GET() {
  const denied = await requireLogin();
  if (denied) return denied;
  const topics = await prisma.topic.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(topics);
}

export async function POST(request: NextRequest) {
  const denied = await requireLogin();
  if (denied) return denied;
  const data = await request.json();
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const topic = await prisma.topic.create({
    data: {
      title: title.slice(0, 280),
      description: typeof data.description === "string" ? data.description.trim().slice(0, 1_900) : "",
      category: normalizeCategory(data.category),
      difficulty: normalizeDifficulty(data.difficulty),
      status: normalizeStatus(data.status ?? "idea"),
      notes: typeof data.notes === "string" ? data.notes.slice(0, 3_900) : "",
      source: data.source === "ai" || data.source === "curated" ? data.source : "manual",
    },
  });
  return NextResponse.json(topic, { status: 201 });
}
