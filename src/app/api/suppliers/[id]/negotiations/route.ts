import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/negotiations — log a negotiation round.

   Negotiation memory: concessions, leverage, red flags, behavior. Sensitive —
   default management visibility. Emits a visibility-aware timeline event
   (agreement_reached when an outcome is recorded, else negotiation_round).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

const TEXT = new Set([
  "topic", "outcome", "price_concession", "moq_concession", "payment_terms_concession",
  "leverage_notes", "red_flags", "behavior_notes",
]);
const BOOL = new Set(["exclusivity_discussed", "territory_discussed"]);
const VIS = new Set(["public", "internal", "procurement", "finance", "management"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (TEXT.has(k)) row[k] = typeof v === "string" && v.trim() ? v.trim() : null;
    else if (BOOL.has(k)) row[k] = v === true;
  }
  if (body.round_no != null && Number.isFinite(Number(body.round_no))) row.round_no = Math.round(Number(body.round_no));
  if (body.discount_pct != null && body.discount_pct !== "") {
    const n = Number(body.discount_pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: "discount_pct must be 0–100" }, { status: 400 });
    row.discount_pct = n;
  }
  if (typeof body.occurred_on === "string" && body.occurred_on) row.occurred_on = body.occurred_on;
  const visibility = typeof body.visibility_tier === "string" && VIS.has(body.visibility_tier) ? body.visibility_tier : "management";

  const { data: sup } = await supabaseServer
    .from("contacts").select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("supplier_negotiation_rounds")
    .insert({ tenant_id: tid, supplier_id: id, ...row, topic, visibility_tier: visibility, created_by: auth.account_id ?? null })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hasOutcome = typeof body.outcome === "string" && body.outcome.trim();
  await logSupplierEvent({
    tenant_id: tid, supplier_id: id,
    event_type: hasOutcome ? "agreement_reached" : "negotiation_round",
    event_category: "procurement",
    title: hasOutcome ? `Agreement reached: ${topic}` : `Negotiation round: ${topic}`,
    description: hasOutcome ? String(body.outcome).slice(0, 280) : null,
    actor_id: auth.account_id ?? null, actor_name: actorName(auth),
    source_module: "suppliers", visibility_tier: visibility,
    related_entity_id: data?.id ?? null, related_entity_type: "supplier_negotiation_rounds",
  });

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
