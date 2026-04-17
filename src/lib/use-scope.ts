"use client";

/* ---------------------------------------------------------------------------
   Client-side hooks for scope + permission enforcement.

   Every page that shows tenant-scoped or role-gated data should use these:

     const ctx = useScopeContext();               // tenant + role + SA flags
     const { allowed, loading } = usePermission("CRM");  // module access

   Together they replace the pre-scope pattern where every page fetched
   wide-open without regard to tenancy or role. Calls are memoised per
   account so you can use them freely without worrying about the
   per-page double fetch.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "./supabase-admin";
import { getCurrentAccountIdSync } from "./identity";
import { APP_REGISTRY } from "./navigation";
import {
  loadScopeContext,
  TYPE_C_MODULES,
  type ScopeContext,
} from "./scope";

/* ==========================================================================
   useScopeContext — resolve the viewer's ScopeContext once per mount.
   ========================================================================== */

export function useScopeContext(): ScopeContext | null {
  const [ctx, setCtx] = useState<ScopeContext | null>(null);

  useEffect(() => {
    const id = getCurrentAccountIdSync();
    if (!id) return;
    loadScopeContext(id).then(setCtx).catch((e) => {
      console.error("[useScopeContext]", e);
    });
  }, []);

  return ctx;
}

/* ==========================================================================
   usePermission — check if the viewer's role can view a module.
   ========================================================================== */

export interface PermissionCheck {
  /** True when the viewer is allowed to open this module. Super Admin
   *  always gets true (except for break-glass flows). */
  allowed: boolean;
  /** True while the check is still resolving. Pages should show a
   *  loading state rather than flashing "denied". */
  loading: boolean;
  /** The underlying ScopeContext, exposed so pages don't need to call
   *  useScopeContext separately when they already have usePermission. */
  ctx: ScopeContext | null;
}

/**
 * Read the viewer's permission for a single module. The module_name must
 * match what's stored in koleex_permissions (case-sensitive).
 *
 * - Super Admin (effective): always allowed.
 * - No role on the account: always denied (fail-closed).
 * - Otherwise: allowed iff can_view = true on the role × module cell.
 *
 * Type C modules (Calendar, Todo, Mail, Inbox) default to allowed-for-own
 * so even a minimal role like "User" can use their personal productivity
 * tools — the restriction is on seeing OTHER accounts' records, which is
 * enforced in the fetch layer, not here.
 */
export function usePermission(module_name: string): PermissionCheck {
  const ctx = useScopeContext();
  const [permState, setPermState] = useState<{
    allowed: boolean;
    loading: boolean;
  }>({ allowed: false, loading: true });

  useEffect(() => {
    if (!ctx) {
      setPermState({ allowed: false, loading: true });
      return;
    }

    // SA bypass — always allowed
    if (ctx.is_super_admin) {
      setPermState({ allowed: true, loading: false });
      return;
    }

    // Type C modules are always allowed (for own data). The fetch layer
    // enforces that non-SA users only see their own records.
    if (TYPE_C_MODULES.has(module_name)) {
      setPermState({ allowed: true, loading: false });
      return;
    }

    // Fail-closed when no role
    if (!ctx.role_id) {
      setPermState({ allowed: false, loading: false });
      return;
    }

    // Read both the role's can_view AND any account-level override in
    // parallel. Override (can_view=false) wins — if the admin explicitly
    // hid this module from this account, nothing the role permits can
    // override that.
    Promise.all([
      supabase
        .from("koleex_permissions")
        .select("can_view")
        .eq("role_id", ctx.role_id)
        .eq("module_name", module_name)
        .maybeSingle(),
      supabase
        .from("account_permission_overrides")
        .select("can_view")
        .eq("account_id", ctx.account_id)
        .eq("module_key", module_name)
        .maybeSingle(),
    ]).then(([roleRes, overrideRes]) => {
      const roleAllows = Boolean(roleRes.data?.can_view);
      const overrideHides =
        overrideRes.data !== null && overrideRes.data.can_view === false;
      setPermState({
        allowed: roleAllows && !overrideHides,
        loading: false,
      });
    });
  }, [ctx, module_name]);

  return { allowed: permState.allowed, loading: permState.loading, ctx };
}

/* ==========================================================================
   usePermittedModules — return the full set of modules the viewer can view.
   Used by the Sidebar / app launcher to hide apps the role can't access.
   ========================================================================== */

export function usePermittedModules(): {
  modules: Set<string>;
  loading: boolean;
  ctx: ScopeContext | null;
} {
  const ctx = useScopeContext();
  const [state, setState] = useState<{
    modules: Set<string>;
    loading: boolean;
  }>({ modules: new Set(), loading: true });

  useEffect(() => {
    if (!ctx) {
      setState({ modules: new Set(), loading: true });
      return;
    }

    // SA bypass — grants every module AND every app in APP_REGISTRY.
    // Some apps (like "Roles & Permissions", "Settings", category nav
    // items) don't have rows in koleex_permissions because they're
    // administrative surfaces, not role-gated modules. Seed the Set
    // with every app.name so those still show up for SA.
    if (ctx.is_super_admin) {
      supabase
        .from("koleex_permissions")
        .select("module_name")
        .then(({ data }) => {
          const set = new Set(
            (data ?? []).map((r: { module_name: string }) => r.module_name),
          );
          // Union with the app catalogue so admin-only apps (no permission
          // rows) are still visible to Super Admin.
          for (const app of APP_REGISTRY) set.add(app.name);
          setState({ modules: set, loading: false });
        });
      return;
    }

    // Regular users: enumerate modules where this role has can_view = true
    if (!ctx.role_id) {
      setState({ modules: new Set(), loading: false });
      return;
    }

    // Parallel-fetch role permissions AND per-account overrides. The
    // overrides let an admin hide specific apps from a specific account
    // on top of the role defaults — "Alex's role allows Products but I
    // don't want Alex to see Products".
    Promise.all([
      supabase
        .from("koleex_permissions")
        .select("module_name, can_view")
        .eq("role_id", ctx.role_id)
        .eq("can_view", true),
      supabase
        .from("account_permission_overrides")
        .select("module_key, can_view")
        .eq("account_id", ctx.account_id)
        .eq("can_view", false),
    ]).then(([rolePerms, overrides]) => {
      const allowed = new Set(
        (rolePerms.data ?? []).map(
          (r: { module_name: string }) => r.module_name,
        ),
      );
      // Always grant Type C modules — every user has personal productivity.
      for (const m of TYPE_C_MODULES) allowed.add(m);
      // Dashboard is the landing page, everyone sees it.
      allowed.add("Dashboard");

      // Subtract hidden modules (account-level overrides).
      const hidden = new Set(
        (overrides.data ?? []).map(
          (r: { module_key: string }) => r.module_key,
        ),
      );
      for (const m of hidden) allowed.delete(m);

      setState({ modules: allowed, loading: false });
    });
  }, [ctx]);

  return { modules: state.modules, loading: state.loading, ctx };
}
