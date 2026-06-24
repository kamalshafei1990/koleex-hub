import "server-only";

/* GET/PUT /api/super-admin/notification-preferences — the calling Super Admin's
   own alert channel preferences (per alert kind). Stored in
   notification_preferences.prefs (jsonb). Super-Admin only. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const accountId = auth.real_account_id ?? auth.account_id;
  const { data } = await supabaseServer
    .from("notification_preferences")
    .select("prefs")
    .eq("account_id", accountId)
    .maybeSingle();
  return NextResponse.json(
    { prefs: (data as { prefs?: Record<string, unknown> } | null)?.prefs ?? {} },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { prefs?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const prefs = body.prefs ?? {};
  const accountId = auth.real_account_id ?? auth.account_id;

  const { error } = await supabaseServer
    .from("notification_preferences")
    .upsert(
      { account_id: accountId, prefs, updated_at: new Date().toISOString() },
      { onConflict: "account_id" },
    );
  if (error) {
    console.error("[api/super-admin/notification-preferences PUT]", error.message);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
