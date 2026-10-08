/* ---------------------------------------------------------------------------
   trade-terms/ui — interface labels, all three languages in one small file.

   WHY ALL THREE TOGETHER while the CONTENT is split per language: these are
   about sixty short strings. Splitting them would add three network round
   trips to save under three kilobytes — the wrong trade. The content files
   are split because they are measured in tens of kilobytes each; this is not.

   NO FALLBACK PATTERN HERE, DELIBERATELY. Elsewhere in this codebase
   `t("key") || "Fallback"` was used as a safety net and turned out to be
   dead code — t() returns the KEY when it is missing and a non-empty string
   is truthy, so the fallback can never fire. That is how the Accounts
   security tab shipped raw key names as button labels. A typed record with
   every language required means a missing string is a BUILD error, not a
   silent one.
   --------------------------------------------------------------------------- */

import type { TtStructureId } from "./data";

export type TradeLang = "en" | "zh" | "ar";

export interface TradeTermsUI {
  title: string;
  subtitle: string;
  tabIncoterms: string;
  tabPayment: string;
  searchPlaceholder: string;
  noResults: string;
  /* Incoterms tab */
  incotermsIntro: string;
  groupE: string;
  groupF: string;
  groupC: string;
  groupD: string;
  legacyTitle: string;
  legacyIntro: string;
  legacyLine: string;         // "{year}" and "{alt}"
  alsoWritten: string;        // "{aliases}"
  seaOnly: string;
  anyMode: string;
  containerWarning: string;   // "{alt}" placeholder
  sellerPays: string;
  buyerPays: string;
  exportPackLoad: string;
  exportClearance: string;
  mainCarriage: string;
  insurance: string;
  importClearance: string;
  dutyVat: string;
  unloadAtDestination: string;
  stSeller: string;
  stExport: string;
  stOnBoard: string;
  stArrival: string;
  stDestination: string;
  riskMarker: string;
  costMarker: string;
  meaning: string;
  howItWorks: string;
  useWhen: string;
  avoidWhen: string;
  pitfall: string;
  insuranceNote: string;      // "{clauses}" and "{pct}"
  more: string;
  less: string;
  /* Payment tab */
  ladderTitle: string;
  ladderSafest: string;
  ladderRiskiest: string;
  methodsTitle: string;
  lcTypesTitle: string;
  lcTypesIntro: string;
  guaranteesTitle: string;
  guaranteesIntro: string;
  bankBacked: string;
  noBankBacking: string;
  goodsBefore: string;
  protectsSeller: string;
  protectsBuyer: string;
  protectsBoth: string;
  ttTitle: string;
  ttIntro: string;
  ttTriggers: Record<TtStructureId, string>;
  sourceNote: string;
}

export const TRADE_TERMS_UI: Record<TradeLang, TradeTermsUI> = {
  en: {
    title: "Trade & Payment Terms",
    subtitle: "What FOB, CIF, T/T, L/C, D/A and a bank guarantee actually mean — and what changes for you. Written for someone who has never exported anything.",
    tabIncoterms: "Delivery terms (Incoterms)",
    tabPayment: "Payment terms",
    searchPlaceholder: "Search a term — FOB, T/T, SBLC, performance bond…",
    noResults: "Nothing matches that. Try the code, e.g. FOB or D/A.",
    incotermsIntro: "A quotation that says “FOB price” or “CIF price” is naming one of these rules: the price covers exactly the seller's costs listed under that term, and nothing past its cost stop. Same goods, different term — different price, and a different moment when the goods become your risk.",
    groupE: "E — Departure: you collect from the seller",
    groupF: "F — Main freight is yours to arrange and pay",
    groupC: "C — Seller pays the main freight, but risk passes at origin",
    groupD: "D — Arrival: the seller delivers",
    legacyTitle: "Retired codes you will still meet in contracts",
    legacyIntro: "Removed from the rules, alive in old templates and habit. When you see one, read it as the current term beside it — and ask for the contract to say so.",
    legacyLine: "Retired in Incoterms® {year} — use {alt}",
    alsoWritten: "Also written {aliases}",
    seaOnly: "Sea freight only",
    anyMode: "Any transport",
    containerWarning: "Not meant for containers — ICC recommends {alt} instead.",
    sellerPays: "Seller",
    buyerPays: "Buyer",
    exportPackLoad: "Packing & loading",
    exportClearance: "Export clearance",
    mainCarriage: "Main freight",
    insurance: "Insurance",
    importClearance: "Import clearance",
    dutyVat: "Duty & VAT",
    unloadAtDestination: "Unloading at destination",
    stSeller: "Seller's premises",
    stExport: "Export cleared",
    stOnBoard: "On board",
    stArrival: "Arrival port",
    stDestination: "Buyer's door",
    riskMarker: "Risk passes to the buyer here",
    costMarker: "Seller's cost stops here",
    meaning: "What it means",
    howItWorks: "How it works",
    useWhen: "Use it when",
    avoidWhen: "Avoid it when",
    pitfall: "The mistake people make",
    insuranceNote: "The seller must insure at Institute Cargo Clauses ({clauses}), minimum {pct}% of contract value.",
    more: "Show me more",
    less: "Show less",
    ladderTitle: "Who carries the risk",
    ladderSafest: "Safest for the seller",
    ladderRiskiest: "Riskiest for the seller",
    methodsTitle: "The six ways of getting paid",
    lcTypesTitle: "Letter of credit — the types you will meet",
    lcTypesIntro: "One instrument, many labels. Each word on a letter of credit changes who is promising, when the money arrives, or who may use it.",
    guaranteesTitle: "Bank guarantees & escrow",
    guaranteesIntro: "Not ways of paying — ways of protecting a payment already promised. A guarantee pays only when someone fails; escrow holds the money until someone performs.",
    bankBacked: "A bank promises to pay",
    noBankBacking: "No bank promise",
    goodsBefore: "Buyer gets the goods before paying",
    protectsSeller: "Protects the seller",
    protectsBuyer: "Protects the buyer",
    protectsBoth: "Protects both sides",
    ttTitle: "T/T — the common payment structures",
    ttIntro: "T/T is just a bank transfer. Its safety comes entirely from WHEN the money is due compared with shipment.",
    ttTriggers: {
      "tt-100-advance": "Before production",
      "tt-30-70-bl": "Deposit, balance against copy of B/L",
      "tt-30-70-preship": "Deposit, balance before shipment",
      "tt-30-40-30": "Deposit, production complete, against B/L copy",
    },
    sourceNote: "Source: ICC Incoterms® 2020, UCP 600, URC 522, URDG 758, ISP98 and the U.S. International Trade Administration. This explains the international standards — not Koleex's own commercial terms.",
  },
  zh: {
    title: "贸易与付款条款",
    subtitle: "FOB、CIF、T/T、L/C、D/A 和银行保函到底是什么意思——以及对你有什么影响。为从未做过出口的人而写。",
    tabIncoterms: "交货条款（国际贸易术语）",
    tabPayment: "付款条款",
    searchPlaceholder: "搜索术语——FOB、T/T、SBLC、履约保函……",
    noResults: "没有匹配项。试试代码，例如 FOB 或 D/A。",
    incotermsIntro: "报价单上写的“FOB 价”“CIF 价”，指的就是这里的某一条规则：价格恰好包含该术语下列出的卖方费用，费用终点之后的一概不含。同一批货，术语不同——价格不同，货物变成你的风险的那一刻也不同。",
    groupE: "E 组——启运：你到卖方处提货",
    groupF: "F 组——主运费由你安排并支付",
    groupC: "C 组——卖方付主运费，但风险在启运地转移",
    groupD: "D 组——到达：卖方送达",
    legacyTitle: "已废止但合同里仍会出现的术语",
    legacyIntro: "已从规则中删除，却仍活在旧模板和习惯里。遇到时，按旁边的现行术语理解——并要求合同改成现行写法。",
    legacyLine: "已于 Incoterms® {year} 废止——改用 {alt}",
    alsoWritten: "也写作 {aliases}",
    seaOnly: "仅限海运",
    anyMode: "任何运输方式",
    containerWarning: "不适用于集装箱——国际商会建议改用 {alt}。",
    sellerPays: "卖方",
    buyerPays: "买方",
    exportPackLoad: "包装与装货",
    exportClearance: "出口清关",
    mainCarriage: "主运费",
    insurance: "保险",
    importClearance: "进口清关",
    dutyVat: "关税与增值税",
    unloadAtDestination: "目的地卸货",
    stSeller: "卖方所在地",
    stExport: "完成出口清关",
    stOnBoard: "装船",
    stArrival: "到达港",
    stDestination: "买方门口",
    riskMarker: "风险在此转移给买方",
    costMarker: "卖方费用在此结束",
    meaning: "含义",
    howItWorks: "运作方式",
    useWhen: "适用情况",
    avoidWhen: "不适用情况",
    pitfall: "常见错误",
    insuranceNote: "卖方必须按协会货物条款（{clauses}）投保，最低为合同价值的 {pct}%。",
    more: "了解更多",
    less: "收起",
    ladderTitle: "谁承担风险",
    ladderSafest: "对卖方最安全",
    ladderRiskiest: "对卖方风险最高",
    methodsTitle: "六种收款方式",
    lcTypesTitle: "信用证——你会遇到的各种类型",
    lcTypesIntro: "同一种工具，多种标签。信用证上的每一个词，都在改变谁在承诺、钱何时到账、或谁能使用它。",
    guaranteesTitle: "银行保函与托管",
    guaranteesIntro: "这些不是付款方式，而是保护已承诺付款的方式。保函只在一方违约时才付；托管则把钱扣住，直到一方履约。",
    bankBacked: "银行承诺付款",
    noBankBacking: "无银行承诺",
    goodsBefore: "买方先拿货后付款",
    protectsSeller: "保护卖方",
    protectsBuyer: "保护买方",
    protectsBoth: "保护双方",
    ttTitle: "T/T——常见付款结构",
    ttIntro: "T/T 只是银行转账。它的安全性完全取决于付款时间与发货时间的关系。",
    ttTriggers: {
      "tt-100-advance": "生产前",
      "tt-30-70-bl": "定金，余款凭提单副本",
      "tt-30-70-preship": "定金，余款发货前",
      "tt-30-40-30": "定金、完工、凭提单副本",
    },
    sourceNote: "来源：国际商会 Incoterms® 2020、UCP 600、URC 522、URDG 758、ISP98，以及美国国际贸易管理局。本节说明国际标准，不代表 Koleex 自己的商务条款。",
  },
  ar: {
    title: "‏شروط التجارة والدفع",
    subtitle: "‏إيه يعني FOB و CIF و T/T و L/C و D/A والضمان البنكي بالظبط — وإيه اللي بيتغيّر عليك. مكتوب لحد عمره ما صدّر حاجة.",
    tabIncoterms: "‏شروط التسليم (إنكوترمز)",
    tabPayment: "‏شروط الدفع",
    searchPlaceholder: "‏دوّر على مصطلح — FOB أو T/T أو SBLC أو ضمان أداء…",
    noResults: "‏مفيش نتايج. جرّب الكود نفسه، زي FOB أو D/A.",
    incotermsIntro: "‏لما عرض السعر يقول «سعر FOB» أو «سعر CIF»، هو بيسمّي قاعدة من دول: السعر بيغطي بالظبط تكاليف البائع المذكورة تحت المصطلح ده، ولا حاجة بعد نقطة توقف تكلفته. نفس البضاعة، مصطلح مختلف — سعر مختلف، ولحظة مختلفة تبقى فيها البضاعة مخاطرتك.",
    groupE: "‏مجموعة E — المغادرة: إنت بتستلم من عند البائع",
    groupF: "‏مجموعة F — النولون الأساسي إنت اللي بترتّبه وتدفعه",
    groupC: "‏مجموعة C — البائع بيدفع النولون الأساسي، بس المخاطرة بتنتقل عند المغادرة",
    groupD: "‏مجموعة D — الوصول: البائع بيوصّل",
    legacyTitle: "‏أكواد ملغية لسه هتقابلها في العقود",
    legacyIntro: "‏اتشالت من القواعد، بس عايشة في النماذج القديمة والعادة. لما تشوف واحد منها، افهمه بالمصطلح الحالي اللي جنبه — واطلب إن العقد يتكتب بيه.",
    legacyLine: "‏اتلغى في Incoterms® {year} — استخدم {alt}",
    alsoWritten: "‏بيتكتب كمان {aliases}",
    seaOnly: "‏شحن بحري فقط",
    anyMode: "‏أي وسيلة نقل",
    containerWarning: "‏مش مخصص للكونتينر — غرفة التجارة الدولية بتنصح بـ {alt} بدالها.",
    sellerPays: "‏البائع",
    buyerPays: "‏المشتري",
    exportPackLoad: "‏التغليف والتحميل",
    exportClearance: "‏تخليص التصدير",
    mainCarriage: "‏النولون الأساسي",
    insurance: "‏التأمين",
    importClearance: "‏تخليص الاستيراد",
    dutyVat: "‏الجمارك والضريبة",
    unloadAtDestination: "‏التفريغ في الوصول",
    stSeller: "‏مقر البائع",
    stExport: "‏بعد تخليص التصدير",
    stOnBoard: "‏على ظهر السفينة",
    stArrival: "‏ميناء الوصول",
    stDestination: "‏باب المشتري",
    riskMarker: "‏المخاطر بتنتقل للمشتري هنا",
    costMarker: "‏تكلفة البائع بتقف هنا",
    meaning: "‏يعني إيه",
    howItWorks: "‏بيشتغل إزاي",
    useWhen: "‏استخدمه لما",
    avoidWhen: "‏تجنّبه لما",
    pitfall: "‏الغلطة اللي الناس بتقع فيها",
    insuranceNote: "‏البائع ملزم بالتأمين بشروط البضائع ({clauses})، بحد أدنى {pct}% من قيمة العقد.",
    more: "‏وَرّيني أكتر",
    less: "‏إخفاء",
    ladderTitle: "‏مين شايل المخاطرة",
    ladderSafest: "‏الأأمن للبائع",
    ladderRiskiest: "‏الأخطر على البائع",
    methodsTitle: "‏الست طرق اللي بتتقبض بيها فلوسك",
    lcTypesTitle: "‏الاعتماد المستندي — الأنواع اللي هتقابلها",
    lcTypesIntro: "‏أداة واحدة وأسامي كتير. كل كلمة على الاعتماد بتغيّر مين اللي بيوعد، أو الفلوس بتوصل إمتى، أو مين يقدر يستخدمه.",
    guaranteesTitle: "‏الضمانات البنكية والإسكرو",
    guaranteesIntro: "‏دي مش طرق دفع — دي طرق حماية لدفع متوعد بيه أصلًا. الضمان بيدفع بس لما حد يقصّر؛ والإسكرو بيمسك الفلوس لحد ما حد ينفّذ.",
    bankBacked: "‏فيه بنك بيضمن الدفع",
    noBankBacking: "‏مفيش ضمان بنكي",
    goodsBefore: "‏المشتري بياخد البضاعة قبل ما يدفع",
    protectsSeller: "‏بيحمي البائع",
    protectsBuyer: "‏بيحمي المشتري",
    protectsBoth: "‏بيحمي الطرفين",
    ttTitle: "‏T/T — هياكل الدفع الشائعة",
    ttIntro: "‏T/T مجرد تحويل بنكي. أمانه بيجي بالكامل من ميعاد الدفع بالنسبة للشحن.",
    ttTriggers: {
      "tt-100-advance": "‏قبل الإنتاج",
      "tt-30-70-bl": "‏مقدم، والباقي مقابل صورة بوليصة الشحن",
      "tt-30-70-preship": "‏مقدم، والباقي قبل الشحن",
      "tt-30-40-30": "‏مقدم، بعد الإنتاج، مقابل صورة البوليصة",
    },
    sourceNote: "‏المصدر: غرفة التجارة الدولية — Incoterms® 2020 و UCP 600 و URC 522 و URDG 758 و ISP98، وإدارة التجارة الدولية الأمريكية. القسم ده بيشرح المعايير الدولية — مش شروط كوليكس التجارية.",
  },
};
