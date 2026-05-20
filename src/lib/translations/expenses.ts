import type { Translations } from "@/lib/i18n";

/* ===========================================================================
   Expenses app translations.

   Covers every operator-visible English string in the Expenses app:
   ExpensesApp (the main surface), ExpensesHeader, ExpensesTabs, and
   the editor / category-pick / supplier-pick sub-flows that live
   inside ExpensesApp.

   Daily entry tool — translations are tuned for junior finance staff
   (less jargon than the Finance Intelligence dictionary).
   ========================================================================== */

export const expensesT: Translations = {
  /* ── App-level ──────────────────────────────────────────────────── */
  "app.title":             { en: "Expenses",                          zh: "费用",                  ar: "المصروفات" },
  "app.subtitle":          { en: "Track operational spend — categories, payment status, approvals.",
                             zh: "跟踪运营支出 — 类别、付款状态、审批。",
                             ar: "تتبَّع الإنفاق التشغيلي — الفئات وحالة الدفع والموافقات." },

  /* Common */
  "common.cancel":         { en: "Cancel",        zh: "取消",         ar: "إلغاء" },
  "common.save":           { en: "Save",          zh: "保存",         ar: "حفظ" },
  "common.delete":         { en: "Delete",        zh: "删除",         ar: "حذف" },
  "common.edit":           { en: "Edit",          zh: "编辑",         ar: "تعديل" },
  "common.required":       { en: "Required",      zh: "必填",         ar: "مطلوب" },
  "common.optional":       { en: "Optional",      zh: "可选",         ar: "اختياري" },
  "common.untilLoaded":    { en: "—",             zh: "—",            ar: "—" },
  "common.loading":        { en: "Loading…",      zh: "加载中…",      ar: "جارٍ التحميل…" },

  /* Header */
  "header.addExpense":     { en: "+ Add Expense",                     zh: "+ 添加费用",            ar: "+ إضافة مصروف" },
  "header.exportCsv":      { en: "Export CSV",                        zh: "导出 CSV",              ar: "تصدير CSV" },
  "header.backHub":        { en: "Back to Hub",                       zh: "返回 Hub",              ar: "العودة إلى Hub" },
  "header.financeAnalytics":{ en: "Finance Analytics",                zh: "财务分析",               ar: "تحليلات المالية" },
  "header.analyticsTitle": { en: "Switch to the executive Expense Analytics view",
                             zh: "切换到费用分析的高管视图",
                             ar: "التبديل إلى عرض تحليلات المصروفات التنفيذي" },

  /* Tabs (payment status) */
  "tabs.all":              { en: "All",                               zh: "全部",                  ar: "الكل" },
  "tabs.unpaid":           { en: "Unpaid",                            zh: "未支付",                ar: "غير مدفوع" },
  "tabs.paid":             { en: "Paid",                              zh: "已支付",                ar: "مدفوع" },
  "tabs.overdue":          { en: "Overdue",                           zh: "逾期",                  ar: "متأخر" },

  /* Approval filter row */
  "approval.label":        { en: "Approval",                          zh: "审批",                  ar: "الموافقة" },
  "approval.any":          { en: "Any state",                         zh: "任意状态",               ar: "أي حالة" },
  "approval.needsReview":  { en: "Needs review",                      zh: "待审核",                ar: "بحاجة لمراجعة" },
  "approval.drafts":       { en: "Drafts",                            zh: "草稿",                  ar: "المسودات" },
  "approval.rejected":     { en: "Rejected",                          zh: "已驳回",                ar: "مرفوضة" },
  "approval.changesNeeded":{ en: "Changes needed",                    zh: "需要修改",               ar: "تحتاج تعديلات" },
  "approval.approved":     { en: "Approved",                          zh: "已批准",                ar: "معتمدة" },

  /* Status / approval badges (row badges) */
  "status.paid":           { en: "Paid",                              zh: "已支付",                ar: "مدفوع" },
  "status.unpaid":         { en: "Unpaid",                            zh: "未支付",                ar: "غير مدفوع" },
  "status.overdue":        { en: "Overdue",                           zh: "逾期",                  ar: "متأخر" },
  "status.draft":          { en: "Draft",                             zh: "草稿",                  ar: "مسودة" },
  "status.submitted":      { en: "Submitted",                         zh: "已提交",                ar: "مقدمة" },
  "status.under_review":   { en: "Under review",                      zh: "审核中",                ar: "قيد المراجعة" },
  "status.rejected":       { en: "Rejected",                          zh: "已驳回",                ar: "مرفوضة" },
  "status.changes_needed": { en: "Changes needed",                    zh: "需要修改",               ar: "تحتاج تعديلات" },
  "status.approved":       { en: "Approved",                          zh: "已批准",                ar: "معتمدة" },
  "status.partial":        { en: "Partially approved",                zh: "部分批准",               ar: "معتمدة جزئيًا" },
  "status.missing":        { en: "Missing",                           zh: "缺失",                  ar: "ناقص" },

  /* Top categories tile-grid */
  "categories.title":      { en: "Top categories",                    zh: "主要类别",               ar: "أهم الفئات" },
  "categories.tapHint":    { en: "Tap a tile to filter the list below.",
                             zh: "点击磁贴可筛选下方列表。",
                             ar: "اضغط على بلاطة لتصفية القائمة بالأسفل." },
  "categories.expenseOne": { en: "expense",                           zh: "笔费用",                ar: "مصروف" },
  "categories.expenseMany":{ en: "expenses",                          zh: "笔费用",                ar: "مصروفات" },
  "categories.other":      { en: "Other",                             zh: "其他",                  ar: "أخرى" },

  /* Search + list */
  "search.placeholder":    { en: "Search expenses…",                  zh: "搜索费用…",              ar: "ابحث في المصروفات…" },
  "list.empty.all":        { en: "No expenses yet",                  zh: "暂无费用",               ar: "لا توجد مصروفات بعد" },
  "list.empty.unpaid":     { en: "No unpaid expenses",                zh: "没有未支付的费用",        ar: "لا توجد مصروفات غير مدفوعة" },
  "list.empty.paid":       { en: "No paid expenses",                  zh: "没有已支付的费用",        ar: "لا توجد مصروفات مدفوعة" },
  "list.empty.overdue":    { en: "No overdue expenses",               zh: "没有逾期的费用",          ar: "لا توجد مصروفات متأخرة" },
  "list.empty.filtered":   { en: "No expenses match your filter",     zh: "没有符合筛选条件的费用",   ar: "لا توجد مصروفات تطابق فلترك" },
  "list.empty.hint":       { en: "Click + Add Expense to log your first one.",
                             zh: "点击「+ 添加费用」开始记录第一笔。",
                             ar: "اضغط «+ إضافة مصروف» لتسجيل أول واحد." },
  "list.loading":          { en: "Loading expenses…",                 zh: "正在加载费用…",           ar: "جارٍ تحميل المصروفات…" },
  "list.untitled":         { en: "Untitled expense",                  zh: "未命名费用",             ar: "مصروف بلا عنوان" },
  "list.openEvidence":     { en: "Open evidence drawer",              zh: "打开附件抽屉",           ar: "افتح درج الأدلة" },
  "list.openReview":       { en: "Open approval review drawer",       zh: "打开审批审核抽屉",       ar: "افتح درج مراجعة الموافقات" },
  "filter.clear":          { en: "Clear filter",                      zh: "清除筛选",               ar: "إلغاء الفلتر" },
  "filter.clearTitle":     { en: "Clear category filter",             zh: "清除类别筛选",           ar: "إلغاء فلتر الفئة" },
  "confirm.deleteTitle":   { en: 'Delete "{name}"?',                  zh: "删除「{name}」？",        ar: "حذف «{name}»؟" },
  "confirm.deleteFallback":{ en: "expense",                           zh: "费用",                   ar: "مصروف" },
  "evidence.title":        { en: "Expense",                           zh: "费用",                   ar: "مصروف" },
  "list.dueLabel":         { en: "Due",                               zh: "到期",                  ar: "الاستحقاق" },
  "list.linkedOrder":      { en: "Linked to order",                   zh: "关联订单",               ar: "مرتبط بالطلب" },
  "list.undo":             { en: "Undo",                              zh: "撤销",                  ar: "تراجع" },
  "list.deletedToast":     { en: "Expense deleted",                   zh: "已删除费用",             ar: "تم حذف المصروف" },
  "toast.deleted":         { en: 'Deleted "{name}"',                  zh: "已删除「{name}」",        ar: "تم حذف «{name}»" },
  "confirm.deleteDesc":    { en: "You'll have 5 seconds to undo. Receipts and approval history will be removed once the timer expires.",
                             zh: "您有 5 秒可撤销。计时结束后，相关凭证与审批记录将被删除。",
                             ar: "أمامك 5 ثوانٍ للتراجع. ستُحذف الإيصالات وسجل الموافقات عند انتهاء الوقت." },
  "confirm.delete":        { en: "Delete",                            zh: "删除",                   ar: "حذف" },
  "confirm.keep":          { en: "Keep",                              zh: "保留",                   ar: "احتفظ" },
  "badge.overdue":         { en: "Overdue",                           zh: "逾期",                   ar: "متأخر" },
  "row.editTitle":         { en: "Edit expense",                      zh: "编辑费用",               ar: "تعديل المصروف" },
  "row.moreActions":       { en: "More actions",                      zh: "更多操作",               ar: "إجراءات أخرى" },
  "row.openReview":        { en: "Open review",                       zh: "打开审核",               ar: "افتح المراجعة" },
  "row.openEvidence":      { en: "Open evidence",                     zh: "打开附件",               ar: "افتح الأدلة" },
  "row.deleteExpense":     { en: "Delete expense",                    zh: "删除费用",               ar: "حذف المصروف" },

  /* Editor drawer additional keys */
  "editor.titleAdd":         { en: "Add expense",                        zh: "添加费用",               ar: "إضافة مصروف" },
  "editor.subtitle":         { en: "Title, amount, and a category — done in 20 seconds. The rest is optional.",
                               zh: "标题、金额、类别 — 20 秒搞定。其余为可选项。",
                               ar: "العنوان والمبلغ والفئة — 20 ثانية وانتهيت. الباقي اختياري." },
  "editor.close":            { en: "Close",                              zh: "关闭",                   ar: "إغلاق" },
  "editor.section.basics":   { en: "Basics",                             zh: "基本信息",               ar: "الأساسيات" },
  "editor.section.basicsHint":{ en: "What it was and how much it cost.", zh: "费用名称及金额。",        ar: "ما هو وكم تكلفته." },
  "editor.section.category":     { en: "Category",                       zh: "类别",                   ar: "الفئة" },
  "editor.section.categoryHint": { en: "Pick a group on the left, then a specific sub-category.",
                                   zh: "先在左侧选择主类，然后选择具体的子类别。",
                                   ar: "اختر مجموعة على اليسار، ثم فئة فرعية محددة." },
  "editor.section.schedule": { en: "Schedule",                           zh: "时间",                  ar: "الجدولة" },
  "editor.section.scheduleHint":{ en: "When the cost was incurred and when it's due.",
                                  zh: "费用发生的日期和到期日期。",
                                  ar: "متى وقعت التكلفة ومتى تستحق." },
  "editor.section.notesHint":{ en: "Optional — one line of context if it'll help your future self.",
                               zh: "可选 — 一行上下文，方便日后查阅。",
                               ar: "اختياري — سطر واحد من السياق إن كان مفيدًا لاحقًا." },
  "editor.field.what":       { en: "What was this for?",                 zh: "用途说明",               ar: "لأي غرض كان؟" },
  "editor.field.whatPlaceholder":{ en: "e.g. Sea freight to Alexandria", zh: "例如：海运至亚历山大",     ar: "مثلاً: شحن بحري إلى الإسكندرية" },
  "editor.field.notesPlaceholder":{ en: "One-line context",              zh: "一行上下文",             ar: "سطر سياق" },
  "editor.noCategory":       { en: "No category selected",               zh: "尚未选择类别",            ar: "لم تُحدَّد فئة" },
  "editor.advanced.title":   { en: "Advanced options",                   zh: "高级选项",               ar: "خيارات متقدمة" },
  "editor.advanced.hint":    { en: "link to order / supplier / receipt URL",
                               zh: "关联订单 / 供应商 / 收据链接",
                               ar: "رابط إلى الطلب / المورد / الإيصال" },
  "editor.advanced.receiptUrl":     { en: "Legacy receipt URL",          zh: "旧版收据链接",           ar: "رابط إيصال قديم" },
  "editor.advanced.receiptUrlHint": { en: "https://… (most teams now use the Evidence drawer instead)",
                                      zh: "https://… (大多数团队现已改用证据抽屉)",
                                      ar: "https://… (معظم الفرق الآن تستخدم درج الأدلة بدلاً منه)" },
  "editor.advanced.linkedSupplier": { en: "Linked supplier",             zh: "关联的供应商",            ar: "المورد المرتبط" },
  "editor.advanced.linkedCustomer": { en: "Linked customer",             zh: "关联的客户",              ar: "العميل المرتبط" },
  "editor.advanced.supplierIdHint": { en: "Supplier id (optional)",      zh: "供应商 ID（可选）",        ar: "معرف المورد (اختياري)" },
  "editor.advanced.customerIdHint": { en: "Customer id (optional)",      zh: "客户 ID（可选）",          ar: "معرف العميل (اختياري)" },
  "editor.saving":           { en: "Saving…",                            zh: "正在保存…",              ar: "جارٍ الحفظ…" },
  "editor.saveAndAttach":    { en: "Save & attach receipt",              zh: "保存并附上收据",          ar: "حفظ وإرفاق الإيصال" },
  "editor.saveExpense":      { en: "Save expense",                       zh: "保存费用",               ar: "حفظ المصروف" },
  "editor.footer.category":  { en: "Category",                           zh: "类别",                   ar: "الفئة" },
  "editor.footer.pickPrompt":{ en: "Pick a category to make reporting cleaner.",
                               zh: "选择类别可让报表更清晰。",
                               ar: "اختر فئة لجعل التقارير أوضح." },
  "editor.err.titleMissing": { en: "Add a short title so this expense is findable later.",
                               zh: "请添加简短标题，便于日后查找此费用。",
                               ar: "أضف عنوانًا قصيرًا حتى يمكن العثور على المصروف لاحقًا." },
  "editor.err.amountInvalid":{ en: "Amount must be greater than zero.",  zh: "金额必须大于零。",         ar: "يجب أن يكون المبلغ أكبر من صفر." },
  "editor.err.saveFailed":   { en: "Save failed — try again.",           zh: "保存失败 — 请重试。",       ar: "فشل الحفظ — حاول مجددًا." },

  /* CategoryPicker */
  "picker.optionOne":        { en: "option",                             zh: "项",                    ar: "خيار" },
  "picker.optionMany":       { en: "options",                            zh: "项",                    ar: "خيارات" },
  "picker.chooseSub":        { en: "· choose a sub-category",            zh: "· 选择一个子类别",         ar: "· اختر فئة فرعية" },
  "picker.filterPlaceholder":{ en: "Filter…",                            zh: "筛选…",                  ar: "صفِّ…" },
  "picker.clear":            { en: "Clear",                              zh: "清除",                   ar: "مسح" },
  "picker.general":          { en: "General",                            zh: "通用",                   ar: "عام" },
  "picker.noMatch":          { en: "No sub-categories match “{q}”.",     zh: "没有匹配「{q}」的子类别。", ar: "لا توجد فئات فرعية تطابق «{q}»." },
  "list.deleting":         { en: "Deleting…",                         zh: "正在删除…",              ar: "جارٍ الحذف…" },
  "list.editAction":       { en: "Edit",                              zh: "编辑",                  ar: "تعديل" },
  "list.deleteAction":     { en: "Delete",                            zh: "删除",                  ar: "حذف" },
  "list.markPaid":         { en: "Mark paid",                         zh: "标记为已付",             ar: "اعتبره مدفوعًا" },
  "list.markUnpaid":       { en: "Mark unpaid",                       zh: "标记为未付",             ar: "اعتبره غير مدفوع" },
  "list.submitForReview":  { en: "Submit for review",                 zh: "提交审核",               ar: "قدّم للمراجعة" },

  /* Editor drawer */
  "editor.titleNew":       { en: "New expense",                       zh: "新建费用",               ar: "مصروف جديد" },
  "editor.titleEdit":      { en: "Edit expense",                      zh: "编辑费用",               ar: "تعديل المصروف" },
  "editor.field.title":    { en: "Title",                             zh: "标题",                  ar: "العنوان" },
  "editor.field.titleHint":{ en: "e.g. November electricity bill",    zh: "例如：11 月电费账单",      ar: "مثلاً: فاتورة كهرباء نوفمبر" },
  "editor.field.category": { en: "Category",                          zh: "类别",                  ar: "الفئة" },
  "editor.field.supplier": { en: "Supplier",                          zh: "供应商",                ar: "المورد" },
  "editor.field.amount":   { en: "Amount",                            zh: "金额",                  ar: "المبلغ" },
  "editor.field.currency": { en: "Currency",                          zh: "币种",                  ar: "العملة" },
  "editor.field.expDate":  { en: "Expense date",                      zh: "费用日期",               ar: "تاريخ المصروف" },
  "editor.field.dueDate":  { en: "Due date",                          zh: "到期日",                ar: "تاريخ الاستحقاق" },
  "editor.field.payStatus":{ en: "Payment status",                    zh: "付款状态",               ar: "حالة الدفع" },
  "editor.field.notes":    { en: "Notes",                             zh: "备注",                  ar: "ملاحظات" },
  "editor.action.create":  { en: "Create expense",                    zh: "创建费用",               ar: "إنشاء مصروف" },

  /* Inline create modals (category / supplier) */
  "inline.cat.title":      { en: "New category",                      zh: "新建类别",               ar: "فئة جديدة" },
  "inline.cat.name":       { en: "Category name",                     zh: "类别名称",               ar: "اسم الفئة" },
  "inline.sup.title":      { en: "New supplier",                      zh: "新建供应商",             ar: "مورد جديد" },
  "inline.sup.name":       { en: "Supplier name",                     zh: "供应商名称",             ar: "اسم المورد" },
  "inline.sup.email":      { en: "Supplier email",                    zh: "供应商邮箱",             ar: "بريد المورد" },

  /* Counts (singular/plural badges) */
  "count.expenses":        { en: "expenses",                          zh: "笔费用",                ar: "مصروفات" },
  "count.expense":         { en: "expense",                           zh: "笔费用",                ar: "مصروف" },
};
