import "server-only";

/* Shared id validation for agent mutation tools. DeepSeek occasionally
   TRUNCATES uuids when copying them between turns (observed live
   2026-08-08: a 23-char id — the last group dropped — sent to deleteTodo,
   which then read as "not found" and the model spiralled into denying the
   record existed). A malformed id deserves a self-correcting message, not
   a not-found. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Standard message when a tool receives a malformed/truncated id. */
export const BAD_ID_MESSAGE =
  "That id is malformed or truncated — ids are 36-character UUIDs. Call the list tool again and copy the id EXACTLY as returned.";
