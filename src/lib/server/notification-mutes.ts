import "server-only";

/* ---------------------------------------------------------------------------
   notification-mutes — "Stop notifications about this", on the server.

   A mute is (the reader, the topic's metadata key and value, the types it
   silences) — lib/notification-mute decides which topics can be muted. The
   inbox_apply_mutes trigger (20260927_notification_mutes.sql) files every
   later row about it straight into the Archive, for every writer; the push
   sender asks mutedRecipients() before it sends. Muting also quietens what
   is already unread about that topic.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { notificationTypeDef } from "@/lib/notification-types";
import { muteKeyOf, muteTypes } from "@/lib/notification-mute";

export type MuteRow = {
  id: string;
  field: string;
  value: string;
  types: string[];
  app: string | null;
  label: string | null;
  tpl: unknown;
  created_at: string;
};

const MUTES = "notification_mutes";
const COLS = "id, field, value, types, app, label, tpl, created_at";

export async function listMutes(accountId: string): Promise<MuteRow[] | null> {
  const { data, error } = await supabaseServer.from(MUTES).select(COLS)
    .eq("account_id", accountId).order("created_at", { ascending: false }).limit(200);
  if (error) { console.error("[notification-mutes] list:", error.message); return null; }
  return (data ?? []) as MuteRow[];
}

export type MuteResult = { ok: true; mute: MuteRow } | { ok: false; status: number; error: string };

/** Mute the topic of one of the reader's own notifications. */
export async function muteTopicOf(accountId: string, inboxId: string): Promise<MuteResult> {
  const { data: row, error } = await supabaseServer.from("inbox_messages")
    .select("id, tenant_id, subject, metadata")
    .eq("id", inboxId).eq("recipient_account_id", accountId).maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!row) return { ok: false, status: 404, error: "not_found" };
  const meta = ((row as { metadata: Record<string, unknown> | null }).metadata ?? {}) as Record<string, unknown>;
  const def = notificationTypeDef(meta.type ?? meta.kind);
  const key = muteKeyOf(def);
  const value = key ? meta[key] : null;
  if (!def || !key || typeof value !== "string" || !value) return { ok: false, status: 400, error: "not_mutable" };
  const types = muteTypes(def.app, key);

  const { data: saved, error: saveErr } = await supabaseServer.from(MUTES).upsert({
    account_id: accountId,
    tenant_id: (row as { tenant_id: string | null }).tenant_id,
    field: key,
    value,
    types,
    app: def.app,
    label: (row as { subject: string }).subject,
    /* The row's template as stored (never through notification-templates:
       its dictionary would ride web-push's cold start). */
    tpl: meta.tpl && typeof meta.tpl === "object" ? meta.tpl : null,
  }, { onConflict: "account_id,field,value" }).select(COLS).single();
  if (saveErr || !saved) return { ok: false, status: 500, error: saveErr?.message ?? "save_failed" };

  /* What is already unread about it goes quiet too. */
  const { error: readErr } = await supabaseServer.from("inbox_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_account_id", accountId).is("read_at", null)
    .eq(`metadata->>${key}`, value).in("metadata->>type", types);
  if (readErr) console.error("[notification-mutes] quieten:", readErr.message);
  return { ok: true, mute: saved as MuteRow };
}

/** Unmute: the reader's own mute only. */
export async function unmute(accountId: string, muteId: string): Promise<boolean> {
  const { error } = await supabaseServer.from(MUTES).delete().eq("id", muteId).eq("account_id", accountId);
  if (error) console.error("[notification-mutes] unmute:", error.message);
  return !error;
}

/** Who among these recipients muted what this push is about: a mute of
 *  its kind whose topic (an id) the push's tag or link names — every
 *  writer's tag and link carry the id of what they are about. */
export async function mutedRecipients(
  ids: string[],
  payload: { kind?: string; tag?: string; url?: string },
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!payload.kind || ids.length === 0) return out;
  const { data, error } = await supabaseServer.from(MUTES).select("account_id, value")
    .in("account_id", ids).contains("types", [payload.kind]);
  if (error) { console.error("[notification-mutes] push check:", error.message); return out; }
  const about = `${payload.tag ?? ""} ${payload.url ?? ""}`;
  for (const m of (data ?? []) as Array<{ account_id: string; value: string }>) {
    if (m.value && about.includes(m.value)) out.add(m.account_id);
  }
  return out;
}
