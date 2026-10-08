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

function isLoopbackIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const v = ip.trim().toLowerCase();
  return v === "::1" || v === "localhost" || v.startsWith("127.") || v.startsWith("::ffff:127.");
}

async function seenOnSameBrowserRecently(
  accountId: string,
  deviceId: string,
  browser: string | null | undefined,
  os: string | null | undefined,
): Promise<boolean> {
  if (!browser || !os) return false;
  try {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { count } = await supabaseServer
      .from("user_devices")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .neq("device_id", deviceId)
      .eq("browser", browser)
      .eq("os", os)
      .gte("last_seen_at", since);
    return (count ?? 0) > 0;
  } catch {
    return false; // fail loud: an unknown state is a new device
  }
}

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
  // The device id is a localStorage/cookie token, and browsers re-mint it more
  // often than people change devices (private windows, a cleared site, Safari
  // dropping storage): the owner alone produced 132 "new device" alerts from
  // 22 ids on FOUR real browser/OS pairs in three weeks. A fresh id on a
  // browser+OS this account was seen on within 30 days is the same device
  // wearing a new token — registered, not alerted.
  /* A loopback address is this machine's own dev server, not a person on a
     new device. Measured 26/09: 116 of 138 "new device" alerts in a month
     came from ::1 — preview browsers and dev sessions signing in against the
     shared database — and landed in the other Super Admins' bells. The
     device is still registered above; only the alert is skipped. */
  const loopback = isLoopbackIp(meta.ip);
  if (dev.isNew && !loopback && !(await seenOnSameBrowserRecently(accountId, deviceId, meta.browser, meta.os))) {
    await notifySuperAdmins({
      kind: "new_device",
      /* "{actor} signed in from a new device" / "{browser} on {os} · {country}",
         in the reader's language (translations/notif-templates/admin.ts). */
      tpl: auth.username
        ? { k: "new_device", p: { actor: auth.username, browser: meta.browser, os: meta.os, country: meta.country } }
        : { k: "new_device.unknown", p: { browser: meta.browser, os: meta.os, country: meta.country } },
      actorName: auth.username || null,
      action: `New device · ${meta.browser} on ${meta.os}`,
      location: locationLabel(meta),
      severity: "warning",
      actorAccountId: accountId,
      tenantId: auth.tenant_id,
      metadata: { device_id: deviceId, browser: meta.browser, os: meta.os, ip: meta.ip },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, revoked: hb.revoked });
}
