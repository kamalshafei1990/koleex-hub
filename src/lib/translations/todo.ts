import type { Translations } from "@/lib/i18n";

/* Todo app — list + filters + task modal. */

export const todoT: Translations = {
  "app.title":         { en: "To-do",                     zh: "待办",                   ar: "المهام" },
  "add":               { en: "Add Task",                  zh: "添加任务",               ar: "إضافة مهمة" },
  "search":            { en: "Search tasks...",           zh: "搜索任务...",            ar: "ابحث في المهام..." },

  /* Filters */
  "filters":           { en: "Filters",                   zh: "筛选",                   ar: "المرشحات" },
  "filters.allAssignees": { en: "All Assignees",          zh: "所有受托人",             ar: "كل المكلفين" },
  "filters.allDepts":  { en: "All Departments",           zh: "所有部门",               ar: "كل الأقسام" },
  "filters.allLabels": { en: "All Labels",                zh: "所有标签",               ar: "كل الوسوم" },
  "filters.fromDate":  { en: "From date",                 zh: "起始日期",               ar: "من تاريخ" },
  "filters.toDate":    { en: "To date",                   zh: "结束日期",               ar: "إلى تاريخ" },
  "filters.searchEmployees": { en: "Search employees...", zh: "搜索员工...",            ar: "ابحث عن الموظفين..." },
  "filters.clear":     { en: "Clear filters",             zh: "清除筛选",               ar: "مسح المرشحات" },

  /* Sections / buckets */
  "section.overdue":   { en: "Overdue",                   zh: "逾期",                   ar: "متأخرة" },
  "section.today":     { en: "Today",                     zh: "今天",                   ar: "اليوم" },
  "section.upcoming":  { en: "Upcoming",                  zh: "即将到来",               ar: "قادمة" },
  "section.noDate":    { en: "No Due Date",               zh: "无截止日期",             ar: "بدون تاريخ" },
  "section.completed": { en: "Completed",                 zh: "已完成",                 ar: "مكتملة" },

  /* KPI strip */
  "kpi.total":         { en: "Total",                     zh: "总计",                   ar: "الإجمالي" },
  "kpi.active":        { en: "Active",                    zh: "活跃",                   ar: "نشِطة" },
  "kpi.completed":     { en: "Completed",                 zh: "已完成",                 ar: "مكتملة" },
  "kpi.overdue":       { en: "Overdue",                   zh: "逾期",                   ar: "متأخرة" },
  "kpi.topPerformers": { en: "Top Performers",            zh: "优秀执行者",             ar: "الأعلى أداءً" },

  /* Date chips */
  "date.today":        { en: "Today",                     zh: "今天",                   ar: "اليوم" },
  "date.tomorrow":     { en: "Tomorrow",                  zh: "明天",                   ar: "غدًا" },
  "date.yesterday":    { en: "Yesterday",                 zh: "昨天",                   ar: "أمس" },
  "date.inDays":       { en: "In {n} days",               zh: "{n} 天后",               ar: "خلال {n} أيام" },
  "date.daysAgo":      { en: "{n} days ago",              zh: "{n} 天前",               ar: "قبل {n} أيام" },

  /* Task modal */
  "modal.add":         { en: "Add Task",                  zh: "添加任务",               ar: "إضافة مهمة" },
  "modal.edit":        { en: "Edit Task",                 zh: "编辑任务",               ar: "تعديل المهمة" },
  "modal.delete":      { en: "Delete Task",               zh: "删除任务",               ar: "حذف المهمة" },
  "modal.deleteConfirm":{ en: "This action cannot be undone.", zh: "此操作不可撤销。",  ar: "لا يمكن التراجع عن هذا الإجراء." },
  "modal.save":        { en: "Save",                      zh: "保存",                   ar: "حفظ" },
  "modal.cancel":      { en: "Cancel",                    zh: "取消",                   ar: "إلغاء" },
  "modal.saving":      { en: "Saving…",                   zh: "保存中…",                ar: "جارٍ الحفظ…" },

  /* Task fields */
  "f.title":           { en: "Title",                     zh: "标题",                   ar: "العنوان" },
  "f.title.placeholder":{ en: "What needs to be done?",   zh: "要做什么？",             ar: "ما الذي يجب فعله؟" },
  "f.description":     { en: "Description",               zh: "描述",                   ar: "الوصف" },
  "f.description.placeholder": { en: "Add details...",    zh: "补充详情...",            ar: "أضف التفاصيل..." },
  "f.priority":        { en: "Priority",                  zh: "优先级",                 ar: "الأولوية" },
  "f.dueDate":         { en: "Due Date",                  zh: "截止日期",               ar: "تاريخ الاستحقاق" },
  "f.assignTo":        { en: "Assign To",                 zh: "分配给",                 ar: "تكليف" },
  "f.label":           { en: "Label",                     zh: "标签",                   ar: "الوسم" },
  "f.label.placeholder":{ en: "Label name",               zh: "标签名称",               ar: "اسم الوسم" },

  /* Priority */
  "p.low":             { en: "Low",                       zh: "低",                     ar: "منخفضة" },
  "p.normal":          { en: "Normal",                    zh: "普通",                   ar: "عادية" },
  "p.high":            { en: "High",                      zh: "高",                     ar: "مرتفعة" },
  "p.urgent":          { en: "Urgent",                    zh: "紧急",                   ar: "عاجلة" },

  /* Status */
  "s.open":            { en: "Open",                      zh: "进行中",                 ar: "مفتوحة" },
  "s.done":            { en: "Done",                      zh: "完成",                   ar: "منجزة" },
  "s.cancelled":       { en: "Cancelled",                 zh: "已取消",                 ar: "ملغاة" },

  /* Notes / activity */
  "notes":             { en: "Notes",                     zh: "笔记",                   ar: "الملاحظات" },
  "notes.placeholder": { en: "Write a note...",           zh: "写一条笔记...",          ar: "اكتب ملاحظة..." },
  "notes.add":         { en: "Add note",                  zh: "添加笔记",               ar: "أضف ملاحظة" },
  "activity":          { en: "Activity",                  zh: "动态",                   ar: "النشاط" },

  /* Empty states */
  "empty.title":       { en: "No tasks yet",              zh: "暂无任务",               ar: "لا توجد مهام بعد" },
  "empty.body":        { en: "Create your first task to get started.", zh: "创建第一个任务开始使用。", ar: "أنشئ أول مهمة لتبدأ." },
  "empty.filtered":    { en: "No tasks match your filters.", zh: "没有任务符合筛选条件。", ar: "لا توجد مهام مطابقة للمرشحات." },

  /* Toast / errors */
  "toast.created":     { en: "Task created",              zh: "任务已创建",             ar: "تم إنشاء المهمة" },
  "toast.updated":     { en: "Task updated",              zh: "任务已更新",             ar: "تم تحديث المهمة" },
  "toast.deleted":     { en: "Task deleted",              zh: "任务已删除",             ar: "تم حذف المهمة" },
  "toast.marked":      { en: "Marked as done",            zh: "已标记完成",             ar: "تم تمييزها كمنجزة" },

  /* App chrome + filter pills */
  "app.subtitle":      { en: "Task management",            zh: "任务管理",               ar: "إدارة المهام" },
  "pill.assignedToMe": { en: "Assigned to me",             zh: "分配给我",               ar: "مُسندة إليّ" },
  "src.all":           { en: "All",                        zh: "全部",                   ar: "الكل" },
  "src.mine":          { en: "My tasks",                   zh: "我的任务",               ar: "مهامي" },
  "row.assignedBy":    { en: "assigned by",                zh: "分配自",                 ar: "أسندها" },
  "row.onTime":        { en: "On time",                    zh: "按时",                   ar: "في الوقت" },
  "row.late":          { en: "Late",                       zh: "逾期完成",               ar: "متأخر" },
  "pill.all":          { en: "All",                        zh: "全部",                   ar: "الكل" },
  "pill.active":       { en: "Active",                     zh: "进行中",                 ar: "نشِطة" },
  "pill.done":         { en: "Done",                       zh: "已完成",                 ar: "منجزة" },

  /* Cadence lens + recurrence (Phase C) */
  "cadence.all":       { en: "All",                        zh: "全部",                   ar: "الكل" },
  "cadence.day":       { en: "Today",                      zh: "今天",                   ar: "اليوم" },
  "cadence.week":      { en: "This week",                  zh: "本周",                   ar: "هذا الأسبوع" },
  "cadence.month":     { en: "This month",                 zh: "本月",                   ar: "هذا الشهر" },
  "rec.once":          { en: "Once",                       zh: "一次",                   ar: "مرة واحدة" },
  "rec.daily":         { en: "Daily",                      zh: "每日",                   ar: "يومي" },
  "rec.weekly":        { en: "Weekly",                     zh: "每周",                   ar: "أسبوعي" },
  "rec.monthly":       { en: "Monthly",                    zh: "每月",                   ar: "شهري" },
  "f.recurrence":      { en: "Repeat",                     zh: "重复",                   ar: "التكرار" },
  "f.recurrenceUntil": { en: "Until",                      zh: "截止",                   ar: "حتى" },
  "f.recurrenceForever": { en: "No end date",              zh: "无截止日期",             ar: "بدون تاريخ انتهاء" },
  "common.clear":      { en: "Clear",                      zh: "清除",                   ar: "مسح" },

  /* View / sort / bulk */
  "view.list":         { en: "List",                       zh: "列表",                   ar: "قائمة" },
  "view.board":        { en: "Board",                      zh: "看板",                   ar: "لوحة" },
  "sort.smart":        { en: "Smart",                      zh: "智能排序",               ar: "ذكي" },
  "sort.due":          { en: "By due date",                zh: "按截止日期",             ar: "حسب الاستحقاق" },
  "sort.priority":     { en: "By priority",                zh: "按优先级",               ar: "حسب الأولوية" },
  "sort.created":      { en: "Newest",                     zh: "最新",                   ar: "الأحدث" },
  "bulk.select":       { en: "Select",                     zh: "选择",                   ar: "تحديد" },
  "bulk.cancel":       { en: "Cancel",                     zh: "取消",                   ar: "إلغاء" },
  "bulk.selected":     { en: "selected",                   zh: "已选",                   ar: "محدد" },
  "bulk.markDone":     { en: "Mark done",                  zh: "标记完成",               ar: "تحديد كمنجز" },
  "bulk.setStatus":    { en: "Set status…",                zh: "设置状态…",              ar: "تعيين الحالة…" },
  "bulk.reassign":     { en: "Reassign to…",               zh: "重新分配给…",            ar: "إعادة الإسناد إلى…" },
  "bulk.delete":       { en: "Delete",                     zh: "删除",                   ar: "حذف" },

  /* Approval loop */
  "approval.pending":   { en: "Awaiting approval",         zh: "等待审批",               ar: "بانتظار الموافقة" },
  "pill.approvals":     { en: "Waiting my approval",       zh: "待我审批",               ar: "بانتظار موافقتي" },
  "approval.submitted": { en: "Submitted — waiting for your manager to confirm.", zh: "已提交，等待经理确认。", ar: "تم الإرسال — بانتظار تأكيد مديرك." },
  "approval.awaitingYou": { en: "Marked done — approve it?", zh: "已标记完成——是否批准？", ar: "تم وضع علامة كمنجز — هل توافق؟" },
  "approval.confirm":   { en: "Confirm",                    zh: "确认",                   ar: "تأكيد" },
  "approval.reopen":    { en: "Reopen",                     zh: "重新打开",               ar: "إعادة فتح" },
  "approval.rejectTitle": { en: "Send back for rework",     zh: "退回返工",               ar: "إعادة للمراجعة" },
  "approval.rejectHint": { en: "Tell the assignee why this isn't approved yet. They'll see it on the task and get a notification.", zh: "告诉执行人为什么尚未批准。他们会在任务上看到原因并收到通知。", ar: "أخبر المكلّف لماذا لم تتم الموافقة بعد. سيظهر السبب على المهمة وسيصله إشعار." },
  "approval.rejectPlaceholder": { en: "Reason (optional) — e.g. missing the report attachment…", zh: "原因（可选）— 例如：缺少报告附件…", ar: "السبب (اختياري) — مثال: مرفق التقرير ناقص…" },
  "approval.rejectSubmit": { en: "Send back",               zh: "退回",                   ar: "إعادة" },
  "approval.returned":  { en: "Returned",                   zh: "已退回",                 ar: "أُعيدت" },

  /* Priority (medium was missing) */
  "p.medium":          { en: "Medium",                     zh: "中",                     ar: "متوسطة" },

  /* Status stages */
  "st.todo":           { en: "To do",                      zh: "待办",                   ar: "قيد الانتظار" },
  "st.in_progress":    { en: "In progress",                zh: "进行中",                 ar: "قيد التنفيذ" },
  "st.blocked":        { en: "Blocked",                    zh: "受阻",                   ar: "متوقفة" },
  "st.done":           { en: "Done",                       zh: "已完成",                 ar: "منجزة" },

  /* KPI cards */
  "kpi.totalTasks":    { en: "Total Tasks",                zh: "任务总数",               ar: "إجمالي المهام" },
  "kpi.highPriority":  { en: "High Priority",              zh: "高优先级",               ar: "أولوية عالية" },
  "kpi.doneThisWeek":  { en: "Done This Week",             zh: "本周完成",               ar: "أُنجزت هذا الأسبوع" },
  "kpi.completion":    { en: "Completion",                 zh: "完成率",                 ar: "نسبة الإنجاز" },
  "kpi.completedWord": { en: "completed",                  zh: "个已完成",               ar: "منجزة" },

  /* Task fields (added) */
  "f.status":          { en: "Status",                     zh: "状态",                   ar: "الحالة" },
  "f.startDate":       { en: "Start Date",                 zh: "开始日期",               ar: "تاريخ البدء" },
  "f.reminder":        { en: "Reminder",                   zh: "提醒",                   ar: "تذكير" },
  "f.selectDate":      { en: "Select date",                zh: "选择日期",               ar: "اختر تاريخًا" },

  /* Filters (added) */
  "filters.allStatuses": { en: "All Statuses",             zh: "所有状态",               ar: "كل الحالات" },
  "filters.clearBtn":  { en: "Clear Filters",              zh: "清除筛选",               ar: "مسح المرشحات" },

  /* Assign */
  "assign.selectedWord": { en: "selected",                 zh: "人已选",                 ar: "مختار" },
  "assign.none":       { en: "No employees found",         zh: "未找到员工",             ar: "لا يوجد موظفون" },

  /* Checklist */
  "checklist.title":   { en: "Checklist",                  zh: "清单",                   ar: "قائمة المهام" },
  "checklist.placeholder": { en: "Add a subtask…",         zh: "添加子任务…",            ar: "أضف مهمة فرعية…" },

  /* Empty states (added) */
  "empty.noSearch":    { en: "No tasks match your search", zh: "没有匹配搜索的任务",     ar: "لا توجد مهام مطابقة لبحثك" },
  "empty.noCompleted": { en: "No completed tasks",         zh: "暂无已完成任务",         ar: "لا توجد مهام منجزة" },
  "empty.createFirst": { en: "Create your first task",     zh: "创建你的第一个任务",     ar: "أنشئ أول مهمة لك" },

  /* Task row */
  "row.from":          { en: "from",                       zh: "来自",                   ar: "من" },
  "src.crm":           { en: "CRM",                        zh: "CRM",                    ar: "CRM" },
  "src.calendar":      { en: "Calendar",                   zh: "日历",                   ar: "التقويم" },

  /* Common words */
  "common.optional":   { en: "(optional)",                 zh: "（可选）",               ar: "(اختياري)" },
  "common.add":        { en: "Add",                        zh: "添加",                   ar: "إضافة" },
  "common.new":        { en: "New",                        zh: "新建",                   ar: "جديد" },
  "common.done":       { en: "Done",                       zh: "完成",                   ar: "تم" },
  "common.remove":     { en: "Remove",                     zh: "移除",                   ar: "إزالة" },
  "common.notes":      { en: "Notes",                      zh: "笔记",                   ar: "الملاحظات" },

  /* Extras (attachments / mentions / products) */
  "extras.toggle":     { en: "Attachments, mentions & products", zh: "附件、提及和产品", ar: "المرفقات والإشارات والمنتجات" },
  "extras.attachments": { en: "Attachments",               zh: "附件",                   ar: "المرفقات" },
  "extras.attachFile": { en: "Attach file",                zh: "添加文件",               ar: "إرفاق ملف" },
  "extras.captureScreen": { en: "Capture screen",          zh: "截屏",                   ar: "التقاط الشاشة" },
  "extras.pasteHint":  { en: "or paste an image (⌘/Ctrl+V)", zh: "或粘贴图片 (⌘/Ctrl+V)", ar: "أو الصق صورة (⌘/Ctrl+V)" },
  "extras.mention":    { en: "Mention people",             zh: "提及成员",               ar: "الإشارة إلى أشخاص" },
  "extras.mentionSearch": { en: "Search to mention…",      zh: "搜索以提及…",            ar: "ابحث للإشارة…" },
  "extras.noMatches":  { en: "No matches",                 zh: "无匹配结果",             ar: "لا توجد نتائج" },
  "f.label.choose":    { en: "Choose a label…",            zh: "选择标签…",              ar: "اختر تصنيفًا…" },
  "f.label.search":    { en: "Search labels…",             zh: "搜索标签…",              ar: "ابحث في التصنيفات…" },
  "extras.observers":  { en: "Observers",                  zh: "关注人",                 ar: "المراقبون" },
  "extras.observerSearch": { en: "Add an observer…",       zh: "添加关注人…",            ar: "أضف مراقبًا…" },
  "extras.observerHint": { en: "Observers follow the task and can update its situation — their “Done” still needs the assigner's confirmation.", zh: "关注人可跟进任务并更新其状态——其“完成”仍需分配人确认。", ar: "يتابع المراقبون المهمة ويمكنهم تحديث حالتها — ويظل إتمامهم بحاجة إلى تأكيد من مُسنِد المهمة." },
  "extras.linkProducts": { en: "Link products",            zh: "关联产品",               ar: "ربط المنتجات" },
  "extras.browseProducts": { en: "Browse products",        zh: "浏览产品",               ar: "تصفح المنتجات" },
  "extras.uploadFailed": { en: "Upload failed",            zh: "上传失败",               ar: "فشل الرفع" },
  "extras.captureUnsupported": { en: "Screen capture isn't supported in this browser.", zh: "此浏览器不支持屏幕截图。", ar: "التقاط الشاشة غير مدعوم في هذا المتصفح." },

  /* Product picker */
  "picker.search":     { en: "Search by name or code…",    zh: "按名称或编号搜索…",      ar: "ابحث بالاسم أو الرمز…" },
  "picker.allDivisions": { en: "All divisions",            zh: "所有分区",               ar: "كل الأقسام" },
  "picker.allCategories": { en: "All categories",          zh: "所有类别",               ar: "كل الفئات" },
  "picker.noMatch":    { en: "No products match.",         zh: "没有匹配的产品。",       ar: "لا توجد منتجات مطابقة." },
  "picker.selectedWord": { en: "selected",                 zh: "个已选",                 ar: "مختار" },
  "picker.productsWord": { en: "products",                 zh: "个产品",                 ar: "منتجات" },

  /* Errors */
  "err.titleRequired": { en: "Title is required.",         zh: "标题为必填项。",         ar: "العنوان مطلوب." },
  "err.generic":       { en: "Something went wrong.",      zh: "出了点问题。",           ar: "حدث خطأ ما." },

  /* Manager report */
  "report.link":       { en: "Reports",                    zh: "报告",                   ar: "التقارير" },
  "report.title":      { en: "Assignment Report",          zh: "任务分配报告",           ar: "تقرير المهام المُسندة" },
  "report.subtitle":   { en: "What you assigned and how it's going",  zh: "你分配的任务及其进展", ar: "ما أسندته وحالة تنفيذه" },
  "report.person":     { en: "Person",                     zh: "人员",                   ar: "الشخص" },
  "report.everyone":   { en: "Everyone",                   zh: "所有人",                 ar: "الجميع" },
  "report.period":     { en: "Period",                     zh: "周期",                   ar: "الفترة" },
  "report.today":      { en: "Today",                      zh: "今天",                   ar: "اليوم" },
  "report.week":       { en: "This week",                  zh: "本周",                   ar: "هذا الأسبوع" },
  "report.month":      { en: "This month",                 zh: "本月",                   ar: "هذا الشهر" },
  "report.custom":     { en: "Custom",                     zh: "自定义",                 ar: "مخصص" },
  "report.assigned":   { en: "Assigned",                   zh: "已分配",                 ar: "مُسندة" },
  "report.notStarted": { en: "Not started",                zh: "未开始",                 ar: "لم تبدأ" },
  "report.onTimeRate": { en: "On-time",                    zh: "按时率",                 ar: "في الوقت" },
  "report.export":     { en: "Export CSV",                 zh: "导出 CSV",               ar: "تصدير CSV" },
  "report.empty":      { en: "No assigned tasks in this period",  zh: "此周期内没有分配的任务", ar: "لا مهام مُسندة في هذه الفترة" },
  "report.emptyHint":  { en: "Assign a task from the To-do list to see it reported here.",  zh: "从待办列表分配任务后将在此显示。", ar: "أسند مهمة من قائمة المهام لتظهر هنا." },
  "report.dueCol":     { en: "Due",                        zh: "截止",                   ar: "الاستحقاق" },
  "report.doneCol":    { en: "Done",                       zh: "完成于",                 ar: "أُنجزت" },
  "report.taskCol":    { en: "Task",                       zh: "任务",                   ar: "المهمة" },
  "report.forCol":     { en: "For",                        zh: "分配给",                 ar: "لـ" },
  /* Super-admin audience lens */
  "sa.viewOwn": { en: "My view",   zh: "我的视图",   ar: "عرضي" },
  "sa.viewAll": { en: "All users", zh: "所有用户",   ar: "كل المستخدمين" },

  /* My Work strip */
  "mywork.tasks":    { en: "My project tasks",          zh: "我的项目任务",       ar: "مهام مشاريعي" },
  "mywork.schedule": { en: "My schedule — next 7 days", zh: "我的排班——未来7天",  ar: "جدولي — الأيام السبعة القادمة" },
};
