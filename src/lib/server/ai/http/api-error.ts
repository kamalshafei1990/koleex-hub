import "server-only";

import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
   api-error — one shape for a failure the browser did not cause.

   Thirteen AI routes answered a database or transport failure with
   `{ error: error.message }`: Postgres column names, constraint names and
   RLS hints went to the browser, and the client's humaniser showed them
   (audit, 2026-09-11). The detail belongs in the log, next to a context
   tag; the browser gets a code and one neutral sentence in the envelope the
   client already reads ({ error, message }).
   --------------------------------------------------------------------------- */

const SENTENCE: Record<string, string> = {
  db_error: "Something went wrong on our side. Please try again in a moment.",
  upstream_error: "Koleex AI hit a problem while answering. Please try again.",
};

/** Log the detail under `context`, answer with a code and a neutral sentence. */
export function apiError(status: number, code: keyof typeof SENTENCE, context: string, detail?: unknown): NextResponse {
  const why = detail instanceof Error ? detail.message : typeof detail === "string" ? detail : detail && typeof detail === "object" && "message" in detail ? String((detail as { message: unknown }).message) : "";
  console.error(`[ai.api] ${context} code=${code} status=${status}${why ? ` why=${why.slice(0, 300)}` : ""}`);
  return NextResponse.json({ error: code, message: SENTENCE[code] }, { status });
}

/** The common case: a Supabase query answered with an error. */
export function dbError(context: string, error: unknown): NextResponse {
  return apiError(500, "db_error", context, error);
}
