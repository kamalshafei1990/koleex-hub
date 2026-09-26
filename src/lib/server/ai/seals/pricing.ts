import "server-only";

/* ---------------------------------------------------------------------------
   ai/seals/pricing — the pricing safety guard.

   Phase 2B, moved verbatim. The model CAN hallucinate prices; this seal
   refuses to let a number reach the user unless a pricing tool actually
   produced it in THIS turn. History is never evidence.
   --------------------------------------------------------------------------- */

import type { AgentStep } from "@/lib/server/ai-agent/types";

/* ─── Pricing safety guard ──────────────────────────────────────────
   The model CAN hallucinate prices — unit price, totals, discount %,
   margin %, currency amounts. The system prompt tells it not to; this
   server-side guard enforces it regardless of what the model does.

   Before any finalReply leaves orchestrate(), it passes through
   sealPricingSafety(). If the text contains pricing-like output AND
   no pricing tool ran successfully THIS turn, the text is replaced
   with a fixed safe message and the last "answer" step in steps[]
   is updated to match so the UI bubble is consistent.

   Only current-turn steps[] counts as evidence — history is NEVER
   trusted. "denied" pricing-tool results don't count either (the
   tool didn't actually price anything). "approval_required" DOES
   count — that's real numbers that just need sign-off.
   ───────────────────────────────────────────────────────────────── */

/** The ONLY tools whose success counts as real pricing evidence.
 *  createQuotationDraft is intentionally EXCLUDED — the model was
 *  using its presence as a cover to emit invented numbers. The draft
 *  handler internally re-prices, but for the guard's purposes we
 *  only trust calculateQuotationPricing directly: that tool's
 *  payload is the authoritative pricing engine output. */
const PRICING_TOOLS = new Set<string>([
  "calculateQuotationPricing",
  /* The engine's selling price for one product (FOB, or for a country and
     customer type). Its payload carries `unit_price` and `price` as
     positive numbers when it priced something, and nulls when the product
     is on request — so an on-request answer is still no evidence. */
  "getProductPrice",
]);

/** Numeric fields in a pricing-tool payload that count as "real
 *  pricing data." Must be a positive finite number — strings that
 *  happen to look numeric do NOT qualify. The engine returns
 *  numbers; anything else is either a placeholder or fake. */
const PRICING_PAYLOAD_KEYS: string[] = [
  "total",
  "subtotal",
  "grand_total",
  "grandTotal",
  "unit_price",
  "unitPrice",
  "line_total",
  "lineTotal",
  "price",
];

function isPositiveNumber(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Verify the pricing-tool payload actually contains pricing fields.
 *  Looks at top-level keys and then inside each `lines[]` row, so
 *  both aggregate-level and per-line prices count. Returns false if
 *  the payload is null, empty, or only has non-pricing metadata. */
export function payloadHasPricingFields(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const root = payload as Record<string, unknown>;

  for (const k of PRICING_PAYLOAD_KEYS) {
    if (isPositiveNumber(root[k])) return true;
  }

  const lines = root.lines;
  if (Array.isArray(lines)) {
    for (const l of lines) {
      if (!l || typeof l !== "object") continue;
      const row = l as Record<string, unknown>;
      for (const k of PRICING_PAYLOAD_KEYS) {
        if (isPositiveNumber(row[k])) return true;
      }
    }
  }

  return false;
}

/** Patterns that flag assistant text as containing pricing output.
 *  Chosen conservatively — prefer false positives (block a valid but
 *  oddly-phrased reply) to false negatives (let a hallucinated
 *  number through). Ordered roughly from highest-signal to lowest. */
const PRICING_PATTERNS: RegExp[] = [
  // Currency symbol + amount:  $1,200 · €500 · ¥3,400 · £900
  /[$€£¥]\s?\d[\d,]*(\.\d+)?/,
  // Amount + currency symbol:  1,200$ · 500 €
  /\d[\d,]*(\.\d+)?\s?[$€£¥]/,
  // ISO code + amount:         USD 1,200 · EGP 50,000 · CNY 3400
  /\b(USD|EGP|CNY|EUR|GBP|SAR|AED|TRY|BRL|IDR|JPY|KRW)\s?\d[\d,]*(\.\d+)?/i,
  // Amount + ISO code:         1,200 USD · 50000 EGP · 3400CNY
  /\d[\d,]*(\.\d+)?\s?(USD|EGP|CNY|EUR|GBP|SAR|AED|TRY|BRL|IDR|JPY|KRW)\b/i,
  // Labelled totals near a number
  /\b(unit\s+price|total\s+price|sub[- ]?total|grand\s+total|quotation\s+total|quote\s+total|line\s+total|extended\s+price|list\s+price)\b[^.\n]{0,40}\d/i,
  // Numeric discount / margin / markup
  /\b(discount|margin|markup)\b[^.\n]{0,20}\d+\s*%/i,
  /\b\d+\s*%\s*(discount|margin|markup|off)\b/i,
  // Direct labels with a number right after
  /\b(price|cost|amount|subtotal|total)\s*[:=]\s*\d/i,

  // v2 — bullet / list line starting with a pricing label. Fires on
  // the LABEL alone so multi-line "* Unit Price\n  $1,200" shapes
  // are blocked even when label and number are split across lines.
  // Catches "* Unit Price: …", "- Total Price", "• Grand Total",
  // "**Unit Price**", etc.
  /^\s*(?:[*\-•]|\*\*)\s*(?:\*\*)?\s*(unit\s+price|total\s+price|sub[- ]?total|grand\s+total|line\s+total|quote\s+total|quotation\s+total|extended\s+price|list\s+price)\b/im,

  // v2 — markdown table header naming a pricing column. Catches
  // "| Product | Qty | Unit Price | Total |" where numbers sit in
  // the row below without any currency adornment.
  /\|\s*(unit\s+price|total\s+price|sub[- ]?total|grand\s+total|line\s+total|quote\s+total|quotation\s+total|extended\s+price|list\s+price|price|cost)\s*\|/i,

  // v2 — bare pricing label alone on a line. Catches
  //   Unit Price:
  //     2,500
  // where the label sits on its own line and the value on the next.
  /^\s*(unit\s+price|total\s+price|grand\s+total|quotation\s+total|quote\s+total)\s*[:\-–]?\s*$/im,
];

export function containsPricingOutput(text: string): boolean {
  if (!text) return false;
  return PRICING_PATTERNS.some((re) => re.test(text));
}

/** Evidence gate (v2): requires three ANDed conditions on a single
 *  step in THIS turn's steps[].
 *    1. kind === "tool-result"
 *    2. tool === "calculateQuotationPricing"   (see PRICING_TOOLS)
 *    3. permissionStatus !== "denied"
 *    4. payload contains a positive-number pricing field
 *       (top-level or inside a lines[] row).
 *  All four must hold on the same step. A pricing-tool row with a
 *  null/empty payload no longer counts — that was the v1 hole. */
export function hasValidPricingEvidence(steps: AgentStep[]): boolean {
  for (const s of steps) {
    if (s.kind !== "tool-result") continue;
    if (!s.tool || !PRICING_TOOLS.has(s.tool)) continue;
    if (s.permissionStatus === "denied") continue;
    if (!payloadHasPricingFields(s.payload)) continue;
    return true;
  }
  return false;
}

/** Fixed replacement text — the exact wording required by spec.
 *  "Customer and product" is slightly optimistic in the edge case
 *  where neither was resolved, but the guard's intent is to stop
 *  fabricated pricing, not to narrate flow state. */
export const PRICING_GUARD_MESSAGE =
  "I found the customer and product, but I cannot provide pricing until the pricing calculation completes successfully.";

/* ── A FIGURE ABOUT THE WORLD IS NOT A KOLEEX PRICE (owner, 2026-09-26) ──
   "What are the top 10 poorest countries?" was looked up, answered with
   GDP per person in dollars, and the whole table was replaced by the
   guard above — the patterns see "$1,200" and cannot tell a country's
   income from a machine's price. The owner chose a narrow exception.
   A currency figure passes only when ALL of these hold:
     · every tool this turn ran was a web lookup (search / page read) and
       at least one returned — no Koleex data tool ran, so nothing here
       came from the Hub;
     · the answer names no Koleex price context: not Koleex, a quotation,
       trade terms (FOB, EXW…), a unit price, MOQ, a price list, "our
       price", a discount/margin/markup, or a model code like XSL-8000A4.
   Anything else is guarded exactly as before. */
const WEB_LOOKUP_TOOLS = new Set(["search_web", "read_page"]);
const KOLEEX_PRICE_CONTEXT =
  /koleex|كوليكس|quotation|\bquotes?\b|عرض\s*سعر|报价|\b(?:FOB|EXW|CIF|CFR|CPT|CIP|DAP|DPU|DDP|FCA|FAS)\b|unit\s+price|per\s+unit|سعر\s*الوحدة|单价|\bMOQ\b|price\s*list|قائمة\s*الأسعار|价目|our\s+prices?|أسعارنا|سعرنا|我们的价格|discount|margin|markup|خصم|هامش\s*الربح|折扣|利润率/i;
/* Case-sensitive on purpose: a model code is upper-case letters, a dash,
   digits ("XSL-8000A4"); with /i "covid-19" or "top-10" would match. */
const MODEL_CODE = /\b[A-Z]{2,5}-\d{2,}[A-Z0-9]*\b/;

/** Is this reply a public figure found by a web lookup, with no Koleex
 *  price anywhere near it? */
export function isPublicWebFigure(reply: string, steps: AgentStep[]): boolean {
  const toolSteps = steps.filter((s) => s.kind === "tool-call" || s.kind === "tool-result");
  if (!toolSteps.every((s) => !!s.tool && WEB_LOOKUP_TOOLS.has(s.tool))) return false;
  const looked = toolSteps.some((s) => s.kind === "tool-result" && s.permissionStatus !== "denied");
  if (!looked) return false;
  return !KOLEEX_PRICE_CONTEXT.test(reply) && !MODEL_CODE.test(reply);
}

/** What the guard says on a turn that only looked things up on the web —
 *  "I found the customer and product" is the quotation flow's wording and
 *  means nothing here. */
export const PRICING_GUARD_WEB_MESSAGE =
  "I can't state a Koleex price here: Koleex prices come only from the pricing calculation. Ask me for a quotation and I'll calculate it.";

/** Single gate every orchestrate-return path calls. Returns the
 *  cleaned finalReply and mutates the last "answer" step's text in
 *  place so the UI matches. No-op when either (a) the reply has no
 *  pricing-like content or (b) a pricing tool ran successfully this
 *  turn. */
/* Deterministic backstop for DIRECT_VOICE_RULE: the model occasionally
   still opens with retrieval narration ("حصلت على المعلومات",
   "لقيتلك التفاصيل", "I found what you need"). If the FIRST line is a
   short standalone opener containing such a marker, drop that line —
   the real answer always follows on the next line. Never touches
   content beyond the first line. */
const NARRATION_MARKERS =
  /(حصلت على|لقيتلك|لقيت لك|جبتلك|جبت لك|دلوقتي عندي|عندي كل اللي|وجدت المعلومات|إليك ما وجدت|بعد البحث|هعرضلك اللي لقيته|I (?:found|got|gathered|now have)\b|here'?s what I found|based on (?:my|the) (?:search|results))/i;
export function stripProcessNarration(reply: string): string {
  if (!reply) return reply;
  const nl = reply.indexOf("\n");
  if (nl === -1 || nl > 120) return reply;
  const first = reply.slice(0, nl).trim();
  if (!NARRATION_MARKERS.test(first)) return reply;
  return reply.slice(nl + 1).replace(/^\n+/, "");
}

export function sealPricingSafety(rawFinalReply: string, steps: AgentStep[]): string {
  /* Central choke point every return path flows through — apply the
     direct-voice narration strip here so BOTH the streaming and the
     plain-JSON agent paths get it. */
  const finalReply = stripProcessNarration(rawFinalReply);
  if (!containsPricingOutput(finalReply)) return finalReply;
  if (hasValidPricingEvidence(steps)) return finalReply;
  if (isPublicWebFigure(finalReply, steps)) return finalReply;

  /* A web-only turn gets words that fit it; every other turn keeps the
     spec's wording. */
  const webOnly = steps.some((s) => s.kind === "tool-call" || s.kind === "tool-result") &&
    steps.every((s) => (s.kind !== "tool-call" && s.kind !== "tool-result") || (!!s.tool && WEB_LOOKUP_TOOLS.has(s.tool)));
  const guard = webOnly ? PRICING_GUARD_WEB_MESSAGE : PRICING_GUARD_MESSAGE;

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text: guard,
        permissionStatus: "allowed",
      };
      break;
    }
  }
  console.warn(
    "[ai.agent.pricing-guard] replaced hallucinated pricing; no pricing-tool evidence this turn.",
  );
  return guard;
}

