import "server-only";

/* ---------------------------------------------------------------------------
   /api/brands

   GET  — list every brand in the catalogue plus its product count so
          the admin's Create Brand modal can show "7 products" next to
          each entry. Any authenticated user can read; the customer
          catalog needs this to render brand chips on product cards.

   POST — create a new brand (name + optional logoUrl). Requires
          Product Data access. This is the one change that fixes the
          "I added a brand and it wasn't saved" bug: the brand row
          lands in the DB immediately when the modal clicks Save,
          instead of waiting for the product save.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("brands")
    .select("id, name, slug, logo_url")
    .order("name");

  if (error) {
    console.error("[api/brands GET]", error.message);
    return NextResponse.json({ error: "Failed to load brands" }, { status: 500 });
  }

  /* Product count per brand so the settings UI can show usage.
     Counted via a single GROUP-BY-esque query on products; a row
     with zero products still appears (brands the admin created
     but hasn't used yet). */
  const { data: rows } = await supabaseServer
    .from("products")
    .select("brand");

  const counts: Record<string, number> = {};
  for (const p of ((rows ?? []) as { brand: string | null }[])) {
    if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
  }

  const brands = ((data ?? []) as BrandRow[]).map((b) => ({
    ...b,
    productCount: counts[b.name] || 0,
  }));

  return NextResponse.json(
    { brands },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can create brands." },
      { status: 403 },
    );
  }

  let body: { name?: string; logoUrl?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
  }

  /* Slug mirrors the client-side slugify rule so we don't end up
     with brands whose logo filename doesn't match the slug. */
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  /* Idempotent create: if the brand already exists (case-insensitive
     on name, exact on slug), return the existing row instead of
     erroring out. Keeps the admin UI simple — clicking Create when
     a brand is already there just selects it. */
  const { data: existing } = await supabaseServer
    .from("brands")
    .select("id, name, slug, logo_url")
    .or(`slug.eq.${slug},name.ilike.${name}`)
    .maybeSingle();

  if (existing) {
    /* If the caller provided a logoUrl and the existing row doesn't
       have one, merge it in so re-creating with a logo backfills. */
    if (body.logoUrl && !(existing as BrandRow).logo_url) {
      const { data: updated } = await supabaseServer
        .from("brands")
        .update({ logo_url: body.logoUrl, updated_at: new Date().toISOString() })
        .eq("id", (existing as BrandRow).id)
        .select("id, name, slug, logo_url")
        .single();
      return NextResponse.json({ brand: updated ?? existing });
    }
    return NextResponse.json({ brand: existing });
  }

  const { data, error } = await supabaseServer
    .from("brands")
    .insert({ name, slug, logo_url: body.logoUrl || null })
    .select("id, name, slug, logo_url")
    .single();

  if (error) {
    console.error("[api/brands POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ brand: data });
}
