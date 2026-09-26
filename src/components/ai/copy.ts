/* ---------------------------------------------------------------------------
   components/ai/copy — the Koleex AI client's localised strings.

   Phase 2J, moved verbatim from KoleexAiApp.tsx. A frozen data table with no
   logic, which is why it is the second safe cut: nothing here can behave
   differently in a new file.

   EN / ZH / AR in one place so a string added for one language is visibly
   missing for the others — the type `Record<Lang, …>` makes that a compile
   error rather than a blank label discovered by a user.
   --------------------------------------------------------------------------- */

import { type Lang } from "@/lib/i18n";

/* ── Localised copy ── */
export const COPY: Record<Lang, {
  newChat: string;
  placeholder: string;
  welcomeTitle: string;
  /* The greeting with a first name, in each language's own punctuation —
     "مرحبًا, Kamal." put a Latin comma and full stop in an Arabic line. */
  welcomeTitleNamed: string;
  welcomeSub: string;
  thinking: string;
  noChats: string;
  today: string;
  yesterday: string;
  previous7: string;
  previous30: string;
  earlier: string;
  delete: string;
  rename: string;
  confirmDelete: string;
  renamePrompt: string;
  /** A rename left blank. */
  nameRequired: string;
  stopped: string;
  /** The model picker beside the message box. */
  model: string;
  modelUnavailable: string;
  modelTextOnly: string;
  /** Under a reply that a different model answered than the one asked for;
   *  {model} is the Koleex name. */
  answeredByModel: string;
  summaryWriting: string;
  thinkingTitle: string;
  thoughtFor: string;
  thinkSearching: string;
  thinkSearched: string;
  thinkReading: string;
  thinkRead: string;
  thinkingShow: string;
  thinkingHide: string;
  dropHere: string;
  recommended: string;
  otherOption: string;
  otherPlaceholder: string;
  otherSend: string;
  /* The Task card (tasks phase 2): a write tool's preview in the chat,
     saved by a tap. The same words the call screen uses. */
  taskPreview: string;
  taskUpdate: string;
  saveTask: string;
  cancelTask: string;
  savingTask: string;
  taskSaved: string;
  taskFailed: string;
  taskCancelled: string;
  openTodo: string;
  due: string;
  /* The priority words on a task card — the tool's own values are English. */
  priorityHigh: string;
  priorityLow: string;
  /** The update card's lines in words — the tool's field names ("due_date",
   *  "remind_at") and values ("weekly", "medium") were printed raw. */
  priorityMedium: string;
  taskField: Record<"title" | "description" | "priority" | "due_date" | "remind_at" | "start_date" | "label" | "recurrence" | "recurrence_until" | "is_private", string>;
  recurrenceWord: Record<"daily" | "weekly" | "monthly", string>;
  /** A task given to the whole company, in the card's "For" line. */
  everyone: string;
  yes: string;
  no: string;
  remind: string;
  forPeople: string;
  observers: string;
  mentions: string;
  repeats: string;
  privateTask: string;
  starts: string;
  searchChats: string;
  noSearchResults: string;
  /* Chrome and attachment words that were English literals inside Arabic and
     Chinese screens (audit, 2026-09-11). `removeFile` carries a {name} slot. */
  openSidebar: string;
  removeFile: string;
  uploading: string;
  attachUnreadableImage: string;
  attachNoText: string;
  attachTooLarge: string;
  attachUnsupported: string;
  /** The server refused the turn as too long (413). */
  messageTooLong: string;
  /** Shown above the composer while the device reports no network. */
  offline: string;
  /** The last call was cut by the page dying under it: one tap continues. */
  callCutOff: string;
  /** A call whose line dropped and did not come back (the app was fine). */
  callDropped: string;
  continueCall: string;
  dismiss: string;
  /* Projects + pinning */
  projects: string;
  newProject: string;
  editProject: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
  deleteProject: string;
  confirmDeleteProject: string;
  emptyProject: string;
  pin: string;
  unpin: string;
  pinned: string;
  moveTo: string;
  noProject: string;
  more: string;
  recents: string;
  /* Roadmap C3 — the picture gallery. */
  library: string;
  libraryEmpty: string;
  openChat: string;
  /* Roadmap D2 — past calls by their summaries. */
  calls: string;
  callsEmpty: string;
  /* Roadmap D5 — one chat as a printable page. */
  exportChat: string;
  back: string;
  seeMore: string;
  seeLess: string;
  save: string;
  cancel: string;
  /* ── CONTROL LABELS ────────────────────────────────────────────────────
     Every one of these was a hardcoded English literal sitting inside an
     `aria-label` or a `title`, in a product whose every visible word is
     translated. Two different people were getting an English interface: a
     screen-reader user on Arabic heard "Regenerate response" in the middle
     of an Arabic conversation, and — because `title` is a tooltip, not an
     accessibility affordance — EVERY Arabic and Chinese user saw English
     the moment they hovered a toolbar button.

     They were not missing because there was no system for them. The system
     is this file; they simply never got added to it. */
  readAloud: string;
  regenerate: string;
  goodResponse: string;
  badResponse: string;
  messageActions: string;
  editAndRetry: string;
  saveAndRetry: string;
  cancelEdit: string;
  closeSidebar: string;
  collapseSidebar: string;
  expandSidebar: string;
  aiKnowledge: string;
  /* Sidebar link to Settings → Koleex AI. */
  personalize: string;
  backToHub: string;
  jumpToLatest: string;
  searchWeb: string;
  /* The one "+" in the message box (ComposerAddMenu) and the chip that
     shows web search is on. */
  addMenu: string;
  attachFilesPhotos: string;
  webSearchChip: string;
  webSearchChipOff: string;
  stopGenerating: string;
  send: string;
  /* The composer and the edit box have no visible label — a placeholder is
     not one, and it disappears the moment anyone types. */
  composerLabel: string;
  editMessageLabel: string;
  /* `thinking` is the words on screen; this is what a screen reader
     announces for the same state, which needs a subject to make sense. */
  thinkingAria: string;
  /** The mark on a message that was spoken on a call rather than typed. */
  voiceMessage: string;
  /* Audit 2026-09-07: every string a person could READ was English on the
     Arabic and Chinese screens — the attached-file default question (which
     lands in the user's own bubble and in the database), the errors, the
     small controls. Each is a key now, so a missing language is a compile
     error rather than an English surprise. */
  attachDefaultPrompt: string;
  latest: string;
  copied: string;
  copyMessage: string;
  copyCode: string;
  codeLabel: string;
  closePhoto: string;
  /** A picture in an answer that has no name of its own. */
  photo: string;
  /** Said to a screen reader when a reply has finished. */
  replyReady: string;
  loadFailed: string;
  retry: string;
  supportedFiles: string;
  /** Template: {name}, {size}, {cap}, {kind}. */
  fileTooLarge: string;
  kindImages: string;
  kindDocuments: string;
  attachError: string;
  attachNothingRead: string;
  noReply: string;
  aiUnavailable: string;
  /** A chat turn's failures in the chat's own words (chat-error.ts): the
   *  link dropped, the answer failed, anything else. Egyptian, not the
   *  Hub's formal Arabic, and never the server's English sentence. */
  networkDropped: string;
  answerFailed: string;
  somethingWrong: string;
  couldNotStartChat: string;
  editShort: string;
  draftNeedsApproval: string;
  draftLabel: string;
  /** Templates: {n}. */
  lineOne: string;
  linesCount: string;
  reviewInQuotations: string;
  prompts: string[];
}> = {
  en: {
    taskPreview: "New task",
    taskUpdate: "Task change",
    saveTask: "Save task",
    cancelTask: "Cancel",
    savingTask: "Saving…",
    taskSaved: "Task saved",
    taskFailed: "Could not save it. Try again.",
    taskCancelled: "Not saved",
    openTodo: "Open in To-do",
    due: "Due",
    priorityHigh: "High priority",
    priorityLow: "Low priority",
    priorityMedium: "Medium priority",
    taskField: { title: "Title", description: "Notes", priority: "Priority", due_date: "Due", remind_at: "Reminder", start_date: "Starts", label: "Label", recurrence: "Repeats", recurrence_until: "Repeats until", is_private: "Private" },
    recurrenceWord: { daily: "Every day", weekly: "Every week", monthly: "Every month" },
    everyone: "Everyone",
    yes: "Yes",
    no: "No",
    remind: "Reminder",
    forPeople: "For",
    observers: "Following",
    mentions: "Told",
    repeats: "Repeats",
    privateTask: "Private",
    starts: "Starts",
    newChat: "New chat",
    placeholder: "Ask Koleex AI…",
    welcomeTitle: "Hi",
    welcomeTitleNamed: "Hi, {name}.",
    welcomeSub: "What's on your mind? I'm Koleex AI — ask me anything, big or small.",
    thinking: "Thinking…",
    noChats: "No chats yet",
    today: "Today",
    yesterday: "Yesterday",
    previous7: "Previous 7 days",
    previous30: "Previous 30 days",
    earlier: "Earlier",
    delete: "Delete",
    rename: "Rename",
    confirmDelete: "Delete this conversation?",
    renamePrompt: "New title",
    nameRequired: "Write a name first.",
    stopped: "Stopped",
    model: "Model",
    modelUnavailable: "Not available right now",
    modelTextOnly: "Text only",
    answeredByModel: "Answered by {model}",
    summaryWriting: "Writing the call summary…",
    thinkingTitle: "Thinking",
    thoughtFor: "Thought for {s}s",
    thinkSearching: "Searching",
    thinkSearched: "Searched",
    thinkReading: "Reading",
    thinkRead: "Read",
    thinkingShow: "Show how it thought",
    thinkingHide: "Hide how it thought",
    dropHere: "Drop files to attach",
    recommended: "Recommended",
    otherOption: "Something else",
    otherPlaceholder: "Tell me what you mean…",
    otherSend: "Send",
    searchChats: "Search chats…",
    noSearchResults: "No chats match your search.",
    openSidebar: "Open sidebar",
    removeFile: "Remove {name}",
    uploading: "Uploading",
    attachUnreadableImage: "couldn't read this image — try a sharper photo",
    attachNoText: "no readable text found",
    attachTooLarge: "over the size limit (15MB images / 200MB documents)",
    attachUnsupported: "file type not supported",
    messageTooLong: "That message is too long for one turn. Split it, or attach it as a file.",
    offline: "You're offline — your message will be sent when you're back.",
    callCutOff: "The last call was cut off — the app was interrupted.",
    callDropped: "The call dropped — the connection didn't come back.",
    continueCall: "Continue the call",
    dismiss: "Dismiss",
    projects: "Projects",
    newProject: "New project",
    editProject: "Edit project",
    projectName: "Project name",
    projectIcon: "Icon",
    projectColor: "Colour",
    deleteProject: "Delete project",
    confirmDeleteProject:
      "Delete this project? Its chats stay — they move back to the main list.",
    emptyProject: "No chats in here yet",
    pin: "Pin",
    unpin: "Unpin",
    pinned: "Pinned",
    moveTo: "Move to",
    noProject: "No project",
    more: "More",
    recents: "Recents",
    library: "Library",
    libraryEmpty: "No pictures yet. Pictures from your chats will appear here.",
    openChat: "Open chat",
    calls: "Calls",
    callsEmpty: "No calls yet. When a call ends with a real exchange, its summary will appear here.",
    exportChat: "Export / print",
    back: "Back",
    seeMore: "See more",
    seeLess: "See less",
    save: "Save",
    cancel: "Cancel",
    readAloud: "Read aloud",
    regenerate: "Regenerate response",
    goodResponse: "Good response",
    badResponse: "Bad response",
    messageActions: "Message actions",
    editAndRetry: "Edit and retry",
    saveAndRetry: "Save and retry",
    cancelEdit: "Cancel edit",
    closeSidebar: "Close sidebar",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    aiKnowledge: "AI Knowledge",
    personalize: "Personalize Koleex AI",
    backToHub: "Back to Hub",
    jumpToLatest: "Jump to latest",
    searchWeb: "Search the web",
    addMenu: "Add files and more",
    attachFilesPhotos: "Files and photos",
    webSearchChip: "Search",
    webSearchChipOff: "Turn off web search",
    stopGenerating: "Stop generating",
    send: "Send",
    composerLabel: "Message Koleex AI",
    editMessageLabel: "Edit your message",
    thinkingAria: "Koleex AI is thinking",
    voiceMessage: "Spoken on a call",
    attachDefaultPrompt: "Please read the attached file(s) and give me the key points.",
    latest: "Latest",
    copied: "Copied",
    copyMessage: "Copy message",
    copyCode: "Copy code",
    codeLabel: "code",
    closePhoto: "Close photo",
    photo: "Photo",
    replyReady: "Koleex AI replied.",
    loadFailed: "Couldn't load this right now. Check your connection and try again.",
    retry: "Try again",
    supportedFiles: "Supported files: images, PDF, Excel, TXT, MD, CSV, JSON.",
    fileTooLarge: "{name} is {size}MB — the limit is {cap}MB for {kind}.",
    kindImages: "images",
    kindDocuments: "documents",
    attachError: "Couldn't process the attachment(s)",
    attachNothingRead: "Couldn't read the attachment(s).",
    noReply: "No reply was received.",
    aiUnavailable: "Koleex AI is unavailable right now.",
    networkDropped: "The connection dropped — check your internet and try again.",
    answerFailed: "Koleex AI couldn't finish this answer. Try again.",
    somethingWrong: "Something went wrong. Try again.",
    couldNotStartChat: "Couldn't start a new chat.",
    editShort: "Edit",
    draftNeedsApproval: "Draft · needs approval",
    draftLabel: "Draft",
    lineOne: "{n} line",
    linesCount: "{n} lines",
    reviewInQuotations: "Review in Quotations →",
    prompts: [
      "Give me my brief for today: my meetings, tasks due, reminders, and what needs me first.",
      "Help me write a polite reply to a customer email.",
      "Explain how pricing bands generally work.",
      "Translate to Chinese: Please confirm delivery by Friday.",
    ],
  },
  zh: {
    taskPreview: "新任务",
    taskUpdate: "任务修改",
    saveTask: "保存任务",
    cancelTask: "取消",
    savingTask: "保存中…",
    taskSaved: "任务已保存",
    taskFailed: "保存失败，请重试。",
    taskCancelled: "未保存",
    openTodo: "在待办中打开",
    due: "截止",
    priorityHigh: "高优先级",
    priorityLow: "低优先级",
    priorityMedium: "中优先级",
    taskField: { title: "标题", description: "备注", priority: "优先级", due_date: "截止", remind_at: "提醒", start_date: "开始", label: "标签", recurrence: "重复", recurrence_until: "重复至", is_private: "私密" },
    recurrenceWord: { daily: "每天", weekly: "每周", monthly: "每月" },
    everyone: "所有人",
    yes: "是",
    no: "否",
    remind: "提醒",
    forPeople: "给",
    observers: "关注",
    mentions: "通知",
    repeats: "重复",
    privateTask: "私密",
    starts: "开始",
    newChat: "新建对话",
    placeholder: "向 Koleex AI 提问…",
    welcomeTitle: "你好",
    welcomeTitleNamed: "你好，{name}。",
    welcomeSub: "想聊点什么？我是 Koleex AI — 大事小事都可以问我。",
    thinking: "思考中…",
    noChats: "还没有对话",
    today: "今天",
    yesterday: "昨天",
    previous7: "过去 7 天",
    previous30: "过去 30 天",
    earlier: "更早",
    delete: "删除",
    rename: "重命名",
    confirmDelete: "删除这个对话？",
    renamePrompt: "新标题",
    nameRequired: "请先写一个名字。",
    stopped: "已停止",
    model: "模型",
    modelUnavailable: "暂时不可用",
    modelTextOnly: "仅文字",
    answeredByModel: "由 {model} 回答",
    summaryWriting: "正在整理通话摘要…",
    thinkingTitle: "思考中",
    thoughtFor: "思考了 {s} 秒",
    thinkSearching: "正在搜索",
    thinkSearched: "已搜索",
    thinkReading: "正在阅读",
    thinkRead: "已阅读",
    thinkingShow: "显示思考过程",
    thinkingHide: "隐藏思考过程",
    dropHere: "拖放文件以附加",
    recommended: "推荐",
    otherOption: "其他",
    otherPlaceholder: "请说明你的意思…",
    otherSend: "发送",
    searchChats: "搜索对话…",
    noSearchResults: "没有匹配的对话。",
    openSidebar: "打开侧边栏",
    removeFile: "移除 {name}",
    uploading: "正在上传",
    attachUnreadableImage: "无法识别这张图片——请换一张更清晰的照片",
    attachNoText: "没有找到可读取的文字",
    attachTooLarge: "超过大小限制（图片 15MB / 文档 200MB）",
    attachUnsupported: "不支持的文件类型",
    messageTooLong: "这条消息太长了，请分成几条发送，或作为文件附上。",
    offline: "当前离线——恢复连接后会自动发送。",
    callCutOff: "上一次通话被打断了——应用被中断。",
    callDropped: "通话断了——网络没有恢复。",
    continueCall: "继续通话",
    dismiss: "关闭",
    projects: "项目",
    newProject: "新建项目",
    editProject: "编辑项目",
    projectName: "项目名称",
    projectIcon: "图标",
    projectColor: "颜色",
    deleteProject: "删除项目",
    confirmDeleteProject: "删除这个项目？其中的对话会保留，并移回主列表。",
    emptyProject: "这里还没有对话",
    pin: "置顶",
    unpin: "取消置顶",
    pinned: "已置顶",
    moveTo: "移动到",
    noProject: "无项目",
    more: "更多",
    recents: "最近",
    library: "图库",
    libraryEmpty: "还没有图片。聊天中出现的图片会显示在这里。",
    openChat: "打开对话",
    calls: "通话",
    callsEmpty: "还没有通话。通话结束后，摘要会显示在这里。",
    exportChat: "导出 / 打印",
    back: "返回",
    seeMore: "查看更多",
    seeLess: "收起",
    save: "保存",
    cancel: "取消",
    readAloud: "朗读",
    regenerate: "重新生成回答",
    goodResponse: "回答很好",
    badResponse: "回答不佳",
    messageActions: "消息操作",
    editAndRetry: "编辑并重新发送",
    saveAndRetry: "保存并重新发送",
    cancelEdit: "取消编辑",
    closeSidebar: "关闭侧边栏",
    collapseSidebar: "收起侧边栏",
    expandSidebar: "展开侧边栏",
    aiKnowledge: "AI 知识库",
    personalize: "个性化 Koleex AI",
    backToHub: "返回 Hub",
    jumpToLatest: "跳到最新",
    searchWeb: "联网搜索",
    addMenu: "添加文件等",
    attachFilesPhotos: "文件和照片",
    webSearchChip: "搜索",
    webSearchChipOff: "关闭联网搜索",
    stopGenerating: "停止生成",
    send: "发送",
    composerLabel: "给 Koleex AI 发送消息",
    editMessageLabel: "编辑你的消息",
    thinkingAria: "Koleex AI 正在思考",
    voiceMessage: "通话中所说",
    attachDefaultPrompt: "请阅读附件并告诉我要点。",
    latest: "最新",
    copied: "已复制",
    copyMessage: "复制消息",
    copyCode: "复制代码",
    codeLabel: "代码",
    closePhoto: "关闭图片",
    photo: "图片",
    replyReady: "Koleex AI 已回复。",
    loadFailed: "现在加载不了，请检查网络后再试。",
    retry: "重试",
    supportedFiles: "支持的文件：图片、PDF、Excel、TXT、MD、CSV、JSON。",
    fileTooLarge: "{name} 有 {size}MB，{kind}的上限是 {cap}MB。",
    kindImages: "图片",
    kindDocuments: "文档",
    attachError: "附件处理失败",
    attachNothingRead: "读不了这个附件。",
    noReply: "没有收到回复。",
    aiUnavailable: "Koleex AI 现在暂时不可用。",
    networkDropped: "网络断了——请检查网络后再试一次。",
    answerFailed: "Koleex AI 没能完成这次回答，请再试一次。",
    somethingWrong: "出了点问题，请再试一次。",
    couldNotStartChat: "无法开始新对话。",
    editShort: "编辑",
    draftNeedsApproval: "草稿 · 待审批",
    draftLabel: "草稿",
    lineOne: "{n} 行",
    linesCount: "{n} 行",
    reviewInQuotations: "在报价中查看 →",
    prompts: [
      "给我今天的简报：会议、到期任务、提醒，以及我最该先做什么。",
      "帮我给客户写一封礼貌的回复邮件。",
      "简单解释一下价格区间是怎么运作的。",
      "翻译成英文：请在周五前确认交货。",
    ],
  },
  ar: {
    taskPreview: "مهمة جديدة",
    taskUpdate: "تعديل مهمة",
    saveTask: "احفظ المهمة",
    cancelTask: "إلغاء",
    savingTask: "جارٍ الحفظ…",
    taskSaved: "تم حفظ المهمة",
    taskFailed: "ما قدرنا نحفظها. حاول تاني.",
    taskCancelled: "ما اتحفظتش",
    openTodo: "افتح في المهام",
    due: "موعدها",
    priorityHigh: "أولوية عالية",
    priorityLow: "أولوية قليلة",
    priorityMedium: "أولوية متوسطة",
    taskField: { title: "العنوان", description: "الملاحظات", priority: "الأولوية", due_date: "موعدها", remind_at: "التذكير", start_date: "بتبدأ", label: "التصنيف", recurrence: "بتتكرر", recurrence_until: "بتتكرر لحد", is_private: "خاصة" },
    recurrenceWord: { daily: "كل يوم", weekly: "كل أسبوع", monthly: "كل شهر" },
    everyone: "الكل",
    yes: "أيوه",
    no: "لأ",
    remind: "تذكير",
    forPeople: "لـ",
    observers: "يتابع",
    mentions: "هيتبلّغ",
    repeats: "يتكرر",
    privateTask: "خاص",
    starts: "يبدأ",
    newChat: "محادثة جديدة",
    placeholder: "اسأل Koleex AI…",
    welcomeTitle: "أهلاً",
    welcomeTitleNamed: "أهلاً يا {name}",
    welcomeSub: "في إيه في دماغك؟ أنا Koleex AI — اسألني أي حاجة، صغيرة ولا كبيرة.",
    thinking: "بفكّر…",
    noChats: "مفيش محادثات لسه",
    today: "النهاردة",
    yesterday: "امبارح",
    previous7: "آخر 7 أيام",
    previous30: "آخر 30 يوم",
    earlier: "أقدم",
    delete: "امسح",
    rename: "غيّر الاسم",
    confirmDelete: "تمسح المحادثة دي؟",
    renamePrompt: "عنوان جديد",
    nameRequired: "اكتب اسم الأول.",
    stopped: "اتوقف",
    model: "الموديل",
    modelUnavailable: "مش متاح دلوقتي",
    modelTextOnly: "كتابة بس",
    answeredByModel: "رد عليك {model}",
    summaryWriting: "بكتب ملخص المكالمة…",
    thinkingTitle: "بفكّر",
    thoughtFor: "فكّر {s} ثانية",
    thinkSearching: "بدوّر على",
    thinkSearched: "دوّرت على",
    thinkReading: "بقرأ",
    thinkRead: "قريت",
    thinkingShow: "اعرض التفكير",
    thinkingHide: "اخفي التفكير",
    dropHere: "سيب الملفات هنا",
    recommended: "الأنسب",
    otherOption: "حاجة تانية",
    otherPlaceholder: "اكتبلي قصدك إيه…",
    otherSend: "ابعت",
    searchChats: "دوّر في المحادثات…",
    noSearchResults: "مفيش محادثات بالكلام ده.",
    openSidebar: "افتح القايمة",
    removeFile: "شيل {name}",
    uploading: "بيترفع",
    attachUnreadableImage: "مقدرناش نقرا الصورة دي — جرّب صورة أوضح",
    attachNoText: "مفيش نص مقروء في الملف",
    attachTooLarge: "أكبر من الحد المسموح (15MB للصور / 200MB للملفات)",
    attachUnsupported: "نوع الملف ده مش بيتقري",
    messageTooLong: "الرسالة دي طويلة أوي على مرة واحدة. قسّمها أو ارفعها كملف.",
    offline: "مفيش نت دلوقتي — رسالتك هتتبعت أول ما ترجع.",
    callCutOff: "المكالمة اللي فاتت اتقطعت — التطبيق اتقفل لوحده.",
    callDropped: "المكالمة وقعت — النت ما رجعش.",
    continueCall: "كمّل المكالمة",
    dismiss: "تمام",
    projects: "المشاريع",
    newProject: "مشروع جديد",
    editProject: "عدّل المشروع",
    projectName: "اسم المشروع",
    projectIcon: "الأيقونة",
    projectColor: "اللون",
    deleteProject: "امسح المشروع",
    confirmDeleteProject:
      "تمسح المشروع ده؟ محادثاته هتفضل موجودة — وهترجع للقائمة الرئيسية.",
    emptyProject: "مفيش محادثات هنا لسه",
    pin: "ثبّت",
    unpin: "شيل التثبيت",
    pinned: "مثبّتة",
    moveTo: "انقل لـ",
    noProject: "من غير مشروع",
    more: "كمان",
    recents: "الأحدث",
    library: "المكتبة",
    libraryEmpty: "مفيش صور لسه. الصور اللي ظهرت في محادثاتك هتتجمع هنا.",
    openChat: "افتح المحادثة",
    calls: "المكالمات",
    callsEmpty: "مفيش مكالمات لسه. لما مكالمة تخلص بكلام حقيقي، ملخصها هيظهر هنا.",
    exportChat: "صدّر / اطبع",
    back: "رجوع",
    seeMore: "شوف أكتر",
    seeLess: "شوف أقل",
    save: "احفظ",
    cancel: "إلغاء",
    readAloud: "اسمع الرد",
    regenerate: "رد تاني",
    goodResponse: "رد حلو",
    badResponse: "رد مش كويس",
    messageActions: "اختيارات الرسالة",
    editAndRetry: "عدّل وابعت تاني",
    saveAndRetry: "احفظ وابعت تاني",
    cancelEdit: "سيب التعديل",
    closeSidebar: "اقفل القايمة",
    collapseSidebar: "صغّر القايمة",
    expandSidebar: "افتح القايمة",
    aiKnowledge: "معرفة Koleex AI",
    personalize: "تخصيص Koleex AI",
    backToHub: "ارجع للـ Hub",
    jumpToLatest: "انزل لآخر رسالة",
    searchWeb: "دوّر في النت",
    addMenu: "ضيف ملفات وغيرها",
    attachFilesPhotos: "ملفات وصور",
    webSearchChip: "بحث",
    webSearchChipOff: "اقفل البحث في النت",
    stopGenerating: "وقّف الرد",
    send: "ابعت",
    composerLabel: "اكتب رسالة لـ Koleex AI",
    editMessageLabel: "عدّل رسالتك",
    thinkingAria: "Koleex AI يفكّر",
    voiceMessage: "اتقالت في مكالمة",
    attachDefaultPrompt: "اقرا الملف المرفق وقولي أهم النقط.",
    latest: "الأحدث",
    copied: "اتنسخ",
    copyMessage: "انسخ الرسالة",
    copyCode: "انسخ الكود",
    codeLabel: "كود",
    closePhoto: "اقفل الصورة",
    photo: "صورة",
    replyReady: "Koleex AI رد.",
    loadFailed: "مش قادرين نحمّل ده دلوقتي. اتأكد من النت وجرّب تاني.",
    retry: "جرّب تاني",
    supportedFiles: "الملفات اللي بتتقري: صور، PDF، Excel، TXT، MD، CSV، JSON.",
    fileTooLarge: "{name} حجمه {size}MB — الحد {cap}MB لـ{kind}.",
    kindImages: "الصور",
    kindDocuments: "الملفات",
    attachError: "حصلت مشكلة في المرفق",
    attachNothingRead: "مقدرناش نقرا المرفق.",
    noReply: "مفيش رد وصل.",
    aiUnavailable: "Koleex AI مش متاح دلوقتي.",
    networkDropped: "النت فصل — اتأكد من الاتصال وجرّب تاني.",
    answerFailed: "Koleex AI ماقدرش يكمّل الرد ده. جرّب تاني.",
    somethingWrong: "حصلت مشكلة. جرّب تاني.",
    couldNotStartChat: "مقدرناش نبدأ محادثة جديدة.",
    editShort: "تعديل",
    draftNeedsApproval: "مسودة · محتاجة اعتماد",
    draftLabel: "مسودة",
    lineOne: "بند واحد",
    linesCount: "{n} بنود",
    reviewInQuotations: "افتحها في عروض الأسعار ←",
    prompts: [
      "قولي يومي النهاردة: اجتماعاتي، المهام اللي معادها النهاردة، التذكيرات، وإيه اللي محتاجني الأول.",
      "ساعدني أكتب رد محترم على رسالة من عميل.",
      "اشرحلي ببساطة شرائح الأسعار بتشتغل إزاي.",
      "ترجم للإنجليزي: الرجاء تأكيد التسليم بحلول يوم الجمعة.",
    ],
  },
};
