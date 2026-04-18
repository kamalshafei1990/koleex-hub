import type { Translations } from "@/lib/i18n";

export const projectsT: Translations = {
  /* App shell */
  "app.title":         { en: "Projects",            zh: "项目",              ar: "المشاريع" },
  "app.subtitle":      { en: "Organise work into projects with kanban tasks, stages, and tags.",
                         zh: "将工作组织为项目，并使用看板任务、阶段和标签进行管理。",
                         ar: "نظّم العمل في مشاريع باستخدام مهام كانبان والمراحل والعلامات." },
  "action.new":        { en: "New",                 zh: "新建",              ar: "جديد" },
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
  "card.favourite":    { en: "Favourite",           zh: "收藏",              ar: "مفضلة" },
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
  "form.customer":     { en: "Customer",            zh: "客户",              ar: "العميل" },
  "form.manager":      { en: "Manager",             zh: "负责人",            ar: "المدير" },
  "form.billable":     { en: "Billable",            zh: "可计费",            ar: "قابلة للفوترة" },
  "form.plannedStart": { en: "Start",               zh: "开始",              ar: "البداية" },
  "form.plannedEnd":   { en: "End",                 zh: "结束",              ar: "النهاية" },
  "form.budgetHours":  { en: "Budget (hrs)",        zh: "预算（小时）",      ar: "الميزانية (ساعة)" },

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
  "cfg.stages.help":   { en: "Kanban columns — customise per project. Closed stages count tasks as done.",
                         zh: "看板列——可按项目自定义。\"已关闭\"阶段中的任务视为完成。",
                         ar: "أعمدة كانبان — تُخصّص لكل مشروع. المهام في المراحل المغلقة تُعدّ منجزة." },
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
  "btn.close":         { en: "Close",               zh: "关闭",              ar: "إغلاق" },
  "btn.back":          { en: "Back",                zh: "返回",              ar: "رجوع" },
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
  "tip.rename":        { en: "Rename",              zh: "重命名",            ar: "إعادة تسمية" },
  "tip.favourite":     { en: "Toggle favourite",    zh: "切换收藏",          ar: "تبديل التفضيل" },
};
