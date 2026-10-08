import "server-only";

/* ---------------------------------------------------------------------------
   ai/seals — THE ONE FUNNEL.

   Phase 2B. sealFinalReply is the single place every reply passes through
   before it leaves the server, and the audit scored this chain 8.5/10 — the
   strongest component in the system. It is the one thing in this refactor
   that must not acquire a second entrance.

   The seals used to sit in the middle of orchestrator.ts among 3 200 lines
   of loop, transport and prompt building. Moving them here changes no
   behaviour and buys one thing that matters: the whole chain is pure and
   synchronous, so for the first time it can be tested by CALLING it with
   fabricated steps rather than by grepping for its regexes.

   Order is load-bearing and is asserted by validate:ai-seals:
     scrub leaked tool markup → quotation hard mode → execution v1
       → (v2 always) → (v3 + pricing, unless the turn recites an attachment)
       → sync the answer step
   --------------------------------------------------------------------------- */

import type { AgentStep } from "@/lib/server/ai-agent/types";
import { scrubLeakedToolMarkup } from "./text";
import { sealPricingSafety } from "./pricing";
import {
  sealExecutionSafety,
  sealExecutionSafetyV2,
  sealExecutionSafetyV3,
} from "./execution";
import { isQuotationRequest, buildSafeQuotationReply, syncLastAnswerStep } from "./quotation";

export { cleanAssistantText, looksLikeDebug, rescueFromToolResults, normaliseBrandName, scrubLeakedToolMarkup, GENERIC_FOLLOWUP, BANNED_ECHOES } from "./text";
export { sealPricingSafety, stripProcessNarration, PRICING_GUARD_MESSAGE } from "./pricing";
export { sealExecutionSafety, sealExecutionSafetyV2, sealExecutionSafetyV3 } from "./execution";
export { isQuotationRequest, buildSafeQuotationReply, syncLastAnswerStep } from "./quotation";

/* ─── Final-reply sealer ───────────────────────────────────────────
   Single funnel every orchestrate-return path calls. Two modes:

     · Quotation hard mode: if the user turn was a quotation/pricing
       request, the model's text is DISCARDED and the reply is built
       deterministically from tool payloads via
       buildSafeQuotationReply. The full guard chain still runs on
       the deterministic output — defense in depth.

     · Normal mode: v1 → v2 → v3 → pricing on the model's text.

   Either way the last "answer" step is force-synced to the returned
   text so steps[] and finalReply cannot diverge. */

export function sealFinalReply(
  finalReply: string,
  steps: AgentStep[],
  userMessage?: string,
  attachedDocContext?: boolean,
): string {
  // Start from the model's text. In quotation hard mode we replace
  // it entirely with a deterministic reply before running the guard
  // chain. The guards still run as belt-and-braces.
  let sealed = scrubLeakedToolMarkup(finalReply);
  if (userMessage && isQuotationRequest(userMessage)) {
    sealed = buildSafeQuotationReply(steps);
    console.warn(
      "[ai.agent.quotation-hard-mode] model reply discarded; deterministic text used.",
    );
  }
  sealed = sealExecutionSafety(sealed, steps);
  /* Document-recital exemption. The field-claim (v3) and pricing seals
     exist to stop INVENTED customer/product/pricing details presented as
     system facts. A file the user themselves attached is legitimate source
     material — an invoice summary trips every pricing pattern by nature,
     and v3 reads its "Total:" lines as ungrounded field claims. When an
     [ATTACHED FILE] block is in this turn or in retained history, those two
     seals stand down; the fake-workflow seals (v1/v2) and quotation hard
     mode stay on — reciting a document never justifies claiming tools ran. */
  if (!attachedDocContext) {
    sealed = sealExecutionSafetyV2(sealed, steps);
    sealed = sealExecutionSafetyV3(sealed, steps);
    sealed = sealPricingSafety(sealed, steps);
  } else {
    sealed = sealExecutionSafetyV2(sealed, steps);
    console.warn("[ai.agent.seals] attached-document context — v3/pricing recital exemption");
  }
  syncLastAnswerStep(steps, sealed);
  return sealed;
}
