import type { Translations } from "@/lib/i18n";

/* Reports — the Team tab's summary card (Phase 5A). Loaded only with the
   card (its own chunk, opened on the Team tab), never on the other Reports
   pages. */
export const reportTeamT: Translations = {
  "team.title": { en: "Team summary", zh: "团队总结", ar: "ملخّص الفريق" },
  "team.lead": { en: "Koleex AI reads what your team sent in these days — never a draft or a confidential report — beside their numbers.", zh: "Koleex AI 阅读团队在这些天提交的报告（不含草稿和保密报告），并结合他们的数据。", ar: "Koleex AI يقرا اللي فريقك بعته في الأيام دي — عمره ما يقرا مسودة أو تقرير سري — جنب أرقامهم." },
  "team.p.today": { en: "Today", zh: "今天", ar: "النهارده" },
  "team.p.yesterday": { en: "Yesterday", zh: "昨天", ar: "إمبارح" },
  "team.p.this_week": { en: "This week", zh: "本周", ar: "الأسبوع ده" },
  "team.p.last_week": { en: "Last week", zh: "上周", ar: "الأسبوع اللي فات" },
  "team.p.this_month": { en: "This month", zh: "本月", ar: "الشهر ده" },
  /* 6E: the weekly summary, switched on by the manager for themself. */
  "team.weekly": { en: "Weekly summary", zh: "每周总结", ar: "ملخص أسبوعي" },
  "team.weekly.hint": { en: "Every Monday at 07:00 your time, Koleex AI writes last week's summary of your team into My reports and tells you — from the first week reports are counted. Nothing is sent.", zh: "每周一你当地时间 07:00，Koleex AI 会把团队上周的总结写入「我的报告」并通知你——从开始统计报告的第一周起。不会发送给任何人。", ar: "كل اتنين الساعة 7 الصبح بتوقيتك، Koleex AI بيكتب ملخص الأسبوع اللي فات لفريقك في «تقاريري» ويبلّغك — من أول أسبوع التقارير بتتحسب فيه. مفيش حاجة بتتبعت." },
  "team.weekly.failed": { en: "Could not save — try again.", zh: "无法保存——请重试。", ar: "ما اتحفظش — جرّب تاني." },
  "team.go": { en: "Summarize", zh: "生成总结", ar: "لخّص" },
  "team.again": { en: "Summarize again", zh: "重新总结", ar: "لخّص تاني" },
  "team.busy": { en: "Reading your team's reports…", zh: "正在阅读团队报告…", ar: "بيقرا تقارير فريقك…" },
  "team.meta": { en: "{n} report(s) from {m} people", zh: "{m} 人的 {n} 份报告", ar: "{n} تقرير من {m} شخص" },
  "team.truncated": { en: "the newest {n} only", zh: "仅最新 {n} 份", ar: "أحدث {n} بس" },
  "team.at": { en: "summarized at {time}", zh: "总结于 {time}", ar: "اتلخّص الساعة {time}" },
  "team.none": { en: "No one in your team sent a report in these days.", zh: "这些天团队中没有人提交报告。", ar: "محدش في فريقك بعت تقرير في الأيام دي." },
  "team.empty": { en: "Pick the days, then Summarize.", zh: "选择日期，然后生成总结。", ar: "اختار الأيام، وبعدين دوس «لخّص»." },
  "team.numbers": { en: "The numbers", zh: "数据", ar: "الأرقام" },
  "team.col.person": { en: "Person", zh: "人员", ar: "الشخص" },
  "team.col.reports": { en: "Reports", zh: "报告", ar: "التقارير" },
  "team.col.attendance": { en: "Attendance", zh: "考勤", ar: "الحضور" },
  "team.col.work": { en: "Work", zh: "工作", ar: "الشغل" },
  "team.cell.reports": { en: "{a} on time · {b} late · {c} missing", zh: "{a} 按时 · {b} 迟交 · {c} 缺交", ar: "{a} في ميعاده · {b} متأخر · {c} ناقص" },
  "team.cell.nothingDue": { en: "nothing due", zh: "无应交", ar: "مفيش مطلوب" },
  "team.cell.untracked": { en: "not counted yet", zh: "尚未统计", ar: "لسه مش بيتعد" },
  "team.cell.attendance": { en: "{a} late · {b} absent · {c} leave", zh: "{a} 迟到 · {b} 缺勤 · {c} 休假", ar: "{a} تأخير · {b} غياب · {c} إجازة" },
  "team.cell.work": { en: "{a} open · {b} overdue · {c} done", zh: "{a} 进行中 · {b} 逾期 · {c} 已完成", ar: "{a} مفتوح · {b} متأخر · {c} خلص" },
  "team.make": { en: "Make it a report", zh: "生成报告", ar: "اعمله تقرير" },
  "team.copy": { en: "Copy", zh: "复制", ar: "انسخ" },
  "team.copied": { en: "Copied", zh: "已复制", ar: "اتنسخ" },
  "team.err.busy": { en: "Koleex AI is busy — try again in a few minutes.", zh: "Koleex AI 正忙——请几分钟后再试。", ar: "Koleex AI مشغول — جرّب تاني بعد كام دقيقة." },
  "team.err.failed": { en: "The summary could not be made just now — try again.", zh: "暂时无法生成总结——请重试。", ar: "الملخّص ماتعملش دلوقتي — جرّب تاني." },
  "team.err.noTeam": { en: "No one reports to you yet.", zh: "目前还没有人向你汇报。", ar: "لسه محدش تحتك." },
};
