import "server-only";

/* ---------------------------------------------------------------------------
   ai/seals/execution — the execution safety guards, v1 / v2 / v3.

   Phase 2B, moved verbatim. Three generations of the same idea, each added
   after a real incident: v1 catches fake workflow narration, v2 catches
   placeholders and fake "resolved" summaries, v3 catches field claims that
   no tool result grounds. All three are kept — a later one does not
   subsume an earlier one, and the incident comments explain why.
   --------------------------------------------------------------------------- */

import type { AgentStep } from "@/lib/server/ai-agent/types";

/* ─── Execution safety guard ────────────────────────────────────────
   Sibling of the pricing guard. Catches "fake workflow narration" —
   the model claiming it searched the database, found a customer or
   product, resolved an ID, or performed a calculation when no tool
   has actually run in THIS turn's steps[].

   Independent of the pricing guard: this one looks at execution-
   claim phrasing ("I found the customer", "Product ID is …",
   "checking the database") and asks "is there ANY successful tool
   result in this turn?" If not, the narration is hallucinated and
   gets replaced with a short "I need to use system tools" message.

   Runs BEFORE sealPricingSafety at every return site so execution
   hallucinations are caught before the pricing check sees them.
   ───────────────────────────────────────────────────────────────── */

const FAKE_EXECUTION_PATTERNS: RegExp[] = [
  /\bI'?ll try to find\b/i,
  /\bI found .* in (our|the) database\b/i,
  /\bI found the product\b/i,
  /\bI found the customer\b/i,
  /\bProduct ID is\b/i,
  /\bCustomer ID is\b/i,
  /\bLet me check\b/i,
  /\bNow I'?ll calculate\b/i,
  /\bI'?ll calculate\b/i,
  /\bchecking the database\b/i,
  /\bchecking the catalog\b/i,
  /\bI'?ll try to find .* in our database\b/i,
  /\bI'?ll try to find .* in our catalog\b/i,
  /\bPlease wait for a moment while I check\b/i,
];

function containsFakeExecution(text: string): boolean {
  if (!text) return false;
  return FAKE_EXECUTION_PATTERNS.some((re) => re.test(text));
}

/** Any non-denied tool-result in the current turn counts as real
 *  execution evidence. Intentionally tool-agnostic: if the agent
 *  actually ran something, narration is allowed. If no tool fired
 *  at all, any "I found…" / "Let me check…" phrasing is fabricated
 *  and gets replaced. */
function hasRealToolEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) => s.kind === "tool-result" && s.permissionStatus !== "denied",
  );
}

const EXECUTION_GUARD_MESSAGE =
  "I need to use system tools to retrieve real data before proceeding.";

export function sealExecutionSafety(finalReply: string, steps: AgentStep[]): string {
  if (!containsFakeExecution(finalReply)) return finalReply;
  if (hasRealToolEvidence(steps)) return finalReply;

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text: EXECUTION_GUARD_MESSAGE,
        permissionStatus: "allowed",
      };
      break;
    }
  }
  console.warn(
    "[ai.agent.execution-guard] replaced hallucinated execution text; no tool evidence this turn.",
  );
  return EXECUTION_GUARD_MESSAGE;
}

/* ─── Execution safety guard v2 ─────────────────────────────────────
   Sibling of v1. v1 catches fake workflow narration ("I'll check",
   "Let me search"). v2 catches a different attack vector: fake
   RESOLVED summaries and placeholder fields.

   Targets:
     · placeholder tokens like [Insert Price], [TBD], <insert X>
     · structured sections the model writes as if tools succeeded
       ("Customer Name: …", "Product Code: …", "Order Details")
       when the matching tool did not actually run this turn

   Unlike v1 (which allows any successful tool-result to authorise
   any narration), v2 uses TOOL-FAMILY-SPECIFIC evidence:
     · customer claims require a customer tool result
     · product claims require a product tool result
     · quotation/order-detail claims require a pricing/quotation
       tool result
   Placeholders are always blocked, even with evidence — a
   hallucinated "[Insert Address]" is not legitimised by a
   successful getCustomerByName call.

   Runs AFTER v1, BEFORE sealPricingSafety at every return site. */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[Insert [^\]]+\]/i,
  /\[Enter [^\]]+\]/i,
  /\[Add [^\]]+\]/i,
  /\[TBD\]/i,
  /\[To be [^\]]+\]/i,
  /<insert [^>]+>/i,
];

const FAKE_RESOLUTION_PATTERNS: RegExp[] = [
  /\bwe have found the customer\b/i,
  /\bwe have found the product\b/i,
  /\bi found the customer\b/i,
  /\bi found the product\b/i,
  /\bcustomer resolution\b/i,
  /\bproduct resolution\b/i,
  /\bits details are as follows\b/i,
  /\bdetails are as follows\b/i,
  /\bquotation details\b/i,
  /\border details\b/i,
  /\bcustomer name\s*:/i,
  /\bcustomer code\s*:/i,
  /\bproduct name\s*:/i,
  /\bproduct code\s*:/i,
  /\bcontact person\s*:/i,
  /\baddress\s*:/i,
];

function containsPlaceholders(text: string): boolean {
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

function containsFakeResolvedSummary(text: string): boolean {
  if (!text) return false;
  return FAKE_RESOLUTION_PATTERNS.some((re) => re.test(text));
}

/** Customer-family evidence: a non-denied result from a customer
 *  lookup tool in the current turn. */
function hasCustomerEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      (s.tool === "getCustomerByName" || s.tool === "getCustomerByCode"),
  );
}

/** Product-family evidence: a non-denied result from any product
 *  lookup tool in the current turn. */
function hasProductEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      (s.tool === "searchProducts" ||
        s.tool === "getProductByCode" ||
        s.tool === "getProductDetails"),
  );
}

/** Quotation-family evidence: a non-denied pricing/draft result in
 *  the current turn. This is broader than PRICING_TOOLS (which is
 *  pricing-only); quotation-detail sections are allowed if EITHER
 *  pricing OR draft succeeded, while actual numeric pricing still
 *  requires PRICING_TOOLS evidence via the separate pricing guard. */
function hasQuotationEvidence(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      (s.tool === "calculateQuotationPricing" ||
        s.tool === "createQuotationDraft"),
  );
}

const EXECUTION_GUARD_V2_MESSAGE =
  "I need to use verified system results before I can confirm customer, product, or quotation details.";

/** Helper: swap the text of the most recent "answer" step so the
 *  UI bubble matches a replaced finalReply. Shared by every branch
 *  below. */
function replaceLastAnswerStep(steps: AgentStep[], text: string): void {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "answer") {
      steps[i] = {
        ...steps[i],
        text,
        permissionStatus: "allowed",
      };
      break;
    }
  }
}

export function sealExecutionSafetyV2(
  finalReply: string,
  steps: AgentStep[],
): string {
  const text = finalReply || "";

  const hasPlaceholder = containsPlaceholders(text);
  const hasResolvedSummary = containsFakeResolvedSummary(text);
  if (!hasPlaceholder && !hasResolvedSummary) return finalReply;

  // Placeholders are always blocked, regardless of tool evidence.
  if (hasPlaceholder) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn("[ai.agent.execution-guard-v2] replaced placeholder output.");
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  const customerOk = hasCustomerEvidence(steps);
  const productOk = hasProductEvidence(steps);
  const quotationOk = hasQuotationEvidence(steps);

  // Customer summary without customer-family evidence → block.
  if (/\bcustomer\b/i.test(text) && !customerOk) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn(
      "[ai.agent.execution-guard-v2] replaced customer summary without evidence.",
    );
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  // Product summary without product-family evidence → block.
  if (/\bproduct\b/i.test(text) && !productOk) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn(
      "[ai.agent.execution-guard-v2] replaced product summary without evidence.",
    );
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  // Quotation/order-detail section without quotation-family evidence → block.
  if (
    /\b(quotation details|order details|quotation|quote)\b/i.test(text) &&
    !quotationOk
  ) {
    replaceLastAnswerStep(steps, EXECUTION_GUARD_V2_MESSAGE);
    console.warn(
      "[ai.agent.execution-guard-v2] replaced quotation summary without evidence.",
    );
    return EXECUTION_GUARD_V2_MESSAGE;
  }

  return finalReply;
}

/* ─── Execution safety guard v3 ─────────────────────────────────────
   FIELD-LEVEL grounding guard. v2 gates on tool-family evidence;
   v3 gates on the exact field. Even if a customer tool ran
   successfully, the model can only write "Customer Name: X" if
   `customer_name` (or its alias) was present in that tool's payload.
   Same for every labelled field across customer / product /
   quotation families.

   This is strictly stricter than v2. Partial evidence (a succeeded
   search, an empty customer match, a list of products) does NOT
   justify field claims — only fields actually returned in the
   payload do. Address/contact/phone/email on a customer, code/brand/
   description/model on a product, unit_price/total/discount on a
   quotation — each must be grounded individually.

   Runs AFTER v2, BEFORE sealPricingSafety at every return site. */

type GroundedFields = {
  customer: Set<string>;
  product: Set<string>;
  quotation: Set<string>;
};

export function readObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function addIfPresent(
  set: Set<string>,
  obj: Record<string, unknown>,
  key: string,
  alias?: string,
): void {
  const v = obj[key];
  if (
    v !== null &&
    v !== undefined &&
    !(typeof v === "string" && v.trim() === "")
  ) {
    set.add(alias ?? key);
  }
}

function collectGroundedFields(steps: AgentStep[]): GroundedFields {
  const grounded: GroundedFields = {
    customer: new Set<string>(),
    product: new Set<string>(),
    quotation: new Set<string>(),
  };

  for (const s of steps) {
    if (s.kind !== "tool-result") continue;
    if (s.permissionStatus === "denied") continue;

    const payload = readObject(s.payload);
    if (!payload) continue;

    // Customer tools
    if (s.tool === "getCustomerByName" || s.tool === "getCustomerByCode") {
      addIfPresent(grounded.customer, payload, "customer_name", "customer_name");
      addIfPresent(grounded.customer, payload, "name", "customer_name");
      addIfPresent(grounded.customer, payload, "customer_code", "customer_code");
      addIfPresent(grounded.customer, payload, "code", "customer_code");
      addIfPresent(grounded.customer, payload, "address", "address");
      addIfPresent(grounded.customer, payload, "contact_person", "contact_person");
      addIfPresent(grounded.customer, payload, "contact_name", "contact_person");
      addIfPresent(grounded.customer, payload, "phone", "phone");
      addIfPresent(grounded.customer, payload, "email", "email");
    }

    // Product tools
    if (
      s.tool === "searchProducts" ||
      s.tool === "getProductByCode" ||
      s.tool === "getProductDetails"
    ) {
      addIfPresent(grounded.product, payload, "product_name", "product_name");
      addIfPresent(grounded.product, payload, "name", "product_name");
      addIfPresent(grounded.product, payload, "product_code", "product_code");
      addIfPresent(grounded.product, payload, "code", "product_code");
      addIfPresent(grounded.product, payload, "description", "description");
      addIfPresent(grounded.product, payload, "specifications", "specifications");
      addIfPresent(grounded.product, payload, "specs", "specifications");
      addIfPresent(grounded.product, payload, "brand", "brand");
      addIfPresent(grounded.product, payload, "model", "model");
    }

    // Quotation / pricing tools
    if (
      s.tool === "calculateQuotationPricing" ||
      s.tool === "createQuotationDraft"
    ) {
      addIfPresent(grounded.quotation, payload, "quantity", "quantity");
      addIfPresent(grounded.quotation, payload, "qty", "quantity");
      addIfPresent(grounded.quotation, payload, "unit_price", "unit_price");
      addIfPresent(grounded.quotation, payload, "line_total", "line_total");
      addIfPresent(grounded.quotation, payload, "subtotal", "subtotal");
      addIfPresent(grounded.quotation, payload, "total", "total");
      addIfPresent(grounded.quotation, payload, "grand_total", "grand_total");
      addIfPresent(grounded.quotation, payload, "discount", "discount");
      addIfPresent(grounded.quotation, payload, "margin", "margin");
      addIfPresent(grounded.quotation, payload, "markup", "markup");
    }
  }

  return grounded;
}

/** Labelled field claims the model might write. Each key is the
 *  canonical grounded-field name; each value is the regex that
 *  detects the corresponding label in assistant text. */
const FIELD_CLAIM_PATTERNS: Record<string, RegExp> = {
  customer_name:   /\bcustomer name\s*:/i,
  customer_code:   /\bcustomer code\s*:/i,
  address:         /\baddress\s*:/i,
  contact_person:  /\bcontact person\s*:/i,
  phone:           /\bphone\s*:/i,
  email:           /\bemail\s*:/i,

  product_name:    /\bproduct name\s*:/i,
  product_code:    /\bproduct code\s*:/i,
  description:     /\bdescription\s*:/i,
  specifications:  /\b(specifications|specs)\s*:/i,
  brand:           /\bbrand\s*:/i,
  model:           /\bmodel\s*:/i,

  quantity:        /\b(quantity|qty)\s*:/i,
  unit_price:      /\bunit price\s*:/i,
  line_total:      /\bline total\s*:/i,
  subtotal:        /\bsubtotal\s*:/i,
  total:           /\b(total|grand total)\s*:/i,
  discount:        /\bdiscount\s*:/i,
  margin:          /\bmargin\s*:/i,
  markup:          /\bmarkup\s*:/i,
};

const EXECUTION_GUARD_V3_MESSAGE =
  "I can only confirm fields that were returned by verified system results in this turn.";

export function sealExecutionSafetyV3(
  finalReply: string,
  steps: AgentStep[],
): string {
  const text = finalReply || "";
  const grounded = collectGroundedFields(steps);

  const claimedMissing: string[] = [];

  for (const [field, re] of Object.entries(FIELD_CLAIM_PATTERNS)) {
    if (!re.test(text)) continue;

    // Field claim is allowed only if the EXACT canonical name is
    // grounded in at least one of the three family sets.
    if (
      grounded.customer.has(field) ||
      grounded.product.has(field) ||
      grounded.quotation.has(field)
    ) {
      continue;
    }

    claimedMissing.push(field);
  }

  if (claimedMissing.length === 0) return finalReply;

  replaceLastAnswerStep(steps, EXECUTION_GUARD_V3_MESSAGE);
  console.warn(
    "[ai.agent.execution-guard-v3] replaced field claims without grounding:",
    claimedMissing.join(", "),
  );
  return EXECUTION_GUARD_V3_MESSAGE;
}

