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
import { useMeBootstrap } from "./me-bootstrap";

/* ==========================================================================
   useScopeContext — resolve the viewer's ScopeContext once per mount.
   ========================================================================== */

export function useScopeContext(): ScopeContext | null {
  // Reads from the shared bootstrap cache — same source of truth as
  // useCurrentAccount + usePermittedModules, so a page loads each hook
  // without firing N requests.
  const { data } = useMeBootstrap();
  const [ctx, setCtx] = useState<ScopeContext | null>(null);

  useEffect(() => {
    if (!data?.auth) {
      // Network error fallback — only fires when bootstrap couldn't
      // load at all. Keeps the legacy sync path working.
      const id = getCurrentAccountIdSync();
      if (!id) {
        setCtx(null);
        return;
      }
      loadScopeContext(id).then(setCtx).catch(() => setCtx(null));
      return;
    }

    // Apply the Super-Admin tenant override from localStorage so the
    // TenantPicker still works without a new round trip.
    let effectiveTenantId = data.auth.tenant_id ?? "";
    if (data.auth.is_super_admin && typeof window !== "undefined") {
      try {
        const override = window.localStorage.getItem(
          "koleex.sa.active_tenant_id",
        );
        if (override) effectiveTenantId = override;
      } catch {
        /* ignore */
      }
    }

    setCtx({
      account_id: data.auth.account_id,
      tenant_id: effectiveTenantId,
      role_id: data.auth.role_id,
      department: data.auth.department ?? null,
      is_super_admin: data.auth.is_super_admin,
      can_view_private: data.auth.can_view_private,
    });
  }, [data]);

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

    // Read from the shared bootstrap — one round-trip for the whole
    // page, then every usePermission subscribes to the cache.
    import("./me-bootstrap").then(({ getMeBootstrap }) => {
      void getMeBootstrap().then((payload) => {
        if (!payload) {
          setPermState({ allowed: false, loading: false });
          return;
        }
        setPermState({
          allowed: payload.permittedModules.includes(module_name),
          loading: false,
        });
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
  const { data, loading } = useMeBootstrap();

  const modules = (() => {
    if (!data) return new Set<string>();
    const set = new Set(data.permittedModules);
    // SA gets the full APP_REGISTRY union so admin-only surfaces
    // (Roles & Permissions, Settings, etc.) show up even without a
    // koleex_permissions row.
    if (data.isSuperAdmin) {
      for (const app of APP_REGISTRY) set.add(app.name);
    }
    return set;
  })();

  return { modules, loading, ctx };
}
