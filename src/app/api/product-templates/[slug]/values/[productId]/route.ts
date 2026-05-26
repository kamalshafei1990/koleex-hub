import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET  /api/product-templates/[slug]/values/[productId]
   POST /api/product-templates/[slug]/values/[productId]

   Read or upsert the dynamic template field values for one product
   (optionally for a single model via ?modelId=).

   Phase 1 contract:
     · GET returns { values: Record<field_key, value_json> } so the
       client can hydrate the form by field_key.
     · POST body: { values: Record<field_key, value_json> } — upserts
       each non-null entry, deletes entries whose value is null.

   Writes are blocked while view-as is active (requireAuth(req) enforces
   read-only) — same posture as the rest of the API.
   --------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadTemplateFieldsBySlug(slug: string) {
  /* Resolve template → fields-by-key in one round-trip plus a join. */
  const tplRes = await supabaseServer
    .from("product_templates")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (tplRes.error) throw new Error(tplRes.error.message);
  if (!tplRes.data) return null;
  const templateId = (tplRes.data as { id: string }).id;

  const fieldsRes = await supabaseServer
    .from("product_template_fields")
    .select(
      `id, field_key, section:product_template_sections!inner(template_id)`,
    )
    .eq("section.template_id", templateId);
  if (fieldsRes.error) throw new Error(fieldsRes.error.message);

  const fields = (fieldsRes.data ?? []) as Array<{ id: string; field_key: string }>;
  const idByKey = new Map<string, string>();
  for (const f of fields) idByKey.set(f.field_key, f.id);
  return { templateId, idByKey };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; productId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { slug, productId } = await ctx.params;
  if (!UUID_RE.test(productId)) {
    return NextResponse.json({ error: "productId must be a UUID" }, { status: 400 });
  }
  const modelId = req.nextUrl.searchParams.get("modelId");
  if (modelId && !UUID_RE.test(modelId)) {
    return NextResponse.json({ error: "modelId must be a UUID" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await loadTemplateFieldsBySlug(slug);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 },
    );
  }
  if (!resolved) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const fieldIds = Array.from(resolved.idByKey.values());
  if (fieldIds.length === 0) {
    return NextResponse.json({ values: {} });
  }

  let q = supabaseServer
    .from("product_field_values")
    .select("field_id, model_id, value_json")
    .eq("product_id", productId)
    .in("field_id", fieldIds);
  if (modelId) q = q.eq("model_id", modelId);
  else q = q.is("model_id", null);
  const valuesRes = await q;
  if (valuesRes.error) {
    return NextResponse.json({ error: valuesRes.error.message }, { status: 500 });
  }

  /* Re-key by field_key so the client hydrates the form by stable key
     (not field_id, which changes if the template is re-seeded). */
  const idToKey = new Map<string, string>();
  for (const [key, id] of resolved.idByKey.entries()) idToKey.set(id, key);
  const byKey: Record<string, unknown> = {};
  for (const r of (valuesRes.data ?? []) as Array<{
    field_id: string;
    value_json: unknown;
  }>) {
    const key = idToKey.get(r.field_id);
    if (key) byKey[key] = r.value_json;
  }

  return NextResponse.json({ values: byKey });
}

interface PostBody {
  values?: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; productId: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { slug, productId } = await ctx.params;
  if (!UUID_RE.test(productId)) {
    return NextResponse.json({ error: "productId must be a UUID" }, { status: 400 });
  }
  const modelId = req.nextUrl.searchParams.get("modelId");
  if (modelId && !UUID_RE.test(modelId)) {
    return NextResponse.json({ error: "modelId must be a UUID" }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const incoming = body.values ?? {};
  if (typeof incoming !== "object" || incoming === null) {
    return NextResponse.json({ error: "values must be an object" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await loadTemplateFieldsBySlug(slug);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 },
    );
  }
  if (!resolved) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  /* Verify the product exists in the caller's tenant — RLS would block
     a cross-tenant write but a 404 message is more helpful than a 500. */
  const prodRes = await supabaseServer
    .from("products")
    .select("id, tenant_id")
    .eq("id", productId)
    .maybeSingle();
  if (prodRes.error) {
    return NextResponse.json({ error: prodRes.error.message }, { status: 500 });
  }
  const prod = prodRes.data as { id: string; tenant_id: string } | null;
  if (!prod) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!auth.is_super_admin && prod.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Product not in your tenant" }, { status: 403 });
  }

  /* Split incoming into upserts (non-null) vs deletes (null). Unknown
     field keys are silently ignored — sender may be on a different
     template version. */
  const upserts: Array<{
    product_id: string;
    model_id: string | null;
    field_id: string;
    value_json: unknown;
  }> = [];
  const deleteFieldIds: string[] = [];

  for (const [key, val] of Object.entries(incoming)) {
    const fieldId = resolved.idByKey.get(key);
    if (!fieldId) continue;
    if (val === null || val === undefined) {
      deleteFieldIds.push(fieldId);
    } else {
      upserts.push({
        product_id: productId,
        model_id: modelId ?? null,
        field_id: fieldId,
        value_json: val,
      });
    }
  }

  /* Upserts use the partial-unique-index target on (product_id, field_id)
     or (product_id, model_id, field_id) depending on whether model_id is
     null. PostgREST picks the matching index automatically when
     onConflict is supplied. */
  if (upserts.length > 0) {
    const onConflict = modelId
      ? "product_id,model_id,field_id"
      : "product_id,field_id";
    const upRes = await supabaseServer
      .from("product_field_values")
      .upsert(upserts, { onConflict });
    if (upRes.error) {
      return NextResponse.json({ error: upRes.error.message }, { status: 500 });
    }
  }

  if (deleteFieldIds.length > 0) {
    let delQ = supabaseServer
      .from("product_field_values")
      .delete()
      .eq("product_id", productId)
      .in("field_id", deleteFieldIds);
    delQ = modelId ? delQ.eq("model_id", modelId) : delQ.is("model_id", null);
    const delRes = await delQ;
    if (delRes.error) {
      return NextResponse.json({ error: delRes.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    upserted: upserts.length,
    deleted: deleteFieldIds.length,
  });
}
