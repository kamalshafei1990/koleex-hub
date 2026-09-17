import type { Translations } from "@/lib/i18n";

/* Finance — the `cf.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_CF: Translations = {
  /* ── Cash Flow (FinanceCashFlow.tsx) ─────────────────────────────── */
  "cf.from":                 { en: "From",            zh: "起始",        ar: "من" },
  "cf.to":                   { en: "To",              zh: "截止",        ar: "إلى" },
  "cf.opening":              { en: "Opening cash",    zh: "期初现金",    ar: "النقد الافتتاحي" },
  "cf.section.operating":    { en: "Operating activities", zh: "经营活动", ar: "الأنشطة التشغيلية" },
  "cf.section.investing":    { en: "Investing activities", zh: "投资活动", ar: "الأنشطة الاستثمارية" },
  "cf.section.financing":    { en: "Financing activities", zh: "筹资活动", ar: "الأنشطة التمويلية" },
  "cf.section.empty":        { en: "No activity in this section.",
                               zh: "此部分无活动。",
                               ar: "لا نشاط في هذا القسم." },
  "cf.net":                  { en: "Net change in cash", zh: "现金净变动", ar: "صافي التغير في النقد" },
  "cf.closing":              { en: "Closing cash",    zh: "期末现金",    ar: "النقد الختامي" },
  "cf.notReconciled":        { en: "Cash flow does not reconcile to the trial balance. Investigate posted lines that touch a cash account but aren't classified.",
                               zh: "现金流量未与试算平衡表对账，请核查涉及现金科目但尚未归类的已过账分录。",
                               ar: "التدفقات النقدية لا تتطابق مع ميزان المراجعة. تحقّق من البنود المرحَّلة التي تمس حسابًا نقديًا دون أن تُصنَّف." },
  "cf.method":               { en: "Method",          zh: "方法",        ar: "المنهجية" },
  "cf.method.body":          { en: "Each posted journal line that touches account 1000 or 1010 is classified by source type: payments and expenses are operating; opening-balance entries and lines whose contra side is equity or loans payable are financing; everything else flows to operating. Investing activity stays at zero until fixed-asset accounts are added in a later phase.",
                               zh: "每条涉及科目 1000 或 1010 的已过账分录按来源类型分类：付款与费用归为经营活动；期初余额分录以及对方科目为权益或应付贷款的分录归为筹资活动；其余均归入经营活动。在后续阶段加入固定资产科目之前，投资活动保持为零。",
                               ar: "كل بند يومية مرحَّل يمس الحساب 1000 أو 1010 يُصنَّف حسب نوع المصدر: المدفوعات والمصروفات تشغيلية؛ قيود الرصيد الافتتاحي والبنود التي يكون طرفها المقابل حقوق ملكية أو قروضًا واجبة السداد تُعدّ تمويلية؛ وما عدا ذلك يدخل ضمن التشغيلية. يبقى النشاط الاستثماري صفرًا إلى أن تُضاف حسابات الأصول الثابتة في مرحلة لاحقة." },
};
