/* ---------------------------------------------------------------------------
   brand-book/chapters — the table of contents of the KOLEEX Brand Guidelines.

   ONE LIST, EVERYTHING READS IT. The sidebar, the cover page, the pager at
   the foot of a chapter and the chapter header all come from here, so a
   chapter cannot be called one thing in the menu and another on its page.

   140 chapters in 10 parts (owner, 27/09/2026: "increase the chapters").
   A part is a number range, not a field on every row — the ranges below are
   the only place the grouping lives.

   `READY` is the set of chapters that have content. A chapter that is not
   ready is listed (the owner wants to see the whole book) but not linked:
   an unwritten chapter is never a dead end the reader can click into.

   Titles are in all three languages from the start. The chapter BODIES are
   English first (owner decision, 27/09/2026); Chinese and Arabic bodies
   follow in a later phase.
   --------------------------------------------------------------------------- */

import type { Lang } from "@/lib/i18n";

export type BookText = Record<Lang, string>;

export interface BookPart {
  n: number;
  id: string;
  title: BookText;
  from: number;
  to: number;
  /** One line on what the part holds (English, like the chapter bodies). */
  blurb: string;
}

export interface BookChapter {
  n: number;
  slug: string;
  title: BookText;
  part: number;
  ready: boolean;
}

export const BOOK_PARTS: BookPart[] = [
  { n: 1, id: "foundation", from: 1, to: 17, title: { en: "Foundation", zh: "品牌基础", ar: "الأساس" }, blurb: "Story, mission, values, positioning, personality, brand architecture" },
  { n: 2, id: "verbal", from: 18, to: 35, title: { en: "Verbal Identity", zh: "语言识别", ar: "الهوية اللفظية" }, blurb: "The name, tagline, voice, writing in three languages, key messages, glossary" },
  { n: 3, id: "visual", from: 36, to: 74, title: { en: "Visual Identity", zh: "视觉识别", ar: "الهوية البصرية" }, blurb: "Logo, Hub mark, color and silver, typography, layout, icons, photography, video, motion, the KOLEEX melody" },
  { n: 4, id: "digital", from: 75, to: 90, title: { en: "Digital", zh: "数字媒体", ar: "الديجيتال" }, blurb: "Website, the Hub interface, email, every social platform, ads, presentations" },
  { n: 5, id: "print", from: 91, to: 106, title: { en: "Print & Documents", zh: "印刷品与文件", ar: "المطبوعات والمستندات" }, blurb: "Business cards, letterhead, every business document, catalogs, brochures, posters" },
  { n: 6, id: "product", from: 107, to: 113, title: { en: "Product & Packaging", zh: "产品与包装", ar: "المنتج والتغليف" }, blurb: "Machine branding, nameplates, labels, cartons, shipping marks, manuals" },
  { n: 7, id: "places", from: 114, to: 121, title: { en: "Places & Events", zh: "空间与活动", ar: "الأماكن والفعاليات" }, blurb: "Exhibition booths, CISMA, offices, showroom, warehouse, vehicles, events" },
  { n: 8, id: "people", from: 122, to: 127, title: { en: "People", zh: "人员", ar: "الناس" }, blurb: "Uniforms, merchandise, seasonal gifts, hiring, staff and founder on social media" },
  { n: 9, id: "partners", from: 128, to: 131, title: { en: "Partners", zh: "合作伙伴", ar: "الشركاء" }, blurb: "Agents and distributors, dealer signage, suppliers, testimonials" },
  { n: 10, id: "governance", from: 132, to: 140, title: { en: "Governance & Files", zh: "管理与文件", ar: "الحوكمة والملفات" }, blurb: "Legal and claims, certification marks, approvals, file naming, downloads, templates" },
];

/** Chapters with content. Phase 1: the core visual identity (1–3, 36–54,
 *  136). Phase 2: grid, graphics, icons, photography, video, motion, sound
 *  (55–74). Phase 3: digital, and print & documents (75–106). Phase 4:
 *  product & packaging, places & events, people, partners, governance
 *  (107–140). Phase 5: the story and the verbal identity (4–35) — the book
 *  is complete. */
const READY = new Set<number>([
  1, 2, 3,
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54,
  55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
  75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
  91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106,
  107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121,
  122, 123, 124, 125, 126, 127,
  128, 129, 130, 131,
  132, 133, 134, 135, 136, 137, 138, 139, 140,
]);

/* [number, slug, en, zh, ar] — kept as tuples so 140 rows stay readable. */
const ROWS: ReadonlyArray<readonly [number, string, string, string, string]> = [
  [1, "welcome", "Welcome", "欢迎", "مرحبًا"],
  [2, "how-to-use", "How to Use This Book", "如何使用本手册", "كيف تستخدم هذا الدليل"],
  [3, "at-a-glance", "The Brand at a Glance", "品牌一览", "الهوية في صفحة واحدة"],
  [4, "our-story", "Our Story", "我们的故事", "قصتنا"],
  [5, "timeline", "Timeline", "发展历程", "الخط الزمني"],
  [6, "what-we-do", "What We Do", "我们的业务", "ماذا نقدّم"],
  [7, "where-we-are", "Where We Are", "我们的布局", "أين نحن"],
  [8, "koleex-group", "KOLEEX International Group", "KOLEEX International Group", "KOLEEX International Group"],
  [9, "mission-vision", "Mission & Vision", "使命与愿景", "الرسالة والرؤية"],
  [10, "values", "Values", "核心价值观", "القيم"],
  [11, "promise-positioning", "Promise & Positioning", "品牌承诺与定位", "الوعد والتموضع"],
  [12, "why-koleex", "Why KOLEEX", "为什么选择 KOLEEX", "لماذا KOLEEX"],
  [13, "competition", "Competitive Landscape", "竞争格局", "المنافسة"],
  [14, "audiences", "Audiences & Personas", "目标受众", "الجمهور"],
  [15, "personality", "Brand Personality", "品牌个性", "شخصية العلامة"],
  [16, "brand-architecture", "Brand Architecture", "品牌架构", "هيكل العلامة"],
  [17, "product-naming", "Product Lines & Model Naming", "产品线与型号命名", "خطوط المنتجات وتسمية الموديلات"],
  [18, "name-usage", "Using the Name", "名称使用", "استخدام الاسم"],
  [19, "legal-names", "Legal Names & Trademarks", "法定名称与商标", "الأسماء القانونية والعلامات المسجلة"],
  [20, "tagline", "Tagline", "品牌口号", "الشعار اللفظي"],
  [21, "descriptor", "Descriptor", "品牌描述语", "الوصف"],
  [22, "tone-of-voice", "Tone of Voice", "品牌语调", "النبرة"],
  [23, "tone-by-channel", "Tone by Channel", "各渠道语调", "النبرة حسب القناة"],
  [24, "tone-by-situation", "Tone by Situation", "各场景语调", "النبرة حسب الموقف"],
  [25, "writing-style", "Writing Style & Punctuation", "写作与标点", "قواعد الكتابة والترقيم"],
  [26, "numbers-dates", "Numbers, Units, Currency & Dates", "数字、单位、货币与日期", "الأرقام والوحدات والعملات والتواريخ"],
  [27, "writing-english", "Writing in English", "英文写作", "الكتابة بالإنجليزية"],
  [28, "writing-arabic", "Writing in Arabic", "阿拉伯文写作", "الكتابة بالعربية"],
  [29, "writing-chinese", "Writing in Chinese", "中文写作", "الكتابة بالصينية"],
  [30, "ai-translation", "AI Translation Rules", "AI 翻译规范", "قواعد الترجمة بالذكاء الاصطناعي"],
  [31, "key-messages", "Key Messages", "核心信息", "الرسائل الأساسية"],
  [32, "boilerplates", "Company Descriptions", "公司简介", "تعريف الشركة"],
  [33, "product-descriptions", "Product Descriptions", "产品描述", "وصف المنتجات"],
  [34, "ctas-replies", "Calls to Action & Ready Replies", "行动号召与常用回复", "عبارات الحثّ والردود الجاهزة"],
  [35, "glossary", "Glossary", "术语表", "قاموس المصطلحات"],
  [36, "logo", "The Logo", "标志", "الشعار"],
  [37, "logo-construction", "Logo Construction & Clear Space", "标志结构与安全空间", "بناء الشعار ومساحة الأمان"],
  [38, "logo-size-placement", "Logo Size & Placement", "标志尺寸与位置", "حجم الشعار ومكانه"],
  [39, "logo-backgrounds", "Logo on Backgrounds & Materials", "标志的背景与材质", "الشعار على الخلفيات والخامات"],
  [40, "logo-misuse", "Logo Misuse", "标志误用", "الاستخدامات الخاطئة للشعار"],
  [41, "logo-small-spaces", "The Logo in Small Spaces", "小尺寸标志", "الشعار في المساحات الصغيرة"],
  [42, "hub-mark", "Koleex Hub Mark & App Icon", "Koleex Hub 标志与应用图标", "شعار Koleex Hub وأيقونة التطبيق"],
  [43, "lockups", "Lockups", "组合标志", "التركيبات"],
  [44, "co-branding", "The Logo with Other Logos", "联合品牌", "الشعار مع شعارات أخرى"],
  [45, "color-palette", "Color Palette", "色彩体系", "لوحة الألوان"],
  [46, "silver-hub-blue", "Silver & Hub Blue", "银色与 Hub 蓝", "الفضي وأزرق Hub"],
  [47, "color-usage", "Color Usage & Proportions", "色彩使用与比例", "استخدام الألوان ونسبها"],
  [48, "color-print", "Color for Print & Materials", "印刷与材质用色", "الألوان للطباعة والخامات"],
  [49, "contrast", "Contrast & Legibility", "对比度与易读性", "التباين وسهولة القراءة"],
  [50, "typefaces", "Typefaces", "字体", "الخطوط"],
  [51, "type-scale", "Type Scale & Hierarchy", "字号与层级", "الأحجام والتسلسل"],
  [52, "arabic-type", "Arabic Typography", "阿拉伯文排版", "الخط العربي"],
  [53, "chinese-type", "Chinese Typography", "中文排版", "الخط الصيني"],
  [54, "multilingual", "Multilingual Layouts & RTL", "多语言排版与从右到左", "التصميم متعدد اللغات والاتجاه من اليمين"],
  [55, "grid-layout", "Grid & Layout", "网格与版式", "الشبكة والتخطيط"],
  [56, "spacing-shapes", "Spacing & Shapes", "间距与形状", "المسافات والأشكال"],
  [57, "graphic-elements", "Graphic Elements", "图形元素", "العناصر الجرافيكية"],
  [58, "icons", "Icons", "图标", "الأيقونات"],
  [59, "machine-icons", "Machine Icons", "机器图标", "أيقونات الماكينات"],
  [60, "photo-callouts", "Product Photos & Callouts", "产品照片与标注", "صور المنتج والتعليقات"],
  [61, "infographics", "Infographics & Charts", "信息图与图表", "الإنفوجرافيك والرسوم البيانية"],
  [62, "tables-numbers", "Tables & Numbers", "表格与数字", "الجداول والأرقام"],
  [63, "photo-principles", "Photography Principles", "摄影原则", "مبادئ التصوير"],
  [64, "studio-photo", "Product Photography: Studio", "产品摄影：影棚", "تصوير المنتج في الاستوديو"],
  [65, "mobile-photo", "Product Photography: Mobile", "产品摄影：手机", "تصوير المنتج بالموبايل"],
  [66, "people-photo", "People & Team Photography", "人物与团队摄影", "تصوير الناس والفريق"],
  [67, "factory-photo", "Factory & Production Photography", "工厂与生产摄影", "تصوير المصنع والإنتاج"],
  [68, "event-photo", "Exhibition & Event Photography", "展会与活动摄影", "تصوير المعارض والفعاليات"],
  [69, "image-editing", "Image Editing & AI Policy", "图片编辑与 AI 规范", "تعديل الصور وسياسة الذكاء الاصطناعي"],
  [70, "video", "Video", "视频", "الفيديو"],
  [71, "video-kit", "Video Kit: Intro, Outro & Subtitles", "视频套件：片头、片尾与字幕", "عُدّة الفيديو: المقدمة والخاتمة والترجمة"],
  [72, "motion", "Motion", "动效", "الحركة"],
  [73, "logo-animation", "Logo Animation", "标志动画", "حركة الشعار"],
  [74, "sound", "Sound", "声音", "الصوت"],
  [75, "website", "Website", "网站", "الموقع الإلكتروني"],
  [76, "hub-core", "Koleex Hub UI: Core", "Koleex Hub 界面：Core", "واجهة الـ Hub: Core"],
  [77, "hub-aurora", "Koleex Hub UI: Aurora", "Koleex Hub 界面：Aurora", "واجهة الـ Hub: Aurora"],
  [78, "email", "Email & Newsletters", "邮件与简报", "الإيميل والنشرة"],
  [79, "social-profiles", "Social Media Profiles", "社交媒体主页", "بروفايلات السوشيال ميديا"],
  [80, "post-templates", "Post Templates", "帖子模板", "قوالب البوستات"],
  [81, "facebook", "Facebook", "Facebook", "Facebook"],
  [82, "instagram", "Instagram", "Instagram", "Instagram"],
  [83, "linkedin", "LinkedIn", "LinkedIn", "LinkedIn"],
  [84, "tiktok-douyin", "TikTok & Douyin", "TikTok 与抖音", "TikTok وDouyin"],
  [85, "youtube", "YouTube", "YouTube", "YouTube"],
  [86, "x", "X", "X", "X"],
  [87, "wechat", "WeChat", "微信", "WeChat"],
  [88, "whatsapp", "WhatsApp Business", "WhatsApp Business", "WhatsApp Business"],
  [89, "digital-ads", "Digital Advertising", "数字广告", "الإعلانات الرقمية"],
  [90, "presentations", "Presentations", "演示文稿", "العروض التقديمية"],
  [91, "business-cards", "Business Cards", "名片", "كروت البيزنس"],
  [92, "letterhead", "Letterhead & Envelopes", "信纸与信封", "الورق الرسمي والظروف"],
  [93, "email-signature", "Email Signature", "邮件签名", "توقيع الإيميل"],
  [94, "sales-documents", "Sales Documents", "销售文件", "مستندات البيع"],
  [95, "contracts", "Contracts", "合同", "العقود"],
  [96, "shipping-documents", "Shipping Documents", "物流文件", "مستندات الشحن"],
  [97, "purchase-orders", "Purchase Orders", "采购订单", "أوامر الشراء"],
  [98, "finance-documents", "Finance Documents", "财务文件", "المستندات المالية"],
  [99, "certificates", "Certificates", "证书", "الشهادات"],
  [100, "letters", "Official Letters & Invitations", "公函与邀请函", "الخطابات الرسمية والدعوات"],
  [101, "hr-documents", "HR Documents", "人事文件", "مستندات الموارد البشرية"],
  [102, "company-profile", "Company Profile", "公司简介册", "ملف الشركة"],
  [103, "catalogs", "Catalogs", "产品目录", "الكتالوجات"],
  [104, "brochures", "Brochures & Flyers", "宣传册与传单", "البروشورات والفلايرات"],
  [105, "spec-sheets", "Spec Sheets", "规格表", "ورق المواصفات"],
  [106, "posters", "Posters", "海报", "البوسترات"],
  [107, "machine-branding", "Machine Branding", "机器品牌标识", "هوية الماكينة"],
  [108, "nameplates", "Nameplates & Serial Labels", "铭牌与序列号标签", "لوحة البيانات والسيريال"],
  [109, "warning-labels", "Warning & Control Panel Labels", "警示与控制面板标签", "ملصقات التحذير ولوحة التحكم"],
  [110, "cartons", "Cartons & Crates", "纸箱与木箱", "الكراتين والصناديق الخشبية"],
  [111, "shipping-marks", "Shipping Marks & Labels", "唛头与标签", "علامات الشحن والملصقات"],
  [112, "spare-parts-packaging", "Spare Parts Packaging", "配件包装", "تغليف قطع الغيار"],
  [113, "manuals", "Manuals & Warranty Cards", "说明书与保修卡", "دليل الاستخدام وكارت الضمان"],
  [114, "exhibition-booth", "Exhibition Booth", "展位", "بوث المعرض"],
  [115, "exhibition-kit", "Exhibition Kit", "展会物料", "عُدّة المعرض"],
  [116, "cisma", "CISMA Playbook", "CISMA 参展手册", "دليل معرض CISMA"],
  [117, "office-signage", "Office Signage", "办公室标识", "لافتات المكاتب"],
  [118, "showroom", "Showroom", "展厅", "صالة العرض"],
  [119, "warehouse-signage", "Warehouse & Factory Signage", "仓库与工厂标识", "لافتات المخزن والمصنع"],
  [120, "vehicles", "Vehicles", "车辆", "المركبات"],
  [121, "events", "Events & Training Days", "活动与培训日", "الفعاليات وأيام التدريب"],
  [122, "uniforms", "Uniforms", "制服", "اليونيفورم"],
  [123, "merchandise", "Merchandise & Gifts", "礼品与周边", "الهدايا والمنتجات الدعائية"],
  [124, "seasonal-gifts", "Seasonal Gifts", "节日礼品", "هدايا المواسم"],
  [125, "employer-brand", "Employer Brand & Hiring", "雇主品牌与招聘", "علامة صاحب العمل والتوظيف"],
  [126, "staff-social", "Staff on Social Media", "员工社交媒体", "الموظفون على السوشيال ميديا"],
  [127, "founder-brand", "The Founder's Personal Brand", "创始人个人品牌", "الهوية الشخصية للمؤسس"],
  [128, "agents", "Agents & Distributors", "代理商与经销商", "الوكلاء والموزعون"],
  [129, "dealer-signage", "Dealer Signage", "经销商门店标识", "لافتات محلات الوكلاء"],
  [130, "suppliers-oem", "Suppliers & OEM", "供应商与 OEM", "المصانع والموردون وOEM"],
  [131, "testimonials", "Testimonials & Case Studies", "客户评价与案例", "شهادات العملاء وقصص النجاح"],
  [132, "legal-claims", "Legal & Claims", "法律与宣传声明", "القانوني والادعاءات"],
  [133, "certification-marks", "Using CE & ISO 9001", "CE 与 ISO 9001 标志使用", "استخدام CE وISO 9001"],
  [134, "approvals", "Approvals", "审批", "الموافقات"],
  [135, "file-naming", "File Naming", "文件命名", "تسمية الملفات"],
  [136, "downloads", "Downloads", "下载中心", "مكتبة التحميلات"],
  [137, "templates", "Templates Library", "模板库", "مكتبة القوالب"],
  [138, "checklists", "Pre-Publish Checklists", "发布前检查清单", "قوائم المراجعة قبل النشر"],
  [139, "faq", "FAQ", "常见问题", "الأسئلة الشائعة"],
  [140, "versions-contact", "Versions & Contact", "版本与联系", "الإصدارات والتواصل"],
];

function partOf(n: number): number {
  const p = BOOK_PARTS.find((x) => n >= x.from && n <= x.to);
  if (!p) throw new Error(`brand-book: chapter ${n} is outside every part`);
  return p.n;
}

export const BOOK_CHAPTERS: BookChapter[] = ROWS.map(([n, slug, en, zh, ar]) => ({
  n,
  slug,
  title: { en, zh, ar },
  part: partOf(n),
  ready: READY.has(n),
}));

export const BOOK_VERSION = { label: "3.0", date: "27/09/2026" } as const;

export const BOOK_BASE = "/knowledge/brand-guidelines";

/** `base` lets the same book live at another address (a public copy later). */
export function chapterHref(slug: string, base: string = BOOK_BASE): string {
  return `${base}/${slug}`;
}

export function chapterBySlug(slug: string): BookChapter | undefined {
  return BOOK_CHAPTERS.find((c) => c.slug === slug);
}

export function chapterByNumber(n: number): BookChapter | undefined {
  return BOOK_CHAPTERS.find((c) => c.n === n);
}

/** The ready chapters in reading order — what the pager walks. */
export const READY_CHAPTERS: BookChapter[] = BOOK_CHAPTERS.filter((c) => c.ready);

export function neighbours(n: number): { prev?: BookChapter; next?: BookChapter } {
  const i = READY_CHAPTERS.findIndex((c) => c.n === n);
  if (i < 0) return {};
  return { prev: READY_CHAPTERS[i - 1], next: READY_CHAPTERS[i + 1] };
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
