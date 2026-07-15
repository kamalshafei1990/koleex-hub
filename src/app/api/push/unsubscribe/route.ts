import "server-only";

/* POST /api/push/unsubscribe — deactivate a Web Push subscription for the
   calling Super Admin (by endpoint, or by device id). Super-Admin only.
   Companion to /api/push/subscribe; /api/push/devices DELETE does the same. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  /* Any signed-in user may register / test their OWN device for push
     (Discuss message alerts, mentions, etc.); every send is per-account. */

  let body: { endpoint?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (!body.endpoint && !body.id) return NextResponse.json({ error: "missing_target" }, { status: 400 });

  const accountId = auth.real_account_id ?? auth.account_id;
  let q = supabaseServer
    .from("push_subscriptions")
    .update({ is_active: false, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("account_id", accountId);
  q = body.id ? q.eq("id", body.id) : q.eq("endpoint", body.endpoint!);
  const { error } = await q;
  if (error) {
    console.error("[api/push/unsubscribe]", error.message);
    return NextResponse.json({ error: "unsubscribe_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
