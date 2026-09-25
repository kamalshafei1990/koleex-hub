import "server-only";

/* ---------------------------------------------------------------------------
   notes-server — authorization + validation for the Notes API.

   Replaces src/lib/server/note-access.ts for the Notes routes:
     · ONE round-trip resolves the caller's role: the note row and its share
       rows are fetched in parallel (was up to three sequential queries).
     · A trashed note is reachable by its OWNER only — sharees lose access
       the moment it is moved to Recently Deleted.
     · Explicit per-field whitelists for create/update (no mass assignment),
       size caps, and folder ownership / cycle checks.

     owner   — note.account_id === caller            (full control)
     editor  — note_shares.permission = 'edit'        (read + edit content)
     viewer  — note_shares.permission = 'view'        (read only)
     null    — no relationship, or trashed for a sharee (404)
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { NOTE_COLOR_RE, NOTE_LIMITS, NOTES_BUCKET, UUID_RE } from "@/lib/notes-policy";
import { extractPlainText } from "@/lib/notes-text";

export type NoteRole = "owner" | "editor" | "viewer" | null;

export interface NoteShareLite {
  id: string;
  shared_with_account_id: string;
  permission: "view" | "edit";
}

export interface NoteAccess<T = Record<string, unknown>> {
  role: NoteRole;
  ownerId: string | null;
  tenantId: string | null;
  /** The note row (requested columns), or null when it does not exist. */
  note: (T & { id: string; account_id: string; tenant_id: string; deleted_at: string | null }) | null;
  /** Every share row of the note — lets callers derive is_shared. */
  shares: NoteShareLite[];
}

const BASE_COLS = ["id", "account_id", "tenant_id", "deleted_at"];

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export async function getNoteAccess<T = Record<string, unknown>>(
  noteId: string,
  accountId: string,
  cols = "",
): Promise<NoteAccess<T>> {
  const none: NoteAccess<T> = { role: null, ownerId: null, tenantId: null, note: null, shares: [] };
  if (!isUuid(noteId)) return none;

  const select =
    cols.trim() === "*"
      ? "*"
      : Array.from(new Set([...BASE_COLS, ...cols.split(",").map((c) => c.trim()).filter(Boolean)])).join(", ");

  const [noteRes, shareRes] = await Promise.all([
    supabaseServer.from("notes").select(select).eq("id", noteId).maybeSingle(),
    supabaseServer
      .from("note_shares")
      .select("id, shared_with_account_id, permission")
      .eq("note_id", noteId),
  ]);

  const note = noteRes.data as unknown as NoteAccess<T>["note"];
  if (noteRes.error) console.error("[notes-server] getNoteAccess", noteRes.error.message);
  if (!note) return none;
  const shares = ((shareRes.data ?? []) as unknown as NoteShareLite[]);

  const base = { ownerId: note.account_id, tenantId: note.tenant_id, note, shares };
  if (note.account_id === accountId) return { role: "owner", ...base };
  // Trash is owner-only: a sharee must not keep reading a deleted note.
  if (note.deleted_at) return { role: null, ...base };
  const mine = shares.find((s) => s.shared_with_account_id === accountId);
  if (!mine) return { role: null, ...base };
  return { role: mine.permission === "view" ? "viewer" : "editor", ...base };
}

export function canRead(role: NoteRole): boolean {
  return role === "owner" || role === "editor" || role === "viewer";
}

export function canWrite(role: NoteRole): boolean {
  return role === "owner" || role === "editor";
}

/* ── Validation ─────────────────────────────────────────────────────────── */

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export interface NoteWritable {
  title?: string;
  body_json?: unknown;
  body_plain?: string;
  color?: string | null;
  tags?: string[];
  folder_id?: string | null;
  is_pinned?: boolean;
}

/** Content fields a shared editor may change — never the owner's folder/pin. */
const CONTENT_FIELDS = ["title", "body_json", "color", "tags"] as const;
const OWNER_FIELDS = [...CONTENT_FIELDS, "folder_id", "is_pinned"] as const;

/**
 * Whitelist + validate a note create/update body. Unknown keys are ignored;
 * body_plain is always DERIVED from body_json here, never taken from the
 * client. folder_id ownership is checked separately (needs the DB).
 */
export function validateNoteInput(
  input: unknown,
  role: "owner" | "editor",
): Validated<NoteWritable> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid request body" };
  }
  const src = input as Record<string, unknown>;
  const allowed: readonly string[] = role === "owner" ? OWNER_FIELDS : CONTENT_FIELDS;
  const out: NoteWritable = {};

  for (const k of allowed) {
    if (!(k in src)) continue;
    const v = src[k];
    switch (k) {
      case "title":
        if (typeof v !== "string") return { ok: false, error: "Invalid title" };
        if (v.length > NOTE_LIMITS.title) return { ok: false, error: "Title is too long" };
        out.title = v;
        break;
      case "body_json": {
        if (v !== null && (typeof v !== "object" || Array.isArray(v))) {
          return { ok: false, error: "Invalid body" };
        }
        let size = 0;
        try { size = JSON.stringify(v ?? null).length; } catch { return { ok: false, error: "Invalid body" }; }
        if (size > NOTE_LIMITS.bodyJsonBytes) return { ok: false, error: "Note is too large" };
        out.body_json = v;
        out.body_plain = extractPlainText(v);
        break;
      }
      case "color":
        if (v === null) { out.color = null; break; }
        if (typeof v !== "string" || !NOTE_COLOR_RE.test(v)) return { ok: false, error: "Invalid colour" };
        out.color = v;
        break;
      case "tags": {
        if (!Array.isArray(v) || v.length > NOTE_LIMITS.tags) return { ok: false, error: "Invalid tags" };
        const tags: string[] = [];
        for (const t of v) {
          if (typeof t !== "string") return { ok: false, error: "Invalid tags" };
          const s = t.trim();
          if (!s) continue;
          if (s.length > NOTE_LIMITS.tag) return { ok: false, error: "Tag is too long" };
          if (!tags.some((x) => x.toLowerCase() === s.toLowerCase())) tags.push(s);
        }
        out.tags = tags;
        break;
      }
      case "folder_id":
        if (v !== null && !isUuid(v)) return { ok: false, error: "Invalid folder" };
        out.folder_id = v as string | null;
        break;
      case "is_pinned":
        if (typeof v !== "boolean") return { ok: false, error: "Invalid pin state" };
        out.is_pinned = v;
        break;
    }
  }
  return { ok: true, value: out };
}

/** True when `folderId` is a folder owned by `accountId`. */
export async function ownsFolder(folderId: string, accountId: string): Promise<boolean> {
  if (!isUuid(folderId)) return false;
  const { data } = await supabaseServer
    .from("notes_folders")
    .select("id")
    .eq("id", folderId)
    .eq("account_id", accountId)
    .maybeSingle();
  return data !== null;
}

/**
 * Would re-parenting `folderId` under `newParentId` create a cycle? Walks up
 * from the new parent through the caller's own folders; the visited set also
 * stops on any cycle that already exists in the data.
 */
export async function folderWouldCycle(
  accountId: string,
  folderId: string,
  newParentId: string,
): Promise<boolean> {
  if (folderId === newParentId) return true;
  const { data } = await supabaseServer
    .from("notes_folders")
    .select("id, parent_id")
    .eq("account_id", accountId);
  const parentOf = new Map(
    ((data ?? []) as Array<{ id: string; parent_id: string | null }>).map((f) => [f.id, f.parent_id]),
  );
  const seen = new Set<string>();
  let cur: string | null | undefined = newParentId;
  while (cur) {
    if (cur === folderId) return true;
    if (seen.has(cur)) return true; // pre-existing loop — refuse to extend it
    seen.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}

/* ── Search ─────────────────────────────────────────────────────────────── */

/**
 * Build a PostgREST `.or()` filter matching `term` (case-insensitive,
 * substring) in any of `columns`. LIKE wildcards (% _ \) are escaped so they
 * match literally, and the value is double-quoted so PostgREST's own
 * reserved characters (, ( ) ") cannot break or extend the filter tree.
 */
export function ilikeAny(columns: string[], term: string): string {
  const like = term.slice(0, NOTE_LIMITS.search).replace(/[\\%_]/g, (m) => "\\" + m);
  const quoted = `"%${like.replace(/["\\]/g, (m) => "\\" + m)}%"`;
  return columns.map((c) => `${c}.ilike.${quoted}`).join(",");
}

/* ── Private note images ────────────────────────────────────────────────── */

export function noteImagePrefix(tenantId: string, noteId: string): string {
  return `${tenantId}/${noteId}`;
}

/**
 * Remove every stored image of the given notes. Best-effort: a missing bucket
 * (migration not applied yet) or a storage hiccup must never block a purge.
 */
export async function removeNoteImages(notes: Array<{ id: string; tenant_id: string }>): Promise<void> {
  for (const n of notes) {
    try {
      const prefix = noteImagePrefix(n.tenant_id, n.id);
      const { data } = await supabaseServer.storage.from(NOTES_BUCKET).list(prefix, { limit: 1000 });
      const paths = (data ?? []).map((o) => `${prefix}/${o.name}`);
      if (paths.length) await supabaseServer.storage.from(NOTES_BUCKET).remove(paths);
    } catch (e) {
      console.error("[notes-server] removeNoteImages", e instanceof Error ? e.message : e);
    }
  }
}

/**
 * Permanently delete notes (and their shares + private images). Callers have
 * already authorized every id.
 */
export async function purgeNotes(notes: Array<{ id: string; tenant_id: string }>): Promise<{ ok: boolean }> {
  // Chunked so a large trash never builds an over-long `in.(…)` URL.
  const CHUNK = 100;
  for (let i = 0; i < notes.length; i += CHUNK) {
    const batch = notes.slice(i, i + CHUNK);
    const ids = batch.map((n) => n.id);
    const { error: shareErr } = await supabaseServer.from("note_shares").delete().in("note_id", ids);
    if (shareErr) console.error("[notes-server] purge shares", shareErr.message);
    const { error } = await supabaseServer.from("notes").delete().in("id", ids);
    if (error) {
      console.error("[notes-server] purge notes", error.message);
      return { ok: false };
    }
    await removeNoteImages(batch);
  }
  return { ok: true };
}
