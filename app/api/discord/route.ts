import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getDiscordWebhookUrl } from "@/lib/settings";

// Discord caps webhook message content at 2000 characters.
const DISCORD_LIMIT = 2000;

/**
 * Mirrors an announcement's text to the configured Discord channel webhook.
 * Body: { body: string, announcementId?: number }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const data = await request.json();
  const text = typeof data.body === "string" ? data.body.trim() : "";
  const announcementId = typeof data.announcementId === "string" && data.announcementId
    ? data.announcementId
    : null;

  if (!text) {
    return NextResponse.json(
      { error: "Nothing to mirror — the announcement is empty." },
      { status: 400 },
    );
  }

  const webhookUrl = await getDiscordWebhookUrl();
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "No Discord webhook is configured. Add one in the Sec-Gen panel." },
      { status: 400 },
    );
  }

  const content =
    text.length > DISCORD_LIMIT ? text.slice(0, DISCORD_LIMIT - 1) + "…" : text;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, username: "MUN Announcements" }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Discord returned ${res.status}: ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reach Discord" },
      { status: 502 },
    );
  }

  let discordSentAt: string | null = null;
  if (announcementId) {
    try {
      const updated = await prisma.classroomAnnouncement.update({
        where: { id: announcementId },
        data: { discordSentAt: new Date() },
      });
      discordSentAt = updated.discordSentAt?.toISOString() ?? null;
    } catch {
      // Mirroring an unsaved draft — there's no row to stamp. That's fine.
    }
  }

  return NextResponse.json({ ok: true, discordSentAt });
}
