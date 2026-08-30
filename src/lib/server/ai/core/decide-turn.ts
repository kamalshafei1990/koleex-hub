/* ---------------------------------------------------------------------------
   ai/core/decide-turn — the lane decision, in ONE place.

   Phase 2A. Every regex that decides WHICH lane a user turn takes used to
   live in orchestrator.ts and be imported from there by two API routes. The
   orchestrator's own comment named the cost of that arrangement: "If this
   list grows, collapse into a single exported detectFastPath(msg) helper."
   This module is that collapse — the routes now import the decision from the
   layer that owns it rather than from the loop that happens to sit next to it.

   Everything here is PURE: no I/O, no env, no Supabase, no UserContext, and
   deliberately NO `server-only` — the same choice session-codec.ts made and
   for the same reason, that a pure decision function should be runnable in
   plain Node so its behaviour can be tested rather than only grepped for.
   There is nothing secret in a regex. It is a property worth keeping: if a
   detector ever needs to await something, it does not belong in this file.

   Moved verbatim from orchestrator.ts. Behaviour is byte-identical; the only
   edits are (a) `export` added where a route or the loop needs the symbol and
   (b) two comments reunited with the function they describe — in the old file
   the live-information comment sat above isMemoryIntentQuery and a brand
   comment sat above the brand-name replacer, both describing something else.
   --------------------------------------------------------------------------- */

/* ── Canned fast-reply table ────────────────────────────────
   Narrow exact-match list: greetings, identity, "what can you do",
   thanks — EN / AR / ZH. Hits return instantly without any Groq call.
   Keep this tight; business prompts must NEVER match here. */
/* Narrow canned fast-replies: only the truly trivial phrases
   ("hi", "thanks") where a longer answer would feel performative.
   Identity / capability questions ("who are you", "what can you do")
   are deliberately NOT in this table anymore — they now hit the model
   which gives a proper, substantive answer about what the assistant
   can actually help with. */
const FAST_REPLIES: Array<[RegExp, string]> = [
  // English
  [/^(hi|hello|hey)[\s,!.?]*$/i,              "Hi! How can I help?"],
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,  "You're welcome."],
  // Arabic
  [/^(مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/,      "مرحبا! كيف أقدر أساعدك؟"],
  [/^(شكرا|شكراً)[\s!.؟]*$/,                   "العفو."],
  // Chinese
  [/^(你好|您好|嗨)[\s,!.?]*$/,                "你好!有什么可以帮您的吗?"],
  [/^谢谢[\s!。?？]*$/,                        "不客气。"],
];

export function tryFastReply(msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;
  for (const [pat, reply] of FAST_REPLIES) {
    if (pat.test(m)) return reply;
  }
  return null;
}

export function isSmallTalk(msg: string): boolean {
  const s = msg.trim().toLowerCase();
  if (!s) return true;
  if (s.length < 3) return true;
  const patterns: RegExp[] = [
    /^(hi|hello|hey|yo|hola|salam|salaam|مرحبا|اهلا|أهلا|السلام|你好|hi there)[\s,!.?؟]*$/i,
    /^(good\s*(morning|afternoon|evening|night))[\s,!.?؟]*$/i,
    /who\s+(are|r)\s+you\s*\??$/i,
    /what\s+(are|r)\s+you\s*\??$/i,
    /what\s+can\s+you\s+do\s*\??$/i,
    /what\s+do\s+you\s+know\s*\??$/i,
    /how\s+do\s+you\s+work\s*\??$/i,
    /what\s+kind\s+of\s+ai\s+are\s+you\s*\??$/i,
    /how\s+are\s+you[\s,!.?؟]*$/i,
    /how's\s+it\s+going\s*[?!.]*$/i,
    /^(thanks|thank\s+you|thx|ty|شكرا|谢谢)[\s!.؟]*$/i,
    /^(ok|okay|good|great|nice|cool|got\s+it|understood)[\s!.؟]*$/i,
    /^(bye|goodbye|see\s+you|مع السلامة|再见)[\s!.؟]*$/i,
    /من\s+أنت\s*\??$/, // Arabic: "who are you?"
    /你\s*是\s*谁/,        // Chinese: "who are you?"
    /* Phase 9: broader casual check-in phrases that users expect a
       snappy response to — these were hitting the full tool-loop
       agent (3–8 s) because they don't match the patterns above.
       Moving them to the fast-path drops latency to ~500 ms. */
    /^(are|r)\s+(you|u)\s+(ok|okay|there|good|fine|alright|busy|still\s+there|still\s+here|awake|online|ready)\s*[?!.]*$/i,
    /^(u|you)\s+(ok|okay|there|busy|still\s+there)\s*[?!.]*$/i,
    /^(what'?s|wat'?s|wats)\s+up\s*[?!.]*$/i,
    /^sup\s*[?!.]*$/i,
    /^am\s+(testing|talking\s+to)\s+you\s*[?!.]*$/i,
    /^(i'?m|im)\s+(just\s+)?(testing|talking\s+to)\s+you\s*[?!.]*$/i,
    /^(test|testing|ping|check|hello\s+again)\s*[?!.]*$/i,
    /^still\s+there\s*[?!.]*$/i,
    /^you\s+there\s*[?!.]*$/i,
    /* Arabic casual check-ins */
    /^(كيف|كيفك|ازيك|إزيك|كيف\s+حالك)\s*[؟?!.]*$/,
    /^(عامل\s+ايه|عامله\s+ايه|عاملة\s+ايه|تمام|كويس|اخبارك\s+ايه)\s*[؟?!.]*$/,
    /^(انت\s+فين|انت\s+هنا|انت\s+موجود|شغال|شغالة)\s*[؟?!.]*$/,
    /* Chinese casual */
    /^(在吗|在么|还在吗|你在吗|忙吗|你好吗)\s*[?？!]*$/,
  ];
  return patterns.some((p) => p.test(s));
}

/** Brand / company-profile question detector. Matches requests that can
 *  be answered from BRAND_KNOWLEDGE alone (no DB lookup, no tool
 *  schemas). Routing these to the no-tools fast-path keeps the agent
 *  request under Groq's payload limit (413) while still giving full
 *  brand answers. Covers EN / AR / ZH keywords. */
/* Classify which brand-knowledge section(s) a message needs.
   Returns one of "none" | "company" | "ai" | "both". The orchestrator
   injects only the relevant slice — loading both sections at once
   exceeds Groq's request-size limit (413). AI-identity triggers win
   over company triggers when both could match, since phrases like
   "Koleex AI" are Section-2-specific. */
export type BrandSection = "none" | "company" | "ai" | "both";

export function classifyBrandSection(msg: string): BrandSection {
  const s = msg.trim().toLowerCase();
  if (!s) return "none";

  /* Regex-based matchers — tolerant to common typos, missing
     punctuation, verb-tense variations, and word-order differences.
     Rigid substring lists missed real user turns like "who create
     you" (no 'd'), "whats ur name", etc. Each regex is tight to its
     intent to avoid false positives on unrelated chat. */

  /* AI-identity triggers — Section 2. */
  const aiPatterns: RegExp[] = [
    // The brand-AI product name (strongest signal for Section 2)
    /\bkoleex\s+ai\b/i,

    // "who are you" / "who r u" / "who you are"
    /\bwho\s+(?:are|r|u|is)\s+(?:you|u)\b/i,
    // "what are you" / "what r u" / "what kind of ai"
    /\bwhat\s+(?:are|r)\s+(?:you|u)\b/i,
    /\bwhat\s+kind\s+of\s+ai\b/i,
    // "what can you do" / "what do you know" / "what you can do"
    /\bwhat\s+(?:can|do)\s+you\s+(?:do|know)\b/i,
    /\bwhat\s+you\s+can\s+do\b/i,

    // Name questions — tolerate missing apostrophe, extra spaces
    /\bwhat('?s| is| are)?\s+your\s+name\b/i,
    /\byour\s+name\b/i,

    // Who created/made/built you — present OR past tense (fixes "who create you")
    /\bwho\s+(?:create[sd]?|made?|build[ts]?|built|design[esd]?|developed?|trained?)\s+(?:you|u)\b/i,

    // "Are you a real person" / "are you human" / "are you real"
    /\bare\s+you\s+(?:a\s+)?(?:real|human)(?:\s+person)?\b/i,
    /\bare\s+you\s+real\b/i,

    // Trust / reliability of answers
    /\b(?:can\s+i\s+)?trust\s+your\s+(?:answer|reply|response)/i,

    // Replace human support
    /\breplace\s+humans?(?:\s+support)?\b/i,

    // Data/order access
    /\baccess\s+my\s+(?:data|order|orders|account|record)/i,
    /\bsee\s+my\s+(?:order|orders|account|record)/i,

    // Open "can I talk to you"
    /\bcan\s+i\s+talk\s+to\s+you\b/i,

    // Arabic
    /\bما\s+اسمك\b/,
    /\bما\s+هو\s+اسمك\b/,
    /\bاسمك\b/,
    /\bمن\s+(?:أنت|انت)\b/,
    /\bمين\s+(?:أنت|انت)\b/,
    /\bمن\s+(?:صنعك|طورك|بناك|أنشأك|انشأك)\b/,
    /\bهل\s+(?:أنت|انت)\s+إنسان\b/,
    /\bهل\s+(?:أنت|انت)\s+انسان\b/,

    // Chinese
    /你叫什么名字/,
    /你的名字/,
    /你是谁/,
    /你是(?:真人|人类)吗/,
    /你(?:能|可以)做什么/,
  ];

  /* Company-brand triggers — Section 1. Explicit brand / company
     facts (history, mission, vision, CEO, founders, official brand
     material). Word-boundary matching on "koleex" prevents stray
     matches inside URLs or file paths. */
  const companyPatterns: RegExp[] = [
    // English
    /\bkoleex\b/i,
    /\bkoleex\s+(?:group|international|story|history)\b/i,
    /\bcompany\s+history\b/i,
    /\b(?:history|heritage|founded|founder|founders)\b/i,
    /\bceo\b/i,
    /\b(?:mission|vision|core\s+values)\b/i,
    /\bvision\s+2035\b/i,
    /\b(?:official\s+brand|brand\s+guidelines|brand\s+story)\b/i,
    /\b(?:kas|eskn|nefertiti|shafei)\b/i,
    /\bk-o-l-e-e-x\b/i,

    // Where / when / what / who for the company
    /\bwhere\s+is\s+koleex\b/i,
    /\bwhere\s+(?:are|is)\s+you\s+based\b/i,
    /\bheadquarters\b/i,
    /\bwhen\s+(?:was|did)\s+koleex\b/i,
    /\bwhat\s+(?:is|does|industries)\s+koleex\b/i,

    // Arabic
    /\bكوليكس\b/,
    /\bشافعي\b/,
    /\b(?:مؤسس|المؤسس)\b/,
    /\bالرئيس\s+التنفيذي\b/,
    /\bالمدير\s+التنفيذي\b/,
    /\b(?:رؤية|مهمة|رسالة|القيم|تاريخ|تراث)\b/,

    // Chinese
    /柯莱克斯/,
    /科莱克斯/,
    /创始人/,
    /首席执行官/,
    /(?:愿景|使命|价值观|历史)/,
  ];

  const hitsAi = aiPatterns.some((re) => re.test(s));
  const hitsCompany = companyPatterns.some((re) => re.test(s));

  /* AI-identity wins when both match — e.g. "What is Koleex AI?"
     matches both koleex-ai (ai) and koleex (company) but is
     unambiguously a Section 2 question. */
  if (hitsAi) return "ai";
  if (hitsCompany) return "company";
  return "none";
}

/* ---------------------------------------------------------------------------
   CHOICE-SHAPED TURNS — the one place we take the decision away from the model.

   Owner, 2026-08-22: a "which one should I pick" question should come back as
   a CARD of options he taps, not a paragraph. The `askUser` tool renders that
   card, and the prompt asks the model to use it. Measured against the live
   model on "Which spreading machine should I choose?": it ran its lookups,
   found the candidates, and then wrote an excellent three-paragraph answer
   ending in three questions — prose, every time, however the rule was worded.

   A prompt rule the model reliably ignores is not a rule. So on this one
   shape we stop asking: once the lookups are done, the next request is sent
   with `tool_choice` NAMING askUser, which the API guarantees. The model still
   chooses the options — it has just lost the option of answering in prose.

   Kept deliberately narrow, and it costs the model nothing it needs:
     · BOTH a "which one" opener AND a Koleex domain noun must appear, so
       "which is better, tea or coffee?" is untouched.
     · It fires only AFTER at least one tool has run, so the options are real
       records the model just looked up, never invented ones.
     · Once per turn (see forcedAsk). If askUser comes back malformed the loop
       returns to normal rather than forcing forever.
   --------------------------------------------------------------------------- */
const CHOICE_OPENER = /(\bwhich\b|\bwhat\s+kind\b|\bwhat\s+type\b|أي\s|أنهي|انهي|哪个|哪种)/;
const CHOICE_DOMAIN_NOUN =
  /(machine|model|product|item|equipment|supplier|vendor|customer|client|fabric|series|ماكين|موديل|منتج|مورد|عميل|قماش|机器|型号|产品)/;

export function isChoiceShapedQuestion(msg: string): boolean {
  const s = msg.toLowerCase();
  return CHOICE_OPENER.test(s) && CHOICE_DOMAIN_NOUN.test(s);
}

/* ---------------------------------------------------------------------------
   TRADE TERMS — Incoterms and payment terms.

   Used twice, which is why it is a named helper rather than an inline test:
   once by isBusinessDataQuery (to route the turn into the tool lane at all)
   and once by the tool_choice force in the agent loop (to make the lookup
   actually happen). Both must agree, or a question reaches the lane with
   tools attached and is still answered from memory.

   Incoterm codes are matched as whole tokens — a substring test would fire
   on "fobbing", "capable", "cifr". */
const TRADE_TERM_CODE =
  /\b(exw|fca|fas|fob|cfr|cif|cpt|cip|dap|dpu|ddp)\b/i;
const TRADE_TERM_EN =
  /\b(incoterms?|letters?\s+of\s+credit|l\/c|lc\b|documentary\s+(credit|collection)|ucp\s*600|urc\s*522|urdg|isp98|sblc|standby|d\/p|d\/a|documents?\s+against\s+(payment|acceptance)|cash\s+against\s+documents|payment\s+terms?|terms?\s+of\s+payment|open\s+account|telegraphic\s+transfer|t\/t\b|bill\s+of\s+lading|risk\s+(transfer|passes)|institute\s+cargo\s+clauses)\b/;
const TRADE_TERM_AR =
  /إنكوترمز|انكوترمز|اعتماد\s*مستندي|خطاب\s*اعتماد|شروط\s*الدفع|شروط\s*السداد|تحصيل\s*مستندي|بوليصة\s*شحن|نقل\s*المخاطر|حساب\s*مفتوح/;
const TRADE_TERM_ZH = /贸易术语|国际贸易术语|信用证|付款条件|付款方式|托收|提单/;

export function isTradeTermQuestion(msg: string): boolean {
  const raw = msg ?? "";
  if (!raw) return false;
  const s = raw.toLowerCase();
  return (
    TRADE_TERM_CODE.test(raw) ||
    TRADE_TERM_EN.test(s) ||
    TRADE_TERM_AR.test(raw) ||
    TRADE_TERM_ZH.test(raw)
  );
}

/* ─── Phase 10: business-data detector ────────────────────────────
   Returns true when the question clearly needs Koleex data (the
   orchestrator's tool loop). Returns false when the question is
   general — definitions, translations, explanations, history,
   math, advice, "what's the capital of X", etc. The route uses
   this to bypass the heavy business-agent prompt for general
   questions, so the AI answers ANY question instead of trying to
   route everything through the tool layer.

   Intentionally conservative: when uncertain, return false so the
   query goes to the open-assistant lane. If a general-looking query
   actually needs data, the open-assistant prompt will naturally
   fall back to "I don't have access to that — try opening the X
   app" which is the right UX. The reverse (routing a general
   question through the tool loop) is what users are complaining
   about right now. */
export function isBusinessDataQuery(msg: string): boolean {
  const s = (msg ?? "").toLowerCase();
  if (!s) return false;

  /* Explicit possessives + business nouns: "my customers",
     "our products", "the invoice", "this quotation". */
  if (
    /\b(my|our|the|this|that|these|those)\s+(customer|client|buyer|product|item|inventory|stock|invoice|bill|receipt|quotation|quote|order|po|purchase\s*order|supplier|vendor|catalog|sales)s?\b/.test(
      s,
    )
  )
    return true;

  /* Imperatives: "list / show / find / search / look up / get" +
     business noun. Not triggered by "list the benefits of X" etc.
     because those go to generic nouns. */
  if (
    /\b(list|show|display|find|search|look\s*up|get|pull|fetch|retrieve)\s+(all\s+|my\s+|our\s+|the\s+)?(customer|client|buyer|product|item|inventory|stock|invoice|bill|receipt|quotation|quote|order|po|supplier|vendor|catalog|contact)s?\b/.test(
      s,
    )
  )
    return true;

  /* CHOICE-SHAPED QUESTIONS — "which spreading machine should I choose",
     "which of these models", "أي ماكينة أختار", "哪个型号".

     These reach for a decision between real Koleex records, which is
     precisely what askUser exists to turn into a card of options. Without
     this they matched nothing above and fell to the general lane, which
     streams WITHOUT TOOLS — so the assistant could not offer choices no
     matter how well the agent prompt was written, and answered with a
     paragraph instead. Owner saw exactly that, twice.

     Deliberately narrow: it needs BOTH a "which one" opener AND a Koleex
     domain noun. "Which is better, tea or coffee" stays on the fast lane
     where it belongs. */
  if (CHOICE_OPENER.test(s) && CHOICE_DOMAIN_NOUN.test(s)) return true;

  /* Commercial action verbs: create / draft / prepare a quotation,
     invoice, order, RFQ, etc. */
  if (
    /\b(create|draft|prepare|generate|make|issue|send|build|raise)\s+(an?\s+|the\s+|a\s+new\s+)?(quotation|quote|invoice|bill|order|po|purchase\s*order|rfq|proposal|offer)\b/.test(
      s,
    )
  )
    return true;

  /* Count queries over business data: "how many products",
     "how many customers". Excludes general counts like "how many
     languages" or "how many planets". */
  if (
    /\bhow\s+many\s+(product|item|customer|client|buyer|invoice|quotation|quote|order|supplier|vendor|stock|sale)s?\b/.test(
      s,
    )
  )
    return true;

  /* Specific-entity lookups: "customer ABC Corp", "product SKU-123",
     "invoice #42", etc. */
  if (
    /\b(customer|client|product|invoice|quotation|order)\s+(?:code\s+|number\s+|id\s+|#|no\.?\s*)?[a-z0-9-]{2,}/i.test(
      msg,
    )
  )
    return true;

  /* Price / cost / margin / discount OF a specific product or
     customer. "what's the price of product X" → business.
     "what's the price of happiness" → NOT business. */
  if (
    /\b(price|cost|margin|commission|discount|markup|profit)\s+(for|of)\s+(product|item|customer|client|sku|model)\b/.test(
      s,
    )
  )
    return true;

  /* Koleex-specific data prefixes. */
  if (/\bkoleex\s+(product|customer|invoice|quotation|order|inventory|sales|data)/.test(s))
    return true;

  /* Machine-catalog questions → tool loop (searchCatalog /
     listCatalogFamilies). A Koleex model code alone is a strong
     signal ("tell me about XSL-8000A4"); so is any mention of the
     catalog or a machine-family + machine/model pairing. */
  if (/\bX(?:F|CC?|SL|SO|SI|SS|SE|SH|SU|A|PL?|PS|R)-[A-Z0-9]/i.test(msg)) return true;
  if (/\b(catalog|catalogue)\b/.test(s)) return true;
  if (
    /\b(overlock|lockstitch|interlock|coverstitch|bartack\w*|buttonhol\w*|zigzag|spreading|fusing|blind\s*stitch|multi-?needle|heat\s*press|embroidery|cutting|hemming|inspection|relaxing|shrinking|sewing)\s+(machine|machines|model|models|series|unit|units)\b/.test(
      s,
    )
  )
    return true;
  if (/الكتالوج|كتالوج|موديلات|ماكينات|ماكينة/.test(msg)) return true;
  if (/目录|型号|机器|机型/.test(msg)) return true;

  /* TRADE TERMS — Incoterms and payment terms → tool loop
     (searchTradeTerms).

     These are standards questions, not Koleex-record questions, so none of
     the patterns above catch them and they fell to the general lane, which
     streams WITHOUT TOOLS. The model then answered from its own memory:
     confidently, and mostly right, but with no source behind it and no way
     to correct it. Verified live before this line existed — "which Institute
     Cargo Clauses apply to CIP vs CIF" came back with steps: ['answer'] and
     never touched the knowledge base.

     That memory is exactly what cannot be trusted here: the single most
     copied Incoterms error — risk passing at the "ship's rail", deleted from
     the rules in 2010 — is still repeated across the web the model learned
     from, including on a US government page. Routing these to the tool puts
     the sourced text in front of the model instead.

     Shares isTradeTermQuestion with the tool_choice force in the agent loop
     so the two can never disagree about what counts. */
  if (isTradeTermQuestion(msg)) return true;

  /* Arabic business terms. */
  if (
    /عملاء|عميل|زبون|زبائن|منتج|منتجات|مخزون|فاتورة|فواتير|عرض\s*سعر|عروض\s*أسعار|طلب|طلبات|مورد|موردين/.test(
      msg,
    )
  )
    return true;

  /* Chinese business terms. */
  if (/客户|产品|库存|发票|报价|订单|供应商/.test(msg)) return true;

  return false;
}

/* ─── Work / schedule data detector ───────────────────────────────
   Returns true when the question is about the user's OWN work data —
   To-do / Projects / Planning / Calendar. These MUST reach the
   tool-calling orchestrator (listMyTodos / listMyProjects /
   listProjectTasks / listMyPlanning / listMyCalendar). The general
   fast-path has NO tools, so any of these slipping through it makes
   the model deflect ("check the app / please log in") instead of
   reading the user's real tasks — exactly the bug users reported.

   isBusinessDataQuery() deliberately does NOT cover these modules, so
   the route checks BOTH: a query that is business OR work data bypasses
   the tool-less fast-path.

   Guarded to personal / temporal / status framing so pure general
   chat ("explain agile project management", "what is a good meeting
   agenda") stays on the fast lane. */
export function isWorkDataQuery(msg: string): boolean {
  const s = (msg ?? "").toLowerCase();
  if (!s) return false;

  /* A work-module noun … */
  const workNoun =
    /\b(task|tasks|to-?do|to-?dos|todo|todos|assignment|assignments|project|projects|schedule|shift|shifts|calendar|meeting|meetings|event|events|appointment|appointments|deadline|deadlines|reminder|reminders|planning|agenda)\b/;
  /* … combined with personal / temporal / status framing. */
  const framing =
    /\b(my|our|mine|assigned\s+to\s+me|assigned|today|tonight|tomorrow|this\s+(week|month)|next\s+(week|month)|due|overdue|upcoming|pending|open|do\s+i|does\s+i|i\s+have|have\s+any|remind\s+me)\b/;
  if (workNoun.test(s) && framing.test(s)) return true;

  /* Direct phrasings that don't need the noun+framing combo. */
  if (/\bwhat('?s| is| are|'re)?\s+(due|on\s+my\s+(plate|calendar|schedule|agenda|list)|assigned\s+to\s+me|coming\s+up)\b/.test(s)) return true;
  if (/\bwhat\s+am\s+i\s+(working\s+on|planned\s+for|doing\s+(today|this\s+week))\b/.test(s)) return true;
  if (/\bremind\s+me\s+to\b/.test(s)) return true;
  if (/\b(add|create)\s+(a\s+)?(task|to-?do|reminder|shift|event)\b/.test(s)) return true;

  /* WRITE intents: a work-action verb + a work noun is work data even
     WITHOUT personal/temporal framing — "set a meeting", "book a meeting
     with the supplier", "cancel the meeting", "mark the task done". The
     owner's live failure ("set a meeting for me in calendar" → "I can't
     access your calendar") slipped this gate: "for me" isn't in the
     framing list and the add|create rule above only knows task-ish nouns.
     A false positive costs one tool-loop turn; a false negative is a
     refusal or a hallucinated write. */
  const writeVerb =
    /\b(set(\s+up)?|schedule|book|arrange|plan|make|create|add|cancel|delete|remove|move|reschedule|postpone|push\s+back|complete|finish|mark|close|reopen|assign|reassign|transfer|update|change|rename|edit)\b/;
  if (writeVerb.test(s) && workNoun.test(s)) return true;

  /* Arabic: مهام/مهمة/جدول/مواعيد/اجتماع/تذكير/مشروع/أعمالي. */
  if (/مهام|مهمة|مهامي|المهام|جدول|جدولي|مواعيد|موعد|اجتماع|اجتماعات|ميتنج|ميتينج|تذكير|ذكرني|فكرني|مشروع|مشاريع|أعمالي|اعمالي|شغلي/.test(msg)) return true;

  /* Chinese: 任务/日程/日历/会议/提醒/待办/项目/安排. */
  if (/任务|日程|日历|会议|提醒|待办|项目|安排/.test(msg)) return true;

  return false;
}

/* ─── Live-information detector ───────────────────────────────────
   Questions whose honest answer depends on the world TODAY, not on what
   the model absorbed during training: weather, news, rates, prices of
   public commodities, "latest"/"current"/"right now" framings.

   These have to bypass the tool-less fast paths, or the model produces
   the exact failure the owner screenshotted — a polite apology for
   having no live access, while search_web sits one layer below it.

   Deliberately keyword-driven and conservative in the same style as the
   detectors above: a false positive only costs one extra tool-loop turn,
   while a false negative is a wrong answer. Covers en / ar / zh because
   all three are in daily use here. */
export function isLiveInfoQuery(msg: string): boolean {
  const s = (msg ?? "").toLowerCase();
  if (!s) return false;

  /* Subjects that are almost always time-sensitive. */
  if (/\b(weather|forecast|temperature|humidity|rain|raining|snow|storm|wind)\b/.test(s)) return true;
  if (/\b(news|headlines|happening|breaking)\b/.test(s)) return true;
  if (/\b(exchange\s+rate|currency\s+rate|usd\s+to\s+|eur\s+to\s+|rmb|cny|forex|stock\s+price|share\s+price)\b/.test(s)) return true;
  if (/\b(flight|flights)\s+(status|delay|delayed)\b/.test(s)) return true;
  if (/\b(freight|shipping)\s+(rate|rates|cost)\b/.test(s)) return true;

  /* Explicit requests to go and look. */
  if (/\b(search|google|look\s+up|check\s+online|on\s+the\s+(web|internet))\b/.test(s)) return true;

  /* "current / latest / today's X" framings. */
  if (/\b(current|latest|today'?s|right\s+now|as\s+of\s+today|this\s+week'?s)\b/.test(s)) return true;

  /* Arabic */
  if (/الطقس|الجو|درجة\s*الحرارة|الأخبار|اخبار|سعر\s*الصرف|سعر\s*الدولار|آخر\s*الأخبار|ابحث\s*في\s*النت|ابحث\s*على\s*النت/.test(msg)) return true;
  /* Chinese */
  if (/天气|气温|新闻|汇率|股价|最新|搜索一下|查一下/.test(msg)) return true;

  return false;
}

/* Memory/teaching intents must never take a tool-less lane — the model
   would hallucinate "saved ✓" (observed). Mirrors the agent-route guard. */
export function isMemoryIntentQuery(msg: string): boolean {
  return (
    /\b(remember|memoriz|save (this|that|it|for)|note (this|that) down|add (this|to) .*knowledge|knowledge base|don'?t forget)\b/i.test(msg) ||
    /احفظ|تذكّ?ر|لا تنسى?|أضف .*للمعرفة|سجّ?ل (هذه|هذا|ذلك)/.test(msg) ||
    /记住|保存|别忘|加入知识库/.test(msg)
  );
}
