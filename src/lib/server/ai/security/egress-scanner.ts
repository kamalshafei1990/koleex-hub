import "server-only";

/* ---------------------------------------------------------------------------
   security/egress-scanner — inspect a string before it leaves our network.

   THE PROBLEM THIS SOLVES (audit Issue 2, P0)
   -------------------------------------------
   `search_web` forwarded `args.query` verbatim to a third-party search vendor.
   The prohibition against putting Koleex data in a search existed ONLY in the
   tool description and the system prompt:

       "NEVER put Koleex's own data in the query — no customer names, prices,
        quotation contents, employee details or internal codes"

   A rule the model follows only sometimes is not a rule. It was reachable both
   by prompt injection and by a user asking a naturally-phrased question, and a
   customer name or a quotation total leaving the network returns HTTP 200 —
   there is no error to notice afterwards.

   THE CALIBRATION PROBLEM
   -----------------------
   Blunt blocking breaks the feature. "USD to CNY rate" is a legitimate query
   NAMED IN THE TOOL'S OWN DESCRIPTION, and it contains a currency code. So a
   currency code cannot be a blocking signal on its own.

   The policy is therefore two-tier:

     BLOCK — data that identifies a person, a record or an internal entity.
             There is no legitimate public-web search that needs it:
             emails, phone numbers, UUIDs, internal document numbers,
             Koleex model codes, and money co-occurring with commercial context.

     WARN  — shapes that are usually fine but worth recording, e.g. a bare
             amount with no commercial context ("convert 5000 USD to CNY").
             Allowed through, logged for review.

   WHAT THIS DOES NOT YET DO — stated plainly rather than implied
   -------------------------------------------------------------
   It does not match the query against this tenant's actual customer and
   supplier NAMES. Doing that needs either a per-request lookup (a round-trip
   on every web search, on a network where round-trips are the latency budget)
   or a cached per-tenant name index. That belongs with the Phase 5 cache work,
   where the cost can be measured. Until then a bare company name that matches
   no other pattern will pass — this scanner reduces the exposure, it does not
   claim to eliminate it.
   --------------------------------------------------------------------------- */

export type EgressVerdict =
  | { allowed: true; warnings: string[] }
  | { allowed: false; reason: string; matched: string };

/* ── BLOCK-tier patterns ────────────────────────────────────────────────────
   Each entry names WHAT it protects, so a future reader can judge whether a
   change is safe. Ordered most-specific first for a useful `reason`. */
const BLOCKING: Array<{ id: string; re: RegExp; reason: string }> = [
  {
    id: "email",
    re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    reason: "the query contains an email address",
  },
  {
    id: "uuid",
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    reason: "the query contains an internal record id",
  },
  {
    /* Koleex document numbers: KL-QU-1234 (app scheme) and Q-202608-0001
       (the AI's own quotation-draft scheme). */
    id: "document-number",
    re: /\b(KL-[A-Z]{2}-\d+|Q-\d{6}-\d{3,})\b/i,
    reason: "the query contains an internal document number",
  },
  {
    /* Koleex machine model codes as they appear in the catalog: XF-A10,
       XF-1800E-HZ, XPRS-190S. Letters, a hyphen, then an alphanumeric block. */
    id: "model-code",
    re: /\b[A-Z]{2,5}-[A-Z0-9]{2,}(-[A-Z0-9]+)*\b/,
    reason: "the query contains what looks like an internal product/model code",
  },
  {
    id: "phone",
    re: /(\+\d{1,3}[\s-]?)?\(?\d{3,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/,
    reason: "the query contains a phone number",
  },
];

/* Money, in the shapes the pricing guard already recognises. */
const MONEY =
  /([$€£¥]\s?\d[\d,]*(\.\d+)?)|(\d[\d,]*(\.\d+)?\s?[$€£¥])|(\b(USD|EGP|CNY|EUR|GBP|SAR|AED|TRY|JPY|KRW|RMB)\s?\d[\d,]*(\.\d+)?\b)|(\b\d[\d,]*(\.\d+)?\s?(USD|EGP|CNY|EUR|GBP|SAR|AED|TRY|JPY|KRW|RMB)\b)/i;

/* Commercial context. Money next to any of these is a quotation figure, not a
   public-web question. English / Arabic / Chinese, matching the rest of the
   codebase's trilingual detectors. */
const COMMERCIAL_CONTEXT =
  /\b(customer|client|supplier|vendor|quote|quotation|invoice|order|margin|markup|discount|cost|our price|we (sell|quote|charge)|credit limit|payment terms)\b|عميل|مورد|عرض سعر|فاتورة|هامش|خصم|تكلفة|حد ائتمان|客户|供应商|报价|发票|利润|折扣|成本/i;

/* Bare-amount shapes that are legitimate lookups, so they never even warn. */
const BENIGN_AMOUNT = /\b(convert|exchange|rate|worth|equals?|in)\b[^.?!]{0,20}\d/i;

/**
 * Inspect a string bound for an external service.
 *
 * Deterministic: no model call, no network, no DB. Safe to run on every
 * outbound query — it is pure regex over a short string.
 */
export function scanEgress(text: string): EgressVerdict {
  const q = String(text ?? "");
  if (!q.trim()) return { allowed: true, warnings: [] };

  for (const rule of BLOCKING) {
    const m = rule.re.exec(q);
    if (m) {
      return { allowed: false, reason: rule.reason, matched: rule.id };
    }
  }

  const money = MONEY.exec(q);
  if (money) {
    if (COMMERCIAL_CONTEXT.test(q)) {
      return {
        allowed: false,
        reason: "the query contains a monetary amount together with commercial context",
        matched: "money+commercial",
      };
    }
    if (!BENIGN_AMOUNT.test(q)) {
      return { allowed: true, warnings: ["bare monetary amount"] };
    }
  }

  return { allowed: true, warnings: [] };
}

/** Message handed to the MODEL when a query is refused. Written so the model
 *  relays the reason in the user's own language rather than printing English
 *  at an Arabic speaker — the same contract `search_web` already follows for
 *  its not-configured and empty-result cases. */
export function egressRefusalMessage(reason: string): string {
  return (
    `That search was not sent: ${reason}. Koleex data must never leave the ` +
    `network in a web query. Tell the user you can look up the PUBLIC part of ` +
    `their question, and use the internal tools for anything about Koleex's own ` +
    `records. Do not repeat the blocked text back to them.`
  );
}
