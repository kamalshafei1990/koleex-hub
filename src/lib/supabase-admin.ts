import { createClient } from "@supabase/supabase-js";

/* ---------------------------------------------------------------------------
   Untyped Supabase client for admin operations.
   The typed client is too strict for dynamic insert/update from the admin UI.
   --------------------------------------------------------------------------- */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 10 },
    heartbeatIntervalMs: 15000,
    reconnectAfterMs: (tries: number) =>
      [500, 1000, 2000, 4000, 8000][Math.min(tries, 4)],
  },
});
