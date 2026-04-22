import type { Translations } from "@/lib/i18n";

/* Calendar app — CalendarApp shell, Month/Week/Day views, and the
   EventModal create/edit flow. */

export const calendarT: Translations = {
  /* Shell */
  "app.title":         { en: "Calendar",                  zh: "日历",                   ar: "التقويم" },
  "app.subtitle":      { en: "self-contained scheduling", zh: "独立日程安排",           ar: "جدولة مستقلة" },
  "accounts.loading":  { en: "Loading accounts…",          zh: "加载账户中…",            ar: "تحميل الحسابات…" },
  "accounts.none":     { en: "No accounts",                zh: "暂无账户",               ar: "لا توجد حسابات" },

  /* Toolbar */
  "today":             { en: "Today",                      zh: "今天",                   ar: "اليوم" },
  "prev":              { en: "Previous",                   zh: "上一个",                 ar: "السابق" },
  "next":              { en: "Next",                       zh: "下一个",                 ar: "التالي" },
  "newEvent":          { en: "New Event",                  zh: "新建事件",               ar: "حدث جديد" },

  /* Views */
  "view.month":        { en: "Month",                      zh: "月",                     ar: "شهر" },
  "view.week":         { en: "Week",                       zh: "周",                     ar: "أسبوع" },
  "view.day":          { en: "Day",                        zh: "日",                     ar: "يوم" },

  /* Weekday short labels — Sun..Sat */
  "wd.sun":            { en: "Sun",                        zh: "日",                     ar: "أحد" },
  "wd.mon":            { en: "Mon",                        zh: "一",                     ar: "اثن" },
  "wd.tue":            { en: "Tue",                        zh: "二",                     ar: "ثلا" },
  "wd.wed":            { en: "Wed",                        zh: "三",                     ar: "أرب" },
  "wd.thu":            { en: "Thu",                        zh: "四",                     ar: "خمي" },
  "wd.fri":            { en: "Fri",                        zh: "五",                     ar: "جمع" },
  "wd.sat":            { en: "Sat",                        zh: "六",                     ar: "سبت" },

  /* EventModal */
  "modal.new":         { en: "New Event",                  zh: "新建事件",               ar: "حدث جديد" },
  "modal.edit":        { en: "Edit Event",                 zh: "编辑事件",               ar: "تعديل الحدث" },
  "modal.delete":      { en: "Delete",                     zh: "删除",                   ar: "حذف" },
  "modal.deleteConfirm": { en: "Delete this event?",       zh: "删除此事件？",           ar: "حذف هذا الحدث؟" },
  "modal.save":        { en: "Save",                       zh: "保存",                   ar: "حفظ" },
  "modal.cancel":      { en: "Cancel",                     zh: "取消",                   ar: "إلغاء" },
  "modal.saving":      { en: "Saving…",                    zh: "保存中…",                ar: "جارٍ الحفظ…" },

  "f.title":           { en: "Title",                      zh: "标题",                   ar: "العنوان" },
  "f.title.placeholder":{ en: "Quick sync with Aisha",     zh: "与 Aisha 的简短同步",    ar: "اجتماع سريع مع عائشة" },
  "f.type":            { en: "Type",                       zh: "类型",                   ar: "النوع" },
  "f.color":           { en: "Color",                      zh: "颜色",                   ar: "اللون" },
  "f.allDay":          { en: "All day",                    zh: "全天",                   ar: "يوم كامل" },
  "f.start":           { en: "Start",                      zh: "开始",                   ar: "البداية" },
  "f.end":             { en: "End",                        zh: "结束",                   ar: "النهاية" },
  "f.location":        { en: "Location",                   zh: "地点",                   ar: "الموقع" },
  "f.location.placeholder": { en: "Office, Zoom, ...",     zh: "办公室，Zoom，...",      ar: "المكتب، زووم، ..." },
  "f.description":     { en: "Description",                zh: "描述",                   ar: "الوصف" },
  "f.description.placeholder": { en: "Notes, agenda, links…", zh: "备注、议程、链接…",    ar: "ملاحظات، أجندة، روابط…" },

  /* Event types */
  "type.event":        { en: "Event",                      zh: "事件",                   ar: "حدث" },
  "type.meeting":      { en: "Meeting",                    zh: "会议",                   ar: "اجتماع" },
  "type.task":         { en: "Task",                       zh: "任务",                   ar: "مهمة" },
  "type.reminder":     { en: "Reminder",                   zh: "提醒",                   ar: "تذكير" },
  "type.ooo":          { en: "Out of office",              zh: "外出",                   ar: "خارج المكتب" },
  "type.holiday":      { en: "Holiday",                    zh: "假期",                   ar: "عطلة" },

  /* Empty states */
  "empty.noEvents":    { en: "No events on this day.",     zh: "这天没有事件。",         ar: "لا توجد أحداث في هذا اليوم." },
  "empty.pickAccount": { en: "Pick an account to see their calendar.", zh: "选择一个账户以查看其日历。", ar: "اختر حسابًا لعرض تقويمه." },
};
