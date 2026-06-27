import "server-only";

/* ---------------------------------------------------------------------------
   /api/taxonomy/[kind] — P0-A taxonomy API.
   kind ∈ { divisions, categories, subcategories } (whitelist — anything
   else 404s; never a free table name from the URL).

   GET  — list rows ordered by "order". ?counts=1 additionally returns the
          product count per slug. Any authenticated user (taxonomy names/
          slugs are public catalog structure).
   POST — create a row. Product Data / SA only.
   PATCH/DELETE live on /api/taxonomy/[kind]/[rowId].
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";

const TAXONOMY_KINDS = ["divisions", "categories", "subcategories"] as const;
type Kind = (typeof TAXONOMY_KINDS)[number];

/* products column that holds the slug for each kind, for ?counts=1 */
const COUNT_COLUMN: Record<Kind, string> = {
  divisions: "division_slug",
  categories: "category_slug",
  subcategories: "subcategory_slug",
};

function asKind(raw: string): Kind | null {
  return (TAXONOMY_KINDS as readonly string[]).includes(raw) ? (raw as Kind) : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const kind = asKind((await params).kind);
  if (!kind) return NextResponse.json({ error: "Unknown taxonomy kind" }, { status: 404 });

  const { data, error } = await supabaseServer.from(kind).select("*").order("order");
  if (error) {
    console.error(`[api/taxonomy ${kind} GET]`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const wantCounts = new URL(req.url).searchParams.get("counts") === "1";
  let counts: Record<string, number> | undefined;
  if (wantCounts) {
    const col = COUNT_COLUMN[kind];
    const res = await supabaseServer.from("products").select(col);
    counts = {};
    for (const row of (res.data ?? []) as unknown as Record<string, unknown>[]) {
      const slug = row[col] as string | null;
      if (slug) counts[slug] = (counts[slug] || 0) + 1;
    }
  }

  return NextResponse.json(
    { rows: data ?? [], ...(counts ? { counts } : {}) },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "create");
  if (denied) return denied;
  const kind = asKind((await params).kind);
  if (!kind) return NextResponse.json({ error: "Unknown taxonomy kind" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  const { data, error } = await supabaseServer.from(kind).insert(body).select().single();
  if (error) {
    console.error(`[api/taxonomy ${kind} POST]`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data });
}
