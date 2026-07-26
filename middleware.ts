import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";

/** Reachable without signing in. Invite links set a first password. */
const PUBLIC_PREFIXES = ["/login", "/invite"];

function hasPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Builds a redirect target on the host the *browser* used.
 *
 * `NextResponse.redirect` needs an absolute URL, and deriving one from
 * `request.url` uses the origin the Node process is bound to — behind a proxy
 * that's http://localhost:3000, which is how logout and these redirects ended
 * up pointing at localhost in production. Prefer the forwarded headers the
 * proxy sets, and fall back to nextUrl for local development.
 */
function externalUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    // Assign hostname and port separately: the `host` setter leaves the
    // existing port in place when the value doesn't carry one, which would
    // keep :3000 glued onto the public hostname.
    const [hostname, port] = forwardedHost.split(":");
    url.hostname = hostname;
    url.port = port ?? "";
    url.protocol = `${request.headers.get("x-forwarded-proto") || "https"}:`;
  }
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const isPublic = hasPrefix(pathname, PUBLIC_PREFIXES);

  if (!session.isLoggedIn) {
    if (isPublic) return response;
    const url = externalUrl(request, "/login");
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") {
    return NextResponse.redirect(externalUrl(request, "/"));
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
