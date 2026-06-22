import "server-only";

/* POST a threaded review comment for an asset (creates the review row if needed). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

const TYPES = new Set(["note", "warning", "suggestion", "approval", "rejection"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "create");
  if (deny) return deny;
  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!comment) return NextResponse.json({ error: "comment required" }, { status: 400 });
  const comment_type = typeof body.comment_type === "string" && TYPES.has(body.comment_type) ? body.comment_type : "note";

  // Ensure a review row exists.
  let { data: review } = await supabaseServer.from("visual_asset_reviews").select("id").eq("asset_id", id).eq("tenant_id", tid).maybeSingle();
  if (!review) {
    const ins = await supabaseServer.from("visual_asset_reviews").upsert({ tenant_id: tid, asset_id: id }, { onConflict: "asset_id" }).select("id").maybeSingle();
    review = ins.data;
  }
  if (!review?.id) return NextResponse.json({ error: "Could not create review" }, { status: 500 });

  const { error } = await supabaseServer.from("visual_review_comments").insert({
    tenant_id: tid, review_id: review.id, user_id: auth.account_id ?? null, comment, comment_type,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
