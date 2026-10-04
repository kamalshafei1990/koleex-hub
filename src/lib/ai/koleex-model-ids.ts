/* ---------------------------------------------------------------------------
   Koleex AI model ids — the ids and their normalisers, without the catalog.

   Split from koleex-models.ts so the account preferences (imported by every
   route in the Hub) can validate a stored choice without shipping the
   picker's names and lines to screens that never show them. The catalog
   re-exports all of this; import from there anywhere the picker is drawn.
   --------------------------------------------------------------------------- */

export type KoleexModelId = "auto" | "blink" | "mind" | "deep";
/** A model that can actually answer a turn — "auto" is a choice, not one. */
export type KoleexServingModel = Exclude<KoleexModelId, "auto">;

/** Picker order: Auto first, then fastest to deepest. */
export const KOLEEX_MODELS: readonly KoleexModelId[] = ["auto", "blink", "mind", "deep"] as const;
export const KOLEEX_SERVING_MODELS: readonly KoleexServingModel[] = ["blink", "mind", "deep"] as const;
export const DEFAULT_KOLEEX_MODEL: KoleexModelId = "auto";

/** Anything that is not a known model is Auto — an old client, a typo, or a
 *  hand-made request can never select something that does not exist. Pure. */
export function normalizeKoleexModel(v: unknown): KoleexModelId {
  return typeof v === "string" && (KOLEEX_MODELS as readonly string[]).includes(v)
    ? (v as KoleexModelId)
    : DEFAULT_KOLEEX_MODEL;
}

/** Same rule for a model that served a turn: only the three, else null. */
export function normalizeServingModel(v: unknown): KoleexServingModel | null {
  return typeof v === "string" && (KOLEEX_SERVING_MODELS as readonly string[]).includes(v)
    ? (v as KoleexServingModel)
    : null;
}
