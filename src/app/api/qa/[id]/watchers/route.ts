import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { getWatchers, getWatcherCount, isWatching } from "@/lib/qa/watchers";

/* Confirm the issue exists in the tenant and the caller may see it. */
async function loadAccess(tenantId: string, issueId: string, accountId: string, isAdmin: boolean) {
  const { data } = await supabaseServer
    .from("qa_issue_reports")
    .select("id, reporter_id")
    .eq("tenant_id", tenantId)
    .eq("id", issueId)
    .maybeSingle();
  if (!data) return { ok: false as const };
  const owner = (data as { reporter_id: string | null }).reporter_id === accountId;
  if (!isAdmin && !owner) return { ok: false as const };
  return { ok: true as const };
}

/* GET /api/qa/[id]/watchers — count + whether I'm watching (+ identities for admins). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const access = await loadAccess(auth.tenant_id, id, auth.account_id, auth.is_super_admin);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [count, watching] = await Promise.all([
    getWatcherCount(auth.tenant_id, id),
    isWatching(auth.tenant_id, id, auth.account_id),
  ]);
  // Identities are admin-only — reporters see the count, never who is watching.
  const watchers = auth.is_super_admin ? await getWatchers(auth.tenant_id, id) : [];

  return NextResponse.json(
    { count, is_watching: watching, watchers },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
