/* /api/ai/knowledge/units/[id] — approve / retire / edit ONE knowledge
   unit. Editing the body bumps `version` (the KU contract: unit of
   citation = unit of versioning) and records lineage. Super-admin only. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { estimateTokens } from "@/lib/server/ai-knowledge";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status) {
    if (!["draft", "approved", "retired"].includes(body.status)) {
      return NextResponse.json({ error: "Bad status" }, { status: 400 });
    }
    updates.status = body.status;
    updates.approved_by = body.status === "approved" ? auth.account_id ?? null : null;
    updates.approved_at = body.status === "approved" ? new Date().toISOString() : null;
  }
  if (typeof body.body === "string" && body.body.trim()) {
    const { data: cur } = await supabaseServer
      .from("ai_knowledge_units")
      .select("version, tenant_id")
      .eq("id", id)
      .maybeSingle();
    updates.body = body.body.trim();
    updates.tokens = estimateTokens(body.body);
    updates.version = ((cur?.version as number) ?? 1) + 1;
    /* Human edit is a lineage event — the unit derives from itself. */
    if (cur) {
      await supabaseServer.from("ai_ku_lineage").insert({
        tenant_id: cur.tenant_id ?? null,
        ku_id: id,
        parent_ku_id: id,
        relation: "supersedes",
      });
    }
  }
  if (typeof body.title === "string") updates.title = body.title.trim() || null;
  if (Array.isArray(body.tags)) updates.tags = body.tags.map(String);

  const { error } = await supabaseServer.from("ai_knowledge_units").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
