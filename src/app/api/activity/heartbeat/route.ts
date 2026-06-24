import "server-only";

/* POST /api/activity/heartbeat — live-presence ping from the client.

   Called by the headless ActivityTracker every ~30s (and on visibility / idle
   changes). Authenticated via the koleex_session cookie (getServerAuth); the
   browser never sends an account id. Upserts the presence row + device registry
   and returns { revoked } so a force-logged-out client signs itself out.

   Best-effort + cheap: one presence upsert + one device touch. No write when
   unauthenticated. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { requestMeta, heartbeat, touchDevice } from "@/lib/server/activity";
import { routeToModule } from "@/lib/activity/modules";

const STATUSES = new Set(["active", "idle", "offline"]);

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });

  let body: {
    deviceId?: string;
    route?: string;
    module?: string;
    status?: string;
    lastAction?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const deviceId = (body.deviceId || "").trim();
  if (!deviceId) return NextResponse.json({ ok: false, error: "no_device" }, { status: 400 });

  const status = (STATUSES.has(body.status || "") ? body.status : "active") as
    | "active"
    | "idle"
    | "offline";
  const meta = requestMeta(req);
  const route = body.route ?? null;
  const moduleName = body.module ?? (route ? routeToModule(route) : null);

  // Real account id even under view-as, so presence reflects the operator.
  const accountId = auth.real_account_id ?? auth.account_id;

  const [hb] = await Promise.all([
    heartbeat({
      account_id: accountId,
      tenant_id: auth.tenant_id,
      device_id: deviceId,
      status,
      current_route: route,
      current_module: moduleName,
      last_action: body.lastAction ?? null,
      meta,
    }),
    touchDevice({ account_id: accountId, tenant_id: auth.tenant_id, device_id: deviceId, meta }),
  ]);

  return NextResponse.json({ ok: true, revoked: hb.revoked });
}
