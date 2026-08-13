import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Commercial Setup / Policy — market segmentation, bands, tiers, incoterms,
   payment terms, shipping methods and documents.

   The eight components had ZERO t() calls between them, so the whole surface
   rendered in English under Arabic and Chinese.

   Terminology is load-bearing here: this app is the PRICING SOURCE OF TRUTH —
   bands and segmentation drive what the Price Calculator produces — so the
   words have to be trade terms, not generic UI copy:
     · "band"        → a market price band (نطاق سعري), not a UI tab
     · "tier"        → a threshold step in a discount/commission ladder (شريحة)
     · "level"       → a product margin level (مستوى)
     · "channel"     → a customer sales channel (قناة)
     · "incoterm"    → kept as the ICC term; the ICC 2010/2020 revisions are
                       proper nouns and stay untranslated in all three
     · "L/C"         → letter of credit, kept as the banking abbreviation
   --------------------------------------------------------------------------- */

export const commercialPolicyT: Translations = {
  /* ── Page + sections ── */
  "pricingPolicy":     { en: "Pricing policy", zh: "定价政策", ar: "سياسة التسعير" },
  "policyVersion":     { en: "Policy version", zh: "政策版本", ar: "إصدار السياسة" },
  "policyEngineActive":{ en: "Policy engine active", zh: "政策引擎已启用", ar: "محرّك السياسة نشط" },
  "countrySegmentation":{ en: "Country Segmentation", zh: "国家分层", ar: "تقسيم الدول" },
  "marketBands":       { en: "Market Bands", zh: "市场档位", ar: "النطاقات السوقية" },
  "channelMultipliers":{ en: "Channel Multipliers", zh: "渠道系数", ar: "معاملات القنوات" },
  "productLevels":     { en: "Product Levels", zh: "产品层级", ar: "مستويات المنتجات" },
  "volumeTiers":       { en: "Volume Discount Tiers", zh: "数量折扣阶梯", ar: "شرائح خصم الكمية" },
  "discountTiers":     { en: "Discount Approval Tiers", zh: "折扣审批阶梯", ar: "شرائح اعتماد الخصم" },
  "commissionTiers":   { en: "Commission Tiers", zh: "佣金阶梯", ar: "شرائح العمولة" },
  "approvalAuthority": { en: "Approval Authority", zh: "审批权限", ar: "صلاحية الاعتماد" },
  "approvalHint":      { en: "Who can approve what size of discount.", zh: "谁可以批准多大额度的折扣。", ar: "مين يقدر يعتمد خصم بأي حجم." },
  "incoterms":         { en: "Incoterms (Price Types)", zh: "国际贸易术语（价格类型）", ar: "شروط التسليم (أنواع الأسعار)" },
  "shippingMethods":   { en: "Shipping Methods", zh: "运输方式", ar: "طرق الشحن" },
  "shippingDocuments": { en: "Shipping Documents", zh: "运输单证", ar: "مستندات الشحن" },
  "globalKnobsHint":   { en: "Tenant-level knobs that apply to the whole policy.", zh: "适用于整个政策的租户级设置。", ar: "إعدادات على مستوى المؤسسة بتنطبق على السياسة كلها." },
  "salesSeesCost":     { en: "Sales sees cost", zh: "销售可见成本", ar: "المبيعات تشوف التكلفة" },
  "effectiveFx":       { en: "Effective FX", zh: "生效汇率", ar: "سعر الصرف الفعّال" },
  "effectivePricingFx":{ en: "Effective pricing FX", zh: "生效定价汇率", ar: "سعر الصرف المعتمد للتسعير" },
  "testInCalculator":  { en: "Test a price in the Price Calculator", zh: "在价格计算器中试算", ar: "جرّب سعر في حاسبة الأسعار" },

  /* ── Add / manage actions ── */
  "addBand":           { en: "Add band",    zh: "添加档位", ar: "أضف نطاق" },
  "addChannel":        { en: "Add channel", zh: "添加渠道", ar: "أضف قناة" },
  "addLevel":          { en: "Add level",   zh: "添加层级", ar: "أضف مستوى" },
  "addTier":           { en: "Add tier",    zh: "添加阶梯", ar: "أضف شريحة" },
  "addRole":           { en: "Add role",    zh: "添加角色", ar: "أضف دور" },
  "addCustomer":       { en: "Add Customer", zh: "添加客户", ar: "أضف عميل" },
  "addCustomIncoterm": { en: "Add Custom Incoterm", zh: "添加自定义贸易术语", ar: "أضف شرط تسليم مخصّص" },
  "addCustomMethod":   { en: "Add Custom Method", zh: "添加自定义方式", ar: "أضف طريقة مخصّصة" },
  "addCustomTerm":     { en: "Add Custom Term", zh: "添加自定义条款", ar: "أضف شرط مخصّص" },
  "addCustomDocument": { en: "Add Custom Document", zh: "添加自定义单证", ar: "أضف مستند مخصّص" },
  "manage":            { en: "Manage",      zh: "管理",   ar: "إدارة" },
  "deleteRow":         { en: "Delete row",  zh: "删除行", ar: "حذف السطر" },
  "setAsDefault":      { en: "Set as the default for this category", zh: "设为该类别的默认项", ar: "اجعله الافتراضي لهذه الفئة" },
  "hiddenFromQuotes":  { en: "It will be hidden from quotes.", zh: "将不会显示在报价中。", ar: "هيتخفي من عروض الأسعار." },
  "obsolete":          { en: "OBSOLETE",    zh: "已停用", ar: "متوقّف" },

  /* ── Market detail ── */
  "editMarket":        { en: "Edit Market", zh: "编辑市场", ar: "تعديل السوق" },
  "marketActions":     { en: "Market Actions", zh: "市场操作", ar: "إجراءات السوق" },
  "marketOverview":    { en: "Market Overview", zh: "市场概览", ar: "نظرة عامة على السوق" },
  "marketIdentityHint":{ en: "Core market identity and pricing context.", zh: "市场的核心身份与定价背景。", ar: "هوية السوق الأساسية وسياق التسعير." },
  "backToSegmentation":{ en: "Back to segmentation", zh: "返回分层", ar: "رجوع للتقسيم" },
  "customersInMarket": { en: "Customers in this Market", zh: "该市场的客户", ar: "عملاء هذا السوق" },
  "customersHint":     { en: "All customer accounts linked to this market.", zh: "关联到该市场的所有客户账户。", ar: "كل حسابات العملاء المرتبطة بالسوق ده." },
  "noCustomers":       { en: "No customers linked to this market.", zh: "该市场暂无关联客户。", ar: "مفيش عملاء مرتبطين بالسوق ده." },
  "viewCustomers":     { en: "View Customers", zh: "查看客户", ar: "عرض العملاء" },
  "totalSales":        { en: "Total Sales", zh: "销售总额", ar: "إجمالي المبيعات" },
  "avgOrderValue":     { en: "Average Order Value", zh: "平均订单金额", ar: "متوسط قيمة الطلب" },
  "futureAnalytics":   { en: "Future-Ready Analytics", zh: "面向未来的分析", ar: "تحليلات جاهزة للمستقبل" },
  "analyticsHint":     { en: "Activates once orders are linked to customers in this market.", zh: "当订单与该市场的客户关联后启用。", ar: "بتشتغل أول ما الطلبات تترّبط بعملاء السوق ده." },
  "notesHint":         { en: "Internal pricing remarks, market risk, and strategy notes.", zh: "内部定价备注、市场风险与策略说明。", ar: "ملاحظات تسعير داخلية ومخاطر السوق وملاحظات الاستراتيجية." },
  "noNotes":           { en: "No notes yet. Per-market notes storage is on the roadmap.", zh: "暂无备注。按市场存储备注在规划中。", ar: "مفيش ملاحظات لسه. تخزين ملاحظات لكل سوق في الخطة." },
  "noSettingsRow":     { en: "No settings row yet.", zh: "暂无设置记录。", ar: "مفيش سجل إعدادات لسه." },
  "region":            { en: "Region",    zh: "地区",   ar: "المنطقة" },
  "isoCode":           { en: "ISO code",  zh: "ISO 代码", ar: "كود ISO" },
  "dialCode":          { en: "Dial code", zh: "国际区号", ar: "مفتاح الاتصال" },

  /* Ternary-embedded strings — invisible to a >text< or prop scan; found by
     grepping for `? "Xxx" : "Yyy"` after the same pattern surfaced in the
     Price Calculator. */
  "saveChanges":       { en: "Save changes", zh: "\u4fdd\u5b58\u66f4\u6539", ar: "\u062d\u0641\u0638 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a" },
  "create":            { en: "Create", zh: "\u521b\u5efa", ar: "\u0625\u0646\u0634\u0627\u0621" },
  "sellerPays":        { en: "Seller pays", zh: "\u5356\u65b9\u627f\u62c5", ar: "\u0627\u0644\u0628\u0627\u0626\u0639 \u064a\u062f\u0641\u0639" },
  "buyerPays":         { en: "Buyer pays", zh: "\u4e70\u65b9\u627f\u62c5", ar: "\u0627\u0644\u0645\u0634\u062a\u0631\u064a \u064a\u062f\u0641\u0639" },

  /* ── Incoterms / payment / shipping attributes ── */
  "icc2010":           { en: "ICC 2010", zh: "ICC 2010", ar: "ICC 2010" },
  "icc2020":           { en: "ICC 2020", zh: "ICC 2020", ar: "ICC 2020" },
  "advance":           { en: "Advance",  zh: "预付",   ar: "مقدّم" },
  "bankMediated":      { en: "Bank-mediated", zh: "银行中介", ar: "عن طريق البنك" },
  "lcRequired":        { en: "L/C required", zh: "需信用证", ar: "يتطلّب اعتماد مستندي" },
  "customsRequired":   { en: "Customs required", zh: "需清关", ar: "يتطلّب تخليص جمركي" },
  "mandatoryExport":   { en: "Mandatory export", zh: "出口必备", ar: "إلزامي للتصدير" },
  "dgHazmat":          { en: "DG / hazmat", zh: "危险品", ar: "بضائع خطرة" },
  "refrigerated":      { en: "Refrigerated", zh: "冷藏", ar: "مبرّدة" },
  "oversized":         { en: "Oversized", zh: "超尺寸", ar: "أحجام كبيرة" },
  "carriers":          { en: "Carriers:", zh: "承运商：", ar: "الناقلون:" },
  "docs":              { en: "Docs:",     zh: "单证：",  ar: "المستندات:" },
  "riskPasses":        { en: "Risk passes:", zh: "风险转移：", ar: "انتقال المخاطر:" },
  "click":             { en: "Click",     zh: "点击",   ar: "اضغط" },
};
