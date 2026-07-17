/* kxperf — fixture integrity. ONE cleanup path, used by every benchmark.
   ────────────────────────────────────────────────────────────────────────────
   This exists because my per-spec cleanup leaked probe rows into the staging
   fixture THREE times (5005, 5013, 5012). Each spec had its own slightly
   different inline cleanup, and each was wrong in the same two ways:

   1. IT RACED THE SENDS. It deleted N seconds after the last Enter keypress,
      but a send still in flight lands afterwards — so rows appeared *after* the
      delete ran. Waiting longer is not a fix, it is a longer race.
   2. IT TRUSTED A SINGLE SELECT. When the select hit a transient error it
      returned no rows, `ids` was empty, the delete no-opped, and the run
      reported success while 13 rows survived. A failed read looked exactly like
      "nothing to clean".

   The fix is to converge instead of guess: delete-and-recount in a loop until
   the fixture is provably back to EXACT_COUNT, treating a failed read as a
   retry rather than as an empty result. Fail loudly if convergence never
   happens — a benchmark that silently pollutes its own fixture invalidates
   every later run. */

import { createClient } from "@supabase/supabase-js";
import { STAGING_REF } from "./guards";

export const CHANNEL_ID = "1581bdf2-c922-4ab2-bc3f-66a391732a3a";
export const EXACT_COUNT = 5000;
export const PROBE_PREFIX = "kxperf-";

function db() {
  const url = process.env.SUPABASE_URL!;
  if (!url?.includes(STAGING_REF)) throw new Error("refusing: not the staging project");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function fixtureCount(): Promise<number> {
  for (let i = 0; i < 5; i++) {
    const { count, error } = await db().from("discuss_messages")
      .select("id", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID);
    if (!error && typeof count === "number") return count;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error("could not read fixture count — refusing to guess");
}

/** Delete every probe row and CONVERGE on EXACT_COUNT. Settle first so
 *  in-flight sends have landed and can therefore be seen and removed. */
export async function cleanupFixture(opts: { settleMs?: number } = {}): Promise<{ deleted: number; count: number }> {
  await new Promise((r) => setTimeout(r, opts.settleMs ?? 10_000));

  let deleted = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db().from("discuss_messages")
      .select("id").eq("channel_id", CHANNEL_ID).like("body", `${PROBE_PREFIX}%`);

    if (error) {                       // a failed read is NOT "nothing to clean"
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (data.length) {
      const ids = data.map((r) => r.id);
      await db().from("discuss_reactions").delete().in("message_id", ids);   // dependents first
      const del = await db().from("discuss_messages").delete().in("id", ids);
      if (!del.error) deleted += ids.length;
    }

    const count = await fixtureCount();
    if (count === EXACT_COUNT) {
      // Re-check for stragglers that landed during the delete itself.
      const { data: late } = await db().from("discuss_messages")
        .select("id").eq("channel_id", CHANNEL_ID).like("body", `${PROBE_PREFIX}%`);
      if (!late?.length) return { deleted, count };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const count = await fixtureCount();
  throw new Error(
    `fixture did NOT converge to ${EXACT_COUNT} (now ${count}, deleted ${deleted}). ` +
    `Probe rows may remain — every later benchmark against this fixture is suspect until this is resolved.`,
  );
}
