import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Travel, visitors & meetings templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.trip_report.s.destination": { en: "Where and why", zh: "地点和目的", ar: "فين وليه" },
  "tpl.trip_report.s.meetings": { en: "Meetings", zh: "会面", ar: "المقابلات" },
  "tpl.trip_report.s.meetings.c.date": { en: "Date", zh: "日期", ar: "التاريخ" },
  "tpl.trip_report.s.meetings.c.who": { en: "Who", zh: "对象", ar: "مين" },
  "tpl.trip_report.s.meetings.c.company": { en: "Company", zh: "公司", ar: "الشركة" },
  "tpl.trip_report.s.meetings.c.outcome": { en: "Outcome", zh: "结果", ar: "النتيجة" },
  "tpl.trip_report.s.results": { en: "Results", zh: "成果", ar: "النتايج" },
  "tpl.trip_report.s.follow_ups": { en: "Follow-ups", zh: "后续跟进", ar: "المتابعات" },
  "tpl.trip_report.s.link": { en: "Customers and suppliers met", zh: "会见的客户和供应商", ar: "العملاء والموردين اللي قابلتهم" },
  "tpl.trip_report.s.expenses": { en: "Your expenses (from Finance)", zh: "你的费用（来自财务）", ar: "مصاريفك (من المالية)" },
  "tpl.delegation_visit.s.link": { en: "Customers and suppliers", zh: "客户和供应商", ar: "العملاء والموردين" },
  "tpl.delegation_visit.s.visitors": { en: "Visitors", zh: "来访人员", ar: "الزوار" },
  "tpl.delegation_visit.s.visitors.c.name": { en: "Name", zh: "姓名", ar: "الاسم" },
  "tpl.delegation_visit.s.visitors.c.company": { en: "Company", zh: "公司", ar: "الشركة" },
  "tpl.delegation_visit.s.visitors.c.role": { en: "Role", zh: "职位", ar: "الوظيفة" },
  "tpl.delegation_visit.s.program": { en: "Program", zh: "日程", ar: "البرنامج" },
  "tpl.delegation_visit.s.discussed": { en: "What was discussed", zh: "讨论内容", ar: "اتكلمنا في إيه" },
  "tpl.delegation_visit.s.outcomes": { en: "Outcomes and agreements", zh: "成果和约定", ar: "النتايج والاتفاقات" },
  "tpl.delegation_visit.s.next_steps": { en: "Next steps", zh: "下一步", ar: "الخطوات الجاية" },
  "tpl.meeting_minutes.s.attendees": { en: "Who attended", zh: "参会人员", ar: "مين حضر" },
  "tpl.meeting_minutes.s.agenda": { en: "Agenda", zh: "议程", ar: "جدول الأعمال" },
  "tpl.meeting_minutes.s.discussion": { en: "Discussion", zh: "讨论", ar: "النقاش" },
  "tpl.meeting_minutes.s.decisions": { en: "Decisions", zh: "决定", ar: "القرارات" },
  "tpl.meeting_minutes.s.decisions.c.decision": { en: "Decision", zh: "决定", ar: "القرار" },
  "tpl.meeting_minutes.s.decisions.c.owner": { en: "Who", zh: "负责人", ar: "مسؤول مين" },
  "tpl.meeting_minutes.s.decisions.c.due": { en: "By", zh: "截止日期", ar: "لحد" },
  "tpl.meeting_minutes.s.next_meeting": { en: "Next meeting", zh: "下次会议", ar: "الاجتماع الجاي" },
  "tpl.decision_log.s.decisions": { en: "Decisions", zh: "决定", ar: "القرارات" },
  "tpl.decision_log.s.decisions.c.date": { en: "Date", zh: "日期", ar: "التاريخ" },
  "tpl.decision_log.s.decisions.c.decision": { en: "Decision", zh: "决定", ar: "القرار" },
  "tpl.decision_log.s.decisions.c.by": { en: "Decided by", zh: "决定人", ar: "قرّره مين" },
  "tpl.decision_log.s.decisions.c.why": { en: "Why", zh: "原因", ar: "ليه" },
  "tpl.decision_log.s.notes": { en: "Notes", zh: "备注", ar: "ملاحظات" },
};

export default words;
