import "server-only";

/* /api/model-translations — P0-B flat resource (keyed by model).
   GET  ?model_ids=<uuid,uuid,…> → rows. Public catalog text → any authed user.
   POST → upsert one row (onConflict model_id,locale). PD/SA.
   DELETE on /[id]. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const raw = new URL(req.url).searchParams.get("model_ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s));
  if (!ids.length) return NextResponse.json({ translations: [] });
  const { data, error } = await supabaseServer
    .from("model_translations")
    .select("*")
    .in("model_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ translations: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Only Product Data admins can edit translations." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { error } = await supabaseServer
    .from("model_translations")
    .upsert(body, { onConflict: "model_id,locale" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
