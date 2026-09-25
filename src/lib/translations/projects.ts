import type { Translations } from "@/lib/i18n";

export const projectsT: Translations = {
  /* App shell */
  "app.title":         { en: "Projects",            zh: "项目",              ar: "المشاريع" },
  "app.subtitle":      { en: "Organise work into projects with kanban tasks, stages, and tags.",
                         zh: "将工作组织为项目，并使用看板任务、阶段和标签进行管理。",
                         ar: "نظّم العمل في مشاريع باستخدام مهام كانبان والمراحل والعلامات." },
  "action.newProject": { en: "New project",         zh: "新建项目",          ar: "مشروع جديد" },

  /* Tabs */
  "tab.projects":      { en: "Projects",            zh: "项目",              ar: "المشاريع" },
  "tab.myTasks":       { en: "My Tasks",            zh: "我的任务",          ar: "مهامي" },
  "tab.allTasks":      { en: "All Tasks",           zh: "所有任务",          ar: "كل المهام" },
  "tab.reporting":     { en: "Reporting",           zh: "报表",              ar: "التقارير" },
  "tab.configuration": { en: "Configuration",       zh: "配置",              ar: "الإعدادات" },

  /* Filters */
  "filter.active":     { en: "Active",              zh: "进行中",            ar: "نشطة" },
  "filter.onHold":     { en: "On hold",             zh: "暂停",              ar: "متوقفة" },
  "filter.completed":  { en: "Completed",           zh: "已完成",            ar: "منجزة" },
  "filter.archived":   { en: "Archived",            zh: "已归档",            ar: "مؤرشفة" },
  "filter.all":        { en: "All",                 zh: "全部",              ar: "الكل" },

  /* Project card */
  "card.tasks":        { en: "tasks",               zh: "任务",              ar: "مهام" },
  "card.taskSingular": { en: "task",                zh: "任务",              ar: "مهمة" },
  "card.overdue":      { en: "overdue",             zh: "逾期",              ar: "متأخرة" },
  "card.noCustomer":   { en: "Internal",            zh: "内部",              ar: "داخلي" },

  /* Empty states */
  "empty.noProjects":  { en: "No projects yet.",    zh: "还没有项目。",       ar: "لا توجد مشاريع بعد." },
  "empty.noTasks":     { en: "No tasks here.",      zh: "这里没有任务。",     ar: "لا توجد مهام هنا." },
  "empty.addFirst":    { en: "Create your first project to get started.",
                         zh: "创建您的第一个项目以开始使用。",
                         ar: "أنشئ مشروعك الأول للبدء." },

  /* Project form */
  "form.title.new":    { en: "New project",         zh: "新建项目",          ar: "مشروع جديد" },
  "form.title.edit":   { en: "Edit project",        zh: "编辑项目",          ar: "تعديل المشروع" },
  "form.name":         { en: "Name",                zh: "名称",              ar: "الاسم" },
  "form.code":         { en: "Code",                zh: "代号",              ar: "الرمز" },
  "form.description":  { en: "Description",         zh: "描述",              ar: "الوصف" },
  "form.color":        { en: "Colour",              zh: "颜色",              ar: "اللون" },
  "form.customColor":  { en: "Custom colour",       zh: "自定义颜色",         ar: "لون مخصص" },
  "form.customer":     { en: "Customer",            zh: "客户",              ar: "العميل" },
  "form.manager":      { en: "Manager",             zh: "负责人",            ar: "المدير" },
  "form.billable":     { en: "Billable",            zh: "可计费",            ar: "قابلة للفوترة" },
  "form.plannedStart": { en: "Start",               zh: "开始",              ar: "البداية" },
  "form.plannedEnd":   { en: "End",                 zh: "结束",              ar: "النهاية" },
  "form.budgetHours":  { en: "Budget (hrs)",        zh: "预算（小时）",      ar: "الميزانية (ساعة)" },
  "form.status":       { en: "Status",              zh: "状态",              ar: "الحالة" },
  "task.status":       { en: "Status",              zh: "状态",              ar: "الحالة" },

  /* Task form */
  "task.title.new":    { en: "New task",            zh: "新建任务",          ar: "مهمة جديدة" },
  "task.title.edit":   { en: "Edit task",           zh: "编辑任务",          ar: "تعديل المهمة" },
  "task.namePh":       { en: "Task title",          zh: "任务标题",          ar: "عنوان المهمة" },
  "task.description":  { en: "Description",         zh: "描述",              ar: "الوصف" },
  "task.stage":        { en: "Stage",               zh: "阶段",              ar: "المرحلة" },
  "task.priority":     { en: "Priority",            zh: "优先级",            ar: "الأولوية" },
  "task.assignee":     { en: "Assignee",            zh: "负责人",            ar: "المكلف" },
  "task.dueDate":      { en: "Due date",            zh: "截止日期",          ar: "تاريخ الاستحقاق" },
  "task.estimated":    { en: "Estimated hours",     zh: "预计工时",          ar: "الساعات التقديرية" },
  "task.logged":       { en: "Logged hours",        zh: "已记录工时",        ar: "الساعات المسجلة" },
  "task.progress":     { en: "Progress",            zh: "进度",              ar: "التقدم" },
  "task.tags":         { en: "Tags",                zh: "标签",              ar: "العلامات" },
  "task.linked":       { en: "Linked to",           zh: "关联到",            ar: "مرتبط بـ" },
  /* TaskExtras panels */
  "x.addItem": { en: "Add an item…", zh: "添加条目…", ar: "أضف عنصرًا…" },
  "x.noChecklist": { en: "No checklist items yet.", zh: "暂无清单项。", ar: "لا توجد عناصر بعد." },
  "x.writeComment": { en: "Write a comment…", zh: "写评论…", ar: "اكتب تعليقًا…" },
  "x.post": { en: "Post", zh: "发布", ar: "نشر" },
  "x.noComments": { en: "No comments yet.", zh: "暂无评论。", ar: "لا توجد تعليقات بعد." },
  "x.totalLogged": { en: "Total logged", zh: "累计工时", ar: "إجمالي المسجّل" },
  "x.hours": { en: "Hours", zh: "小时", ar: "ساعات" },
  "x.noteOptional": { en: "Note (optional)", zh: "备注（可选）", ar: "ملاحظة (اختياري)" },
  "x.log": { en: "Log", zh: "记录", ar: "تسجيل" },
  "x.noTime": { en: "No time logged yet.", zh: "暂无工时记录。", ar: "لم تُسجَّل ساعات بعد." },
  "x.noFiles": { en: "No files attached.", zh: "暂无附件。", ar: "لا توجد ملفات مرفقة." },
  "x.addSubtask": { en: "Add a subtask…", zh: "添加子任务…", ar: "أضف مهمة فرعية…" },
  "x.noSubtasks": { en: "No subtasks yet.", zh: "暂无子任务。", ar: "لا توجد مهام فرعية بعد." },
  "x.milestones": { en: "Milestones", zh: "里程碑", ar: "المراحل" },
  "x.noMilestones": { en: "No milestones yet.", zh: "暂无里程碑。", ar: "لا توجد مراحل بعد." },
  "x.milestoneName": { en: "Milestone name", zh: "里程碑名称", ar: "اسم المرحلة" },
  "x.add": { en: "Add", zh: "添加", ar: "إضافة" },

  "project.deleteConfirm": { en: "Delete this project and all its tasks?",
                          zh: "删除此项目及其所有任务？",
                          ar: "حذف هذا المشروع وكل مهامه؟" },
  "task.deleteConfirm": { en: "Delete this task?",
                          zh: "删除此任务？",
                          ar: "حذف هذه المهمة؟" },

  /* Priority labels */
  "priority.low":      { en: "Low",                 zh: "低",                ar: "منخفض" },
  "priority.normal":   { en: "Normal",              zh: "普通",              ar: "عادي" },
  "priority.high":     { en: "High",                zh: "高",                ar: "عالٍ" },
  "priority.urgent":   { en: "Urgent",              zh: "紧急",              ar: "عاجل" },

  /* Status labels */
  "status.open":       { en: "Open",                zh: "进行中",            ar: "مفتوحة" },
  "status.done":       { en: "Done",                zh: "已完成",            ar: "منجزة" },
  "status.cancelled":  { en: "Cancelled",           zh: "已取消",            ar: "ملغاة" },

  /* Configuration */
  "cfg.stages.title":  { en: "Stages",              zh: "阶段",              ar: "المراحل" },
  "cfg.tags.title":    { en: "Tags",                zh: "标签",              ar: "العلامات" },
  "cfg.tags.help":     { en: "Colour-coded labels you can attach to any task for grouping and filtering.",
                         zh: "彩色标签，可附加到任何任务以便分组和筛选。",
                         ar: "تسميات ملونة يمكن ربطها بأي مهمة للتجميع والتصفية." },
  "cfg.tags.placeholder": { en: "e.g. Frontend",    zh: "例如：前端",        ar: "مثلًا: واجهة المستخدم" },

  /* Actions */
  "btn.cancel":        { en: "Cancel",              zh: "取消",              ar: "إلغاء" },
  "btn.save":          { en: "Save",                zh: "保存",              ar: "حفظ" },
  "btn.create":        { en: "Create",              zh: "创建",              ar: "إنشاء" },
  "btn.delete":        { en: "Delete",              zh: "删除",              ar: "حذف" },
  "btn.add":           { en: "Add",                 zh: "添加",              ar: "إضافة" },
  "btn.addTask":       { en: "Add task",            zh: "添加任务",          ar: "إضافة مهمة" },
  "btn.addStage":      { en: "Add stage",           zh: "添加阶段",          ar: "إضافة مرحلة" },

  /* Reporting */
  "report.totalProjects":  { en: "Projects",         zh: "项目",             ar: "مشاريع" },
  "report.openTasks":      { en: "Open tasks",       zh: "进行中任务",       ar: "مهام مفتوحة" },
  "report.overdueTasks":   { en: "Overdue",          zh: "逾期",             ar: "متأخرة" },
  "report.completedWk":    { en: "Completed this week", zh: "本周完成",      ar: "منجزة هذا الأسبوع" },
  "report.byPriority":     { en: "By priority",      zh: "按优先级",         ar: "حسب الأولوية" },
  "report.byAssignee":     { en: "By assignee",      zh: "按负责人",         ar: "حسب المكلف" },

  /* Tooltips */
  "tip.favourite":     { en: "Toggle favourite",    zh: "切换收藏",          ar: "تبديل التفضيل" },
  /* Views + filters */
  "view.board":          { en: "Board",             zh: "看板",              ar: "لوحة" },
  "view.list":           { en: "List",              zh: "列表",              ar: "قائمة" },
  "filter.overdue":      { en: "Overdue",           zh: "逾期",              ar: "متأخرة" },
  "action.duplicate":    { en: "Duplicate project", zh: "复制项目",          ar: "تكرار المشروع" },

  /* Project form — sections, budget, billing, templates */
  "form.section.clientTeam":     { en: "Client & team",     zh: "客户与团队",  ar: "العميل والفريق" },
  "form.section.scheduleBudget": { en: "Schedule & budget", zh: "排期与预算",  ar: "الجدول والميزانية" },
  "form.budgetAmount":   { en: "Budget amount",     zh: "预算金额",          ar: "مبلغ الميزانية" },
  "form.billingRate":    { en: "Billing rate / hour", zh: "计费费率／小时",   ar: "سعر الفوترة / ساعة" },
  "form.billableHint":   { en: "Bill logged time to the customer", zh: "将已记录时间向客户计费", ar: "فوترة الوقت المسجل للعميل" },
  "form.isTemplate":     { en: "Template",          zh: "模板",              ar: "قالب" },
  "form.isTemplateHint": { en: "Save as a reusable template — hidden from project lists, offered when creating new projects", zh: "保存为可复用模板——不会显示在项目列表中，新建项目时可选用", ar: "احفظه كقالب قابل لإعادة الاستخدام — يُخفى من قوائم المشاريع ويُقترح عند إنشاء مشاريع جديدة" },
  "form.template":       { en: "Start from template", zh: "从模板开始",       ar: "البدء من قالب" },
  "form.template.blank": { en: "Blank project",     zh: "空白项目",          ar: "مشروع فارغ" },
  "form.template.hint":  { en: "Stages and the task checklist will be copied from this template.", zh: "将从该模板复制阶段和任务清单。", ar: "سيتم نسخ المراحل وقائمة المهام من هذا القالب." },

  /* Billing action */
  "bill.btn":            { en: "Invoice time",      zh: "时间开票",          ar: "فوترة الوقت" },
  "bill.tip":            { en: "Invoice all unbilled logged time (uses the project's billing rate)", zh: "为所有未开票的已记录时间开票（使用项目的计费费率）", ar: "فوترة كل الوقت المسجل غير المفوتر (باستخدام سعر الفوترة للمشروع)" },
  "bill.confirm":        { en: "Create a draft invoice for all unbilled logged time on this project?", zh: "为该项目所有未开票的已记录时间创建发票草稿？", ar: "إنشاء مسودة فاتورة لكل الوقت المسجل غير المفوتر في هذا المشروع؟" },

  /* Task workspace */
  "task.searchPh":       { en: "Search tasks…",     zh: "搜索任务…",         ar: "ابحث في المهام…" },
  "task.unassigned":     { en: "Unassigned",        zh: "未分配",            ar: "غير مسندة" },
  "task.blockedBy":      { en: "Blocked by",        zh: "受阻于",            ar: "محظورة بسبب" },
  "task.schedule":       { en: "Schedule in Planning", zh: "排入计划",        ar: "جدولة في التخطيط" },
  "task.scheduling":     { en: "Scheduling…",       zh: "排期中…",           ar: "جارٍ الجدولة…" },
  "task.viewPlanning":   { en: "View in Planning",  zh: "在计划中查看",       ar: "عرض في التخطيط" },
  "task.tab.details":    { en: "Details",           zh: "详情",              ar: "التفاصيل" },
  "task.tab.subtasks":   { en: "Subtasks",          zh: "子任务",            ar: "المهام الفرعية" },
  "task.tab.checklist":  { en: "Checklist",         zh: "清单",              ar: "قائمة التحقق" },
  "task.tab.comments":   { en: "Comments",          zh: "评论",              ar: "التعليقات" },
  "task.tab.time":       { en: "Time",              zh: "时间",              ar: "الوقت" },
  "task.tab.files":      { en: "Files",             zh: "文件",              ar: "الملفات" },

  /* Linked-entity types */
  "entity.customer":     { en: "Customer",          zh: "客户",              ar: "عميل" },
  "entity.supplier":     { en: "Supplier",          zh: "供应商",            ar: "مورد" },
  "entity.contact":      { en: "Contact",           zh: "联系人",            ar: "جهة اتصال" },
  "entity.product":      { en: "Product",           zh: "产品",              ar: "منتج" },

  /* Reporting + config */
  "report.byProject":    { en: "Project progress",  zh: "项目进度",          ar: "تقدم المشاريع" },
  "report.dueThisWeek":  { en: "Due this week",     zh: "本周到期",          ar: "مستحقة هذا الأسبوع" },
  "cfg.tags.empty":      { en: "No tags yet — add your first above.", zh: "暂无标签——请在上方添加第一个。", ar: "لا توجد علامات بعد — أضف الأولى أعلاه." },

  /* Super-admin audience lens */
  "sa.viewOwn": { en: "My view",   zh: "我的视图", ar: "عرضي" },
  "sa.viewAll": { en: "All users", zh: "所有用户", ar: "كل المستخدمين" },

  /* Relative dates */
  "date.today":          { en: "Today",             zh: "今天",              ar: "اليوم" },
  "date.tomorrow":       { en: "Tomorrow",          zh: "明天",              ar: "غدًا" },
  "date.yesterday":      { en: "Yesterday",         zh: "昨天",              ar: "أمس" },

  /* Audit 2026-09-25 — strings that were hard-coded English */
  "task.blocked":        { en: "Blocked",           zh: "受阻",              ar: "محظورة" },
  "task.reopen":         { en: "Reopen task",       zh: "重新打开任务",       ar: "إعادة فتح المهمة" },
  "task.markDone":       { en: "Mark done",         zh: "标记为完成",         ar: "وضع علامة منجزة" },
  "task.loggedHint":     { en: "From time entries", zh: "来自工时记录",       ar: "من سجلات الوقت" },
  "stage.deleteConfirm": { en: "Delete this stage? Its tasks will move to Unstaged.",
                           zh: "删除此阶段？其中的任务将移至“未分阶段”。",
                           ar: "حذف هذه المرحلة؟ ستنتقل مهامها إلى «بلا مرحلة»." },
  "stage.lastStage":     { en: "A project needs at least one stage.", zh: "项目至少需要一个阶段。", ar: "يحتاج المشروع إلى مرحلة واحدة على الأقل." },
  "stage.unstaged":      { en: "Unstaged",          zh: "未分阶段",          ar: "بلا مرحلة" },
  "stage.unstagedHint":  { en: "Their stage was deleted — drag them into a column.", zh: "其阶段已被删除——请拖入某一列。", ar: "حُذفت مرحلتها — اسحبها إلى عمود." },
  "tag.deleteConfirm":   { en: "Delete this tag?",  zh: "删除此标签？",       ar: "حذف هذه العلامة؟" },
  "bill.do":             { en: "Create invoice",    zh: "创建发票",          ar: "إنشاء فاتورة" },
  "bill.created":        { en: "{inv} created — {h}h billed. Opening Invoices…", zh: "已创建 {inv}——计费 {h} 小时。正在打开发票…", ar: "تم إنشاء {inv} — فوترة {h} ساعة. جارٍ فتح الفواتير…" },
  "x.doneOf":            { en: "{done} / {total} done", zh: "已完成 {done} / {total}", ar: "أُنجز {done} / {total}" },
  "x.uploading":         { en: "Uploading…",        zh: "上传中…",           ar: "جارٍ الرفع…" },
  "x.upload":            { en: "Upload file (max 25 MB)", zh: "上传文件（最大 25 MB）", ar: "رفع ملف (الحد الأقصى 25 ميغابايت)" },
  "x.invoiced":          { en: "Invoiced",          zh: "已开票",            ar: "مفوترة" },
  "x.addMilestone":      { en: "Add milestone",     zh: "添加里程碑",         ar: "إضافة مرحلة" },

  /* EntityTasksStrip */
  "strip.title":         { en: "Project tasks",     zh: "项目任务",          ar: "مهام المشاريع" },
  "strip.loading":       { en: "Loading tasks…",    zh: "正在加载任务…",      ar: "جارٍ تحميل المهام…" },
  "strip.open":          { en: "Open",              zh: "打开",              ar: "فتح" },
  "strip.empty":         { en: "No tasks linked to this record.", zh: "没有关联到此记录的任务。", ar: "لا توجد مهام مرتبطة بهذا السجل." },

  /* Feedback */
  "btn.saving":          { en: "Saving…",           zh: "保存中…",           ar: "جارٍ الحفظ…" },
  "btn.retry":           { en: "Retry",             zh: "重试",              ar: "إعادة المحاولة" },
  "toast.saveFailed":    { en: "Couldn't save — {err}", zh: "保存失败——{err}", ar: "تعذّر الحفظ — {err}" },
  "toast.deleteFailed":  { en: "Couldn't delete — {err}", zh: "删除失败——{err}", ar: "تعذّر الحذف — {err}" },
  "toast.moveFailed":    { en: "Couldn't move the task — {err}", zh: "无法移动任务——{err}", ar: "تعذّر نقل المهمة — {err}" },
  "error.load":          { en: "Couldn't load this list.", zh: "无法加载此列表。", ar: "تعذّر تحميل هذه القائمة." },
  "error.projectLoad":   { en: "Couldn't load this project — it may have been deleted, or you may not have access.",
                           zh: "无法加载此项目——它可能已被删除，或您没有访问权限。",
                           ar: "تعذّر تحميل هذا المشروع — ربما حُذف أو ليس لديك صلاحية الوصول." },
  "empty.noMatch":       { en: "No projects match this view.", zh: "没有符合此视图的项目。", ar: "لا توجد مشاريع تطابق هذا العرض." },

  /* Icon-only button labels */
  "tip.back":            { en: "Back to projects",  zh: "返回项目",          ar: "العودة إلى المشاريع" },
  "tip.close":           { en: "Close",             zh: "关闭",              ar: "إغلاق" },
  "tip.editProject":     { en: "Edit project",      zh: "编辑项目",          ar: "تعديل المشروع" },
  "tip.editStage":       { en: "Rename stage",      zh: "重命名阶段",         ar: "إعادة تسمية المرحلة" },
  "tip.deleteStage":     { en: "Delete stage",      zh: "删除阶段",          ar: "حذف المرحلة" },
  "tip.stageColor":      { en: "Stage colour",      zh: "阶段颜色",          ar: "لون المرحلة" },
  "tip.editTag":         { en: "Edit tag",          zh: "编辑标签",          ar: "تعديل العلامة" },
  "tip.deleteTag":       { en: "Delete tag",        zh: "删除标签",          ar: "حذف العلامة" },
  "tip.tagColor":        { en: "Tag colour",        zh: "标签颜色",          ar: "لون العلامة" },
  "tip.addItem":         { en: "Add",               zh: "添加",              ar: "إضافة" },
  "tip.delete":          { en: "Delete",            zh: "删除",              ar: "حذف" },
  "tip.toggleDone":      { en: "Toggle done",       zh: "切换完成状态",       ar: "تبديل حالة الإنجاز" },
  "tip.searchProjects":  { en: "Search projects",   zh: "搜索项目",          ar: "ابحث في المشاريع" },

  /* ── 2026-09-26 additions ─────────────────────────────────────── */
  /* Timeline */
  "view.timeline":       { en: "Timeline",          zh: "时间线",            ar: "الخط الزمني" },
  "tl.zoom":             { en: "Zoom",              zh: "缩放",              ar: "التكبير" },
  "tl.zoom.week":        { en: "Week",              zh: "周",                ar: "أسبوع" },
  "tl.zoom.month":       { en: "Month",             zh: "月",                ar: "شهر" },
  "tl.zoom.quarter":     { en: "Quarter",           zh: "季度",              ar: "ربع سنة" },
  "tl.today":            { en: "Today",             zh: "今天",              ar: "اليوم" },
  "tl.jumpToday":        { en: "Jump to today",     zh: "跳到今天",          ar: "الانتقال إلى اليوم" },
  "tl.noDates":          { en: "No tasks or milestones to place on the timeline yet.", zh: "暂无可放在时间线上的任务或里程碑。", ar: "لا توجد مهام أو مراحل لوضعها على الخط الزمني بعد." },
  "tl.hint":             { en: "Drag a bar to move it; drag its ends to change the dates. Arrow keys move a focused bar by a day (Shift: resize).", zh: "拖动条形以移动；拖动两端以更改日期。聚焦条形后可用方向键按天移动（Shift：调整长度）。", ar: "اسحب الشريط لنقله، واسحب طرفيه لتغيير التواريخ. تحرّك مفاتيح الأسهم الشريطَ المحدد يومًا (Shift: تغيير المدة)." },
  "tl.blockedWarn":      { en: "Starts before its blocker ends", zh: "在前置任务结束前开始", ar: "تبدأ قبل انتهاء المهمة المانعة" },
  "tl.noDue":            { en: "No due date — showing one day", zh: "无截止日期——显示为一天", ar: "بلا تاريخ استحقاق — تُعرض كيوم واحد" },
  "tl.milestone":        { en: "Milestone",         zh: "里程碑",            ar: "مرحلة رئيسية" },
  "tl.milestones":       { en: "Milestones",        zh: "里程碑",            ar: "المراحل الرئيسية" },
  "tl.rows":             { en: "Tasks by stage",    zh: "按阶段的任务",       ar: "المهام حسب المرحلة" },
  "tl.bar":              { en: "{title}: {start} → {end}", zh: "{title}：{start} → {end}", ar: "{title}: {start} ← {end}" },
  "task.startDate":      { en: "Start date",        zh: "开始日期",          ar: "تاريخ البدء" },

  /* Members */
  "mem.title":           { en: "Members",           zh: "成员",              ar: "الأعضاء" },
  "mem.open":            { en: "Project members",   zh: "项目成员",          ar: "أعضاء المشروع" },
  "mem.add":             { en: "Add member",        zh: "添加成员",          ar: "إضافة عضو" },
  "mem.pick":            { en: "Choose a person…",  zh: "选择人员…",         ar: "اختر شخصًا…" },
  "mem.role":            { en: "Role",              zh: "角色",              ar: "الدور" },
  "mem.role.manager":    { en: "Manager",           zh: "管理者",            ar: "مدير" },
  "mem.role.member":     { en: "Member",            zh: "成员",              ar: "عضو" },
  "mem.role.viewer":     { en: "Viewer",            zh: "查看者",            ar: "مشاهد" },
  "mem.roleHelp":        { en: "Managers edit members and archive; members work on tasks; viewers can only look.", zh: "管理者可管理成员并归档；成员处理任务；查看者只能查看。", ar: "المديرون يديرون الأعضاء والأرشفة؛ الأعضاء يعملون على المهام؛ المشاهدون للاطلاع فقط." },
  "mem.remove":          { en: "Remove member",     zh: "移除成员",          ar: "إزالة العضو" },
  "mem.removeConfirm":   { en: "Remove {name} from this project? They also leave the project chat.", zh: "从此项目中移除 {name}？其也将退出项目聊天。", ar: "إزالة {name} من هذا المشروع؟ سيغادر أيضًا دردشة المشروع." },
  "mem.empty":           { en: "No members yet.",   zh: "暂无成员。",         ar: "لا يوجد أعضاء بعد." },
  "mem.notAvailable":    { en: "Project members become available once the database update is applied.", zh: "数据库更新应用后即可使用项目成员功能。", ar: "ستتوفر ميزة أعضاء المشروع بعد تطبيق تحديث قاعدة البيانات." },
  "mem.readOnly":        { en: "Only the project's managers can change members.", zh: "只有项目管理者可以更改成员。", ar: "يمكن لمديري المشروع فقط تغيير الأعضاء." },
  "mem.projectManager":  { en: "Project manager",   zh: "项目负责人",         ar: "مدير المشروع" },
  "mem.added":           { en: "Member added.",     zh: "已添加成员。",       ar: "تمت إضافة العضو." },

  /* Archive / delete */
  "action.archive":      { en: "Archive",           zh: "归档",              ar: "أرشفة" },
  "action.restore":      { en: "Restore",           zh: "恢复",              ar: "استعادة" },
  "archive.confirm":     { en: "Archive this project? It leaves the active lists and can be restored at any time.", zh: "归档此项目？它将从活动列表中移除，可随时恢复。", ar: "أرشفة هذا المشروع؟ سيُزال من القوائم النشطة ويمكن استعادته في أي وقت." },
  "archive.done":        { en: "Project archived.", zh: "项目已归档。",       ar: "تمت أرشفة المشروع." },
  "restore.done":        { en: "Project restored.", zh: "项目已恢复。",       ar: "تمت استعادة المشروع." },
  "archive.banner":      { en: "This project is archived.", zh: "此项目已归档。", ar: "هذا المشروع مؤرشف." },
  "archive.since":       { en: "Archived {date}",   zh: "归档于 {date}",      ar: "أُرشف في {date}" },
  "delete.permanent":    { en: "Delete permanently", zh: "永久删除",          ar: "حذف نهائي" },
  "delete.typeName":     { en: "This permanently deletes the project, its tasks, time and files. It cannot be undone. Type the project name to confirm:", zh: "这将永久删除该项目及其任务、工时和文件，且无法撤销。请输入项目名称以确认：", ar: "سيؤدي هذا إلى حذف المشروع ومهامه ووقته وملفاته نهائيًا، ولا يمكن التراجع. اكتب اسم المشروع للتأكيد:" },
  "delete.namePh":       { en: "Project name",      zh: "项目名称",          ar: "اسم المشروع" },

  /* Budget */
  "budget.title":        { en: "Budget",            zh: "预算",              ar: "الميزانية" },
  "budget.hours":        { en: "Hours",             zh: "工时",              ar: "الساعات" },
  "budget.amount":       { en: "Amount",            zh: "金额",              ar: "المبلغ" },
  "budget.of":           { en: "{actual} of {planned}", zh: "{actual} / {planned}", ar: "{actual} من {planned}" },
  "budget.logged":       { en: "{actual} logged",   zh: "已记录 {actual}",    ar: "مسجّل {actual}" },
  "budget.over":         { en: "Over budget",       zh: "超出预算",          ar: "تجاوز الميزانية" },
  "budget.noRate":       { en: "No billing rate — hours only", zh: "未设置计费费率——仅显示工时", ar: "لا يوجد سعر فوترة — الساعات فقط" },
  "report.budget":       { en: "Budget vs actual",  zh: "预算与实际",         ar: "الميزانية مقابل الفعلي" },
  "report.noBudgets":    { en: "No project has a budget yet.", zh: "暂无设置预算的项目。", ar: "لا يوجد مشروع بميزانية بعد." },
  "form.currency":       { en: "Currency",          zh: "货币",              ar: "العملة" },

  /* Bulk actions */
  "bulk.selected":       { en: "{n} selected",      zh: "已选 {n} 项",        ar: "تم تحديد {n}" },
  "bulk.select":         { en: "Select task",       zh: "选择任务",          ar: "تحديد المهمة" },
  "bulk.selectAll":      { en: "Select all",        zh: "全选",              ar: "تحديد الكل" },
  "bulk.clear":          { en: "Clear selection",   zh: "清除选择",          ar: "مسح التحديد" },
  "bulk.moveStage":      { en: "Move to stage",     zh: "移至阶段",          ar: "نقل إلى مرحلة" },
  "bulk.assign":         { en: "Assign to",         zh: "分配给",            ar: "إسناد إلى" },
  "bulk.due":            { en: "Set due date",      zh: "设置截止日期",       ar: "تعيين تاريخ الاستحقاق" },
  "bulk.clearDue":       { en: "Clear due date",    zh: "清除截止日期",       ar: "مسح تاريخ الاستحقاق" },
  "bulk.priority":       { en: "Set priority",      zh: "设置优先级",         ar: "تعيين الأولوية" },
  "bulk.status":         { en: "Set status",        zh: "设置状态",          ar: "تعيين الحالة" },
  "bulk.delete":         { en: "Delete",            zh: "删除",              ar: "حذف" },
  "bulk.deleteConfirm":  { en: "Delete {n} tasks? This cannot be undone.", zh: "删除 {n} 个任务？此操作无法撤销。", ar: "حذف {n} مهام؟ لا يمكن التراجع عن ذلك." },
  "bulk.done":           { en: "Updated {n} tasks.", zh: "已更新 {n} 个任务。", ar: "تم تحديث {n} مهام." },
  "bulk.deleted":        { en: "Deleted {n} tasks.", zh: "已删除 {n} 个任务。", ar: "تم حذف {n} مهام." },
  "bulk.toolbar":        { en: "Bulk actions",      zh: "批量操作",          ar: "إجراءات جماعية" },
  "bulk.shiftHint":      { en: "Shift-click to select a range", zh: "按住 Shift 点击以选择范围", ar: "Shift مع النقر لتحديد نطاق" },

  /* Quick add */
  "qa.placeholder":      { en: "Add a task… (Enter)", zh: "添加任务…（回车）", ar: "أضف مهمة… (Enter)" },

  /* Filters + saved filters */
  "filter.assignee":     { en: "Assignee",          zh: "负责人",            ar: "المكلف" },
  "filter.anyAssignee":  { en: "Anyone",            zh: "任何人",            ar: "أي شخص" },
  "filter.tag":          { en: "Tag",               zh: "标签",              ar: "العلامة" },
  "filter.anyTag":       { en: "Any tag",           zh: "任意标签",          ar: "أي علامة" },
  "filter.reset":        { en: "Reset filters",     zh: "重置筛选",          ar: "إعادة ضبط عوامل التصفية" },
  "sf.saved":            { en: "Saved filters",     zh: "已保存的筛选",       ar: "عوامل التصفية المحفوظة" },
  "sf.save":             { en: "Save current filters", zh: "保存当前筛选",     ar: "حفظ عوامل التصفية الحالية" },
  "sf.namePh":           { en: "Name this filter",  zh: "为此筛选命名",       ar: "سمِّ عامل التصفية" },
  "sf.delete":           { en: "Delete saved filter", zh: "删除已保存的筛选",  ar: "حذف عامل التصفية المحفوظ" },
  "sf.none":             { en: "No saved filters yet.", zh: "暂无已保存的筛选。", ar: "لا توجد عوامل تصفية محفوظة بعد." },
  "sf.savedToast":       { en: "Filter saved.",     zh: "筛选已保存。",       ar: "تم حفظ عامل التصفية." },

  /* Project chat */
  "chat.open":           { en: "Open project chat", zh: "打开项目聊天",       ar: "فتح دردشة المشروع" },
  "chat.short":          { en: "Chat",              zh: "聊天",              ar: "دردشة" },
  "chat.notAvailable":   { en: "Project chat becomes available once the database update is applied.", zh: "数据库更新应用后即可使用项目聊天。", ar: "ستتوفر دردشة المشروع بعد تطبيق تحديث قاعدة البيانات." },

  /* Due today strip */
  "due.title":           { en: "Due today & overdue", zh: "今日到期与逾期",   ar: "مستحقة اليوم ومتأخرة" },
  "due.count":           { en: "{today} today · {overdue} overdue", zh: "今日 {today} · 逾期 {overdue}", ar: "{today} اليوم · {overdue} متأخرة" },
  "due.readOnly":        { en: "View only",         zh: "仅查看",            ar: "للعرض فقط" },

  /* Viewer (read-only) access */
  "access.viewOnly":     { en: "View only",         zh: "仅查看",            ar: "للعرض فقط" },
  "access.viewOnlyTip":  { en: "You are a viewer on this project — you can look but not make changes, except to tasks you created.", zh: "您是此项目的查看者——可以查看但不能更改，您创建的任务除外。", ar: "أنت مشاهد في هذا المشروع — يمكنك الاطلاع دون إجراء تغييرات، باستثناء المهام التي أنشأتها." },
  "access.ownTaskEdit":  { en: "You have view-only access to this project, but you can edit this task because you created it or it is assigned to you.", zh: "您对此项目只有查看权限，但由于此任务由您创建或分配给您，您可以编辑它。", ar: "لديك صلاحية العرض فقط في هذا المشروع، لكن يمكنك تعديل هذه المهمة لأنك أنشأتها أو لأنها مسندة إليك." },
  "btn.close":           { en: "Close",             zh: "关闭",              ar: "إغلاق" },
};
