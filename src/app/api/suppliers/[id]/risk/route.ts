import "server-only";

/* ---------------------------------------------------------------------------
   PUT /api/suppliers/[id]/risk — upsert the supplier risk profile (1:1).

   Builds on the Phase-1 Foundation supplier_risk_profile scorecard: level-based
   qualitative scoring (risk_level, dependency_level, stability/quality levels),
   trust level, backup-supplier flag, a 0–100 internal evaluation score, and
   assessment notes. Whitelisted, tenant + supplier scoped, Suppliers-module
   gated, blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const LEVEL4 = new Set(["low", "medium", "high", "critical"]);   // risk_level, dependency_level
const LEVEL3 = new Set(["low", "medium", "high"]);               // stability/quality/trust
const LEVEL_FIELDS = new Set([
  "financial_stability", "delivery_stability", "quality_stability",
  "communication_quality", "response_speed", "negotiation_flexibility", "trust_level",
]);

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "risk_level" || k === "dependency_level") {
      if (v === "" || v == null) { row[k] = null; continue; }
      if (!LEVEL4.has(String(v))) return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
      row[k] = v;
    } else if (LEVEL_FIELDS.has(k)) {
      if (v === "" || v == null) { row[k] = null; continue; }
      if (!LEVEL3.has(String(v))) return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
      row[k] = v;
    } else if (k === "backup_supplier_exists") {
      row[k] = v === true;
    } else if (k === "internal_evaluation_score") {
      if (v === "" || v == null) { row[k] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: "internal_evaluation_score must be 0–100" }, { status: 400 });
      row[k] = n;
    } else if (k === "assessment_notes") {
      row[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    }
  }
  if (Object.keys(row).length === 0) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });

  const { data: sup } = await supabaseServer
    .from("contacts").select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { error } = await supabaseServer
    .from("supplier_risk_profile")
    .upsert(
      { tenant_id: tid, supplier_id: id, ...row, last_assessed_by: auth.account_id ?? null, last_assessed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,supplier_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
