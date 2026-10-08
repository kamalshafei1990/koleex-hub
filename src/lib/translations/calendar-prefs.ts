import type { Translations } from "@/lib/i18n";

/* The Calendar preferences form (admin Accounts → Calendar, and Settings →
   Calendar). Its own file so Settings loads 23 strings, not the whole
   Accounts dictionary (~61 KB); accountsT spreads it in, so the keys are
   unchanged. */
export const calendarPrefsT: Translations = {
  "acc.msg.calendarSaved":           { en: "Calendar preferences saved.",                                         zh: "日历偏好设置已保存。",                                                  ar: "تم حفظ تفضيلات التقويم." },
  "acc.err.calendarFailed":          { en: "Could not save calendar preferences.",                                zh: "无法保存日历偏好设置。",                                                 ar: "تعذّر حفظ تفضيلات التقويم." },
  "acc.cal.timezone":                { en: "Timezone",                                                           zh: "时区",                                                               ar: "المنطقة الزمنية" },
  "acc.cal.timezoneHint":            { en: "All calendar times are shown in this timezone.",                      zh: "所有日历时间均按此时区显示。",                                           ar: "تُعرض جميع أوقات التقويم بهذه المنطقة الزمنية." },
  "acc.cal.workingHours":            { en: "Working Hours",                                                      zh: "工作时间",                                                           ar: "ساعات العمل" },
  "acc.cal.start":                   { en: "Start",                                                              zh: "开始",                                                               ar: "البداية" },
  "acc.cal.end":                     { en: "End",                                                                zh: "结束",                                                               ar: "النهاية" },
  "acc.cal.activeDays":              { en: "Active Days",                                                        zh: "工作日",                                                             ar: "أيام العمل" },
  "acc.cal.defaultMeeting":          { en: "Default Meeting Duration",                                           zh: "默认会议时长",                                                        ar: "مدة الاجتماع الافتراضية" },
  "acc.cal.meetingHint":             { en: "When you create a new meeting, this is the pre-filled duration.",     zh: "创建新会议时，这是预填的时长。",                                         ar: "عند إنشاء اجتماع جديد، هذه هي المدة المعبأة مسبقًا." },
  "acc.cal.15min":                   { en: "15 minutes",                                                         zh: "15 分钟",                                                             ar: "15 دقيقة" },
  "acc.cal.30min":                   { en: "30 minutes",                                                         zh: "30 分钟",                                                             ar: "30 دقيقة" },
  "acc.cal.45min":                   { en: "45 minutes",                                                         zh: "45 分钟",                                                             ar: "45 دقيقة" },
  "acc.cal.1hr":                     { en: "1 hour",                                                             zh: "1 小时",                                                              ar: "ساعة واحدة" },
  "acc.cal.1_5hr":                   { en: "1.5 hours",                                                          zh: "1.5 小时",                                                            ar: "ساعة ونصف" },
  "acc.cal.2hr":                     { en: "2 hours",                                                            zh: "2 小时",                                                              ar: "ساعتان" },
  "acc.cal.outOfOffice":             { en: "Out of Office",                                                      zh: "不在办公室",                                                          ar: "خارج المكتب" },
  "acc.cal.oooToggle":               { en: "I'm out of office",                                                  zh: "我不在办公室",                                                        ar: "أنا خارج المكتب" },
  "acc.cal.oooDescription":          { en: "Shows as unavailable on the calendar during this period.",            zh: "在此期间日历上显示为不可用。",                                           ar: "يظهر كغير متاح في التقويم خلال هذه الفترة." },
  "acc.cal.startDate":               { en: "Start Date",                                                         zh: "开始日期",                                                           ar: "تاريخ البدء" },
  "acc.cal.endDate":                 { en: "End Date",                                                           zh: "结束日期",                                                           ar: "تاريخ الانتهاء" },
  "acc.cal.autoReply":               { en: "Auto-reply Message",                                                 zh: "自动回复消息",                                                        ar: "رسالة الرد التلقائي" },
  "acc.cal.autoReplyPlaceholder":    { en: "I'm away from the office until [date] and will respond when I'm back.", zh: "我不在办公室，将于 [日期] 回来后回复。", ar: "أنا بعيد عن المكتب حتى [التاريخ] وسأرد عند عودتي." },
};
