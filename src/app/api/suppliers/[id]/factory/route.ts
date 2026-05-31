import "server-only";

/* ---------------------------------------------------------------------------
   PUT /api/suppliers/[id]/factory — upsert the supplier factory profile
   (supplier_factory_profile, 1:1 with the supplier contacts row).

   Whitelisted, tenant-scoped, Suppliers-module gated, section-level save.
   Numbers/arrays are coerced/validated; unknown keys are ignored.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { recordSectionEdits } from "@/lib/suppliers/section-audit";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

const NUM_FIELDS = new Set([
  "employee_count", "qc_staff_count", "rd_staff_count", "production_lines",
  "monthly_capacity", "annual_output", "factory_size_sqm", "export_percentage",
  "lead_time_days",
]);
const TEXT_FIELDS = new Set([
  "factory_name", "factory_type", "capacity_unit", "output_unit", "notes",
]);
const BOOL_FIELDS = new Set([
  "odm_supported", "private_label_supported", "low_moq_supported",
]);
const ARRAY_FIELDS = new Set([
  "peak_season_months", "main_export_markets", "production_categories", "supported_materials",
]);
const FACTORY_TYPES = new Set([
  "own_factory", "partner_factory", "contract_manufacturer", "trading_only", "multiple",
]);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
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

  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (NUM_FIELDS.has(k)) {
      if (v === "" || v === null || v === undefined) { row[k] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `Invalid number for ${k}` }, { status: 400 });
      }
      row[k] = n;
    } else if (TEXT_FIELDS.has(k)) {
      const t = typeof v === "string" ? v.trim() : "";
      row[k] = t || null;
    } else if (BOOL_FIELDS.has(k)) {
      row[k] = v === true ? true : v === false ? false : null;
    } else if (ARRAY_FIELDS.has(k)) {
      row[k] = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    }
  }
  if (row.factory_type && !FACTORY_TYPES.has(String(row.factory_type))) {
    return NextResponse.json({ error: "Invalid factory_type" }, { status: 400 });
  }
  if (
    row.export_percentage != null &&
    (Number(row.export_percentage) < 0 || Number(row.export_percentage) > 100)
  ) {
    return NextResponse.json({ error: "export_percentage must be 0–100" }, { status: 400 });
  }
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }

  // Verify the supplier belongs to this tenant.
  const { data: sup } = await supabaseServer
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("contact_type", "supplier")
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { error } = await supabaseServer
    .from("supplier_factory_profile")
    .upsert(
      {
        tenant_id: tid,
        supplier_id: id,
        ...row,
        updated_by: auth.account_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,supplier_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSupplierEvent({
    tenant_id: tid, supplier_id: id,
    event_type: "factory_updated", event_category: "factory",
    title: "Factory profile updated",
    actor_id: auth.account_id ?? null, actor_name: actorName(auth),
    source_module: "suppliers", visibility_tier: "internal",
    related_entity_type: "supplier_factory_profile",
  });

  await recordSectionEdits({
    tenantId: tid, supplierId: id, depts: ["quality"],
    accountId: auth.account_id ?? null, accountName: actorName(auth),
  });

  return NextResponse.json({ ok: true });
}
