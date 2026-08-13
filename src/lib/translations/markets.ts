import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Markets — the market directory and per-market profile.

   Had ZERO t() calls. The vocabulary is shared with Commercial Setup (this
   screen reads the same segmentation), so the same trade terms apply: a
   "band" is a market price band, and the band modifier percentages (A/B/C) are
   the ones the Price Calculator applies on top of the base.
   --------------------------------------------------------------------------- */

export const marketsT: Translations = {
  "title":            { en: "Markets",            zh: "市场",       ar: "الأسواق" },
  "directory":        { en: "Markets Directory",  zh: "市场目录",   ar: "دليل الأسواق" },
  "profile":          { en: "Market Profile",     zh: "市场档案",   ar: "ملف السوق" },
  "marketName":       { en: "Market Name",        zh: "市场名称",   ar: "اسم السوق" },
  "marketStatus":     { en: "Market Status",      zh: "市场状态",   ar: "حالة السوق" },
  "activeMarket":     { en: "Active Market",      zh: "启用的市场", ar: "سوق نشط" },
  "inPricingEngine":  { en: "Included in pricing engine calculations", zh: "纳入定价引擎计算", ar: "مشمول في حسابات محرّك التسعير" },

  /* Band classification */
  "bandClassification": { en: "Band Classification", zh: "档位分类", ar: "تصنيف النطاق" },
  "classification":   { en: "Classification",     zh: "分类",       ar: "التصنيف" },
  "band":             { en: "Band",               zh: "档位",       ar: "النطاق" },
  "bandA":            { en: "Band A",             zh: "档位 A",     ar: "النطاق A" },
  "bandB":            { en: "Band B",             zh: "档位 B",     ar: "النطاق B" },
  "bandC":            { en: "Band C",             zh: "档位 C",     ar: "النطاق C" },
  "adjustment":       { en: "Adjustment",         zh: "调整",       ar: "التعديل" },
  "emerging":         { en: "Emerging (-3%)",     zh: "新兴市场 (-3%)", ar: "ناشئ (-3%)" },

  /* Customers panel */
  "customersInMarket":{ en: "Accounts associated with this market", zh: "关联该市场的账户", ar: "الحسابات المرتبطة بالسوق ده" },
  "noCustomers":      { en: "No customers in this market yet", zh: "该市场暂无客户", ar: "مفيش عملاء في السوق ده لسه" },
  "customersAppear":  { en: "Customers will appear here when added to this market", zh: "客户加入该市场后将显示在这里", ar: "العملاء هيظهروا هنا أول ما يتضافوا للسوق ده" },
  "loadingCustomers": { en: "Loading customers…", zh: "正在加载客户…", ar: "جارٍ تحميل العملاء…" },
  "customerName":     { en: "Customer Name",      zh: "客户名称",   ar: "اسم العميل" },
  "company":          { en: "Company",            zh: "公司",       ar: "الشركة" },
  "email":            { en: "Email",              zh: "邮箱",       ar: "البريد الإلكتروني" },

  "noMarkets": { en: "No markets found", zh: "未找到市场", ar: "لا توجد أسواق" },
  "tryAdjusting": { en: "Try adjusting your search or filter", zh: "试试调整搜索或筛选", ar: "جرّب تعدّل البحث أو الفلتر" },
  "totalMarkets": { en: "Total Markets", zh: "市场总数", ar: "إجمالي الأسواق" },
  "priceAdjustment": { en: "Price Adjustment", zh: "价格调整", ar: "تعديل السعر" },
  "standard": { en: "Standard (0%)", zh: "标准 (0%)", ar: "قياسي (0%)" },
  "viewProfile": { en: "View Profile", zh: "查看档案", ar: "عرض الملف" },
  "phone": { en: "Phone", zh: "电话", ar: "الهاتف" },
  "status": { en: "Status", zh: "状态", ar: "الحالة" },
  "type": { en: "Type", zh: "类型", ar: "النوع" },

  /* Filters + actions */
  "allCountries":     { en: "All countries",      zh: "所有国家",   ar: "كل الدول" },
  "clear":            { en: "Clear",              zh: "清除",       ar: "مسح" },
  "clearFilter":      { en: "Clear filter",       zh: "清除筛选",   ar: "مسح الفلتر" },
  "action":           { en: "Action",             zh: "操作",       ar: "إجراء" },
};
