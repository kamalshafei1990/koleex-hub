/* ---------------------------------------------------------------------------
   note-collab-protocol — the wire contract of a note's realtime channel,
   shared by the server emitter (notes-yjs-server → pingNoteBodyChanged, via
   the Realtime REST broadcast API) and the browser listener (note-collab →
   useNoteCollab). Both sides build the topic, the event name and the ping
   payload HERE, so they cannot drift; scripts/validate-notes-collab.ts
   asserts that they keep doing so.

   A ping carries NO note content — only "someone saved, go refetch" and,
   with `body: true`, "the body changed outside the live session: pull and
   merge the stored Yjs state".
   --------------------------------------------------------------------------- */

/** Broadcast event of a change ping. */
export const NOTE_PING_EVENT = "ping";

/** Broadcast event of end-to-end encrypted Yjs / awareness messages. */
export const NOTE_YJS_EVENT = "y";

/** `by` of a ping the server sends (never a tab id — tab ids are UUIDs). */
export const SERVER_PING_BY = "server";

/** The realtime topic of a note (client channel name = REST topic). */
export function noteTopic(noteId: string): string {
  return `note:${noteId}`;
}

/* A change PING carries NO note content — just "someone saved, go refetch". */
export interface NoteUpdate {
  /** Sender: a tab id, or SERVER_PING_BY. */
  by: string;
  at: string;
  /** The body changed outside the live session (single-editor save). */
  body?: boolean;
}

/** A ping from a tab (`by` = its tab id). */
export function buildNotePing(by: string, opts?: { body?: boolean }): NoteUpdate {
  return { by, at: new Date().toISOString(), ...(opts?.body ? { body: true } : {}) };
}

/** The server's ping after a single-editor body save merged into the state. */
export function buildServerBodyPing(): NoteUpdate {
  return buildNotePing(SERVER_PING_BY, { body: true });
}

/**
 * Read a received ping payload; null for our own tab's echo or garbage.
 * Only a literal `body: true` flags a body change.
 */
export function parseNotePing(payload: unknown, selfTabId: string): NoteUpdate | null {
  if (!payload || typeof payload !== "object") return null;
  const u = payload as Partial<NoteUpdate>;
  if (u.by === selfTabId) return null;
  return {
    by: String(u.by ?? ""),
    at: typeof u.at === "string" ? u.at : new Date().toISOString(),
    ...(u.body === true ? { body: true } : {}),
  };
}
