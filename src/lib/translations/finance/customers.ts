import type { Translations } from "@/lib/i18n";

/* Finance — the `customers.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_CUSTOMERS: Translations = {
  /* ── Customers / Suppliers / Payments ──────────────────────────── */
  "customers.title":        { en: "Customer Accounts",            zh: "客户账户",                ar: "حسابات العملاء" },
  "customers.subtitle":     { en: "Revenue, money collected, and money still owed — for every customer you sell to.",
                              zh: "每个客户的收入、已收款及未收余额。",
                              ar: "الإيرادات والمحصّل والمتبقي على كل عميل تبيع له." },
  "customers.section.eyebrow":{ en: "Customer accounts",           zh: "客户账户",                ar: "حسابات العملاء" },
  "customers.section.title":{ en: "Total exposure across every customer",
                              zh: "全部客户的总敞口",
                              ar: "إجمالي الانكشاف على كل العملاء" },
  "customers.kpi.revenue":  { en: "Total Revenue",                 zh: "总收入",                  ar: "إجمالي الإيرادات" },
  "customers.kpi.outstanding":{en: "Outstanding",                  zh: "未收余额",                ar: "المتبقي" },
  "customers.kpi.collected":{ en: "Collected",                     zh: "已收款",                 ar: "المحصّل" },
  "customers.kpi.overdue":  { en: "Overdue",                       zh: "逾期",                   ar: "متأخر" },
  "customers.kpi.allCustomers":{en: "all customers",               zh: "全部客户",                ar: "كل العملاء" },
  "customers.kpi.toCollect":{ en: "still to collect",              zh: "尚未收回",                ar: "ما زال للتحصيل" },
  "customers.kpi.banked":   { en: "banked",                        zh: "已到账",                 ar: "أُودع" },
  "customers.kpi.pastDue":  { en: "past due",                      zh: "已过期",                 ar: "تجاوز الموعد" },
  "customers.loading":      { en: "Loading customers…",            zh: "正在加载客户…",            ar: "جارٍ تحميل العملاء…" },
  "customers.emptyTitle":   { en: "No customers yet",              zh: "暂无客户",                ar: "لا يوجد عملاء بعد" },
  "customers.emptyHint":    { en: "Customers appear here as soon as you create an order for them on the Orders page.",
                              zh: "在订单页面为客户创建订单后，他们将显示在此处。",
                              ar: "يظهر العملاء هنا حالما تُنشئ لهم طلبًا في صفحة الطلبات." },
  "customers.noTerms":      { en: "No payment terms set",          zh: "未设置付款条件",           ar: "لم تُحدَّد شروط دفع" },
  "customers.mini.revenue": { en: "Revenue",                       zh: "收入",                   ar: "الإيرادات" },
  "customers.mini.collected":{en: "Collected",                     zh: "已收",                   ar: "محصّل" },
  "customers.mini.outstanding":{en: "Outstanding",                 zh: "未收",                   ar: "متبقٍ" },
  "customers.collectionProgress":{en: "Collection progress",       zh: "回款进度",                ar: "تقدّم التحصيل" },
  "customers.overdueAmount":{ en: "{amt} overdue — past due date.",zh: "{amt} 已逾期 — 超过到期日。", ar: "{amt} متأخر — تجاوز موعد الاستحقاق." },
  "customers.generate":     { en: "Generate Account Statement",    zh: "生成账户报表",             ar: "إنشاء كشف حساب" },
  "customers.preparing":    { en: "Preparing…",                    zh: "正在准备…",               ar: "جارٍ الإعداد…" },
  "customers.exportFailed": { en: "Failed ({n})",                  zh: "失败 ({n})",              ar: "فشل ({n})" },
};
