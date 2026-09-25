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
     ATTACHMENT VALIDATION (Unit 2)
     Shown when a file is refused BEFORE it is uploaded. The server and the
     storage bucket enforce the same rules; these strings exist so the user is
     told WHY instead of watching a file silently vanish (the old behaviour).
     {max} is substituted with the limit in whole megabytes.
     ═══════════════════════════════════════════════════════════════════════════ */
  "upload.rejectedType":    { en: "That file type isn't supported",
                              zh: "不支持该文件类型",
                              ar: "نوع الملف هذا غير مدعوم" },
  "upload.rejectedSize":    { en: "File is too large (max {max}MB)",
                              zh: "文件过大（上限 {max}MB）",
                              ar: "الملف كبير جدًا (الحد الأقصى {max} ميغابايت)" },
  "upload.failed":          { en: "Upload failed. Please try again",
                              zh: "上传失败，请重试",
                              ar: "فشل الرفع. حاول مرة أخرى" },

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

  /* ── Translation ── */
  "translate.title":        { en: "Translation",           zh: "翻译",                 ar: "الترجمة" },
  "translate.auto":         { en: "Auto-translate",        zh: "自动翻译",              ar: "الترجمة التلقائية" },
  "translate.autoHint":     { en: "Show every incoming message in your language.", zh: "以您的语言显示每条收到的消息。", ar: "اعرض كل رسالة واردة بلغتك." },
  "translate.language":     { en: "Translate to",          zh: "翻译为",                ar: "الترجمة إلى" },
  "translate.action":       { en: "Translate",             zh: "翻译",                 ar: "ترجمة" },
  "translate.working":      { en: "Translating…",          zh: "翻译中…",               ar: "جارٍ الترجمة…" },
  "translate.translatedTo": { en: "Translated · {lang}",   zh: "已翻译 · {lang}",        ar: "مترجم · {lang}" },
  "translate.showOriginal": { en: "Show original",         zh: "显示原文",              ar: "عرض الأصل" },
  "translate.showTranslation": { en: "Show translation",   zh: "显示翻译",              ar: "عرض الترجمة" },

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
  "new.channel.failed":     { en: "Couldn't create the channel.", zh: "无法创建频道。", ar: "تعذر إنشاء القناة." },
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
  "picker.all":              { en: "All", zh: "全部", ar: "الكل" },
  "composer.productCount":   { en: "Showing {n} of {total}", zh: "显示 {n} / 共 {total}", ar: "عرض {n} من {total}" },
  "composer.dropHere":       { en: "Drop files to attach", zh: "拖放文件以添加附件", ar: "أفلت الملفات لإرفاقها" },
  "photo.expand":            { en: "Open photo",           zh: "打开图片",           ar: "فتح الصورة" },
  "photo.save":              { en: "Save image",           zh: "保存图片",           ar: "حفظ الصورة" },
  "common.close":            { en: "Close",                zh: "关闭",              ar: "إغلاق" },
  "composer.removeAttachment": { en: "Remove attachment", zh: "移除附件", ar: "إزالة المرفق" },
  "upload.rejectedTransport": { en: "File is over the {max}MB upload limit — send it as a link instead", zh: "文件超过 {max}MB 上传限制——请改用链接发送", ar: "الملف يتجاوز حدّ الرفع {max} ميغابايت — أرسله كرابط بدلاً من ذلك" },
  "reply.cancel":            { en: "Cancel reply",            zh: "取消回复",              ar: "إلغاء الرد" },
  "reply.deletedParent":     { en: "Original message deleted", zh: "原始消息已删除",         ar: "تم حذف الرسالة الأصلية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHASE B — INLINE EDIT / REACTIONS / LINK COPY
     ═══════════════════════════════════════════════════════════════════════════ */
  "edit.saveHint":           { en: "Ctrl/⌘+Enter to save · Esc to cancel", zh: "Ctrl/⌘+Enter 保存 · Esc 取消", ar: "Ctrl/⌘+Enter للحفظ · Esc للإلغاء" },
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
  "notif.newMessage":        { en: "New message",             zh: "新消息",               ar: "رسالة جديدة" },
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

  /* ═══════════════════════════════════════════════════════════════════════════
     AUDIT 2026-09-25 — keys the code already used but the dictionary lacked
     (they rendered their English fallback in every language), plus the
     strings that were hard-coded English.
     ═══════════════════════════════════════════════════════════════════════════ */
  /* Koleex AI conversation */
  "ai.title":                { en: "Koleex AI",               zh: "Koleex AI",            ar: "Koleex AI" },
  "ai.rowHint":              { en: "Ask me anything",         zh: "有问题尽管问",           ar: "اسألني أي شيء" },
  "ai.subtitle":             { en: "Your assistant · always here", zh: "您的助手 · 随时在线", ar: "مساعدك · متواجد دائمًا" },
  "ai.placeholder":          { en: "Ask Koleex AI anything…", zh: "向 Koleex AI 提问…",     ar: "اسأل Koleex AI أي شيء…" },
  "ai.empty":                { en: "Ask me anything — I can help across the Hub.", zh: "有问题尽管问——我可以在整个中心为您提供帮助。", ar: "اسألني أي شيء — يمكنني المساعدة في كل أرجاء المركز." },
  "ai.thinking":             { en: "Thinking…",               zh: "思考中…",               ar: "جارٍ التفكير…" },
  "ai.suggest.today":        { en: "Summarise today's activity", zh: "总结今天的动态",       ar: "لخّص نشاط اليوم" },
  "ai.suggest.draft":        { en: "Draft a message to the team", zh: "给团队起草一条消息",  ar: "صُغ رسالة إلى الفريق" },
  "ai.suggest.week":         { en: "What changed this week?", zh: "本周有哪些变化？",       ar: "ما الذي تغيّر هذا الأسبوع؟" },

  /* Sidebar / conversation menu */
  "sidebar.new":             { en: "New",                     zh: "新建",                 ar: "جديد" },
  "conv.pin":                { en: "Sticky on top",           zh: "置顶聊天",              ar: "تثبيت في الأعلى" },
  "conv.unpin":              { en: "Unpin",                   zh: "取消置顶",              ar: "إلغاء التثبيت" },
  "conv.pinned":             { en: "Pinned to top",           zh: "已置顶",               ar: "تم التثبيت في الأعلى" },
  "conv.unpinned":           { en: "Unpinned",                zh: "已取消置顶",            ar: "تم إلغاء التثبيت" },
  "conv.pinnedLabel":        { en: "Pinned",                  zh: "已置顶",               ar: "مثبّتة" },
  "conv.markRead":           { en: "Mark as read",            zh: "标为已读",              ar: "وضع علامة كمقروء" },
  "conv.markUnread":         { en: "Mark as unread",          zh: "标为未读",              ar: "وضع علامة كغير مقروء" },
  "conv.mute":               { en: "Mute notifications",      zh: "消息免打扰",            ar: "كتم الإشعارات" },
  "conv.unmute":             { en: "Unmute notifications",    zh: "取消免打扰",            ar: "إلغاء كتم الإشعارات" },
  "conv.muted":              { en: "Muted",                   zh: "已开启免打扰",          ar: "تم الكتم" },
  "conv.unmuted":            { en: "Unmuted",                 zh: "已关闭免打扰",          ar: "تم إلغاء الكتم" },
  "conv.mutedLabel":         { en: "Muted",                   zh: "免打扰",               ar: "مكتومة" },
  "conv.hide":               { en: "Remove from list",        zh: "从列表中移除",          ar: "إزالة من القائمة" },
  "conv.hidden":             { en: "Removed from list",       zh: "已从列表中移除",        ar: "تمت الإزالة من القائمة" },
  "conv.delete":             { en: "Delete",                  zh: "删除",                 ar: "حذف" },
  "conv.deleteDo":           { en: "Delete",                  zh: "删除",                 ar: "حذف" },
  "conv.deleteConfirm":      { en: "Delete this conversation? It will be removed from your list.", zh: "删除此对话？它将从您的列表中移除。", ar: "حذف هذه المحادثة؟ ستُزال من قائمتك." },
  "conv.deleted":            { en: "Conversation deleted",    zh: "对话已删除",            ar: "تم حذف المحادثة" },

  /* Names / previews */
  "channel.direct":          { en: "Direct message",          zh: "私信",                 ar: "رسالة مباشرة" },
  "channel.untitled":        { en: "Untitled channel",        zh: "未命名频道",            ar: "قناة بدون اسم" },
  "channel.unknown":         { en: "Unknown",                 zh: "未知",                 ar: "غير معروف" },
  "preview.photo":           { en: "📷 Photo",                zh: "📷 图片",               ar: "📷 صورة" },
  "preview.file":            { en: "📎 File",                 zh: "📎 文件",               ar: "📎 ملف" },
  "preview.voice":           { en: "Voice message",           zh: "语音消息",              ar: "رسالة صوتية" },
  "product.viewShort":       { en: "View",                    zh: "查看",                 ar: "عرض" },
  "reply.noText":            { en: "(no text)",               zh: "（无文字）",            ar: "(بدون نص)" },
  "signin.required":         { en: "You need to sign in to use Discuss.", zh: "请先登录以使用讨论。", ar: "يجب تسجيل الدخول لاستخدام المحادثات." },

  /* Message actions + feedback */
  "msg.more":                { en: "More actions",            zh: "更多操作",              ar: "مزيد من الإجراءات" },
  "msg.deleteDo":            { en: "Delete",                  zh: "删除",                 ar: "حذف" },
  "msg.pinned":              { en: "Pinned to channel",       zh: "已置顶到频道",          ar: "تم التثبيت في القناة" },
  "msg.unpinned":            { en: "Unpinned",                zh: "已取消置顶",            ar: "تم إلغاء التثبيت" },
  "msg.starred":             { en: "Saved for later",         zh: "已保存",               ar: "تم الحفظ لاحقاً" },
  "msg.unstarred":           { en: "Removed from saved",      zh: "已从保存中移除",        ar: "تمت الإزالة من المحفوظات" },
  "error.reaction":          { en: "Couldn't update the reaction.", zh: "无法更新表情回应。", ar: "تعذر تحديث التفاعل." },
  "error.edit":              { en: "Couldn't save the edit.", zh: "无法保存修改。",         ar: "تعذر حفظ التعديل." },
  "error.delete":            { en: "Couldn't delete the message.", zh: "无法删除消息。",    ar: "تعذر حذف الرسالة." },
  "error.pin":               { en: "Couldn't pin the message.", zh: "无法置顶消息。",       ar: "تعذر تثبيت الرسالة." },
  "error.star":              { en: "Couldn't update saved messages.", zh: "无法更新已保存消息。", ar: "تعذر تحديث الرسائل المحفوظة." },
  "error.mute":              { en: "Couldn't change notifications.", zh: "无法更改通知设置。", ar: "تعذر تغيير الإشعارات." },
  "error.copy":              { en: "Couldn't copy the link.", zh: "无法复制链接。",         ar: "تعذر نسخ الرابط." },
  "new.dm.failed":           { en: "Couldn't start the conversation.", zh: "无法开始对话。", ar: "تعذر بدء المحادثة." },

  /* Thread pane / voice */
  "thread.pane.empty":       { en: "No replies yet",          zh: "暂无回复",              ar: "لا توجد ردود بعد" },
  "thread.reply.send":       { en: "Reply",                   zh: "回复",                 ar: "رد" },
  "voice.record":            { en: "Record voice",            zh: "录制语音",              ar: "تسجيل صوتي" },
  "voice.recording":         { en: "Recording…",              zh: "录音中…",               ar: "جارٍ التسجيل…" },
  "voice.uploadFailed":      { en: "Voice upload failed",     zh: "语音上传失败",          ar: "فشل رفع الرسالة الصوتية" },

  /* Details pane */
  "details.more":            { en: "More",                    zh: "更多",                 ar: "المزيد" },
  "details.customer":        { en: "Customer",                zh: "客户",                 ar: "العميل" },
  "details.none":            { en: "Nothing here yet",        zh: "这里还没有内容",         ar: "لا يوجد شيء هنا بعد" },

  /* Search / pickers / generic */
  "search.panel.placeholder":{ en: "Search messages, people, files…", zh: "搜索消息、成员、文件…", ar: "ابحث عن رسائل، أشخاص، ملفات…" },
  "search.panel.prompt":     { en: "Type at least 2 characters to search", zh: "至少输入 2 个字符进行搜索", ar: "اكتب حرفين على الأقل للبحث" },
  "search.panel.emptyHint":  { en: "Try different words or shorter phrases.", zh: "请尝试其他词语或更短的短语。", ar: "جرّب كلمات مختلفة أو عبارات أقصر." },
  "composer.productSearch":  { en: "Search by name, code, brand, category, tags…", zh: "按名称、型号、品牌、类别、标签搜索…", ar: "ابحث بالاسم أو الرمز أو العلامة التجارية أو الفئة أو الوسوم…" },
  "customer.newChat.error":  { en: "Couldn't start the conversation", zh: "无法开始对话",      ar: "تعذر بدء المحادثة" },
  "customer.newChat.noResultsHint": { en: "Add them in the CRM first, then come back here.", zh: "请先在 CRM 中添加，然后再回到这里。", ar: "أضفهم في CRM أولاً ثم عد إلى هنا." },
  "btn.clear":               { en: "Clear",                   zh: "清除",                 ar: "مسح" },
  "btn.creating":            { en: "Starting…",               zh: "正在开始…",             ar: "جارٍ البدء…" },

  /* ═══════════════════════════════════════════════════════════════════════════
     2026-09-26 ADDITIONS — failed sends, mentions autocomplete, channel admin,
     quick switcher, unread pill, mark-all-read. {n} / {name} are substituted.
     ═══════════════════════════════════════════════════════════════════════════ */
  "send.notSent":            { en: "Not sent",                zh: "未发送",                ar: "لم تُرسل" },
  "send.retry":              { en: "Retry",                   zh: "重试",                 ar: "إعادة المحاولة" },
  "send.discard":            { en: "Delete",                  zh: "删除",                 ar: "حذف" },
  "send.sending":            { en: "Sending…",                zh: "发送中…",               ar: "جارٍ الإرسال…" },
  "send.failedRetry":        { en: "Message not sent. Tap Retry to send it again.", zh: "消息未发送。点击“重试”再次发送。", ar: "لم تُرسل الرسالة. اضغط «إعادة المحاولة» لإرسالها مجددًا." },
  "composer.pasted":         { en: "Pasted from clipboard",   zh: "已从剪贴板粘贴",         ar: "تم اللصق من الحافظة" },
  "mention.suggestions":     { en: "Mention suggestions",     zh: "提及建议",              ar: "اقتراحات الإشارة" },
  "mention.none":            { en: "No matching members",     zh: "没有匹配的成员",         ar: "لا يوجد أعضاء مطابقون" },
  "mention.hint":            { en: "↑↓ to choose · Enter to insert · Esc to close", zh: "↑↓ 选择 · Enter 插入 · Esc 关闭", ar: "↑↓ للاختيار · Enter للإدراج · Esc للإغلاق" },
  "reactions.quick":         { en: "Quick reactions",         zh: "快速回应",              ar: "تفاعلات سريعة" },
  "reactions.react":         { en: "React with {emoji}",      zh: "用 {emoji} 回应",        ar: "تفاعل بـ {emoji}" },
  "unread.pill":             { en: "{n} new",                 zh: "{n} 条新消息",           ar: "{n} جديدة" },
  "unread.jumpLatest":       { en: "Jump to latest",          zh: "跳到最新",              ar: "الانتقال إلى الأحدث" },
  "sidebar.menu":            { en: "Conversation list options", zh: "对话列表选项",        ar: "خيارات قائمة المحادثات" },
  "sidebar.markAllRead":     { en: "Mark all as read",        zh: "全部标为已读",           ar: "وضع علامة مقروء على الكل" },
  "sidebar.markAllReadDone": { en: "All conversations marked as read", zh: "已将所有对话标为已读", ar: "تم وضع علامة مقروء على كل المحادثات" },
  "sidebar.markAllReadFailed": { en: "Couldn't mark everything as read.", zh: "无法全部标为已读。", ar: "تعذر وضع علامة مقروء على الكل." },
  "switcher.title":          { en: "Jump to a conversation",  zh: "跳转到对话",            ar: "الانتقال إلى محادثة" },
  "switcher.placeholder":    { en: "Type a channel or person…", zh: "输入频道或人员…",      ar: "اكتب اسم قناة أو شخص…" },
  "switcher.hint":           { en: "↑↓ to move · Enter to open · Esc to close", zh: "↑↓ 移动 · Enter 打开 · Esc 关闭", ar: "↑↓ للتنقل · Enter للفتح · Esc للإغلاق" },
  "switcher.shortcut":       { en: "Quick switcher (Ctrl/⌘ K)", zh: "快速切换（Ctrl/⌘ K）", ar: "مبدّل سريع (Ctrl/⌘ K)" },
  "project.badge":           { en: "Project",                 zh: "项目",                 ar: "مشروع" },
  "project.open":            { en: "Open linked project",     zh: "打开关联项目",           ar: "فتح المشروع المرتبط" },
  "admin.addMembers":        { en: "Add members",             zh: "添加成员",              ar: "إضافة أعضاء" },
  "admin.addSelected":       { en: "Add {n}",                 zh: "添加 {n} 人",           ar: "إضافة {n}" },
  "admin.added":             { en: "Members added",           zh: "已添加成员",            ar: "تمت إضافة الأعضاء" },
  "admin.noneToAdd":         { en: "Everyone is already here", zh: "所有人都已在此",        ar: "الجميع موجود بالفعل" },
  "admin.remove":            { en: "Remove from channel",     zh: "移出频道",              ar: "إزالة من القناة" },
  "admin.removeConfirm":     { en: "Remove {name} from this conversation?", zh: "将 {name} 移出此对话？", ar: "هل تريد إزالة {name} من هذه المحادثة؟" },
  "admin.removed":           { en: "Member removed",          zh: "已移除成员",            ar: "تمت إزالة العضو" },
  "admin.makeAdmin":         { en: "Make admin",              zh: "设为管理员",            ar: "تعيين كمسؤول" },
  "admin.makeMember":        { en: "Remove admin role",       zh: "取消管理员",            ar: "إزالة دور المسؤول" },
  "admin.roleChanged":       { en: "Role updated",            zh: "角色已更新",            ar: "تم تحديث الدور" },
  "admin.roleAdmin":         { en: "Admin",                   zh: "管理员",               ar: "مسؤول" },
  "admin.memberActions":     { en: "Actions for {name}",      zh: "{name} 的操作",         ar: "إجراءات {name}" },
  "admin.rename":            { en: "Rename",                  zh: "重命名",               ar: "إعادة تسمية" },
  "admin.renamed":           { en: "Conversation renamed",    zh: "已重命名对话",           ar: "تمت إعادة تسمية المحادثة" },
  "admin.nameLabel":         { en: "Conversation name",       zh: "对话名称",              ar: "اسم المحادثة" },
  "admin.leave":             { en: "Leave conversation",      zh: "退出对话",              ar: "مغادرة المحادثة" },
  "admin.leaveConfirm":      { en: "Leave this conversation? You will stop receiving its messages.", zh: "退出此对话？您将不再收到其消息。", ar: "هل تريد مغادرة هذه المحادثة؟ لن تتلقى رسائلها بعد الآن." },
  "admin.left":              { en: "You left the conversation", zh: "您已退出对话",         ar: "لقد غادرت المحادثة" },
  "admin.archive":           { en: "Archive conversation",    zh: "归档对话",              ar: "أرشفة المحادثة" },
  "admin.archiveConfirm":    { en: "Archive this conversation for everyone? It will disappear from every member's list.", zh: "为所有人归档此对话？它将从每位成员的列表中消失。", ar: "هل تريد أرشفة هذه المحادثة للجميع؟ ستختفي من قائمة كل الأعضاء." },
  "admin.archived":          { en: "Conversation archived",   zh: "对话已归档",            ar: "تمت أرشفة المحادثة" },
  "admin.failed":            { en: "That didn't work. Please try again.", zh: "操作失败，请重试。", ar: "لم ينجح ذلك. حاول مرة أخرى." },
  "admin.lastAdmin":         { en: "A conversation needs at least one admin.", zh: "对话至少需要一位管理员。", ar: "تحتاج المحادثة إلى مسؤول واحد على الأقل." },
  "admin.dangerZone":        { en: "Conversation",            zh: "对话",                 ar: "المحادثة" },
  "keyboard.editLast":       { en: "↑ in an empty box edits your last message", zh: "空白输入框中按 ↑ 可编辑上一条消息", ar: "اضغط ↑ في مربع فارغ لتعديل آخر رسالة لك" },
};
