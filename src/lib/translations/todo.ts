import type { Translations } from "@/lib/i18n";

/* Todo app — list + filters + task modal. */

export const todoT: Translations = {
  "app.title":         { en: "To-do",                     zh: "待办",                   ar: "المهام" },
  "add":               { en: "Add Task",                  zh: "添加任务",               ar: "إضافة مهمة" },
  "search":            { en: "Search tasks…",             zh: "搜索任务…",              ar: "ابحث في المهام…" },

  /* Filters */
  "filters":           { en: "Filters",                   zh: "筛选",                   ar: "المرشحات" },
  "filters.allAssignees": { en: "All Assignees",          zh: "所有受托人",             ar: "كل المكلفين" },
  "filters.allDepts":  { en: "All Departments",           zh: "所有部门",               ar: "كل الأقسام" },
  "filters.allLabels": { en: "All Labels",                zh: "所有标签",               ar: "كل الوسوم" },
  "filters.fromDate":  { en: "From date",                 zh: "起始日期",               ar: "من تاريخ" },
  "filters.toDate":    { en: "To date",                   zh: "结束日期",               ar: "إلى تاريخ" },
  "filters.searchEmployees": { en: "Search employees…",   zh: "搜索员工…",              ar: "ابحث عن الموظفين…" },

  /* Sections / buckets */
  "section.overdue":   { en: "Overdue",                   zh: "逾期",                   ar: "متأخرة" },
  "section.today":     { en: "Today",                     zh: "今天",                   ar: "اليوم" },
  "section.upcoming":  { en: "Upcoming",                  zh: "即将到来",               ar: "قادمة" },
  "section.noDate":    { en: "No Due Date",               zh: "无截止日期",             ar: "بدون تاريخ" },
  "section.completed": { en: "Completed",                 zh: "已完成",                 ar: "مكتملة" },

  /* KPI strip */
  "kpi.completed":     { en: "Completed",                 zh: "已完成",                 ar: "مكتملة" },
  "kpi.overdue":       { en: "Overdue",                   zh: "逾期",                   ar: "متأخرة" },
  "kpi.topPerformers": { en: "Top Performers",            zh: "优秀执行者",             ar: "الأعلى أداءً" },

  /* Relative dates — the row's due-date chip and a series' "this run". */
  "date.today":        { en: "Today",                     zh: "今天",                   ar: "اليوم" },
  "date.tomorrow":     { en: "Tomorrow",                  zh: "明天",                   ar: "غدًا" },
  "date.yesterday":    { en: "Yesterday",                 zh: "昨天",                   ar: "أمس" },

  /* Task modal */
  "modal.add":         { en: "Add Task",                  zh: "添加任务",               ar: "إضافة مهمة" },
  "modal.edit":        { en: "Edit Task",                 zh: "编辑任务",               ar: "تعديل المهمة" },
  "modal.delete":      { en: "Delete Task",               zh: "删除任务",               ar: "حذف المهمة" },
  "modal.save":        { en: "Save",                      zh: "保存",                   ar: "حفظ" },
  "modal.cancel":      { en: "Cancel",                    zh: "取消",                   ar: "إلغاء" },
  "modal.saving":      { en: "Saving…",                   zh: "保存中…",                ar: "جارٍ الحفظ…" },

  /* Task fields */
  "f.title":           { en: "Title",                     zh: "标题",                   ar: "العنوان" },
  "f.title.placeholder":{ en: "What needs to be done?",   zh: "要做什么？",             ar: "ما الذي يجب فعله؟" },
  "f.description":     { en: "Description",               zh: "描述",                   ar: "الوصف" },
  "f.description.placeholder": { en: "Add details…",      zh: "补充详情…",              ar: "أضف التفاصيل…" },
  "f.priority":        { en: "Priority",                  zh: "优先级",                 ar: "الأولوية" },
  "f.dueDate":         { en: "Due Date",                  zh: "截止日期",               ar: "تاريخ الاستحقاق" },
  "f.assignTo":        { en: "Assign To",                 zh: "分配给",                 ar: "تكليف" },
  "f.label":           { en: "Label",                     zh: "标签",                   ar: "الوسم" },
  "f.label.placeholder":{ en: "Label name",               zh: "标签名称",               ar: "اسم الوسم" },
  "f.project":         { en: "Related project",           zh: "关联项目",               ar: "المشروع المرتبط" },
  "f.noProject":       { en: "None",                      zh: "无",                     ar: "بدون" },

  /* Priority — the three values koleex_todos.priority allows. */
  "p.low":             { en: "Low",                       zh: "低",                     ar: "منخفضة" },
  "p.medium":          { en: "Medium",                    zh: "中",                     ar: "متوسطة" },
  "p.high":            { en: "High",                      zh: "高",                     ar: "مرتفعة" },

  /* Notes */
  "notes.placeholder": { en: "Write a note…",             zh: "写一条笔记…",            ar: "اكتب ملاحظة…" },

  /* Empty states */
  "empty.title":       { en: "No tasks yet",              zh: "暂无任务",               ar: "لا توجد مهام بعد" },

  /* App chrome + filter pills */
  "pill.assignedToMe": { en: "Assigned to me",             zh: "分配给我",               ar: "مُسندة إليّ" },
  "src.all":           { en: "All",                        zh: "全部",                   ar: "الكل" },
  "src.mine":          { en: "My tasks",                   zh: "我的任务",               ar: "مهامي" },
  "row.assignedBy":    { en: "assigned by",                zh: "分配自",                 ar: "أسندها" },
  "row.onTime":        { en: "On time",                    zh: "按时",                   ar: "في الوقت" },
  "row.late":          { en: "Late",                       zh: "逾期完成",               ar: "متأخر" },
  "pill.all":          { en: "All",                        zh: "全部",                   ar: "الكل" },
  "pill.active":       { en: "Active",                     zh: "进行中",                 ar: "نشِطة" },
  "pill.done":         { en: "Done",                       zh: "已完成",                 ar: "منجزة" },

  /* Recurrence (Phase C) */
  "rec.once":          { en: "Once",                       zh: "一次",                   ar: "مرة واحدة" },
  "rec.daily":         { en: "Daily",                      zh: "每日",                   ar: "يومي" },
  "rec.weekly":        { en: "Weekly",                     zh: "每周",                   ar: "أسبوعي" },
  "rec.monthly":       { en: "Monthly",                    zh: "每月",                   ar: "شهري" },
  "f.recurrence":      { en: "Repeat",                     zh: "重复",                   ar: "التكرار" },
  "f.recurrenceUntil": { en: "Until",                      zh: "截止",                   ar: "حتى" },
  /* Which run of a repeating task this row is — the thing that tells two
     occurrences of the same series apart. */
  "f.occurrence":      { en: "This run",                   zh: "本次",                   ar: "هذه المرة" },
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
  "approval.confirm":   { en: "Confirm",                    zh: "确认",                   ar: "تأكيد" },
  "approval.reopen":    { en: "Reopen",                     zh: "重新打开",               ar: "إعادة فتح" },
  "approval.rejectTitle": { en: "Send back for rework",     zh: "退回返工",               ar: "إعادة للمراجعة" },
  "approval.rejectHint": { en: "Tell the assignee why this isn't approved yet. They'll see it on the task and get a notification.", zh: "告诉执行人为什么尚未批准。他们会在任务上看到原因并收到通知。", ar: "أخبر المكلّف لماذا لم تتم الموافقة بعد. سيظهر السبب على المهمة وسيصله إشعار." },
  "approval.rejectPlaceholder": { en: "Reason — e.g. the report attachment is missing…", zh: "原因——例如：缺少报告附件…", ar: "السبب — مثال: مرفق التقرير ناقص…" },
  "approval.rejectSubmit": { en: "Send back",               zh: "退回",                   ar: "إعادة" },
  "approval.returned":  { en: "Returned",                   zh: "已退回",                 ar: "أُعيدت" },
  /* Only shown on returns that predate the mandatory-reason rule. */
  "approval.noReason":  { en: "no reason was recorded",     zh: "未记录原因",             ar: "لم يُسجَّل سبب" },

  /* Status stages */
  "st.todo":           { en: "To do",                      zh: "待办",                   ar: "قيد الانتظار" },
  "st.in_progress":    { en: "In progress",                zh: "进行中",                 ar: "قيد التنفيذ" },
  "st.blocked":        { en: "Blocked",                    zh: "受阻",                   ar: "متوقفة" },
  "st.done":           { en: "Done",                       zh: "已完成",                 ar: "منجزة" },

  /* KPI cards */
  "kpi.completedWord": { en: "completed",                  zh: "个已完成",               ar: "منجزة" },

  /* Task fields (added) */
  "f.status":          { en: "Status",                     zh: "状态",                   ar: "الحالة" },
  "f.startDate":       { en: "Start Date",                 zh: "开始日期",               ar: "تاريخ البدء" },
  "f.reminder":        { en: "Reminder",                   zh: "提醒",                   ar: "تذكير" },
  "f.selectDate":      { en: "Select date",                zh: "选择日期",               ar: "اختر تاريخًا" },

  /* Filters (added) */
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
  "src.crm":           { en: "CRM",                        zh: "CRM",                    ar: "CRM" },
  "src.calendar":      { en: "Calendar",                   zh: "日历",                   ar: "التقويم" },
  "src.report":        { en: "From a report",              zh: "来自报告",               ar: "من تقرير" },

  /* Common words */
  "common.optional":   { en: "(optional)",                 zh: "（可选）",               ar: "(اختياري)" },
  "common.add":        { en: "Add",                        zh: "添加",                   ar: "إضافة" },
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

  /* Manager report */
  "report.link":       { en: "Reports",                    zh: "报告",                   ar: "التقارير" },
  "report.title":      { en: "Assignment Report",          zh: "任务分配报告",           ar: "تقرير المهام المُسندة" },
  "report.subtitle":   { en: "What you assigned and how it's going",  zh: "你分配的任务及其进展", ar: "ما أسندته وحالة تنفيذه" },
  "report.everyone":   { en: "Everyone",                   zh: "所有人",                 ar: "الجميع" },
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
  "row.selectTask": { en: "Select task", zh: "选择任务", ar: "تحديد المهمة" },

  /* My Work strip */
  "mywork.tasks":    { en: "My project tasks",          zh: "我的项目任务",       ar: "مهام مشاريعي" },
  "mywork.schedule": { en: "My schedule — next 7 days", zh: "我的排班——未来7天",  ar: "جدولي — الأيام السبعة القادمة" },

  /* Quick add */
  "quick.placeholder": { en: "Add a task — try “Call supplier tomorrow 3pm !high @Sara”", zh: "添加任务——试试“明天下午3点 给供应商打电话 !高 @Sara”", ar: "أضف مهمة — جرّب «الاتصال بالمورد غدا 3 مساء !high @Sara»" },
  "quick.label":       { en: "Quick add a task",            zh: "快速添加任务",           ar: "إضافة مهمة سريعة" },
  "quick.understood":  { en: "Understood:",                 zh: "已识别：",               ar: "تم فهم:" },
  "quick.keepText":    { en: "Keep as text",                zh: "保留为文字",             ar: "إبقاؤها كنص" },
  "shortcuts.hint":    { en: "Shortcuts: N add a task · / search · ⌘/Ctrl+Enter save the form · Esc close", zh: "快捷键：N 添加任务 · / 搜索 · ⌘/Ctrl+Enter 保存表单 · Esc 关闭", ar: "اختصارات: N إضافة مهمة · / بحث · ⌘/Ctrl+Enter حفظ النموذج · Esc إغلاق" },

  /* Filters */
  "filters.source":    { en: "Whose tasks",                 zh: "任务来源",               ar: "مصدر المهام" },
  "filters.assignee":  { en: "Assignee",                    zh: "受托人",                 ar: "المكلَّف" },
  "filters.department":{ en: "Department",                  zh: "部门",                   ar: "القسم" },
  "filters.range":     { en: "Date range",                  zh: "日期范围",               ar: "نطاق التاريخ" },
  "filters.rangeHint": { en: "Matches the due date or the date the task was created.", zh: "匹配截止日期或任务创建日期。", ar: "يطابق تاريخ الاستحقاق أو تاريخ إنشاء المهمة." },
  "filters.show":      { en: "Show tasks",                  zh: "显示任务",               ar: "عرض المهام" },
  "sa.audience":       { en: "Whose list",                  zh: "查看谁的列表",           ar: "قائمة من" },
  "sa.viewing":        { en: "Viewing:",                    zh: "正在查看：",             ar: "عرض:" },

  /* Row / panel */
  "row.markDone":      { en: "Mark as done",                zh: "标记为完成",             ar: "تحديد كمنجزة" },
  "row.markUndone":    { en: "Mark as not done",            zh: "标记为未完成",           ar: "تحديد كغير منجزة" },
  "row.withdraw":      { en: "Withdraw the submission",     zh: "撤回提交",               ar: "سحب الإرسال" },
  "notes.send":        { en: "Send note",                   zh: "发送笔记",               ar: "إرسال الملاحظة" },
  "notes.delete":      { en: "Delete note",                 zh: "删除笔记",               ar: "حذف الملاحظة" },
  "f.label.new":       { en: "New label",                   zh: "新建标签",               ar: "وسم جديد" },
  "assign.onlyMe":     { en: "Only me",                     zh: "仅我自己",               ar: "أنا فقط" },
  "modal.saveHint":    { en: "⌘/Ctrl+Enter to save",        zh: "⌘/Ctrl+Enter 保存",      ar: "⌘/Ctrl+Enter للحفظ" },
  "board.moveTo":      { en: "Move to",                     zh: "移到",                   ar: "نقل إلى" },
  "board.empty":       { en: "Nothing here",                zh: "暂无",                   ar: "لا شيء هنا" },
  "view.label":        { en: "View",                        zh: "视图",                   ar: "العرض" },
  "bulk.selectAll":    { en: "Select all",                  zh: "全选",                   ar: "تحديد الكل" },
  "report.period":     { en: "Period",                      zh: "周期",                   ar: "الفترة" },

  /* Toasts (with Undo) */
  "toast.completed":   { en: "Task completed",              zh: "任务已完成",             ar: "تم إنجاز المهمة" },
  "toast.submitted":   { en: "Sent to the assigner for approval", zh: "已提交给分配人审批", ar: "أُرسلت إلى المُسنِد للموافقة" },
  "toast.deleted":     { en: "Task deleted",                zh: "任务已删除",             ar: "تم حذف المهمة" },
  "toast.deletedMany": { en: "tasks deleted",               zh: "个任务已删除",           ar: "مهام حُذفت" },
  "toast.skipped":     { en: "skipped — only the assigner can change them", zh: "个已跳过——仅分配人可以更改", ar: "تم تخطيها — يمكن للمُسنِد فقط تغييرها" },
  "toast.cannotDelete":{ en: "Only the person who assigned a task can delete it.", zh: "只有分配任务的人才能删除它。", ar: "يمكن فقط لمن أسند المهمة حذفها." },
  "toast.undo":        { en: "Undo",                        zh: "撤销",                   ar: "تراجع" },
  "toast.notFound":    { en: "That task no longer exists, or it isn't shared with you.", zh: "该任务已不存在，或未与你共享。", ar: "لم تعد هذه المهمة موجودة، أو لم تتم مشاركتها معك." },

  /* Empty / error states */
  "empty.hint":        { en: "Type a task above and press Enter — dates like “tomorrow” or “friday” are understood.", zh: "在上方输入任务并按回车——可识别“明天”“周五”等日期。", ar: "اكتب مهمة في الأعلى واضغط Enter — تُفهم تواريخ مثل «غدا»." },
  "empty.allDone":     { en: "All done — nothing open",     zh: "全部完成——没有待办",     ar: "أُنجز كل شيء — لا مهام مفتوحة" },
  "empty.noFilter":    { en: "No tasks match these filters", zh: "没有符合筛选条件的任务", ar: "لا توجد مهام تطابق هذه المرشحات" },
  "empty.noApprovals": { en: "Nothing is waiting for your approval", zh: "没有等待你审批的任务", ar: "لا شيء بانتظار موافقتك" },
  "empty.clearSearch": { en: "Clear search",                zh: "清除搜索",               ar: "مسح البحث" },
  "err.saveFailed":    { en: "Couldn't save that change — it has been undone.", zh: "无法保存该更改——已撤销。", ar: "تعذّر حفظ هذا التغيير — تم التراجع عنه." },
  "err.loadFailed":    { en: "Couldn't load your tasks.",   zh: "无法加载你的任务。",     ar: "تعذّر تحميل مهامك." },
  "err.loadStale":     { en: "Couldn't refresh — showing the last saved list.", zh: "无法刷新——显示上次保存的列表。", ar: "تعذّر التحديث — يتم عرض آخر قائمة محفوظة." },
  "err.conflict":      { en: "Someone changed this task at the same moment — showing the latest.", zh: "有人同时修改了此任务——已显示最新状态。", ar: "قام شخص آخر بتعديل هذه المهمة في اللحظة نفسها — يتم عرض الأحدث." },
  "err.forbidden":     { en: "Only the person who assigned this task can change that.", zh: "只有分配此任务的人才能更改。", ar: "يمكن فقط لمن أسند هذه المهمة تغيير ذلك." },
  "err.assignAllAdmin":{ en: "Only admins can assign a task to everyone.", zh: "只有管理员可以将任务分配给所有人。", ar: "يمكن للمسؤولين فقط إسناد مهمة إلى الجميع." },
  "err.offline":       { en: "No connection — the change was not saved.", zh: "没有网络连接——更改未保存。", ar: "لا يوجد اتصال — لم يُحفظ التغيير." },
  "err.labelExists":   { en: "A label with that name already exists.", zh: "已存在同名标签。",     ar: "يوجد وسم بهذا الاسم بالفعل." },
  "err.labelInvalid":  { en: "That label can't be saved — check the name.", zh: "无法保存该标签——请检查名称。", ar: "تعذّر حفظ هذا الوسم — تحقّق من الاسم." },
  "err.truncated":     { en: "Showing your newest tasks only — narrow the list with search or filters to find older ones.", zh: "仅显示最新的任务——使用搜索或筛选查找更早的任务。", ar: "يتم عرض أحدث مهامك فقط — استخدم البحث أو المرشحات للعثور على الأقدم." },
  "assign.everyone":   { en: "Everyone",                    zh: "所有人",                 ar: "الجميع" },
  "row.private":       { en: "Private",                     zh: "私密",                   ar: "خاصة" },
  "row.privateMine":   { en: "Private — only you and the people it is assigned to can see it.", zh: "私密——只有你和被分配的人可以看到。", ar: "خاصة — لا يراها إلا أنت ومن أُسندت إليهم." },
  "row.privateShared": { en: "Private — shared with you because it is assigned to you. Only its creator can edit it.", zh: "私密——因分配给你而与你共享。只有创建者可以编辑。", ar: "خاصة — تمت مشاركتها معك لأنها مُسندة إليك. لا يعدّلها إلا منشئها." },
  "done.loadMore":     { en: "Load older completed tasks",  zh: "加载更早的已完成任务",   ar: "تحميل المهام المنجزة الأقدم" },
  "done.loadFailed":   { en: "Couldn't load completed tasks.", zh: "无法加载已完成的任务。", ar: "تعذّر تحميل المهام المنجزة." },
  "done.searchHint":   { en: "Older completed tasks are searched once they are loaded — open Completed and load more to include them.", zh: "更早的已完成任务需先加载才会被搜索——打开“已完成”并加载更多。", ar: "يُبحث في المهام المنجزة الأقدم بعد تحميلها — افتح «المكتملة» وحمّل المزيد لتضمينها." },
  "report.partial":    { en: "Very long history — the oldest completed tasks are not included. Pick a shorter period for exact numbers.", zh: "历史记录过长——最早的已完成任务未包含在内。请选择较短的周期以获得准确数字。", ar: "السجل طويل جدًا — لم تُضمَّن أقدم المهام المنجزة. اختر فترة أقصر للحصول على أرقام دقيقة." },
  /* Restored with the original list design */
  "kpi.active":        { en: "Active",                    zh: "活跃",                   ar: "نشِطة" },
  "app.subtitle":      { en: "Task management",            zh: "任务管理",               ar: "إدارة المهام" },
  "cadence.all":       { en: "All",                        zh: "全部",                   ar: "الكل" },
  "cadence.day":       { en: "Today",                      zh: "今天",                   ar: "اليوم" },
  "cadence.week":      { en: "This week",                  zh: "本周",                   ar: "هذا الأسبوع" },
  "cadence.month":     { en: "This month",                 zh: "本月",                   ar: "هذا الشهر" },
  "approval.awaitingYou": { en: "Marked done — approve it?", zh: "已标记完成——是否批准？", ar: "تم وضع علامة كمنجز — هل توافق؟" },
  "kpi.totalTasks":    { en: "Total Tasks",                zh: "任务总数",               ar: "إجمالي المهام" },
  "kpi.highPriority":  { en: "High Priority",              zh: "高优先级",               ar: "أولوية عالية" },
  "kpi.doneThisWeek":  { en: "Done This Week",             zh: "本周完成",               ar: "أُنجزت هذا الأسبوع" },
  "kpi.completion":    { en: "Completion",                 zh: "完成率",                 ar: "نسبة الإنجاز" },
  "filters.allStatuses": { en: "All Statuses",             zh: "所有状态",               ar: "كل الحالات" },
  "report.back":       { en: "Back to To-do",               zh: "返回待办",               ar: "العودة إلى المهام" },
  "common.retry":      { en: "Retry",                       zh: "重试",                   ar: "إعادة المحاولة" },
  /* Task clarity — the row answers what / who / when / what next */
  "row.byAgo":         { en: "Assigned by {name} · {ago}", zh: "{name} 分配 · {ago}",   ar: "أسندها {name} · {ago}" },
  "row.forNames":      { en: "For {names}",                zh: "分配给 {names}",         ar: "لـ {names}" },
  "row.createdAgo":    { en: "Created {ago}",              zh: "创建于 {ago}",           ar: "أُنشئت {ago}" },
  "row.next":          { en: "Next:",                      zh: "下一步：",               ar: "التالي:" },
  "row.open":          { en: "Open task",                  zh: "打开任务",               ar: "فتح المهمة" },
  "due.today":         { en: "Due today",                  zh: "今天到期",               ar: "مستحقة اليوم" },
  "due.tomorrow":      { en: "Due tomorrow",               zh: "明天到期",               ar: "مستحقة غدًا" },
  "due.inDays":        { en: "Due in {n} days",            zh: "{n} 天后到期",           ar: "مستحقة خلال {n} أيام" },
  "due.overdue1":      { en: "1 day overdue",              zh: "逾期 1 天",              ar: "متأخرة يومًا واحدًا" },
  "due.overdueDays":   { en: "{n} days overdue",           zh: "逾期 {n} 天",            ar: "متأخرة {n} أيام" },

  /* Task detail sheet */
  "sheet.task":        { en: "Task",                       zh: "任务",                   ar: "مهمة" },
  "sheet.close":       { en: "Close",                      zh: "关闭",                   ar: "إغلاق" },
  "sheet.whatToDo":    { en: "What to do",                 zh: "要做什么",               ar: "المطلوب" },
  "sheet.whoWhen":     { en: "Who & when",                 zh: "人员与时间",             ar: "من ومتى" },
  "sheet.linked":      { en: "Files & links",              zh: "文件与关联",             ar: "الملفات والروابط" },
  "sheet.noDescription": { en: "No description was added — ask in the notes below if anything is unclear.", zh: "未添加描述——如有不清楚之处，请在下方笔记中提问。", ar: "لم يُضف وصف — اسأل في الملاحظات أدناه إن كان هناك ما هو غير واضح." },
  "sheet.assignedBy":  { en: "Assigned by",                zh: "分配人",                 ar: "أسندها" },
  "sheet.assignees":   { en: "Assigned to",                zh: "执行人",                 ar: "مُسندة إلى" },
  "sheet.created":     { en: "Created",                    zh: "创建时间",               ar: "أُنشئت" },
  "sheet.source":      { en: "Source",                     zh: "来源",                   ar: "المصدر" },
  "sheet.you":         { en: "You",                        zh: "你",                     ar: "أنت" },
  "sheet.start":       { en: "Start",                      zh: "开始",                   ar: "ابدأ" },
  "sheet.submit":      { en: "Submit for approval",        zh: "提交审批",               ar: "إرسال للموافقة" },
  "sheet.approve":     { en: "Approve",                    zh: "批准",                   ar: "موافقة" },
  "sheet.noNotes":     { en: "No notes yet — ask a question or post an update.", zh: "暂无笔记——可以提问或发布进展。", ar: "لا ملاحظات بعد — اطرح سؤالًا أو شارك تحديثًا." },
  "sheet.hintStart":   { en: "Assigned to you. Press Start when you begin, and Submit for approval when it is finished.", zh: "已分配给你。开始时点击“开始”，完成后点击“提交审批”。", ar: "مُسندة إليك. اضغط «ابدأ» عندما تبدأ، و«إرسال للموافقة» عند الانتهاء." },
  "sheet.hintSubmit":  { en: "When it is finished, submit it for approval — {name} will confirm.", zh: "完成后请提交审批——由 {name} 确认。", ar: "عند الانتهاء، أرسلها للموافقة — سيؤكدها {name}." },
  "sheet.hintBlocked": { en: "Marked as blocked — add a note saying what is needed to continue.", zh: "已标记为受阻——请在笔记中说明继续所需的条件。", ar: "مُعلَّمة كمتوقفة — أضف ملاحظة توضّح ما يلزم للمتابعة." },

  /* Task form sections */
  "sec.task":          { en: "Task",                       zh: "任务",                   ar: "المهمة" },
  "sec.planning":      { en: "Priority & dates",           zh: "优先级与日期",           ar: "الأولوية والتواريخ" },
  "sec.people":        { en: "People",                     zh: "人员",                   ar: "الأشخاص" },
  "sec.organize":      { en: "Organize",                   zh: "分类",                   ar: "التنظيم" },
  "sec.more":          { en: "More",                       zh: "更多",                   ar: "المزيد" },
  "f.dueTime":         { en: "Time",                       zh: "时间",                   ar: "الوقت" },
  "f.noTime":          { en: "No time",                    zh: "不设时间",               ar: "بدون وقت" },

  /* Quick add toolbar */
  "quick.assign":      { en: "Assign",                     zh: "分配",                   ar: "إسناد" },
  "quick.due":         { en: "Due",                        zh: "截止",                   ar: "الموعد" },
  "quick.details":     { en: "Add details",                zh: "添加详情",               ar: "أضف تفاصيل" },
  "quick.hideDetails": { en: "Hide details",               zh: "收起详情",               ar: "إخفاء التفاصيل" },
  "quick.detailsPlaceholder": { en: "Details — what exactly should be done, and how?", zh: "详情——具体要做什么、怎么做？", ar: "التفاصيل — ما المطلوب بالضبط وكيف؟" },
  "quick.fullForm":    { en: "Open full form",             zh: "打开完整表单",           ar: "فتح النموذج الكامل" },
  "quick.nextWeek":    { en: "Next week",                  zh: "下周",                   ar: "الأسبوع القادم" },
  "quick.people":      { en: "Assign to…",                 zh: "分配给…",                ar: "إسناد إلى…" },
  "quick.hint":        { en: "Enter adds · Shift+Enter details · @ assigns", zh: "回车添加 · Shift+回车 详情 · @ 分配", ar: "Enter للإضافة · Shift+Enter للتفاصيل · @ للإسناد" },
};
