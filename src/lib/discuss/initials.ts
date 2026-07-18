/* Avatar initials for Discuss.
   ────────────────────────────────────────────────────────────────────────────
   Extracted from DiscussApp so the rule can be tested directly rather than
   asserted through the DOM.

   The defect this fixes: the previous version took the first CHARACTER of the
   last whitespace-separated token, whatever that character was. Real display
   names carry parenthetical and punctuation tokens — "KXPERF Sender (fixture)",
   "Li Wei (Sales)" — so the avatar rendered "K(" and "L(" instead of initials.
   A token is only a name word if it STARTS with a letter or a number. */

/** First letter/number of `first` + of `last`, ignoring punctuation tokens.
 *  Single word → its first two characters. No usable characters → "?". */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // \p{L}/\p{N} rather than A-Z: display names are also Chinese and Arabic.
  const parts = trimmed.split(/\s+/).filter((p) => /^[\p{L}\p{N}]/u.test(p));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
