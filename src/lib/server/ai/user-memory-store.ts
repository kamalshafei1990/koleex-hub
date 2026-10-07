import "server-only";

/* ---------------------------------------------------------------------------
   user-memory-store — the ai_memories table as a tiny API.

   One row per fact. Every write is a single atomic UPSERT — the JSON store
   this replaces (accounts.preferences.ai_memory) capped by read-modify-write,
   so two facts saved in the same second could lose one. That race is closed
   here, not narrowed.

   The 25-fact cap still exists, enforced AFTER the upsert by deleting the
   oldest rows beyond the cap — also one statement, also atomic.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../supabase-server";

export const MEMORY_MAX_FACTS = 25;
export const MEMORY_MAX_KEY = 40;
export const MEMORY_MAX_VALUE = 200;

/** All facts for one account, oldest first (the order the cap drops). */
export async function readMemories(accountId: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseServer
    .from("ai_memories")
    .select("key, value")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data as Array<{ key: string; value: string }>) out[row.key] = row.value;
  return out;
}

/** Insert or update one fact, then enforce the cap — both atomic. Returns
 *  false on a database error so the caller can say it failed. */
export async function rememberFact(accountId: string, key: string, value: string): Promise<boolean> {
  const { error } = await supabaseServer
    .from("ai_memories")
    .upsert(
      { account_id: accountId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "account_id,key" },
    );
  if (error) return false;

  /* Cap: drop everything older than the newest 25. The sub-select rides the
     (account_id, created_at) index — a handful of rows, always. */
  const { error: capError } = await supabaseServer.rpc("ai_memories_cap", {
    p_account_id: accountId,
    p_keep: MEMORY_MAX_FACTS,
  });
  return !capError;
}

export async function forgetFact(accountId: string, key: string): Promise<boolean> {
  const { error } = await supabaseServer
    .from("ai_memories")
    .delete()
    .eq("account_id", accountId)
    .eq("key", key);
  return !error;
}

export async function forgetAllFacts(accountId: string): Promise<boolean> {
  const { error } = await supabaseServer
    .from("ai_memories")
    .delete()
    .eq("account_id", accountId);
  return !error;
}
