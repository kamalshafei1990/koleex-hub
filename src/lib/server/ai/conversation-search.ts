import "server-only";

/* ---------------------------------------------------------------------------
   ai/conversation-search — find the chat where something was said.

   Roadmap C2. The sidebar's search box matched titles and the last preview,
   client-side, over the rows it already had. A price quoted three weeks ago
   is in a message body, not a title, so the box found nothing — which reads
   as "the product forgot". This module is the pure half of the server-side
   answer: what a query has to look like to be worth a database round trip,
   how it is escaped for a LIKE pattern, and how matching rows are reduced to
   one hit per conversation with a snippet around the match.

   OWNER-SCOPED BY CONSTRUCTION (in the route): the search runs over the
   caller's own conversations only — the id list is fetched with the same
   tenant + account pair every conversation read uses, and messages are
   matched inside that list. No new table, no new index: at the current
   volume (a few thousand rows, one megabyte) a filtered ILIKE scan is well
   under the time the network takes; pg_trgm is installed if that ever
   changes, and the route's shape would not.

   WHAT COMES BACK IS TEXT THE CALLER WROTE OR WAS TOLD. Snippets are data
   for a list, never instructions, and never leave the caller's own scope.
   --------------------------------------------------------------------------- */

/** Below this a query matches everything and means nothing. */
export const SEARCH_MIN_CHARS = 2;
/** Above this it is not a search box any more. */
export const SEARCH_MAX_CHARS = 80;
/** How many matching rows the route reads, newest first, before reducing. */
export const SEARCH_SCAN_ROWS = 300;
/** How many conversations a search may name. A list, not an archive dump. */
export const SEARCH_MAX_HITS = 30;
/** The snippet shown under a matched row. One line on a phone. */
export const SNIPPET_CHARS = 110;

/** The query as the database will see it, or null when there is nothing
 *  worth asking: not a string, blank, too short, or too long. Whitespace is
 *  collapsed so "  two   words " and "two words" are the same search. */
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < SEARCH_MIN_CHARS || q.length > SEARCH_MAX_CHARS) return null;
  return q;
}

/** A LIKE pattern that matches the query LITERALLY: the three characters
 *  LIKE reads specially are escaped, so "100%" finds "100%" and not
 *  "100 anything". The database default escape character is a backslash. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The text around the first match, cut to one line with ellipses where it
 *  was cut. Case-insensitive, like the search itself. A content without the
 *  query (a row matched on something the pattern saw differently) falls
 *  back to its opening. */
export function snippetAround(content: string, query: string, width: number = SNIPPET_CHARS): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return `${flat.slice(0, width - 1).trimEnd()}…`;
  const half = Math.floor((width - query.length) / 2);
  let start = Math.max(0, at - half);
  let end = Math.min(flat.length, start + width);
  if (end - start < width) start = Math.max(0, end - width);
  /* Cut on a space where one is near, so the line does not open mid-word. */
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    if (space > at + query.length) end = space;
  }
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

export type SearchRow = { conversation_id: string; content: string | null };
export type SearchHit = { conversation_id: string; snippet: string };

/** One hit per conversation, in the order the rows came (newest first), the
 *  snippet from the newest matching message; capped. Rows without text are
 *  skipped rather than shown as an empty line. */
export function collectHits(rows: readonly SearchRow[], query: string, max: number = SEARCH_MAX_HITS): SearchHit[] {
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (out.length >= max) break;
    if (!row.conversation_id || seen.has(row.conversation_id)) continue;
    if (typeof row.content !== "string" || !row.content.trim()) continue;
    seen.add(row.conversation_id);
    out.push({ conversation_id: row.conversation_id, snippet: snippetAround(row.content, query) });
  }
  return out;
}
