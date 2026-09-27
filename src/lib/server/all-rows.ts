import "server-only";

/* ---------------------------------------------------------------------------
   allRows — read EVERY row of a query, past the API's 1000-row cap.

   WHY. The Supabase API hands back at most 1000 rows a read and says nothing
   about the rest: `.limit(10000)` and `.range(0, 4999)` on a 3,806-row table
   both returned exactly 1000 rows, no error (measured 27 Sep 2026). A read
   that asked for "up to 5000" quietly lost its tail — short counts, missing
   rows — and nothing failed while the tables were small. Three pages were
   already wrong that day: Super Admin usage (5,509 events in 30 days), AI
   usage (1,601 messages) and staff readiness (2,479 skill requirements).

   HOW. Pass the query, sorted in a stable order (`.order("id")` last, as the
   tiebreaker), without a limit. It is read 1000 rows at a time until a page
   comes back short, so a query with fewer than 1000 rows costs exactly one
   request, as before. supabase-js re-sends a query each time it is awaited,
   and `range()` replaces the previous offset, so one query object serves
   every page. The pages run one after another: never mutate the query
   while this runs.

   The result has the shape of a supabase-js read ({ data, error }), so a
   call site keeps its own error handling. The first error wins. A read that
   reaches `max` (100,000 unless the caller sets a smaller sample size) stops
   there and says so in the log, never silently.

   validate:read-limits fails on a new `.limit()` above 1000 that is not
   allow-listed with its reason.
   --------------------------------------------------------------------------- */

export const API_PAGE = 1000;
const MAX_ROWS = 100_000;

export interface AllRowsResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** A supabase-js select that can be ranged and awaited. */
export interface Rangeable {
  range(from: number, to: number): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/* Rows come back untyped, exactly as from the (untyped) supabase-js client
   the call sites used before — each casts to its own row type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allRows<T = any>(query: Rangeable, label = "read", max = MAX_ROWS): Promise<AllRowsResult<T>> {
  const out: T[] = [];
  for (let from = 0; from < max; from += API_PAGE) {
    const size = Math.min(API_PAGE, max - from);
    const { data, error } = await query.range(from, from + size - 1);
    if (error) return { data: null, error };
    const rows = (data as T[] | null) ?? [];
    out.push(...rows);
    if (rows.length < size) return { data: out, error: null };
  }
  console.error(`[all-rows] ${label}: stopped at ${max} rows — narrow the query or total it in the database`);
  return { data: out, error: null };
}

/** allRows for code that throws on a failed read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function allRowsOrThrow<T = any>(label: string, query: Rangeable): Promise<T[]> {
  const { data, error } = await allRows<T>(query, label);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}
