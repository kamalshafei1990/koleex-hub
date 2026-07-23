import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";

/* Position skill requirements — the template every employee in this position
   is measured against.

   GET  → requirements for the position (Employees module read)
   PUT  → replace the requirement set (Employees module EDIT — configuring a
          template shapes how every holder of the position is scored, so it
          is an edit-grade action, not a read).                              */

type Params = { params: Promise<{ id: string }> };

async function positionInTenant(id: string, tenantId: string | null) {
  const { data } = await supabaseServer
    .from("koleex_positions")
    .select("id, tenant_id, title")
    .eq("id", id)
    .maybeSingle();
  /* Legacy rows predate the tenant column — NULL is in-tenant, same rule the
     employees route follows. */
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
    .from("position_skill_requirements")
    .select("id, skill_id, required_score, weight, is_mandatory, notes, sort_order")
    .eq("position_id", id)
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirements: data ?? [] });
}

interface ReqRow {
  skill_id?: string;
  required_score?: number;
  weight?: number;
  is_mandatory?: boolean;
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

  /* Server-side validation mirrors the DB checks so a bad payload fails with
     a readable message instead of a constraint error. Dedup by skill_id —
     last one wins — because the UNIQUE(position_id, skill_id) would otherwise
     abort the whole replace. */
  const seen = new Map<string, ReqRow>();
  for (const r of body.requirements) {
    if (!r.skill_id || typeof r.skill_id !== "string") continue;
    const score = Math.round(Number(r.required_score));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: `required_score out of range for skill ${r.skill_id}` }, { status: 400 });
    }
    const weight = Number(r.weight ?? 1);
    if (!Number.isFinite(weight) || weight < 0) {
      return NextResponse.json({ error: `invalid weight for skill ${r.skill_id}` }, { status: 400 });
    }
    seen.set(r.skill_id, r);
  }
  const rows = [...seen.values()];

  /* Skills must belong to this tenant — a foreign skill id would otherwise
     link cross-tenant reference data into this template. */
  if (rows.length) {
    const { data: owned } = await supabaseServer
      .from("skills")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .in("id", rows.map((r) => r.skill_id!));
    const ownedSet = new Set((owned ?? []).map((s) => s.id));
    const foreign = rows.filter((r) => !ownedSet.has(r.skill_id!));
    if (foreign.length) {
      return NextResponse.json({ error: "Unknown skill id in payload" }, { status: 400 });
    }
  }

  /* Replace-set: delete then insert inside the request. The set is small
     (a position carries dozens of requirements, not thousands). */
  const { error: delErr } = await supabaseServer
    .from("position_skill_requirements")
    .delete()
    .eq("position_id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (rows.length) {
    const { error: insErr } = await supabaseServer.from("position_skill_requirements").insert(
      rows.map((r, i) => ({
        tenant_id: auth.tenant_id,
        position_id: id,
        skill_id: r.skill_id,
        required_score: Math.round(Number(r.required_score)),
        weight: Number(r.weight ?? 1),
        is_mandatory: Boolean(r.is_mandatory),
        notes: typeof r.notes === "string" && r.notes.trim() ? r.notes.trim().slice(0, 1000) : null,
        sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : i * 10,
      })),
    );
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  await logAudit({
    auth,
    action_type: "update",
    module: "Employees",
    entity_type: "position_skills",
    entity_id: id,
    entity_label: (pos.title as string | null) ?? null,
    new_values: { count: rows.length },
    route: `/api/positions/${id}/skills`,
    req,
  });

  return NextResponse.json({ ok: true, count: rows.length });
}
