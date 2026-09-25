import "server-only";

/* ---------------------------------------------------------------------------
   notes-yjs-server — the server half of real-time co-editing.

   The server stays AUTHORITATIVE:
     · Seeding. A shared note gets its first Yjs state HERE, from body_json,
       exactly once (conditional write). Two clients seeding independently
       would each insert the same text with different CRDT ids and the merge
       would show it twice — so no client ever seeds.
     · Merging. A collaborative save sends the client's full Yjs state; it is
       MERGED into the stored state (never overwrites it), and body_json /
       body_plain are DERIVED from the merged document, so list + search stay
       exactly as before.
     · Keys. Realtime broadcast channels are not access-checked, so every
       Yjs/awareness payload is AES-GCM encrypted with a per-note key handed
       out only by the authorized collab endpoint. The key is derived from
       the note's member list, so removing someone rotates it. Updates are
       additionally MAC'd with a write key that only owner + editors get, so
       a view-only member cannot inject edits into other people's editors.

   Degrades: until notes.yjs_state exists (migration 20260926), collab is
   reported unavailable and the editor keeps the single-editor path.
   --------------------------------------------------------------------------- */

import { createHash, createHmac } from "node:crypto";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { supabaseServer } from "@/lib/server/supabase-server";
import { NOTES_YJS_FIELD, notesSchemaExtensions } from "@/lib/notes-schema";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import type { NoteRole, NoteShareLite } from "@/lib/notes-server";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

let _schema: Schema | null = null;
function schema(): Schema {
  if (!_schema) _schema = getSchema(notesSchemaExtensions());
  return _schema;
}

export function b64encode(u: Uint8Array): string {
  return Buffer.from(u).toString("base64");
}
export function b64decode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

/* ── Availability (is the yjs_state column there?) ─────────────────────── */

let availableCache: { value: boolean; at: number } | null = null;

export async function notesCollabAvailable(): Promise<boolean> {
  if (!collabSecret()) return false;
  const now = Date.now();
  // A positive answer is permanent for the process; a negative one is
  // re-checked every minute so applying the migration takes effect live.
  if (availableCache && (availableCache.value || now - availableCache.at < 60_000)) return availableCache.value;
  const { error } = await supabaseServer.from("notes").select("yjs_state").limit(1);
  const value = !error;
  if (error && error.code !== "42703") console.error("[notes-yjs] probe", error.message);
  availableCache = { value, at: now };
  return value;
}

/* ── Seeding + merging ──────────────────────────────────────────────────── */

/** Build a Yjs state from a TipTap doc (the one-time seed). */
export function seedStateFromJson(bodyJson: unknown): string {
  let doc: Y.Doc;
  try {
    doc = prosemirrorJSONToYDoc(schema(), bodyJson ?? EMPTY_DOC, NOTES_YJS_FIELD);
  } catch (e) {
    // Content the schema can't read (legacy/garbage) — start clean rather
    // than refuse collaboration; body_json itself is untouched until a save.
    console.error("[notes-yjs] seed", e instanceof Error ? e.message : e);
    doc = prosemirrorJSONToYDoc(schema(), EMPTY_DOC, NOTES_YJS_FIELD);
  }
  const out = b64encode(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return out;
}

export type MergeResult =
  | { ok: true; state: string; bodyJson: Record<string, unknown> }
  | { ok: false; error: string };

/** Merge a client's Yjs update into the stored state and derive body_json. */
export function mergeState(stored: string | null, incomingB64: string): MergeResult {
  if (typeof incomingB64 !== "string" || !incomingB64 || incomingB64.length > NOTE_LIMITS.yjsStateChars) {
    return { ok: false, error: "Invalid collaborative update" };
  }
  const doc = new Y.Doc();
  try {
    if (stored) Y.applyUpdate(doc, b64decode(stored));
    Y.applyUpdate(doc, b64decode(incomingB64));
    const state = b64encode(Y.encodeStateAsUpdate(doc));
    if (state.length > NOTE_LIMITS.yjsStateChars) return { ok: false, error: "Note is too large" };
    const bodyJson = yDocToProsemirrorJSON(doc, NOTES_YJS_FIELD) as Record<string, unknown>;
    // Validate the derived document against the schema — a malformed update
    // must not become the note's body.
    schema().nodeFromJSON(bodyJson);
    return { ok: true, state, bodyJson };
  } catch (e) {
    console.error("[notes-yjs] merge", e instanceof Error ? e.message : e);
    return { ok: false, error: "Invalid collaborative update" };
  } finally {
    doc.destroy();
  }
}

/**
 * The note's Yjs state, seeding it (once, conditionally) when absent.
 * Returns null when the column is missing or the read failed.
 */
export async function loadOrSeedState(noteId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("notes")
    .select("yjs_state, body_json")
    .eq("id", noteId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { yjs_state: string | null; body_json: unknown };
  if (row.yjs_state) return row.yjs_state;

  const seeded = seedStateFromJson(row.body_json);
  // Only the first seeder wins; everyone else reads the winner's state.
  const { data: won } = await supabaseServer
    .from("notes")
    .update({ yjs_state: seeded })
    .eq("id", noteId)
    .is("yjs_state", null)
    .select("id");
  if (won && won.length) return seeded;
  const { data: again } = await supabaseServer.from("notes").select("yjs_state").eq("id", noteId).maybeSingle();
  return ((again as { yjs_state?: string | null } | null)?.yjs_state) ?? seeded;
}

/* ── Channel keys ───────────────────────────────────────────────────────── */

function collabSecret(): string | null {
  const s = process.env.NOTES_COLLAB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return s.trim() ? s.trim() : null;
}

export interface CollabKeys {
  /** AES-GCM key (base64, 32 bytes) — every member. */
  k: string;
  /** HMAC key (base64, 32 bytes) for authoring updates — owner + editors only. */
  w: string | null;
  /** Short id of `k`, carried on every message so a stale key is detected. */
  e: string;
}

export function collabKeysFor(
  noteId: string,
  ownerId: string,
  shares: NoteShareLite[],
  role: NoteRole,
): CollabKeys | null {
  const secret = collabSecret();
  if (!secret || !role) return null;
  const members = [ownerId, ...shares.map((s) => s.shared_with_account_id)].sort();
  const editors = [ownerId, ...shares.filter((s) => s.permission === "edit").map((s) => s.shared_with_account_id)].sort();
  const read = createHmac("sha256", secret).update(`notes-collab:r:${noteId}:${members.join(",")}`).digest();
  const write = createHmac("sha256", secret).update(`notes-collab:w:${noteId}:${editors.join(",")}`).digest();
  // The id covers BOTH keys: a permission change rotates the write key, and
  // every peer must notice and refetch.
  const e = createHash("sha256").update(read).update(write).digest("hex").slice(0, 12);
  return {
    k: read.toString("base64"),
    w: role === "owner" || role === "editor" ? write.toString("base64") : null,
    e,
  };
}
