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
import { supabaseServer } from "@/lib/server/supabase-server";
import { requestMeta, heartbeat, touchDevice, locationLabel } from "@/lib/server/activity";
import { routeToModule } from "@/lib/activity/modules";
import { notifySuperAdmins } from "@/lib/server/sa-notify";

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

  const [hb, dev] = await Promise.all([
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

  /* Usage accounting: an ACTIVE beat means the user was interacting for the
     last heartbeat interval, so credit it to today's usage_daily row (atomic
     SQL increment — no read, no row-lock contention; the 2026-07-20 write
     storm was read-modify-write presence rows, not this). Idle/hidden beats
     (which also arrive on the slow 120s cadence) are deliberately NOT usage.
     Best-effort: usage must never block presence. */
  if (status === "active") {
    void supabaseServer
      .rpc("increment_usage", {
        p_account: accountId,
        p_tenant: auth.tenant_id,
        p_day: new Date().toISOString().slice(0, 10),
        p_seconds: 30,
      })
      .then(({ error }) => {
        if (error) console.error("[heartbeat] increment_usage:", error.message);
      });
  }

  // First time we've seen this browser for the account → "new device" alert.
  if (dev.isNew) {
    await notifySuperAdmins({
      kind: "new_device",
      subject: `${auth.username || "A user"} signed in from a new device`,
      actorName: auth.username || null,
      action: `New device · ${meta.browser} on ${meta.os}`,
      location: locationLabel(meta),
      body: `${meta.browser} on ${meta.os}${meta.country ? ` · ${meta.country}` : ""}`,
      severity: "warning",
      actorAccountId: accountId,
      tenantId: auth.tenant_id,
      metadata: { device_id: deviceId, browser: meta.browser, os: meta.os, ip: meta.ip },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, revoked: hb.revoked });
}
