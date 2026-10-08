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

  /* Later — one notification put off (lib/notification-pause LATER_CHOICES). */
  "more":           { en: "More",           zh: "更多",       ar: "المزيد" },
  "later.title":    { en: "Remind me later", zh: "稍后提醒我", ar: "ذكّرني لاحقًا" },
  "later.back":     { en: "Back {time}",    zh: "{time} 回来", ar: "يعود {time}" },
  "view.later":     { en: "Later",          zh: "稍后",       ar: "لاحقًا" },
  "empty.later":    { en: "Nothing put off for later", zh: "没有稍后提醒的通知", ar: "لا شيء مؤجّل" },

  /* Pause from the bell (lib/notification-pause). */
  "pause.button":   { en: "Pause notifications", zh: "暂停通知", ar: "إيقاف الإشعارات مؤقتًا" },
  "pause.on":       { en: "Paused until {time}", zh: "已暂停，至 {time}", ar: "متوقفة حتى {time}" },
  "pause.tomorrow": { en: "tomorrow",       zh: "明天",       ar: "غدًا" },
  "pause.resume":   { en: "Resume",         zh: "恢复",       ar: "استئناف" },
  "pause.failed":   { en: "Couldn't change it. Try again.", zh: "操作失败，请重试。", ar: "تعذّر التغيير. حاول مرة أخرى." },
  "pause.noMeeting": { en: "No meeting in your calendar right now — paused for 1 hour.", zh: "日历中现在没有会议——已暂停 1 小时。", ar: "لا يوجد اجتماع في تقويمك الآن — تم الإيقاف لمدة ساعة." },

  /* Back after an absence: one card for what came in meanwhile. */
  "away.title":     { en: "While you were away", zh: "你离开期间", ar: "أثناء غيابك" },
  "away.needs":     { en: "Needs you {n}",  zh: "待你处理 {n}", ar: "بانتظارك {n}" },
  "away.messages":  { en: "Messages {n}",   zh: "消息 {n}",   ar: "رسائل {n}" },
  "away.updates":   { en: "Updates {n}",    zh: "更新 {n}",   ar: "تحديثات {n}" },
  "away.show":      { en: "Show me",        zh: "查看",       ar: "اعرض" },

  /* How long a request has waited on the reader (the "Needs you" list). */
  "wait.hours":     { en: "Waiting {n}h",   zh: "已等待 {n} 小时", ar: "ينتظر منذ {n} ساعة" },
  "wait.day":       { en: "Waiting 1 day",  zh: "已等待 1 天",  ar: "ينتظر منذ يوم" },
  "wait.days":      { en: "Waiting {n} days", zh: "已等待 {n} 天", ar: "ينتظر منذ {n} أيام" },
  "wait.on":        { en: "Waiting on {who}", zh: "等待 {who} 处理", ar: "بانتظار {who}" },

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

  /* Decisions taken on the notification itself (leave, tasks, reports,
     attendance corrections, overtime, account requests). */
  "dec.return":     { en: "Send back",      zh: "退回",       ar: "إعادة" },
  "dec.handled":    { en: "Mark handled",   zh: "标记为已处理", ar: "تم الحل" },
  "dec.confirmHandled": { en: "Confirm — handled", zh: "确认已处理", ar: "تأكيد: تم الحل" },
  "dec.confirmReturn": { en: "Confirm send back", zh: "确认退回", ar: "تأكيد الإعادة" },
  "dec.forbidden":  { en: "You can't decide this one", zh: "你无权处理此项", ar: "لا يمكنك البتّ في هذا" },
  "dec.decided":    { en: "Already decided", zh: "已处理",     ar: "تم البتّ فيه بالفعل" },
  "dec.reasonShort": { en: "Write the reason first", zh: "请先填写原因", ar: "اكتب السبب أولًا" },
  "dec.failed":     { en: "Couldn't save the decision", zh: "无法保存该决定", ar: "تعذّر حفظ القرار" },
  "dec.approved":   { en: "Approved",       zh: "已批准",     ar: "تمت الموافقة" },
  "dec.rejected":   { en: "Rejected",       zh: "已拒绝",     ar: "تم الرفض" },
  "dec.returned":   { en: "Sent back",      zh: "已退回",     ar: "تمت الإعادة" },

  /* The offer to turn push on for this device (components/layout/PushNudge). */
  "push.title":     { en: "Get notifications on this device", zh: "在此设备上接收通知", ar: "استلم الإشعارات على هذا الجهاز" },
  "push.why":       { en: "Alerts reach you even when Koleex Hub is closed.", zh: "即使 Koleex Hub 未打开，也能收到提醒。", ar: "تصلك التنبيهات حتى عندما يكون Koleex Hub مغلقًا." },
  "push.install":   { en: "First add Koleex Hub to your Home Screen: tap Share, then Add to Home Screen. Open it from the new icon and turn notifications on there.", zh: "请先将 Koleex Hub 添加到主屏幕：点按“共享”，再点“添加到主屏幕”。然后从新图标打开，并在那里开启通知。", ar: "أضف Koleex Hub أولًا إلى الشاشة الرئيسية: اضغط «مشاركة» ثم «إضافة إلى الشاشة الرئيسية». افتحه من الأيقونة الجديدة وفعّل الإشعارات من هناك." },
  "push.turnOn":    { en: "Turn on",        zh: "开启",       ar: "تفعيل" },
  "push.turningOn": { en: "Turning on…",    zh: "正在开启…",   ar: "جارٍ التفعيل…" },
  "push.on":        { en: "Notifications are on for this device.", zh: "此设备已开启通知。", ar: "تم تفعيل الإشعارات على هذا الجهاز." },
  "push.denied":    { en: "The browser blocked notifications. Allow them in its site settings, then try again from Settings → Notifications.", zh: "浏览器已阻止通知。请在网站设置中允许，然后在 设置 → 通知 中重试。", ar: "المتصفح منع الإشعارات. اسمح بها من إعدادات الموقع، ثم أعد المحاولة من الإعدادات، قسم الإشعارات." },
  "push.failed":    { en: "Couldn't turn them on. Try again, or use Settings → Notifications.", zh: "无法开启。请重试，或前往 设置 → 通知。", ar: "تعذّر التفعيل. حاول مرة أخرى، أو من الإعدادات، قسم الإشعارات." },
  "push.dismiss":   { en: "Don't show again", zh: "不再显示",  ar: "عدم الإظهار مرة أخرى" },

  /* Pop-up cards while the Hub is in front (components/layout/NotificationCards). */
  "card.more":      { en: "+{n} more notifications", zh: "另有 {n} 条新通知", ar: "+{n} إشعارات أخرى" },
  "card.moreSub":   { en: "Open notifications", zh: "打开通知", ar: "افتح الإشعارات" },
  "card.close":     { en: "Close",          zh: "关闭",       ar: "إغلاق" },
  "card.replyPh":   { en: "Write a reply…", zh: "写回复…",     ar: "اكتب ردًا…" },
  "card.send":      { en: "Send",           zh: "发送",       ar: "إرسال" },
  "card.sent":      { en: "Sent",           zh: "已发送",     ar: "تم الإرسال" },
  "card.sendFailed": { en: "Couldn't send. Try again.", zh: "发送失败，请重试。", ar: "تعذّر الإرسال. حاول مرة أخرى." },
  "card.openChat":  { en: "Open chat",      zh: "打开对话",   ar: "فتح المحادثة" },

  /* The desktop app's system notification for a burst (lib/desktop-toast). */
  "toast.many":     { en: "{n} new notifications", zh: "{n} 条新通知", ar: "إشعارات جديدة: {n}" },
};
