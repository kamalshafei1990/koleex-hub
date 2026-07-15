import "server-only";

/* POST /api/push/subscribe — save (or reactivate) a Web Push subscription for
   the calling Super Admin's current device. Super-Admin only — normal users
   never register, so they never receive push. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { parseUserAgent } from "@/lib/account-security";

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  /* Any signed-in user may register / test their OWN device for push
     (Discuss message alerts, mentions, etc.); every send is per-account. */

  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    deviceId?: string;
    deviceName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent");
  const parsed = parseUserAgent(ua);
  const accountId = auth.real_account_id ?? auth.account_id;
  const now = new Date().toISOString();

  // Endpoint is unique; upsert so re-subscribing the same device reactivates it
  // (and re-points it to the current account) without creating duplicates.
  const { error } = await supabaseServer.from("push_subscriptions").upsert(
    {
      account_id: accountId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: ua,
      device_id: body.deviceId ?? null,
      device_name: body.deviceName || parsed.device_name,
      browser: parsed.browser,
      os: parsed.os,
      is_active: true,
      last_used_at: now,
      updated_at: now,
      revoked_at: null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[api/push/subscribe]", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
