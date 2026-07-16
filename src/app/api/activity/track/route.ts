import "server-only";

/* POST /api/activity/track — record a page view or general activity event.

   Called by the headless ActivityTracker on route changes (page_view) and on
   idle/active/session_end transitions. Authenticated via cookie; best-effort. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { requestMeta, logActivity } from "@/lib/server/activity";
import { routeToModule } from "@/lib/activity/modules";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "session_start",
  "session_end",
  "idle",
  "active",
  // Wave 2A.1 Customers rollout — privacy-safe mode telemetry (one per route
  // session; no customer/search data). The mode is encoded in the event name.
  "customers_server_list_open",
  "customers_legacy_list_open",
  "customers_server_list_error",
  // Wave 2A.2 Suppliers rollout — same privacy-safe mode telemetry.
  "suppliers_server_list_open",
  "suppliers_legacy_list_open",
  "suppliers_server_list_error",
]);

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });

  let body: {
    deviceId?: string;
    eventType?: string;
    route?: string;
    title?: string;
    referrer?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const eventType = ALLOWED_EVENTS.has(body.eventType || "") ? body.eventType! : "page_view";
  const route = body.route ?? null;
  const meta = requestMeta(req);
  const accountId = auth.real_account_id ?? auth.account_id;

  await logActivity({
    account_id: accountId,
    tenant_id: auth.tenant_id,
    device_id: body.deviceId ?? null,
    event_type: eventType,
    route,
    module: route ? routeToModule(route) : null,
    title: body.title ?? null,
    referrer: body.referrer ?? null,
    severity: "info",
    meta,
  });

  return NextResponse.json({ ok: true });
}
