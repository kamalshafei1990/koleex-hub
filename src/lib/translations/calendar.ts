import type { Translations } from "@/lib/i18n";

/* Calendar app — CalendarApp shell, Month/Week/Day views, and the
   EventModal create/edit flow. */

export const calendarT: Translations = {
  /* Shell */
  "app.title":         { en: "Calendar",                  zh: "日历",                   ar: "التقويم" },
  "app.subtitle":      { en: "self-contained scheduling", zh: "独立日程安排",           ar: "جدولة مستقلة" },
  "accounts.loading":  { en: "Loading accounts…",          zh: "加载账户中…",            ar: "تحميل الحسابات…" },
  "accounts.none":     { en: "No accounts",                zh: "暂无账户",               ar: "لا توجد حسابات" },
  "events.loading":    { en: "Loading events…",            zh: "加载事件中…",            ar: "جارٍ تحميل الأحداث…" },

  /* Toolbar */
  "today":             { en: "Today",                      zh: "今天",                   ar: "اليوم" },
  "prev":              { en: "Previous",                   zh: "上一个",                 ar: "السابق" },
  "next":              { en: "Next",                       zh: "下一个",                 ar: "التالي" },
  "newEvent":          { en: "New Event",                  zh: "新建事件",               ar: "حدث جديد" },

  /* Views */
  "view.month":        { en: "Month",                      zh: "月",                     ar: "شهر" },
  "view.week":         { en: "Week",                       zh: "周",                     ar: "أسبوع" },
  "view.day":          { en: "Day",                        zh: "日",                     ar: "يوم" },
  "day.events":        { en: "Events",                     zh: "事件",                   ar: "الأحداث" },
  "day.empty":         { en: "Nothing scheduled. Click a slot to add an event.", zh: "暂无安排。点击时段以添加事件。", ar: "لا شيء مجدول. اضغط على خانة لإضافة حدث." },
  "month.more":        { en: "more",                       zh: "更多",                   ar: "أخرى" },
  "week.continues":    { en: "continues",                  zh: "继续",                   ar: "يستمر" },

  /* Weekday short labels — keyed by ISO weekday (1=Mon..7=Sun) */
  "wd.1":              { en: "Mon",                        zh: "一",                     ar: "اثن" },
  "wd.2":              { en: "Tue",                        zh: "二",                     ar: "ثلا" },
  "wd.3":              { en: "Wed",                        zh: "三",                     ar: "أرب" },
  "wd.4":              { en: "Thu",                        zh: "四",                     ar: "خمي" },
  "wd.5":              { en: "Fri",                        zh: "五",                     ar: "جمع" },
  "wd.6":              { en: "Sat",                        zh: "六",                     ar: "سبت" },
  "wd.7":              { en: "Sun",                        zh: "日",                     ar: "أحد" },

  /* Holidays (report GEN-10) */
  "holidays":          { en: "Holidays",                   zh: "假期",                   ar: "العطلات" },
  "holidays.filter":   { en: "Filter holidays by country", zh: "按国家筛选假期",         ar: "تصفية العطلات حسب الدولة" },
  "holidays.all":      { en: "All countries",              zh: "所有国家",               ar: "كل الدول" },

  /* EventModal */
  "modal.new":         { en: "New Event",                  zh: "新建事件",               ar: "حدث جديد" },
  "modal.edit":        { en: "Edit Event",                 zh: "编辑事件",               ar: "تعديل الحدث" },
  "modal.view":        { en: "Event",                      zh: "事件",                   ar: "الحدث" },
  "modal.delete":      { en: "Delete",                     zh: "删除",                   ar: "حذف" },
  "modal.save":        { en: "Save",                       zh: "保存",                   ar: "حفظ" },
  "modal.cancel":      { en: "Cancel",                     zh: "取消",                   ar: "إلغاء" },
  "modal.close":       { en: "Close",                      zh: "关闭",                   ar: "إغلاق" },
  "modal.saving":      { en: "Saving…",                    zh: "保存中…",                ar: "جارٍ الحفظ…" },
  "modal.invitedBy":   { en: "You are invited by {name}",  zh: "{name} 邀请了您",         ar: "أنت مدعو من {name}" },
  "modal.invited":     { en: "You are invited to this event", zh: "您受邀参加此事件",     ar: "أنت مدعو إلى هذا الحدث" },
  "modal.guests":      { en: "Guests",                     zh: "宾客",                   ar: "الضيوف" },
  "status.invited":    { en: "Invited",                    zh: "已邀请",                 ar: "مدعو" },
  "status.accepted":   { en: "Accepted",                   zh: "已接受",                 ar: "قبِل" },
  "status.declined":   { en: "Declined",                   zh: "已拒绝",                 ar: "رفض" },
  "modal.accept":      { en: "Accept",                     zh: "接受",                   ar: "قبول" },
  "modal.decline":     { en: "Decline",                    zh: "拒绝",                   ar: "رفض" },
  "modal.accepted":    { en: "You accepted",               zh: "您已接受",               ar: "قبلت الدعوة" },
  "modal.declined":    { en: "You declined",               zh: "您已拒绝",               ar: "رفضت الدعوة" },

  "f.title":           { en: "Title",                      zh: "标题",                   ar: "العنوان" },
  "f.title.placeholder":{ en: "Quick sync with Aisha",     zh: "与 Aisha 的简短同步",    ar: "اجتماع سريع مع عائشة" },
  "f.type":            { en: "Type",                       zh: "类型",                   ar: "النوع" },
  "f.color":           { en: "Color",                      zh: "颜色",                   ar: "اللون" },
  "f.color.default":   { en: "Default",                    zh: "默认",                   ar: "الافتراضي" },
  "f.color.defaultHint": { en: "Default (type color)",     zh: "默认（类型颜色）",       ar: "الافتراضي (لون النوع)" },
  "f.allDay":          { en: "All day",                    zh: "全天",                   ar: "يوم كامل" },
  "f.private":         { en: "Private",                    zh: "私密",                   ar: "خاص" },
  "f.start":           { en: "Start",                      zh: "开始",                   ar: "البداية" },
  "f.end":             { en: "End",                        zh: "结束",                   ar: "النهاية" },
  "f.duration":        { en: "Duration",                   zh: "时长",                   ar: "المدة" },
  "f.reminder":        { en: "Reminder",                   zh: "提醒",                   ar: "تذكير" },
  "f.repeat":          { en: "Repeat",                     zh: "重复",                   ar: "تكرار" },
  "f.repeatUntil":     { en: "Repeat until",               zh: "重复至",                 ar: "التكرار حتى" },
  "f.repeatUntil.hint":{ en: "Leave empty to repeat indefinitely.", zh: "留空则无限重复。", ar: "اتركه فارغًا للتكرار بلا نهاية." },
  "f.guests":          { en: "Invite people",              zh: "邀请人员",               ar: "دعوة أشخاص" },
  "f.guests.search":   { en: "Search people…",             zh: "搜索人员…",              ar: "ابحث عن أشخاص…" },
  "f.guests.empty":    { en: "No people found.",           zh: "未找到人员。",           ar: "لم يُعثر على أشخاص." },
  "f.guests.remove":   { en: "Remove",                     zh: "移除",                   ar: "إزالة" },
  "f.location":        { en: "Location",                   zh: "地点",                   ar: "الموقع" },
  "f.location.placeholder": { en: "Office, Zoom, ...",     zh: "办公室，Zoom，...",      ar: "المكتب، زووم، ..." },
  "f.description":     { en: "Description",                zh: "描述",                   ar: "الوصف" },
  "f.description.placeholder": { en: "Notes, agenda, links…", zh: "备注、议程、链接…",    ar: "ملاحظات، أجندة، روابط…" },

  /* Reminder + repeat choices */
  "reminder.none":     { en: "None",                       zh: "无",                     ar: "بدون" },
  "reminder.0":        { en: "At start time",              zh: "开始时",                 ar: "عند البداية" },
  "reminder.5":        { en: "5 minutes before",           zh: "提前 5 分钟",            ar: "قبل 5 دقائق" },
  "reminder.10":       { en: "10 minutes before",          zh: "提前 10 分钟",           ar: "قبل 10 دقائق" },
  "reminder.15":       { en: "15 minutes before",          zh: "提前 15 分钟",           ar: "قبل 15 دقيقة" },
  "reminder.30":       { en: "30 minutes before",          zh: "提前 30 分钟",           ar: "قبل 30 دقيقة" },
  "reminder.60":       { en: "1 hour before",              zh: "提前 1 小时",            ar: "قبل ساعة" },
  "reminder.1440":     { en: "1 day before",               zh: "提前 1 天",              ar: "قبل يوم" },
  "repeat.none":       { en: "Does not repeat",            zh: "不重复",                 ar: "لا يتكرر" },
  "repeat.daily":      { en: "Daily",                      zh: "每天",                   ar: "يوميًا" },
  "repeat.weekly":     { en: "Weekly",                     zh: "每周",                   ar: "أسبوعيًا" },
  "repeat.monthly":    { en: "Monthly",                    zh: "每月",                   ar: "شهريًا" },

  /* Event types */
  "type.event":        { en: "Event",                      zh: "事件",                   ar: "حدث" },
  "type.meeting":      { en: "Meeting",                    zh: "会议",                   ar: "اجتماع" },
  "type.task":         { en: "Task",                       zh: "任务",                   ar: "مهمة" },
  "type.reminder":     { en: "Reminder",                   zh: "提醒",                   ar: "تذكير" },
  "type.out_of_office":{ en: "Out of office",              zh: "外出",                   ar: "خارج المكتب" },
  "type.holiday":      { en: "Holiday",                    zh: "假期",                   ar: "عطلة" },

  /* Validation + feedback */
  "err.titleRequired": { en: "Title is required.",         zh: "标题为必填项。",         ar: "العنوان مطلوب." },
  "err.endBeforeStart":{ en: "End time must be after start time.", zh: "结束时间必须晚于开始时间。", ar: "يجب أن يكون وقت النهاية بعد البداية." },
  "err.save":          { en: "Could not save the event.",  zh: "无法保存事件。",         ar: "تعذّر حفظ الحدث." },
  "err.delete":        { en: "Could not delete the event.", zh: "无法删除事件。",        ar: "تعذّر حذف الحدث." },
  "err.openSeries":    { en: "Could not open the recurring event.", zh: "无法打开重复事件。", ar: "تعذّر فتح الحدث المتكرر." },
  "err.respond":       { en: "Could not send your answer.", zh: "无法发送您的回复。",    ar: "تعذّر إرسال ردك." },
  "toast.created":     { en: "Event created.",             zh: "事件已创建。",           ar: "تم إنشاء الحدث." },
  "toast.updated":     { en: "Event updated.",             zh: "事件已更新。",           ar: "تم تحديث الحدث." },
  "toast.deleted":     { en: "Event deleted.",             zh: "事件已删除。",           ar: "تم حذف الحدث." },
  "toast.responded":   { en: "Your answer was sent to the organizer.", zh: "您的回复已发送给组织者。", ar: "تم إرسال ردك إلى المنظم." },

  /* Empty states */
  "empty.pickAccount": { en: "Pick an account to see their calendar.", zh: "选择一个账户以查看其日历。", ar: "اختر حسابًا لعرض تقويمه." },
};
