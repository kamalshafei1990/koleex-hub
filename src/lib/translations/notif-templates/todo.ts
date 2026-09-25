import type { Translations } from "@/lib/i18n";

/* To-do — lib/server/todo-notify.ts, todo-escalation.ts, todo-recurrence.ts,
   api/cron/todo-reminders. */
export const todoTpl: Translations = {
  "todo_assignment.s": { en: "New task: {title:free}", zh: "新任务：{title:free}", ar: "مهمة جديدة: {title:free}" },

  "todo_mention.s": { en: "You were mentioned: {title:free}", zh: "有人提到了你：{title:free}", ar: "تمت الإشارة إليك: {title:free}" },
  "todo_mention.plain.s": { en: "You were mentioned: {title:free}", zh: "有人提到了你：{title:free}", ar: "تمت الإشارة إليك: {title:free}" },
  "todo_mention.plain.b": { en: "You were mentioned on a task.", zh: "有人在一项任务中提到了你。", ar: "تمت الإشارة إليك في مهمة." },

  "todo_observer.s": { en: "You are now an observer: {title:free}", zh: "你已成为关注人：{title:free}", ar: "أنت الآن مُتابِع: {title:free}" },
  "todo_observer.b": {
    en: "You were added as an observer — you can follow this task and update its situation.",
    zh: "你已被添加为关注人——可以跟进这项任务并更新其进展。",
    ar: "تمت إضافتك كمُتابِع — يمكنك متابعة هذه المهمة وتحديث وضعها.",
  },

  "todo_approval_request.s": { en: "Awaiting your approval: {title:free}", zh: "等待你确认：{title:free}", ar: "بانتظار موافقتك: {title:free}" },
  "todo_approval_request.b": {
    en: "The task \"{title:free}\" was submitted as done and needs your confirmation.",
    zh: "任务“{title:free}”已提交为完成，需要你确认。",
    ar: "تم تسليم المهمة \"{title:free}\" على أنها منجزة وتحتاج إلى تأكيدك.",
  },

  "todo_approval_decision.approved.s": { en: "Task confirmed done: {title:free}", zh: "任务已确认完成：{title:free}", ar: "تم تأكيد إنجاز المهمة: {title:free}" },
  "todo_approval_decision.approved.b": {
    en: "Your submission for \"{title:free}\" was confirmed. The task is done.",
    zh: "你提交的“{title:free}”已确认，任务已完成。",
    ar: "تم تأكيد ما سلّمته في \"{title:free}\". المهمة منجزة.",
  },
  "todo_approval_decision.reopened.s": { en: "Task reopened: {title:free}", zh: "任务已重新打开：{title:free}", ar: "أُعيد فتح المهمة: {title:free}" },
  "todo_approval_decision.reopened.b": {
    en: "\"{title:free}\" was reopened — it is not fully done yet.",
    zh: "“{title:free}”已重新打开——尚未完全完成。",
    ar: "أُعيد فتح \"{title:free}\" — لم تكتمل بعد.",
  },
  "todo_approval_decision.returned.s": { en: "Task reopened: {title:free}", zh: "任务已重新打开：{title:free}", ar: "أُعيد فتح المهمة: {title:free}" },
  "todo_approval_decision.returned.b": {
    en: "\"{title:free}\" was sent back: {reason:free}",
    zh: "“{title:free}”已退回：{reason:free}",
    ar: "أُعيدت \"{title:free}\": {reason:free}",
  },

  "todo_reminder.s": { en: "⏰ Reminder: {title:free}", zh: "⏰ 提醒：{title:free}", ar: "⏰ تذكير: {title:free}" },

  "todo_overdue.s": { en: "⚠️ Overdue: {title:free}", zh: "⚠️ 已逾期：{title:free}", ar: "⚠️ متأخرة: {title:free}" },
  "todo_overdue.b": {
    en: "A task you assigned is past its due date and still open.",
    zh: "你分配的一项任务已过截止日期，仍未完成。",
    ar: "مهمة أسندتَها تجاوزت موعد استحقاقها وما زالت مفتوحة.",
  },

  "todo_recurring.s": { en: "🔁 {title:free}", zh: "🔁 {title:free}", ar: "🔁 {title:free}" },
};
