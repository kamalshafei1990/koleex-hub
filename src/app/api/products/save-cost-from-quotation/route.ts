import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   POST /api/products/save-cost-from-quotation

   P5 (write) — "Save Cost to Product Data" from the quotation cost panel.

   Stores ONLY the Head Cost (RMB) on product_models.cost_price — never the
   complete-set figure (Stand & Table is a separate product concern). Every
   cost create/change appends a permanent product_cost_history row.

   Behaviour
   ─────────
   • Model found (tenant-scoped, order model_name → primary_model →
     reference_model, case-insensitive EXACT):
        - If the stored cost is non-null AND differs AND the caller did not
          send `overwrite:true` → return { status:"needs_confirm", currentCost }
          so the UI can ask before changing a real cost.
        - Otherwise set cost_price = headCostRmb (+ provenance columns).
        - Fill-only: description set only if currently empty; photo added only
          if the product has no image yet. Existing data is never overwritten.
        - Append history (initial when previous was null, else updated).
   • Model NOT found → create a DRAFT product (+ model, + media, + history):
        status='draft', visible=false, created_source='quotation_module',
        system-generated slug/sku, classification slugs default to a safe
        'uncategorized' sentinel so the record is valid and reviewable.

   Multi-tenant: tenant from session; all lookups/writes scoped to it.
   View-as: requireAuth(req) blocks this POST while a super-admin is viewing
   as another user. Requires Product Data access.

   Does NOT touch quotations, invoices, customers, or PDF generation.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

function escapeLike(s: string): string {
  return s.replace(/([\\%_])/g, "\\$1");
}
function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "model";
}

type FoundModel = {
  id: string;
  product_id: string;
  cost_price: number | null;
  product: { id: string; description: string | null; tenant_id: string } | null;
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    model?: string;
    headCostRmb?: number;
    description?: string;
    photo?: string;
    productName?: string;
    quotationId?: string;
    overwrite?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = (body.model || "").trim();
  const headCost = Number(body.headCostRmb);
  if (!model) return NextResponse.json({ error: "Missing model" }, { status: 400 });
  if (!Number.isFinite(headCost) || headCost < 0) {
    return NextResponse.json({ error: "Invalid headCostRmb" }, { status: 400 });
  }

  const tenantId = auth.tenant_id;
  const userId = auth.account_id;
  const userName = auth.username;
  const pattern = escapeLike(model);

  // ── 1. Tenant-scoped exact lookup: model_name → primary_model → reference_model
  let found: FoundModel | null = null;
  for (const col of ["model_name", "primary_model", "reference_model"] as const) {
    const { data, error } = await supabaseServer
      .from("product_models")
      .select("id, product_id, cost_price, product:products!inner(id, description, tenant_id)")
      .eq("products.tenant_id", tenantId)
      .ilike(col, pattern)
      .limit(1);
    if (error) {
      console.error("[save-cost] lookup", col, error.message);
      return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
    }
    const row = (data?.[0] as unknown as FoundModel | undefined) ?? null;
    if (row) { found = row; break; }
  }

  const nowIso = new Date().toISOString();

  // ── 2a. EXISTING model → update head cost (with overwrite guard) + fill-only meta
  if (found) {
    const prev = found.cost_price;
    const changed = prev === null || Number(prev) !== headCost;

    if (prev !== null && Number(prev) !== headCost && !body.overwrite) {
      return NextResponse.json({ status: "needs_confirm", currentCost: prev });
    }

    if (changed) {
      const { error: upErr } = await supabaseServer
        .from("product_models")
        .update({
          cost_price: headCost,
          cost_source: "quotation_module",
          cost_updated_at: nowIso,
          cost_updated_by: userId,
          cost_updated_by_name: userName,
        })
        .eq("id", found.id);
      if (upErr) {
        console.error("[save-cost] update", upErr.message);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      await supabaseServer.from("product_cost_history").insert({
        product_id: found.product_id,
        model_id: found.id,
        model_number: model,
        previous_head_cost: prev,
        new_head_cost: headCost,
        change_type: prev === null ? "initial" : "updated",
        source: "quotation_module",
        quotation_id: body.quotationId || null,
        user_id: userId,
        user_name: userName,
        tenant_id: tenantId,
      });
    }

    // Fill-only description (never overwrite a non-empty one).
    if (body.description && !(found.product?.description || "").trim()) {
      await supabaseServer
        .from("products")
        .update({ description: body.description })
        .eq("id", found.product_id);
    }
    // Add photo only if the product has no image yet.
    if (body.photo) {
      const { data: existingImg } = await supabaseServer
        .from("product_media")
        .select("id")
        .eq("product_id", found.product_id)
        .limit(1);
      if (!existingImg || existingImg.length === 0) {
        await supabaseServer.from("product_media").insert({
          product_id: found.product_id,
          model_id: found.id,
          url: body.photo,
          type: "image",
          role: "gallery",
        });
      }
    }

    return NextResponse.json({
      status: "linked",
      changed,
      modelId: found.id,
      productId: found.product_id,
    });
  }

  // ── 2b. NEW model → create a complete, valid DRAFT product graph
  const base = slugify(model);
  const suffix = nowIso.replace(/\D/g, "").slice(-6); // deterministic-enough uniqueness
  const productName = (body.productName || model).trim() || model;

  const { data: prod, error: prodErr } = await supabaseServer
    .from("products")
    .insert({
      product_name: productName,
      slug: `${base}-${suffix}`,
      division_slug: "uncategorized",
      category_slug: "uncategorized",
      subcategory_slug: "uncategorized",
      description: body.description || null,
      status: "draft",
      visible: false,
      tenant_id: tenantId,
    })
    .select("id")
    .single();
  if (prodErr || !prod) {
    console.error("[save-cost] create product", prodErr?.message);
    return NextResponse.json({ error: prodErr?.message || "Create failed" }, { status: 500 });
  }

  const { data: pm, error: pmErr } = await supabaseServer
    .from("product_models")
    .insert({
      product_id: prod.id,
      model_name: model,
      primary_model: model,
      slug: `${base}-${suffix}`,
      sku: model,
      cost_price: headCost,
      cost_source: "quotation_module",
      cost_updated_at: nowIso,
      cost_updated_by: userId,
      cost_updated_by_name: userName,
      created_source: "quotation_module",
      status: "draft",
      visible: false,
    })
    .select("id")
    .single();
  if (pmErr || !pm) {
    console.error("[save-cost] create model", pmErr?.message);
    return NextResponse.json({ error: pmErr?.message || "Create model failed" }, { status: 500 });
  }

  if (body.photo) {
    await supabaseServer.from("product_media").insert({
      product_id: prod.id,
      model_id: pm.id,
      url: body.photo,
      type: "image",
      role: "gallery",
    });
  }

  await supabaseServer.from("product_cost_history").insert({
    product_id: prod.id,
    model_id: pm.id,
    model_number: model,
    previous_head_cost: null,
    new_head_cost: headCost,
    change_type: "initial",
    source: "quotation_module",
    quotation_id: body.quotationId || null,
    user_id: userId,
    user_name: userName,
    tenant_id: tenantId,
  });

  return NextResponse.json({ status: "new", modelId: pm.id, productId: prod.id });
}
