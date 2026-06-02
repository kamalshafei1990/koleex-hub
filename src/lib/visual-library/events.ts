import "server-only";

/* Append-only audit log helper for visual assets. Fire-and-forget. */

import { supabaseServer } from "@/lib/server/supabase-server";

export async function logVisualAssetEvent(args: {
  tenantId: string;
  assetId: string;
  eventType: string;
  summary?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseServer.from("visual_asset_events").insert({
      tenant_id: args.tenantId,
      asset_id: args.assetId,
      event_type: args.eventType,
      summary: args.summary ?? null,
      actor_id: args.actorId ?? null,
      actor_name: args.actorName ?? null,
      metadata: args.metadata ?? {},
    });
  } catch {
    /* audit logging must never break the request */
  }
}
