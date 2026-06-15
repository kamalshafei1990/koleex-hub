import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/product-templates

   Lists the active product templates (id · name · slug · taxonomy slugs) so
   admin tools — like the Visual Mapping screen — can offer a template picker
   without hard-coding slugs. Structure is global; gated by Product Data
   module access only.
   --------------------------------------------------------------------------- */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Product Data");
  if (deny) return deny;

  const res = await supabaseServer
    .from("product_templates")
    .select("id, name, slug, division_slug, category_slug, subcategory_slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json(
    { templates: res.data ?? [] },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
