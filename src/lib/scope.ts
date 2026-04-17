/* ---------------------------------------------------------------------------
   Scope enforcement — central helper for Role × Module data visibility.

   This is the runtime companion to the Scope column on /roles. It translates
   the four scope levels (private / own / department / all) plus the role
   override flags (is_super_admin / can_view_private) into actual query
   filters that fetch functions wrap themselves with.

   Rule summary (evaluated in order):

     1. If the role has is_super_admin = true  →  bypass all scope filters.
        Still excludes records with is_private = true unless the role also
        has can_view_private = true. Reading private records via break-glass
        is logged to koleex_private_access_log.

     2. Otherwise look up data_scope for (role × module) in koleex_permissions:
          - private    → only records created by this account
          - own        → created OR assigned/attending OR shared-with OR broadcast
          - department → own rules + records owned by anyone in user's department
          - all        → no filter (within the non-private constraint)

     3. Private-record filter is always applied (unless can_view_private):
        non-private records plus the user's own records regardless of flag.

   Fetch callers resolve a ScopeContext once per request via loadScopeContext(),
   then call buildScopeFilter() to get the bits they need to OR into their
   Supabase query. Keeping the filter composition in the caller (rather than
   returning a pre-built query) means fetches stay transparent and easy to
   debug — the helper just tells them "here are the extra conditions".
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

/** Four scope levels. Order matters: from most restrictive to least. */
export type DataScope = "private" | "own" | "department" | "all";

/** Effective scope context resolved per-user at request time. */
export interface ScopeContext {
  account_id: string;
  role_id: string | null;
  /** Resolved from koleex_employees.department when the account has an
   *  employee record. Null for customer accounts or service accounts. */
  department: string | null;
  /** Role flag: bypasses all data_scope filters except is_private. */
  is_super_admin: boolean;
  /** Role flag: break-glass access to is_private records. Audit-logged. */
  can_view_private: boolean;
}

/** Per-module shape description. Every module that wants scope enforcement
 *  declares how "Own" translates into SQL here. */
export interface ModuleScopeConfig {
  /** Matches koleex_permissions.module_name. */
  module_name: string;
  /** Column holding the record's owner account_id. */
  owner_field: string;
  /** Optional column holding a department name for department-scope matching. */
  department_field?: string;
  /** Optional junction table for multi-share relationships (assignees,
   *  attendees, explicit shares). */
  sharing_junction?: {
    table: string;
    fk_record: string;   // e.g. "todo_id"
    fk_account: string;  // e.g. "account_id"
  };
  /** Optional boolean column that means "everyone can see this record"
   *  regardless of scope (e.g. koleex_todos.assign_to_all). */
  broadcast_field?: string;
  /** Optional boolean column that means "this record is private" — only the
   *  owner can see it even under own/dept/all. Bypassed by can_view_private
   *  (with audit log). */
  is_private_field?: string;
}

/**
 * Registry of scope configs for each module that supports scope enforcement.
 * Add entries as more apps are migrated onto the helper.
 */
export const MODULE_CONFIGS: Record<string, ModuleScopeConfig> = {
  "To-do": {
    module_name: "To-do",
    owner_field: "created_by_account_id",
    department_field: "assigned_department",
    sharing_junction: {
      table: "koleex_todo_assignees",
      fk_record: "todo_id",
      fk_account: "account_id",
    },
    broadcast_field: "assign_to_all",
    is_private_field: "is_private",
  },
  "Calendar": {
    module_name: "Calendar",
    owner_field: "account_id",
    is_private_field: "is_private",
    // No sharing junction yet — attendees model not built
  },
  "CRM": {
    module_name: "CRM",
    owner_field: "owner_account_id",
  },
  "Quotations": {
    module_name: "Quotations",
    owner_field: "created_by",
  },
  "Customers": {
    module_name: "Customers",
    owner_field: "owner_account_id",
  },
};

/* ============================================================================
   Context loading
   ============================================================================ */

/**
 * Load the ScopeContext for an account. Hits 2 Supabase tables (accounts+role,
 * koleex_employees for department). Run once at the page/API edge and pass
 * the result through to fetch functions.
 */
export async function loadScopeContext(
  accountId: string,
): Promise<ScopeContext> {
  // Parallel: account+role and employee
  const [accRes, empRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("role_id, roles:role_id(is_super_admin, can_view_private)")
      .eq("id", accountId)
      .maybeSingle(),
    supabase
      .from("koleex_employees")
      .select("department")
      .eq("account_id", accountId)
      .maybeSingle(),
  ]);

  const accData = (accRes.data ?? null) as {
    role_id: string | null;
    roles?:
      | { is_super_admin: boolean; can_view_private: boolean }
      | { is_super_admin: boolean; can_view_private: boolean }[]
      | null;
  } | null;

  // Supabase returns embedded role as either an object or single-element array
  const roleRaw = accData?.roles;
  const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw ?? null;

  return {
    account_id: accountId,
    role_id: accData?.role_id ?? null,
    department: empRes.data?.department ?? null,
    is_super_admin: role?.is_super_admin ?? false,
    can_view_private: role?.can_view_private ?? false,
  };
}

/**
 * Look up the effective scope for a specific (role × module) cell. Returns
 * 'private' when no permission row exists — this is the safe default
 * (fail-closed rather than fail-open).
 */
export async function getModuleScope(
  ctx: ScopeContext,
  module_name: string,
): Promise<DataScope> {
  if (!ctx.role_id) return "private";
  const { data } = await supabase
    .from("koleex_permissions")
    .select("data_scope")
    .eq("role_id", ctx.role_id)
    .eq("module_name", module_name)
    .maybeSingle();
  return ((data?.data_scope as DataScope) ?? "private") as DataScope;
}

/**
 * Decide whether a user is allowed to view another account's records
 * (e.g. another person's Calendar via the account-picker). Used by
 * modules that have an "active account" concept distinct from "records
 * the user created".
 *
 * Rules:
 *   - Super Admin (is_super_admin): yes, any account
 *   - Viewing own account: yes, always
 *   - Scope 'all' on this module: yes, any account
 *   - Scope 'department': yes if the target account is in the same
 *     department as the viewer (via koleex_employees.department)
 *   - Scope 'own' or 'private' + different account: no
 *
 * Returns { allowed, reason } — the reason is useful for UI hints.
 */
export async function canViewAccount(
  ctx: ScopeContext,
  module_name: string,
  target_account_id: string,
): Promise<{ allowed: boolean; reason: "sa" | "own" | "scope_all" | "scope_dept" | "denied" }> {
  if (ctx.is_super_admin) return { allowed: true, reason: "sa" };
  if (target_account_id === ctx.account_id) return { allowed: true, reason: "own" };

  const scope = await getModuleScope(ctx, module_name);
  if (scope === "all") return { allowed: true, reason: "scope_all" };

  if (scope === "department" && ctx.department) {
    const { data } = await supabase
      .from("koleex_employees")
      .select("department")
      .eq("account_id", target_account_id)
      .maybeSingle();
    if (data?.department && data.department === ctx.department) {
      return { allowed: true, reason: "scope_dept" };
    }
  }

  return { allowed: false, reason: "denied" };
}

/**
 * Given a set of candidate account IDs, return only the ones this user is
 * allowed to view under the given module. Lets pickers (e.g. the Calendar
 * account dropdown) show only accessible accounts.
 *
 * Optimised: resolves scope once and batch-checks departments instead of
 * per-account round-trips.
 */
export async function filterAccessibleAccounts(
  ctx: ScopeContext,
  module_name: string,
  candidate_account_ids: string[],
): Promise<string[]> {
  if (candidate_account_ids.length === 0) return [];
  if (ctx.is_super_admin) return candidate_account_ids;

  const scope = await getModuleScope(ctx, module_name);

  if (scope === "all") return candidate_account_ids;
  if (scope === "private" || scope === "own") {
    return candidate_account_ids.filter((id) => id === ctx.account_id);
  }

  // Department scope — batch-fetch departments for the candidates
  if (scope === "department" && ctx.department) {
    const { data } = await supabase
      .from("koleex_employees")
      .select("account_id, department")
      .in("account_id", candidate_account_ids);
    const sameDept = new Set(
      ((data ?? []) as { account_id: string; department: string | null }[])
        .filter((e) => e.department === ctx.department)
        .map((e) => e.account_id),
    );
    // Always include self
    sameDept.add(ctx.account_id);
    return candidate_account_ids.filter((id) => sameDept.has(id));
  }

  // Fallback — only self
  return candidate_account_ids.filter((id) => id === ctx.account_id);
}

/* ============================================================================
   Filter composition
   ============================================================================ */

/** Structured filter instructions the caller uses to build their WHERE.
 *  Lets the caller stay in control of how it composes clauses into Supabase
 *  .or() / .eq() chains — the helper just says what the filter SHOULD match. */
export interface ScopeFilter {
  /** Effective scope for this user × module, or 'bypass' if SA. */
  scope: DataScope | "bypass";
  /** Record IDs the user can see via the sharing junction (pre-fetched).
   *  Empty when the module has no junction or the user has no shared records. */
  shared_record_ids: string[];
  /** True when the user cannot see is_private records (i.e. the caller
   *  should filter them out unless the user is the owner). */
  hide_private: boolean;
  /** Convenience: the config used to build this filter. */
  config: ModuleScopeConfig;
}

/**
 * Build a ScopeFilter for a given user × module. Pre-fetches the user's
 * shared record IDs from the junction table (if the module has one) in a
 * single round-trip, so the caller can plug the IDs directly into their
 * Supabase .or() chain without a second query.
 */
export async function buildScopeFilter(params: {
  ctx: ScopeContext;
  module_name: string;
  /** Override config if needed — otherwise pulled from MODULE_CONFIGS. */
  config?: ModuleScopeConfig;
}): Promise<ScopeFilter> {
  const config = params.config ?? MODULE_CONFIGS[params.module_name];
  if (!config) {
    throw new Error(
      `[scope] No MODULE_CONFIGS entry for "${params.module_name}". Add one to src/lib/scope.ts before wrapping fetch with scope.`,
    );
  }

  const scope: DataScope | "bypass" = params.ctx.is_super_admin
    ? "bypass"
    : await getModuleScope(params.ctx, params.module_name);

  // Pre-fetch shared record IDs (junction table lookup) when scope is
  // restrictive enough that we'd need them. SA + 'all' don't need this.
  let shared_record_ids: string[] = [];
  if (
    config.sharing_junction &&
    scope !== "bypass" &&
    scope !== "all"
  ) {
    const { data } = await supabase
      .from(config.sharing_junction.table)
      .select(config.sharing_junction.fk_record)
      .eq(config.sharing_junction.fk_account, params.ctx.account_id);
    // Supabase's inferred .select() type can widen to GenericStringError[]
    // on the error branch; cast through unknown to get the concrete shape.
    const rows = (data ?? []) as unknown as Record<string, string>[];
    shared_record_ids = rows.map(
      (r) => r[config.sharing_junction!.fk_record],
    );
  }

  return {
    scope,
    shared_record_ids,
    hide_private: !params.ctx.can_view_private,
    config,
  };
}

/**
 * Turn a ScopeFilter into the OR clause string that Supabase .or() expects.
 * Returns null when the scope is 'bypass' or 'all' (no clause needed).
 *
 * Supabase .or() uses comma-separated conditions and backtick-free syntax.
 * See https://supabase.com/docs/reference/javascript/or
 */
export function orClauseForScope(
  filter: ScopeFilter,
  ctx: ScopeContext,
): string | null {
  if (filter.scope === "bypass" || filter.scope === "all") return null;

  const c = filter.config;
  const clauses: string[] = [];

  // Always include records owned by this user
  clauses.push(`${c.owner_field}.eq.${ctx.account_id}`);

  // Records shared with this user via junction table
  if (filter.shared_record_ids.length > 0) {
    clauses.push(`id.in.(${filter.shared_record_ids.join(",")})`);
  }

  // Broadcast records (e.g. assign_to_all = true)
  if (c.broadcast_field) {
    clauses.push(`${c.broadcast_field}.eq.true`);
  }

  // Department scope: add department-owned records
  if (filter.scope === "department" && c.department_field && ctx.department) {
    clauses.push(`${c.department_field}.eq.${ctx.department}`);
  }

  // Private scope: only records I created (drop all sharing/broadcast)
  if (filter.scope === "private") {
    return `${c.owner_field}.eq.${ctx.account_id}`;
  }

  return clauses.join(",");
}

/**
 * Turn the privacy filter into a clause. Null when no private filter needed.
 * Private records are hidden unless owned by the user — i.e. records are
 * visible when is_private = false OR owner = me.
 */
export function privacyClause(
  filter: ScopeFilter,
  ctx: ScopeContext,
): string | null {
  if (!filter.hide_private) return null;          // Break-glass role — see all
  if (!filter.config.is_private_field) return null; // Module doesn't track privacy
  const { is_private_field, owner_field } = filter.config;
  return `${is_private_field}.eq.false,${owner_field}.eq.${ctx.account_id}`;
}

/* ============================================================================
   Audit log
   ============================================================================ */

/**
 * Write an entry to koleex_private_access_log when a role with
 * can_view_private reads an is_private record. Called by fetch functions
 * after retrieving results when any of those results have is_private = true.
 */
export async function logPrivateAccess(
  ctx: ScopeContext,
  module_name: string,
  record_type: string,
  record_ids: string[],
  access_reason?: string,
): Promise<void> {
  if (!ctx.can_view_private || record_ids.length === 0) return;
  const rows = record_ids.map((id) => ({
    account_id: ctx.account_id,
    role_id: ctx.role_id,
    module_name,
    record_type,
    record_id: id,
    access_reason: access_reason ?? null,
  }));
  const { error } = await supabase
    .from("koleex_private_access_log")
    .insert(rows);
  if (error) {
    console.error("[scope] logPrivateAccess:", error.message);
  }
}
