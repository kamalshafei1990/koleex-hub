import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/products/search?q=…&exclude=<uuid> — P0-A.
   Lightweight name search for pickers (RelatedProductsSection etc.).
   Returns only id, product_name, slug — catalog-safe for any authed user.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const exclude = url.searchParams.get("exclude");
  if (!q) return NextResponse.json({ results: [] });

  // Escape PostgREST ilike wildcards in user input.
  const safe = q.replace(/[%_]/g, (c) => `\\${c}`);
  let query = supabaseServer
    .from("products")
    .select("id, product_name, slug")
    .ilike("product_name", `%${safe}%`)
    .limit(10);
  if (exclude && UUID_RE.test(exclude)) query = query.neq("id", exclude);

  const { data, error } = await query;
  if (error) {
    console.error("[api/products search]", error.message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
  return NextResponse.json({ results: data ?? [] });
}
