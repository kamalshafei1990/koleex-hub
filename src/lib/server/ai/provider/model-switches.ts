import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/model-switches — which Koleex models an operator has switched
   off, from TWO places:

     1. AI_MODELS_DISABLED (env)         — the deploy-time switch, unchanged.
     2. platform_settings (the KV table)  — the owner's runtime switch, flipped
        from Settings → Koleex AI (models 4/4, 2026-09-24). One boolean key per
        model: `ai_model_off_<id>` = true means off. Absent means on.

   No new table: platform_settings is the owner-approved key/value store the
   QA-reporter switch already lives in (RLS deny-all, service role only).

   READ ONCE PER HALF MINUTE, NOT PER TURN. Every chat turn asks this, and a
   database round trip on every message would be a cost the owner pays in
   speed for a setting that changes a few times a month. A flip is live on the
   instance that saved it at once (invalidateModelSwitches) and on every other
   instance within SWITCH_TTL_MS.

   FAILS OPEN TO THE LAST KNOWN ANSWER. A read that fails keeps the previous
   set (or none, on a cold instance): a database hiccup must never be what
   turns every model off — nor silently on after the owner turned one off, for
   longer than one failed refresh.
   --------------------------------------------------------------------------- */

import { KOLEEX_SERVING_MODELS, type KoleexServingModel } from "@/lib/ai/koleex-models";
import { parseDisabledModels } from "./koleex-model-slots";

export const SWITCH_TTL_MS = 30_000;

/** The platform_settings key behind each model's switch. */
export const MODEL_SWITCH_KEYS: Readonly<Record<KoleexServingModel, string>> = {
  mind: "ai_model_off_mind",
  blink: "ai_model_off_blink",
  deep: "ai_model_off_deep",
};

export function isModelSwitchKey(key: unknown): boolean {
  return typeof key === "string" && (Object.values(MODEL_SWITCH_KEYS) as string[]).includes(key);
}

/** Which models the stored rows switch off. Pure; only an explicit `true`
 *  counts, so a missing, malformed or string value leaves the model on. */
export function parseSwitchRows(rows: ReadonlyArray<{ key: unknown; value: unknown }>): Set<KoleexServingModel> {
  const out = new Set<KoleexServingModel>();
  for (const id of KOLEEX_SERVING_MODELS) {
    const row = rows.find((r) => r.key === MODEL_SWITCH_KEYS[id]);
    if (row && row.value === true) out.add(id);
  }
  return out;
}

let cache: { at: number; off: ReadonlySet<KoleexServingModel> } | null = null;
let inflight: Promise<ReadonlySet<KoleexServingModel>> | null = null;

async function readTable(): Promise<ReadonlySet<KoleexServingModel>> {
  try {
    /* Imported here, not at the top: the suites load this module without a
       database, and the provider registry imports it. */
    const { supabaseServer } = await import("@/lib/server/supabase-server");
    const { data, error } = await supabaseServer
      .from("platform_settings")
      .select("key, value")
      .in("key", Object.values(MODEL_SWITCH_KEYS));
    if (error) throw new Error(error.message);
    const off = parseSwitchRows(data ?? []);
    cache = { at: Date.now(), off };
    return off;
  } catch (e) {
    console.warn(`[ai.models] switch read failed — keeping the last known state: ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`);
    const kept = cache?.off ?? new Set<KoleexServingModel>();
    /* Hold the kept answer for a full window: a failing table must not be
       asked again on every turn. */
    cache = { at: Date.now(), off: kept };
    return kept;
  }
}

/** The runtime switches alone (the table), cached. */
export async function switchedOffInTable(now = Date.now()): Promise<ReadonlySet<KoleexServingModel>> {
  if (cache && now - cache.at < SWITCH_TTL_MS) return cache.off;
  if (!inflight) inflight = readTable().finally(() => { inflight = null; });
  return inflight;
}

/** Every model that is off right now: the env switch OR the owner's switch. */
export async function switchedOffModels(): Promise<ReadonlySet<KoleexServingModel>> {
  const env = parseDisabledModels(process.env.AI_MODELS_DISABLED);
  const table = await switchedOffInTable();
  return new Set<KoleexServingModel>([...env, ...table]);
}

/** A switch was just saved on this instance: read it again on the next ask. */
export function invalidateModelSwitches(): void {
  cache = null;
}
