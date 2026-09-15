import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Shipping — the app's dictionary.

   Every entry carries all three languages the Hub supports today (en / zh /
   ar). The list itself lives in TRANSLATABLE_LANGS in src/lib/i18n.ts with a
   compile-time exhaustiveness guard, so when a fourth language is added this
   file is one of the places the type system will point at. Nothing here
   hard-codes "zh | ar".

   ── What is deliberately NOT translated ────────────────────────────────────
   Trade codes stay as they are, in every language: UN/LOCODE (CNSGH), IATA
   (PVG), container types (20GP / 40GP / 40HQ), Incoterms (FOB, CIF), surcharge
   codes (BAF, CAF, GRI, THC) and currency codes. They are identifiers a
   carrier and a customs officer read, not copy — the same reason the Documents
   app leaves export-paperwork captions in English. Translating one of these is
   a change to a shipping instruction, not an i18n fix.

   ── Sentences are whole ───────────────────────────────────────────────────
   Anything with a number or a name in it is keyed as one sentence with a
   {slot}, never assembled from fragments. Arabic and Chinese put the pieces in
   a different order, and a concatenated string cannot express that.
   --------------------------------------------------------------------------- */

export const shippingT: Translations = {
  /* ── app chrome ───────────────────────────────────────────────────────── */
  "app.title":        { en: "Shipping",                     zh: "海空运价",                 ar: "الشحن" },
  "app.subtitle":     { en: "Freight rates from China, port to port",
                        zh: "中国出发的海空运价，港到港",
                        ar: "أسعار الشحن من الصين، من ميناء إلى ميناء" },
  "search.placeholder": { en: "Search a port or country", zh: "搜索港口或国家", ar: "ابحث عن ميناء أو دولة" },

  /* ── the four steps ───────────────────────────────────────────────────── */
  "step.origin":      { en: "From",            zh: "起运",        ar: "من" },
  "step.destination": { en: "To",              zh: "目的",        ar: "إلى" },
  "step.method":      { en: "Method",          zh: "运输方式",     ar: "طريقة الشحن" },
  "step.details":     { en: "Details",         zh: "货物信息",     ar: "تفاصيل الشحنة" },
  "field.originPort": { en: "Origin port",     zh: "起运港",       ar: "ميناء الشحن" },
  "field.originAirport": { en: "Origin airport", zh: "起运机场",   ar: "مطار الشحن" },
  "field.country":    { en: "Destination country", zh: "目的国家", ar: "دولة الوصول" },
  "field.destPort":   { en: "Destination port",    zh: "目的港",   ar: "ميناء الوصول" },
  "field.destAirport": { en: "Destination airport", zh: "目的机场", ar: "مطار الوصول" },
  "ph.originPort":    { en: "Ningbo, Shanghai, Shenzhen…", zh: "宁波、上海、深圳…", ar: "نينغبو، شنغهاي، شنتشن…" },
  "ph.country":       { en: "Pick a country",   zh: "选择国家",     ar: "اختر دولة" },
  "ph.destPort":      { en: "Pick a port",      zh: "选择港口",     ar: "اختر ميناء" },
  "ph.pickCountryFirst": { en: "Pick a country first", zh: "请先选择国家", ar: "اختر الدولة أولًا" },
  /* The box INSIDE the panel says what to do; repeating the trigger's own hint
     there read as the same sentence printed twice. */
  "ph.searchPorts":     { en: "Search ports",     zh: "搜索港口",   ar: "ابحث عن ميناء" },
  "ph.searchAirports":  { en: "Search airports",  zh: "搜索机场",   ar: "ابحث عن مطار" },
  "ph.searchCountries": { en: "Search countries", zh: "搜索国家",   ar: "ابحث عن دولة" },
  "ph.moreResults":     { en: "Showing the first {n} — type to narrow.",
                          zh: "仅显示前 {n} 条，请输入以缩小范围。",
                          ar: "يُعرض أول {n} فقط — اكتب لتضييق النتائج." },

  /* ── modes ────────────────────────────────────────────────────────────── */
  "mode.ocean_fcl":   { en: "Full container",   zh: "整柜",        ar: "حاوية كاملة" },
  "mode.ocean_lcl":   { en: "Groupage",         zh: "拼箱",        ar: "شحن مجمّع" },
  "mode.air":         { en: "Air freight",      zh: "空运",        ar: "شحن جوي" },
  "mode.ocean_fcl.hint": { en: "One or more whole containers", zh: "整箱货物", ar: "حاوية كاملة أو أكثر" },
  "mode.ocean_lcl.hint": { en: "Priced per cubic metre",       zh: "按立方米计价", ar: "التسعير بالمتر المكعب" },
  "mode.air.hint":       { en: "Priced per kilo",              zh: "按公斤计价",   ar: "التسعير بالكيلوجرام" },

  /* ── cargo inputs ─────────────────────────────────────────────────────── */
  "field.containers":  { en: "Containers",       zh: "箱型",        ar: "الحاويات" },
  "field.volume":      { en: "Volume",           zh: "体积",        ar: "الحجم" },
  "field.grossWeight": { en: "Gross weight",     zh: "毛重",        ar: "الوزن الإجمالي" },
  "field.dimensions":  { en: "Dimensions",       zh: "尺寸",        ar: "الأبعاد" },
  "field.pieces":      { en: "Pieces",           zh: "件数",        ar: "عدد الطرود" },
  "unit.cbm":          { en: "CBM",              zh: "立方米",      ar: "متر مكعب" },
  "unit.kg":           { en: "kg",               zh: "公斤",        ar: "كجم" },
  "unit.cm":           { en: "cm",               zh: "厘米",        ar: "سم" },
  "action.addDimensions": { en: "Add dimensions", zh: "添加尺寸",   ar: "إضافة أبعاد" },
  "action.removePiece":   { en: "Remove",         zh: "移除",       ar: "إزالة" },

  /* ── chargeable weight ────────────────────────────────────────────────── */
  "weight.chargeable":  { en: "Chargeable weight", zh: "计费重量",   ar: "الوزن القابل للشحن" },
  "weight.volumetric":  { en: "Volumetric weight", zh: "体积重量",   ar: "الوزن الحجمي" },
  "weight.gross":       { en: "Gross weight",      zh: "毛重",       ar: "الوزن الإجمالي" },
  "weight.basisGross":  { en: "Billed on gross weight",      zh: "按毛重计费",   ar: "التسعير على الوزن الإجمالي" },
  "weight.basisVolumetric": { en: "Billed on volumetric weight", zh: "按体积重量计费", ar: "التسعير على الوزن الحجمي" },
  "weight.rule":        { en: "Volumetric rule",   zh: "体积重量标准", ar: "قاعدة الوزن الحجمي" },
  "weight.rule.iata_air":        { en: "IATA air cargo — 6000 cm³/kg", zh: "IATA 空运 — 6000 立方厘米/公斤", ar: "إياتا للشحن الجوي — ٦٠٠٠ سم³/كجم" },
  "weight.rule.express_courier": { en: "Express courier — 5000 cm³/kg", zh: "快递 — 5000 立方厘米/公斤", ar: "الشحن السريع — ٥٠٠٠ سم³/كجم" },
  "weight.ruleNote":    { en: "The divisor is a term of the carrier's tariff. The same shipment costs about 20% more under the courier rule.",
                          zh: "该除数是承运人费率的条款之一。同一批货物按快递标准计费约高出 20%。",
                          ar: "المقسوم شرط في تعريفة الناقل. نفس الشحنة تكلّف أكثر بحوالي ٢٠٪ بقاعدة الشحن السريع." },
  "lcl.revenueTons":    { en: "Revenue tons",      zh: "计费吨",     ar: "الأطنان المحسوبة" },
  "lcl.wmNote":         { en: "Groupage bills the greater of volume and weight. This shipment bills on {basis}.",
                          zh: "拼箱按体积与重量两者取大计费。本批货物按{basis}计费。",
                          ar: "الشحن المجمّع يحاسب على الأكبر بين الحجم والوزن. هذه الشحنة تُحسب على {basis}." },
  "lcl.basisMeasure":   { en: "volume",            zh: "体积",       ar: "الحجم" },
  "lcl.basisWeight":    { en: "weight",            zh: "重量",       ar: "الوزن" },

  /* ── actions ──────────────────────────────────────────────────────────── */
  "action.search":     { en: "Search rates",      zh: "查询运价",    ar: "ابحث عن الأسعار" },
  "action.searching":  { en: "Searching…",        zh: "查询中…",     ar: "جارٍ البحث…" },
  "action.refresh":    { en: "Refresh",           zh: "刷新",        ar: "تحديث" },
  "action.swap":       { en: "Swap direction",    zh: "对调方向",    ar: "عكس الاتجاه" },
  "action.favorite":   { en: "Save route",        zh: "收藏航线",    ar: "حفظ المسار" },
  "action.unfavorite": { en: "Remove from saved", zh: "取消收藏",    ar: "إزالة من المحفوظات" },
  "action.details":    { en: "Details",           zh: "明细",        ar: "التفاصيل" },
  "action.hideDetails": { en: "Hide details",     zh: "收起明细",    ar: "إخفاء التفاصيل" },
  "action.change":     { en: "Change",            zh: "更改",        ar: "تغيير" },
  "action.clear":      { en: "Clear",             zh: "清除",        ar: "مسح" },

  /* ── results ──────────────────────────────────────────────────────────── */
  "res.title":         { en: "Rates",             zh: "运价",        ar: "الأسعار" },
  "res.perContainer":  { en: "per container",     zh: "每箱",        ar: "للحاوية" },
  "res.perCbm":        { en: "per CBM",           zh: "每立方米",     ar: "للمتر المكعب" },
  "res.perKg":         { en: "per kg",            zh: "每公斤",      ar: "للكيلوجرام" },
  "res.freight":       { en: "Freight",           zh: "海运费",      ar: "أجرة الشحن" },
  "res.surcharges":    { en: "Surcharges",        zh: "附加费",      ar: "الرسوم الإضافية" },
  "res.estimatedTotal": { en: "Estimated total",  zh: "预计总额",    ar: "الإجمالي التقديري" },
  "res.minCharge":     { en: "Minimum charge",    zh: "最低收费",    ar: "الحد الأدنى للرسوم" },
  "res.transit":       { en: "Transit",           zh: "航程",        ar: "مدة الترانزيت" },
  "res.days":          { en: "{n} days",          zh: "{n} 天",      ar: "{n} يوم" },
  "res.daysRange":     { en: "{min}–{max} days",  zh: "{min}–{max} 天", ar: "{min}–{max} يوم" },
  "res.carrier":       { en: "Carrier",           zh: "承运人",      ar: "الناقل" },
  "res.validity":      { en: "Valid to {date}",   zh: "有效期至 {date}", ar: "صالح حتى {date}" },
  "res.noValidity":    { en: "No validity stated", zh: "未注明有效期", ar: "لم تُذكر مدة الصلاحية" },
  "res.updated":       { en: "Updated {when}",    zh: "更新于 {when}", ar: "حُدّث في {when}" },
  "res.today":         { en: "today",            zh: "今天",        ar: "اليوم" },
  "res.recordedOn":    { en: "Recorded {date}",   zh: "记录于 {date}", ar: "سُجّل في {date}" },
  "res.scope":         { en: "Covers",            zh: "价格范围",    ar: "يغطي" },
  "res.unavailable":   { en: "Rate unavailable",  zh: "暂无运价",    ar: "السعر غير متاح" },
  "res.unavailableHint": { en: "No source has a current rate for this lane. Nothing has been estimated.",
                           zh: "目前没有任何来源提供该航线的运价。系统未做任何估算。",
                           ar: "لا يوجد مصدر لديه سعر حالي لهذا المسار. ولم يتم تقدير أي رقم." },
  "res.rangeOnly":     { en: "Range only",        zh: "仅区间",      ar: "نطاق فقط" },
  "res.notBookable":   { en: "Not bookable",      zh: "不可订舱",    ar: "غير قابل للحجز" },

  /* ── the four kinds. THE most important strings in the app. ───────────── */
  "kind.provider":     { en: "Provider Rate",           zh: "服务商运价",   ar: "سعر المزوّد" },
  "kind.provider.daily": { en: "Provider Rate — Updated Daily", zh: "服务商运价 — 每日更新", ar: "سعر المزوّد — يُحدَّث يوميًا" },
  "kind.market":       { en: "Market Estimate",         zh: "市场估价",     ar: "تقدير السوق" },
  "kind.koleex":       { en: "Koleex Historical Rate",  zh: "Koleex 历史运价", ar: "سعر كوليكس التاريخي" },
  "kind.forwarder":    { en: "Forwarder Quote",         zh: "货代报价",     ar: "عرض وكيل الشحن" },
  "kind.provider.what": { en: "A rate the provider supplies for this lane.",
                          zh: "服务商为该航线提供的运价。",
                          ar: "سعر يوفّره المزوّد لهذا المسار." },
  "kind.market.what":  { en: "A public market band. Indicative only — it names no carrier and cannot be booked.",
                          zh: "公开的市场价格区间。仅供参考，不指定承运人，也无法订舱。",
                          ar: "نطاق سوق عام. استرشادي فقط، لا يحدّد ناقلًا ولا يمكن الحجز عليه." },
  "kind.koleex.what":  { en: "Freight Koleex actually paid, on the date shown. Not today's market.",
                          zh: "Koleex 在所示日期实际支付的运费，并非当前市场价。",
                          ar: "أجرة شحن دفعتها كوليكس فعلًا بالتاريخ الموضّح. ليست سعر السوق اليوم." },
  "kind.forwarder.what": { en: "A price a named forwarder gave us, for the validity shown.",
                           zh: "指定货代在所示有效期内给出的报价。",
                           ar: "سعر قدّمه وكيل شحن محدّد، خلال مدة الصلاحية الموضّحة." },

  /* ── service scope ────────────────────────────────────────────────────── */
  "scope.port_to_port":       { en: "Port to port",       zh: "港到港",   ar: "من ميناء إلى ميناء" },
  "scope.door_to_port":       { en: "Door to port",       zh: "门到港",   ar: "من الباب إلى الميناء" },
  "scope.port_to_door":       { en: "Port to door",       zh: "港到门",   ar: "من الميناء إلى الباب" },
  "scope.door_to_door":       { en: "Door to door",       zh: "门到门",   ar: "من الباب إلى الباب" },
  "scope.airport_to_airport": { en: "Airport to airport", zh: "机场到机场", ar: "من مطار إلى مطار" },
  "incl.origin":       { en: "Origin charges included",      zh: "含起运港费用", ar: "يشمل رسوم ميناء الشحن" },
  "incl.destination":  { en: "Destination charges included", zh: "含目的港费用", ar: "يشمل رسوم ميناء الوصول" },
  "incl.customs":      { en: "Customs clearance included",   zh: "含清关",       ar: "يشمل التخليص الجمركي" },
  "excl.destination":  { en: "Destination charges NOT included", zh: "不含目的港费用", ar: "لا يشمل رسوم ميناء الوصول" },
  "incl.unknown":      { en: "Inclusions not stated",        zh: "未说明包含项目", ar: "لم تُحدَّد البنود المشمولة" },

  /* ── surcharge wording. The CODE beside each of these is an identifier and
        is never translated — BAF is BAF on a carrier's invoice in every
        language. Only the explanation moves. ─────────────────────────────── */
  "surcharge.BAF": { en: "Bunker adjustment",        zh: "燃油附加费",     ar: "رسوم تعديل الوقود" },
  "surcharge.CAF": { en: "Currency adjustment",      zh: "货币贬值附加费",  ar: "رسوم تعديل العملة" },
  "surcharge.GRI": { en: "General rate increase",    zh: "运价普涨",       ar: "زيادة عامة في السعر" },
  "surcharge.PSS": { en: "Peak season surcharge",    zh: "旺季附加费",     ar: "رسوم موسم الذروة" },
  "surcharge.AMS": { en: "AMS / ENS / ISF filing",   zh: "AMS / ENS / ISF 申报", ar: "رسوم الإقرار المسبق AMS / ENS / ISF" },
  "surcharge.DOC": { en: "B/L or AWB fee",           zh: "提单／空运单费",   ar: "رسوم بوليصة الشحن" },
  "surcharge.TLX": { en: "Telex release",            zh: "电放费",         ar: "رسوم الإفراج الإلكتروني" },
  "surcharge.INS": { en: "Insurance",                zh: "保险费",         ar: "التأمين" },
  "surcharge.THC": { en: "Terminal handling",        zh: "码头操作费",      ar: "رسوم مناولة الميناء" },
  "surcharge.ISPS": { en: "Port security",           zh: "港口安保费",      ar: "رسوم أمن الميناء" },
  "surcharge.FEE": { en: "Local charge",             zh: "当地费用",       ar: "رسوم محلية" },

  /* ── confidence ───────────────────────────────────────────────────────── */
  "conf.label":        { en: "Confidence",  zh: "可信度",  ar: "درجة الثقة" },
  "conf.high":         { en: "High",        zh: "高",      ar: "عالية" },
  "conf.medium":       { en: "Medium",      zh: "中",      ar: "متوسطة" },
  "conf.low":          { en: "Low",         zh: "低",      ar: "منخفضة" },
  "conf.why":          { en: "Why this score", zh: "评分依据", ar: "سبب هذه الدرجة" },
  "conf.explain":      { en: "Scored from the data itself — how fresh it is, whether the lane and container match exactly, whether the validity is still open, whether the surcharges are known, and whether another source agrees.",
                          zh: "评分完全依据数据本身：数据新鲜度、航线与箱型是否完全匹配、有效期是否仍在、附加费是否明确，以及是否有其他来源印证。",
                          ar: "الدرجة محسوبة من البيانات نفسها: حداثتها، وتطابق المسار ونوع الحاوية بدقة، واستمرار الصلاحية، ومعرفة الرسوم الإضافية، واتفاق مصدر آخر معها." },

  /* ── comparison guard ─────────────────────────────────────────────────── */
  "cmp.notComparable": { en: "Not comparable",  zh: "不可比较",  ar: "غير قابل للمقارنة" },
  "cmp.why":           { en: "These are different products, not cheaper and dearer versions of the same one.",
                          zh: "它们是不同的产品，而不是同一产品的贵与便宜版本。",
                          ar: "هذه منتجات مختلفة، وليست نسخًا أرخص وأغلى من الشيء نفسه." },
  "cmp.diff.mode":      { en: "different shipping method", zh: "运输方式不同", ar: "طريقة شحن مختلفة" },
  "cmp.diff.lane":      { en: "different route",           zh: "航线不同",     ar: "مسار مختلف" },
  "cmp.diff.equipment": { en: "different container type",  zh: "箱型不同",     ar: "نوع حاوية مختلف" },
  "cmp.diff.unit":      { en: "priced per a different unit", zh: "计价单位不同", ar: "وحدة تسعير مختلفة" },
  "cmp.diff.currency":  { en: "different currency",        zh: "币种不同",     ar: "عملة مختلفة" },
  "cmp.diff.scope":     { en: "different service scope",   zh: "服务范围不同", ar: "نطاق خدمة مختلف" },
  "cmp.diff.inclusions": { en: "different charges included", zh: "包含费用不同", ar: "رسوم مشمولة مختلفة" },
  "cmp.best":           { en: "Lowest bookable",           zh: "最低可订价",   ar: "الأقل القابل للحجز" },
  "cmp.bestNote":       { en: "Chosen only among provider and forwarder rates — a historical figure or a market band cannot be booked.",
                           zh: "仅在服务商与货代报价中选取，历史运价和市场区间无法订舱。",
                           ar: "يُختار من أسعار المزوّدين ووكلاء الشحن فقط، لأن السعر التاريخي ونطاق السوق لا يمكن الحجز عليهما." },

  /* ── sources panel ────────────────────────────────────────────────────── */
  "src.title":         { en: "Rate sources",   zh: "运价来源",   ar: "مصادر الأسعار" },
  "src.active":        { en: "Active",         zh: "已启用",     ar: "مفعّل" },
  "src.off":           { en: "Not connected",  zh: "未连接",     ar: "غير متصل" },
  "src.needs":         { en: "Needs",          zh: "需要",       ar: "يحتاج" },
  "src.cadence.realtime":   { en: "Live",            zh: "实时",     ar: "مباشر" },
  "src.cadence.daily":      { en: "Updated daily",   zh: "每日更新",  ar: "يُحدَّث يوميًا" },
  "src.cadence.historical": { en: "Historical",      zh: "历史数据",  ar: "بيانات تاريخية" },
  "src.cadence.manual":     { en: "Entered by hand", zh: "手工录入",  ar: "مُدخل يدويًا" },
  "src.none":          { en: "No rate source is connected for this shipping method yet.",
                          zh: "该运输方式暂未连接任何运价来源。",
                          ar: "لا يوجد مصدر أسعار متصل لطريقة الشحن هذه بعد." },

  /* ── recents and favourites ───────────────────────────────────────────── */
  "recent.title":      { en: "Recent",         zh: "最近查询",   ar: "الأخيرة" },
  "fav.title":         { en: "Saved routes",   zh: "收藏航线",   ar: "المسارات المحفوظة" },
  "fav.empty":         { en: "Save a route to bring it back in one click.",
                          zh: "收藏航线后可一键重新查询。",
                          ar: "احفظ مسارًا لتستعيده بضغطة واحدة." },

  /* ── history ──────────────────────────────────────────────────────────── */
  "hist.title":        { en: "Rate history",   zh: "运价走势",   ar: "تاريخ الأسعار" },
  "hist.empty":        { en: "Not enough history on this lane yet. It builds as the lane is searched.",
                          zh: "该航线的历史数据尚不足，会随着查询逐步积累。",
                          ar: "لا يوجد تاريخ كافٍ لهذا المسار بعد. يتكوّن تدريجيًا مع كل بحث." },
  "hist.change":       { en: "{pct} vs {when}", zh: "较{when} {pct}", ar: "{pct} مقارنة بـ{when}" },

  /* ── empty / error states ─────────────────────────────────────────────── */
  "empty.title":       { en: "Where are you shipping?", zh: "您要发往哪里？", ar: "إلى أين تشحن؟" },
  "empty.hint":        { en: "Pick an origin port, a destination and a method. Rates appear here.",
                          zh: "选择起运港、目的地和运输方式，运价将显示在这里。",
                          ar: "اختر ميناء الشحن والوجهة وطريقة الشحن. ستظهر الأسعار هنا." },
  "err.title":         { en: "We couldn't retrieve a rate",  zh: "无法获取运价",  ar: "تعذّر الحصول على سعر" },
  "err.retry":         { en: "Try again",                    zh: "重试",         ar: "أعد المحاولة" },
  "err.changeRoute":   { en: "Change route",                 zh: "更换航线",      ar: "غيّر المسار" },
  "err.tryOtherMethod": { en: "Try another method",          zh: "尝试其他方式",  ar: "جرّب طريقة أخرى" },
  "err.portUnknown":   { en: "We don't recognise \"{name}\" as a port.",
                          zh: "无法识别「{name}」这个港口。",
                          ar: "لا نعرف «{name}» كميناء." },
  "err.portAmbiguous": { en: "More than one port is called \"{name}\". Which one?",
                          zh: "有多个港口名为「{name}」，请选择其一。",
                          ar: "أكثر من ميناء اسمه «{name}». أيّهم؟" },
  "err.portNoCode":    { en: "{name} has no UN/LOCODE on record, so it can't be sent to a rate provider.",
                          zh: "{name} 没有 UN/LOCODE 记录，无法提交给运价服务商。",
                          ar: "{name} ليس له كود UN/LOCODE مسجّل، فلا يمكن إرساله إلى مزوّد الأسعار." },
  "err.noSources":     { en: "No rate source is configured for this shipping method.",
                          zh: "该运输方式未配置运价来源。",
                          ar: "لا يوجد مصدر أسعار مهيّأ لطريقة الشحن هذه." },
  "err.timeout":       { en: "The rate source didn't answer in time.", zh: "运价来源响应超时。", ar: "لم يستجب مصدر الأسعار في الوقت المحدد." },
  "err.quota":         { en: "The rate source is rate-limiting us. It'll be available again shortly.",
                          zh: "运价来源限流中，稍后将恢复。",
                          ar: "مصدر الأسعار يحدّ من طلباتنا. سيعود متاحًا بعد قليل." },
  "err.unauthorised":  { en: "The rate source rejected our credentials.", zh: "运价来源拒绝了我们的凭据。", ar: "رفض مصدر الأسعار بيانات الدخول." },
  "err.unconfigured":  { en: "Not connected yet.",           zh: "尚未连接。",   ar: "غير متصل بعد." },
  "err.noRoute":       { en: "No rate on this lane.",        zh: "该航线暂无运价。", ar: "لا يوجد سعر على هذا المسار." },

  /* ── loading ──────────────────────────────────────────────────────────── */
  "load.rates":        { en: "Checking freight rates…",  zh: "正在查询运价…",  ar: "جارٍ فحص أسعار الشحن…" },
  "load.ports":        { en: "Loading ports…",           zh: "正在加载港口…",  ar: "جارٍ تحميل الموانئ…" },
  "load.cached":       { en: "From cache",               zh: "来自缓存",      ar: "من الذاكرة المؤقتة" },

  /* ── accessibility ────────────────────────────────────────────────────── */
  "a11y.originPicker":  { en: "Choose an origin port",      zh: "选择起运港",   ar: "اختر ميناء الشحن" },
  "a11y.destPicker":    { en: "Choose a destination port",  zh: "选择目的港",   ar: "اختر ميناء الوصول" },
  "a11y.modeGroup":     { en: "Shipping method",            zh: "运输方式",     ar: "طريقة الشحن" },
  "a11y.rateCard":      { en: "{equipment} rate from {source}", zh: "{source} 的 {equipment} 运价", ar: "سعر {equipment} من {source}" },
  "a11y.confidence":    { en: "Confidence {level}, {score} out of 100", zh: "可信度{level}，{score} 分（满分 100）", ar: "الثقة {level}، {score} من ١٠٠" },
};
