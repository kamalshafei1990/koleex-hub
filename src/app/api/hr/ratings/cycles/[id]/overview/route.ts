import "server-only";

/* GET /api/hr/ratings/cycles/[id]/overview — the review/calibration read
   (plan §E.3): every summary with the employee's name, the band ladder the
   tenant runs, the extremes still missing evidence, and the mandatory gaps.

   Exists for the review state and after — in `scoring` the sheet itself
   answers those questions, so the overview 409s there. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const MODULE = "HR";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { id } = await params;
  const { data: cycle } = await supabaseServer
    .from("rating_cycles").select("id, tenant_id, status, month")
    .eq("id", id).maybeSingle();
  if (!cycle || (auth.tenant_id && cycle.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (cycle.status === "scoring" || cycle.status === "draft") {
    return NextResponse.json({ error: "The overview unlocks at review." }, { status: 409 });
  }

  const [{ data: summaries }, { data: bands }, { data: items }, { data: employees }] = await Promise.all([
    supabaseServer.from("rating_summaries").select("*").eq("cycle_id", id),
    supabaseServer.from("rating_band_config").select("band, min_score, label, color, sort")
      .eq("tenant_id", cycle.tenant_id).order("min_score"),
    supabaseServer.from("rating_items")
      .select("employee_id, score, evidence, is_mandatory, item_kind, ref_id")
      .eq("cycle_id", id),
    supabaseServer.from("koleex_employees").select("id, person:person_id(full_name)")
      .eq("tenant_id", cycle.tenant_id),
  ]);

  /* a name per employee id — one joined read, no per-row fetch */
  const nameOf = new Map<string, string>();
  for (const e of employees ?? []) {
    const p = (e as { person?: { full_name?: string } | Array<{ full_name?: string }> }).person;
    const name = Array.isArray(p) ? p[0]?.full_name : p?.full_name;
    nameOf.set((e as { id: string }).id, name ?? "—");
  }

  /* extremes without evidence — the review step's red flags */
  const extremesNoEvidence = (items ?? [])
    .filter((i) => i.score !== null && (i.score < 30 || i.score > 90) && !i.evidence?.trim())
    .map((i) => ({ employee_id: i.employee_id, employee: nameOf.get(i.employee_id) ?? "—", score: i.score, kind: i.item_kind }));

  const mandatoryGaps = new Map<string, number>();
  for (const i of items ?? []) {
    if (i.is_mandatory && i.score === null) {
      mandatoryGaps.set(i.employee_id, (mandatoryGaps.get(i.employee_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    cycle,
    bands: bands ?? [],
    summaries: (summaries ?? []).map((s) => ({ ...s, employee: nameOf.get(s.employee_id) ?? "—" })),
    extremesNoEvidence,
    mandatoryGaps: Object.fromEntries(mandatoryGaps),
  });
}
