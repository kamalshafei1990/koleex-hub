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
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

type Level = "division" | "category" | "subcategory" | "kind";
const LEVELS: Level[] = ["division", "category", "subcategory", "kind"];

type IconMap = Record<Level, Record<string, string>>;

/* Same finding as /api/taxonomy?kind=all, same treatment: measured on
   production this route costs ~660 ms to return ~56 KB that is IDENTICAL for
   every authenticated user, and the query behind it is sub-millisecond. A
   warm instance therefore answers from memory.

   Better than the taxonomy case: writes come through the PUT below, in this
   same module, so the memo is dropped the moment an icon changes — an editor
   sees their own write immediately instead of waiting out a TTL. The TTL is
   only the backstop for writes made by a DIFFERENT instance.

   Auth is still enforced per request, above the cache. */
const gi = globalThis as typeof globalThis & { __kxClassIcons?: { at: number; icons: IconMap } | null };
const ICONS_TTL_MS = 60_000;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const memo = gi.__kxClassIcons;
  if (memo && Date.now() - memo.at < ICONS_TTL_MS) {
    return NextResponse.json(
      { icons: memo.icons },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
    );
  }

  /* CL-registry unification (owner 2026-08-07): classification icons now
     LIVE in visual_icon_bindings (semantic_key classification.level.slug) —
     one registry, one uniqueness law. This route keeps its legacy response
     shape so every existing consumer stays untouched. */
  const { data, error } = await supabaseServer
    .from("visual_icon_bindings")
    .select("semantic_key, icon_url")
    .eq("domain", "classification");
  if (error) {
    console.error("[api/classification-icons GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const icons: IconMap = {
    division: {}, category: {}, subcategory: {}, kind: {},
  };
  for (const raw of data ?? []) {
    const parts = String(raw.semantic_key ?? "").split(".");
    const row = { level: parts[1], slug: parts.slice(2).join("."), icon_url: raw.icon_url };
    const lvl = row.level as Level;
    if (LEVELS.includes(lvl) && row.slug && row.icon_url) {
      /* Strip any whitespace on the way out too — a corrupted URL (e.g. a
         newline from a bad env value at write time) breaks CSS mask-image
         and every consumer renders a solid square instead of the icon. */
      icons[lvl][row.slug as string] = (row.icon_url as string).replace(/\s+/g, "");
    }
  }
  gi.__kxClassIcons = { at: Date.now(), icons };
  return NextResponse.json(
    { icons },
    /* Icon overrides change rarely (Database-app edits) — let the browser
       reuse them briefly instead of re-downloading ~56 KB on every
       catalogue mount. Same policy as /api/taxonomy. */
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

/* PUT — set (upsert) or clear a classification icon override, keyed by
   (level, slug). Body: { level, slug, icon_asset_id?, icon_url? }. When both
   icon fields are null/absent the override is removed (falls back to the
   built-in icon). Database-module access (this is driven by the Database app
   Classifications picker). */
export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;

  let body: { level?: string; slug?: string; icon_asset_id?: string | null; icon_url?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const level = body.level;
  const slug = (body.slug || "").trim();
  if (!level || !LEVELS.includes(level as Level) || !slug) {
    return NextResponse.json({ error: "level (division|category|subcategory|kind) and slug are required" }, { status: 400 });
  }
  const icon_asset_id = body.icon_asset_id ?? null;
  /* URLs must never contain whitespace — a newline (seen when the
     NEXT_PUBLIC_SUPABASE_URL env value had a trailing \n) makes the CSS
     mask-image invalid and every icon renders as a solid square. */
  const icon_url = body.icon_url ? body.icon_url.replace(/\s+/g, "") : null;

  // Both empty → clear the override.
  if (!icon_asset_id && !icon_url) {
    const { error } = await supabaseServer
      .from("visual_icon_bindings")
      .delete()
      .eq("semantic_key", `classification.${level}.${slug}`);
    if (error) {
      console.error("[api/classification-icons PUT clear]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    gi.__kxClassIcons = null;
    return NextResponse.json({ ok: true, cleared: true });
  }

  const semanticKey = `classification.${level}.${slug}`;
  /* One icon = one meaning (system-wide, not just classification). */
  const { data: taken } = await supabaseServer
    .from("visual_icon_bindings")
    .select("semantic_key, label_en")
    .eq("icon_url", icon_url as string)
    .neq("semantic_key", semanticKey)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      { error: `This icon already carries another meaning: ${taken.label_en || taken.semantic_key}. Pick a different icon.`, taken_by: taken.semantic_key },
      { status: 409 },
    );
  }
  const { error } = await supabaseServer
    .from("visual_icon_bindings")
    .upsert(
      { semantic_key: semanticKey, domain: "classification", icon_url, source: "manual", updated_by: auth.account_id ?? null, updated_at: new Date().toISOString() },
      { onConflict: "semantic_key" },
    );
  if (error) {
    console.error("[api/classification-icons PUT]", error.message);
    if (error.code === "23505") return NextResponse.json({ error: "This icon already carries another meaning." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  /* This instance must not keep serving the pre-write map to the very person
     who just changed it. */
  gi.__kxClassIcons = null;
  return NextResponse.json({ ok: true });
}
