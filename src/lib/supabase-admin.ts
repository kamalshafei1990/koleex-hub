import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ---------------------------------------------------------------------------
   Untyped Supabase client for admin operations.
   The typed client is too strict for dynamic insert/update from the admin UI.

   Lazy initialization: the client is created on first USE at runtime, not at
   module load. This prevents Next.js prerender from crashing with
   "supabaseUrl is required" when env vars are absent in a given environment
   (e.g. a preview build where NEXT_PUBLIC_SUPABASE_URL is not yet injected).

   Two exports are provided:
     · getSupabaseAdmin() — explicit function form. Preferred for new code.
     · supabaseAdmin      — a lazy Proxy around getSupabaseAdmin() that keeps
                            every existing `supabaseAdmin.from(…)` consumer
                            working without a 25-file migration. Nothing is
                            instantiated until the first property access.
   --------------------------------------------------------------------------- */

let _cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_cached) return _cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "[supabase-admin] Supabase env variables are missing " +
        "(NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  _cached = createClient(url, key, {
    realtime: {
      params: { eventsPerSecond: 10 },
      heartbeatIntervalMs: 15000,
      reconnectAfterMs: (tries: number) =>
        [500, 1000, 2000, 4000, 8000][Math.min(tries, 4)],
    },
  });
  return _cached;
}

/** Lazy Proxy — every property access resolves the real client via
 *  getSupabaseAdmin() on first use. Functions are bound so `this`
 *  stays correct. Zero overhead after the first access (cached). */
export const supabaseAdmin: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop, _receiver) {
      const client = getSupabaseAdmin();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (client as any)[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
