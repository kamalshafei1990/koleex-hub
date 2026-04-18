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
import { getSessionAccountId } from "./session";
import type { ScopeContext } from "../scope";

export interface ServerAuthContext extends ScopeContext {
  /** Present for convenience — some routes want extra account fields. */
  username: string;
  login_email: string;
  status: string;
  user_type: string;
}

/**
 * Load the authenticated account from the session cookie. Returns null
 * if no session, malformed cookie, disabled account, or DB miss. Never
 * throws — call sites decide how to respond.
 */
export async function getServerAuth(): Promise<ServerAuthContext | null> {
  const accountId = await getSessionAccountId();
  if (!accountId) return null;

  const { data, error } = await supabaseServer
    .from("accounts")
    .select(
      `id, username, login_email, status, user_type,
       tenant_id, role_id, is_super_admin,
       roles:role_id(is_super_admin, can_view_private)`,
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== "active") return null;

  const roleRaw = (data as { roles?: unknown }).roles;
  const role = Array.isArray(roleRaw)
    ? (roleRaw[0] as { is_super_admin: boolean; can_view_private: boolean } | undefined) ?? null
    : ((roleRaw as { is_super_admin: boolean; can_view_private: boolean } | null) ?? null);

  const effectiveSA =
    (data.is_super_admin ?? false) || (role?.is_super_admin ?? false);

  // Department (for scope=department) — resolved from koleex_employees when
  // the account has one. Optional — not every account is an employee.
  const { data: emp } = await supabaseServer
    .from("koleex_employees")
    .select("department")
    .eq("account_id", data.id)
    .maybeSingle();

  return {
    account_id: data.id,
    tenant_id: data.tenant_id,
    role_id: data.role_id,
    department: emp?.department ?? null,
    is_super_admin: effectiveSA,
    can_view_private: role?.can_view_private ?? false,
    username: data.username,
    login_email: data.login_email,
    status: data.status,
    user_type: data.user_type,
  };
}

/**
 * Convenience: get auth or return a 401 JSON Response. Route handlers
 * use this at the top:
 *
 *     const auth = await requireAuth();
 *     if (auth instanceof NextResponse) return auth;
 *     // auth is now the ServerAuthContext
 */
export async function requireAuth(): Promise<ServerAuthContext | NextResponse> {
  const auth = await getServerAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Not signed in" },
      { status: 401 },
    );
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
