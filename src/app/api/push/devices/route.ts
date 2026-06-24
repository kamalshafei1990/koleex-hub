import "server-only";

/* GET    /api/push/devices — list the Super Admin's registered push devices.
   DELETE /api/push/devices — remove one (by id) or the current one (by endpoint).
   Super-Admin only. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const accountId = auth.real_account_id ?? auth.account_id;
  const { data } = await supabaseServer
    .from("push_subscriptions")
    .select("id, device_name, browser, os, endpoint, is_active, created_at, last_used_at")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("last_used_at", { ascending: false, nullsFirst: false });
  return NextResponse.json({ devices: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { id?: string; endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (!body.id && !body.endpoint) return NextResponse.json({ error: "missing_target" }, { status: 400 });

  const accountId = auth.real_account_id ?? auth.account_id;
  let q = supabaseServer
    .from("push_subscriptions")
    .update({ is_active: false, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("account_id", accountId);
  q = body.id ? q.eq("id", body.id) : q.eq("endpoint", body.endpoint!);
  const { error } = await q;
  if (error) {
    console.error("[api/push/devices DELETE]", error.message);
    return NextResponse.json({ error: "remove_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
