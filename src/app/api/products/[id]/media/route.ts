import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/products/[id]/media

   Returns all media rows for a product, grouped by role:
     { hero, gallery[], detail[], video[], document[] }

   Phase 2.1: the template engine renderer reads media from here so it
   doesn't need a second media subsystem. Existing product_media rows
   are the single source of truth; the `role` discriminator (added in
   phase_2_1_stabilization) lets the renderer pick which media goes
   where.
   --------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Product Data");
  if (deny) return deny;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id must be a UUID" }, { status: 400 });
  }

  /* Tenant boundary — now that products.tenant_id is populated, the
     check actually works. SA still bypasses for cross-tenant audits. */
  const prodRes = await supabaseServer
    .from("products")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (prodRes.error) {
    return NextResponse.json({ error: prodRes.error.message }, { status: 500 });
  }
  const prod = prodRes.data as { id: string; tenant_id: string } | null;
  if (!prod) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!auth.is_super_admin && prod.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Product not in your tenant" }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("product_media")
    .select(`id, url, alt_text, "order", role, type, model_id`)
    .eq("product_id", id)
    .order("order", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    url: string;
    alt_text: string | null;
    order: number;
    role: "hero" | "gallery" | "detail" | "video" | "document";
    type: string;
    model_id: string | null;
  };
  const rows = (data ?? []) as Row[];

  const byRole = {
    hero: null as Row | null,
    gallery: [] as Row[],
    detail: [] as Row[],
    video: [] as Row[],
    document: [] as Row[],
  };
  for (const r of rows) {
    if (r.role === "hero" && byRole.hero === null) {
      byRole.hero = r;
    } else if (r.role === "hero") {
      /* Multiple hero rows: keep the lowest-order one as hero, the
         rest become gallery. Defensive — schema doesn't enforce one
         hero per product yet. */
      byRole.gallery.push(r);
    } else {
      byRole[r.role].push(r);
    }
  }

  return NextResponse.json(byRole, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}
