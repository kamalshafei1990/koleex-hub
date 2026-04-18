import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/planning/items/:id/publish — flip a draft to published.
   No-op if already published. */

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("planning_items")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .in("status", ["draft", "published"])
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget notification to the assignee (if any).
  if (data?.resource_id) {
    void notifyAssignee(auth, data);
  }

  return NextResponse.json({ item: data });
}

/** Send an inbox message to the account behind the resource assigned to
 *  this item. Silent on failure — inbox delivery is never the reason a
 *  publish should fail. */
async function notifyAssignee(
  auth: { account_id: string; tenant_id: string },
  item: { id: string; title: string | null; type: string; start_at: string; end_at: string; resource_id: string | null },
): Promise<void> {
  if (!item.resource_id) return;
  const { data: res } = await supabaseServer
    .from("planning_resources")
    .select("account_id, name")
    .eq("id", item.resource_id)
    .maybeSingle();
  if (!res?.account_id || res.account_id === auth.account_id) return;

  const start = new Date(item.start_at);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString("en", { month: "short", day: "numeric" })} ${d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}`;

  await supabaseServer.from("inbox_messages").insert({
    recipient_account_id: res.account_id,
    sender_account_id: auth.account_id,
    tenant_id: auth.tenant_id,
    category: "system",
    subject: `You've been scheduled: ${item.title || item.type}`,
    body: `A ${item.type} has been assigned to you starting ${fmt(start)}.`,
    link: "/planning",
    metadata: { source: "planning", planning_item_id: item.id, type: item.type },
  });
}
