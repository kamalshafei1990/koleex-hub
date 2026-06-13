"use client";

/* ---------------------------------------------------------------------------
   supabase-browser — accessor for the browser-side Supabase client used for
   Realtime (presence + broadcast) in the Quotations collaboration layer.

   Reuses the SINGLE app-wide anon client (`supabaseAdmin`, which despite its
   name is the public anon-key client already used for Discuss + QA realtime).
   Reusing it avoids the "Multiple GoTrueClient instances" warning and inherits
   the shared websocket + reconnect tuning.

   Returns null (instead of throwing) when env is missing, so callers degrade
   gracefully to "no realtime".
   --------------------------------------------------------------------------- */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}
