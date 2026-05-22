import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDiscordWebhookUrl, setDiscordWebhookUrl } from "@/lib/settings";

async function requireSecgen() {
  const session = await getSession();
  if (!session.isSecgen) {
    return NextResponse.json({ error: "Sec-Gen access required" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireSecgen();
  if (denied) return denied;
  const url = await getDiscordWebhookUrl();
  return NextResponse.json({ webhookUrl: url });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireSecgen();
  if (denied) return denied;

  const data = await request.json();
  const raw = typeof data.webhookUrl === "string" ? data.webhookUrl.trim() : "";

  if (raw && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(raw)) {
    return NextResponse.json(
      { error: "That doesn't look like a Discord webhook URL." },
      { status: 400 },
    );
  }

  const saved = await setDiscordWebhookUrl(raw);
  return NextResponse.json({ webhookUrl: saved });
}
