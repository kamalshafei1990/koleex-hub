import type { Translations } from "@/lib/i18n";

/* Reports words — Words only the server writes: the facts an event's report
   starts with (Phase 3D), in the writer's language. One file per place that
   reads them (26 Sep 2026): each screen imports only its own, and
   ../reports.ts spreads them all for the server. validate:reports §26 fails
   when a screen reads a word it did not import. */
export const reportServerT: Translations = {
  /* The facts an event's report starts with (Phase 3D), in the writer's language. */
  "req.leave": { en: "Leave {from}–{to} ({days} days)", zh: "休假 {from}–{to}（{days} 天）", ar: "إجازة من {from} لحد {to} ({days} أيام)" },
  "req.visit": { en: "Visit {from}–{to}", zh: "来访 {from}–{to}", ar: "زيارة من {from} لحد {to}" },
  "req.late": { en: "Late on {day}: in at {time}, {min} min late", zh: "{day} 迟到：{time} 打卡，迟到 {min} 分钟", ar: "تأخير يوم {day}: دخلت الساعة {time}، متأخر {min} دقيقة" },
  "req.absent": { en: "Absent on {day}: no clock-in", zh: "{day} 缺勤：无打卡记录", ar: "غياب يوم {day}: مفيش تسجيل حضور" },
  "req.probation": { en: "{name} — probation ends {day}", zh: "{name} — 试用期于 {day} 结束", ar: "{name} — فترة الاختبار بتخلص {day}" },
  /* 6E: a summary prepared on schedule for days in which nothing was sent. */
  "sched.none.team": { en: "Nobody on your team sent a report in these days.", zh: "这些天团队中没有人提交报告。", ar: "محدش في فريقك بعت تقرير في الأيام دي." },
  "sched.none.company": { en: "No one in the company sent a report in these days.", zh: "这些天公司里没有人提交报告。", ar: "محدش في الشركة بعت تقرير في الأيام دي." },
};
