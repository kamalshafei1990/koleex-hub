import "server-only";

/* ===========================================================================
   INV-H2 — Inventory operational permission lookup.

   The Hub stores per-role flags for *who can do what* in inventory.
   Two flags drive Scope 3 (approval) and Scope 5 (void):

     - can_void_movements       — required to void a posted movement
     - can_approve_adjustments  — required to approve an adjustment draft

   Super-admin accounts bypass both checks. The migration auto-seeds both
   flags = true for every is_super_admin role; tenants can promote
   additional roles (e.g. Inventory Manager) via DB updates.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";

export interface InventoryPermissions {
  can_void: boolean;
  can_approve: boolean;
}

export async function loadInventoryPermissions(
  auth: ServerAuthContext,
): Promise<InventoryPermissions> {
  if (auth.is_super_admin) return { can_void: true, can_approve: true };
  if (!auth.role_id) return { can_void: false, can_approve: false };

  const { data, error } = await supabaseServer
    .from("roles")
    .select("can_void_movements, can_approve_adjustments")
    .eq("id", auth.role_id)
    .maybeSingle();
  if (error || !data) return { can_void: false, can_approve: false };
  const r = data as { can_void_movements: boolean | null; can_approve_adjustments: boolean | null };
  return {
    can_void: r.can_void_movements === true,
    can_approve: r.can_approve_adjustments === true,
  };
}
