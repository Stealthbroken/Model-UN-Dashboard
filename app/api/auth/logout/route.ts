import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  // A *relative* Location on purpose. `NextResponse.redirect` needs an absolute
  // URL, and building one from `request.url` sends the browser to the origin the
  // Node server sees — which behind a proxy (Render) is http://localhost:3000.
  // Browsers resolve a relative Location against the address bar, so this lands
  // on the right host with no forwarded-header guesswork. 303 turns the form
  // POST into a GET.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });

  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.destroy();

  return response;
}
