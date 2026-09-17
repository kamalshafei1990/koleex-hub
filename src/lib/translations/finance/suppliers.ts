import type { Translations } from "@/lib/i18n";

/* Finance — the `suppliers.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_SUPPLIERS: Translations = {
  "suppliers.title":        { en: "Supplier Accounts",            zh: "供应商账户",              ar: "حسابات الموردين" },
  "suppliers.subtitle":     { en: "What you've bought from each supplier, what's paid, and what's still owed.",
                              zh: "您从每个供应商处采购的明细、已付款及未付款余额。",
                              ar: "ماذا اشتريت من كل مورد، وما المدفوع، وما المتبقي." },
  "suppliers.section.eyebrow":   { en: "Supplier accounts",         zh: "供应商账户",              ar: "حسابات الموردين" },
  "suppliers.section.title":     { en: "Total exposure across every supplier",
                                   zh: "全部供应商的总敞口",
                                   ar: "إجمالي الانكشاف على كل الموردين" },
  "suppliers.kpi.purchases":     { en: "Total Purchases",           zh: "总采购额",               ar: "إجمالي المشتريات" },
  "suppliers.kpi.outstanding":   { en: "Outstanding",               zh: "未付余额",               ar: "المتبقي" },
  "suppliers.kpi.paid":          { en: "Paid",                      zh: "已支付",                ar: "مدفوع" },
  "suppliers.kpi.allSuppliers":  { en: "all suppliers",             zh: "全部供应商",              ar: "كل الموردين" },
  "suppliers.kpi.toPay":         { en: "still to pay",              zh: "尚未支付",               ar: "ما زال للدفع" },
  "suppliers.kpi.wired":         { en: "already wired",             zh: "已转账",                 ar: "تم تحويله" },
  "suppliers.loading":           { en: "Loading suppliers…",        zh: "正在加载供应商…",         ar: "جارٍ تحميل الموردين…" },
  "suppliers.emptyTitle":        { en: "No suppliers yet",          zh: "暂无供应商",              ar: "لا يوجد موردون بعد" },
  "suppliers.emptyHint":         { en: "Suppliers appear here as soon as you add supplier costs to an order or link a supplier to an expense.",
                                   zh: "当您将供应商成本添加到订单或将供应商关联到费用时，他们将显示在此处。",
                                   ar: "يظهر الموردون هنا حالما تُضيف تكلفة مورد لطلب أو تربط موردًا بمصروف." },
  "suppliers.noTerms":           { en: "No payment terms set",      zh: "未设置付款条件",           ar: "لم تُحدَّد شروط دفع" },
  "suppliers.mini.purchases":    { en: "Purchases",                 zh: "采购",                   ar: "المشتريات" },
  "suppliers.mini.paid":         { en: "Paid",                      zh: "已付",                   ar: "مدفوع" },
  "suppliers.mini.toPay":        { en: "To pay",                    zh: "应付",                   ar: "للدفع" },
  "suppliers.paymentProgress":   { en: "Payment progress",          zh: "付款进度",               ar: "تقدّم الدفع" },
  "suppliers.generate":          { en: "Generate Supplier Statement", zh: "生成供应商对账单",       ar: "إنشاء كشف مورد" },
  "suppliers.preparing":         { en: "Preparing…",                zh: "正在准备…",               ar: "جارٍ الإعداد…" },
  "suppliers.exportFailed":      { en: "Failed ({n})",              zh: "失败 ({n})",              ar: "فشل ({n})" },
};
