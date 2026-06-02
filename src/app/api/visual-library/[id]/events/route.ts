import "server-only";

/* /api/visual-library/[id]/events — asset audit/history (most recent first). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const { id } = await ctx.params;

  const { data, error } = await supabaseServer
    .from("visual_asset_events")
    .select("id, asset_id, event_type, summary, actor_name, metadata, created_at")
    .eq("tenant_id", auth.tenant_id)
    .eq("asset_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
