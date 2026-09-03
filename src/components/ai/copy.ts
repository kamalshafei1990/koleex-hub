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
  footer: string;
  stopped: string;
  dropHere: string;
  recommended: string;
  orTypeYourOwn: string;
  otherOption: string;
  otherPlaceholder: string;
  otherSend: string;
  searchChats?: string;
  noSearchResults?: string;
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
  back: string;
  seeMore: string;
  seeLess: string;
  webSearchOn: string;
  webSearchOff: string;
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
  emojiPicker: string;
  searchEmoji: string;
  closeSidebar: string;
  collapseSidebar: string;
  expandSidebar: string;
  aiKnowledge: string;
  /* Sidebar link to Settings → Koleex AI. */
  personalize: string;
  backToHub: string;
  jumpToLatest: string;
  attachFile: string;
  searchWeb: string;
  stopGenerating: string;
  send: string;
  /* The composer and the edit box have no visible label — a placeholder is
     not one, and it disappears the moment anyone types. */
  composerLabel: string;
  editMessageLabel: string;
  /* `thinking` is the words on screen; this is what a screen reader
     announces for the same state, which needs a subject to make sense. */
  thinkingAria: string;
  /* THE EMOJI PICKER'S CATEGORY NAMES, keyed by the id in emojiData.
     They live here rather than in that file because emojiData is 700 lines
     of emoji and adding three languages to every category row would bury
     the eight strings that actually need translating. */
  emojiCategories: Record<string, string>;
  insertEmoji: string;
  /** The mark on a message that was spoken on a call rather than typed. */
  voiceMessage: string;
  prompts: string[];
}> = {
  en: {
    newChat: "New chat",
    placeholder: "Ask Koleex AI…",
    welcomeTitle: "Hi",
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
    footer: "Koleex AI — Powered by Koleex Technology Systems",
    stopped: "Stopped",
    dropHere: "Drop files to attach",
    recommended: "Recommended",
    orTypeYourOwn: "Or type your own answer below.",
    otherOption: "Something else",
    otherPlaceholder: "Tell me what you mean…",
    otherSend: "Send",
    searchChats: "Search chats…",
    noSearchResults: "No chats match your search.",
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
    back: "Back",
    seeMore: "See more",
    seeLess: "See less",
    webSearchOn: "Web search: on",
    webSearchOff: "Web search: off",
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
    emojiPicker: "Emoji picker",
    searchEmoji: "Search emoji",
    closeSidebar: "Close sidebar",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    aiKnowledge: "AI Knowledge",
    personalize: "Personalize Koleex AI",
    backToHub: "Back to Hub",
    jumpToLatest: "Jump to latest",
    attachFile: "Attach file",
    searchWeb: "Search the web",
    stopGenerating: "Stop generating",
    send: "Send",
    composerLabel: "Message Koleex AI",
    editMessageLabel: "Edit your message",
    thinkingAria: "Koleex AI is thinking",
    emojiCategories: { smileys: "Smileys & People", nature: "Animals & Nature", food: "Food & Drink", activity: "Activity", travel: "Travel & Places", objects: "Objects", symbols: "Symbols", flags: "Flags" },
    insertEmoji: "Insert",
    voiceMessage: "Spoken on a call",
    prompts: [
      "What's a good way to start my day at work?",
      "Help me write a polite reply to a customer email.",
      "Explain how pricing bands generally work.",
      "Translate to Chinese: Please confirm delivery by Friday.",
    ],
  },
  zh: {
    newChat: "新建对话",
    placeholder: "向 Koleex AI 提问…",
    welcomeTitle: "你好",
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
    footer: "Koleex AI — 由 Koleex 技术系统驱动",
    stopped: "已停止",
    dropHere: "拖放文件以附加",
    recommended: "推荐",
    orTypeYourOwn: "或在下方输入你自己的答案。",
    otherOption: "其他",
    otherPlaceholder: "请说明你的意思…",
    otherSend: "发送",
    searchChats: "搜索对话…",
    noSearchResults: "没有匹配的对话。",
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
    back: "返回",
    seeMore: "查看更多",
    seeLess: "收起",
    webSearchOn: "联网搜索：开",
    webSearchOff: "联网搜索：关",
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
    emojiPicker: "表情选择器",
    searchEmoji: "搜索表情",
    closeSidebar: "关闭侧边栏",
    collapseSidebar: "收起侧边栏",
    expandSidebar: "展开侧边栏",
    aiKnowledge: "AI 知识库",
    personalize: "个性化 Koleex AI",
    backToHub: "返回 Hub",
    jumpToLatest: "跳到最新",
    attachFile: "添加文件",
    searchWeb: "联网搜索",
    stopGenerating: "停止生成",
    send: "发送",
    composerLabel: "给 Koleex AI 发送消息",
    editMessageLabel: "编辑你的消息",
    thinkingAria: "Koleex AI 正在思考",
    emojiCategories: { smileys: "笑脸与人物", nature: "动物与自然", food: "食物与饮料", activity: "活动", travel: "旅行与地点", objects: "物品", symbols: "符号", flags: "旗帜" },
    insertEmoji: "插入",
    voiceMessage: "语音通话中说的",
    prompts: [
      "早上开始工作的好方法是什么？",
      "帮我给客户写一封礼貌的回复邮件。",
      "简单解释一下价格区间是怎么运作的。",
      "翻译成英文：请在周五前确认交货。",
    ],
  },
  ar: {
    newChat: "محادثة جديدة",
    placeholder: "اسأل Koleex AI…",
    welcomeTitle: "مرحبًا",
    welcomeSub: "ما الذي يدور في بالك؟ أنا Koleex AI — اسألني عن أي شيء، صغيرًا كان أم كبيرًا.",
    thinking: "جارٍ التفكير…",
    noChats: "لا توجد محادثات بعد",
    today: "اليوم",
    yesterday: "أمس",
    previous7: "آخر 7 أيام",
    previous30: "آخر 30 يومًا",
    earlier: "قبل ذلك",
    delete: "حذف",
    rename: "إعادة تسمية",
    confirmDelete: "حذف هذه المحادثة؟",
    renamePrompt: "عنوان جديد",
    footer: "Koleex AI — بدعم من أنظمة Koleex التقنية",
    stopped: "تم الإيقاف",
    dropHere: "أفلت الملفات لإرفاقها",
    recommended: "موصى به",
    orTypeYourOwn: "أو اكتب إجابتك بنفسك في الأسفل.",
    otherOption: "حاجة تانية",
    otherPlaceholder: "اكتبلي قصدك إيه…",
    otherSend: "ابعت",
    searchChats: "ابحث في المحادثات…",
    noSearchResults: "لا توجد محادثات تطابق بحثك.",
    projects: "المشاريع",
    newProject: "مشروع جديد",
    editProject: "تعديل المشروع",
    projectName: "اسم المشروع",
    projectIcon: "الأيقونة",
    projectColor: "اللون",
    deleteProject: "حذف المشروع",
    confirmDeleteProject:
      "حذف هذا المشروع؟ محادثاته تبقى — وتعود إلى القائمة الرئيسية.",
    emptyProject: "لا توجد محادثات هنا بعد",
    pin: "تثبيت",
    unpin: "إلغاء التثبيت",
    pinned: "مثبّتة",
    moveTo: "نقل إلى",
    noProject: "بدون مشروع",
    more: "المزيد",
    recents: "الأحدث",
    back: "رجوع",
    seeMore: "عرض المزيد",
    seeLess: "عرض أقل",
    webSearchOn: "البحث في الويب: مفعّل",
    webSearchOff: "البحث في الويب: متوقّف",
    save: "حفظ",
    cancel: "إلغاء",
    readAloud: "استماع",
    regenerate: "إعادة توليد الرد",
    goodResponse: "إجابة جيدة",
    badResponse: "إجابة سيئة",
    messageActions: "إجراءات الرسالة",
    editAndRetry: "تعديل وإعادة الإرسال",
    saveAndRetry: "حفظ وإعادة الإرسال",
    cancelEdit: "إلغاء التعديل",
    emojiPicker: "اختيار الرموز",
    searchEmoji: "ابحث عن رمز",
    closeSidebar: "إغلاق الشريط الجانبي",
    collapseSidebar: "طيّ الشريط الجانبي",
    expandSidebar: "توسيع الشريط الجانبي",
    aiKnowledge: "معرفة Koleex AI",
    personalize: "تخصيص Koleex AI",
    backToHub: "العودة إلى Hub",
    jumpToLatest: "الانتقال إلى الأحدث",
    attachFile: "إرفاق ملف",
    searchWeb: "البحث في الويب",
    stopGenerating: "إيقاف التوليد",
    send: "إرسال",
    composerLabel: "اكتب رسالة إلى Koleex AI",
    editMessageLabel: "تعديل رسالتك",
    thinkingAria: "Koleex AI يفكّر",
    emojiCategories: { smileys: "الوجوه والأشخاص", nature: "الحيوانات والطبيعة", food: "الطعام والشراب", activity: "الأنشطة", travel: "السفر والأماكن", objects: "الأشياء", symbols: "الرموز", flags: "الأعلام" },
    insertEmoji: "إدراج",
    voiceMessage: "اتقالت في مكالمة",
    prompts: [
      "ما طريقة جيدة لبدء يومي في العمل؟",
      "ساعدني في كتابة رد مهذب على رسالة من عميل.",
      "اشرح لي ببساطة كيف تعمل شرائح الأسعار.",
      "ترجم إلى الإنجليزية: الرجاء تأكيد التسليم بحلول يوم الجمعة.",
    ],
  },
};
