import "server-only";

/* ---------------------------------------------------------------------------
   QA activity logger (Phase 3).

   Append-only timeline writes for qa_issue_activity. Best-effort: a failure
   here must never break the parent mutation, so we swallow + log errors.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ActivityType } from "@/lib/qa/types";

export interface ActivityInput {
  tenant_id: string;
  issue_id: string;
  actor_id: string | null;
  actor_name: string | null;
  activity_type: ActivityType;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, unknown>;
}

/** Insert one or more activity entries. Never throws. */
export async function logActivity(entries: ActivityInput | ActivityInput[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  const rows = list.map((e) => ({
    tenant_id: e.tenant_id,
    issue_id: e.issue_id,
    actor_id: e.actor_id,
    actor_name: e.actor_name,
    activity_type: e.activity_type,
    old_value: e.old_value ?? null,
    new_value: e.new_value ?? null,
    metadata: e.metadata ?? {},
  }));
  const { error } = await supabaseServer.from("qa_issue_activity").insert(rows);
  if (error) console.error("[qa activity insert]", error.message);
}
