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

   What still lives here: the ScopeContext shape and its client loader (from
   the /api/me/bootstrap payload) and the Type C module list. The
   query-building half (buildScopeFilter, orClauseForScope, privacyClause,
   logPrivateAccess) and the browser-side account-picker checks
   (getModuleScope, canViewAccount, filterAccessibleAccounts — they read
   koleex_permissions and koleex_employees with the anon key, which RLS
   answers with nothing) were removed once nothing called them: every list
   is scoped on the SERVER now, and the To-do rule in particular lives in
   lib/server/todo-scope-rule.ts. This module no longer touches the
   database at all.
   --------------------------------------------------------------------------- */

/** Four scope levels. Order matters: from most restrictive to least. */
export type DataScope = "private" | "own" | "department" | "all";

/** Modules that are "Type C — Personal productivity data". These are
 *  treated as always-Own + explicit-sharing + SA-bypass, regardless of
 *  what's set in koleex_permissions.data_scope. The Scope column in
 *  /roles is hidden for these modules because role config can't override
 *  the personal-by-default rule.
 *
 *  Rule: no non-SA can ever see another account's Type C records, even
 *  with Scope = All configured on their role.  */
export const TYPE_C_MODULES = new Set([
  "To-do",
  "Calendar",
  "Koleex Mail",
  "Inbox",
  "Notes",
  // Discuss is mixed: DMs are Type C, channels are tenant-scoped.
  // Handled in discuss fetch helpers rather than here.
]);

/** Effective scope context resolved per-user at request time. */
export interface ScopeContext {
  account_id: string;
  /** Multi-tenancy anchor. Every tenant-scoped fetch auto-filters by this
   *  so a customer-tenant account never sees Koleex's records and vice
   *  versa (except Super Admin who can switch tenants via the top bar). */
  tenant_id: string;
  role_id: string | null;
  /** Resolved from koleex_employees.department when the account has an
   *  employee record. Null for customer accounts or service accounts. */
  department: string | null;
  /** Effective Super Admin: true if EITHER the role OR the account
   *  is_super_admin flag is set. Lets the CEO promote a specific account
   *  without inventing a new role. */
  is_super_admin: boolean;
  /** Role flag: break-glass access to is_private records. Audit-logged. */
  can_view_private: boolean;
}

/* ============================================================================
   Context loading
   ============================================================================ */

/* ============================================================================
   Module-level cache for ScopeContext
   ----------------------------------------------------------------------------
   loadScopeContext is called by every useScopeContext hook mount. Without
   caching, a single CRM page fires it 3-4 times (CRM component, Sidebar,
   PermissionGate, each useScopeContext consumer) and each firing hits the
   accounts + employees tables. Multiplied across the app that's a real
   performance hit.

   Cache key: accountId + SA tenant override. A 60-second TTL covers the
   common navigate-around case without getting stale when the admin
   flips account flags (those typically require a page reload anyway to
   pick up the new identity).
   ============================================================================ */

interface CachedCtx {
  key: string;
  ctx: ScopeContext;
  ts: number;
}

const CTX_CACHE_TTL_MS = 60_000; // 60s — tight enough to pick up role changes
let cachedCtx: CachedCtx | null = null;

/** Compose the cache key. Includes the SA tenant override so a tenant
 *  switch invalidates automatically. */
function ctxCacheKey(accountId: string): string {
  let override: string | null = null;
  if (typeof window !== "undefined") {
    try {
      override = window.localStorage.getItem("koleex.sa.active_tenant_id");
    } catch {
      // ignore
    }
  }
  return `${accountId}::${override ?? ""}`;
}

/** Invalidate the cached ScopeContext. Call this whenever the current
 *  identity changes (sign in / out / account switch) or when the tenant
 *  override changes. */
export function clearScopeContextCache(): void {
  cachedCtx = null;
}

/**
 * Load the ScopeContext for an account. Hits 2 Supabase tables (accounts+role,
 * koleex_employees for department). Run once at the page/API edge and pass
 * the result through to fetch functions.
 *
 * Cached for 60s to avoid redundant fetches when multiple hooks consume
 * the same context on one page render.
 */
export async function loadScopeContext(
  accountId: string,
): Promise<ScopeContext> {
  const key = ctxCacheKey(accountId);
  if (
    cachedCtx &&
    cachedCtx.key === key &&
    Date.now() - cachedCtx.ts < CTX_CACHE_TTL_MS
  ) {
    return cachedCtx.ctx;
  }

  const ctx = await loadScopeContextUncached(accountId);
  cachedCtx = { key, ctx, ts: Date.now() };
  return ctx;
}

async function loadScopeContextUncached(
  accountId: string,
): Promise<ScopeContext> {
  /* THE SERVER ALREADY RESOLVED THIS. requireAuth() builds a full
     ScopeContext per request — account, role, super-admin, can_view_private
     and the koleex_employees department — and /api/me/bootstrap returns it as
     `auth`, which every screen already fetches inside the /api/shell batch.

     Reading `accounts` and `koleex_employees` from the BROWSER to rebuild the
     same object cost, on every single page in the Hub:
       · @supabase/supabase-js — 184 KB, the largest chunk in the boot after
         the framework itself, pulled in only for these two reads
       · two direct cross-border database round trips
     Both are gone; the numbers come from a payload already in flight.

     The SA tenant override stays client-side below on purpose: it lives in
     localStorage and is a per-device choice the server has no business
     knowing about. */
  const { getMeBootstrap } = await import("./me-bootstrap");
  const boot = await getMeBootstrap().catch(() => null);
  const fromAuth = boot?.auth && boot.auth.account_id === accountId ? boot.auth : null;
  if (fromAuth) {
    let effectiveTenantId = fromAuth.tenant_id ?? "";
    if (fromAuth.is_super_admin && typeof window !== "undefined") {
      try {
        const override = window.localStorage.getItem("koleex.sa.active_tenant_id");
        if (override) effectiveTenantId = override;
      } catch { /* localStorage unavailable — keep the account's tenant */ }
    }
    return {
      account_id: fromAuth.account_id,
      tenant_id: effectiveTenantId,
      role_id: fromAuth.role_id ?? null,
      department: fromAuth.department ?? null,
      is_super_admin: fromAuth.is_super_admin ?? false,
      can_view_private: fromAuth.can_view_private ?? false,
    };
  }

  /* NO DATABASE FALLBACK. Rebuilding this from the browser meant reading
     `accounts` and `koleex_employees` with the public key to decide what the
     user may see — permissions resolved on the client, from the client. The
     server already resolves them per request; if that answer is not
     available, the honest result is the most restrictive one, not a guess
     assembled here.

     It also kept @supabase/supabase-js (184 KB) in the boot of every page:
     the import never ran once bootstrap was working, but the chunk was
     reachable from the shell graph and downloaded anyway. Deleting the path
     is what actually removes it. */
  return {
    account_id: accountId,
    tenant_id: "",
    role_id: null,
    department: null,
    is_super_admin: false,
    can_view_private: false,
  };
}

