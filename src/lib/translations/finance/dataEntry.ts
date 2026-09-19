import type { Translations } from "@/lib/i18n";

/* Finance — the `dataEntry.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_DATAENTRY: Translations = {
  /* ── Data Entry hub (/finance/data-entry) ──────────────────────── */
  "dataEntry.title":        { en: "Data Entry",                                                  zh: "数据录入",        ar: "إدخال البيانات" },
  "dataEntry.subtitle":     { en: "Where to put your finance data — manually, by hand",          zh: "在哪里手动录入您的财务数据",      ar: "أين تُدخل بياناتك المالية — يدويًا" },
  "dataEntry.setupProgress":{ en: "Setup progress",                                              zh: "设置进度",         ar: "تقدّم الإعداد" },
  "dataEntry.lead":         { en: "Yes — every finance number can be entered manually. Two routes below: ",
                              zh: "是的 — 每一项财务数据都可手动录入。下面有两条路径：",
                              ar: "نعم — يمكن إدخال كل رقم مالي يدويًا. مساران أدناه:" },
  "dataEntry.lead.starting":{ en: "starting data",          zh: "起始数据",       ar: "بيانات البداية" },
  "dataEntry.lead.and":     { en: " for first-time loading, and ", zh: "用于首次录入，以及 ", ar: " للتحميل لأول مرة، و" },
  "dataEntry.lead.daily":   { en: "day-to-day entries",     zh: "日常录入",       ar: "إدخالات يومية" },
  "dataEntry.lead.tail":    { en: " for ongoing transactions. Click any row to open the form.",
                              zh: "用于持续交易。点击任意一行以打开表单。",
                              ar: " للمعاملات المستمرة. اضغط على أي صف لفتح النموذج." },

  "dataEntry.section.starting":   { en: "① Starting Data · one-time",  zh: "① 起始数据 · 一次性",    ar: "① بيانات البداية · لمرة واحدة" },
  "dataEntry.openSetup":          { en: "Open Finance Setup →",        zh: "打开财务设置 →",         ar: "فتح إعداد المالية ←" },
  "dataEntry.startingFootnote":   { en: "You only enter starting data once — when you first set up the company in Koleex. The system uses it as the day-zero snapshot.",
                                    zh: "起始数据只需录入一次 — 在首次于 Koleex 设置公司时录入。系统将其作为第零天的快照。",
                                    ar: "أنت تُدخل بيانات البداية مرة واحدة فقط — عند تأسيس الشركة في Koleex لأول مرة. يستخدمها النظام كصورة اللحظة صفر." },
  "dataEntry.section.daily":      { en: "② Day-to-Day Entries · ongoing", zh: "② 日常录入 · 持续",    ar: "② إدخالات يومية · مستمرة" },
  "dataEntry.openAllCreate":      { en: "Open all create flows →",     zh: "打开所有创建流程 →",       ar: "فتح كل تدفقات الإنشاء ←" },
  "dataEntry.dailyFootnote":      { en: "These you enter as the company operates — every day, every week. Each one feeds straight into the books, AR/AP balances, and statements.",
                                    zh: "这些是公司运营时不断录入的项目 — 每天、每周。每一项都会直接进入账簿、应收/应付余额和报表。",
                                    ar: "هذه تُدخلها مع تشغيل الشركة — كل يوم، كل أسبوع. تتدفّق مباشرة إلى الدفاتر وأرصدة AR/AP والقوائم." },

  "dataEntry.tier.required":    { en: "Required",                                                zh: "必需",        ar: "مطلوب" },
  "dataEntry.tier.recommended": { en: "Recommended",                                             zh: "推荐",        ar: "موصى به" },
  "dataEntry.tier.optional":    { en: "Optional",                                                zh: "可选",        ar: "اختياري" },
};
