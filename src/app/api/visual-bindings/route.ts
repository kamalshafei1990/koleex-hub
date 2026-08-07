import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-bindings — the SEMANTIC ICON REGISTRY gateway.

   Owner law (2026-08-07): one meaning = one icon AND one icon = one meaning,
   system-wide. Both directions are UNIQUE constraints on
   visual_icon_bindings; this route turns constraint violations into human
   answers ("that icon already means X") instead of raw 23505s.

   GET  → { bindings: { semantic_key: icon_url } }  (cached 60s like the
          classification hub — icon edits are rare).
   PUT  → { semantic_key, domain, icon_url, label_en? } upsert.
          Empty/absent icon_url = remove the binding (fall back to default).
   Writes are Database·edit gated — the Visual Library is the control room.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

const DOMAINS = ["classification", "field", "spec", "attribute", "app", "activity", "ui"];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("visual_icon_bindings")
    .select("semantic_key, icon_url");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bindings: Record<string, string> = {};
  for (const r of data ?? []) {
    if (r.semantic_key && r.icon_url) bindings[r.semantic_key as string] = (r.icon_url as string).replace(/\s+/g, "");
  }
  return NextResponse.json(
    { bindings },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as {
    semantic_key?: string; domain?: string; icon_url?: string | null; label_en?: string | null;
  };
  const key = String(body.semantic_key ?? "").trim().slice(0, 200);
  const domain = String(body.domain ?? key.split(".")[0] ?? "").trim();
  const iconUrl = (body.icon_url ?? "").toString().replace(/\s+/g, "");
  if (!key || !DOMAINS.includes(domain)) {
    return NextResponse.json({ error: "semantic_key and a valid domain are required" }, { status: 400 });
  }

  /* Remove = the meaning goes back to its built-in default. */
  if (!iconUrl) {
    const { error } = await supabaseServer.from("visual_icon_bindings").delete().eq("semantic_key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removed: true });
  }

  /* THE LAW, spelled out before the DB says 23505: is this icon already
     the face of another meaning? */
  const { data: taken } = await supabaseServer
    .from("visual_icon_bindings")
    .select("semantic_key, label_en")
    .eq("icon_url", iconUrl)
    .neq("semantic_key", key)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      {
        error: `This icon already carries another meaning: ${taken.label_en || taken.semantic_key}. One icon = one meaning — pick a different icon, or free it there first.`,
        taken_by: taken.semantic_key,
      },
      { status: 409 },
    );
  }

  const { error } = await supabaseServer
    .from("visual_icon_bindings")
    .upsert(
      {
        semantic_key: key,
        domain,
        icon_url: iconUrl,
        label_en: body.label_en ?? null,
        source: "manual",
        updated_by: auth.account_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "semantic_key" },
    );
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This icon already carries another meaning. One icon = one meaning." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
