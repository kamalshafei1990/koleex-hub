import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* Position behavior requirements — the conduct template every holder of a
   position is measured against.
   GET → the template (Employees read)
   PUT → replace the set (Employees EDIT — configuring the template shapes how
         every holder is assessed).                                          */

type Params = { params: Promise<{ id: string }> };

async function positionInTenant(id: string, tenantId: string | null) {
  const { data } = await supabaseServer
    .from("koleex_positions").select("id, tenant_id, title").eq("id", id).maybeSingle();
  if (!data) return null;
  if (tenantId && data.tenant_id && data.tenant_id !== tenantId) return null;
  return data;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Employees");
  if (deny) return deny;
  const pos = await positionInTenant(id, auth.tenant_id);
  if (!pos) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("position_behavior_requirements")
    .select("id, behavior_indicator_id, required_score, weight, is_mandatory, is_critical, notes, sort_order")
    .eq("position_id", id)
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirements: data ?? [] });
}

interface ReqRow {
  behavior_indicator_id?: string;
  required_score?: number;
  weight?: number;
  is_mandatory?: boolean;
  is_critical?: boolean;
  notes?: string | null;
  sort_order?: number;
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAction(auth, "Employees", "edit");
  if (denied) return denied;
  const pos = await positionInTenant(id, auth.tenant_id);
  if (!pos) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { requirements?: ReqRow[] } | null;
  if (!body || !Array.isArray(body.requirements)) {
    return NextResponse.json({ error: "requirements array required" }, { status: 400 });
  }

  const seen = new Map<string, ReqRow>();
  for (const r of body.requirements) {
    if (!r.behavior_indicator_id || typeof r.behavior_indicator_id !== "string") continue;
    const score = Math.round(Number(r.required_score));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: `required_score out of range for ${r.behavior_indicator_id}` }, { status: 400 });
    }
    const weight = Number(r.weight ?? 1);
    if (!Number.isFinite(weight) || weight < 0) {
      return NextResponse.json({ error: `invalid weight for ${r.behavior_indicator_id}` }, { status: 400 });
    }
    seen.set(r.behavior_indicator_id, r);
  }
  const rows = [...seen.values()];

  /* Indicators must belong to this tenant — never link foreign reference data. */
  if (rows.length) {
    const { data: owned } = await supabaseServer
      .from("behavior_indicators").select("id").eq("tenant_id", auth.tenant_id)
      .in("id", rows.map((r) => r.behavior_indicator_id!));
    const ownedSet = new Set((owned ?? []).map((s) => s.id));
    if (rows.some((r) => !ownedSet.has(r.behavior_indicator_id!))) {
      return NextResponse.json({ error: "Unknown behavior indicator id" }, { status: 400 });
    }
  }

  const { error: delErr } = await supabaseServer
    .from("position_behavior_requirements").delete().eq("position_id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (rows.length) {
    const { error: insErr } = await supabaseServer.from("position_behavior_requirements").insert(
      rows.map((r, i) => ({
        tenant_id: auth.tenant_id,
        position_id: id,
        behavior_indicator_id: r.behavior_indicator_id,
        required_score: Math.round(Number(r.required_score)),
        weight: Number(r.weight ?? 1),
        is_mandatory: Boolean(r.is_mandatory),
        is_critical: Boolean(r.is_critical),
        notes: typeof r.notes === "string" && r.notes.trim() ? r.notes.trim().slice(0, 1000) : null,
        sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : i * 10,
      })),
    );
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await logAudit({
    auth, action_type: "update", module: "Employees",
    entity_type: "position_behavior", entity_id: id,
    entity_label: (pos.title as string | null) ?? null,
    new_values: { count: rows.length }, route: `/api/positions/${id}/behavior`, req,
  });
  return NextResponse.json({ ok: true, count: rows.length });
}
