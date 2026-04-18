/* ---------------------------------------------------------------------------
   mail/supabase-server — server-role Supabase client for mail operations.

   This client uses SUPABASE_SERVICE_ROLE_KEY (NOT the public anon key)
   so it can read the `mail_connections.password_encrypted` column and
   insert rows into `inbox_messages` regardless of RLS policies.

   MUST only be imported from API routes / server actions / background
   jobs. Accidentally importing this into a client component would leak
   the service-role key into the browser bundle. The env-var guard below
   throws hard at first use if the key is missing, so misconfiguration
   is obvious at the first request rather than silently falling back to
   anon permissions.
   --------------------------------------------------------------------------- */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let _cached: SupabaseClient<Database> | null = null;

/** Returns a memoized Supabase client scoped to the service role. We
 *  lazily create it so modules that import this file but never call
 *  the getter (e.g. type-only imports) don't crash builds that lack
 *  the env var. */
export function getServerSupabase(): SupabaseClient<Database> {
  if (_cached) return _cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "[mail/supabase-server] NEXT_PUBLIC_SUPABASE_URL is not set.",
    );
  }
  if (!key) {
    throw new Error(
      "[mail/supabase-server] SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Copy it from Supabase Studio → Project Settings → API and add " +
        "it to Vercel env vars. This key bypasses RLS — never expose it " +
        "to the browser.",
    );
  }

  _cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _cached;
}
