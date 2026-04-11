import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   discuss — i18n dictionary for the Discuss (team chat) app.
   Structure mirrors src/lib/translations/contacts.ts:
   flat keys grouped by UI region (sidebar.*, thread.*, composer.*, etc.).

   EN is the source-of-truth; zh/ar are best-effort translations that should
   be reviewed with native speakers before a public launch. Keys are kept
   short and human-readable so they can double as readable English fallbacks.
   --------------------------------------------------------------------------- */

export const discussT: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     PAGE CHROME
     ═══════════════════════════════════════════════════════════════════════════ */
  "title":                  { en: "Discuss",               zh: "讨论",                 ar: "المحادثات" },
  "subtitle":               { en: "Team chat & customer conversations", zh: "团队聊天和客户对话", ar: "دردشة الفريق ومحادثات العملاء" },
  "back":                   { en: "Back",                  zh: "返回",                 ar: "رجوع" },
  "hub":                    { en: "Hub",                   zh: "中心",                 ar: "المركز" },
  "loading":                { en: "Loading...",            zh: "加载中...",             ar: "جارٍ التحميل..." },
  "empty":                  { en: "Nothing here yet",      zh: "这里还没有内容",          ar: "لا يوجد شيء هنا بعد" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SIDEBAR — channel list, filters, controls
     ═══════════════════════════════════════════════════════════════════════════ */
  "sidebar.search":         { en: "Search Discuss",        zh: "搜索讨论",              ar: "ابحث في المحادثات" },
  "sidebar.newChannel":     { en: "New Channel",           zh: "新建频道",              ar: "قناة جديدة" },
  "sidebar.newDirect":      { en: "New Direct Message",    zh: "新建私信",              ar: "رسالة مباشرة جديدة" },
  "sidebar.newMessage":     { en: "New Message",           zh: "新消息",               ar: "رسالة جديدة" },
  "sidebar.channels":       { en: "Channels",              zh: "频道",                 ar: "القنوات" },
  "sidebar.directs":        { en: "Direct Messages",       zh: "私信",                 ar: "الرسائل المباشرة" },
  "sidebar.customers":      { en: "Customer Chats",        zh: "客户聊天",              ar: "محادثات العملاء" },
  "sidebar.starred":        { en: "Starred",               zh: "已收藏",               ar: "المميّزة" },
  "sidebar.drafts":         { en: "Drafts",                zh: "草稿",                 ar: "المسودات" },
  "sidebar.archived":       { en: "Archived",              zh: "已归档",               ar: "المؤرشفة" },
  "sidebar.unread":         { en: "Unread",                zh: "未读",                 ar: "غير مقروء" },
  "sidebar.all":            { en: "All",                   zh: "全部",                 ar: "الكل" },
  "sidebar.empty":          { en: "No conversations yet",  zh: "暂无对话",              ar: "لا توجد محادثات بعد" },
  "sidebar.emptyHint":      { en: "Start a channel or DM to chat with your team", zh: "创建频道或私信与您的团队聊天", ar: "ابدأ قناة أو رسالة مباشرة للدردشة مع فريقك" },
  "sidebar.filter.all":     { en: "All",                   zh: "全部",                 ar: "الكل" },
  "sidebar.filter.unread":  { en: "Unread",                zh: "未读",                 ar: "غير مقروء" },
  "sidebar.filter.mentions":{ en: "Mentions",              zh: "提及",                 ar: "الإشارات" },

  /* ═══════════════════════════════════════════════════════════════════════════
     CHANNEL HEADER — title, members, actions
     ═══════════════════════════════════════════════════════════════════════════ */
  "header.members":         { en: "Members",               zh: "成员",                 ar: "الأعضاء" },
  "header.memberCount":     { en: "{count} members",       zh: "{count} 位成员",        ar: "{count} أعضاء" },
  "header.onlineCount":     { en: "{count} online",        zh: "{count} 在线",          ar: "{count} متصل" },
  "header.details":         { en: "Details",               zh: "详情",                 ar: "التفاصيل" },
  "header.pinned":          { en: "Pinned",                zh: "置顶",                 ar: "المثبّتة" },
  "header.files":           { en: "Files",                 zh: "文件",                 ar: "الملفات" },
  "header.search":          { en: "Search in conversation", zh: "在对话中搜索",          ar: "ابحث في المحادثة" },
  "header.call":            { en: "Start Call",            zh: "发起通话",              ar: "ابدأ مكالمة" },
  "header.video":           { en: "Start Video",           zh: "发起视频",              ar: "ابدأ فيديو" },
  "header.mute":            { en: "Mute",                  zh: "静音",                 ar: "كتم" },
  "header.unmute":          { en: "Unmute",                zh: "取消静音",              ar: "إلغاء الكتم" },
  "header.leave":           { en: "Leave Channel",         zh: "离开频道",              ar: "مغادرة القناة" },
  "header.archive":         { en: "Archive",               zh: "归档",                 ar: "أرشفة" },
  "header.settings":        { en: "Channel Settings",      zh: "频道设置",              ar: "إعدادات القناة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     MESSAGE THREAD
     ═══════════════════════════════════════════════════════════════════════════ */
  "thread.empty.title":     { en: "Start the conversation", zh: "开始对话",              ar: "ابدأ المحادثة" },
  "thread.empty.channel":   { en: "This is the start of #{name}. Say hello to your team.", zh: "这是 #{name} 的开始。向您的团队打个招呼。", ar: "هذه بداية #{name}. رحّب بفريقك." },
  "thread.empty.direct":    { en: "This is the start of your conversation with {name}.", zh: "这是您与 {name} 对话的开始。", ar: "هذه بداية محادثتك مع {name}." },
  "thread.new":             { en: "New messages",          zh: "新消息",               ar: "رسائل جديدة" },
  "thread.today":           { en: "Today",                 zh: "今天",                 ar: "اليوم" },
  "thread.yesterday":       { en: "Yesterday",             zh: "昨天",                 ar: "أمس" },
  "thread.scrollToBottom":  { en: "Jump to latest",        zh: "跳到最新",              ar: "الانتقال إلى الأحدث" },
  "thread.typing.one":      { en: "{name} is typing…",     zh: "{name} 正在输入...",    ar: "{name} يكتب..." },
  "thread.typing.two":      { en: "{a} and {b} are typing…", zh: "{a} 和 {b} 正在输入...", ar: "{a} و {b} يكتبان..." },
  "thread.typing.many":     { en: "Several people are typing…", zh: "多人正在输入...",    ar: "عدة أشخاص يكتبون..." },
  "thread.edited":          { en: "edited",                zh: "已编辑",               ar: "معدّلة" },
  "thread.deleted":         { en: "This message was deleted", zh: "此消息已被删除",        ar: "تم حذف هذه الرسالة" },
  "thread.unreadMarker":    { en: "New",                   zh: "新",                   ar: "جديد" },
  "thread.loadMore":        { en: "Load earlier messages", zh: "加载更早的消息",          ar: "تحميل الرسائل السابقة" },
  "thread.select":          { en: "Select a conversation to start chatting", zh: "选择一个对话开始聊天", ar: "اختر محادثة للبدء في الدردشة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     MESSAGE ACTIONS
     ═══════════════════════════════════════════════════════════════════════════ */
  "msg.reply":              { en: "Reply",                 zh: "回复",                 ar: "رد" },
  "msg.replyInThread":      { en: "Reply in thread",       zh: "在话题中回复",           ar: "الرد في سلسلة" },
  "msg.react":              { en: "Add reaction",          zh: "添加反应",              ar: "أضف تفاعلاً" },
  "msg.forward":            { en: "Forward",               zh: "转发",                 ar: "إعادة توجيه" },
  "msg.copy":                { en: "Copy text",             zh: "复制文本",              ar: "نسخ النص" },
  "msg.copyLink":           { en: "Copy link",             zh: "复制链接",              ar: "نسخ الرابط" },
  "msg.edit":               { en: "Edit",                  zh: "编辑",                 ar: "تعديل" },
  "msg.delete":             { en: "Delete",                zh: "删除",                 ar: "حذف" },
  "msg.pin":                { en: "Pin to channel",        zh: "置顶到频道",            ar: "تثبيت في القناة" },
  "msg.unpin":              { en: "Unpin",                 zh: "取消置顶",              ar: "إلغاء التثبيت" },
  "msg.star":               { en: "Save for later",        zh: "稍后保存",              ar: "احفظ لاحقاً" },
  "msg.unstar":             { en: "Remove from saved",     zh: "从已保存中移除",          ar: "إزالة من المحفوظات" },
  "msg.markUnread":         { en: "Mark unread from here", zh: "从此处标记未读",         ar: "وضع علامة غير مقروء من هنا" },
  "msg.report":             { en: "Report",                zh: "举报",                 ar: "إبلاغ" },
  "msg.deleteConfirm":      { en: "Delete this message? This cannot be undone.", zh: "删除此消息？此操作无法撤销。", ar: "حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء." },

  /* ═══════════════════════════════════════════════════════════════════════════
     COMPOSER — input, attachments, send
     ═══════════════════════════════════════════════════════════════════════════ */
  "composer.placeholder":   { en: "Message #{channel}",    zh: "发送消息到 #{channel}",  ar: "أرسل رسالة إلى #{channel}" },
  "composer.placeholderDm": { en: "Message {name}",        zh: "发送消息给 {name}",      ar: "أرسل رسالة إلى {name}" },
  "composer.placeholderGeneric": { en: "Write a message…", zh: "输入消息...",           ar: "اكتب رسالة..." },
  "composer.send":          { en: "Send",                  zh: "发送",                 ar: "إرسال" },
  "composer.sending":       { en: "Sending…",              zh: "发送中...",             ar: "جارٍ الإرسال..." },
  "composer.attach":        { en: "Attach files",          zh: "附加文件",              ar: "إرفاق ملفات" },
  "composer.photo":         { en: "Attach photo",          zh: "附加照片",              ar: "إرفاق صورة" },
  "composer.video":         { en: "Attach video",          zh: "附加视频",              ar: "إرفاق فيديو" },
  "composer.document":      { en: "Attach document",       zh: "附加文档",              ar: "إرفاق مستند" },
  "composer.product":       { en: "Mention product",       zh: "提及产品",              ar: "أشر إلى منتج" },
  "composer.mention":       { en: "Mention someone",       zh: "提及某人",              ar: "أشر إلى شخص" },
  "composer.emoji":         { en: "Emoji",                 zh: "表情",                 ar: "إيموجي" },
  "composer.voice":         { en: "Voice message",         zh: "语音消息",              ar: "رسالة صوتية" },
  "composer.voice.recording": { en: "Recording…",          zh: "录音中...",             ar: "جارٍ التسجيل..." },
  "composer.voice.stop":    { en: "Stop",                  zh: "停止",                 ar: "إيقاف" },
  "composer.voice.send":    { en: "Send voice",            zh: "发送语音",              ar: "إرسال الصوت" },
  "composer.voice.discard": { en: "Discard",               zh: "丢弃",                 ar: "تجاهل" },
  "composer.formatting":    { en: "Formatting",            zh: "格式",                 ar: "التنسيق" },
  "composer.bold":          { en: "Bold",                  zh: "粗体",                 ar: "عريض" },
  "composer.italic":        { en: "Italic",                zh: "斜体",                 ar: "مائل" },
  "composer.strike":        { en: "Strikethrough",         zh: "删除线",               ar: "يتوسطه خط" },
  "composer.code":          { en: "Inline code",           zh: "行内代码",              ar: "رمز مضمّن" },
  "composer.codeBlock":     { en: "Code block",            zh: "代码块",               ar: "كتلة رمز" },
  "composer.link":          { en: "Link",                  zh: "链接",                 ar: "رابط" },
  "composer.quote":         { en: "Quote",                 zh: "引用",                 ar: "اقتباس" },
  "composer.bullets":       { en: "Bulleted list",         zh: "项目符号列表",           ar: "قائمة نقطية" },
  "composer.numbered":      { en: "Numbered list",         zh: "编号列表",              ar: "قائمة مرقّمة" },
  "composer.draftSaved":    { en: "Draft saved",           zh: "草稿已保存",            ar: "تم حفظ المسودة" },
  "composer.draftRestored": { en: "Draft restored",        zh: "草稿已恢复",            ar: "تمت استعادة المسودة" },
  "composer.enterToSend":   { en: "Enter to send, Shift+Enter for a new line", zh: "按 Enter 发送，Shift+Enter 换行", ar: "Enter للإرسال، Shift+Enter لسطر جديد" },
  "composer.uploading":     { en: "Uploading…",            zh: "上传中...",             ar: "جارٍ الرفع..." },
  "composer.uploadFailed":  { en: "Upload failed",         zh: "上传失败",              ar: "فشل الرفع" },

  /* ═══════════════════════════════════════════════════════════════════════════
     NEW CHANNEL / NEW DM MODALS
     ═══════════════════════════════════════════════════════════════════════════ */
  "new.channel.title":      { en: "Create a Channel",      zh: "创建频道",              ar: "إنشاء قناة" },
  "new.channel.name":       { en: "Channel name",          zh: "频道名称",              ar: "اسم القناة" },
  "new.channel.namePh":     { en: "e.g. sales-team",       zh: "例如 sales-team",       ar: "مثال: sales-team" },
  "new.channel.topic":      { en: "Topic (optional)",      zh: "主题（可选）",           ar: "الموضوع (اختياري)" },
  "new.channel.topicPh":    { en: "What's this channel about?", zh: "这个频道是关于什么的？", ar: "عن ماذا تدور هذه القناة؟" },
  "new.channel.description":{ en: "Description",           zh: "描述",                 ar: "الوصف" },
  "new.channel.public":     { en: "Public",                zh: "公开",                 ar: "عامة" },
  "new.channel.publicDesc": { en: "Anyone in Koleex can join", zh: "Koleex 中的任何人都可以加入", ar: "يمكن لأي شخص في Koleex الانضمام" },
  "new.channel.private":    { en: "Private",               zh: "私密",                 ar: "خاصة" },
  "new.channel.privateDesc":{ en: "Only invited members can join", zh: "只有被邀请的成员可以加入", ar: "يمكن فقط للأعضاء المدعوين الانضمام" },
  "new.channel.create":     { en: "Create Channel",        zh: "创建频道",              ar: "إنشاء القناة" },
  "new.dm.title":           { en: "New Direct Message",    zh: "新建私信",              ar: "رسالة مباشرة جديدة" },
  "new.dm.to":              { en: "To",                    zh: "收件人",               ar: "إلى" },
  "new.dm.toPh":            { en: "Type a name…",          zh: "输入姓名...",           ar: "اكتب اسماً..." },
  "new.dm.start":           { en: "Start Chat",            zh: "开始聊天",              ar: "ابدأ الدردشة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     DETAILS PANE (right column)
     ═══════════════════════════════════════════════════════════════════════════ */
  "details.about":          { en: "About",                 zh: "关于",                 ar: "حول" },
  "details.members":        { en: "Members",               zh: "成员",                 ar: "الأعضاء" },
  "details.addMember":      { en: "Add members",           zh: "添加成员",              ar: "إضافة أعضاء" },
  "details.files":          { en: "Shared files",          zh: "共享文件",              ar: "الملفات المشتركة" },
  "details.photos":         { en: "Photos & videos",       zh: "照片和视频",            ar: "الصور والفيديوهات" },
  "details.links":          { en: "Links",                 zh: "链接",                 ar: "الروابط" },
  "details.pinned":         { en: "Pinned messages",       zh: "置顶消息",              ar: "الرسائل المثبّتة" },
  "details.notifications":  { en: "Notifications",         zh: "通知",                 ar: "الإشعارات" },
  "details.notif.all":      { en: "All messages",          zh: "所有消息",              ar: "كل الرسائل" },
  "details.notif.mentions": { en: "Mentions only",         zh: "仅提及",               ar: "الإشارات فقط" },
  "details.notif.none":     { en: "Nothing",               zh: "无",                   ar: "لا شيء" },
  "details.status.online":  { en: "Online",                zh: "在线",                 ar: "متصل" },
  "details.status.away":    { en: "Away",                  zh: "离开",                 ar: "بعيد" },
  "details.status.busy":    { en: "Busy",                  zh: "忙碌",                 ar: "مشغول" },
  "details.status.offline": { en: "Offline",               zh: "离线",                 ar: "غير متصل" },
  "details.lastSeen":       { en: "Last seen {time}",      zh: "最后活跃 {time}",        ar: "آخر ظهور {time}" },
  "details.leave":          { en: "Leave Channel",         zh: "离开频道",              ar: "مغادرة القناة" },
  "details.block":          { en: "Block",                 zh: "屏蔽",                 ar: "حظر" },
  "details.report":         { en: "Report",                zh: "举报",                 ar: "إبلاغ" },

  /* ═══════════════════════════════════════════════════════════════════════════
     CUSTOMER CHAT (external)
     ═══════════════════════════════════════════════════════════════════════════ */
  "customer.label":         { en: "Customer",              zh: "客户",                 ar: "عميل" },
  "customer.assignedTo":    { en: "Assigned to",           zh: "分配给",               ar: "مُعيّن إلى" },
  "customer.openTicket":    { en: "Open support ticket",   zh: "打开支持工单",           ar: "فتح تذكرة دعم" },
  "customer.viewContact":   { en: "View contact",          zh: "查看联系人",            ar: "عرض جهة الاتصال" },

  /* ═══════════════════════════════════════════════════════════════════════════
     ATTACHMENTS / FILE PREVIEW
     ═══════════════════════════════════════════════════════════════════════════ */
  "file.download":          { en: "Download",              zh: "下载",                 ar: "تنزيل" },
  "file.open":              { en: "Open",                  zh: "打开",                 ar: "فتح" },
  "file.preview":           { en: "Preview",               zh: "预览",                 ar: "معاينة" },
  "file.size":              { en: "Size",                  zh: "大小",                 ar: "الحجم" },
  "file.type":              { en: "Type",                  zh: "类型",                 ar: "النوع" },
  "file.uploadedBy":        { en: "Uploaded by",           zh: "上传者",               ar: "رفعه" },
  "file.uploadedAt":        { en: "Uploaded at",           zh: "上传时间",              ar: "رُفع في" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PRODUCT CARD (in-message)
     ═══════════════════════════════════════════════════════════════════════════ */
  "product.view":           { en: "View product",          zh: "查看产品",              ar: "عرض المنتج" },
  "product.addToQuote":     { en: "Add to quote",          zh: "添加到报价",            ar: "أضف إلى عرض السعر" },
  "product.sku":            { en: "SKU",                   zh: "SKU",                  ar: "SKU" },
  "product.price":          { en: "Price",                 zh: "价格",                 ar: "السعر" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SEARCH
     ═══════════════════════════════════════════════════════════════════════════ */
  "search.placeholder":     { en: "Search messages, files, people…", zh: "搜索消息、文件、成员...", ar: "ابحث عن رسائل، ملفات، أشخاص..." },
  "search.noResults":       { en: "No results",            zh: "无结果",               ar: "لا توجد نتائج" },
  "search.results":         { en: "Results",               zh: "结果",                 ar: "النتائج" },
  "search.in":              { en: "in {channel}",          zh: "在 {channel} 中",      ar: "في {channel}" },
  "search.by":              { en: "by {name}",             zh: "由 {name}",            ar: "بواسطة {name}" },

  /* ═══════════════════════════════════════════════════════════════════════════
     NOTIFICATIONS / ERRORS / STATUSES
     ═══════════════════════════════════════════════════════════════════════════ */
  "status.sent":            { en: "Sent",                  zh: "已发送",               ar: "أُرسلت" },
  "status.delivered":       { en: "Delivered",             zh: "已送达",               ar: "تم التسليم" },
  "status.read":            { en: "Read",                  zh: "已读",                 ar: "مقروءة" },
  "status.failed":          { en: "Failed to send",        zh: "发送失败",              ar: "فشل الإرسال" },
  "status.retry":           { en: "Retry",                 zh: "重试",                 ar: "إعادة المحاولة" },
  "status.offline":         { en: "You're offline",        zh: "您已离线",              ar: "أنت غير متصل" },
  "status.reconnecting":    { en: "Reconnecting…",         zh: "重新连接中...",          ar: "جارٍ إعادة الاتصال..." },

  /* ═══════════════════════════════════════════════════════════════════════════
     MOBILE NAV
     ═══════════════════════════════════════════════════════════════════════════ */
  "mobile.list":            { en: "Chats",                 zh: "聊天",                 ar: "الدردشات" },
  "mobile.thread":          { en: "Chat",                  zh: "聊天",                 ar: "الدردشة" },
  "mobile.details":         { en: "Details",               zh: "详情",                 ar: "التفاصيل" },

  /* ═══════════════════════════════════════════════════════════════════════════
     TIME / PRESENCE HELPERS
     ═══════════════════════════════════════════════════════════════════════════ */
  "time.now":               { en: "now",                   zh: "现在",                 ar: "الآن" },
  "time.minute":            { en: "{n}m",                  zh: "{n}分钟",              ar: "{n}د" },
  "time.hour":               { en: "{n}h",                  zh: "{n}小时",              ar: "{n}س" },
  "time.day":               { en: "{n}d",                  zh: "{n}天",                ar: "{n}ي" },
  "time.week":              { en: "{n}w",                  zh: "{n}周",                ar: "{n}أ" },
  "time.justNow":           { en: "just now",              zh: "刚刚",                 ar: "الآن" },

  /* ═══════════════════════════════════════════════════════════════════════════
     BUTTONS / GENERIC
     ═══════════════════════════════════════════════════════════════════════════ */
  "btn.save":               { en: "Save",                  zh: "保存",                 ar: "حفظ" },
  "btn.cancel":             { en: "Cancel",                zh: "取消",                 ar: "إلغاء" },
  "btn.close":              { en: "Close",                 zh: "关闭",                 ar: "إغلاق" },
  "btn.confirm":            { en: "Confirm",               zh: "确认",                 ar: "تأكيد" },
  "btn.remove":             { en: "Remove",                zh: "移除",                 ar: "إزالة" },
  "btn.delete":             { en: "Delete",                zh: "删除",                 ar: "حذف" },
  "btn.edit":               { en: "Edit",                  zh: "编辑",                 ar: "تعديل" },
  "btn.add":                { en: "Add",                   zh: "添加",                 ar: "إضافة" },
  "btn.send":               { en: "Send",                  zh: "发送",                 ar: "إرسال" },
  "btn.done":               { en: "Done",                  zh: "完成",                 ar: "تم" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE B — THREADS / REPLIES
     ═══════════════════════════════════════════════════════════════════════════ */
  "thread.pane.title":       { en: "Thread",                  zh: "话题",                 ar: "سلسلة المحادثة" },
  "thread.replyCount.one":   { en: "1 reply",                 zh: "1 条回复",              ar: "رد واحد" },
  "thread.replyCount.many":  { en: "{count} replies",         zh: "{count} 条回复",        ar: "{count} ردود" },
  "thread.lastReply":        { en: "Last reply {time}",       zh: "最新回复 {time}",       ar: "آخر رد {time}" },
  "thread.reply.placeholder":{ en: "Reply in thread…",        zh: "在话题中回复...",        ar: "رد في السلسلة..." },
  "thread.viewThread":       { en: "View thread",             zh: "查看话题",              ar: "عرض السلسلة" },
  "reply.replyingTo":        { en: "Replying to {name}",      zh: "回复 {name}",           ar: "الرد على {name}" },
  "reply.cancel":            { en: "Cancel reply",            zh: "取消回复",              ar: "إلغاء الرد" },
  "reply.deletedParent":     { en: "Original message deleted", zh: "原始消息已删除",         ar: "تم حذف الرسالة الأصلية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE B — INLINE EDIT / REACTIONS / LINK COPY
     ═══════════════════════════════════════════════════════════════════════════ */
  "edit.saveHint":           { en: "Enter to save · Esc to cancel", zh: "Enter 保存 · Esc 取消", ar: "Enter للحفظ · Esc للإلغاء" },
  "edit.save":               { en: "Save changes",            zh: "保存更改",              ar: "حفظ التغييرات" },
  "reactions.pick":          { en: "Pick a reaction",         zh: "选择反应",              ar: "اختر تفاعلاً" },
  "reactions.you":           { en: "You",                     zh: "你",                   ar: "أنت" },
  "reactions.andOthers":     { en: "and {count} others",      zh: "和其他 {count} 人",     ar: "و {count} آخرين" },
  "link.copied":             { en: "Link copied",             zh: "链接已复制",            ar: "تم نسخ الرابط" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE C — SEARCH PANEL
     ═══════════════════════════════════════════════════════════════════════════ */
  "search.panel.title":      { en: "Search Discuss",          zh: "搜索讨论",              ar: "ابحث في المحادثات" },
  "search.panel.hint":       { en: "Type at least 2 characters", zh: "至少输入 2 个字符",   ar: "اكتب حرفين على الأقل" },
  "search.panel.everywhere": { en: "Everywhere",              zh: "所有位置",              ar: "في كل مكان" },
  "search.panel.thisChannel":{ en: "This channel only",       zh: "仅此频道",              ar: "هذه القناة فقط" },
  "search.panel.loading":    { en: "Searching…",              zh: "搜索中...",             ar: "جارٍ البحث..." },
  "search.panel.empty":      { en: "No messages match",       zh: "没有匹配的消息",         ar: "لا توجد رسائل مطابقة" },
  "search.panel.jump":       { en: "Jump to message",         zh: "跳转到消息",            ar: "الانتقال إلى الرسالة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE C — PINNED / STARRED / DRAFTS VIEWS
     ═══════════════════════════════════════════════════════════════════════════ */
  "pinned.panel.title":      { en: "Pinned messages",         zh: "置顶消息",              ar: "الرسائل المثبّتة" },
  "pinned.panel.empty":      { en: "No pinned messages yet",  zh: "暂无置顶消息",          ar: "لا توجد رسائل مثبّتة بعد" },
  "pinned.panel.hint":       { en: "Pin important messages so everyone can find them", zh: "置顶重要消息，方便每个人查找", ar: "ثبّت الرسائل المهمة ليجدها الجميع" },
  "starred.view.title":      { en: "Saved for later",         zh: "稍后保存",              ar: "محفوظ لاحقاً" },
  "starred.view.empty":      { en: "You haven't saved anything yet", zh: "您还没有保存任何内容", ar: "لم تحفظ شيئاً بعد" },
  "starred.view.hint":       { en: "Star a message to save it to this list", zh: "为消息添加星标以保存到此列表", ar: "ميّز رسالة لحفظها هنا" },
  "drafts.view.title":       { en: "Drafts",                  zh: "草稿",                 ar: "المسودات" },
  "drafts.view.empty":       { en: "No drafts",               zh: "没有草稿",              ar: "لا توجد مسودات" },
  "drafts.view.resume":      { en: "Resume",                  zh: "继续",                 ar: "استئناف" },
  "drafts.view.discard":     { en: "Discard draft",           zh: "丢弃草稿",              ar: "تجاهل المسودة" },
  "drafts.badge":            { en: "Draft",                   zh: "草稿",                 ar: "مسودة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE C — READ RECEIPTS / LAST-READ
     ═══════════════════════════════════════════════════════════════════════════ */
  "receipts.sent":           { en: "Sent",                    zh: "已发送",               ar: "أُرسلت" },
  "receipts.read":           { en: "Read",                    zh: "已读",                 ar: "مقروءة" },
  "receipts.readBy":         { en: "Read by {count}",         zh: "{count} 人已读",        ar: "قرأها {count}" },
  "unreadDivider.label":     { en: "New messages",            zh: "新消息",               ar: "رسائل جديدة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE D — NOTIFICATIONS / DND / MUTE
     ═══════════════════════════════════════════════════════════════════════════ */
  "notif.desktop.enable":    { en: "Enable desktop notifications", zh: "启用桌面通知",      ar: "تفعيل إشعارات سطح المكتب" },
  "notif.desktop.enabled":   { en: "Desktop notifications on", zh: "桌面通知已开启",        ar: "إشعارات سطح المكتب مفعّلة" },
  "notif.desktop.denied":    { en: "Blocked by browser. Enable in site settings.", zh: "被浏览器阻止。请在站点设置中启用。", ar: "محظور بواسطة المتصفح. فعّله من إعدادات الموقع." },
  "notif.sound.on":          { en: "Sound on",                zh: "声音开",               ar: "الصوت يعمل" },
  "notif.sound.off":         { en: "Sound off",               zh: "声音关",               ar: "الصوت مغلق" },
  "notif.dnd.on":            { en: "Do Not Disturb",          zh: "免打扰",               ar: "عدم الإزعاج" },
  "notif.dnd.off":           { en: "DND off",                 zh: "关闭免打扰",            ar: "إيقاف عدم الإزعاج" },
  "notif.dnd.until":         { en: "Until {time}",            zh: "直到 {time}",          ar: "حتى {time}" },
  "notif.newMessage":        { en: "New message in {channel}", zh: "{channel} 中有新消息", ar: "رسالة جديدة في {channel}" },
  "notif.muted":             { en: "Muted",                   zh: "已静音",               ar: "تم الكتم" },
  "notif.unmuted":           { en: "Notifications on",        zh: "通知开启",              ar: "الإشعارات مفعّلة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE D — VOICE RECORDER
     ═══════════════════════════════════════════════════════════════════════════ */
  "voice.start":             { en: "Start recording",         zh: "开始录音",              ar: "بدء التسجيل" },
  "voice.stop":              { en: "Stop recording",          zh: "停止录音",              ar: "إيقاف التسجيل" },
  "voice.cancel":            { en: "Cancel",                  zh: "取消",                 ar: "إلغاء" },
  "voice.send":              { en: "Send voice",              zh: "发送语音",              ar: "إرسال الصوت" },
  "voice.preview":           { en: "Preview",                 zh: "预览",                 ar: "معاينة" },
  "voice.permissionDenied":  { en: "Microphone permission denied", zh: "麦克风权限被拒绝",   ar: "تم رفض إذن الميكروفون" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE E — CUSTOMER CHAT
     ═══════════════════════════════════════════════════════════════════════════ */
  "customer.newChat":        { en: "Start customer chat",     zh: "开始客户聊天",          ar: "بدء محادثة عميل" },
  "customer.newChat.title":  { en: "Start a customer conversation", zh: "开始与客户对话",    ar: "ابدأ محادثة مع عميل" },
  "customer.newChat.hint":   { en: "Pick a CRM contact — the chat becomes linked to their record.", zh: "选择一个 CRM 联系人 — 聊天将与他们的记录关联。", ar: "اختر جهة اتصال CRM — ستكون المحادثة مرتبطة بسجلها." },
  "customer.newChat.search": { en: "Search contacts…",        zh: "搜索联系人...",          ar: "ابحث عن جهات الاتصال..." },
  "customer.newChat.noResults": { en: "No matching contacts", zh: "没有匹配的联系人",       ar: "لا توجد جهات اتصال مطابقة" },
  "customer.newChat.create": { en: "Start chat",              zh: "开始聊天",              ar: "ابدأ المحادثة" },
  "customer.contactCard":    { en: "Customer contact",        zh: "客户联系人",            ar: "جهة اتصال العميل" },
  "customer.viewInCRM":      { en: "View in CRM",             zh: "在 CRM 中查看",         ar: "عرض في CRM" },
  "customer.linked":         { en: "Linked contact",          zh: "关联联系人",            ar: "جهة اتصال مرتبطة" },
  "customer.company":        { en: "Company",                 zh: "公司",                 ar: "الشركة" },
  "customer.email":          { en: "Email",                   zh: "邮箱",                 ar: "البريد الإلكتروني" },
  "customer.phone":          { en: "Phone",                   zh: "电话",                 ar: "الهاتف" },
  "customer.type":           { en: "Type",                    zh: "类型",                 ar: "النوع" },
};
