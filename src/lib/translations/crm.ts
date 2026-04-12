import type { Translations } from "@/lib/i18n";

export const crmT: Translations = {
  /* ── Page chrome ── */
  "title":         { en: "CRM",            zh: "客户管理",         ar: "إدارة العملاء" },
  "subtitle":      { en: "Pipeline of opportunities and deals", zh: "商机与交易管道", ar: "خط أنابيب الفرص والصفقات" },

  /* ── Top sub-nav ── */
  "nav.pipeline":      { en: "Pipeline",       zh: "管道",         ar: "خط الأنابيب" },
  "nav.reporting":     { en: "Reporting",      zh: "报告",         ar: "التقارير" },
  "nav.configuration": { en: "Configuration",  zh: "配置",         ar: "الإعدادات" },

  /* ── View switcher ── */
  "view.pipeline": { en: "Kanban",         zh: "看板",            ar: "كانبان" },
  "view.list":     { en: "List",           zh: "列表",            ar: "قائمة" },
  "view.calendar": { en: "Calendar",       zh: "日历",            ar: "التقويم" },
  "view.pivot":    { en: "Pivot",          zh: "数据透视",         ar: "محوري" },
  "view.graph":    { en: "Graph",          zh: "图表",            ar: "رسم بياني" },
  "view.map":      { en: "Map",            zh: "地图",            ar: "خريطة" },
  "view.activity": { en: "Activity",       zh: "活动",            ar: "النشاط" },

  /* ── Toolbar ── */
  "search":        { en: "Search opportunities...", zh: "搜索商机...", ar: "بحث الفرص..." },
  "newOpp":        { en: "New",            zh: "新建",            ar: "جديد" },
  "newOppLong":    { en: "New Opportunity", zh: "新建商机",         ar: "فرصة جديدة" },
  "generateLeads": { en: "Generate Leads", zh: "生成潜在客户",     ar: "توليد العملاء المحتملين" },
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

  /* ── Quick add (inline) ── */
  "quick.add":            { en: "+ Add",            zh: "+ 添加",     ar: "+ إضافة" },
  "quick.titlePh":        { en: "Opportunity title", zh: "商机标题",   ar: "عنوان الفرصة" },
  "quick.companyPh":      { en: "Company (optional)", zh: "公司（可选）", ar: "الشركة (اختياري)" },
  "quick.revenuePh":      { en: "Expected revenue", zh: "预期收入",   ar: "الإيرادات المتوقعة" },
  "quick.add.btn":        { en: "Add",              zh: "添加",       ar: "إضافة" },

  /* ── Stage menu ── */
  "stage.menu.fold":      { en: "Fold",             zh: "折叠",       ar: "طي" },
  "stage.menu.unfold":    { en: "Unfold",           zh: "展开",       ar: "إلغاء الطي" },
  "stage.menu.edit":      { en: "Edit",             zh: "编辑",       ar: "تعديل" },
  "stage.menu.delete":    { en: "Delete",           zh: "删除",       ar: "حذف" },
  "stage.menu.add":       { en: "Add stage",        zh: "添加阶段",    ar: "إضافة مرحلة" },
  "stage.edit.title":     { en: "Stage",            zh: "阶段",       ar: "مرحلة" },
  "stage.edit.name":      { en: "Stage name",       zh: "阶段名称",    ar: "اسم المرحلة" },
  "stage.edit.sequence":  { en: "Sequence",         zh: "顺序",       ar: "التسلسل" },
  "stage.edit.isWon":     { en: "Marks deal as won", zh: "标记为赢得", ar: "وضع علامة فاز" },
  "stage.edit.fold":      { en: "Folded by default", zh: "默认折叠",   ar: "مطوي افتراضيًا" },
  "stage.edit.save":      { en: "Save stage",       zh: "保存阶段",    ar: "حفظ المرحلة" },
  "stage.edit.delete":    { en: "Delete stage",     zh: "删除阶段",    ar: "حذف المرحلة" },
  "stage.edit.deleteConfirm": { en: "Delete this stage? Opportunities will be moved to the first stage.", zh: "删除此阶段？商机将移动到第一阶段。", ar: "حذف هذه المرحلة؟ سيتم نقل الفرص إلى المرحلة الأولى." },

  /* ── Generate leads wizard ── */
  "gen.title":            { en: "Generate Leads",   zh: "生成潜在客户", ar: "توليد العملاء المحتملين" },
  "gen.subtitle":         { en: "Seed the pipeline with sample opportunities for testing.", zh: "用样本商机填充管道以进行测试。", ar: "املأ خط الأنابيب بفرص نموذجية للاختبار." },
  "gen.count":            { en: "How many?",        zh: "多少个？",    ar: "كم العدد؟" },
  "gen.stage":            { en: "Drop in stage",    zh: "放入阶段",    ar: "إسقاط في المرحلة" },
  "gen.source":           { en: "Source label",     zh: "来源标签",    ar: "تسمية المصدر" },
  "gen.create":           { en: "Generate",         zh: "生成",       ar: "توليد" },
  "gen.success":          { en: "Created sample leads", zh: "已创建样本潜在客户", ar: "تم إنشاء عملاء محتملين نموذجيين" },

  /* ── Calendar view ── */
  "cal.today":            { en: "Today",            zh: "今天",       ar: "اليوم" },
  "cal.prev":             { en: "Previous",         zh: "上一个",      ar: "السابق" },
  "cal.next":             { en: "Next",             zh: "下一个",      ar: "التالي" },
  "cal.empty":            { en: "No deals expected to close this month", zh: "本月没有预期成交的交易", ar: "لا توجد صفقات متوقع إغلاقها هذا الشهر" },

  /* ── Pivot / Graph view ── */
  "pivot.byStage":        { en: "By stage",         zh: "按阶段",      ar: "حسب المرحلة" },
  "pivot.byOwner":        { en: "By salesperson",   zh: "按销售员",    ar: "حسب البائع" },
  "pivot.byMonth":        { en: "By close month",   zh: "按成交月份",  ar: "حسب شهر الإغلاق" },
  "pivot.deals":          { en: "Deals",            zh: "交易",       ar: "الصفقات" },
  "pivot.revenue":        { en: "Revenue",          zh: "收入",       ar: "الإيرادات" },
  "pivot.weighted":       { en: "Weighted",         zh: "加权",       ar: "مرجح" },
  "pivot.average":        { en: "Avg deal",         zh: "平均交易",    ar: "متوسط الصفقة" },
  "pivot.total":          { en: "Total",            zh: "总计",       ar: "الإجمالي" },

  /* ── Map view ── */
  "map.title":            { en: "Geographic distribution", zh: "地理分布", ar: "التوزيع الجغرافي" },
  "map.empty":            { en: "No country data on opportunities yet", zh: "商机暂无国家/地区数据", ar: "لا توجد بيانات بلد على الفرص بعد" },
  "map.unknown":          { en: "Unknown country",  zh: "未知国家",    ar: "بلد غير معروف" },
  "map.deals":            { en: "deals",            zh: "交易",       ar: "صفقات" },

  /* ── Activity view ── */
  "act.feed.today":       { en: "Today",            zh: "今天",       ar: "اليوم" },
  "act.feed.tomorrow":    { en: "Tomorrow",         zh: "明天",       ar: "غدًا" },
  "act.feed.thisWeek":    { en: "This week",        zh: "本周",       ar: "هذا الأسبوع" },
  "act.feed.later":       { en: "Later",            zh: "稍后",       ar: "لاحقًا" },
  "act.feed.overdue":     { en: "Overdue",          zh: "逾期",       ar: "متأخر" },
  "act.feed.empty":       { en: "Inbox zero — no scheduled activities", zh: "收件箱已清空 — 没有计划的活动", ar: "لا توجد أنشطة مجدولة" },

  /* ── Reporting page ── */
  "rep.title":            { en: "Reporting",        zh: "报告",       ar: "التقارير" },
  "rep.subtitle":         { en: "Pipeline analytics and forecast", zh: "管道分析和预测", ar: "تحليلات ومتوقعات خط الأنابيب" },
  "rep.kpi.opps":         { en: "Open opportunities", zh: "开放商机",   ar: "الفرص المفتوحة" },
  "rep.kpi.value":        { en: "Pipeline value",   zh: "管道价值",    ar: "قيمة خط الأنابيب" },
  "rep.kpi.weighted":     { en: "Weighted forecast", zh: "加权预测",   ar: "التنبؤ المرجح" },
  "rep.kpi.avg":          { en: "Average deal",     zh: "平均交易",    ar: "متوسط الصفقة" },
  "rep.kpi.winrate":      { en: "Win rate",         zh: "赢率",       ar: "معدل الفوز" },
  "rep.kpi.cycle":        { en: "Avg sales cycle",  zh: "平均销售周期", ar: "متوسط دورة المبيعات" },
  "rep.kpi.days":         { en: "days",             zh: "天",         ar: "أيام" },
  "rep.byStage":          { en: "Pipeline by stage", zh: "按阶段管道", ar: "خط الأنابيب حسب المرحلة" },
  "rep.bySource":         { en: "Pipeline by source", zh: "按来源管道", ar: "خط الأنابيب حسب المصدر" },
  "rep.byOwner":          { en: "Top salespeople",  zh: "顶级销售员",  ar: "أفضل البائعين" },

  /* ── Configuration page ── */
  "cfg.title":            { en: "Configuration",    zh: "配置",       ar: "الإعدادات" },
  "cfg.subtitle":         { en: "Stages, sources and pipeline settings", zh: "阶段、来源和管道设置", ar: "المراحل والمصادر وإعدادات خط الأنابيب" },
  "cfg.stages":           { en: "Pipeline stages",  zh: "管道阶段",    ar: "مراحل خط الأنابيب" },
  "cfg.stagesHint":       { en: "Drag to reorder. Click to edit. Folded stages still appear on the kanban as a thin column.", zh: "拖动以重新排序。单击以编辑。", ar: "اسحب لإعادة الترتيب. انقر للتعديل." },
  "cfg.addStage":         { en: "Add stage",        zh: "添加阶段",    ar: "إضافة مرحلة" },
  "cfg.lostReasons":      { en: "Lost reasons",     zh: "失败原因",    ar: "أسباب الخسارة" },
  "cfg.lostReasonsHint":  { en: "Suggestions shown in the lost-reason picker.", zh: "在失败原因选择器中显示的建议。", ar: "اقتراحات معروضة في منتقي سبب الخسارة." },
};
