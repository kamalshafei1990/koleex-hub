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
  return dayFirst(body.replace(/^(In [^()\n]+?) \(\/[^)\n]*\)$/, "$1"));
}

/** A stored subject, as it reads on screen (see dayFirst). */
export function cleanInboxSubject(subject: string | null | undefined): string {
  return subject ? dayFirst(subject) : "";
}

/* Rows written before the templates (26/09/2026) keep the dates their
   writers printed: ISO, "Attendance closed automatically — 2026-09-20".
   The owner's rule is day first, so a bare ISO calendar date reads as
   20/09/2026 on screen. Only a whole YYYY-MM-DD token with a real month and
   day is rewritten; a timestamp (…T08:00) or anything else stays as it is. */
function dayFirst(text: string): string {
  return text.replace(/\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b(?!T\d)/g, "$3/$2/$1");
}
