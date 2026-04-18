import "server-only";

import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
   api-cache — single source of truth for the Cache-Control headers we
   add to hot list endpoints. Keeps every "private, max-age=N" string
   out of individual routes so we can tune the whole Hub at once.

     return jsonCached({ rows });            // default 5s
     return jsonCached({ rows }, { maxAge: 10 });

   The resulting response is `private` (never shared cache), short max-age
   (so writes propagate quickly), and `stale-while-revalidate=60` so the
   browser can serve the stale copy instantly while refreshing in the
   background — huge win on rapid back/forward navigation.
   --------------------------------------------------------------------------- */

export interface JsonCachedOpts {
  /** Browser-side freshness window in seconds. Default: 5. */
  maxAge?: number;
  /** Background-refresh window in seconds. Default: 60. */
  staleWhileRevalidate?: number;
  /** Status code. Default: 200. */
  status?: number;
  /** Extra headers to merge in. */
  headers?: Record<string, string>;
}

export function jsonCached(
  body: unknown,
  opts: JsonCachedOpts = {},
): NextResponse {
  const maxAge = opts.maxAge ?? 5;
  const swr = opts.staleWhileRevalidate ?? 60;
  return NextResponse.json(body, {
    status: opts.status ?? 200,
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
      ...(opts.headers ?? {}),
    },
  });
}
