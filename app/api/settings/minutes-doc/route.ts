import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMinutesDocSettings, setMinutesDocSettings } from "@/lib/settings";

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
  return NextResponse.json(await getMinutesDocSettings());
}

export async function PATCH(request: NextRequest) {
  const denied = await requireSecgen();
  if (denied) return denied;

  const data = await request.json();
  const updated = await setMinutesDocSettings({
    useSharedDrive:
      typeof data.useSharedDrive === "boolean" ? data.useSharedDrive : undefined,
    sharedDriveId:
      typeof data.sharedDriveId === "string" ? data.sharedDriveId : undefined,
  });
  return NextResponse.json(updated);
}
