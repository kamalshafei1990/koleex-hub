import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/[id]/review
   GET   → deterministic recommendation (from Quality + DNA + Governance +
           duplicate + collections), current review record, checklist + scores,
           comments. Compute-on-read; never recalculates the whole library.
   PATCH → record a review decision + checklist scores + replacement + notes;
           recomputes approval_score/risk/production_ready and logs to history.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { computeReview } from "@/lib/visual-library/review";
import { logVisualAssetEvent } from "@/lib/visual-library/events";
import { REVIEW_STATUSES, REVIEW_PRIORITIES } from "@/lib/visual-library/types";

const STATUS = new Set<string>(REVIEW_STATUSES);
const PRIORITY = new Set<string>(REVIEW_PRIORITIES);

async function gatherSignals(tid: string, id: string) {
  const [{ data: asset }, { data: quality }, { data: dna }, { data: forbidden }, { data: cols }, { data: rels }] = await Promise.all([
    supabaseServer.from("visual_assets").select("id, title, approval_status, status, svg_path, semantic_meaning").eq("id", id).eq("tenant_id", tid).maybeSingle(),
    supabaseServer.from("visual_asset_quality").select("quality_score, duplicate_risk_score, readability_score, dark_mode_score").eq("asset_id", id).maybeSingle(),
    supabaseServer.from("asset_dna_analysis").select("overall_score").eq("asset_id", id).maybeSingle(),
    supabaseServer.from("visual_context_rules").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("entity_type", "asset").eq("entity_id", id).eq("rule", "forbidden"),
    supabaseServer.from("visual_collection_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("asset_id", id),
    supabaseServer.from("visual_asset_relationships").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("source_asset_id", id),
  ]);
  return { asset, quality, dna, forbiddenCount: forbidden as unknown as { count?: number }, colsCount: (cols as unknown as { count?: number }), relsCount: (rels as unknown as { count?: number }) };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  const sig = await gatherSignals(tid, id);
  if (!sig.asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reco = computeReview({
    asset: sig.asset as never,
    quality: (sig.quality?.quality_score as number) ?? null,
    dna: (sig.dna?.overall_score as number) ?? null,
    duplicateRisk: (sig.quality?.duplicate_risk_score as number) ?? null,
    readability: (sig.quality?.readability_score as number) ?? null,
    darkMode: (sig.quality?.dark_mode_score as number) ?? null,
    governanceForbidden: sig.forbiddenCount?.count ?? 0,
    collectionsCount: sig.colsCount?.count ?? 0,
    relationshipsCount: sig.relsCount?.count ?? 0,
  });

  const [{ data: review }, { data: checklists }] = await Promise.all([
    supabaseServer.from("visual_asset_reviews").select("*").eq("asset_id", id).eq("tenant_id", tid).maybeSingle(),
    supabaseServer.from("visual_review_checklists").select("*").eq("tenant_id", tid).order("sort_order", { ascending: true }),
  ]);

  let scores: unknown[] = [], comments: unknown[] = [];
  if (review?.id) {
    const [{ data: sc }, { data: cm }] = await Promise.all([
      supabaseServer.from("visual_review_scores").select("*").eq("review_id", review.id),
      supabaseServer.from("visual_review_comments").select("id, user_name, comment, comment_type, created_at").eq("review_id", review.id).order("created_at", { ascending: true }),
    ]);
    scores = sc ?? []; comments = cm ?? [];
  }

  return NextResponse.json({ recommendation: reco, review: review ?? null, checklists: checklists ?? [], scores, comments });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const sig = await gatherSignals(tid, id);
  if (!sig.asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const reco = computeReview({
    asset: sig.asset as never,
    quality: (sig.quality?.quality_score as number) ?? null, dna: (sig.dna?.overall_score as number) ?? null,
    duplicateRisk: (sig.quality?.duplicate_risk_score as number) ?? null,
    readability: (sig.quality?.readability_score as number) ?? null, darkMode: (sig.quality?.dark_mode_score as number) ?? null,
    governanceForbidden: sig.forbiddenCount?.count ?? 0, collectionsCount: sig.colsCount?.count ?? 0, relationshipsCount: sig.relsCount?.count ?? 0,
  });

  const status = typeof body.review_status === "string" && STATUS.has(body.review_status) ? body.review_status : reco.suggested_status;
  const priority = typeof body.review_priority === "string" && PRIORITY.has(body.review_priority) ? body.review_priority : "medium";
  const blockedStatuses = new Set(["deprecated", "rejected", "needs_revision", "replace_recommended"]);
  const usage_blocked = body.usage_blocked === true || blockedStatuses.has(status) || reco.safety.some((s) => s.severity === "error");
  const production_ready = (status === "approved" || status === "approved_with_notes") && reco.production_ready;

  const row = {
    tenant_id: tid, asset_id: id,
    board_id: typeof body.board_id === "string" ? body.board_id : null,
    review_status: status, review_priority: priority,
    production_ready, approval_score: reco.approval_score, risk_level: reco.risk_level,
    recommendation: reco.recommendation,
    reviewer_notes: typeof body.reviewer_notes === "string" ? body.reviewer_notes.trim() || null : null,
    internal_notes: typeof body.internal_notes === "string" ? body.internal_notes.trim() || null : null,
    reviewed_by: auth.account_id ?? null, reviewed_at: new Date().toISOString(),
    replacement_asset_id: typeof body.replacement_asset_id === "string" && body.replacement_asset_id ? body.replacement_asset_id : null,
    redesign_required: body.redesign_required === true,
    redesign_reason: typeof body.redesign_reason === "string" ? body.redesign_reason.trim() || null : null,
    usage_blocked,
  };
  const { data: saved, error } = await supabaseServer.from("visual_asset_reviews")
    .upsert(row, { onConflict: "asset_id" }).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Checklist scores
  if (Array.isArray(body.scores) && saved?.id) {
    const rows = (body.scores as { checklist_id?: string; score?: number; passed?: boolean; notes?: string }[])
      .filter((s) => typeof s.checklist_id === "string")
      .map((s) => ({ tenant_id: tid, review_id: saved.id, checklist_id: s.checklist_id!, score: Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))), passed: s.passed === true, notes: typeof s.notes === "string" ? s.notes : null }));
    if (rows.length) await supabaseServer.from("visual_review_scores").upsert(rows, { onConflict: "review_id,checklist_id" });
  }

  // History (reuse existing event log)
  await logVisualAssetEvent({
    tenantId: tid, assetId: id, actorId: auth.account_id ?? null,
    eventType: "review", summary: `Review: ${status.replace(/_/g, " ")} (${reco.approval_score})`,
    metadata: { status, approval_score: reco.approval_score, risk: reco.risk_level, production_ready },
  });

  return NextResponse.json({ ok: true });
}
