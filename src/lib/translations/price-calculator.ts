import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Price Calculator — the channel-pricing screen and its settings panel.

   Both files had ZERO t() calls, so the app rendered fully in English under
   Arabic and Chinese. 23 English strings were counted on screen with the Hub
   set to Arabic.

   Terminology note: this is the pricing surface fed by Commercial Setup (the
   pricing source of truth — bands + segmentation drive the numbers here), so
   the vocabulary has to match that domain rather than read as generic UI copy:
   "band" is a regional price band, "channel" is a customer channel, "margin"
   is profit margin, and "adjustment" is the country/band modifier applied on
   top of the base. Where a term already exists in another dictionary with the
   same meaning (Add, Category, Currency, Discount, Qty, Reset …) this file
   repeats the value rather than importing eight dictionaries — the same call
   made for every other per-app dictionary in the repo.
   --------------------------------------------------------------------------- */

export const priceCalcT: Translations = {
  /* ── Screen headers ── */
  "title":            { en: "Price Calculator", zh: "价格计算器", ar: "حاسبة الأسعار" },
  "subtitle":         { en: "Generate channel pricing with shipping-adjusted ERP logic", zh: "按运费调整的 ERP 逻辑生成渠道价格", ar: "احسب أسعار القنوات بمنطق ERP معدّل بالشحن" },
  "settings.title":   { en: "System Control Panel", zh: "系统控制面板", ar: "لوحة تحكم النظام" },
  "settings.subtitle":{ en: "Configure Pricing Rules, Margins & UI Visibility", zh: "配置定价规则、利润率与界面显示", ar: "اضبط قواعد التسعير والهوامش وإظهار الواجهة" },

  /* ── Exchange rate block ── */
  "fx.section":       { en: "Exchange Rate", zh: "汇率", ar: "سعر الصرف" },
  "fx.rate":          { en: "USD/CNY Rate", zh: "美元/人民币 汇率", ar: "سعر الدولار/اليوان" },
  "fx.live":          { en: "Live Rate", zh: "实时汇率", ar: "السعر الحيّ" },
  "fx.risk":          { en: "FX Risk", zh: "汇率风险", ar: "مخاطر الصرف" },
  "fx.scenario":      { en: "FX Risk Scenario", zh: "汇率风险情景", ar: "سيناريو مخاطر الصرف" },
  "fx.rise":          { en: "Expect USD to Rise", zh: "预期美元上涨", ar: "توقّع ارتفاع الدولار" },
  "fx.fall":          { en: "Expect USD to Fall", zh: "预期美元下跌", ar: "توقّع انخفاض الدولار" },
  "fx.stable":        { en: "Stable (No change)", zh: "稳定（无变化）", ar: "مستقرّ (بدون تغيير)" },

  /* ── Pricing configuration ── */
  "cfg.section":      { en: "Pricing Configuration", zh: "定价配置", ar: "إعدادات التسعير" },
  "cfg.productCategory": { en: "Product Category", zh: "产品类别", ar: "فئة المنتج" },
  "cfg.targetCountry":   { en: "Target Country", zh: "目标国家", ar: "الدولة المستهدفة" },
  "cfg.targetCustomer":  { en: "Target Customer Type", zh: "目标客户类型", ar: "نوع العميل المستهدف" },
  "cfg.countryAdjustment": { en: "Country adjustment:", zh: "国家调整：", ar: "تعديل الدولة:" },
  "cfg.adjustments":  { en: "Adjustments", zh: "调整项", ar: "التعديلات" },
  "cfg.channel":      { en: "Channel", zh: "渠道", ar: "القناة" },
  "cfg.generate":     { en: "Generate Price", zh: "生成价格", ar: "احسب السعر" },

  /* ── Override / discount ── */
  "ovr.type":         { en: "Override Type", zh: "覆盖方式", ar: "نوع التجاوز" },
  "ovr.byPercentage": { en: "By Percentage", zh: "按百分比", ar: "بنسبة مئوية" },
  "ovr.byAmount":     { en: "By Amount USD", zh: "按金额（美元）", ar: "بمبلغ بالدولار" },
  "ovr.autoDetect":   { en: "Auto-Detect (Smart Margin)", zh: "自动检测（智能利润率）", ar: "كشف تلقائي (هامش ذكي)" },
  "ovr.overrideMargin": { en: "Override Default Profit Margin", zh: "覆盖默认利润率", ar: "تجاوز هامش الربح الافتراضي" },
  "ovr.manualDiscount": { en: "Manual Discount", zh: "手动折扣", ar: "خصم يدوي" },

  /* ── Result rows ── */
  "res.costCNY":      { en: "Cost CNY", zh: "成本（人民币）", ar: "التكلفة باليوان" },
  "res.costUSD":      { en: "Cost USD", zh: "成本（美元）", ar: "التكلفة بالدولار" },
  "res.initialBase":  { en: "Initial Base", zh: "初始基价", ar: "الأساس المبدئي" },
  "res.afterCountry": { en: "After Country", zh: "国家调整后", ar: "بعد تعديل الدولة" },
  "res.countryAdj":   { en: "Country Adj.", zh: "国家调整", ar: "تعديل الدولة" },
  "res.adjPct":       { en: "Adj %", zh: "调整 %", ar: "نسبة التعديل" },
  "res.finalBase":    { en: "Final Base", zh: "最终基价", ar: "الأساس النهائي" },
  "res.finalBasePrice": { en: "Final Base Price", zh: "最终基础价格", ar: "السعر الأساسي النهائي" },
  "res.marginUSD":    { en: "Margin USD", zh: "利润（美元）", ar: "الهامش بالدولار" },
  "res.profit":       { en: "Profit", zh: "利润", ar: "الربح" },
  "res.totalProfit":  { en: "Total Profit", zh: "总利润", ar: "إجمالي الربح" },
  "res.grandTotal":   { en: "Grand Total", zh: "总计", ar: "الإجمالي الكلي" },
  "res.grandTotalPricing": { en: "Grand Total Pricing", zh: "总计定价", ar: "إجمالي التسعير" },
  "res.target":       { en: "Target", zh: "目标", ar: "المستهدف" },

  /* ── Quotation ── */
  "quo.details":      { en: "Quotation Details", zh: "报价明细", ar: "تفاصيل عرض السعر" },
  "quo.none":         { en: "No Quotation Yet", zh: "暂无报价", ar: "لا يوجد عرض سعر بعد" },

  /* ── Settings panel ── */
  "set.categoryMargins": { en: "Product Category Margin Levels", zh: "产品类别利润率档位", ar: "مستويات هامش فئات المنتجات" },
  "set.channelMargins":  { en: "Customer Channels Margin Setup", zh: "客户渠道利润率设置", ar: "إعداد هوامش قنوات العملاء" },
  "set.countriesBands":  { en: "Countries & Regional Bands", zh: "国家与区域档位", ar: "الدول والنطاقات الإقليمية" },
  "set.bandModifiers":   { en: "Regional Band Modifiers", zh: "区域档位调整系数", ar: "معاملات النطاقات الإقليمية" },
  "set.globalLimits":    { en: "Global Limits & Defaults", zh: "全局限制与默认值", ar: "الحدود والافتراضيات العامة" },
  "set.uiVisibility":    { en: "UI Visibility & Features", zh: "界面显示与功能", ar: "إظهار الواجهة والمزايا" },
  "set.maxDiscount":     { en: "Max Allowed Manual Discount (%)", zh: "允许的最大手动折扣 (%)", ar: "أقصى خصم يدوي مسموح (%)" },
  "set.taxRefund":       { en: "Default Tax Refund Rate (%)", zh: "默认退税率 (%)", ar: "نسبة رد الضريبة الافتراضية (%)" },
  "set.minCost":         { en: "Min Cost (CNY)", zh: "最低成本（人民币）", ar: "أدنى تكلفة (يوان)" },
  "set.maxCost":         { en: "Max Cost (CNY)", zh: "最高成本（人民币）", ar: "أقصى تكلفة (يوان)" },
  "set.searchCountries": { en: "Search countries…", zh: "搜索国家…", ar: "ابحث عن دولة…" },
  "set.bandA":           { en: "Band A", zh: "档位 A", ar: "النطاق A" },
  "set.bandB":           { en: "Band B", zh: "档位 B", ar: "النطاق B" },
  "set.bandC":           { en: "Band C", zh: "档位 C", ar: "النطاق C" },

  /* Caught on the second pass — the first sweep's word-shape pattern missed
     these because they are short single words sitting alone in a cell. */
  "settingsLink":  { en: "Settings",   zh: "\u8bbe\u7f6e",     ar: "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a" },
  "taxRefund":     { en: "Tax Refund", zh: "\u9000\u7a0e",     ar: "\u0631\u062f \u0627\u0644\u0636\u0631\u064a\u0628\u0629" },
  "total":         { en: "Total",      zh: "\u5408\u8ba1",     ar: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a" },
  "unit":          { en: "Unit",       zh: "\u5355\u4f4d",     ar: "\u0627\u0644\u0648\u062d\u062f\u0629" },
  "unitPrice":     { en: "Unit Price", zh: "\u5355\u4ef7",     ar: "\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629" },
  "value":         { en: "Value",      zh: "\u91d1\u989d",     ar: "\u0627\u0644\u0642\u064a\u0645\u0629" },

  /* Two more patterns, found only by reading the RENDERED page in Arabic:
     · a string inside a ternary  -> {cond ? "Fetching..." : "Live Rate"}
     · a string glued to an expression -> Include Tax Refund ({n}%)
     Neither is reachable by a >text< or prop scan. The tax-refund label is
     keyed as a whole sentence with a {pct} slot so ar/zh can reorder it. */
  "fx.fetching":     { en: "Fetching\u2026", zh: "\u83b7\u53d6\u4e2d\u2026", ar: "\u062c\u0627\u0631\u064d \u0627\u0644\u062c\u0644\u0628\u2026" },
  "includeTaxRefund":{ en: "Include Tax Refund ({pct}%)", zh: "\u5305\u542b\u9000\u7a0e\uff08{pct}%\uff09", ar: "\u0634\u0627\u0645\u0644 \u0631\u062f \u0627\u0644\u0636\u0631\u064a\u0628\u0629 ({pct}%)" },

  /* Section titles held in a config array (pattern 8). */
  "set.secUiVisibility":  { en: "UI Visibility", zh: "\u754c\u9762\u663e\u793a", ar: "\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0648\u0627\u062c\u0647\u0629" },
  "set.secLimits":        { en: "Limits & Defaults", zh: "\u9650\u5236\u4e0e\u9ed8\u8ba4\u503c", ar: "\u0627\u0644\u062d\u062f\u0648\u062f \u0648\u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0627\u062a" },
  "set.secChannels":      { en: "Customer Channels", zh: "\u5ba2\u6237\u6e20\u9053", ar: "\u0642\u0646\u0648\u0627\u062a \u0627\u0644\u0639\u0645\u0644\u0627\u0621" },
  "set.secCountries":     { en: "Countries & Bands", zh: "\u56fd\u5bb6\u4e0e\u6863\u4f4d", ar: "\u0627\u0644\u062f\u0648\u0644 \u0648\u0627\u0644\u0646\u0637\u0627\u0642\u0627\u062a" },
  "set.secCategories":    { en: "Product Categories", zh: "\u4ea7\u54c1\u7c7b\u522b", ar: "\u0641\u0626\u0627\u062a \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a" },
  "act.copy":             { en: "Copy", zh: "\u590d\u5236", ar: "\u0646\u0633\u062e" },
  "act.exportPdf":        { en: "Export PDF", zh: "\u5bfc\u51fa PDF", ar: "\u062a\u0635\u062f\u064a\u0631 PDF" },
  "act.print":            { en: "Print", zh: "\u6253\u5370", ar: "\u0637\u0628\u0627\u0639\u0629" },
  "act.share":            { en: "Share", zh: "\u5206\u4eab", ar: "\u0645\u0634\u0627\u0631\u0643\u0629" },
  "ch.agent":             { en: "Agent", zh: "\u4ee3\u7406", ar: "\u0648\u0643\u064a\u0644" },
  "ch.distributor":       { en: "Distributor", zh: "\u7ecf\u9500\u5546", ar: "\u0645\u0648\u0632\u0651\u0639" },
  "ch.dealer":            { en: "Dealer", zh: "\u7ecf\u9500\u5546\uff08\u96f6\u552e\uff09", ar: "\u062a\u0627\u062c\u0631" },
  "ch.endUser":           { en: "End-User", zh: "\u6700\u7ec8\u7528\u6237", ar: "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u0646\u0647\u0627\u0626\u064a" },
  "ch.basePrice":         { en: "Base Price", zh: "\u57fa\u7840\u4ef7", ar: "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0623\u0633\u0627\u0633\u064a" },
  "ch.baseFob":           { en: "Base FOB", zh: "\u57fa\u7840 FOB", ar: "\u0623\u0633\u0627\u0633 FOB" },

  /* ── Shared vocabulary (repeated from other dictionaries on purpose) ── */
  "add":              { en: "Add",           zh: "添加",   ar: "إضافة" },
  "reset":            { en: "Reset",         zh: "重置",   ar: "إعادة تعيين" },
  "band":             { en: "Band",          zh: "档位",   ar: "النطاق" },
  "category":         { en: "Category",      zh: "类别",   ar: "الفئة" },
  "categoryName":     { en: "Category name", zh: "类别名称", ar: "اسم الفئة" },
  "productName":      { en: "Product name",  zh: "产品名称", ar: "اسم المنتج" },
  "code":             { en: "Code",          zh: "编码",   ar: "الكود" },
  "cost":             { en: "Cost",          zh: "成本",   ar: "التكلفة" },
  "country":          { en: "Country",       zh: "国家",   ar: "الدولة" },
  "currency":         { en: "Currency",      zh: "货币",   ar: "العملة" },
  "discount":         { en: "Discount",      zh: "折扣",   ar: "الخصم" },
  "marginPct":        { en: "Margin (%)",    zh: "利润率 (%)", ar: "الهامش (%)" },
  "products":         { en: "Products",      zh: "产品",   ar: "المنتجات" },
  "qty":              { en: "Qty",           zh: "数量",   ar: "الكمية" },
};
