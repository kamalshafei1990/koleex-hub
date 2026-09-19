import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   /api/product-models/[id] — P0-A model writes.

   PATCH  — update one model (Product Data / SA only).
   DELETE — delete one model (Product Data / SA only).

   Reads live on /api/product-models (list + summary, secret-stripped).
   Part of the P0 security lockdown: gives the admin UI a server path for
   model writes so direct browser table access can be removed (P0-B) and
   RLS locked to service-role-only (P0-C).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductCostAccess, MODEL_COST_FIELDS, requireProductDataAction } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Every column the admin form may legitimately write. Anything else in the
   body is dropped — PATCH used to be an unvalidated passthrough straight
   into .update(), which is how a client with a stripped read could NULL
   whole override columns it never saw. */
const WRITABLE_MODEL_COLUMNS = new Set([
  "product_id", "model_name", "slug", "sku", "tagline", "supplier",
  "reference_model", "cost_price", "pricing_mode", "price_note",
  "global_price", "supports_head_only", "supports_complete_set",
  "head_only_price", "complete_set_price", "weight", "net_weight", "cbm",
  "carton_dimensions", "packing_type", "box_include", "extra_accessories",
  "container_20ft_qty", "container_40ft_qty", "container_40hq_qty",
  "stock_status", "supplier_overrides", "specs_overrides", "order",
  "visible", "status", "moq", "lead_time", "barcode", "primary_model",
  "code_prefix", "coding_status", "name_i18n", "tagline_i18n",
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid model id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;

  /* Optimistic lock: the client sends the updated_at it LOADED. If the row
     has moved since, refuse — a stale tab must never silently overwrite a
     newer save (the second family-override loss mode, 2026-08-21). */
  const expected = typeof body._expected_updated_at === "string" ? body._expected_updated_at : null;
  delete body._expected_updated_at;

  for (const k of Object.keys(body)) {
    if (!WRITABLE_MODEL_COLUMNS.has(k)) delete body[k];
  }
  /* An editor without cost access never RECEIVED the cost columns, so any
     cost key in their payload is empty/forged — writing it would destroy a
     real override. Strip server-side; never trust the client here. */
  if (!(await hasProductCostAccess(auth))) {
    for (const k of MODEL_COST_FIELDS) delete body[k];
  }
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  let query = supabaseServer.from("product_models").update(body).eq("id", id);
  if (expected) query = query.eq("updated_at", expected);
  const { data, error } = await query.select("id, updated_at");
  if (error) {
    console.error("[api/product-models PATCH]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  if (!data?.length) {
    if (expected) {
      /* Row exists but updated_at moved → concurrent edit. */
      const { data: still } = await supabaseServer
        .from("product_models").select("id").eq("id", id).maybeSingle();
      if (still) {
        return NextResponse.json(
          { error: "This model was changed by someone else since you opened it. Reload the product and re-apply your edit.", conflict: true },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, updated_at: (data[0] as { updated_at?: string }).updated_at ?? null });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "delete");
  if (denied) return denied;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid model id" }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from("product_models")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[api/product-models DELETE]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
