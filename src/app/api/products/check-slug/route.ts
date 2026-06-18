import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/check-slug

   Live uniqueness check for the public product URL slug. The form calls
   this on every (debounced) change so the operator sees a collision the
   moment they type a duplicate — two products sharing a slug would
   silently break /products/<slug> (only one can resolve).

   Slugs are tenant-scoped: the public catalog is per-tenant, so a slug
   that only collides with another tenant's product reads as available.

   Query params:
     slug             — required, the candidate slug to check
     excludeProductId — optional, the product the form is editing (so a
                        product never collides with itself on rename)

   Response:
     { ok: true } when the slug is empty / not yet a candidate.
     { ok: true, available: true } when free.
     { ok: true, available: false, conflict: { product_id, product_name, slug } }.

   Auth: Product Data access required — uniqueness lookup is internal.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can check slugs." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  /* Normalize exactly like the form's slugify — lower-case, trimmed.
     We compare case-insensitively to be safe regardless of how legacy
     rows were stored. */
  const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
  const excludeProductId = url.searchParams.get("excludeProductId");

  if (!slug) {
    return NextResponse.json({ ok: true });
  }

  let query = supabaseServer
    .from("products")
    .select("id, product_name, slug")
    .eq("tenant_id", auth.tenant_id)
    .ilike("slug", slug);

  if (excludeProductId) {
    query = query.neq("id", excludeProductId);
  }

  const { data: rows, error } = await query.limit(1);
  if (error) {
    console.error("[check-slug] products query failed:", error.message);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, available: true });
  }

  const hit = rows[0];
  return NextResponse.json({
    ok: true,
    available: false,
    conflict: {
      product_id: hit.id,
      product_name: hit.product_name ?? "(unknown product)",
      slug: hit.slug,
    },
  });
}
