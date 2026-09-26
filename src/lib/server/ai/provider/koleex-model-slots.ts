import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/koleex-model-slots — which provider SLOT stands behind each
   Koleex AI model. The only place that knows.

   Owner, 2026-09-23 (see lib/ai/koleex-models.ts): three providers become
   three Koleex models. The mapping is by SLOT, not by vendor, so it obeys
   the standing rule "do not hard-code one AI provider into the
   architecture" — what sits in a slot is configuration:

     mind   the primary slot            (the DeepSeek adapter today)
     blink  the first backup, AI_FALLBACK_*    (Qwen, by configuration)
     deep   the second backup, AI_FALLBACK2_*  (Grok, by configuration)

   A CHOICE IS A PREFERENCE, NEVER A CAGE. The chosen model is tried first;
   if it is not configured, switched off or failing, the turn fails over to
   the others exactly as it always has — the user is answered, and told by
   name which model answered. A choice can never leave a user without a reply.

   THE OPERATOR SWITCHES. `AI_MODELS_DISABLED=deep,blink` (deploy time) and
   the owner's switches in Settings → Koleex AI (runtime, model-switches.ts)
   take models out of service: a request for one is treated as Auto, the
   picker is told it is unavailable, and the turn does not fail over to it
   unless it is the only model left (registry.chatWithTools). Server-side, so
   no client can opt back in.
   --------------------------------------------------------------------------- */

import type { ProviderAdapter } from "./types";
import { deepseekAdapter } from "./adapters/deepseek";
import { openAiCompatibleAdapter, secondFallbackAdapter } from "./adapters/openai-compatible";
import {
  KOLEEX_SERVING_MODELS,
  normalizeKoleexModel,
  type KoleexModelId,
  type KoleexServingModel,
} from "@/lib/ai/koleex-models";

const SLOTS: Readonly<Record<KoleexServingModel, ProviderAdapter>> = {
  mind: deepseekAdapter,
  blink: openAiCompatibleAdapter,
  deep: secondFallbackAdapter,
};

/** The adapter a model stands for, or null for Auto (no preference). */
export function adapterForModel(model: KoleexModelId): ProviderAdapter | null {
  return model === "auto" ? null : SLOTS[model];
}

/** Which models an operator has switched off. Pure over its input; unknown
 *  names are ignored, and "auto" can never be switched off. */
export function parseDisabledModels(raw: string | undefined): ReadonlySet<KoleexServingModel> {
  const out = new Set<KoleexServingModel>();
  for (const part of (raw ?? "").split(",")) {
    const id = part.trim().toLowerCase();
    if ((KOLEEX_SERVING_MODELS as readonly string[]).includes(id)) out.add(id as KoleexServingModel);
  }
  return out;
}

function disabledModels(): ReadonlySet<KoleexServingModel> {
  return parseDisabledModels(process.env.AI_MODELS_DISABLED);
}

/** Is this model's slot configured (keys present), switched off or not? */
export function modelConfigured(
  model: KoleexServingModel,
  slots: Readonly<Record<KoleexServingModel, ProviderAdapter>> = SLOTS,
): boolean {
  try {
    return slots[model].configured();
  } catch {
    return false;
  }
}

/** Can this model serve right now — configured, and not switched off? */
export function modelAvailable(
  model: KoleexServingModel,
  disabled = disabledModels(),
  slots: Readonly<Record<KoleexServingModel, ProviderAdapter>> = SLOTS,
): boolean {
  if (disabled.has(model)) return false;
  try {
    return slots[model].configured();
  } catch {
    return false;
  }
}

/** What the server will honour for a raw request value: a known, available
 *  model, else Auto. The client asks; this decides. */
export function resolveRequestedModel(raw: unknown, disabled = disabledModels()): KoleexModelId {
  const m = normalizeKoleexModel(raw);
  if (m === "auto") return m;
  return disabled.has(m) ? "auto" : m;
}

/** The Koleex model behind a served provider label ("<adapter>:<model>…"),
 *  or null when the turn was not answered by a model (a canned fast path,
 *  "none", a local answer). Only the adapter half is read; a label is never
 *  echoed.
 *
 *  ONLY A CONFIGURED SLOT MATCHES. An unconfigured backup is named
 *  "fallback" / "fallback2", and "fallback" is also the label of the
 *  degraded lane that answered WITHOUT a model — matching it would credit
 *  Blink with a reply no model wrote. */
export function servedKoleexModel(
  label: string | null | undefined,
  slots: Readonly<Record<KoleexServingModel, ProviderAdapter>> = SLOTS,
): KoleexServingModel | null {
  const name = (label ?? "").split(":")[0]?.trim();
  if (!name) return null;
  for (const id of KOLEEX_SERVING_MODELS) {
    const a = slots[id];
    let ok = false;
    try { ok = a.configured(); } catch { ok = false; }
    if (ok && a.name === name) return id;
  }
  return null;
}

/** Every model and whether it can serve — for the picker. Names only. */
export function modelAvailability(
  disabled: ReadonlySet<KoleexServingModel> = disabledModels(),
): Array<{ id: KoleexModelId; available: boolean }> {
  return [
    { id: "auto", available: true },
    ...KOLEEX_SERVING_MODELS.map((id) => ({ id, available: modelAvailable(id, disabled) })),
  ];
}
