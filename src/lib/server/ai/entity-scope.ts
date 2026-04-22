import "server-only";

/* ---------------------------------------------------------------------------
   ai/entity-scope — Phase 19 Koleex entity disambiguation.

   The word "Koleex" means three different things, and the model was
   conflating them:

     COMPANY  Koleex International Group — the corporate entity.
              Business, history, vision, offices, management,
              partnerships, industries.

     HUB      Koleex Hub — the internal digital platform / system.
              CRM, quotations, pricing, AI assistant, workflows,
              modules, settings. NOT the company, NOT a product.

     PRODUCT  Koleex machines / products — the physical product
              lines the company sells. Models, specifications,
              catalogs, industrial applications. NOT the company
              and NOT the digital system.

   This module provides:
     · EntityScope type (+ "AMBIGUOUS" for low-confidence cases)
     · detectEntityScope(query, history?) heuristic detector
     · ENTITY_GUIDANCE_* constants — compact prompt fragments that
       clarify the distinction for the model. Injected into every
       lane's system prompt so the model can't drift.

   Pure, deterministic, regex-based. No AI calls. ~1 ms per query.
   --------------------------------------------------------------------------- */

export type EntityScope = "COMPANY" | "HUB" | "PRODUCT" | "AMBIGUOUS";

export interface EntityScopeResult {
  scope: EntityScope;
  /** 0..1. ≥0.7 = strong signal; 0.4..0.7 = likely; <0.4 = AMBIGUOUS. */
  confidence: number;
  /** Used for telemetry — which bucket's signals fired. */
  signals: string[];
}

/* ─── Keyword pools per entity ─────────────────────────────────────
   Anchored to word/token boundaries via lookarounds that honour
   non-Latin scripts (Arabic / Chinese). The \b word-boundary in JS
   only works between ASCII word chars, so we build our own with
   (?:^|[^letter]) sentinels where needed. */

/* Arabic letter class (excludes Arabic punctuation so "؟" doesn't
   act as a letter — matches the pattern used in detect-language.ts). */
const AR_LETTERS = "\\u0621-\\u064A\\u0670-\\u06D3\\u06FA-\\u06FF";
const NOT_AR = `[^${AR_LETTERS}]`;

/** COMPANY signals — corporate / business entity. */
const COMPANY_PATTERNS: RegExp[] = [
  /\b(company|corporation|corporate|group|business|enterprise)\b/i,
  /\bkoleex\s+international\s+group\b/i,
  /\b(history|founded|vision|mission|values|headquart(?:er|ers)|hq)\b/i,
  /\b(office|offices|branches?|subsidiary|partnership|partnerships?)\b/i,
  /\b(industry|industries|sectors?|market|markets|portfolio)\b/i,
  /\b(ceo|founder|founders|management|leadership|executives?|board)\b/i,
  /\b(manufacturer|manufacturing|trader|supplier|exporter|importer)\b/i,
  /\b(based|headquartered|located|operations)\b/i,
  /\b(global|international|presence|reach)\b/i,
  /\bwho\s+(is|are)\s+koleex\b/i,
  /\bwhat\s+is\s+koleex(?:\s+international(?:\s+group)?)?\s*[?!.]?$/i,
  /\b(established|since)\s+\d{4}\b/i,
  /\babout\s+(?:the\s+)?(?:koleex\s+)?(?:international\s+(?:group\s+)?)?company\b/i,
  /\b(koleex'?s?\s+history|koleex'?s?\s+story|koleex'?s?\s+background)\b/i,
  // Arabic
  new RegExp(`(?:^|${NOT_AR})(?:الشركة|شركة|مؤسسة|المجموعة|مجموعة\\s+كولكس)`),
  new RegExp(`(?:^|${NOT_AR})(?:مقر|مكاتب|فروع|شركاء|تأسس|تأسست|رؤية|رسالة)`),
  new RegExp(`(?:^|${NOT_AR})(?:رئيس\\s+تنفيذي|مدير\\s+عام|مؤسس|إدارة|قيادة)`),
  // Chinese
  /公司|集团|总部|办事处|合作伙伴|创立|成立/,
];

/** HUB signals — digital platform / system / AI. */
const HUB_PATTERNS: RegExp[] = [
  /\bkoleex\s+hub\b/i,
  /\b(hub|platform|system|portal|dashboard)\b(?![-\s]*(?:brand|motor|engine))/i,
  /\b(crm|erp|sso|api|sdk)\b/i,
  /\b(workflow|workflows|pipeline|dashboard|module|modules|feature|features)\b/i,
  /\b(quotation\s+(?:workflow|tool|system|engine)|pricing\s+(?:engine|tool|policy))\b/i,
  /\b(internal|digital|software|app|application)\s+(?:tool|system|platform|solution)\b/i,
  /\b(ai\s+assistant|koleex\s+ai|the\s+ai|chat\s+(?:bot|assistant))\b/i,
  /* Spec test case: "Does Koleex have AI?" → HUB. Standalone AI in
     a Koleex-context question points at the Hub's AI assistant, not
     the corporate entity. Narrow regex — only matches when AI is a
     standalone token near "koleex" or in a question about having
     AI capabilities. */
  /\bkoleex\s+(?:has|have|offer|offers|got)\s+.{0,15}\bai\b/i,
  /\b(?:does|has|have|got)\s+(?:koleex\s+)?.{0,10}\bai\b[?]/i,
  /\b(sign\s+in|login|logout|user\s+account|role|roles?\s*&?\s*permissions?)\b/i,
  /\b(settings|preferences|configuration)\b/i,
  /\b(what\s+can\s+(?:the\s+)?hub\s+do|how\s+does\s+the\s+hub\s+work)\b/i,
  /\b(koleex\s+ai\s+(?:app|assistant|bot))\b/i,
  // Arabic
  new RegExp(`(?:^|${NOT_AR})(?:النظام|المنصة|البرنامج|التطبيق)`),
  new RegExp(`(?:^|${NOT_AR})(?:لوحة|واجهة|إعدادات|صلاحيات)`),
  new RegExp(`كوليكس\\s+هب|كولكس\\s+هب`),
  // Chinese
  /系统|平台|仪表板|模块|功能/,
];

/** PRODUCT signals — machines, products, specs, catalog. */
const PRODUCT_PATTERNS: RegExp[] = [
  /\b(machines?|machinery|equipment|equipments)\b/i,
  /\b(models?|model\s+number|model\s+name|series|range)\b/i,
  /\b(spec|specs|specification|specifications|datasheet)\b/i,
  /\b(product|products|catalog(?:ue)?|range)\b(?!\s+(?:management|team))/i,
  /\b(industrial|manufacturing)\s+(?:application|machine|equipment|line)\b/i,
  /\b(sku|part\s+number|item\s+code)\b/i,
  /\b(what\s+(?:do|does)\s+koleex\s+(?:make|produce|manufacture|sell))\b/i,
  /\b(koleex\s+(?:machines?|products?|equipment|models?))\b/i,
  // Arabic
  new RegExp(`(?:^|${NOT_AR})(?:آلة|آلات|معدات|منتج|منتجات|موديل|موديلات|مواصفات)`),
  // Chinese
  /机器|设备|产品|型号|规格|目录/,
];

/** Generic "Koleex" without a specific entity marker — likely COMPANY
 *  unless context says otherwise. Listed separately so the caller
 *  can see why a low-confidence COMPANY default fired. */
const GENERIC_KOLEEX_PATTERNS: RegExp[] = [
  /\bkoleex\b/i,
  /كولكس|كوليكس/,
  /柯勒克斯|科勒/,
];

/** Count regex matches in `text` from a pool. Returns the number of
 *  patterns that matched at least once plus the label of the first
 *  match for telemetry. */
function matchCount(text: string, patterns: RegExp[]): { hits: number; sample?: string } {
  let hits = 0;
  let sample: string | undefined;
  for (const p of patterns) {
    if (p.test(text)) {
      hits++;
      if (!sample) {
        const m = text.match(p);
        if (m) sample = m[0].slice(0, 30);
      }
    }
  }
  return { hits, sample };
}

/** Detect the entity scope of the query. When context (prior turns)
 *  is supplied, the previous entity is considered for continuity —
 *  a follow-up question like "what about its CRM?" after a HUB
 *  discussion stays HUB. The current query's explicit signals still
 *  override context. */
export function detectEntityScope(
  query: string,
  history?: Array<{ role: string; content: string }>,
): EntityScopeResult {
  const text = (query ?? "").trim();
  if (!text) return { scope: "AMBIGUOUS", confidence: 0, signals: [] };

  const companyM  = matchCount(text, COMPANY_PATTERNS);
  const hubM      = matchCount(text, HUB_PATTERNS);
  const productM  = matchCount(text, PRODUCT_PATTERNS);
  const hasKoleex = GENERIC_KOLEEX_PATTERNS.some((p) => p.test(text));

  const signals: string[] = [];
  if (companyM.hits > 0)  signals.push(`company:${companyM.hits}:${companyM.sample ?? ""}`);
  if (hubM.hits > 0)      signals.push(`hub:${hubM.hits}:${hubM.sample ?? ""}`);
  if (productM.hits > 0)  signals.push(`product:${productM.hits}:${productM.sample ?? ""}`);

  /* Clear winner — one bucket has at least 1 hit and at least 2
     more than the runners-up. */
  const scores = [
    ["COMPANY" as EntityScope, companyM.hits],
    ["HUB"     as EntityScope, hubM.hits],
    ["PRODUCT" as EntityScope, productM.hits],
  ];
  scores.sort((a, b) => (b[1] as number) - (a[1] as number));
  const [top, topHits] = scores[0];
  const [_runner, runnerHits] = scores[1];

  if ((topHits as number) > 0 && (topHits as number) - (runnerHits as number) >= 1) {
    const conf = Math.min(1, 0.55 + (topHits as number) * 0.15);
    return { scope: top as EntityScope, confidence: conf, signals };
  }

  /* No explicit signals — look to history for topic continuity. */
  if (history && history.length > 0) {
    const lastTurns = history.slice(-4).map((m) => m.content).join("\n");
    const hC = matchCount(lastTurns, COMPANY_PATTERNS).hits;
    const hH = matchCount(lastTurns, HUB_PATTERNS).hits;
    const hP = matchCount(lastTurns, PRODUCT_PATTERNS).hits;
    const best = Math.max(hC, hH, hP);
    if (best > 0) {
      const scope: EntityScope =
        hC === best ? "COMPANY" : hH === best ? "HUB" : "PRODUCT";
      signals.push(`context:${scope.toLowerCase()}`);
      return { scope, confidence: 0.5, signals };
    }
  }

  /* Only "Koleex" mentioned with no entity marker — weak COMPANY
     default (matches the Phase 19 spec: "What is Koleex?" → COMPANY
     unless context says otherwise). */
  if (hasKoleex) {
    signals.push("generic_koleex_defaults_company");
    return { scope: "COMPANY", confidence: 0.35, signals };
  }

  return { scope: "AMBIGUOUS", confidence: 0, signals };
}

/* ─── Prompt guidance ───────────────────────────────────────────── */

/** Short form for the FAST lane (<300 chars). The model just needs a
 *  reminder so it doesn't call the company "Koleex Hub". */
export const ENTITY_GUIDANCE_SHORT =
  "Koleex identity — keep these separate: " +
  "COMPANY = Koleex International Group (the company). " +
  "HUB = Koleex Hub (the internal digital system, not the company). " +
  "PRODUCT = Koleex machines/products (the physical product lines). " +
  "Never call the company 'Koleex Hub'; never call the Hub a 'product'.";

/** Medium form for the SMART lane + the orchestrator system prompt.
 *  Includes a few disambiguation examples so the model knows how to
 *  handle generic "Koleex" questions. */
export const ENTITY_GUIDANCE_FULL = `Koleex entity distinction (critical — use the correct label every time):

• COMPANY — "Koleex International Group" — the corporate entity.
  Use when the user asks about the business, history, vision,
  offices, management, industries, partnerships, or
  manufacturer/trader status.

• HUB — "Koleex Hub" — the internal digital platform / system /
  workspace. Covers CRM, quotations, pricing, AI assistant,
  modules, settings, workflows. NOT the company. NOT a product.

• PRODUCT — "Koleex machines" / "Koleex products" — the physical
  product lines the company makes or sells. Covers models, specs,
  applications, catalogs.

Rules:
- Generic "Koleex" with no context → COMPANY (the default identity).
- Keep the entity stable within a conversation unless the user
  clearly switches topic.
- If the scope is truly ambiguous, either anchor the answer
  ("If you mean Koleex International Group the company, …") or
  ask a short clarifying question.

Correct phrasings:
  "Koleex International Group is a manufacturer and trader…"
  "Koleex Hub is the company's digital platform used for…"
  "Koleex machines are part of the company's product offering…"

Forbidden:
  "Koleex Hub is a global company…" (confuses Hub with company)
  "Koleex the company is an AI platform…" (confuses company with Hub)
  "Koleex is a machine made by…" (confuses Koleex with a product)`;

/** Directed guidance — once the entity is detected, tell the model
 *  explicitly which one to answer about. Combined with the full
 *  guidance above so the model has the rules AND a clear pointer
 *  for this specific turn. */
export function buildEntityDirective(scope: EntityScope): string {
  if (scope === "COMPANY") {
    return "Entity lock: this turn is about KOLEEX INTERNATIONAL GROUP (the company). Refer to it as 'Koleex International Group' or 'the company', not 'Koleex Hub'.";
  }
  if (scope === "HUB") {
    return "Entity lock: this turn is about KOLEEX HUB (the digital platform). Refer to it as 'Koleex Hub' or 'the platform', not 'the company'.";
  }
  if (scope === "PRODUCT") {
    return "Entity lock: this turn is about KOLEEX MACHINES/PRODUCTS. Refer to them as 'Koleex machines' or 'Koleex products', not 'the company' or 'the Hub'.";
  }
  return "Entity scope is ambiguous — answer generically and if the user's intent is unclear, ask whether they mean the company (Koleex International Group), the digital platform (Koleex Hub), or the products (Koleex machines).";
}
