import { NextRequest, NextResponse } from "next/server";
import { requireSecgen, isDenied } from "@/lib/auth";
import { getDiscordWebhookUrl, setDiscordWebhookUrl } from "@/lib/settings";

export async function GET() {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  const url = await getDiscordWebhookUrl();
  return NextResponse.json({ webhookUrl: url });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

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
