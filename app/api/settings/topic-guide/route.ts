import { NextRequest, NextResponse } from "next/server";

import { isDenied, requireSecgen } from "@/lib/auth";
import { getTopicGuideFolderId, setTopicGuideFolderId } from "@/lib/settings";

export async function GET() {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  return NextResponse.json({ folderId: await getTopicGuideFolderId() });
}

/** PATCH { folderId } — Drive folder that generated topic-guide Docs land in. */
export async function PATCH(request: NextRequest) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));
  if (typeof data.folderId !== "string") {
    return NextResponse.json({ error: "folderId must be a string." }, { status: 400 });
  }

  // Accept a pasted Drive URL as well as a bare id — people copy the address bar.
  const raw = data.folderId.trim();
  const fromUrl = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const folderId = fromUrl ? fromUrl[1] : raw;

  if (folderId && !/^[a-zA-Z0-9_-]{10,}$/.test(folderId)) {
    return NextResponse.json(
      { error: "That doesn't look like a Drive folder ID or URL." },
      { status: 400 },
    );
  }

  return NextResponse.json({ folderId: await setTopicGuideFolderId(folderId) });
}
