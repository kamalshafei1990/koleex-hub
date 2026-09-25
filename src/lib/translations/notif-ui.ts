import type { Translations } from "@/lib/i18n";

/* The notification list's own words — the bell and the notification center.
   Kept OUT of hubT on purpose: hubT rides the bundle every route shares, and
   these are only needed once the (lazy) bell or the center is on screen. */
export const notifUiT: Translations = {
  "tab.all":        { en: "All",            zh: "全部",       ar: "الكل" },
  "tab.action":     { en: "Needs you",      zh: "待你处理",    ar: "بانتظارك" },
  "tab.security":   { en: "Security",       zh: "安全",       ar: "الأمان" },

  "section.today":     { en: "Today",       zh: "今天",       ar: "اليوم" },
  "section.yesterday": { en: "Yesterday",   zh: "昨天",       ar: "أمس" },
  "section.week":      { en: "This week",   zh: "本周",       ar: "هذا الأسبوع" },
  "section.older":     { en: "Older",       zh: "更早",       ar: "أقدم" },

  "seeAll":         { en: "See all",        zh: "查看全部",    ar: "عرض الكل" },
  "markRead":       { en: "Mark as read",   zh: "标为已读",    ar: "تحديد كمقروء" },
  "markUnread":     { en: "Mark as unread", zh: "标为未读",    ar: "تحديد كغير مقروء" },
  "archive":        { en: "Archive",        zh: "归档",       ar: "أرشفة" },
  "group.show":     { en: "Show all {n}",   zh: "显示全部 {n} 条", ar: "عرض الكل ({n})" },
  "group.hide":     { en: "Show less",      zh: "收起",       ar: "عرض أقل" },

  "empty.action":   { en: "Nothing is waiting on you", zh: "没有待你处理的事项", ar: "لا شيء بانتظارك" },
  "empty.security": { en: "No security alerts",        zh: "没有安全提醒",       ar: "لا توجد تنبيهات أمنية" },
};
