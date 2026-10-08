/* Finance — chart-of-accounts display names.

   ⚠️ IN ITS OWN FILE ON PURPOSE. `translateAccountName` used to live beside
   `financeT`, so the three accounting screens that need it imported the module
   that spreads all 51 namespaces — pulling the entire 287 KB dictionary back
   onto exactly the routes the split was meant to lighten. A helper must not be
   a doorway to a barrel. */
import type { Lang } from "@/lib/i18n";

export const ACCOUNT_NAME_OVERRIDES: Record<string, { en: string; zh: string; ar: string }> = {
  "1000": { en: "Cash on Hand",          zh: "库存现金",         ar: "النقد في الصندوق" },
  "1010": { en: "Bank — Operating",      zh: "银行 — 经营账户",  ar: "البنك — التشغيل" },
  "1100": { en: "Accounts Receivable",   zh: "应收账款",         ar: "الذمم المدينة" },
  "1200": { en: "Inventory Clearing",    zh: "存货清算",         ar: "تسوية المخزون" },
  "1300": { en: "Prepaid Expenses",      zh: "预付费用",         ar: "المصروفات المدفوعة مقدّمًا" },
  "1400": { en: "Inventory Asset",       zh: "存货资产",         ar: "أصل المخزون" },
  "1500": { en: "Fixed Assets",          zh: "固定资产",         ar: "الأصول الثابتة" },
  "1900": { en: "Other Current Assets",  zh: "其他流动资产",      ar: "أصول متداولة أخرى" },
  "2000": { en: "Accounts Payable",      zh: "应付账款",         ar: "الذمم الدائنة" },
  "2100": { en: "Loans Payable",         zh: "应付贷款",         ar: "القروض الواجبة السداد" },
  "2200": { en: "Taxes Payable",         zh: "应付税金",         ar: "الضرائب المستحقة الدفع" },
  "2300": { en: "Accrued Expenses",      zh: "应计费用",         ar: "المصروفات المستحقة" },
  "3000": { en: "Owner Capital",         zh: "所有者资本",       ar: "رأس مال المالك" },
  "3100": { en: "Retained Earnings",     zh: "留存收益",         ar: "الأرباح المحتجزة" },
  "3200": { en: "Drawings",              zh: "提取/分红",         ar: "السحوبات" },
  "4000": { en: "Sales Revenue",         zh: "销售收入",         ar: "إيرادات المبيعات" },
  "4100": { en: "Service Revenue",       zh: "服务收入",         ar: "إيرادات الخدمات" },
  "4200": { en: "Other Revenue",         zh: "其他收入",         ar: "إيرادات أخرى" },
  "4900": { en: "Sales Returns",         zh: "销售退货",         ar: "مردودات المبيعات" },
  "5000": { en: "Cost of Sales",         zh: "销售成本",         ar: "تكلفة المبيعات" },
  "5010": { en: "Freight & Shipping",    zh: "运费与物流",       ar: "الشحن والنقل" },
  "5020": { en: "Customs & Duties",      zh: "海关与关税",       ar: "الجمارك والرسوم" },
  "5100": { en: "Salaries & Wages",      zh: "薪资与工资",       ar: "الرواتب والأجور" },
  "5110": { en: "Employee Benefits",     zh: "员工福利",         ar: "مزايا الموظفين" },
  "5200": { en: "Rent",                  zh: "租金",            ar: "الإيجار" },
  "5210": { en: "Utilities",             zh: "水电费",           ar: "المرافق" },
  "5300": { en: "Marketing & Advertising", zh: "市场与广告",     ar: "التسويق والإعلان" },
  "5400": { en: "Office Supplies",       zh: "办公用品",         ar: "اللوازم المكتبية" },
  "5500": { en: "Travel & Entertainment", zh: "差旅与招待",      ar: "السفر والضيافة" },
  "5600": { en: "Professional Fees",     zh: "专业服务费",       ar: "أتعاب مهنية" },
  "5700": { en: "Bank Charges",          zh: "银行费用",         ar: "رسوم بنكية" },
  "5800": { en: "Depreciation",          zh: "折旧",            ar: "الإهلاك" },
  "5900": { en: "Other Operating Expenses", zh: "其他营业费用",  ar: "مصروفات تشغيلية أخرى" },
  "6000": { en: "Interest Expense",      zh: "利息费用",         ar: "مصروفات الفوائد" },
  "6100": { en: "FX Gain/Loss",          zh: "汇兑损益",         ar: "أرباح/خسائر صرف" },
  "7000": { en: "Income Tax Expense",    zh: "所得税费用",       ar: "مصروف ضريبة الدخل" },
};

export function translateAccountName(code: string | null | undefined, fallback: string, lang: Lang): string {
  if (!code) return fallback;
  const o = ACCOUNT_NAME_OVERRIDES[code];
  if (!o) return fallback;
  return lang === "zh" ? o.zh : lang === "ar" ? o.ar : o.en;
}
