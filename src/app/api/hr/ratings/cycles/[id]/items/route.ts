import "server-only";

/* PUT /api/hr/ratings/cycles/[id]/items — score items while the cycle is in
   `scoring`. Body: { scores: [{ item_id, score|null, comment?, evidence? }] }

   Rules (plan §C.3):
   · score NULL clears the assessment (unassessed ≠ 0);
   · a score below 30 or above 90 REQUIRES an evidence note — extreme claims
     cost a sentence, or they don't stand;
   · every write logs old→new per item (the audit habit the skills history
     stream set);
   · cycles in review/finalized/published refuse with 409 — a scorer edits
     nothing after the bell. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { logAudit } from "@/lib/server/audit";
import { clampScore } from "@/lib/skills/scoring";

const MODULE = "HR";

interface ScoreEntry {
  item_id?: string;
  score?: number | null;
  comment?: string;
  evidence?: string;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const { id: cycleId } = await params;
  const { data: cycle } = await supabaseServer
    .from("rating_cycles").select("id, tenant_id, status")
    .eq("id", cycleId).maybeSingle();
  if (!cycle || (auth.tenant_id && cycle.tenant_id !== auth.tenant_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (cycle.status !== "scoring") {
    return NextResponse.json(
      { error: `Scores are locked while the cycle is "${cycle.status}".` },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as { scores?: ScoreEntry[] } | null;
  const entries = (body?.scores ?? []).filter((e) => typeof e.item_id === "string");
  if (entries.length === 0) {
    return NextResponse.json({ error: "scores[] with item_id is required" }, { status: 400 });
  }
  if (entries.length > 500) {
    return NextResponse.json({ error: "Too many scores in one call (max 500)." }, { status: 413 });
  }

  /* validate extremes BEFORE writing anything — a batch that breaks the
     evidence rule writes nothing at all */
  for (const e of entries) {
    if (e.score === null || e.score === undefined) continue;
    const s = clampScore(Number(e.score));
    if ((s < 30 || s > 90) && !String(e.evidence ?? "").trim()) {
      return NextResponse.json(
        { error: `Score ${s} requires an evidence note.`, item_id: e.item_id },
        { status: 422 },
      );
    }
  }

  const ids = entries.map((e) => e.item_id) as string[];
  const { data: current } = await supabaseServer
    .from("rating_items").select("id, score, comment, evidence, employee_id")
    .eq("cycle_id", cycleId).in("id", ids);
  const before = new Map((current ?? []).map((r) => [r.id, r]));

  const now = new Date().toISOString();
  let updated = 0;
  const missing: string[] = [];
  for (const e of entries) {
    const itemId = e.item_id as string;
    const prev = before.get(itemId);
    if (!prev) { missing.push(itemId); continue; }
    const score = e.score === null || e.score === undefined ? null : clampScore(Number(e.score));
    const { error } = await supabaseServer
      .from("rating_items")
      .update({
        score,
        comment: typeof e.comment === "string" ? e.comment.slice(0, 1000) : prev.comment,
        evidence: typeof e.evidence === "string" ? e.evidence.slice(0, 1000) : prev.evidence,
        scored_by: score === null ? null : auth.account_id,
        scored_at: score === null ? null : now,
        updated_at: now,
      })
      .eq("id", itemId).eq("cycle_id", cycleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += 1;

    if (prev.score !== score) {
      void logAudit({
        auth, module: MODULE, action_type: "rating_scored",
        entity_type: "rating_item", entity_id: itemId,
        old_values: { score: prev.score }, new_values: { score },
        metadata: { cycle_id: cycleId, employee_id: prev.employee_id },
      });
    }
  }

  return NextResponse.json({ ok: true, updated, ...(missing.length ? { missing } : {}) });
}
