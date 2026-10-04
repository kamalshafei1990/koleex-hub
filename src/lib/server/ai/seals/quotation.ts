import "server-only";

/* ---------------------------------------------------------------------------
   ai/seals/quotation — Quotation Hard Mode, plus the step synchroniser.

   Phase 2B, moved verbatim. On a quotation request the model's prose is
   discarded entirely and a deterministic reply is built from the tool rows,
   because a quotation is the one answer where a plausible-looking invented
   number is most expensive.
   --------------------------------------------------------------------------- */

import type { AgentStep } from "@/lib/server/ai-agent/types";
import { payloadHasPricingFields, PRICING_GUARD_MESSAGE } from "./pricing";
import { readObject } from "./execution";

/* ─── Final-reply finalizer ─────────────────────────────────────────
   Single entry point every orchestrate-return path must call. Runs
   all four guards in the required order and then forcibly syncs the
   last "answer" step in steps[] to match the sealed text — so the
   chat-bubble text (which the route handler persists via
   ai_messages.content = finalReply) and any downstream renderer
   seeing steps[] can never diverge.

   Before this helper, each return site chained the four guards
   inline. A single site drifting (missing a guard, wrong order,
   returning the pre-seal variable by mistake) was enough to leak
   hallucinated output. Centralising in one helper makes drift
   structurally impossible. */

export function syncLastAnswerStep(steps: AgentStep[], text: string): void {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text,
        permissionStatus: "allowed",
      };
      return;
    }
  }
}

/* ─── Quotation Hard Mode ───────────────────────────────────────────
   When the user asks for a quotation, we DO NOT trust the model's
   final text at all. Instead we build the reply deterministically
   from the tool-result payloads in steps[]. This is the only
   correctness story for pricing — guards only reduce leak probability;
   hard mode removes model authorship of the reply entirely.

   Detection is pattern-based on the user's turn. If matched, the
   orchestrator's final step replaces `finalReply` with
   `buildSafeQuotationReply(steps)` and the full guard chain still
   runs on the deterministic text as defence in depth. */

const QUOTATION_REQUEST_PATTERNS: RegExp[] = [
  /\b(create|make|draft|prepare|generate|issue|send|build|write)\s+(me\s+|us\s+)?(a\s+|the\s+|an\s+)?(quotation|quote)\b/i,
  /\bquotation\s+for\b/i,
  /\bquote\s+for\b/i,
  /\bprice\s+quote\b/i,
  /\bpricing\s+for\s+\d+\s*(units?|pcs|pieces|sets|boxes|machines)\b/i,
  /\bquotation\s+draft\b/i,
  /\bdraft\s+quotation\b/i,
  /\bI\s+want\s+(a|to\s+(create|make|prepare|draft)\s+a?\s*)\s*(quotation|quote)\b/i,
];

export function isQuotationRequest(userMessage: string): boolean {
  const m = String(userMessage ?? "").trim();
  if (!m) return false;
  return QUOTATION_REQUEST_PATTERNS.some((re) => re.test(m));
}

/** Pick the most-specific resolved customer row from this turn.
 *  Priority: getCustomerByCode (single row) > getCustomerByName
 *  (first of up-to-5 matches). Returns null if no customer lookup
 *  succeeded with a populated payload. */
function pickCustomerRow(steps: AgentStep[]): Record<string, unknown> | null {
  let byNameFirst: Record<string, unknown> | null = null;
  for (const s of steps) {
    if (s.kind !== "tool-result" || s.permissionStatus === "denied") continue;
    if (s.tool === "getCustomerByCode") {
      const row = readObject(s.payload);
      if (row) return row;
    }
    if (s.tool === "getCustomerByName" && !byNameFirst) {
      if (Array.isArray(s.payload) && s.payload.length > 0) {
        const first = readObject(s.payload[0]);
        if (first) byNameFirst = first;
      }
    }
  }
  return byNameFirst;
}

/** Pick the most-specific resolved product row from this turn.
 *  Priority: getProductByCode / getProductDetails (single row) >
 *  searchProducts (first of .products[]). */
function pickProductRow(steps: AgentStep[]): Record<string, unknown> | null {
  let searchFirst: Record<string, unknown> | null = null;
  for (const s of steps) {
    if (s.kind !== "tool-result" || s.permissionStatus === "denied") continue;
    if (s.tool === "getProductByCode" || s.tool === "getProductDetails") {
      const row = readObject(s.payload);
      if (row) return row;
    }
    if (s.tool === "searchProducts" && !searchFirst) {
      const p = readObject(s.payload);
      if (!p) continue;
      const products = p.products;
      if (Array.isArray(products) && products.length > 0) {
        const first = readObject(products[0]);
        if (first) searchFirst = first;
      }
    }
  }
  return searchFirst;
}

/** Pick the pricing-engine payload from this turn. Only counts when
 *  payloadHasPricingFields() agrees — empty-payload pricing calls
 *  (rare but possible) do NOT count as successful pricing. */
function pickPricingPayload(
  steps: AgentStep[],
): Record<string, unknown> | null {
  for (const s of steps) {
    if (s.kind !== "tool-result" || s.permissionStatus === "denied") continue;
    if (s.tool !== "calculateQuotationPricing") continue;
    const p = readObject(s.payload);
    if (p && payloadHasPricingFields(p)) return p;
  }
  return null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstPositiveNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/** Deterministic quotation reply. Builds the text from tool payload
 *  fields ONLY — never from model prose. Follows the strict rule:
 *  output a field only if it exists in the payload (and only fields
 *  explicitly whitelisted here; address / contact / specs / discount
 *  / margin / markup / description / product_code are never output,
 *  per spec). Missing pieces fall back to short, fixed questions. */
export function buildSafeQuotationReply(steps: AgentStep[]): string {
  const customer = pickCustomerRow(steps);
  if (!customer) {
    return "Who is this quotation for? Please send the customer name or code.";
  }

  const product = pickProductRow(steps);
  if (!product) {
    return "Which product should I include? You can send a product name or code.";
  }

  const pricing = pickPricingPayload(steps);
  if (!pricing) {
    return PRICING_GUARD_MESSAGE;
  }

  const customerName = firstString(customer.name, customer.customer_name);
  const productName = firstString(product.product_name, product.name);
  const currency = firstString(pricing.currency, pricing.currency_code) ?? "";

  // Whitelisted per-line and aggregate pricing fields.
  const pricingLines = Array.isArray(pricing.lines) ? pricing.lines : [];
  const firstLine = pricingLines.length > 0 ? readObject(pricingLines[0]) : null;

  const quantity = firstLine
    ? firstPositiveNumber(firstLine.quantity, firstLine.qty)
    : null;
  const unitPrice = firstLine
    ? firstPositiveNumber(firstLine.unit_price, firstLine.unitPrice, firstLine.price)
    : null;
  const lineTotal = firstLine
    ? firstPositiveNumber(firstLine.line_total, firstLine.lineTotal)
    : null;
  const total = firstPositiveNumber(
    pricing.total,
    pricing.grand_total,
    pricing.grandTotal,
  );

  const out: string[] = ["Quotation summary:"];
  if (customerName) out.push(`- Customer: ${customerName}`);
  if (productName) out.push(`- Product: ${productName}`);
  if (quantity !== null) out.push(`- Quantity: ${quantity}`);
  if (unitPrice !== null) {
    out.push(`- Unit price: ${unitPrice}${currency ? " " + currency : ""}`);
  }
  if (lineTotal !== null) {
    out.push(`- Line total: ${lineTotal}${currency ? " " + currency : ""}`);
  }
  if (total !== null) {
    out.push(`- Total: ${total}${currency ? " " + currency : ""}`);
  }
  return out.join("\n");
}

