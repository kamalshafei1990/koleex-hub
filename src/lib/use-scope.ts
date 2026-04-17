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

    // Otherwise read the module's can_view flag
    supabase
      .from("koleex_permissions")
      .select("can_view")
      .eq("role_id", ctx.role_id)
      .eq("module_name", module_name)
      .maybeSingle()
      .then(({ data }) => {
        setPermState({
          allowed: Boolean(data?.can_view),
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

    // SA bypass — grants every module
    if (ctx.is_super_admin) {
      // Fetch the full module list (distinct) once so SA still respects
      // the system's module catalogue rather than defaulting to something hardcoded.
      supabase
        .from("koleex_permissions")
        .select("module_name")
        .then(({ data }) => {
          const set = new Set(
            (data ?? []).map((r: { module_name: string }) => r.module_name),
          );
          setState({ modules: set, loading: false });
        });
      return;
    }

    // Regular users: enumerate modules where this role has can_view = true
    if (!ctx.role_id) {
      setState({ modules: new Set(), loading: false });
      return;
    }

    supabase
      .from("koleex_permissions")
      .select("module_name, can_view")
      .eq("role_id", ctx.role_id)
      .eq("can_view", true)
      .then(({ data }) => {
        const set = new Set(
          (data ?? []).map((r: { module_name: string }) => r.module_name),
        );
        // Always grant Type C modules (Calendar, To-do, Mail, Inbox) —
        // every user has personal productivity tools regardless of role config.
        for (const m of TYPE_C_MODULES) set.add(m);
        // Dashboard too — it's the landing page, everyone needs it.
        set.add("Dashboard");
        setState({ modules: set, loading: false });
      });
  }, [ctx]);

  return { modules: state.modules, loading: state.loading, ctx };
}
