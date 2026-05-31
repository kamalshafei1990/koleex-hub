import "server-only";

/* ---------------------------------------------------------------------------
   PUT /api/suppliers/[id]/sourcing — upsert the sourcing override profile.

   The sourcing score itself is COMPUTED from existing signals (risk / readiness
   / negotiation / certs) in GET; this persists the optional human override +
   sourcing priority + sourcing/diversification notes. Whitelisted, tenant +
   supplier scoped, Suppliers-module gated, blocked while viewing-as.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

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
  if ("sourcing_score_override" in body) {
    const v = body.sourcing_score_override;
    if (v === "" || v == null) row.sourcing_score_override = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: "sourcing_score_override must be 0–100" }, { status: 400 });
      row.sourcing_score_override = Math.round(n);
    }
  }
  if ("sourcing_priority" in body) {
    const v = body.sourcing_priority;
    row.sourcing_priority = v === "" || v == null ? null : Math.round(Number(v));
  }
  if ("sourcing_notes" in body) row.sourcing_notes = typeof body.sourcing_notes === "string" && body.sourcing_notes.trim() ? body.sourcing_notes.trim() : null;
  if ("diversification_note" in body) row.diversification_note = typeof body.diversification_note === "string" && body.diversification_note.trim() ? body.diversification_note.trim() : null;

  if (Object.keys(row).length === 0) return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });

  const { data: sup } = await supabaseServer
    .from("contacts").select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { error } = await supabaseServer
    .from("supplier_sourcing_profile")
    .upsert(
      { tenant_id: tid, supplier_id: id, ...row, updated_by: auth.account_id ?? null, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,supplier_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
