import "server-only";

/* ---------------------------------------------------------------------------
   /api/app-launcher — per-user App Launcher state (favorites + recent apps).

   koleex_app_favorites / koleex_app_recent are RLS-locked to the service role
   (like the rest of the app's tables), so these reads/writes must go through
   the server with the authenticated account — NOT the browser anon client,
   which was being rejected by RLS and spamming the console. The account is
   taken from the session, never trusted from the client.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const acc = auth.account_id;
  if (!acc) return NextResponse.json({ favorites: [], recent: [] });

  const [favRes, recRes] = await Promise.all([
    supabaseServer.from("koleex_app_favorites").select("app_id").eq("account_id", acc).order("created_at", { ascending: true }),
    supabaseServer.from("koleex_app_recent").select("app_id").eq("account_id", acc).order("opened_at", { ascending: false }).limit(24),
  ]);

  if (favRes.error) console.error("[api/app-launcher GET favorites]", favRes.error.message);
  if (recRes.error) console.error("[api/app-launcher GET recent]", recRes.error.message);

  return NextResponse.json({
    favorites: (favRes.data ?? []).map((r) => (r as { app_id: string }).app_id),
    recent: (recRes.data ?? []).map((r) => (r as { app_id: string }).app_id),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const acc = auth.account_id;
  if (!acc) return NextResponse.json({ ok: false });

  let body: { action?: string; app_id?: string };
  try { body = (await req.json()) as { action?: string; app_id?: string }; }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const appId = typeof body.app_id === "string" ? body.app_id.trim() : "";
  if (!appId) return NextResponse.json({ error: "app_id required" }, { status: 400 });

  let error = null;
  if (body.action === "track") {
    ({ error } = await supabaseServer.from("koleex_app_recent")
      .upsert({ account_id: acc, app_id: appId, opened_at: new Date().toISOString() }, { onConflict: "account_id,app_id" }));
  } else if (body.action === "favorite") {
    ({ error } = await supabaseServer.from("koleex_app_favorites")
      .upsert({ account_id: acc, app_id: appId }, { onConflict: "account_id,app_id" }));
  } else if (body.action === "unfavorite") {
    ({ error } = await supabaseServer.from("koleex_app_favorites")
      .delete().eq("account_id", acc).eq("app_id", appId));
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  if (error) {
    console.error("[api/app-launcher POST]", body.action, error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
