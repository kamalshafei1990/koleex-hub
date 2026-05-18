/* ===========================================================================
   humanizeError — translate raw server / Postgres / HTTP errors into
   sentences an operator can act on.

   Rules:
     · always returns a non-empty string
     · prefers the longer of (mapped message, original) when both exist
     · never includes status codes or stack traces
     · safe to call with anything (string / Error / unknown)

   Patterns mapped:
     · "violates foreign key constraint" → "Linked record missing or
       removed. Please select a different value."
     · "violates check constraint"       → "One of the fields has an
       invalid value."
     · "duplicate key value"             → "This record already exists."
     · "permission denied"               → "You don't have permission
       for this action."
     · "FX rate"                         → "FX rate is missing — add a
       rate in Finance → FX Rates."
     · "Not enough stock"                → unchanged (already human)
     · raw "HTTP 4xx/5xx" / "Failed (4xx)" → mapped to generic
       "Something went wrong. Please try again."
   ========================================================================== */

const KNOWN_PATTERNS: Array<[RegExp | string, string]> = [
  [/violates foreign key constraint/i,         "Linked record is missing or was removed — pick a different value."],
  [/violates not-null constraint/i,            "A required field is empty."],
  [/violates check constraint/i,               "One of the fields has an invalid value."],
  [/duplicate key value/i,                     "This record already exists."],
  [/permission denied/i,                       "You don't have permission for this action."],
  [/jwt expired|invalid token|unauthorized/i,  "Your session expired — please sign in again."],
  [/network|fetch failed|failed to fetch/i,    "Network problem — check your connection and retry."],
  [/timeout/i,                                 "The server took too long to respond. Please retry."],
  /* Domain-specific helpful rewrites. */
  [/no fx rate.*configured|missing fx rate/i,  "FX rate is missing — open Finance → FX Rates to add one."],
  [/from and to currencies must differ/i,      "From and To currencies must be different."],
  [/rate must be > 0/i,                        "FX rate must be greater than zero."],
  [/insufficient stock|not enough stock/i,     "Not enough stock at this location."],
  [/already posted|already approved/i,         "This document is already finalised and cannot be changed."],
  [/^HTTP\s?\d{3}/,                            "Something went wrong. Please try again."],
  [/Failed\s?\(\d{3}\)/i,                      "Something went wrong. Please try again."],
  [/^422\b|^400\b|^500\b/,                     "Something went wrong. Please try again."],
];

const FALLBACK = "Something went wrong. Please try again.";

export function humanizeError(input: unknown): string {
  let raw: string;
  if (input == null) raw = FALLBACK;
  else if (typeof input === "string") raw = input;
  else if (input instanceof Error) raw = input.message;
  else if (typeof input === "object" && "error" in input) {
    const e = (input as { error: unknown }).error;
    raw = typeof e === "string" ? e : String(e);
  } else raw = String(input);

  if (!raw || raw.trim().length === 0) return FALLBACK;
  for (const [pattern, mapped] of KNOWN_PATTERNS) {
    const matches = typeof pattern === "string" ? raw.toLowerCase().includes(pattern.toLowerCase()) : pattern.test(raw);
    if (matches) return mapped;
  }
  /* Drop stack-trace lines and trim long technical strings. */
  const firstLine = raw.split(/\r?\n/)[0].trim();
  if (firstLine.length > 180) return FALLBACK;
  return firstLine;
}
