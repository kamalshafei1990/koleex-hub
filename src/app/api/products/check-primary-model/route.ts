import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/check-primary-model

   Live uniqueness check for the KOLEEX Primary Model code. The form
   calls this on every (debounced) keystroke so the operator sees a
   collision the moment it happens — not as a Postgres error after
   pressing Save.

   The DB still owns the hard guarantee via the partial unique index on
   upper(primary_model). This route is the friendly mirror that lets
   the UI explain WHICH product is using the code, with a link.

   Query params:
     code            — required, the candidate code to check
     excludeProductId — optional, the product the form is currently
                       editing (so its own models don't collide with
                       themselves on rename)

   Response:
     { ok: true } when the code is empty / not yet a candidate.
     { ok: true, available: true } when free.
     { ok: true, available: false, conflict: { ... } } when taken.
       conflict = { product_id, product_name, product_slug,
                    model_id, model_name, primary_model }

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
      { error: "Only Product Data admins can check codes." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("code") || "").trim();
  const excludeProductId = url.searchParams.get("excludeProductId");

  /* Normalize the candidate exactly like the form's onBlur — uppercase,
     no spaces, collapsed dashes. The DB unique index is on
     upper(primary_model), so matching that exactly keeps us in sync. */
  const code = raw.toUpperCase().replace(/\s+/g, "");
  if (!code) {
    return NextResponse.json({ ok: true });
  }

  /* Pull every model that matches the candidate code. We compare case-
     insensitively to mirror the DB unique index. Excluding the
     in-flight product covers the rename + multi-model cases (Save
     should not flag a model against itself). */
  let query = supabaseServer
    .from("product_models")
    .select("id, product_id, model_name, primary_model")
    .ilike("primary_model", code);

  if (excludeProductId) {
    query = query.neq("product_id", excludeProductId);
  }

  const { data: models, error } = await query.limit(1);
  if (error) {
    console.error("[check-primary-model] models query failed:", error.message);
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500 },
    );
  }

  if (!models || models.length === 0) {
    return NextResponse.json({ ok: true, available: true });
  }

  /* Found a collision — fetch the owning product's display name + slug
     so the UI can render a one-click link to the conflicting product. */
  const hit = models[0];
  const { data: product } = await supabaseServer
    .from("products")
    .select("product_name, slug")
    .eq("id", hit.product_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    available: false,
    conflict: {
      product_id: hit.product_id,
      product_name: product?.product_name ?? "(unknown product)",
      product_slug: product?.slug ?? null,
      model_id: hit.id,
      model_name: hit.model_name,
      primary_model: hit.primary_model,
    },
  });
}
