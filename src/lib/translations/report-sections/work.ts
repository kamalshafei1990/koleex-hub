import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Work templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.daily.s.meetings": { en: "Meetings held", zh: "当日会议", ar: "الاجتماعات اللي حصلت" },
  "tpl.daily.s.done": { en: "Tasks completed", zh: "已完成任务", ar: "المهام اللي خلصت" },
  "tpl.daily.s.pending": { en: "Pending tasks", zh: "待办任务", ar: "المهام المعلقة" },
  "tpl.daily.s.blockers": { en: "Problems and blockers", zh: "问题及障碍", ar: "المشاكل والعوائق" },
  "tpl.daily.s.blockers.hint": { en: "What slowed you down today? One line is enough.", zh: "今天是什么拖慢了你？一句话即可。", ar: "إيه اللي عطلك النهارده؟ سطر واحد كفاية." },
  "tpl.daily.s.tomorrow": { en: "Tomorrow's schedule", zh: "次日行程", ar: "جدول بكرة" },
  "tpl.weekly_plan.s.goals": { en: "Goals for this week", zh: "本周目标", ar: "أهداف الأسبوع" },
  "tpl.weekly_plan.s.meetings": { en: "Planned meetings", zh: "计划会议", ar: "الاجتماعات المتخططة" },
  "tpl.weekly_plan.s.deadlines": { en: "Deadlines", zh: "截止日期", ar: "المواعيد النهائية" },
  "tpl.weekly_plan.s.support": { en: "Support needed", zh: "需要的支持", ar: "المساعدة المطلوبة" },
  "tpl.weekly.s.summary": { en: "Week summary", zh: "本周总结", ar: "ملخص الأسبوع" },
  "tpl.weekly.s.meetings": { en: "Meetings overview", zh: "会议概览", ar: "الاجتماعات" },
  "tpl.weekly.s.projects": { en: "Project status", zh: "项目进度", ar: "حالة المشاريع" },
  "tpl.weekly.s.decisions": { en: "Key decisions", zh: "重要决定", ar: "القرارات المهمة" },
  "tpl.weekly.s.next_week": { en: "Next week's plan", zh: "下周计划", ar: "خطة الأسبوع الجاي" },
  "tpl.monthly.s.summary": { en: "Monthly summary", zh: "月度总结", ar: "ملخص الشهر" },
  "tpl.monthly.s.projects": { en: "Project progress", zh: "项目进展", ar: "تقدم المشاريع" },
  "tpl.monthly.s.travel": { en: "Travel and exhibitions", zh: "差旅及展会", ar: "السفر والمعارض" },
  "tpl.monthly.s.social": { en: "Social media results", zh: "社交媒体数据", ar: "نتايج السوشيال ميديا" },
  "tpl.monthly.s.improvements": { en: "Improvements and plans", zh: "改进建议及计划", ar: "التحسينات والخطط" },
  /* 6D */
  "tpl.quarterly.s.summary": { en: "Quarter summary", zh: "季度总结", ar: "ملخص الربع" },
  "tpl.quarterly.s.achievements": { en: "Achievements", zh: "主要成果", ar: "الإنجازات" },
  "tpl.quarterly.s.projects": { en: "Project progress", zh: "项目进展", ar: "تقدم المشاريع" },
  "tpl.quarterly.s.challenges": { en: "Challenges and how they were handled", zh: "挑战及应对", ar: "التحديات واتعاملنا معاها إزاي" },
  "tpl.quarterly.s.next_quarter": { en: "Next quarter's plan", zh: "下季度计划", ar: "خطة الربع الجاي" },
  "tpl.quarterly.s.support": { en: "Support needed", zh: "需要的支持", ar: "المساعدة المطلوبة" },
  "tpl.halfyear.s.summary": { en: "Half-year summary", zh: "半年总结", ar: "ملخص النص سنة" },
  "tpl.halfyear.s.goals": { en: "Progress on this year's goals", zh: "年度目标进展", ar: "التقدم في أهداف السنة" },
  "tpl.halfyear.s.achievements": { en: "Achievements", zh: "主要成果", ar: "الإنجازات" },
  "tpl.halfyear.s.challenges": { en: "Challenges", zh: "挑战", ar: "التحديات" },
  "tpl.halfyear.s.next_half": { en: "Plan for the next six months", zh: "下半年计划", ar: "خطة الست شهور الجاية" },
  "tpl.annual.s.summary": { en: "The year in brief", zh: "年度总结", ar: "ملخص السنة" },
  "tpl.annual.s.achievements": { en: "Main achievements", zh: "主要成果", ar: "أهم الإنجازات" },
  "tpl.annual.s.projects": { en: "Projects", zh: "项目", ar: "المشاريع" },
  "tpl.annual.s.lessons": { en: "Lessons learned", zh: "经验教训", ar: "الدروس المستفادة" },
  "tpl.annual.s.next_year": { en: "Goals for next year", zh: "明年目标", ar: "أهداف السنة الجاية" },
  "tpl.annual.s.support": { en: "Support needed", zh: "需要的支持", ar: "المساعدة المطلوبة" },
  "tpl.return_plan.s.away": { en: "While you were away", zh: "休假期间", ar: "وانت في الإجازة" },
  "tpl.return_plan.s.catch_up": { en: "What you are catching up on", zh: "需要跟进的事项", ar: "هتلحق إيه" },
  "tpl.return_plan.s.priorities": { en: "Your priorities this week", zh: "本周优先事项", ar: "أولوياتك الأسبوع ده" },
  "tpl.return_plan.s.help": { en: "Help you need", zh: "需要的帮助", ar: "محتاج مساعدة في إيه" },
  "tpl.attendance_note.s.what": { en: "The day", zh: "日期与情况", ar: "اليوم" },
  "tpl.attendance_note.s.reason": { en: "Why", zh: "原因", ar: "السبب" },
  "tpl.attendance_note.s.covered": { en: "How the work was covered", zh: "工作如何安排", ar: "الشغل اتغطى إزاي" },
  "tpl.attendance_note.s.correction": { en: "If the record is wrong, what is right", zh: "如记录有误，正确情况是", ar: "لو التسجيل غلط، الصح إيه" },
};

export default words;
