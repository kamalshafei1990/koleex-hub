import { NextResponse, type NextRequest } from "next/server";

/* ---------------------------------------------------------------------------
   View-as read-only enforcement — the ONE proxy (né middleware) in the Hub.

   View-as (SA previews the system as another user/role) is a READ-ONLY mode.
   The API-layer guards enforce that in two places — requireAuth(req) and
   requireModuleAction — but both are opt-in per route, and an audit found
   94 mutating route files that call bare requireAuth() with no module-action
   gate: through those, a SA in view-as could write data attributed to the
   TARGET account (AI conversations, preferences, approvals, invitations…).

   This closes the whole class in one place: any non-read /api request that
   arrives with a view-as cookie is refused before it reaches a handler.
   Presence of the cookie is enough — if it is forged/stale the deeper HMAC
   check ignores it for auth anyway, and blocking writes for a cookie the
   client should not have is the safe direction. The only exceptions are the
   view-as toggle endpoints themselves (enter/exit must POST).

   Blocking telemetry POSTs (heartbeat, perf ingest) here is deliberate, not
   collateral: during view-as those would attribute the SA's activity to the
   target user and corrupt the Activity Monitor's per-person history.

   Scope is /api only — page navigations (GET) are untouched, so the matcher
   keeps this out of every static/asset request.
   --------------------------------------------------------------------------- */

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const VIEW_AS_COOKIES = ["koleex_view_as", "koleex_view_as_role"];

export function proxy(req: NextRequest) {
  if (READ_METHODS.has(req.method)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/auth/view-as")) return NextResponse.next();
  const hasViewAs = VIEW_AS_COOKIES.some((name) => req.cookies.has(name));
  if (!hasViewAs) return NextResponse.next();
  return NextResponse.json(
    { error: "Read-only while viewing as another user/role. Exit view-as to make changes." },
    { status: 403 },
  );
}

export const config = {
  matcher: "/api/:path*",
};
