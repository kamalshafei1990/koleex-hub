import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { addWatcher, removeWatcher, getWatcherCount } from "@/lib/qa/watchers";
import { logActivity } from "@/lib/qa/activity";

/* Caller must be able to see the issue (Super Admin or its reporter). */
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

/* POST /api/qa/[id]/watch — start watching (idempotent). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const access = await loadAccess(auth.tenant_id, id, auth.account_id, auth.is_super_admin);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = await addWatcher(auth.tenant_id, id, auth.account_id);
  if (!res.ok) return NextResponse.json({ error: "Couldn't start watching." }, { status: 500 });
  // Only log the timeline event on a genuine new watch (idempotent).
  if (res.created) {
    await logActivity({
      tenant_id: auth.tenant_id,
      issue_id: id,
      actor_id: auth.account_id,
      actor_name: auth.username ?? null,
      activity_type: "watcher_added",
    });
  }
  const count = await getWatcherCount(auth.tenant_id, id);
  return NextResponse.json({ ok: true, is_watching: true, count });
}

/* DELETE /api/qa/[id]/watch — stop watching (idempotent). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const access = await loadAccess(auth.tenant_id, id, auth.account_id, auth.is_super_admin);
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = await removeWatcher(auth.tenant_id, id, auth.account_id);
  if (!res.ok) return NextResponse.json({ error: "Couldn't stop watching." }, { status: 500 });
  if (res.removed) {
    await logActivity({
      tenant_id: auth.tenant_id,
      issue_id: id,
      actor_id: auth.account_id,
      actor_name: auth.username ?? null,
      activity_type: "watcher_removed",
    });
  }
  const count = await getWatcherCount(auth.tenant_id, id);
  return NextResponse.json({ ok: true, is_watching: false, count });
}
