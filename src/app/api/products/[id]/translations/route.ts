import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/[id]/translations — P0-A.
   GET — product translations + model translations for the product's models.
         Any authenticated user (translations are public catalog text).
   PUT — apply translation edits. Product Data / SA only. Body:
         { upserts?: Row[], deletes?: string[],          // product_translations
           modelUpserts?: Row[], modelDeletes?: string[] // model_translations
         }
         Upserts use the same conflict keys as the legacy lib
         (product_id,locale / model_id,locale).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const [tRes, mRes] = await Promise.all([
    supabaseServer.from("product_translations").select("*").eq("product_id", id),
    supabaseServer.from("product_models").select("id").eq("product_id", id),
  ]);
  if (tRes.error) return NextResponse.json({ error: tRes.error.message }, { status: 500 });
  const modelIds = ((mRes.data ?? []) as { id: string }[]).map((m) => m.id);
  let modelTranslations: unknown[] = [];
  if (modelIds.length) {
    const mt = await supabaseServer
      .from("model_translations")
      .select("*")
      .in("model_id", modelIds);
    if (mt.error) return NextResponse.json({ error: mt.error.message }, { status: 500 });
    modelTranslations = mt.data ?? [];
  }
  return NextResponse.json({ translations: tRes.data ?? [], modelTranslations });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit translations." },
      { status: 403 },
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    upserts?: Record<string, unknown>[];
    deletes?: string[];
    modelUpserts?: Record<string, unknown>[];
    modelDeletes?: string[];
  };

  const errors: string[] = [];
  for (const t of body.upserts ?? []) {
    t.product_id = id; // path wins
    const { error } = await supabaseServer
      .from("product_translations")
      .upsert(t, { onConflict: "product_id,locale" });
    if (error) errors.push(error.message);
  }
  for (const delId of body.deletes ?? []) {
    if (!UUID_RE.test(delId)) continue;
    const { error } = await supabaseServer
      .from("product_translations")
      .delete()
      .eq("id", delId)
      .eq("product_id", id);
    if (error) errors.push(error.message);
  }
  for (const t of body.modelUpserts ?? []) {
    const { error } = await supabaseServer
      .from("model_translations")
      .upsert(t, { onConflict: "model_id,locale" });
    if (error) errors.push(error.message);
  }
  for (const delId of body.modelDeletes ?? []) {
    if (!UUID_RE.test(delId)) continue;
    const { error } = await supabaseServer
      .from("model_translations")
      .delete()
      .eq("id", delId);
    if (error) errors.push(error.message);
  }

  if (errors.length) {
    console.error("[api/products translations PUT]", errors.join("; "));
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
