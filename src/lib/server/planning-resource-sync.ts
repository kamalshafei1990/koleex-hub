import "server-only";

/* ---------------------------------------------------------------------------
   planning-resource-sync — keep one employee resource per active internal
   account, off the request path.

   This used to run INSIDE GET /api/planning/resources, awaited, on every
   call: three to four round trips (accounts, resources, employees, insert)
   before the list itself was even queried. Now:

     · it is called from after(), so the read never waits for it;
     · it is throttled per tenant per server instance (SYNC_TTL_MS);
     · its first step is the cheap check — the active internal accounts and
       the employee resources, fetched together in ONE round trip — and it
       returns right there when both sides already agree;
     · it is idempotent: it only inserts accounts that have no employee
       resource at all (active or not — a resource an admin deactivated is
       never resurrected), and the partial unique index on
       (tenant_id, account_id) WHERE type='employee' rejects any duplicate
       a concurrent run might race in (23505 is ignored);
     · it DEACTIVATES employee resources whose account is no longer an
       active internal account, so leavers drop off the board.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

const SYNC_TTL_MS = 5 * 60 * 1000;
const g = globalThis as typeof globalThis & { __kxPlanningSync?: Map<string, number> };
const lastRun: Map<string, number> = g.__kxPlanningSync ?? (g.__kxPlanningSync = new Map());

export async function maybeSyncEmployeeResources(tenantId: string): Promise<void> {
  const now = Date.now();
  const prev = lastRun.get(tenantId) ?? 0;
  if (now - prev < SYNC_TTL_MS) return;
  lastRun.set(tenantId, now);
  try {
    await syncEmployeeResources(tenantId);
  } catch (e) {
    lastRun.delete(tenantId); // let the next request retry
    console.error("[planning-resource-sync]", e instanceof Error ? e.message : e);
  }
}

async function syncEmployeeResources(tenantId: string): Promise<void> {
  const [acctRes, resRes] = await Promise.all([
    supabaseServer
      .from("accounts")
      .select("id, username")
      .eq("tenant_id", tenantId)
      .eq("user_type", "internal")
      .eq("status", "active"),
    supabaseServer
      .from("planning_resources")
      .select("id, account_id, is_active")
      .eq("tenant_id", tenantId)
      .eq("type", "employee")
      .not("account_id", "is", null),
  ]);
  if (acctRes.error) throw new Error(acctRes.error.message);
  if (resRes.error) throw new Error(resRes.error.message);

  const accts = (acctRes.data ?? []) as Array<{ id: string; username: string | null }>;
  const resources = (resRes.data ?? []) as Array<{ id: string; account_id: string; is_active: boolean }>;
  const activeAccountIds = new Set(accts.map((a) => a.id));
  const haveAccountIds = new Set(resources.map((r) => r.account_id));

  const missing = accts.filter((a) => !haveAccountIds.has(a.id));
  const stale = resources.filter((r) => r.is_active && !activeAccountIds.has(r.account_id));
  if (missing.length === 0 && stale.length === 0) return; // the cheap check

  if (missing.length > 0) {
    const { data: emps } = await supabaseServer
      .from("koleex_employees")
      .select("account_id, department")
      .in("account_id", missing.map((a) => a.id));
    const deptByAccount = new Map(
      (emps ?? [])
        .filter((e) => e.account_id)
        .map((e) => [e.account_id as string, (e.department as string | null) ?? null]),
    );
    const { error } = await supabaseServer.from("planning_resources").insert(
      missing.map((a) => ({
        tenant_id: tenantId,
        type: "employee" as const,
        account_id: a.id,
        name: a.username || "Employee",
        description: deptByAccount.get(a.id) ?? null,
        is_active: true,
      })),
    );
    if (error && error.code !== "23505") throw new Error(error.message);
  }

  if (stale.length > 0) {
    const { error } = await supabaseServer
      .from("planning_resources")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .eq("type", "employee")
      .in("id", stale.map((r) => r.id));
    if (error) throw new Error(error.message);
  }
}
