import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/qa/reports/[id]/activity — chronological timeline (admins only). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Not authorised." }, { status: 403 });

  const { id } = await ctx.params;
  const { data, error } = await supabaseServer
    .from("qa_issue_activity")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("issue_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
