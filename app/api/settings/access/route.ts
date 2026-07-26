import { NextRequest, NextResponse } from "next/server";

import { isDenied, requireSecgen } from "@/lib/auth";
import { activeSecgenAccounts } from "@/lib/accounts";
import { getAllowTeamPassword, setAllowTeamPassword } from "@/lib/settings";

export async function GET() {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;
  return NextResponse.json({ allowTeamPassword: await getAllowTeamPassword() });
}

/** PATCH { allowTeamPassword } — turn the shared team password on or off. */
export async function PATCH(request: NextRequest) {
  const gate = await requireSecgen();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));
  if (typeof data.allowTeamPassword !== "boolean") {
    return NextResponse.json({ error: "allowTeamPassword must be true or false." }, { status: 400 });
  }

  // Turning it off while signed in *via* the team password would lock the
  // person out mid-change, and it's pointless with no accounts to fall back on.
  if (!data.allowTeamPassword) {
    if (gate.user.viaTeamPassword) {
      return NextResponse.json(
        {
          error:
            "You're signed in with the team password. Create your own Sec-Gen account " +
            "and sign in with it before switching this off.",
        },
        { status: 409 },
      );
    }
    const holders = await activeSecgenAccounts();
    if (holders.length === 0) {
      return NextResponse.json(
        { error: "Set up at least one Sec-Gen account first." },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ allowTeamPassword: await setAllowTeamPassword(data.allowTeamPassword) });
}
