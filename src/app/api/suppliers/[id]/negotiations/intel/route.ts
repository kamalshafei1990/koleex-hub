import "server-only";

/* ---------------------------------------------------------------------------
   PUT /api/suppliers/[id]/negotiations/intel — upsert the negotiation scorecard.

   Builds on the Phase-1 Foundation supplier_negotiation_intel (1:1): flexibility
   levels, negotiation difficulty, a 0–100 negotiation score, preferred tactics +
   leverage points (jsonb arrays), and internal notes. Whitelisted, tenant +
   supplier scoped, Suppliers-module gated, blocked while viewing-as. Most
   sensitive negotiation intelligence.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const LEVEL3 = new Set(["low", "medium", "high"]);
const LEVEL_FIELDS = new Set([
  "price_flexibility", "moq_flexibility", "payment_flexibility", "communication_flexibility",
  "customization_openness", "exclusivity_openness", "negotiation_difficulty", "sample_turnaround_speed",
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
    if (LEVEL_FIELDS.has(k)) {
      if (v === "" || v == null) { row[k] = null; continue; }
      if (!LEVEL3.has(String(v))) return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
      row[k] = v;
    } else if (k === "negotiation_score") {
      if (v === "" || v == null) { row[k] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: "negotiation_score must be 0–100" }, { status: 400 });
      row[k] = n;
    } else if (k === "preferred_tactics" || k === "leverage_points") {
      row[k] = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    } else if (k === "internal_notes") {
      row[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    }
  }
  if (Object.keys(row).length === 0) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });

  const { data: sup } = await supabaseServer
    .from("contacts").select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { error } = await supabaseServer
    .from("supplier_negotiation_intel")
    .upsert(
      { tenant_id: tid, supplier_id: id, ...row, assessed_by_account_id: auth.account_id ?? null, assessed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,supplier_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
