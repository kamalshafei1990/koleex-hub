import "server-only";

/* ---------------------------------------------------------------------------
   Supplier timeline — server-side event emitter.

   logSupplierEvent() writes one canonical event into supplier_timeline_events.
   It is BEST-EFFORT: any failure is swallowed so an audit-trail hiccup can
   never break the primary write that triggered it. Auto-events are emitted
   from the existing supplier write paths; manual events come through the
   /timeline route. Visibility-aware + AI-ready (structured + metadata).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";

export interface TimelineEventInput {
  tenant_id: string;
  supplier_id: string;
  event_type: string;
  event_category: "relationship" | "communication" | "factory" | "documents" | "procurement" | "system";
  title: string;
  description?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  source_module?: string;
  visibility_tier?: string;
  importance?: "low" | "normal" | "high" | "critical";
  is_manual?: boolean;
  related_entity_id?: string | null;
  related_entity_type?: string | null;
  metadata?: Record<string, unknown>;
}

/** Resolve a human actor label from the auth context. */
export function actorName(auth: ServerAuthContext): string {
  return auth.username || auth.login_email || "System";
}

/** Insert a timeline event. Never throws. */
export async function logSupplierEvent(ev: TimelineEventInput): Promise<void> {
  try {
    await supabaseServer.from("supplier_timeline_events").insert({
      tenant_id: ev.tenant_id,
      supplier_id: ev.supplier_id,
      event_type: ev.event_type,
      event_category: ev.event_category,
      title: ev.title,
      description: ev.description ?? null,
      actor_id: ev.actor_id ?? null,
      actor_name: ev.actor_name ?? null,
      source_module: ev.source_module ?? "suppliers",
      visibility_tier: ev.visibility_tier ?? "internal",
      importance: ev.importance ?? "normal",
      is_manual: ev.is_manual ?? false,
      related_entity_id: ev.related_entity_id ?? null,
      related_entity_type: ev.related_entity_type ?? null,
      metadata: ev.metadata ?? {},
    });
  } catch {
    /* best-effort — never break the triggering write */
  }
}
