import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { validateValueShape } from "@/lib/product-templates/validate";
import type { ProductTemplateField } from "@/lib/product-templates/types";

/* ---------------------------------------------------------------------------
   GET  /api/product-templates/[slug]/values/[productId]
   POST /api/product-templates/[slug]/values/[productId]

   Read or upsert dynamic template field values for one product
   (optionally for a single model via ?modelId=).

   Hardened in the Critical Fix Sprint:
     · Tenant boundary enforced (product.tenant_id == auth.tenant_id).
     · Module permission check via requireModuleAccess("Product Data").
     · Server-side value validation per field_type before any write.
     · Payload size cap (256 KB).
     · is_active sections + fields only.
     · Audit row written on every successful write.
   --------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE = "Product Data";
const MAX_PAYLOAD_BYTES = 262_144; // 256 KB

async function loadTemplateFieldsBySlug(slug: string) {
  /* Resolve template → active fields-by-key (with full field row so
     the validator can inspect options_json without a second fetch). */
  const tplRes = await supabaseServer
    .from("product_templates")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (tplRes.error) throw new Error(tplRes.error.message);
  if (!tplRes.data) return null;
  const templateId = (tplRes.data as { id: string }).id;

  /* Pull only fields whose parent section is also active. We join via
     PostgREST's nested filter so the round-trip count stays at 1. */
  const fieldsRes = await supabaseServer
    .from("product_template_fields")
    .select(
      `id, section_id, template_id, field_key, field_label, field_type,
       unit, placeholder, help_text, icon, sort_order, is_required,
       is_public, is_searchable, ai_readable, show_in_brochure,
       show_in_quotation, show_in_catalog, options_json, is_active,
       created_at,
       section:product_template_sections!inner(template_id, is_active)`,
    )
    .eq("section.template_id", templateId)
    .eq("section.is_active", true)
    .eq("is_active", true);
  if (fieldsRes.error) throw new Error(fieldsRes.error.message);

  const fields = (fieldsRes.data ?? []) as Array<
    ProductTemplateField & { section?: unknown }
  >;
  const fieldByKey = new Map<string, ProductTemplateField>();
  for (const f of fields) {
    const { section: _section, ...rest } = f;
    fieldByKey.set(f.field_key, rest as ProductTemplateField);
  }
  return { templateId, fieldByKey };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; productId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { slug, productId } = await ctx.params;
  if (!UUID_RE.test(productId)) {
    return NextResponse.json({ error: "productId must be a UUID" }, { status: 400 });
  }
  const modelId = req.nextUrl.searchParams.get("modelId");
  if (modelId && !UUID_RE.test(modelId)) {
    return NextResponse.json({ error: "modelId must be a UUID" }, { status: 400 });
  }

  /* Verify the product belongs to caller's tenant before exposing
     anything. SA bypasses the tenant check (cross-tenant view-as
     handles that scope explicitly). */
  const prodRes = await supabaseServer
    .from("products")
    .select("id, tenant_id, template_id")
    .eq("id", productId)
    .maybeSingle();
  if (prodRes.error) {
    return NextResponse.json({ error: prodRes.error.message }, { status: 500 });
  }
  const prod = prodRes.data as
    | { id: string; tenant_id: string; template_id: string | null }
    | null;
  if (!prod) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!auth.is_super_admin && prod.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Product not in your tenant" }, { status: 403 });
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
  const fieldIds = Array.from(resolved.fieldByKey.values()).map((f) => f.id);
  if (fieldIds.length === 0) {
    return NextResponse.json({ values: {} });
  }

  let q = supabaseServer
    .from("product_field_values")
    .select("field_id, model_id, value_json")
    .eq("product_id", productId)
    .in("field_id", fieldIds);
  q = modelId ? q.eq("model_id", modelId) : q.is("model_id", null);
  const valuesRes = await q;
  if (valuesRes.error) {
    return NextResponse.json({ error: valuesRes.error.message }, { status: 500 });
  }

  const idToKey = new Map<string, string>();
  for (const [key, field] of resolved.fieldByKey.entries()) {
    idToKey.set(field.id, key);
  }
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
  /* Pass `req` to requireAuth so non-GET requests are blocked while
     a super-admin is in view-as mode (consistent with the rest of the
     write API). */
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { slug, productId } = await ctx.params;
  if (!UUID_RE.test(productId)) {
    return NextResponse.json({ error: "productId must be a UUID" }, { status: 400 });
  }
  const modelId = req.nextUrl.searchParams.get("modelId");
  if (modelId && !UUID_RE.test(modelId)) {
    return NextResponse.json({ error: "modelId must be a UUID" }, { status: 400 });
  }

  /* Cheap pre-parse cap. content-length header isn't always present,
     so we also defensively reject huge JSON post-parse below. */
  const sizeHdr = req.headers.get("content-length");
  if (sizeHdr && Number(sizeHdr) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Payload too large (>${MAX_PAYLOAD_BYTES} bytes)` },
      { status: 413 },
    );
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read body" }, { status: 400 });
  }
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Payload too large (>${MAX_PAYLOAD_BYTES} bytes)` },
      { status: 413 },
    );
  }
  let body: PostBody;
  try {
    body = JSON.parse(raw) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const incoming = body.values ?? {};
  if (typeof incoming !== "object" || incoming === null || Array.isArray(incoming)) {
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

  /* Tenant boundary. */
  const prodRes = await supabaseServer
    .from("products")
    .select("id, tenant_id, template_id")
    .eq("id", productId)
    .maybeSingle();
  if (prodRes.error) {
    return NextResponse.json({ error: prodRes.error.message }, { status: 500 });
  }
  const prod = prodRes.data as
    | { id: string; tenant_id: string; template_id: string | null }
    | null;
  if (!prod) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!auth.is_super_admin && prod.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Product not in your tenant" }, { status: 403 });
  }

  /* Validate every incoming value against its field_type BEFORE we
     touch the DB. Unknown keys are skipped silently (template might
     have evolved since the client cached its structure). */
  const upserts: Array<{
    product_id: string;
    model_id: string | null;
    field_id: string;
    value_json: unknown;
  }> = [];
  const deleteFieldIds: string[] = [];
  const errors: Array<{ field_key: string; error: string }> = [];

  for (const [key, val] of Object.entries(incoming)) {
    const field = resolved.fieldByKey.get(key);
    if (!field) continue;
    const err = validateValueShape(field, val);
    if (err) {
      errors.push({ field_key: key, error: err });
      continue;
    }
    if (val === null || val === undefined) {
      deleteFieldIds.push(field.id);
    } else {
      upserts.push({
        product_id: productId,
        model_id: modelId ?? null,
        field_id: field.id,
        value_json: val,
      });
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: "Some values failed validation",
        details: errors,
      },
      { status: 400 },
    );
  }

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

  /* Audit log — best-effort; failure to write the audit row should
     never block a legitimate write. */
  try {
    await supabaseServer.from("koleex_security_audit").insert({
      actor_account_id: auth.real_account_id ?? auth.account_id,
      target_account_id: null,
      action: "product_field_values.write",
      details: {
        product_id: productId,
        model_id: modelId ?? null,
        template_slug: slug,
        upserted_keys: upserts.map((u) =>
          [...resolved.fieldByKey.entries()].find(([, f]) => f.id === u.field_id)?.[0] ?? u.field_id,
        ),
        deleted_keys: deleteFieldIds.map((fid) =>
          [...resolved.fieldByKey.entries()].find(([, f]) => f.id === fid)?.[0] ?? fid,
        ),
        viewing_as: auth.viewing_as,
      },
    });
  } catch {
    /* swallow — audit is informational, not authoritative */
  }

  return NextResponse.json({
    ok: true,
    upserted: upserts.length,
    deleted: deleteFieldIds.length,
  });
}
