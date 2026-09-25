/* inbox-display — how a stored notification reads on screen. No imports, so
   the bell (on every page) and the mailbox can both use it for free.

   Super-Admin alerts written before 26/09/2026 carry the raw route after the
   module name — "In Product Data (/product-data)" — and the reader saw the
   path as if it were text. The writer (lib/server/audit.ts) no longer adds
   it; this strips it from the rows already stored, which stay in the bell
   until someone reads them. Anything that is not that exact shape is
   returned untouched. */
export function cleanInboxBody(body: string | null | undefined): string {
  if (!body) return "";
  return body.replace(/^(In [^()\n]+?) \(\/[^)\n]*\)$/, "$1");
}
