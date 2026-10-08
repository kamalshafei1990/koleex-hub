import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the executive templates (Phase 5D). */
const SUMMARY_HINT = {
  en: "Koleex AI can write it from what the departments sent; read it and correct it before you send.",
  zh: "Koleex AI 可根据各部门提交的报告撰写；发送前请阅读并修改。",
  ar: "Koleex AI يقدر يكتبه من اللي الأقسام بعتته؛ اقراه وصلّحه قبل ما تبعت.",
};
const SALES = { en: "Sales", zh: "销售", ar: "المبيعات" };
const MONEY = { en: "Money in", zh: "收款", ar: "الفلوس اللي دخلت" };
const STOCK = { en: "Stock", zh: "库存", ar: "المخزن" };
const RISKS = { en: "Risks and problems", zh: "风险与问题", ar: "المخاطر والمشاكل" };
const RISKS_HINT = { en: "One per line — what could go wrong, and who is on it.", zh: "每行一项——可能出什么问题，由谁负责。", ar: "واحدة في كل سطر — إيه اللي ممكن يبوظ، ومين ماسكه." };
const DECISIONS = { en: "Decisions needed from you", zh: "需要你做的决定", ar: "قرارات محتاجاك" };
const DECISIONS_HINT = { en: "One per line — what, the options, and by when.", zh: "每行一项——什么事、有哪些选择、何时之前。", ar: "واحد في كل سطر — إيه هو، والاختيارات، ولحد إمتى." };

const words: Translations = {
  "tpl.exec_weekly.s.summary": { en: "The week in short", zh: "本周概要", ar: "الأسبوع باختصار" },
  "tpl.exec_weekly.s.summary.hint": SUMMARY_HINT,
  "tpl.exec_weekly.s.reports": { en: "What the departments sent", zh: "各部门提交的报告", ar: "الأقسام بعتت إيه" },
  "tpl.exec_weekly.s.sales": SALES,
  "tpl.exec_weekly.s.money": MONEY,
  "tpl.exec_weekly.s.stock": STOCK,
  "tpl.exec_weekly.s.attendance": { en: "Attendance", zh: "考勤", ar: "الحضور" },
  "tpl.exec_weekly.s.wins": { en: "Wins", zh: "成绩", ar: "اللي اتحقق" },
  "tpl.exec_weekly.s.wins.hint": { en: "One per line — what went well this week.", zh: "每行一项——本周进展顺利的事。", ar: "واحدة في كل سطر — إيه اللي مشي كويس الأسبوع ده." },
  "tpl.exec_weekly.s.risks": RISKS,
  "tpl.exec_weekly.s.risks.hint": RISKS_HINT,
  "tpl.exec_weekly.s.decisions": DECISIONS,
  "tpl.exec_weekly.s.decisions.hint": DECISIONS_HINT,

  "tpl.exec_dept_kpis.s.kpis": { en: "Each department's numbers", zh: "各部门指标", ar: "أرقام كل قسم" },
  "tpl.exec_dept_kpis.s.summary": { en: "What the numbers say", zh: "数据说明了什么", ar: "الأرقام بتقول إيه" },
  "tpl.exec_dept_kpis.s.summary.hint": { en: "Which department is doing well, which needs help, and why.", zh: "哪个部门表现好，哪个需要帮助，原因是什么。", ar: "أنهي قسم ماشي كويس، وأنهي محتاج مساعدة، وليه." },
  "tpl.exec_dept_kpis.s.actions": { en: "What each department will do", zh: "各部门的改进措施", ar: "كل قسم هيعمل إيه" },
  "tpl.exec_dept_kpis.s.actions.hint": { en: "One per line — the department, the action, and who owns it.", zh: "每行一项——部门、措施和负责人。", ar: "واحد في كل سطر — القسم، والإجراء، ومين المسؤول." },

  "tpl.exec_monthly_review.s.summary": { en: "The month in short", zh: "本月概要", ar: "الشهر باختصار" },
  "tpl.exec_monthly_review.s.summary.hint": SUMMARY_HINT,
  "tpl.exec_monthly_review.s.sales": SALES,
  "tpl.exec_monthly_review.s.money": MONEY,
  "tpl.exec_monthly_review.s.pl": { en: "Profit and loss", zh: "损益", ar: "الأرباح والخسائر" },
  "tpl.exec_monthly_review.s.people": { en: "People", zh: "人员", ar: "الناس" },
  "tpl.exec_monthly_review.s.stock": STOCK,
  "tpl.exec_monthly_review.s.highlights": { en: "The month by area", zh: "各领域本月情况", ar: "الشهر في كل مجال" },
  "tpl.exec_monthly_review.s.highlights.hint": { en: "One per line — sales, operations, finance, people: what happened.", zh: "每行一项——销售、运营、财务、人员：发生了什么。", ar: "واحد في كل سطر — المبيعات، التشغيل، المالية، الناس: إيه اللي حصل." },
  "tpl.exec_monthly_review.s.risks": RISKS,
  "tpl.exec_monthly_review.s.risks.hint": RISKS_HINT,
  "tpl.exec_monthly_review.s.priorities": { en: "Next month's priorities", zh: "下月重点", ar: "أولويات الشهر الجاي" },
  "tpl.exec_monthly_review.s.priorities.hint": { en: "One per line — at most five.", zh: "每行一项——最多五项。", ar: "واحدة في كل سطر — خمسة بالكتير." },
  "tpl.exec_monthly_review.s.decisions": DECISIONS,
  "tpl.exec_monthly_review.s.decisions.hint": DECISIONS_HINT,
};

export default words;
