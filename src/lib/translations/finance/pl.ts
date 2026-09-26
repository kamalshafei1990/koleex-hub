import type { Translations } from "@/lib/i18n";

/* Finance — the `pl.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_PL: Translations = {
  /* ── Profit & Loss (FinanceProfitLoss.tsx) ───────────────────────── */
  "pl.locked":               { en: "The profit and loss opens with «Bank & Profit» in Roles & Permissions.",
                               zh: "损益表需要在角色与权限中拥有「Bank & Profit」才能查看。",
                               ar: "الأرباح والخسائر تُفتح مع «Bank & Profit» في الأدوار والصلاحيات." },
  "pl.compare":              { en: "Compare to prior period", zh: "与上期对比", ar: "قارن بالفترة السابقة" },
  "pl.from":                 { en: "From",            zh: "起始",        ar: "من" },
  "pl.to":                   { en: "To",              zh: "截止",        ar: "إلى" },
  "pl.col.section":          { en: "Section",         zh: "分组",        ar: "القسم" },
  "pl.col.current":          { en: "Current",         zh: "本期",        ar: "الحالي" },
  "pl.col.prior":            { en: "Prior",           zh: "上期",        ar: "السابق" },
  "pl.col.delta":            { en: "Δ",               zh: "Δ",            ar: "Δ" },
  "pl.col.deltaPct":         { en: "Δ %",             zh: "Δ %",          ar: "Δ %" },
  "pl.col.ofRevenue":        { en: "% of revenue",    zh: "占收入 %",     ar: "% من الإيراد" },
  "pl.section.revenue":      { en: "Revenue",         zh: "收入",        ar: "الإيرادات" },
  "pl.section.cos":          { en: "Cost of sales",   zh: "销售成本",    ar: "تكلفة المبيعات" },
  "pl.section.opex":         { en: "Operating expenses", zh: "营业费用",  ar: "المصروفات التشغيلية" },
  "pl.row.totalRevenue":     { en: "Total revenue",   zh: "总收入",      ar: "إجمالي الإيرادات" },
  "pl.row.totalCos":         { en: "Total cost of sales", zh: "总销售成本", ar: "إجمالي تكلفة المبيعات" },
  "pl.row.totalOpex":        { en: "Total operating expenses", zh: "总营业费用", ar: "إجمالي المصروفات التشغيلية" },
  "pl.row.total":            { en: "Total {section}", zh: "总计 {section}", ar: "إجمالي {section}" },
  "pl.row.grossProfit":      { en: "Gross profit",    zh: "毛利润",      ar: "إجمالي الربح" },
  "pl.row.opProfit":         { en: "Operating profit", zh: "营业利润",   ar: "الربح التشغيلي" },
  "pl.row.netProfit":        { en: "Net profit",      zh: "净利润",      ar: "صافي الربح" },
  "pl.method":               { en: "Method",          zh: "方法",        ar: "المنهجية" },
  "pl.method.body":          { en: "Revenue is the net credit on accounts 4000-4999. Cost of sales captures direct costs (freight, customs). Operating expenses cover everything else in the 5xxx range. Net profit currently equals operating profit; tax + financial-charges entries flow through operating expenses until the dedicated tax engine ships.",
                               zh: "收入为 4000-4999 科目的净贷方金额。销售成本涵盖直接成本（运费、关税）。营业费用包括 5xxx 系列其余所有项目。在专用税务引擎上线前，税金及财务费用计入营业费用，因此净利润目前等于营业利润。",
                               ar: "الإيراد هو صافي الدائن على الحسابات 4000-4999. تشمل تكلفة المبيعات التكاليف المباشرة (الشحن والجمارك). تغطي المصروفات التشغيلية بقية الفئة 5xxx. صافي الربح يساوي حاليًا الربح التشغيلي؛ تمر قيود الضرائب والرسوم المالية عبر المصروفات التشغيلية إلى أن يُطرح محرك الضرائب المخصص." },
};
