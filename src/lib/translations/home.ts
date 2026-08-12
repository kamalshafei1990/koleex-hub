import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   RoleHome — the seven role dashboards and the personalization drawer.

   The file had ZERO t() calls: every KPI label, hint, quick-action and drawer
   string was hardcoded English, so /home stayed English in Arabic and Chinese
   while the rest of the Hub switched.

   Why its own dictionary rather than reusing the ~28 strings that already
   exist elsewhere: those 28 are spread across eight app dictionaries
   (finance, inventory, hr, management, purchase, discuss, settings, hub).
   Importing eight dictionaries into one component to save ~28 duplicated
   values would couple Home to every app's translation lifecycle — a rename in
   `inv.page.items.title` would silently change a Home KPI. Per-app
   dictionaries with some repeated vocabulary is the pattern this repo already
   uses deliberately.
   --------------------------------------------------------------------------- */

export const homeT: Translations = {
  /* ── Shell / header ── */
  "home":              { en: "Home",          zh: "首页",       ar: "الرئيسية" },
  "create":            { en: "Create",        zh: "新建",       ar: "إنشاء" },
  "createTitle":       { en: "Create (c)",    zh: "新建 (c)",   ar: "إنشاء (c)" },
  "createAria":        { en: "Open Smart Create drawer (shortcut: c)", zh: "打开智能新建面板（快捷键：c）", ar: "فتح لوحة الإنشاء الذكي (اختصار: c)" },
  "dataEntry":         { en: "Data Entry",    zh: "数据录入",    ar: "إدخال البيانات" },
  "dataEntryTitle":    { en: "Where to put finance data manually", zh: "手动录入财务数据的入口", ar: "مكان إدخال البيانات المالية يدويًا" },
  "personalize":       { en: "Personalize",   zh: "个性化",     ar: "تخصيص" },
  "cancel":            { en: "Cancel",        zh: "取消",       ar: "إلغاء" },
  "close":             { en: "Close",         zh: "关闭",       ar: "إغلاق" },

  /* ── Personalization drawer ── */
  "drawer.desc":       { en: "Choose how the home screen behaves for you.", zh: "选择主页对你的呈现方式。", ar: "اختار الشاشة الرئيسية تشتغل معاك إزاي." },
  "drawer.role":       { en: "Dashboard role", zh: "仪表板角色", ar: "دور اللوحة" },
  "drawer.mode":       { en: "Mode",          zh: "模式",       ar: "الوضع" },
  "drawer.favorites":  { en: "Favorite apps", zh: "常用应用",   ar: "التطبيقات المفضّلة" },
  "drawer.pinned":     { en: "Pinned workflows", zh: "置顶流程", ar: "المسارات المثبّتة" },

  /* Role + mode subtitle. Built as a TEMPLATE LITERAL in the JSX, which is why
     no `>text<` / prop scan ever saw it — the sentence never exists as a
     literal anywhere. Keyed as a whole sentence with {role}/{mode} slots so
     Arabic and Chinese can reorder it. */
  "role.ceo":        { en: "Executive",  zh: "\u7ba1\u7406\u5c42", ar: "\u062a\u0646\u0641\u064a\u0630\u064a" },
  "role.accountant": { en: "Accountant", zh: "\u4f1a\u8ba1",   ar: "\u0645\u062d\u0627\u0633\u0628" },
  "role.sales":      { en: "Sales",      zh: "\u9500\u552e",   ar: "\u0645\u0628\u064a\u0639\u0627\u062a" },
  "role.warehouse":  { en: "Warehouse",  zh: "\u4ed3\u5e93",   ar: "\u0645\u062e\u0632\u0646" },
  "role.purchasing": { en: "Purchasing", zh: "\u91c7\u8d2d",   ar: "\u0645\u0634\u062a\u0631\u064a\u0627\u062a" },
  "role.marketing":  { en: "Marketing",  zh: "\u5e02\u573a",   ar: "\u062a\u0633\u0648\u064a\u0642" },
  "role.hr":         { en: "HR",         zh: "\u4eba\u4e8b",   ar: "\u0645\u0648\u0627\u0631\u062f \u0628\u0634\u0631\u064a\u0629" },
  "mode.simple":     { en: "Simple",     zh: "\u7b80\u6613",   ar: "\u0645\u0628\u0633\u0651\u0637" },
  "mode.advanced":   { en: "Advanced",   zh: "\u9ad8\u7ea7",   ar: "\u0645\u062a\u0642\u062f\u0651\u0645" },
  "mode.simpleDesc":   { en: "Operational actions, fewer accounting details.", zh: "\u4fa7\u91cd\u8fd0\u8425\u64cd\u4f5c\uff0c\u4f1a\u8ba1\u7ec6\u8282\u8f83\u5c11\u3002", ar: "\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0648\u062a\u0641\u0627\u0635\u064a\u0644 \u0645\u062d\u0627\u0633\u0628\u064a\u0629 \u0623\u0642\u0644." },
  "mode.advancedDesc": { en: "Accounting, journals, reconciliation, adjustments.", zh: "\u4f1a\u8ba1\u3001\u51ed\u8bc1\u3001\u5bf9\u8d26\u3001\u8c03\u6574\u3002", ar: "\u0645\u062d\u0627\u0633\u0628\u0629 \u0648\u0642\u064a\u0648\u062f \u0648\u062a\u0633\u0648\u064a\u0627\u062a \u0648\u062a\u0639\u062f\u064a\u0644\u0627\u062a." },
  "subtitle":        { en: "{role} dashboard \u00b7 {mode} mode", zh: "{role}\u4eea\u8868\u677f \u00b7 {mode}\u6a21\u5f0f", ar: "\u0644\u0648\u062d\u0629 {role} \u00b7 \u0648\u0636\u0639 {mode}" },
  "loading":         { en: "Loading\u2026", zh: "\u52a0\u8f7d\u4e2d\u2026", ar: "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u2026" },
  /* Focus toggle (components/ui/focus/FocusMode.tsx) */
  "focus.off":       { en: "Focus",      zh: "\u4e13\u6ce8",   ar: "\u062a\u0631\u0643\u064a\u0632" },
  "focus.on":        { en: "Focus on",   zh: "\u4e13\u6ce8\u4e2d", ar: "\u0627\u0644\u062a\u0631\u0643\u064a\u0632 \u0634\u063a\u0651\u0627\u0644" },
  "focus.exitTitle": { en: "Exit focus mode", zh: "\u9000\u51fa\u4e13\u6ce8\u6a21\u5f0f", ar: "\u0625\u0646\u0647\u0627\u0621 \u0648\u0636\u0639 \u0627\u0644\u062a\u0631\u0643\u064a\u0632" },
  "focus.enterTitle":{ en: "Hide secondary chrome while you work", zh: "\u5de5\u4f5c\u65f6\u9690\u85cf\u6b21\u8981\u754c\u9762", ar: "\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u062b\u0627\u0646\u0648\u064a\u0629 \u0623\u062b\u0646\u0627\u0621 \u0627\u0644\u0639\u0645\u0644" },

  /* Mobile bottom bar (MobileActionBar). The labels are passed in as plain
     strings from here, so they never appeared in any scan of the bar itself. */
  "nav.ops":     { en: "Ops",     zh: "\u8fd0\u8425", ar: "\u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a" },
  "nav.finance": { en: "Finance", zh: "\u8d22\u52a1", ar: "\u0627\u0644\u0645\u0627\u0644\u064a\u0629" },

  /* ── KPI labels ── */
  "kpi.activeSO":      { en: "Active sales orders", zh: "生效销售订单", ar: "أوامر بيع نشطة" },
  "kpi.activeSOShort": { en: "Active SOs",     zh: "生效销售订单", ar: "أوامر بيع نشطة" },
  "kpi.activePO":      { en: "Active POs",     zh: "生效采购订单", ar: "أوامر شراء نشطة" },
  "kpi.draftPO":       { en: "Draft POs",      zh: "草稿采购订单", ar: "أوامر شراء مسودّة" },
  "kpi.draftJournals": { en: "Draft journals", zh: "草稿凭证",   ar: "قيود مسودّة" },
  "kpi.cogsDrafts":    { en: "COGS drafts",    zh: "成本草稿",   ar: "مسودّات تكلفة المبيعات" },
  "kpi.pendingExp":    { en: "Pending expenses", zh: "待批费用", ar: "مصروفات معلّقة" },
  "kpi.postedExp":     { en: "Posted expenses", zh: "已过账费用", ar: "مصروفات مرحّلة" },
  "kpi.inventoryItems":{ en: "Inventory items", zh: "库存物料", ar: "أصناف المخزون" },
  "kpi.salesOrders":   { en: "Sales orders",   zh: "销售订单",   ar: "أوامر البيع" },
  "kpi.purchaseOrders":{ en: "Purchase orders", zh: "采购订单",  ar: "أوامر الشراء" },
  "kpi.invoicesIssued":{ en: "Invoices issued", zh: "已开发票",  ar: "فواتير صادرة" },
  "kpi.paymentsRecv":  { en: "Payments received", zh: "已收款项", ar: "مدفوعات محصّلة" },
  "kpi.billsPosted":   { en: "Bills posted",   zh: "已过账账单", ar: "فواتير موردين مرحّلة" },
  "kpi.postedReceipts":{ en: "Posted receipts", zh: "已过账入库", ar: "استلامات مرحّلة" },
  "kpi.stockBalances": { en: "Stock balances", zh: "库存余额",   ar: "أرصدة المخزون" },
  "kpi.movements":     { en: "Movements",      zh: "出入库",     ar: "الحركات" },
  "kpi.warehouses":    { en: "Warehouses",     zh: "仓库",       ar: "المخازن" },
  "kpi.items":         { en: "Items",          zh: "物料",       ar: "الأصناف" },
  "kpi.employees":     { en: "Employees",      zh: "员工",       ar: "الموظفون" },
  "kpi.departments":   { en: "Departments",    zh: "部门",       ar: "الأقسام" },
  "kpi.hrDocs":        { en: "HR docs",        zh: "人事文件",   ar: "مستندات الموارد البشرية" },
  "kpi.products":      { en: "Products",       zh: "产品",       ar: "المنتجات" },
  "kpi.suppliers":     { en: "Suppliers",      zh: "供应商",     ar: "الموردون" },
  "kpi.catalogs":      { en: "Catalogs",       zh: "图册",       ar: "الكتالوجات" },
  "kpi.shipments":     { en: "Shipments",      zh: "发运",       ar: "الشحنات" },
  "kpi.invoices":      { en: "Invoices",       zh: "发票",       ar: "الفواتير" },
  "kpi.events":        { en: "Events",         zh: "活动",       ar: "الفعاليات" },

  /* ── KPI hints ── */
  "hint.confirmedPartial": { en: "Confirmed + partial", zh: "已确认 + 部分", ar: "مؤكّد + جزئي" },
  "hint.awaitingReview":   { en: "Awaiting review", zh: "待审核",   ar: "بانتظار المراجعة" },
  "hint.awaitingPost":     { en: "Awaiting post",  zh: "待过账",    ar: "بانتظار الترحيل" },
  "hint.fromShipments":    { en: "From shipments", zh: "来自发运",  ar: "من الشحنات" },
  "hint.submittedNotApproved": { en: "Submitted, not approved", zh: "已提交，未批准", ar: "مقدّمة وغير معتمدة" },
  "hint.inTheGL":          { en: "In the GL",     zh: "已入总账",   ar: "في دفتر الأستاذ" },
  "hint.universalMaster":  { en: "Universal master", zh: "统一主数据", ar: "السجل الموحّد" },
  "hint.masterBalances":   { en: "Master + balances", zh: "主数据 + 余额", ar: "السجل + الأرصدة" },
  "hint.perItemLocation":  { en: "Per item × location", zh: "按物料 × 库位", ar: "لكل صنف × موقع" },
  "hint.postedInOut":      { en: "Posted IN/OUT", zh: "已过账出入库", ar: "وارد/صادر مرحّل" },
  "hint.storageLocations": { en: "Storage locations", zh: "存储库位", ar: "مواقع التخزين" },
  "hint.activeRoster":     { en: "Active roster", zh: "在职名单",  ar: "الكادر النشط" },
  "hint.orgStructure":     { en: "Org structure", zh: "组织架构",  ar: "الهيكل التنظيمي" },
  "hint.deptStructure":    { en: "Department structure", zh: "部门结构", ar: "هيكل الأقسام" },
  "hint.contractsIds":     { en: "Contracts + IDs", zh: "合同 + 证件", ar: "عقود + هويات" },
  "hint.personnelRecords": { en: "Personnel records", zh: "人事档案", ar: "سجلات الأفراد" },
  "hint.orgLeaveAppraisals": { en: "Org + leave + appraisals", zh: "组织 + 假期 + 考核", ar: "الهيكل + الإجازات + التقييم" },
  "hint.publicCatalog":    { en: "Public catalog", zh: "公开图册",  ar: "الكتالوج العام" },
  "hint.publicCatalogMgmt":{ en: "Public catalog management", zh: "公开图册管理", ar: "إدارة الكتالوج العام" },
  "hint.customerFacing":   { en: "Customer-facing catalog", zh: "面向客户的图册", ar: "كتالوج موجّه للعملاء" },
  "hint.pagesContent":     { en: "Pages + content", zh: "页面 + 内容", ar: "الصفحات + المحتوى" },
  "hint.editContentPages": { en: "Edit content + pages", zh: "编辑内容 + 页面", ar: "تحرير المحتوى + الصفحات" },
  "hint.exhibitionPlanning": { en: "Exhibition planning", zh: "展会规划", ar: "تخطيط المعارض" },
  "hint.appendOnlyLedger": { en: "Append-only ledger", zh: "只追加账簿", ar: "سجل إضافة فقط" },
  "hint.issueCollect":     { en: "Issue + collect", zh: "开票 + 收款", ar: "إصدار + تحصيل" },
  "hint.openTimeline":     { en: "Open timeline", zh: "打开时间线", ar: "فتح المسار الزمني" },
  "hint.pinned":           { en: "Pinned",        zh: "已置顶",     ar: "مثبّت" },
  "hint.endToEnd":         { en: "End-to-end timeline", zh: "端到端时间线", ar: "مسار من البداية للنهاية" },
  "hint.endToEndPlural":   { en: "End-to-end timelines", zh: "端到端时间线", ar: "مسارات من البداية للنهاية" },
  "hint.approveDrafts":    { en: "Approve drafts", zh: "批准草稿",  ar: "اعتماد المسودّات" },
  "hint.draftPostVoid":    { en: "Draft / post / void", zh: "草稿 / 过账 / 作废", ar: "مسودّة / ترحيل / إلغاء" },
  "hint.statements":       { en: "Income · Balance · Cash flow", zh: "利润 · 资产负债 · 现金流", ar: "الدخل · الميزانية · التدفق النقدي" },
  "hint.approvalsBanks":   { en: "Approvals · banks · activity", zh: "审批 · 银行 · 动态", ar: "الاعتمادات · البنوك · النشاط" },
  "hint.masterClassify":   { en: "Master · classify · archive", zh: "主数据 · 分类 · 归档", ar: "السجل · التصنيف · الأرشفة" },
  "hint.draftConfirmReceive": { en: "Draft · confirm · receive", zh: "草稿 · 确认 · 收货", ar: "مسودّة · تأكيد · استلام" },
  "hint.createShipTrack":  { en: "Create · ship · track", zh: "创建 · 发运 · 跟踪", ar: "إنشاء · شحن · تتبّع" },

  /* ── Quick actions & workflow strips ── */
  "qa.topActions":     { en: "Top actions",   zh: "常用操作",   ar: "أهم الإجراءات" },
  "qa.statements":     { en: "Statements",    zh: "财务报表",   ar: "القوائم المالية" },
  "qa.accountingQueue":{ en: "Accounting queue", zh: "会计队列", ar: "طابور المحاسبة" },
  "qa.workflows":      { en: "Workflows",     zh: "业务流程",   ar: "المسارات" },
  "qa.workspace":      { en: "Workspace",     zh: "工作台",     ar: "مساحة العمل" },
  "qa.hrHub":          { en: "HR Hub",        zh: "人事中心",   ar: "مركز الموارد البشرية" },
  "qa.website":        { en: "Website",       zh: "网站",       ar: "الموقع" },
  "qa.management":     { en: "Management",    zh: "管理",       ar: "الإدارة" },

  /* ── Workflow rows ── */
  "wf.sales":          { en: "Sales workflow", zh: "销售流程",  ar: "مسار المبيعات" },
  "wf.salesDesc":      { en: "Quote → SO → ship → invoice → pay", zh: "报价 → 销售订单 → 发运 → 开票 → 收款", ar: "عرض سعر ← أمر بيع ← شحن ← فاتورة ← تحصيل" },
  "wf.procurement":    { en: "Procurement workflow", zh: "采购流程", ar: "مسار المشتريات" },
  "wf.procurementDesc":{ en: "Supplier → PO → receipt → bill → pay", zh: "供应商 → 采购订单 → 收货 → 账单 → 付款", ar: "مورّد ← أمر شراء ← استلام ← فاتورة ← سداد" },
  "wf.inventory":      { en: "Inventory workflow", zh: "库存流程", ar: "مسار المخزون" },
};
