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
import { requireAuth } from "@/lib/server/auth";

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
