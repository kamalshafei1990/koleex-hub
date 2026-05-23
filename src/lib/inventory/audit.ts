import "server-only";

/* ===========================================================================
   INV-H2 — Inventory audit log helper.

   Append-only log of restricted-action attempts and discipline events.
   Surfaces inline in the movement detail drawer; no separate dashboard.

   Every Scope 1-9 action that constitutes a control gate must call
   logInventoryAudit() with the action code, entity reference, and any
   relevant metadata (reason, before/after values, rejection cause, …).

   Failures to log are swallowed (warn only) — the audit log must never
   block the underlying operation.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export type InventoryAuditAction =
  | "movement_draft_created"
  | "movement_approved"
  | "movement_rejected"
  | "movement_posted"
  | "movement_voided"
  | "movement_void_warning"
  | "zero_value_override"
  | "profile_archive_attempt"
  | "profile_archive_blocked"
  | "warehouse_archive_attempt"
  | "warehouse_archive_blocked"
  | "restricted_action_blocked";

export type InventoryAuditEntity = "movement" | "profile" | "warehouse";

export interface AuditInput {
  tenant_id: string;
  actor_id: string | null;
  action: InventoryAuditAction;
  entity_type: InventoryAuditEntity;
  entity_id: string | null;
  metadata?: Record<string, unknown>;
}

export async function logInventoryAudit(input: AuditInput): Promise<void> {
  try {
    const { error } = await supabaseServer.from("inventory_audit_log").insert({
      tenant_id: input.tenant_id,
      actor_id: input.actor_id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      metadata: input.metadata ?? {},
    });
    if (error) console.warn("[inv-audit] insert failed:", error.message);
  } catch (e) {
    console.warn("[inv-audit] threw:", e instanceof Error ? e.message : String(e));
  }
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: InventoryAuditAction;
  entity_type: InventoryAuditEntity;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Fetch the audit trail for a specific entity (e.g., a single movement).
 *  Returns rows newest-first, up to `limit`. */
export async function listInventoryAuditForEntity(
  tenantId: string,
  entityType: InventoryAuditEntity,
  entityId: string,
  limit = 50,
): Promise<AuditEntry[]> {
  const { data, error } = await supabaseServer
    .from("inventory_audit_log")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[inv-audit] list failed:", error.message);
    return [];
  }
  return (data ?? []) as AuditEntry[];
}
