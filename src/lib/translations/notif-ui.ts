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
  "empty.unread":   { en: "No unread notifications",   zh: "没有未读通知",       ar: "لا توجد إشعارات غير مقروءة" },
  "empty.archive":  { en: "Nothing archived",          zh: "没有已归档的通知",   ar: "لا توجد إشعارات مؤرشفة" },
  "empty.search":   { en: "Nothing matches your search", zh: "没有匹配的结果",  ar: "لا توجد نتائج مطابقة" },

  /* The notification center (/inbox). */
  "view.unread":    { en: "Unread",         zh: "未读",       ar: "غير مقروءة" },
  "view.archive":   { en: "Archive",        zh: "归档",       ar: "الأرشيف" },
  "center.apps":    { en: "Apps",           zh: "应用",       ar: "التطبيقات" },
  "center.allApps": { en: "All apps",       zh: "全部应用",    ar: "كل التطبيقات" },
  "center.search":  { en: "Search notifications", zh: "搜索通知", ar: "ابحث في الإشعارات" },
  "center.pick":    { en: "Select a notification to read it", zh: "选择一条通知以查看", ar: "اختر إشعارًا لقراءته" },
  "detail.open":    { en: "Open in {app}",  zh: "在{app}中打开", ar: "افتح في {app}" },
  "detail.openLink": { en: "Open",          zh: "打开",       ar: "فتح" },
  "detail.attachments": { en: "Attachments", zh: "附件",      ar: "المرفقات" },
  "detail.products": { en: "Products",      zh: "产品",       ar: "المنتجات" },
  "detail.request": { en: "Request details", zh: "申请详情",   ar: "تفاصيل الطلب" },

  /* Membership requests, decided from the notification itself. */
  "mod.approve":    { en: "Approve",        zh: "批准",       ar: "موافقة" },
  "mod.reject":     { en: "Reject",         zh: "拒绝",       ar: "رفض" },
  "mod.approveHint": { en: "Approve this request? You can add a note.", zh: "批准此申请？可以添加备注。", ar: "الموافقة على هذا الطلب؟ يمكنك إضافة ملاحظة." },
  "mod.rejectHint": { en: "Reject this request — the reason is kept with it.", zh: "拒绝此申请——原因会随申请保存。", ar: "رفض هذا الطلب — يُحفظ السبب معه." },
  "mod.notePh":     { en: "Note (optional)", zh: "备注（可选）", ar: "ملاحظة (اختيارية)" },
  "mod.reasonPh":   { en: "Reason (required)", zh: "原因（必填）", ar: "السبب (مطلوب)" },
  "mod.cancel":     { en: "Cancel",         zh: "取消",       ar: "إلغاء" },
  "mod.confirmApprove": { en: "Confirm approval", zh: "确认批准", ar: "تأكيد الموافقة" },
  "mod.confirmReject": { en: "Confirm rejection", zh: "确认拒绝", ar: "تأكيد الرفض" },
  "mod.approved":   { en: "Request approved", zh: "申请已批准", ar: "تمت الموافقة على الطلب" },
  "mod.rejected":   { en: "Request rejected", zh: "申请已拒绝", ar: "تم رفض الطلب" },
  "mod.failed":     { en: "Couldn't update the request.", zh: "无法更新该申请。", ar: "تعذّر تحديث الطلب." },
  "mod.noRequest":  { en: "This notification is not linked to a request.", zh: "此通知未关联任何申请。", ar: "هذا الإشعار غير مرتبط بطلب." },
};
