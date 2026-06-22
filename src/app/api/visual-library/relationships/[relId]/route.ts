import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-library/relationships/[relId]

   PATCH  → edit (confidence/notes/type) OR run an action:
            approve | reject | archive | restore | reverse
            ("reverse" creates the mirror edge target→source).
   DELETE → remove the relationship.

   Tenant-scoped, Database-module gated, service-role backed.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { isRelationshipType, reverseOf, coerceConfidence } from "@/lib/visual-library/relationship-fields";
import type { RelationshipType } from "@/lib/visual-library/types";

async function load(relId: string, tid: string) {
  const { data } = await supabaseServer
    .from("visual_asset_relationships")
    .select("*").eq("id", relId).eq("tenant_id", tid).maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ relId: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;

  const { relId } = await ctx.params;
  const tid = auth.tenant_id;
  const rel = await load(relId, tid);
  if (!rel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "reverse") {
    const relType = rel.relationship_type as RelationshipType;
    const rev = reverseOf(relType) ?? relType;
    const { error } = await supabaseServer
      .from("visual_asset_relationships")
      .upsert({
        tenant_id: tid,
        source_asset_id: rel.target_asset_id,
        target_asset_id: rel.source_asset_id,
        relationship_type: rev,
        confidence_score: rel.confidence_score,
        status: rel.status,
        notes: rel.notes ?? null,
        origin: "manual",
        created_by: auth.account_id ?? null,
      }, { onConflict: "tenant_id,source_asset_id,target_asset_id,relationship_type" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  let patch: Record<string, unknown> = {};
  if (action === "approve") patch = { status: "approved" };
  else if (action === "reject") patch = { status: "rejected" };
  else if (action === "archive") patch = { status: "archived" };
  else if (action === "restore") patch = { status: "approved" };
  else if (!action) {
    if (body.confidence_score !== undefined) patch.confidence_score = coerceConfidence(body.confidence_score);
    if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
    if (isRelationshipType(body.relationship_type)) patch.relationship_type = body.relationship_type;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await supabaseServer
    .from("visual_asset_relationships").update(patch).eq("id", relId).eq("tenant_id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ relId: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "delete");
  if (deny) return deny;

  const { relId } = await ctx.params;
  const { error } = await supabaseServer
    .from("visual_asset_relationships").delete().eq("id", relId).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
