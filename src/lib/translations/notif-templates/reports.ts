import type { Translations } from "@/lib/i18n";

/* Reports — lib/server/reports/notify.ts, nudges.ts, events.ts.
   {title:free} is the report's own title (or its type's name when it has
   none). {report} / {type} are the English labels the writers build from
   the reports dictionary for the period ("daily report 25/09"), and
   {subject} is what a request is about (dates, a customer, an employee) —
   plain values, never machine-translated names. Lists of several reports
   stay the stored body (data); only their subject is templated. */
export const reportsTpl: Translations = {
  /* Sent — for review (report_approval_request) or for information. */
  "report_approval_request.s": { en: "{title:free} — {author}", zh: "{title:free} — {author}", ar: "{title:free} — {author}" },
  "report_approval_request.b": { en: "Waiting for your review.", zh: "等待你审阅。", ar: "بانتظار مراجعتك." },
  "report_approval_request.urgent.s": { en: "Urgent · {title:free} — {author}", zh: "紧急 · {title:free} — {author}", ar: "عاجل · {title:free} — {author}" },
  "report_approval_request.urgent.b": { en: "Waiting for your review.", zh: "等待你审阅。", ar: "بانتظار مراجعتك." },
  "report_submitted.s": { en: "{title:free} — {author}", zh: "{title:free} — {author}", ar: "{title:free} — {author}" },
  "report_submitted.urgent.s": { en: "Urgent · {title:free} — {author}", zh: "紧急 · {title:free} — {author}", ar: "عاجل · {title:free} — {author}" },

  /* The reviewer's decision — the body is the reviewer's own note. */
  "report_decided.approved.s": { en: "Approved: {title:free}", zh: "已批准：{title:free}", ar: "تمت الموافقة: {title:free}" },
  "report_decided.returned.s": { en: "Returned: {title:free}", zh: "已退回：{title:free}", ar: "أُعيد للتعديل: {title:free}" },

  /* A comment — the body is the comment itself. */
  "report_comment.s": { en: "{actor} commented: {title:free}", zh: "{actor} 发表了评论：{title:free}", ar: "علّق {actor}: {title:free}" },

  /* Reminder to the author, an hour before the deadline. */
  "report_reminder.one.s": { en: "Reminder: your {report} is due at {time}", zh: "提醒：你的 {report} 将于 {time} 截止", ar: "تذكير: موعد تسليم {report} الساعة {time}" },
  "report_reminder.one.b": {
    en: "Send it from Reports before the deadline.",
    zh: "请在截止时间前从“报告”中发送。",
    ar: "أرسله من تطبيق التقارير قبل الموعد النهائي.",
  },
  "report_reminder.many.s": { en: "Reminder: {count} reports are due soon", zh: "提醒：{count} 份报告即将截止", ar: "تذكير: يقترب موعد تسليم {count} من التقارير" },

  /* Escalation to the manager — a report is still missing. */
  "report_escalation.one.s": { en: "Missing report: {author} — {report}", zh: "报告未提交：{author} — {report}", ar: "تقرير لم يُرسَل: {author} — {report}" },
  "report_escalation.many.person.s": { en: "{count} reports missing from {author}", zh: "{author} 有 {count} 份报告未提交", ar: "تقارير لم يرسلها {author}: {count}" },
  "report_escalation.many.people.s": {
    en: "{count} reports missing from {people} people",
    zh: "{people} 人共有 {count} 份报告未提交",
    ar: "تقارير لم تُرسَل: {count} (عدد الأشخاص: {people})",
  },

  /* A report an event asks for (leave, a meeting, a visit, a late day, a probation). */
  "report_request.one.s": { en: "New report to write: {type} — {subject}", zh: "新报告待撰写：{type} — {subject}", ar: "تقرير جديد مطلوب كتابته: {type} — {subject}" },
  "report_request.one.b": {
    en: "Due {day:weekdayShort} {date} at {time}.",
    zh: "截止时间：{day:weekdayShort} {date} {time}。",
    ar: "موعد التسليم: {day:weekdayShort} {date} الساعة {time}.",
  },
  /* The writer's time zone could not be read: the body stays the raw instant. */
  "report_request.one.raw.s": { en: "New report to write: {type} — {subject}", zh: "新报告待撰写：{type} — {subject}", ar: "تقرير جديد مطلوب كتابته: {type} — {subject}" },
  "report_request.many.s": { en: "{count} new reports to write", zh: "{count} 份新报告待撰写", ar: "تقارير جديدة مطلوب كتابتها: {count}" },

  /* The en-GB short weekday the request's due time is written with. */
  "enum.weekdayShort.Mon": { en: "Mon", zh: "周一", ar: "الاثنين" },
  "enum.weekdayShort.Tue": { en: "Tue", zh: "周二", ar: "الثلاثاء" },
  "enum.weekdayShort.Wed": { en: "Wed", zh: "周三", ar: "الأربعاء" },
  "enum.weekdayShort.Thu": { en: "Thu", zh: "周四", ar: "الخميس" },
  "enum.weekdayShort.Fri": { en: "Fri", zh: "周五", ar: "الجمعة" },
  "enum.weekdayShort.Sat": { en: "Sat", zh: "周六", ar: "السبت" },
  "enum.weekdayShort.Sun": { en: "Sun", zh: "周日", ar: "الأحد" },
};
