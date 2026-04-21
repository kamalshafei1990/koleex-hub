import "server-only";

/* ---------------------------------------------------------------------------
   ai/local-knowledge — Phase 5 offline answer layer.

   A small deterministic glossary that lets the system answer the
   most common commercial-definition questions WITHOUT calling any
   AI provider. Two paths benefit:

     1. Happy path — intent=definition AND subject is in glossary:
        chat route short-circuits streamRouteAi, emits the local
        answer as SSE events. Latency ≈ auth round-trip.

     2. Recovery path — every provider failed + intent=definition AND
        subject is in glossary: the synthetic fallback dresses the
        local answer with a short preamble ("here's a quick take
        while the AI service is recovering") instead of the generic
        "try again" message.

   Intentionally small — 15 core commercial terms. Adding more is
   cheap (one entry per language); letting the list sprawl is not.
   Anything not here falls through to the provider path.

   Every entry carries EN / AR (formal MSA) / EGY / ZH variants.
   Franco-Arabic input resolves to EGY per the Phase 4 persona
   rule ("reply in Egyptian Arabic script, never Franco").
   --------------------------------------------------------------------------- */

import type { DetectedLang } from "./detect-language";

export interface LocalAnswer {
  en: string;
  ar: string;
  egy: string;
  zh: string;
}

/* Glossary — keys are lowercase canonical forms. Aliases map to
   the same canonical key via SUBJECT_ALIASES below. */
const GLOSSARY: Record<string, LocalAnswer> = {
  margin: {
    en: "Margin is the difference between selling price and cost, expressed as a percentage of the selling price. Example: selling at 100 with a cost of 70 gives a 30% margin.",
    ar: "الهامش هو الفرق بين سعر البيع والتكلفة، معبَّرًا عنه كنسبة مئوية من سعر البيع. مثال: البيع بـ100 بتكلفة 70 يعطي هامشًا قدره 30%.",
    egy: "الهامش هو الفرق ما بين سعر البيع والتكلفة، وبنحسبه كنسبة من سعر البيع. مثال بسيط: لو بعت بـ100 وتكلفتك 70، يبقى الهامش بتاعك 30%.",
    zh: "毛利率是售价与成本之间的差额,以售价的百分比表示。例如:售价 100、成本 70,毛利率为 30%。",
  },

  profit: {
    en: "Profit is what remains after costs are subtracted from revenue. Gross profit subtracts only the cost of goods sold; net profit also subtracts operating expenses, taxes, and interest.",
    ar: "الربح هو ما يتبقى بعد طرح التكاليف من الإيرادات. الربح الإجمالي يطرح تكلفة البضاعة المباعة فقط، بينما صافي الربح يطرح أيضًا المصاريف التشغيلية والضرائب والفوائد.",
    egy: "الربح ببساطة هو اللي بيفضل بعد ما بتطرح التكاليف من الإيرادات. الربح الإجمالي بيطرح تكلفة البضاعة بس، أما صافي الربح فبتطرح كمان المصاريف والضرايب والفوايد.",
    zh: "利润是从收入中扣除成本后剩下的金额。毛利只扣除销货成本;净利还要扣除营运费用、税金和利息。",
  },

  "gross margin": {
    en: "Gross margin is (revenue − cost of goods sold) ÷ revenue, shown as a percentage. It measures how much of every sale remains after the direct cost of the product.",
    ar: "هامش الربح الإجمالي = (الإيرادات − تكلفة البضاعة المباعة) ÷ الإيرادات، ويُعبَّر عنه كنسبة مئوية. يقيس كم يتبقى من كل عملية بيع بعد التكلفة المباشرة للمنتج.",
    egy: "هامش الربح الإجمالي = (الإيرادات − تكلفة البضاعة) ÷ الإيرادات، وبيتكتب كنسبة مئوية. وده بيوضحلك باقي كام من كل مبيعة بعد تكلفة المنتج المباشرة.",
    zh: "毛利率 =(收入 − 销货成本) ÷ 收入,以百分比表示。它反映每笔销售在扣除产品直接成本后还剩多少。",
  },

  "net margin": {
    en: "Net margin is net profit ÷ revenue, as a percentage. It shows how much actual profit is left from each sale after all costs — product, operating expenses, tax, interest.",
    ar: "هامش صافي الربح = صافي الربح ÷ الإيرادات، بالنسبة المئوية. يوضح كم يتبقى فعليًا من كل عملية بيع بعد كل التكاليف: المنتج، المصاريف التشغيلية، الضرائب، الفوائد.",
    egy: "هامش صافي الربح = صافي الربح ÷ الإيرادات، كنسبة مئوية. وده بيبيّن فعليًا بتكسب كام من كل مبيعة بعد كل التكاليف: المنتج، المصاريف، الضرايب، الفوايد.",
    zh: "净利率 = 净利 ÷ 收入,以百分比表示。它显示扣除所有成本(产品、营运、税、利息)后,每笔销售真正剩下多少。",
  },

  markup: {
    en: "Markup is the amount added to the cost to reach the selling price, usually expressed as a percentage of the cost. Example: cost 70, markup 43% → selling price ≈ 100.",
    ar: "الزيادة (Markup) هي القيمة المضافة إلى التكلفة للوصول إلى سعر البيع، وعادةً تُعبَّر كنسبة مئوية من التكلفة. مثال: التكلفة 70، الزيادة 43% ⇒ سعر البيع ≈ 100.",
    egy: "الـ Markup هو القيمة اللي بتتضاف على التكلفة علشان توصلك لسعر البيع، ومعظم الوقت بتتكتب كنسبة من التكلفة. مثال: التكلفة 70 والـ markup 43% ⇒ سعر البيع تقريبًا 100.",
    zh: "加价(markup)是在成本之上为得到售价而增加的金额,通常以成本的百分比表示。例如:成本 70,加价 43% ⇒ 售价 ≈ 100。",
  },

  rfq: {
    en: "RFQ stands for Request For Quotation — a formal request a buyer sends to one or more suppliers asking for a price quote on a specific product, quantity, and delivery terms.",
    ar: "RFQ اختصار لـ Request For Quotation (طلب عرض سعر) — طلب رسمي يرسله المشتري إلى مورِّد أو أكثر ليستفسر عن سعر منتج محدد، بكمية وشروط تسليم واضحة.",
    egy: "الـ RFQ معناه Request For Quotation، يعني طلب عرض سعر — طلب رسمي المشتري بيبعته لمورِّد أو أكتر علشان ياخد عرض سعر لمنتج معيّن بكمية وشروط تسليم محددة.",
    zh: "RFQ 是 Request For Quotation(询价单)的缩写,是买方向一个或多个供应商发出的正式请求,以获取特定产品、数量和交货条件下的报价。",
  },

  quotation: {
    en: "A quotation is a formal offer from a seller to a buyer listing products, quantities, unit prices, total, payment terms, and validity date. Once accepted it typically becomes a purchase order.",
    ar: "عرض السعر هو عرض رسمي يقدمه البائع للمشتري، يتضمن المنتجات والكميات وأسعار الوحدة والإجمالي وشروط الدفع وتاريخ الصلاحية. بعد قبوله يتحول عادةً إلى أمر شراء.",
    egy: "عرض السعر هو عرض رسمي البائع بيقدمه للمشتري، وفيه المنتجات والكميات وسعر كل وحدة والإجمالي وشروط الدفع وتاريخ الصلاحية. لما المشتري يوافق عليه بيتحول لأمر شراء.",
    zh: "报价单(quotation)是卖方向买方提供的正式报价,列明产品、数量、单价、总额、付款条件和有效期。一经接受通常转为采购订单。",
  },

  invoice: {
    en: "An invoice is a commercial document the seller issues to the buyer after delivery, listing what was sold, quantities, unit prices, total due, tax, and payment terms. It records the debt owed by the buyer.",
    ar: "الفاتورة مستند تجاري يُصدره البائع للمشتري بعد تسليم البضاعة، يحتوي على ما تم بيعه والكميات وأسعار الوحدة والإجمالي المستحق والضريبة وشروط الدفع. تسجل الدين المستحق على المشتري.",
    egy: "الفاتورة ورقة تجارية البائع بيصدرها للمشتري بعد التسليم، وفيها اللي اتباع والكميات وسعر كل وحدة والإجمالي المستحق والضريبة وشروط الدفع. هي بتسجّل المبلغ اللي لسه عليه.",
    zh: "发票(invoice)是卖方在交货后开给买方的商业单据,列明销售的物品、数量、单价、应付总额、税款和付款条件,记录买方应付的款项。",
  },

  discount: {
    en: "A discount is a reduction from the list price, usually expressed as a percentage or fixed amount. Common types include volume discount, early-payment (cash) discount, promotional, and customer-tier discounts.",
    ar: "الخصم هو تخفيض من السعر المعلن، يُعبَّر عنه عادةً بنسبة مئوية أو مبلغ ثابت. من أنواعه الشائعة: خصم الكمية، خصم الدفع المبكر (نقدي)، خصم الترويج، وخصم شرائح العملاء.",
    egy: "الخصم هو تخفيض من السعر المعلن، وبيتكتب كنسبة أو مبلغ ثابت. أشهر أنواعه: خصم الكمية، خصم الدفع المبكر، خصم البروموشن، وخصم شرائح العملاء.",
    zh: "折扣(discount)是在标价上所做的减免,通常以百分比或固定金额表示。常见类型包括数量折扣、提前付款(现金)折扣、促销折扣和客户等级折扣。",
  },

  commission: {
    en: "A commission is a payment to a salesperson or agent for closing a sale, usually a percentage of the sale value. It can be tiered, capped, clawed back on cancellations, or shared between parties.",
    ar: "العمولة هي مبلغ يُدفع للمندوب أو الوسيط لإتمام عملية بيع، وعادةً تكون نسبة مئوية من قيمة البيع. يمكن أن تكون متدرجة، أو بحد أعلى، أو تُسترد عند الإلغاء، أو تُقسَّم بين أطراف.",
    egy: "العمولة مبلغ بيتدفع للمندوب أو الوسيط لما يقفل بيعة، وغالبًا بتكون نسبة من قيمة البيع. ممكن تكون متدرجة، أو بسقف، أو ترجع لو العميل اتكانسل، أو تتقسّم بين أطراف.",
    zh: "佣金(commission)是为完成销售而支付给销售员或代理的报酬,通常为销售额的百分比。可采用分级、封顶、因取消而回收(clawback)或在多方之间分摊的形式。",
  },

  "landed cost": {
    en: "Landed cost is the total cost of a product after it arrives at the buyer's warehouse: unit price + freight + insurance + duties + customs + handling + any inland transport. It is the real benchmark for pricing.",
    ar: "التكلفة الوصولية (Landed Cost) هي التكلفة الإجمالية للمنتج بعد وصوله إلى مستودع المشتري: سعر الوحدة + الشحن + التأمين + الرسوم الجمركية + الجمارك + المناولة + أي نقل داخلي. وهي المرجع الحقيقي للتسعير.",
    egy: "الـ Landed Cost هي التكلفة الإجمالية للمنتج لحد ما يوصل مخزن المشتري: سعر الوحدة + الشحن + التأمين + الرسوم + الجمارك + المناولة + أي نقل داخلي. دي المرجعية الحقيقية لأي تسعير.",
    zh: "落地成本(landed cost)是产品到达买方仓库后的总成本:单价 + 运费 + 保险 + 关税 + 清关 + 操作费 + 内陆运输。它是定价的真实基准。",
  },

  fob: {
    en: "FOB (Free On Board) is an Incoterm: the seller pays to deliver the goods onto the vessel at the origin port. Risk transfers to the buyer once loaded; from there the buyer pays freight and insurance.",
    ar: "FOB (Free On Board) شرط من شروط إنكوترمز: البائع يتحمل تكاليف تسليم البضاعة على ظهر السفينة في ميناء الشحن، وتنتقل المخاطر إلى المشتري بمجرد التحميل؛ بعدها يدفع المشتري الشحن والتأمين.",
    egy: "الـ FOB اختصار Free On Board، وهو شرط من شروط إنكوترمز: البائع بيدفع تكاليف وصول البضاعة لحد ما تتحمّل على السفينة في ميناء الشحن، وبعدها المخاطرة بتنتقل للمشتري اللي بيدفع الشحن والتأمين.",
    zh: "FOB(Free On Board,船上交货)是 Incoterms 贸易术语:卖方负责在装运港将货物装上船的费用;装船后风险转移给买方,由买方承担后续运费和保险。",
  },

  cif: {
    en: "CIF (Cost, Insurance, Freight) is an Incoterm: the seller pays the cost, marine insurance, and freight to bring the goods to the destination port. Risk still transfers to the buyer when loaded at origin.",
    ar: "CIF (Cost, Insurance, Freight) شرط من شروط إنكوترمز: البائع يدفع التكلفة والتأمين البحري والشحن حتى ميناء الوصول، ولكن تنتقل المخاطرة إلى المشتري عند التحميل في ميناء المنشأ.",
    egy: "الـ CIF معناه Cost, Insurance, Freight، وهو شرط إنكوترمز: البائع بيدفع التكلفة والتأمين البحري والشحن لحد ميناء الوصول، لكن المخاطرة بتنتقل للمشتري من أول ما البضاعة تتحمّل في ميناء المنشأ.",
    zh: "CIF(Cost, Insurance, Freight,成本加保险费加运费)是 Incoterms 术语:卖方承担至目的港的成本、海运保险和运费,但风险在起运港装船时已转移给买方。",
  },

  exw: {
    en: "EXW (Ex Works) is an Incoterm where the seller only makes the goods available at its own premises. The buyer handles loading, export clearance, freight, insurance, and import — maximum buyer responsibility.",
    ar: "EXW (Ex Works) شرط من شروط إنكوترمز حيث يقتصر دور البائع على إتاحة البضاعة في مقرّه؛ يتولى المشتري التحميل والتخليص وإجراءات التصدير والشحن والتأمين والاستيراد — أقصى مسؤولية على المشتري.",
    egy: "الـ EXW اختصار Ex Works، وفيه البائع بيتيح البضاعة في مقرّه بس، والمشتري بيتكفّل بالتحميل والتخليص وإجراءات التصدير والشحن والتأمين والاستيراد — يعني كل المسؤولية تقريبًا على المشتري.",
    zh: "EXW(Ex Works,工厂交货)是 Incoterms 术语:卖方仅在自己的场所交货,买方负责装货、出口清关、运输、保险和进口清关 —— 买方承担最大责任。",
  },

  cogs: {
    en: "COGS (Cost of Goods Sold) is the direct cost of producing or purchasing the goods you sold in a period: raw materials, direct labour, and directly attributable manufacturing overhead. Revenue − COGS = gross profit.",
    ar: "COGS (تكلفة البضاعة المباعة) هي التكلفة المباشرة لإنتاج أو شراء البضائع التي بعتها خلال الفترة: المواد الخام، والعمالة المباشرة، ونصيبها من التكاليف الصناعية غير المباشرة. الإيراد − COGS = الربح الإجمالي.",
    egy: "الـ COGS يعني تكلفة البضاعة المباعة، وهي التكلفة المباشرة لإنتاج أو شراء البضاعة اللي بعتها في الفترة: المواد الخام، العمالة المباشرة، ونصيبها من التكاليف الصناعية. الإيراد − COGS = الربح الإجمالي.",
    zh: "COGS(销货成本)是指本期已售产品的直接成本:原材料、直接人工、以及可直接归属的制造费用。收入 − COGS = 毛利。",
  },
};

/* Canonical-key alias table. Input is normalised (lowercased, trimmed,
   hyphens / underscores collapsed to spaces) before lookup. */
const SUBJECT_ALIASES: Record<string, string> = {
  // long forms → canonical
  "request for quotation": "rfq",
  "request for quote": "rfq",
  "free on board": "fob",
  "cost insurance freight": "cif",
  "cost insurance and freight": "cif",
  "ex works": "exw",
  "cost of goods sold": "cogs",
  // light variants
  "mark up": "markup",
  "mark-up": "markup",
  "grossmargin": "gross margin",
  "netmargin": "net margin",
  // arabic / egyptian aliases
  "هامش": "margin",
  "الهامش": "margin",
  "ربح": "profit",
  "الربح": "profit",
  "خصم": "discount",
  "الخصم": "discount",
  "عمولة": "commission",
  "العمولة": "commission",
  "فاتورة": "invoice",
  "الفاتورة": "invoice",
  "عرض سعر": "quotation",
  "عرض السعر": "quotation",
  "تسعير": "quotation",
};

function normaliseSubject(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[?!.,،؛؟:;]+$/g, "")
    .trim();
}

/* ─── Subject extraction from a definition query ────────────────
   Matches the 6 most common English / Arabic definition patterns
   and pulls out the term being asked about. Returns null when the
   query isn't a definition or no term can be isolated. */
function extractSubject(query: string): string | null {
  const q = query.trim();

  /* English patterns — capture the noun phrase between the verb and
     any trailing punctuation / "mean". */
  const patterns: RegExp[] = [
    /^what\s+(?:is|are)\s+(?:an?\s+|the\s+)?(.+?)\s*\??$/i,
    /^what\s+does\s+(.+?)\s+mean\s*\??$/i,
    /^(?:what(?:'s| is)\s+the\s+)?meaning\s+of\s+(.+?)\s*\??$/i,
    /^define\s+(.+?)\s*\??$/i,
    /^(.+?)\s+definition\s*\??$/i,
    /^what\s+does\s+(.+?)\s+stand\s+for\s*\??$/i,
    /^ما\s+(?:هو|هي|معنى)\s+(.+?)\s*[؟?]?$/,
    /يعني\s+ايه\s+(.+?)\s*[؟?!.]?$/i, // Egyptian "what does X mean"
  ];

  for (const p of patterns) {
    const m = q.match(p);
    if (m && m[1]) return normaliseSubject(m[1]);
  }
  return null;
}

/* ─── Public API ─────────────────────────────────────────────── */

/** Given a full user query, return a LocalAnswer when the query is a
 *  definition of a glossary term — or null when nothing matches. */
export function findLocalAnswer(query: string): LocalAnswer | null {
  const subject = extractSubject(query);
  if (!subject) return null;

  const canonical = SUBJECT_ALIASES[subject] ?? subject;
  const hit = GLOSSARY[canonical];
  return hit ?? null;
}

/** Pick the right-language string from a LocalAnswer given the
 *  detected message language. EGY and FRANCO both resolve to the
 *  Egyptian text (FRANCO → reply in Arabic script per Phase 4). */
export function pickLocalAnswer(
  ans: LocalAnswer,
  lang: DetectedLang,
): string {
  if (lang === "AR") return ans.ar;
  if (lang === "EGY" || lang === "FRANCO") return ans.egy;
  if (lang === "ZH") return ans.zh;
  return ans.en;
}

/** True if the query resolves to a local glossary answer. Cheaper
 *  than findLocalAnswer when the caller only needs the yes/no. */
export function hasLocalAnswer(query: string): boolean {
  return findLocalAnswer(query) !== null;
}

/** Number of entries — exposed for diagnostics / tests. */
export function localKnowledgeSize(): number {
  return Object.keys(GLOSSARY).length;
}
