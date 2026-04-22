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
};
