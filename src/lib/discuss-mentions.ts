/* ---------------------------------------------------------------------------
   discuss-mentions — pure helpers for the composer's @mention autocomplete.

   The ONE mention format (shared with the @ picker and read by the server's
   push filter for "Mentions only"): the body carries `@username`, and
   metadata.mentions carries { account_id, username, offset, length } where
   offset/length cover `@username` in the FINAL body that is sent.
   --------------------------------------------------------------------------- */

import type { DiscussMention } from "@/types/supabase";

/** Characters a username may contain in a mention query. */
const QUERY_CHAR = /[^\s@]/;
const MAX_QUERY = 32;

/** The "@query" the caret is currently inside, or null. `start` is the index
 *  of the "@". An "@" only opens a mention at the start of the text or right
 *  after whitespace/an opening bracket, so emails ("a@b.com") never trigger. */
export function findMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  if (caret < 1 || caret > text.length) return null;
  let i = caret - 1;
  while (i >= 0 && caret - i <= MAX_QUERY + 1) {
    const ch = text[i];
    if (ch === "@") {
      const before = i === 0 ? "" : text[i - 1];
      if (before && !/[\s([{"'“‘（【]/.test(before)) return null;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    if (!QUERY_CHAR.test(ch)) return null;
    i -= 1;
  }
  return null;
}

/** Rank people for a query: username/name prefix first, then substring. */
export function rankMentionCandidates<T extends { username: string; full_name: string | null; name_alt?: string | null }>(
  people: T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return people.slice(0, limit);
  const scored: Array<{ p: T; s: number }> = [];
  for (const p of people) {
    const u = p.username.toLowerCase();
    const n = (p.full_name ?? "").toLowerCase();
    const a = (p.name_alt ?? "").toLowerCase();
    let s = -1;
    if (u.startsWith(q)) s = 0;
    else if (n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q))) s = 1;
    else if (a && a.includes(q)) s = 2;
    else if (u.includes(q) || n.includes(q)) s = 3;
    if (s >= 0) scored.push({ p, s });
  }
  scored.sort((x, y) => x.s - y.s || x.p.username.localeCompare(y.p.username));
  return scored.slice(0, limit).map((x) => x.p);
}

/** Rebuild metadata.mentions against the body that is ACTUALLY sent.
 *
 *  Offsets recorded while typing drift: text is edited before a mention, the
 *  body is trimmed at send, a mention is deleted by hand. So at send time we
 *  keep only the people whose `@username` still appears (as a whole token)
 *  and recompute every occurrence's offset. One entry per occurrence, so the
 *  renderer highlights each; the push filter only needs the account ids. */
export function normalizeMentions(body: string, mentions: DiscussMention[]): DiscussMention[] {
  if (!body || mentions.length === 0) return [];
  const byUser = new Map<string, DiscussMention>();
  for (const m of mentions) if (m.username && !byUser.has(m.username)) byUser.set(m.username, m);
  const out: DiscussMention[] = [];
  for (const [username, m] of byUser) {
    const token = `@${username}`;
    let from = 0;
    for (;;) {
      const at = body.indexOf(token, from);
      if (at === -1) break;
      const before = at === 0 ? "" : body[at - 1];
      const after = body[at + token.length] ?? "";
      const okBefore = !before || !/[\w@.]/.test(before);
      const okAfter = !after || !/[\w-]/.test(after);
      if (okBefore && okAfter) {
        out.push({ account_id: m.account_id, username, offset: at, length: token.length });
      }
      from = at + token.length;
    }
  }
  return out.sort((a, b) => a.offset - b.offset);
}
