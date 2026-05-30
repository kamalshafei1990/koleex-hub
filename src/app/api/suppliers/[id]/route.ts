import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/suppliers/[id] — Supplier 360.

   Returns the supplier (contacts row) plus everything linked to it:
   purchase orders, vendor bills, payments, and products supplied. Each
   linked dataset is fetched INDEPENDENTLY and fault-tolerantly — if a table
   or column doesn't exist in this deployment, that slice degrades to an
   empty array instead of failing the whole page. All queries are tenant
   scoped; access requires the Suppliers module.

   Response:
     200 { supplier, purchaseOrders[], bills[], payments[], products[] }
     401 { error } · 403 { error } · 404 { error } · 500 { error }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { computeReadiness } from "@/lib/suppliers/intelligence";

type Row = Record<string, unknown>;

/* Best-effort fetch: never throws. A missing table/column (or any query
   error) resolves to [] so one broken slice can't break the 360 page. */
async function safe(build: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  try {
    const r = await build();
    if (!r || r.error || !Array.isArray(r.data)) return [];
    return r.data as Row[];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  const { data: supplier, error: supErr } = await supabaseServer
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (supErr) {
    console.error("[api/suppliers/:id]", supErr.message);
    return NextResponse.json({ error: "Failed to load supplier" }, { status: 500 });
  }
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const [purchaseOrders, bills, payments, products, receipts, returns, classifications, contactPersons, media, statusHistory, factoryRows] = await Promise.all([
    safe(() =>
      supabaseServer
        .from("purchase_orders")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("vendor_bills")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("finance_payments")
        .select("*")
        .eq("tenant_id", tid)
        .eq("party_type", "supplier")
        .eq("party_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("products")
        .select("id, name, primary_model, photo_url, slug, supplier_id")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("purchase_receipts")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("returns")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    // ── Supplier Intelligence (contacts-keyed) ──
    safe(() =>
      supabaseServer
        .from("supplier_classifications")
        .select("classification, is_primary")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(50),
    ),
    safe(() =>
      supabaseServer
        .from("supplier_contact_persons")
        .select("id, full_name, role, role_category, is_primary, is_decision_maker, email, mobile, wechat_id, whatsapp")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .eq("is_active", true)
        .limit(100),
    ),
    // Governed media — public/internal/procurement only (never finance/management here)
    safe(() =>
      supabaseServer
        .from("supplier_media")
        .select("id, media_class, category, title, file_url, preview_url, visibility, expiry_date, lifecycle_status, is_primary")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .is("deleted_at", null)
        .in("visibility", ["public", "internal", "procurement"])
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("supplier_status_history")
        .select("from_status, to_status, changed_at")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .order("changed_at", { ascending: false })
        .limit(20),
    ),
    safe(() =>
      supabaseServer
        .from("supplier_factory_profile")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(1),
    ),
  ]);

  const factory = factoryRows[0] ?? null;

  const readiness = computeReadiness({
    supplier: supplier as Record<string, unknown>,
    classifications: classifications.length,
    contactPersons: contactPersons.length,
    media: media.length,
    purchaseOrders: purchaseOrders.length,
    bills: bills.length,
    receipts: receipts.length,
    factory,
  });

  return NextResponse.json(
    {
      supplier,
      purchaseOrders,
      bills,
      payments,
      products,
      receipts,
      returns,
      classifications,
      contactPersons,
      media,
      statusHistory,
      factory,
      readiness,
    },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  );
}

/* ---------------------------------------------------------------------------
   PATCH /api/suppliers/[id] — edit supplier intelligence (scalar fields).

   Whitelisted, tenant-scoped, Suppliers-module gated. Writes only the
   intelligence/commercial scalars that live on the contacts row. Changing
   strategic_status stamps strategic_status_since and appends an immutable
   supplier_status_history row (operational audit trail). Sensitive
   management-tier reasons are accepted but never returned to public surfaces.
   --------------------------------------------------------------------------- */

const PATCHABLE_FIELDS = new Set<string>([
  "strategic_status",
  "strategic_status_reason",
  "blacklist_reason",
  "supports_oem_branding",
  "supports_packaging_customization",
  "supports_spare_parts",
  "supports_samples",
  "sample_turnaround_days",
  "wecom_support_available",
  "wechat_sales_group_available",
  "wechat_official_account",
  // commercial scalars (reused existing contacts columns)
  "payment_terms",
  "currency",
  "moq",
  "lead_time",
  "incoterms",
]);

const STRATEGIC_STATUSES = new Set([
  "strategic", "preferred", "approved", "trial", "inactive", "blocked", "blacklisted",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Build a whitelisted patch.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (PATCHABLE_FIELDS.has(k)) patch[k] = v === "" ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }
  if (
    typeof patch.strategic_status === "string" &&
    patch.strategic_status &&
    !STRATEGIC_STATUSES.has(patch.strategic_status)
  ) {
    return NextResponse.json({ error: "Invalid strategic_status" }, { status: 400 });
  }

  // Load current supplier (tenant + supplier scoped) for status-change detection.
  const { data: current, error: curErr } = await supabaseServer
    .from("contacts")
    .select("id, strategic_status")
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("contact_type", "supplier")
    .maybeSingle();
  if (curErr) return NextResponse.json({ error: "Failed to load supplier" }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const statusChanged =
    "strategic_status" in patch && patch.strategic_status !== (current as Row).strategic_status;
  if (statusChanged) patch.strategic_status_since = new Date().toISOString();

  const { error: updErr } = await supabaseServer
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tid);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Append an immutable status-history event on transition.
  if (statusChanged && typeof patch.strategic_status === "string" && patch.strategic_status) {
    try {
      await supabaseServer.from("supplier_status_history").insert({
        tenant_id: tid,
        supplier_id: id,
        from_status: (current as Row).strategic_status ?? null,
        to_status: patch.strategic_status,
        reason: typeof patch.strategic_status_reason === "string" ? patch.strategic_status_reason : null,
        changed_by: auth.account_id ?? null,
      });
    } catch {
      /* history is best-effort; the status update already succeeded */
    }
  }

  return NextResponse.json({ ok: true });
}
