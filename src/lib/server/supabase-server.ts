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
   service role key isn't configured.

   Previously this file exported a Proxy around the client so the
   client could be created on first access. Turned out the Proxy was
   interfering with how @supabase/supabase-js carries auth headers
   between calls — service_role requests were arriving at PostgREST
   with bad auth and 403'ing. Now we just call getSupabaseServer()
   explicitly at the top of each route handler. */

let _client: SupabaseClient | null = null;

/**
 * Defensively normalise an env-var value. `vercel env pull` and some
 * shells occasionally leave wrapping double-quotes or a trailing `\n`
 * in place, which then pass through `process.env` unchanged and poison
 * every downstream URL / JWT string. Stripping them here means a dirty
 * .env.local won't take the whole auth layer down — we fail loudly on
 * truly-empty values instead of mysteriously 500'ing on sign-in.
 */
function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw == null) return null;
  let v = raw.trim();
  // Strip a single pair of surrounding single- or double-quotes.
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  // Strip an escaped trailing newline that `vercel env pull` sometimes
  // writes ("\n" literal inside quotes).
  if (v.endsWith("\\n")) v = v.slice(0, -2).trim();
  // And strip a real trailing newline just in case.
  if (v.endsWith("\n")) v = v.slice(0, -1).trim();
  return v === "" ? null : v;
}

export function getSupabaseServer(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error(
      "[supabase-server] NEXT_PUBLIC_SUPABASE_URL is not set (or is empty after trimming quotes/whitespace).",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "[supabase-server] SUPABASE_SERVICE_ROLE_KEY is not set (or is empty after trimming quotes/whitespace).\n" +
        "Copy the service_role key from Supabase dashboard → Settings → " +
        "API Keys (Legacy) → service_role secret, then set it in Vercel + " +
        ".env.local as SUPABASE_SERVICE_ROLE_KEY=<key> — no quotes, no trailing newline, no NEXT_PUBLIC_ prefix.",
    );
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Explicitly set the Authorization + apikey headers. Some runtime
      // environments strip the auth setup when the client is instantiated
      // lazily behind a Proxy; forcing the headers here makes every
      // request carry the service_role bearer token unambiguously.
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
    },
  });
  return _client;
}

/**
 * Back-compat: keep exporting `supabaseServer` so existing route handlers
 * don't need to be rewritten. This is now a getter — it calls
 * getSupabaseServer() on every access to return the singleton.
 */
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getSupabaseServer() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
});
