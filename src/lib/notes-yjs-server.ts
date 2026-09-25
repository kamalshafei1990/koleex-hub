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
     · Single-editor saves. A client on the single-editor path (collab
       unavailable to it for a moment) sends body_json. On a note that has a
       Yjs state, that body is turned into a Yjs update against the stored
       state and merged — never a reset — and live peers are pinged to pull
       the new state (pingNoteBodyChanged). The save is guarded by the
       updated_at concurrency token, so a stale fallback copy gets a 409
       instead of undoing newer collaborative content.
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
import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings } from "@/lib/server/realtime-broadcast";
import { seedStateFromJson } from "@/lib/notes-yjs-merge";
import { NOTE_PING_EVENT, buildServerBodyPing, noteTopic } from "@/lib/note-collab-protocol";
import type { NoteRole, NoteShareLite } from "@/lib/notes-server";

/* The pure CRDT operations live in notes-yjs-merge (no DB, testable alone). */
export {
  applyBodyToState,
  b64decode,
  b64encode,
  mergeState,
  normalizeBody,
  rebaseBody,
  rebaseOntoState,
  seedStateFromJson,
  type BodyToStateResult,
  type MergeResult,
  type RebaseResult,
  type RebaseStateResult,
} from "@/lib/notes-yjs-merge";

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

/* ── Seeding ────────────────────────────────────────────────────────────── */

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

/* ── Out-of-session body changes ───────────────────────────────────────── */

/**
 * Tell a note's live session that its stored Yjs state gained changes that
 * did not travel over the socket (a single-editor save). Content-free, like
 * every ping on this channel: live peers pull the state through the
 * authorized collab endpoint and merge it; solo peers refetch the note.
 * Fire-and-forget.
 */
export async function pingNoteBodyChanged(noteId: string): Promise<void> {
  // Topic, event and payload come from the shared protocol module — the
  // listener (note-collab) parses exactly this shape.
  await emitPings([{
    topic: noteTopic(noteId),
    event: NOTE_PING_EVENT,
    payload: { ...buildServerBodyPing() },
  }]);
}
