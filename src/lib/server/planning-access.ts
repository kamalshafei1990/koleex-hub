import "server-only";

/* ---------------------------------------------------------------------------
   planning-access — the ONE ownership rule for planning items.

   The list route (GET /api/planning/items) always restricted non-super-
   admins to: items they created, items on a resource that belongs to them,
   and open (unassigned) shifts. The single-item routes did not — they only
   filtered on tenant, so anyone with the module could read, edit or delete
   any colleague's item by id. This file is that rule, once, for every
   route and for the AI agent's tools:

     · READ  — created by me · on my resource · open shift
     · WRITE — created by me · on my resource
               (open shifts are claimed through /take, not edited)

   Super admins bypass the ownership rule; the tenant filter always applies.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { isPlanningUuid } from "@/lib/planning-validate";

export interface PlanningCaller {
  account_id: string;
  tenant_id: string;
  is_super_admin: boolean;
}

/** Resource ids that belong to the caller (any type), resolved once. */
export async function callerResourceIds(caller: { account_id: string; tenant_id: string }): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("planning_resources")
    .select("id")
    .eq("tenant_id", caller.tenant_id)
    .eq("account_id", caller.account_id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/** The PostgREST `.or()` expression for the non-SA read scope. */
export function planningReadScopeOr(accountId: string, resourceIds: string[]): string {
  const parts = [`created_by_account_id.eq.${accountId}`, "resource_id.is.null"];
  if (resourceIds.length > 0) parts.push(`resource_id.in.(${resourceIds.join(",")})`);
  return parts.join(",");
}

/** The WRITE rule over an already-loaded row, given the caller's resource ids. */
export function canWritePlanningRow(
  caller: PlanningCaller,
  callerRids: readonly string[],
  row: { resource_id: string | null; created_by_account_id: string | null },
): boolean {
  if (caller.is_super_admin) return true;
  if (row.created_by_account_id === caller.account_id) return true;
  return !!row.resource_id && callerRids.includes(row.resource_id);
}

export type PlanningAccessResult<T> =
  | { ok: true; item: T }
  | { ok: false; status: 400 | 403 | 404 | 500 };

interface OwnedRow {
  resource_id: string | null;
  created_by_account_id: string | null;
}

/**
 * Load one item for the caller and enforce the ownership rule.
 * `select` must include resource_id and created_by_account_id.
 */
export async function loadPlanningItemForCaller<T extends OwnedRow = OwnedRow & Record<string, unknown>>(
  caller: PlanningCaller,
  id: string,
  mode: "read" | "write",
  select = "*",
): Promise<PlanningAccessResult<T>> {
  if (!isPlanningUuid(id)) return { ok: false, status: 400 };
  const { data, error } = await supabaseServer
    .from("planning_items")
    .select(select)
    .eq("id", id)
    .eq("tenant_id", caller.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[planning-access] load:", error.message);
    return { ok: false, status: 500 };
  }
  const item = data as unknown as T | null;
  if (!item) return { ok: false, status: 404 };
  if (caller.is_super_admin) return { ok: true, item };
  if (item.created_by_account_id === caller.account_id) return { ok: true, item };
  if (mode === "read" && !item.resource_id) return { ok: true, item };
  if (item.resource_id) {
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("id", item.resource_id)
      .eq("tenant_id", caller.tenant_id)
      .eq("account_id", caller.account_id)
      .maybeSingle();
    if (res) return { ok: true, item };
  }
  /* A row the caller may READ but not write answers 403; one they may not
     even read answers 404 so ids of other people's items don't leak. */
  if (mode === "write" && !item.resource_id) return { ok: false, status: 403 };
  return { ok: false, status: 404 };
}

/**
 * Check that resource_id / role_id (when set) belong to the caller's tenant.
 * Returns the offending field, or null when both are fine.
 */
export async function checkPlanningRefs(
  tenantId: string,
  refs: { resource_id?: string | null; role_id?: string | null },
): Promise<"resource_id" | "role_id" | null> {
  const [res, role] = await Promise.all([
    refs.resource_id
      ? supabaseServer.from("planning_resources").select("id").eq("id", refs.resource_id).eq("tenant_id", tenantId).maybeSingle()
      : Promise.resolve({ data: { id: "skip" }, error: null }),
    refs.role_id
      ? supabaseServer.from("planning_roles").select("id").eq("id", refs.role_id).eq("tenant_id", tenantId).maybeSingle()
      : Promise.resolve({ data: { id: "skip" }, error: null }),
  ]);
  if (!res.data) return "resource_id";
  if (!role.data) return "role_id";
  return null;
}

/** Generic JSON error bodies — never echo database text to the client. */
export const PLANNING_ERR = {
  400: "invalid_request",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  500: "server_error",
} as const;
