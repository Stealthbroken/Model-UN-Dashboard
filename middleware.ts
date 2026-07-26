import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";

/** Reachable without signing in. Invite links set a first password. */
const PUBLIC_PREFIXES = ["/login", "/invite"];

function hasPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const isPublic = hasPrefix(pathname, PUBLIC_PREFIXES);

  if (!session.isLoggedIn) {
    if (isPublic) return response;
    const url = new URL("/login", request.url);
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role checks deliberately live in the pages, not here. Middleware can only
  // see the session cookie, and that role goes stale the moment a Sec-Gen
  // changes someone's access — a freshly promoted account would be bounced
  // from /executives until it signed in again. The pages re-read the roster
  // (lib/auth.ts → getCurrentUser) so both directions apply immediately.
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
