import "server-only";

/* ---------------------------------------------------------------------------
   auth — Server-side authentication helpers for API route handlers.

   Every /api route should call requireAccount() at the top. It:
     1. Reads the signed session cookie → accountId (or null)
     2. Loads the account + role + tenant in one round-trip
     3. Returns the full context, or throws a Response(401) if not signed in

   Separate from src/lib/scope.ts because that one is client-facing (used
   by hooks); this one does the authenticated-server-context load that only
   route handlers need. They share the ScopeContext shape.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "./supabase-server";
import {
  getSessionAccountId,
  getViewAsAccountId,
  getViewAsRoleId,
} from "./session";
import type { ScopeContext } from "../scope";

export interface ServerAuthContext extends ScopeContext {
  /** Present for convenience — some routes want extra account fields. */
  username: string;
  login_email: string;
  status: string;
  user_type: string;
  /* ── View-as flags ────────────────────────────────────────────────
     When a super admin is "viewing as" another user, the auth context
     is loaded for the TARGET user (so every permission check evaluates
     as if they were that user). These two fields let downstream code
     know the impersonation is active without breaking the rest of the
     contract. `requireAuth` blocks mutations while `viewing_as` is true. */
  viewing_as: boolean;
  real_account_id: string | null;
  /* When viewing-as is active, this tells downstream code WHICH variant
     is in effect:
       · "account" — every permission check evaluates as the target user
         (role + their account-level overrides).
       · "role"    — the SA stays themselves (own account_id + tenant)
         but `role_id` is swapped to the target role and
         `is_super_admin` is forced off. No account-level overrides are
         applied. Useful for previewing a role template in isolation. */
  view_as_kind: "account" | "role" | null;
  /* Target role id when view_as_kind === "role". Null otherwise. */
  view_as_role_id: string | null;
}

/**
 * Load the authenticated account from the session cookie. Returns null
 * if no session, malformed cookie, disabled account, or DB miss. Never
 * throws — call sites decide how to respond.
 */
export async function getServerAuth(): Promise<ServerAuthContext | null> {
  const realAccountId = await getSessionAccountId();
  if (!realAccountId) return null;

  /* ── View-as resolution ──────────────────────────────────────────
     Two flavours of view-as, both SA-only:
       · account-mode: load the target user's account row + role +
         overrides. Every permission check evaluates as that user.
       · role-mode:    keep the SA's own account row but SWAP role_id
         to the target role and force is_super_admin off. No account
         overrides are applied — useful for previewing a role template
         without any user-specific quirks.
     Cookies are mutually exclusive (the setters clear the sibling),
     but we still prefer account-mode if both happen to be present. */
  const overrideTargetAccountId = await getViewAsAccountId(realAccountId);
  const overrideTargetRoleId = overrideTargetAccountId
    ? null
    : await getViewAsRoleId(realAccountId);

  /* Two Supabase lookups are needed to build the auth context:
     - `accounts` row (with joined role)
     - `koleex_employees` department (optional — only if the account
       maps to an employee record).
     Previously these ran sequentially, adding one unnecessary round-
     trip (~150–300ms) to EVERY authenticated request. Run them in
     parallel: both keys are known up front (accountId), so there's
     no dependency between the two queries. */
  const accountIdToLoad = overrideTargetAccountId ?? realAccountId;
  /* When view-as is active, ALSO verify the real session is a SA. We
     query the real account in parallel so the override doesn't add a
     round-trip in the common (no-override) path. Role-mode also needs
     to load the target role's flags. */
  const viewAsActive = !!overrideTargetAccountId || !!overrideTargetRoleId;
  const [accountRes, empRes, realAccountRes, targetRoleRes] = await Promise.all([
    supabaseServer
      .from("accounts")
      .select(
        `id, username, login_email, status, user_type,
         tenant_id, role_id, is_super_admin,
         roles:role_id(is_super_admin, can_view_private)`,
      )
      .eq("id", accountIdToLoad)
      .maybeSingle(),
    supabaseServer
      .from("koleex_employees")
      .select("department")
      .eq("account_id", accountIdToLoad)
      .maybeSingle(),
    viewAsActive
      ? supabaseServer
          .from("accounts")
          .select(`id, is_super_admin, roles:role_id(is_super_admin)`)
          .eq("id", realAccountId)
          .maybeSingle()
      : Promise.resolve(null),
    overrideTargetRoleId
      ? supabaseServer
          .from("roles")
          .select("id, is_super_admin, can_view_private")
          .eq("id", overrideTargetRoleId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  const { data, error } = accountRes;
  if (error) {
    /* Transient DB errors were previously swallowed and reported to
       the client as "Not signed in", which led the picker to a dead
       end (the user is signed in — the lookup just failed). Log them
       loudly so the cause is visible in Vercel logs / dev console. */
    console.error(
      "[auth.getServerAuth] accounts lookup failed:",
      error.message,
      "accountId=",
      accountIdToLoad,
    );
    return null;
  }
  if (!data) return null;
  if (data.status !== "active") return null;

  /* If view-as was requested, validate the real session is a SA. If
     not, silently fall through (load the target row but don't flag
     viewing_as) — refusing here would turn any cookie-tamper into a
     500. */
  let viewingAs = false;
  if (viewAsActive && realAccountRes && "data" in realAccountRes) {
    const realData = realAccountRes.data as
      | { is_super_admin?: boolean; roles?: unknown }
      | null;
    const realRoleRaw = realData?.roles;
    const realRole = Array.isArray(realRoleRaw)
      ? ((realRoleRaw[0] as { is_super_admin?: boolean } | undefined) ?? null)
      : ((realRoleRaw as { is_super_admin?: boolean } | null) ?? null);
    const realIsSA =
      (realData?.is_super_admin ?? false) || (realRole?.is_super_admin ?? false);
    if (realIsSA) viewingAs = true;
  }

  const roleRaw = (data as { roles?: unknown }).roles;
  const role = Array.isArray(roleRaw)
    ? (roleRaw[0] as { is_super_admin: boolean; can_view_private: boolean } | undefined) ?? null
    : ((roleRaw as { is_super_admin: boolean; can_view_private: boolean } | null) ?? null);

  const effectiveSA =
    (data.is_super_admin ?? false) || (role?.is_super_admin ?? false);

  /* Role-mode override: swap role_id to the target role, force SA off
     so the permittedModules / requireModuleAccess paths evaluate from
     the role's grants alone. Only honoured when viewingAs was actually
     validated (real session is a SA). */
  const targetRoleRow =
    overrideTargetRoleId && targetRoleRes && "data" in targetRoleRes
      ? (targetRoleRes.data as
          | { id?: string; is_super_admin?: boolean; can_view_private?: boolean }
          | null)
      : null;
  const roleModeActive = !!(viewingAs && overrideTargetRoleId && targetRoleRow);

  return {
    account_id: data.id,
    tenant_id: data.tenant_id,
    role_id: roleModeActive ? overrideTargetRoleId! : data.role_id,
    department: empRes.data?.department ?? null,
    is_super_admin: roleModeActive ? false : effectiveSA,
    can_view_private: roleModeActive
      ? (targetRoleRow!.can_view_private ?? false)
      : (role?.can_view_private ?? false),
    username: data.username,
    login_email: data.login_email,
    status: data.status,
    user_type: data.user_type,
    viewing_as: viewingAs,
    real_account_id: viewingAs ? realAccountId : null,
    view_as_kind: viewingAs ? (roleModeActive ? "role" : "account") : null,
    view_as_role_id: roleModeActive ? overrideTargetRoleId : null,
  };
}

/**
 * Convenience: get auth or return a 401 JSON Response. Route handlers
 * use this at the top:
 *
 *     const auth = await requireAuth();
 *     if (auth instanceof NextResponse) return auth;
 *     // auth is now the ServerAuthContext
 *
 * Optional `req` parameter: when passed, mutating methods (POST / PUT /
 * PATCH / DELETE) are blocked while `auth.viewing_as` is true. The SA
 * must exit view-as mode before they can make changes. This protects
 * against the SA accidentally writing data attributed to the target
 * user and is a hard read-only enforcement at the API edge.
 *
 * Routes that NEED to write during view-as (only the view-as toggle
 * endpoints themselves) call `requireAuth()` without `req`.
 */
export async function requireAuth(req?: Request): Promise<ServerAuthContext | NextResponse> {
  const auth = await getServerAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Not signed in" },
      { status: 401 },
    );
  }
  if (req && auth.viewing_as) {
    const method = req.method?.toUpperCase();
    if (method && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      return NextResponse.json(
        { error: "Read-only while viewing as another user. Exit view-as to make changes." },
        { status: 403 },
      );
    }
  }
  return auth;
}

/**
 * Require that the caller's role grants `can_view` on a given module.
 * Super Admin bypasses. Per-account `account_permission_overrides` with
 * can_view=false win over role grants (an admin has explicitly hidden
 * this module from this account).
 */
export async function requireModuleAccess(
  auth: ServerAuthContext,
  moduleName: string,
): Promise<NextResponse | null> {
  if (auth.is_super_admin) return null;

  if (!auth.role_id) {
    return NextResponse.json(
      { error: "No role assigned" },
      { status: 403 },
    );
  }

  // Case-insensitive match on both sides. Historically some rows were
  // stored lowercase (e.g. "calendar"), others Pascal-case ("Calendar").
  // A plain .eq match against one canonical case used to miss either a
  // legitimate role grant OR a hide-override — both failure modes are
  // privilege-shaped, so we normalise with ilike and then compare in
  // code rather than trust the DB representation.
  const [rolePermRes, overrideRes] = await Promise.all([
    supabaseServer
      .from("koleex_permissions")
      .select("can_view, module_name")
      .eq("role_id", auth.role_id)
      .ilike("module_name", moduleName)
      .maybeSingle(),
    supabaseServer
      .from("account_permission_overrides")
      .select("can_view, module_key")
      .eq("account_id", auth.account_id)
      .ilike("module_key", moduleName)
      .maybeSingle(),
  ]);

  // Fail-closed on DB errors. Previously a transient error made both
  // sides fall back to "false" and returned 403, but any unexpected
  // exception path could have ended up permitting by accident. Be
  // explicit: if the DB is unreachable, deny with 500 so we don't
  // accidentally grant access on a query that never returned.
  if (rolePermRes.error || overrideRes.error) {
    console.error(
      "[requireModuleAccess]",
      rolePermRes.error?.message ?? overrideRes.error?.message,
    );
    return NextResponse.json(
      { error: "Permission check failed" },
      { status: 500 },
    );
  }

  const roleAllows = rolePermRes.data?.can_view === true;
  const overrideHides =
    overrideRes.data !== null && overrideRes.data?.can_view === false;

  if (!roleAllows || overrideHides) {
    return NextResponse.json(
      { error: `No access to ${moduleName}` },
      { status: 403 },
    );
  }
  return null;
}
