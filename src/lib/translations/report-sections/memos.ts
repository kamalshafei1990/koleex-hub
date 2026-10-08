import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Memos templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.decision_memo.s.background": { en: "Background", zh: "背景", ar: "الخلفية" },
  "tpl.decision_memo.s.options": { en: "Options", zh: "选项", ar: "الخيارات" },
  "tpl.decision_memo.s.recommendation": { en: "Recommendation", zh: "建议", ar: "التوصية" },
  "tpl.decision_memo.s.deadline": { en: "Decision needed by", zh: "需决定的时间", ar: "القرار مطلوب قبل" },
  "tpl.escalation.s.what": { en: "What happened", zh: "发生了什么", ar: "إيه اللي حصل" },
  "tpl.escalation.s.impact": { en: "Impact", zh: "影响", ar: "التأثير" },
  "tpl.escalation.s.needed": { en: "What you need", zh: "需要什么", ar: "محتاج إيه" },
  "tpl.handover.s.open_tasks": { en: "Open tasks", zh: "未完成任务", ar: "المهام المفتوحة" },
  "tpl.handover.s.meetings": { en: "Coming meetings", zh: "即将召开的会议", ar: "الاجتماعات الجاية" },
  "tpl.handover.s.contacts": { en: "Contacts", zh: "联系人", ar: "جهات الاتصال" },
  "tpl.handover.s.notes": { en: "Notes", zh: "备注", ar: "ملاحظات" },
  "tpl.free.s.body": { en: "Report", zh: "报告内容", ar: "التقرير" },
};

export default words;
