import "server-only";

/* ---------------------------------------------------------------------------
   ai/security/account-prefs — the ONE way to write accounts.preferences.

   Phase 7, fixing finding N12.

   THE DEFECT. Three paths wrote that JSONB column and all three did it as
   read-modify-write on the whole document, so any write landing between
   another's read and its write was silently lost. It is reachable in one
   message, because `setReplyLanguage` is fire-and-forget and therefore runs
   concurrently with the entire turn:

       "reply to me in Arabic, and remember my birthday is 3 May"

   Both read the same document; whichever writes second erases the other's key.
   The user asked for two things and one vanished with no error, presenting as
   "the assistant went back to English".

   THE FIX is one SQL statement — `preferences || patch` inside the UPDATE —
   so there is no gap for a concurrent write to fall into. It lives in
   supabase/migrations/account_prefs_merge.sql.

   DEPLOYED. The function is applied and verified on STAGING and on PRODUCTION
   (2026-08-31, owner-applied; verified by querying pg_proc directly:
   SECURITY DEFINER, search_path pinned empty, EXECUTE granted only to postgres
   and service_role). So on both real environments the RPC is the path taken and
   the fallback below is not reached.

   WHY THE FALLBACK REMAINS ANYWAY. A local or newly-branched database will not
   have the function until its migrations are run, and code that assumed the
   function exists would fail a preference write there. Keeping it costs nothing
   at runtime — it is only reached when the RPC reports the function missing.

   Be clear about what the fallback is: it is the BUG, kept as a bridge. It logs
   loudly on every use, so if it ever runs in a deployed environment that is a
   signal the migration was lost, not a quiet degradation back to the behaviour
   this file exists to remove.

   SHALLOW MERGE, DELIBERATELY. Top-level keys are REPLACED, not deep-merged.
   `forget_about_user` works by writing a SMALLER ai_memory object, and a deep
   merge would make key removal impossible — the deleted key would survive
   every attempt to remove it. Verified on staging: writing
   {"ai_memory":{"birthday":…}} after {"ai_memory":{"birthday":…,"city":…}}
   leaves only `birthday`.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";

export type PrefsPatch = Record<string, unknown>;

/** Merge a patch into one account's preferences.
 *
 *  Returns the resulting document, or null when the write failed entirely.
 *  A `null` VALUE in the patch deletes its key — which is what
 *  `setReplyLanguage(null)` means.
 *
 *  Never throws: preference writes sit on paths where a failure must degrade
 *  to "the setting did not save", never to "the turn failed". */
export async function mergeAccountPrefs(
  accountId: string,
  patch: PrefsPatch,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabaseServer.rpc("account_prefs_merge", {
      p_account_id: accountId,
      p_patch: patch,
    });
    if (!error) return (data ?? {}) as Record<string, unknown>;

    /* Distinguish "the function is not deployed here" from a real failure.
       Only the former is worth falling back for — retrying a genuine error
       through a racier path would not help and would hide the error. */
    const missing =
      /could not find the function|does not exist|schema cache/i.test(error.message ?? "");
    if (!missing) {
      console.error("[ai.prefs.merge] rpc failed", error.message);
      return null;
    }
    console.warn(
      "[ai.prefs.merge] account_prefs_merge is NOT DEPLOYED here — falling back to " +
        "read-modify-write, which is the N12 race. Apply " +
        "supabase/migrations/account_prefs_merge.sql to remove this path.",
    );
  } catch (e) {
    console.error("[ai.prefs.merge]", e instanceof Error ? e.message : String(e));
    return null;
  }

  return legacyReadModifyWrite(accountId, patch);
}

/** THE OLD, RACY PATH. Kept only as a bridge until the function is deployed
 *  to production. Every caller of it has already logged a warning. */
async function legacyReadModifyWrite(
  accountId: string,
  patch: PrefsPatch,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabaseServer
      .from("accounts")
      .select("preferences")
      .eq("id", accountId)
      .maybeSingle();
    if (error) return null;

    const prefs = { ...((data?.preferences ?? {}) as Record<string, unknown>) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete prefs[k];
      else prefs[k] = v;
    }

    const { error: wErr } = await supabaseServer
      .from("accounts")
      .update({ preferences: prefs })
      .eq("id", accountId);
    if (wErr) return null;
    return prefs;
  } catch {
    return null;
  }
}
