import "server-only";

/* ---------------------------------------------------------------------------
   notes-history-server — version snapshots + note-to-note links.

   Both run AFTER a content save has landed (next/server `after()`), so they
   never slow the save down, and both are best-effort: until migration
   20260926_notes_additions.sql creates note_versions / note_links, a failed
   insert is logged once and the save itself is unaffected.

     · Versions: at most one automatic snapshot per note every
       NOTE_LIMITS.versionEveryMs, plus explicit "Save version"; the oldest
       beyond NOTE_LIMITS.versions are pruned.
     · Links: note_links(from, to) is REPLACED from body_json on every body
       save, restricted to notes that exist in the same tenant.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import { extractNoteLinks } from "@/lib/notes-schema";

const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(msg);
}

export interface SnapshotInput {
  noteId: string;
  tenantId: string;
  accountId: string;
  title: string;
  bodyJson: unknown;
  /** Explicit "Save version" / pre-restore: skip the 10-minute throttle. */
  force?: boolean;
}

export async function snapshotVersion(input: SnapshotInput): Promise<{ ok: boolean; id?: string; skipped?: boolean }> {
  try {
    if (!input.force) {
      const { data: last, error: lastErr } = await supabaseServer
        .from("note_versions")
        .select("created_at")
        .eq("note_id", input.noteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr) { warnOnce("versions", `[notes-history] versions unavailable: ${lastErr.message}`); return { ok: false }; }
      const lastAt = last ? new Date((last as { created_at: string }).created_at).getTime() : 0;
      if (Date.now() - lastAt < NOTE_LIMITS.versionEveryMs) return { ok: true, skipped: true };
    }

    const { data, error } = await supabaseServer
      .from("note_versions")
      .insert({
        note_id: input.noteId,
        tenant_id: input.tenantId,
        account_id: input.accountId,
        title: input.title ?? "",
        body_json: input.bodyJson ?? null,
      })
      .select("id")
      .single();
    if (error) { warnOnce("versions", `[notes-history] versions unavailable: ${error.message}`); return { ok: false }; }

    await pruneVersions(input.noteId);
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    console.error("[notes-history] snapshot", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

async function pruneVersions(noteId: string): Promise<void> {
  const { data } = await supabaseServer
    .from("note_versions")
    .select("id")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false })
    .range(NOTE_LIMITS.versions, NOTE_LIMITS.versions + 500);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ids.length) await supabaseServer.from("note_versions").delete().in("id", ids);
}

/** Replace the outgoing links of `noteId` from its body. */
export async function syncNoteLinks(noteId: string, tenantId: string, bodyJson: unknown): Promise<void> {
  try {
    const targets = extractNoteLinks(bodyJson).filter((id) => id !== noteId);
    let valid: string[] = [];
    if (targets.length) {
      const { data } = await supabaseServer
        .from("notes")
        .select("id")
        .in("id", targets)
        .eq("tenant_id", tenantId);
      valid = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    const { error: delErr } = await supabaseServer.from("note_links").delete().eq("from_note_id", noteId);
    if (delErr) { warnOnce("links", `[notes-history] links unavailable: ${delErr.message}`); return; }
    if (valid.length) {
      const { error } = await supabaseServer
        .from("note_links")
        .insert(valid.map((to) => ({ from_note_id: noteId, to_note_id: to, tenant_id: tenantId })));
      if (error) warnOnce("links-insert", `[notes-history] links insert: ${error.message}`);
    }
  } catch (e) {
    console.error("[notes-history] links", e instanceof Error ? e.message : e);
  }
}

/** Everything that follows a landed content save. */
export async function afterContentSaved(input: {
  noteId: string;
  tenantId: string;
  accountId: string;
  title: string;
  bodyJson: unknown;
  bodyChanged: boolean;
}): Promise<void> {
  await Promise.all([
    snapshotVersion({ ...input }),
    input.bodyChanged ? syncNoteLinks(input.noteId, input.tenantId, input.bodyJson) : Promise.resolve(),
  ]);
}
