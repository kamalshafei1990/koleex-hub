import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   POST /api/product-templates/[slug]/visual-map

   Saves the VISUAL mapping for ONE template field — the icon/photo bound to
   the field itself and to each of its values. We never touch product data
   here; only the template structure's `options_json`.

   Storage convention (no schema change needed):
     options_json = {
       field_icon_url?:  string,   // icon shown for the field
       field_photo_url?: string,   // optional real photo for the field
       options?: [{ value, label, icon?, image? }]   // per-value visuals
       ...any existing keys (item_schema, card_schema) preserved
     }

   Body: { field_id: uuid, options_json: object }
   Gated by Product Data module access. Writes a best-effort audit row.
   --------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE = "Product Data";
const MAX_PAYLOAD_BYTES = 262_144; // 256 KB

interface PostBody {
  field_id?: string;
  options_json?: Record<string, unknown> | null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { slug } = await ctx.params;

  const sizeHdr = req.headers.get("content-length");
  if (sizeHdr && Number(sizeHdr) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: PostBody;
  try {
    const raw = await req.text();
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    body = JSON.parse(raw) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fieldId = body.field_id;
  if (!fieldId || !UUID_RE.test(fieldId)) {
    return NextResponse.json({ error: "field_id must be a UUID" }, { status: 400 });
  }
  const optionsJson = body.options_json;
  if (optionsJson !== null && (typeof optionsJson !== "object" || Array.isArray(optionsJson))) {
    return NextResponse.json({ error: "options_json must be an object or null" }, { status: 400 });
  }

  /* Resolve the template by slug, then verify the field actually belongs to
     it (the field row carries a denormalized template_id). This stops a
     caller from editing fields outside the addressed template. */
  const tplRes = await supabaseServer
    .from("product_templates")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (tplRes.error) {
    return NextResponse.json({ error: tplRes.error.message }, { status: 500 });
  }
  const template = tplRes.data as { id: string } | null;
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const fieldRes = await supabaseServer
    .from("product_template_fields")
    .select("id, template_id, field_key")
    .eq("id", fieldId)
    .maybeSingle();
  if (fieldRes.error) {
    return NextResponse.json({ error: fieldRes.error.message }, { status: 500 });
  }
  const field = fieldRes.data as { id: string; template_id: string; field_key: string } | null;
  if (!field || field.template_id !== template.id) {
    return NextResponse.json({ error: "Field not in this template" }, { status: 404 });
  }

  const upd = await supabaseServer
    .from("product_template_fields")
    .update({ options_json: optionsJson })
    .eq("id", fieldId);
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }

  try {
    await supabaseServer.from("koleex_security_audit").insert({
      actor_account_id: auth.real_account_id ?? auth.account_id,
      target_account_id: null,
      action: "product_template_fields.visual_map",
      details: { template_slug: slug, field_id: fieldId, field_key: field.field_key, viewing_as: auth.viewing_as },
    });
  } catch {
    /* audit is informational */
  }

  return NextResponse.json({ ok: true });
}
