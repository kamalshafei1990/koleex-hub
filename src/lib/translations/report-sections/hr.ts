import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the HR templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.hr_incident.s.what": { en: "What happened", zh: "发生了什么", ar: "إيه اللي حصل" },
  "tpl.hr_incident.s.where_when": { en: "Where and when", zh: "地点和时间", ar: "فين وإمتى" },
  "tpl.hr_incident.s.people": { en: "People involved", zh: "相关人员", ar: "الأشخاص" },
  "tpl.hr_incident.s.action": { en: "What was done", zh: "已采取的措施", ar: "اتعمل إيه" },
  "tpl.hr_grievance.s.subject": { en: "Subject", zh: "主题", ar: "الموضوع" },
  "tpl.hr_grievance.s.details": { en: "Details", zh: "详情", ar: "التفاصيل" },
  "tpl.hr_grievance.s.wanted": { en: "What you would like to happen", zh: "你希望的处理方式", ar: "عايز إيه يحصل" },
  "tpl.hr_warning.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.hr_warning.s.incident": { en: "What happened", zh: "发生了什么", ar: "إيه اللي حصل" },
  "tpl.hr_warning.s.rule": { en: "Rule or policy", zh: "违反的规定", ar: "القاعدة أو السياسة" },
  "tpl.hr_warning.s.action": { en: "Action and next step", zh: "处理及后续", ar: "الإجراء والخطوة الجاية" },
  "tpl.hr_exit_interview.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.hr_exit_interview.s.reasons": { en: "Reasons for leaving", zh: "离职原因", ar: "أسباب المشي" },
  "tpl.hr_exit_interview.s.liked": { en: "What they liked", zh: "喜欢的方面", ar: "اللي كان عاجبه" },
  "tpl.hr_exit_interview.s.improve": { en: "What we should improve", zh: "需要改进的地方", ar: "اللي نحسنه" },
  "tpl.hr_exit_interview.s.return": { en: "Would they come back?", zh: "是否愿意回来？", ar: "ممكن يرجع؟" },
  "tpl.probation_review.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.probation_review.s.performance": { en: "How they did", zh: "工作表现", ar: "أداؤه كان عامل إزاي" },
  "tpl.probation_review.s.strengths": { en: "Strengths", zh: "优点", ar: "نقاط القوة" },
  "tpl.probation_review.s.concerns": { en: "Concerns", zh: "需要改进之处", ar: "ملاحظات أو مخاوف" },
  "tpl.probation_review.s.recommendation": { en: "Recommendation: confirm, extend or end", zh: "建议：转正、延长或终止", ar: "رأيك: تثبيت، تمديد، ولا إنهاء" },
};

export default words;
