"use client";

/* ---------------------------------------------------------------------------
   permissions — React hook + helpers for the 3-layer permission system.

   Layers:
     1. Module Access   – can the user View / Create / Edit / Delete in a module?
     2. Data Scope       – can they see Own / Department / All data?
     3. Sensitive Fields – which fields are hidden from this role?

   Chain:
     account.role_id → koleex_roles → koleex_permissions (org-level defaults)
     account overrides → account_permission_overrides (per-account tweaks)
     account.person_id → koleex_assignments → department_id (for scope checks)

   Usage:
     const perms = usePermissions();
     if (perms.can("Products", "view"))  { ... }
     if (perms.can("Contacts", "edit"))  { ... }
     const scope = perms.dataScope("Contacts"); // "own" | "department" | "all"
     const hidden = perms.sensitiveFields("Products"); // ["cost_price", ...]
     const deptIds = perms.departmentIds; // departments the user belongs to
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentAccount } from "./identity";
import { supabaseAdmin } from "./supabase-admin";
import type { OrgPermissionRow, DataScope } from "@/types/supabase";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

type Action = "view" | "create" | "edit" | "delete";

export interface PermissionState {
  /** Whether permissions have finished loading. */
  loading: boolean;
  /** Check if the current user can perform an action in a module. */
  can: (module: string, action: Action) => boolean;
  /** Get the data scope for a module (defaults to "own"). */
  dataScope: (module: string) => DataScope;
  /** Get the list of sensitive fields hidden from this role for a module. */
  sensitiveFields: (module: string) => string[];
  /** Department IDs the current user is assigned to. */
  departmentIds: string[];
  /** Whether the current user is a super admin (all permissions). */
  isSuperAdmin: boolean;
  /** The raw permission rows for advanced use. */
  permissions: OrgPermissionRow[];
}

/* ═══════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════ */

export function usePermissions(): PermissionState {
  const { account, loading: accountLoading } = useCurrentAccount();

  const [permissions, setPermissions] = useState<OrgPermissionRow[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountLoading) return;
    if (!account) {
      setPermissions([]);
      setDepartmentIds([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);

      // Parallel fetch: permissions for role + department assignments for person
      const [permsResult, deptResult] = await Promise.all([
        account.role_id ? fetchRolePermissions(account.role_id) : Promise.resolve([]),
        account.person_id ? fetchPersonDepartments(account.person_id) : Promise.resolve([]),
      ]);

      if (cancelled) return;
      setPermissions(permsResult);
      setDepartmentIds(deptResult);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [account, accountLoading]);

  // Build a lookup map: module_name → permission row
  const permMap = useMemo(
    () => new Map(permissions.map((p) => [p.module_name, p])),
    [permissions],
  );

  // Super admin: user_type === "internal" with role "Super Admin" or no role restrictions
  const isSuperAdmin = account?.user_type === "internal" && (
    account.role?.name === "Super Admin" || account.role?.name === "Administrator"
  );

  const can = useCallback(
    (module: string, action: Action): boolean => {
      // Super admins can do everything
      if (isSuperAdmin) return true;

      // No account = no permissions
      if (!account) return false;

      const perm = permMap.get(module);
      if (!perm) return false;

      switch (action) {
        case "view": return perm.can_view;
        case "create": return perm.can_create;
        case "edit": return perm.can_edit;
        case "delete": return perm.can_delete;
        default: return false;
      }
    },
    [account, permMap, isSuperAdmin],
  );

  const dataScope = useCallback(
    (module: string): DataScope => {
      if (isSuperAdmin) return "all";
      const perm = permMap.get(module);
      return perm?.data_scope || "own";
    },
    [permMap, isSuperAdmin],
  );

  const sensitiveFieldsFn = useCallback(
    (module: string): string[] => {
      if (isSuperAdmin) return [];
      const perm = permMap.get(module);
      return perm?.sensitive_fields || [];
    },
    [permMap, isSuperAdmin],
  );

  return {
    loading: accountLoading || loading,
    can,
    dataScope,
    sensitiveFields: sensitiveFieldsFn,
    departmentIds,
    isSuperAdmin: !!isSuperAdmin,
    permissions,
  };
}

/* ═══════════════════════════════════════════════════
   DATA FETCHERS
   ═══════════════════════════════════════════════════ */

async function fetchRolePermissions(roleId: string): Promise<OrgPermissionRow[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_permissions")
    .select("*")
    .eq("role_id", roleId);
  if (error || !data) return [];
  return data as OrgPermissionRow[];
}

async function fetchPersonDepartments(personId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_assignments")
    .select("department_id")
    .eq("person_id", personId);
  if (error || !data) return [];
  return [...new Set((data as { department_id: string }[]).map((a) => a.department_id))];
}

/* ═══════════════════════════════════════════════════
   UTILITY: Filter data by scope
   ═══════════════════════════════════════════════════ */

/**
 * Filter a list of records based on the user's data scope for a module.
 *
 * @param records   The full list of records
 * @param scope     The user's data scope ("own" | "department" | "all")
 * @param ownerId   Extractor: given a record, return the owner's person_id
 * @param deptId    Extractor: given a record, return the department_id
 * @param myPersonId  The current user's person_id
 * @param myDeptIds   The current user's department IDs
 */
export function filterByScope<T>(
  records: T[],
  scope: DataScope,
  ownerId: (r: T) => string | null,
  deptId: (r: T) => string | null,
  myPersonId: string | null,
  myDeptIds: string[],
): T[] {
  if (scope === "all") return records;

  if (scope === "department") {
    const deptSet = new Set(myDeptIds);
    return records.filter((r) => {
      const d = deptId(r);
      if (d && deptSet.has(d)) return true;
      // Also include own records
      const o = ownerId(r);
      return o === myPersonId;
    });
  }

  // scope === "own"
  return records.filter((r) => ownerId(r) === myPersonId);
}

/**
 * Remove sensitive fields from a record by setting them to a placeholder.
 * Returns a new object — does not mutate the input.
 */
export function redactSensitiveFields<T extends Record<string, unknown>>(
  record: T,
  hiddenFields: string[],
  placeholder: unknown = "—",
): T {
  if (!hiddenFields.length) return record;
  const result = { ...record };
  for (const field of hiddenFields) {
    if (field in result) {
      (result as Record<string, unknown>)[field] = placeholder;
    }
  }
  return result;
}
