import "server-only";

/* ---------------------------------------------------------------------------
   /api/classification-icons — the classification icon HUB (Phase 1).

   GET — returns the icon override for every classification level, as a nested
         map { division|category|subcategory|kind : { slug: icon_url } }.
         A present entry overrides the built-in code/storage icon everywhere;
         an absent entry means "use the built-in fallback". Any authenticated
         user (classification icons are public catalog structure, like the
         taxonomy names/slugs).

   Writes happen in Phase 2 (the Database app Classifications picker, once it
   is pointed at the real taxonomy slugs). Table is RLS-locked to service-role.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type Level = "division" | "category" | "subcategory" | "kind";
const LEVELS: Level[] = ["division", "category", "subcategory", "kind"];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("classification_icons")
    .select("level, slug, icon_url");
  if (error) {
    console.error("[api/classification-icons GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const icons: Record<Level, Record<string, string>> = {
    division: {}, category: {}, subcategory: {}, kind: {},
  };
  for (const row of data ?? []) {
    const lvl = row.level as Level;
    if (LEVELS.includes(lvl) && row.slug && row.icon_url) {
      icons[lvl][row.slug as string] = row.icon_url as string;
    }
  }
  return NextResponse.json({ icons });
}

/* PUT — set (upsert) or clear a classification icon override, keyed by
   (level, slug). Body: { level, slug, icon_asset_id?, icon_url? }. When both
   icon fields are null/absent the override is removed (falls back to the
   built-in icon). Database-module access (this is driven by the Database app
   Classifications picker). */
export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  let body: { level?: string; slug?: string; icon_asset_id?: string | null; icon_url?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const level = body.level;
  const slug = (body.slug || "").trim();
  if (!level || !LEVELS.includes(level as Level) || !slug) {
    return NextResponse.json({ error: "level (division|category|subcategory|kind) and slug are required" }, { status: 400 });
  }
  const icon_asset_id = body.icon_asset_id ?? null;
  const icon_url = body.icon_url ?? null;

  // Both empty → clear the override.
  if (!icon_asset_id && !icon_url) {
    const { error } = await supabaseServer
      .from("classification_icons")
      .delete()
      .eq("level", level)
      .eq("slug", slug);
    if (error) {
      console.error("[api/classification-icons PUT clear]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: true });
  }

  const { error } = await supabaseServer
    .from("classification_icons")
    .upsert(
      { level, slug, icon_asset_id, icon_url, updated_at: new Date().toISOString() },
      { onConflict: "level,slug" },
    );
  if (error) {
    console.error("[api/classification-icons PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
