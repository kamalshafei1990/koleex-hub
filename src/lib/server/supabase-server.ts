import "server-only";

/* ---------------------------------------------------------------------------
   supabase-server — Service-role Supabase client for server-side code only.

   This file imports `server-only`, so any accidental import from a client
   component will fail the build. That's the whole point: the service role
   key must never end up in a browser bundle.

   Usage:
     ONLY inside Next.js route handlers (/app/api/**) or server actions.
     Never from a "use client" component or the hooks in src/lib/use-scope.ts.

   Why service role:
     • Bypasses Row-Level Security, so our route handlers become the
       security boundary (they check session + permissions before reading).
     • Keeps the anon key client-side useless once RLS is enabled with
       deny-by-default — even if someone extracts the anon key from the
       browser bundle, they can't read any data through the public API.

   Required env var:
     SUPABASE_SERVICE_ROLE_KEY — must NOT be prefixed with NEXT_PUBLIC_.
     Copy from Supabase dashboard → Project Settings → API → `service_role`.
     Add to .env.local AND to the Vercel project env vars (Production).
   --------------------------------------------------------------------------- */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Lazy singleton — we defer construction until first use so that
   `next build`'s page-data collection pass doesn't fail on missing
   env vars. Production requests still fail loudly at runtime if the
   service role key isn't configured. */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "[supabase-server] NEXT_PUBLIC_SUPABASE_URL is not set. " +
        "Add it to .env.local and your Vercel environment variables.",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "[supabase-server] SUPABASE_SERVICE_ROLE_KEY is not set.\n\n" +
        "To fix: copy the service_role key from your Supabase dashboard\n" +
        "(Project Settings → API → service_role / secret) and add:\n\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=<the-key>\n\n" +
        "to .env.local AND to your Vercel project's env vars (Production).\n" +
        "Do NOT prefix with NEXT_PUBLIC_ — this key must stay server-side.",
    );
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _client;
}

/**
 * Server-side Supabase client with full (service-role) privileges.
 * RLS is bypassed; API route handlers are the security boundary.
 *
 * Exported as a Proxy so call sites can keep writing `supabaseServer.from(...)`
 * — the underlying client is created lazily on first access. This keeps the
 * file's ergonomics identical to the client-side supabaseAdmin while
 * deferring env-var validation to runtime.
 */
export const supabaseServer: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
});
