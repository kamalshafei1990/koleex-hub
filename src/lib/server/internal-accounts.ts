import "server-only";

import { supabaseServer } from "@/lib/server/supabase-server";

/** Keep only ACTIVE INTERNAL accounts of the tenant. Enforced on the server
 *  so it holds whatever the client — or the model — sends. Shared by the
 *  To-do assignee paths and the Calendar guest list. */
export async function internalAccountIds(ids: string[], tenantId: string | null): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  let q = supabaseServer
    .from("accounts")
    .select("id")
    .in("id", unique)
    .eq("user_type", "internal")
    .eq("status", "active");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: string }>).map((a) => a.id);
}
