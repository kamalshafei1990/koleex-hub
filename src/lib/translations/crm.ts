import type { Translations } from "@/lib/i18n";

export const crmT: Translations = {
  /* ── Page chrome ── */
  "title":         { en: "CRM",            zh: "客户管理",         ar: "إدارة العملاء" },
  "subtitle":      { en: "Pipeline of opportunities and deals", zh: "商机与交易管道", ar: "خط أنابيب الفرص والصفقات" },

  /* ── View switcher ── */
  "view.pipeline": { en: "Pipeline",       zh: "管道",            ar: "خط الأنابيب" },
  "view.list":     { en: "List",           zh: "列表",            ar: "قائمة" },

  /* ── Toolbar ── */
  "search":        { en: "Search opportunities...", zh: "搜索商机...", ar: "بحث الفرص..." },
  "newOpp":        { en: "New Opportunity", zh: "新建商机",         ar: "فرصة جديدة" },
  "myPipeline":    { en: "My pipeline",    zh: "我的管道",         ar: "خط أنابيبي" },
  "allPipeline":   { en: "All pipeline",   zh: "全部管道",         ar: "جميع خط الأنابيب" },
  "filters":       { en: "Filters",        zh: "筛选器",           ar: "عوامل التصفية" },

  /* ── Summary strip ── */
  "summary.active":     { en: "Active",          zh: "进行中",        ar: "نشط" },
  "summary.weighted":   { en: "Weighted forecast", zh: "加权预测",     ar: "التنبؤ المرجح" },
  "summary.pipeline":   { en: "Pipeline value",  zh: "管道价值",      ar: "قيمة خط الأنابيب" },
  "summary.wonMonth":   { en: "Won this month",  zh: "本月赢得",      ar: "تم الفوز بها هذا الشهر" },
  "summary.lostMonth":  { en: "Lost this month", zh: "本月失去",      ar: "خسرت هذا الشهر" },

  /* ── Opportunity card ── */
  "card.expectedRevenue": { en: "Expected revenue", zh: "预期收入", ar: "الإيرادات المتوقعة" },
  "card.probability":     { en: "Probability",      zh: "概率",     ar: "الاحتمالية" },
  "card.closeDate":       { en: "Expected close",   zh: "预期成交", ar: "الإغلاق المتوقع" },
  "card.owner":            { en: "Salesperson",     zh: "销售员",   ar: "البائع" },
  "card.activitiesOverdue": { en: "overdue",        zh: "逾期",     ar: "متأخر" },
  "card.noActivity":       { en: "No next activity", zh: "无下一活动", ar: "لا يوجد نشاط تالٍ" },
  "card.unassigned":       { en: "Unassigned",       zh: "未分配",   ar: "غير معين" },

  /* ── Form ── */
  "form.title":           { en: "Opportunity",     zh: "商机",      ar: "فرصة" },
  "form.name":            { en: "Opportunity title", zh: "商机标题",  ar: "عنوان الفرصة" },
  "form.namePh":          { en: "e.g. KX-9000 reorder for ACME", zh: "例如：ACME 的 KX-9000 重新订购", ar: "مثال: إعادة طلب KX-9000 لشركة ACME" },
  "form.contact":         { en: "Contact",          zh: "联系人",    ar: "جهة الاتصال" },
  "form.contactSearch":   { en: "Search contacts...", zh: "搜索联系人...", ar: "بحث جهات الاتصال..." },
  "form.company":         { en: "Company",          zh: "公司",      ar: "الشركة" },
  "form.companyPh":       { en: "ACME Corp.",       zh: "ACME 公司", ar: "شركة ACME" },
  "form.contactName":     { en: "Contact name",     zh: "联系人姓名", ar: "اسم جهة الاتصال" },
  "form.email":           { en: "Email",            zh: "邮箱",      ar: "البريد الإلكتروني" },
  "form.phone":           { en: "Phone",            zh: "电话",      ar: "الهاتف" },
  "form.expectedRevenue": { en: "Expected revenue", zh: "预期收入",  ar: "الإيرادات المتوقعة" },
  "form.probability":     { en: "Probability (%)",  zh: "概率 (%)",  ar: "الاحتمالية (%)" },
  "form.closeDate":       { en: "Expected close date", zh: "预期成交日期", ar: "تاريخ الإغلاق المتوقع" },
  "form.priority":        { en: "Priority",         zh: "优先级",    ar: "الأولوية" },
  "form.source":          { en: "Source",           zh: "来源",      ar: "المصدر" },
  "form.sourcePh":        { en: "Website, Referral, ...", zh: "网站、推荐...", ar: "موقع ويب، إحالة..." },
  "form.tags":            { en: "Tags",             zh: "标签",      ar: "العلامات" },
  "form.tagsPh":          { en: "Comma separated",  zh: "逗号分隔",  ar: "مفصولة بفواصل" },
  "form.stage":           { en: "Stage",            zh: "阶段",      ar: "المرحلة" },
  "form.owner":           { en: "Salesperson",      zh: "销售员",    ar: "البائع" },
  "form.description":     { en: "Internal notes",   zh: "内部备注",  ar: "ملاحظات داخلية" },
  "form.descriptionPh":   { en: "Anything the team should know about this deal...", zh: "团队需要了解的任何事项...", ar: "أي شيء يجب أن يعرفه الفريق عن هذه الصفقة..." },
  "form.create":          { en: "Create opportunity", zh: "创建商机", ar: "إنشاء فرصة" },
  "form.save":            { en: "Save changes",     zh: "保存修改",  ar: "حفظ التغييرات" },
  "form.cancel":          { en: "Cancel",           zh: "取消",      ar: "إلغاء" },
  "form.delete":          { en: "Delete",           zh: "删除",      ar: "حذف" },
  "form.archive":         { en: "Archive",          zh: "归档",      ar: "أرشفة" },
  "form.markWon":         { en: "Mark won",         zh: "标记为赢得", ar: "وضع علامة فاز" },
  "form.markLost":        { en: "Mark lost",        zh: "标记为失去", ar: "وضع علامة خسر" },
  "form.lostReason":      { en: "Lost reason",      zh: "失败原因",  ar: "سبب الخسارة" },
  "form.lostReasonPh":    { en: "Why was this deal lost?", zh: "为什么失去了这个交易？", ar: "لماذا خسرت هذه الصفقة؟" },

  /* ── Activities ── */
  "activities":           { en: "Activities",       zh: "活动",      ar: "الأنشطة" },
  "act.add":              { en: "Schedule activity", zh: "安排活动", ar: "جدولة نشاط" },
  "act.type.call":        { en: "Call",             zh: "电话",      ar: "اتصال" },
  "act.type.meeting":     { en: "Meeting",          zh: "会议",      ar: "اجتماع" },
  "act.type.task":        { en: "To-do",            zh: "待办",      ar: "مهمة" },
  "act.type.email":       { en: "Email",            zh: "邮件",      ar: "بريد إلكتروني" },
  "act.type.note":        { en: "Note",             zh: "笔记",      ar: "ملاحظة" },
  "act.titlePh":          { en: "What needs to happen?", zh: "需要做什么？", ar: "ما الذي يحتاج إلى الحدوث؟" },
  "act.dueDate":          { en: "Due date",         zh: "截止日期",  ar: "تاريخ الاستحقاق" },
  "act.markDone":         { en: "Mark done",        zh: "标记完成",  ar: "وضع علامة كمنجز" },
  "act.reopen":           { en: "Reopen",           zh: "重新打开",  ar: "إعادة فتح" },
  "act.empty":            { en: "No activities yet — schedule the next call, meeting, or to-do.", zh: "暂无活动 — 安排下一次通话、会议或待办事项。", ar: "لا توجد أنشطة بعد — جدولة المكالمة أو الاجتماع أو المهمة التالية." },

  /* ── Empty / loading ── */
  "empty.pipeline":       { en: "No opportunities in this stage yet", zh: "此阶段暂无商机", ar: "لا توجد فرص في هذه المرحلة بعد" },
  "empty.all":            { en: "Your pipeline is empty",  zh: "您的管道为空", ar: "خط أنابيبك فارغ" },
  "empty.allHint":        { en: "Create the first opportunity to get started", zh: "创建第一个商机开始", ar: "أنشئ الفرصة الأولى للبدء" },
  "loading":              { en: "Loading pipeline...", zh: "正在加载管道...", ar: "تحميل خط الأنابيب..." },

  /* ── Misc ── */
  "stage.won":            { en: "Won",     zh: "赢得",  ar: "فاز" },
  "stage.lost":           { en: "Lost",    zh: "失败",  ar: "خسر" },
  "currency":             { en: "$",       zh: "¥",     ar: "$" },
};
