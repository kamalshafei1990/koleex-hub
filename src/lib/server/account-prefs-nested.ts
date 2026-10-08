import "server-only";

/* ---------------------------------------------------------------------------
   account-prefs-nested — mergeAccountPrefs, one level deeper for named slices.

   Settings audit, 29/09/2026. mergeAccountPrefs REPLACES each top-level slice,
   so a writer that owns only part of a slice had to send the whole slice from
   its own copy, and a stale copy put back what another writer had just
   changed (Display vs. Language & region inside `display`; Settings →
   Notifications vs. the bell's pause inside `notifications`).

   account_prefs_merge_nested (supabase/migrations/account_prefs_merge_nested.sql)
   merges the slices named in `deep` object-into-object, atomically, so a writer
   can send only the fields it changed. Everything else behaves exactly as
   mergeAccountPrefs. Where the function is not deployed (a fresh local
   database), this falls back to mergeAccountPrefs with the same patch — the
   old, slice-replacing behaviour — and says so in the log.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";
import { mergeAccountPrefs, type PrefsPatch } from "./ai/security/account-prefs";

/** Slices whose fields are written by more than one screen. */
export const NESTED_PREF_SLICES = ["display", "notifications", "calendar"] as const;

export async function mergeAccountPrefsNested(
  accountId: string,
  patch: PrefsPatch,
  deep: readonly string[] = NESTED_PREF_SLICES,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabaseServer.rpc("account_prefs_merge_nested", {
      p_account_id: accountId,
      p_patch: patch,
      p_deep: [...deep],
    });
    if (!error) return (data ?? {}) as Record<string, unknown>;
    const missing = /could not find the function|does not exist|schema cache/i.test(error.message ?? "");
    if (!missing) {
      console.error("[prefs.merge.nested] rpc failed", error.message);
      return null;
    }
    console.warn("[prefs.merge.nested] account_prefs_merge_nested is not deployed here — slices are replaced, not merged");
  } catch (e) {
    console.error("[prefs.merge.nested] rpc threw", e instanceof Error ? e.message : e);
    return null;
  }
  return mergeAccountPrefs(accountId, patch);
}
