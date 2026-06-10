import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/attributes — P0-A.
   The attribute master lists (tags, plug types, colors, voltage, watt,
   levels) live as JSON in the public "media" bucket at
   config/product-attributes.json (legacy location, unchanged).

   GET — return the raw config JSON (any authenticated user; the file is in
         a public bucket anyway — this route exists so P0-B can stop using
         the anon storage path and to give writes a gate).
   PUT — overwrite the config. Product Data / SA only. Server-side upload,
         no anon storage write.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const BUCKET = "media";
const CONFIG_PATH = "config/product-attributes.json";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);

  /* ?usage=1 — per-attribute value usage rollup across products (server-side
     so the client never receives raw product rows just to count). */
  if (url.searchParams.get("usage") === "1") {
    const { data, error } = await supabaseServer
      .from("products")
      .select("tags, plug_types, colors, voltage, watt, level, brand");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const usage = {
      tags: {} as Record<string, number>,
      plug_types: {} as Record<string, number>,
      colors: {} as Record<string, number>,
      voltage: {} as Record<string, number>,
      watt: {} as Record<string, number>,
      levels: {} as Record<string, number>,
      brands: {} as Record<string, number>,
    };
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      for (const t of (row.tags as string[] | null) ?? []) usage.tags[t] = (usage.tags[t] || 0) + 1;
      for (const p of (row.plug_types as string[] | null) ?? []) usage.plug_types[p] = (usage.plug_types[p] || 0) + 1;
      for (const c of (row.colors as string[] | null) ?? []) usage.colors[c] = (usage.colors[c] || 0) + 1;
      for (const v of (row.voltage as string[] | null) ?? []) usage.voltage[v] = (usage.voltage[v] || 0) + 1;
      if (row.watt) usage.watt[row.watt as string] = (usage.watt[row.watt as string] || 0) + 1;
      if (row.level) usage.levels[row.level as string] = (usage.levels[row.level as string] || 0) + 1;
      if (row.brand) usage.brands[row.brand as string] = (usage.brands[row.brand as string] || 0) + 1;
    }
    return NextResponse.json({ usage });
  }

  /* ?classification=1 — product counts per division/category/subcategory slug. */
  if (url.searchParams.get("classification") === "1") {
    const { data, error } = await supabaseServer
      .from("products")
      .select("division_slug, category_slug, subcategory_slug");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const byDivision: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySubcategory: Record<string, number> = {};
    for (const row of (data ?? []) as Record<string, string>[]) {
      if (row.division_slug) byDivision[row.division_slug] = (byDivision[row.division_slug] || 0) + 1;
      if (row.category_slug) byCategory[row.category_slug] = (byCategory[row.category_slug] || 0) + 1;
      if (row.subcategory_slug) bySubcategory[row.subcategory_slug] = (bySubcategory[row.subcategory_slug] || 0) + 1;
    }
    return NextResponse.json({ byDivision, byCategory, bySubcategory });
  }

  const { data, error } = await supabaseServer.storage.from(BUCKET).download(CONFIG_PATH);
  if (error || !data) {
    // Missing file is a valid empty state — the client merges defaults.
    return NextResponse.json({ config: null });
  }
  try {
    const json = JSON.parse(await data.text()) as Record<string, unknown>;
    return NextResponse.json({ config: json });
  } catch {
    return NextResponse.json({ config: null });
  }
}

/* PATCH — apply a rename/delete of an attribute value across all products
   (server-side bulk mutation). Body: { op:'rename'|'delete', attrType,
   oldValue, newValue? }. PD/SA only. attrType ∈ array-cols (tags/plug_types/
   colors/voltage) | scalar 'watt' | 'levels'(→level) | 'brands'(→brand). */
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Only Product Data admins can edit attributes." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    op?: "rename" | "delete";
    attrType?: string;
    oldValue?: string;
    newValue?: string;
  };
  const { op, attrType, oldValue } = body;
  const newValue = op === "delete" ? null : body.newValue ?? null;
  if (!op || !attrType || !oldValue) {
    return NextResponse.json({ error: "op, attrType, oldValue required" }, { status: 400 });
  }

  const ARRAY_COLS = ["tags", "plug_types", "colors", "voltage"];
  const SCALAR: Record<string, string> = { watt: "watt", levels: "level", brands: "brand" };

  try {
    if (ARRAY_COLS.includes(attrType)) {
      const { data } = await supabaseServer
        .from("products")
        .select(`id, ${attrType}`)
        .contains(attrType, [oldValue]);
      for (const p of (data ?? []) as unknown as Record<string, unknown>[]) {
        const arr = ((p[attrType] as string[]) || []);
        const updated =
          op === "delete"
            ? arr.filter((v) => v !== oldValue)
            : arr.map((v) => (v === oldValue ? newValue! : v));
        const { error } = await supabaseServer
          .from("products")
          .update({ [attrType]: updated })
          .eq("id", p.id as string);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    const col = SCALAR[attrType];
    if (!col) return NextResponse.json({ error: "Unknown attrType" }, { status: 400 });
    const { error } = await supabaseServer
      .from("products")
      .update({ [col]: newValue })
      .eq(col, oldValue);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/products attributes PATCH]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit attributes." },
      { status: 403 },
    );
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid config body" }, { status: 400 });
  }
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(CONFIG_PATH, blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
  if (error) {
    console.error("[api/products attributes PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
