import { NextRequest, NextResponse } from "next/server";
import { requireSecgen, isDenied } from "@/lib/auth";
import { getMinutesDocSettings, setMinutesDocSettings } from "@/lib/settings";

export async function GET() {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  return NextResponse.json(await getMinutesDocSettings());
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  const data = await request.json();
  const updated = await setMinutesDocSettings({
    useSharedDrive:
      typeof data.useSharedDrive === "boolean" ? data.useSharedDrive : undefined,
    sharedDriveId:
      typeof data.sharedDriveId === "string" ? data.sharedDriveId : undefined,
  });
  return NextResponse.json(updated);
}
