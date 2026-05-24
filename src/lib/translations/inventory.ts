import type { Translations } from "@/lib/i18n";

/* ===========================================================================
   inventoryT — i18n dictionary for the Inventory module.

   Phase INV-H3A introduces the Warehouse Transfer workflow. Strings are
   prefixed with inv.transfers.* so future inventory features can keep
   adding into this single dictionary without colliding.
   ========================================================================== */

export const inventoryT: Translations = {
  /* ── Shared inventory chrome ───────────────────────────────── */
  "inv.title":              { en: "Inventory",                 zh: "库存",            ar: "المخزون" },
  "inv.tab.transfers":      { en: "Transfers",                 zh: "调拨",            ar: "التحويلات" },

  /* ── Transfers list ────────────────────────────────────────── */
  "inv.transfers.title":    { en: "Warehouse Transfers",       zh: "仓库调拨",        ar: "تحويلات المستودعات" },
  "inv.transfers.subtitle": {
    en: "Move stock between warehouses with a single document. Stock leaves the source on ship, arrives at the destination on receive.",
    zh: "通过单据在仓库之间调拨库存。出库于发运，入库于接收。",
    ar: "نقل المخزون بين المستودعات بمستند واحد. يُخصم من المصدر عند الشحن ويُضاف إلى الوجهة عند الاستلام.",
  },
  "inv.transfers.new":              { en: "New Transfer",       zh: "新建调拨",        ar: "تحويل جديد" },
  "inv.transfers.col.no":           { en: "Transfer #",         zh: "调拨号",          ar: "رقم التحويل" },
  "inv.transfers.col.source":       { en: "Source",             zh: "源仓库",          ar: "المصدر" },
  "inv.transfers.col.destination":  { en: "Destination",        zh: "目标仓库",        ar: "الوجهة" },
  "inv.transfers.col.items":        { en: "Items",              zh: "条目",            ar: "البنود" },
  "inv.transfers.col.qty":          { en: "Total Qty",          zh: "总数量",          ar: "إجمالي الكمية" },
  "inv.transfers.col.status":       { en: "Status",             zh: "状态",            ar: "الحالة" },
  "inv.transfers.col.created":      { en: "Created",            zh: "创建日期",        ar: "تاريخ الإنشاء" },

  /* ── Tabs ──────────────────────────────────────────────────── */
  "inv.transfers.tab.all":          { en: "All",                zh: "全部",            ar: "الكل" },
  "inv.transfers.tab.draft":        { en: "Draft",              zh: "草稿",            ar: "مسودة" },
  "inv.transfers.tab.pending":      { en: "Pending",            zh: "待审",            ar: "بانتظار الاعتماد" },
  "inv.transfers.tab.approved":     { en: "Approved",           zh: "已批准",          ar: "معتمد" },
  "inv.transfers.tab.shipped":      { en: "Shipped",            zh: "已发运",          ar: "تم الشحن" },
  "inv.transfers.tab.received":     { en: "Received",           zh: "已接收",          ar: "تم الاستلام" },
  "inv.transfers.tab.voided":       { en: "Voided",             zh: "已作废",          ar: "ملغاة" },

  /* ── Empty / loading ───────────────────────────────────────── */
  "inv.transfers.empty.title":      { en: "No transfers yet",   zh: "暂无调拨",        ar: "لا توجد تحويلات بعد" },
  "inv.transfers.empty.hint":       {
    en: "Start a transfer to move stock between warehouses.",
    zh: "创建调拨单以在仓库之间转移库存。",
    ar: "ابدأ تحويلًا لنقل المخزون بين المستودعات.",
  },
  "inv.transfers.loading":          { en: "Loading…",           zh: "加载中…",         ar: "جارٍ التحميل…" },

  /* ── New / edit form ───────────────────────────────────────── */
  "inv.transfers.form.source":          { en: "Source warehouse",         zh: "源仓库",         ar: "مستودع المصدر" },
  "inv.transfers.form.destination":     { en: "Destination warehouse",    zh: "目标仓库",       ar: "مستودع الوجهة" },
  "inv.transfers.form.notes":           { en: "Notes",                    zh: "备注",            ar: "ملاحظات" },
  "inv.transfers.form.add_item":        { en: "Add item",                 zh: "添加条目",        ar: "إضافة بند" },
  "inv.transfers.form.remove":          { en: "Remove",                   zh: "移除",            ar: "إزالة" },
  "inv.transfers.form.item":            { en: "Item",                     zh: "物料",            ar: "البند" },
  "inv.transfers.form.qty":             { en: "Quantity",                 zh: "数量",            ar: "الكمية" },
  "inv.transfers.form.unit":            { en: "Unit",                     zh: "单位",            ar: "الوحدة" },
  "inv.transfers.form.source_stock":    { en: "Source stock",             zh: "源库存",         ar: "المخزون في المصدر" },
  "inv.transfers.form.save_draft":      { en: "Save as Draft",            zh: "保存草稿",        ar: "حفظ كمسودة" },
  "inv.transfers.form.same_warehouse":  { en: "Source and destination warehouses must be different.", zh: "源仓库与目标仓库必须不同。", ar: "يجب أن يختلف مستودع المصدر عن الوجهة." },
  "inv.transfers.form.need_items":      { en: "Add at least one item.",   zh: "至少添加一个条目。", ar: "أضف بندًا واحدًا على الأقل." },

  /* ── Actions ───────────────────────────────────────────────── */
  "inv.transfers.act.submit":       { en: "Submit for Approval",  zh: "提交审批",        ar: "إرسال للاعتماد" },
  "inv.transfers.act.approve":      { en: "Approve",              zh: "批准",            ar: "اعتماد" },
  "inv.transfers.act.ship":         { en: "Ship",                 zh: "发运",            ar: "شحن" },
  "inv.transfers.act.receive":      { en: "Receive",              zh: "接收",            ar: "استلام" },
  "inv.transfers.act.cancel":       { en: "Cancel Transfer",      zh: "取消调拨",        ar: "إلغاء التحويل" },
  "inv.transfers.act.void":         { en: "Void Transfer",        zh: "作废调拨",        ar: "إبطال التحويل" },
  "inv.transfers.act.void_reason":  { en: "Void reason (min 3 chars)", zh: "作废原因（至少3个字符）", ar: "سبب الإبطال (3 أحرف على الأقل)" },

  /* ── Detail sections ───────────────────────────────────────── */
  "inv.transfers.detail.header":      { en: "Header",            zh: "表头",            ar: "ترويسة" },
  "inv.transfers.detail.items":       { en: "Items",             zh: "条目",            ar: "البنود" },
  "inv.transfers.detail.timeline":    { en: "Timeline",          zh: "时间线",          ar: "الجدول الزمني" },
  "inv.transfers.detail.movements":   { en: "Related Movements", zh: "相关分录",        ar: "الحركات المرتبطة" },
  "inv.transfers.detail.no_movements":{ en: "No movements yet — stock posts on ship and receive.", zh: "暂无分录 — 在发运和接收时过账。", ar: "لا توجد حركات بعد — يتم الترحيل عند الشحن والاستلام." },

  /* ── Timeline labels ───────────────────────────────────────── */
  "inv.transfers.timeline.drafted":   { en: "Drafted",           zh: "已起草",          ar: "تمت الصياغة" },
  "inv.transfers.timeline.submitted": { en: "Submitted",         zh: "已提交",          ar: "تم الإرسال" },
  "inv.transfers.timeline.approved":  { en: "Approved",          zh: "已批准",          ar: "تم الاعتماد" },
  "inv.transfers.timeline.shipped":   { en: "Shipped",           zh: "已发运",          ar: "تم الشحن" },
  "inv.transfers.timeline.received":  { en: "Received",          zh: "已接收",          ar: "تم الاستلام" },
  "inv.transfers.timeline.cancelled": { en: "Cancelled",         zh: "已取消",          ar: "تم الإلغاء" },
  "inv.transfers.timeline.voided":    { en: "Voided",            zh: "已作废",          ar: "تم الإبطال" },

  /* ── Movement detail (traceability) ────────────────────────── */
  "inv.transfers.mv.see_transfer":    { en: "View transfer",     zh: "查看调拨",        ar: "عرض التحويل" },

  /* ============================================================
     Phase INV-H3B — Returns workflow (customer + supplier).
     ============================================================ */

  /* ── Returns chrome ────────────────────────────────────────── */
  "inv.tab.returns":               { en: "Returns",              zh: "退货",            ar: "المرتجعات" },
  "inv.returns.title":             { en: "Returns",              zh: "退货",            ar: "المرتجعات" },
  "inv.returns.subtitle": {
    en: "Customer and supplier returns with proper inventory disposition (restock, quarantine, scrap).",
    zh: "客户与供应商退货,带库存处置(回入库、隔离、报废)。",
    ar: "مرتجعات العملاء والموردين مع التصرف الصحيح في المخزون (إعادة الإدخال، الحجر، الإتلاف).",
  },
  "inv.returns.new":               { en: "New Return",           zh: "新建退货",        ar: "مرتجع جديد" },

  /* ── List columns ──────────────────────────────────────────── */
  "inv.returns.col.no":            { en: "Return #",             zh: "退货号",          ar: "رقم المرتجع" },
  "inv.returns.col.type":          { en: "Type",                 zh: "类型",            ar: "النوع" },
  "inv.returns.col.party":         { en: "Customer / Supplier",  zh: "客户/供应商",     ar: "العميل/المورد" },
  "inv.returns.col.warehouse":     { en: "Warehouse",            zh: "仓库",            ar: "المستودع" },
  "inv.returns.col.items":         { en: "Items",                zh: "条目",            ar: "البنود" },
  "inv.returns.col.status":        { en: "Status",               zh: "状态",            ar: "الحالة" },
  "inv.returns.col.created":       { en: "Created",              zh: "创建日期",        ar: "تاريخ الإنشاء" },

  /* ── Tabs ──────────────────────────────────────────────────── */
  "inv.returns.tab.all":            { en: "All",                 zh: "全部",            ar: "الكل" },
  "inv.returns.tab.draft":          { en: "Draft",               zh: "草稿",            ar: "مسودة" },
  "inv.returns.tab.pending":        { en: "Pending",             zh: "待审",            ar: "بانتظار الاعتماد" },
  "inv.returns.tab.approved":       { en: "Approved",            zh: "已批准",          ar: "معتمد" },
  "inv.returns.tab.processed":      { en: "Received / Shipped",  zh: "已收/已发",       ar: "تم الاستلام/الشحن" },
  "inv.returns.tab.completed":      { en: "Completed",           zh: "已完成",          ar: "مكتمل" },
  "inv.returns.tab.voided":         { en: "Voided",              zh: "已作废",          ar: "ملغاة" },

  /* ── Empty / loading ───────────────────────────────────────── */
  "inv.returns.empty.title":       { en: "No returns yet",       zh: "暂无退货",        ar: "لا توجد مرتجعات بعد" },
  "inv.returns.empty.hint": {
    en: "Start a customer or supplier return to bring stock back in or send it out.",
    zh: "创建客户或供应商退货以接收回入库或发出。",
    ar: "ابدأ مرتجع عميل أو مورد لإرجاع المخزون أو إرساله.",
  },
  "inv.returns.loading":           { en: "Loading…",             zh: "加载中…",         ar: "جارٍ التحميل…" },

  /* ── Type labels ───────────────────────────────────────────── */
  "inv.returns.type.customer":     { en: "Customer return",      zh: "客户退货",        ar: "مرتجع عميل" },
  "inv.returns.type.supplier":     { en: "Supplier return",      zh: "供应商退货",      ar: "مرتجع مورد" },

  /* ── Reason codes ──────────────────────────────────────────── */
  "inv.returns.reason.damaged":            { en: "Damaged",             zh: "损坏",            ar: "تالف" },
  "inv.returns.reason.defective":          { en: "Defective",           zh: "缺陷",            ar: "معيب" },
  "inv.returns.reason.wrong_item":         { en: "Wrong item",          zh: "错件",            ar: "صنف خاطئ" },
  "inv.returns.reason.excess":             { en: "Excess",              zh: "多余",            ar: "زائد" },
  "inv.returns.reason.warranty":           { en: "Warranty",            zh: "保修",            ar: "ضمان" },
  "inv.returns.reason.expired":            { en: "Expired",             zh: "过期",            ar: "منتهي الصلاحية" },
  "inv.returns.reason.customer_rejection": { en: "Customer rejection", zh: "客户拒收",        ar: "رفض العميل" },
  "inv.returns.reason.supplier_error":     { en: "Supplier error",      zh: "供应商错误",      ar: "خطأ المورد" },
  "inv.returns.reason.other":              { en: "Other",               zh: "其他",            ar: "أخرى" },

  /* ── Condition + disposition ───────────────────────────────── */
  "inv.returns.condition.good":           { en: "Good",            zh: "良好",        ar: "جيد" },
  "inv.returns.condition.damaged":        { en: "Damaged",         zh: "损坏",        ar: "تالف" },
  "inv.returns.condition.defective":      { en: "Defective",       zh: "缺陷",        ar: "معيب" },
  "inv.returns.condition.scrap":          { en: "Scrap",           zh: "报废",        ar: "خردة" },
  "inv.returns.disp.restock":             { en: "Restock",         zh: "回入库",      ar: "إعادة للمخزون" },
  "inv.returns.disp.quarantine":          { en: "Quarantine",      zh: "隔离",        ar: "حجر" },
  "inv.returns.disp.scrap":               { en: "Scrap",           zh: "报废",        ar: "إتلاف" },
  "inv.returns.disp.vendor_return":       { en: "Hold for vendor return", zh: "暂存以退给供应商", ar: "الاحتفاظ لإعادته للمورد" },

  /* ── Form ──────────────────────────────────────────────────── */
  "inv.returns.form.type":             { en: "Return type",                zh: "退货类型",        ar: "نوع المرتجع" },
  "inv.returns.form.party_customer":   { en: "Customer",                   zh: "客户",            ar: "العميل" },
  "inv.returns.form.party_supplier":   { en: "Supplier",                   zh: "供应商",          ar: "المورد" },
  "inv.returns.form.warehouse":        { en: "Warehouse",                  zh: "仓库",            ar: "المستودع" },
  "inv.returns.form.reason":           { en: "Reason",                     zh: "原因",            ar: "السبب" },
  "inv.returns.form.reason_notes":     { en: "Reason notes",               zh: "原因备注",        ar: "ملاحظات السبب" },
  "inv.returns.form.source_doc_type":  { en: "Source document type",       zh: "源单据类型",      ar: "نوع المستند المرجع" },
  "inv.returns.form.source_doc_id":    { en: "Source document ID",         zh: "源单据 ID",       ar: "معرف المستند المرجع" },
  "inv.returns.form.notes":            { en: "Notes",                      zh: "备注",            ar: "ملاحظات" },
  "inv.returns.form.add_item":         { en: "Add item",                   zh: "添加条目",        ar: "إضافة بند" },
  "inv.returns.form.remove":           { en: "Remove",                     zh: "移除",            ar: "إزالة" },
  "inv.returns.form.item":             { en: "Item",                       zh: "物料",            ar: "البند" },
  "inv.returns.form.qty":              { en: "Quantity",                   zh: "数量",            ar: "الكمية" },
  "inv.returns.form.unit":             { en: "Unit",                       zh: "单位",            ar: "الوحدة" },
  "inv.returns.form.condition":        { en: "Condition",                  zh: "状态",            ar: "الحالة" },
  "inv.returns.form.disposition":      { en: "Disposition",                zh: "处置",            ar: "التصرف" },
  "inv.returns.form.save_draft":       { en: "Save as Draft",              zh: "保存草稿",        ar: "حفظ كمسودة" },
  "inv.returns.form.need_items":       { en: "Add at least one item.",     zh: "至少添加一个条目。", ar: "أضف بندًا واحدًا على الأقل." },
  "inv.returns.form.need_party":       { en: "Choose a customer or supplier.", zh: "请选择客户或供应商。", ar: "اختر عميلًا أو موردًا." },
  "inv.returns.form.need_warehouse":   { en: "Choose a warehouse.",        zh: "请选择仓库。",    ar: "اختر مستودعًا." },
  "inv.returns.form.need_reason":      { en: "Choose a reason.",           zh: "请选择原因。",    ar: "اختر سببًا." },

  /* ── Actions ───────────────────────────────────────────────── */
  "inv.returns.act.submit":     { en: "Submit for Approval", zh: "提交审批",        ar: "إرسال للاعتماد" },
  "inv.returns.act.approve":    { en: "Approve",             zh: "批准",            ar: "اعتماد" },
  "inv.returns.act.receive":    { en: "Receive Items",       zh: "收货",            ar: "استلام البنود" },
  "inv.returns.act.ship":       { en: "Ship Back",           zh: "退发",            ar: "إعادة الشحن" },
  "inv.returns.act.complete":   { en: "Complete",            zh: "完成",            ar: "إتمام" },
  "inv.returns.act.cancel":     { en: "Cancel Return",       zh: "取消退货",        ar: "إلغاء المرتجع" },
  "inv.returns.act.void":       { en: "Void Return",         zh: "作废退货",        ar: "إبطال المرتجع" },
  "inv.returns.act.void_reason":{ en: "Void reason (min 3 chars)", zh: "作废原因(至少3个字符)", ar: "سبب الإبطال (3 أحرف على الأقل)" },

  /* ── Detail sections ───────────────────────────────────────── */
  "inv.returns.detail.header":      { en: "Header",            zh: "表头",            ar: "ترويسة" },
  "inv.returns.detail.items":       { en: "Items",             zh: "条目",            ar: "البنود" },
  "inv.returns.detail.timeline":    { en: "Timeline",          zh: "时间线",          ar: "الجدول الزمني" },
  "inv.returns.detail.movements":   { en: "Related Movements", zh: "相关分录",        ar: "الحركات المرتبطة" },
  "inv.returns.detail.stock_impact":{ en: "Stock impact",      zh: "库存影响",        ar: "الأثر على المخزون" },
  "inv.returns.detail.no_movements":{
    en: "No movements yet — stock posts on receive (customer) or ship (supplier).",
    zh: "暂无分录 — 在客户收货或供应商退发时过账。",
    ar: "لا توجد حركات بعد — يتم الترحيل عند الاستلام (عميل) أو الشحن (مورد).",
  },

  /* ── Timeline labels ───────────────────────────────────────── */
  "inv.returns.timeline.drafted":   { en: "Drafted",           zh: "已起草",          ar: "تمت الصياغة" },
  "inv.returns.timeline.submitted": { en: "Submitted",         zh: "已提交",          ar: "تم الإرسال" },
  "inv.returns.timeline.approved":  { en: "Approved",          zh: "已批准",          ar: "تم الاعتماد" },
  "inv.returns.timeline.received":  { en: "Received",          zh: "已收货",          ar: "تم الاستلام" },
  "inv.returns.timeline.shipped":   { en: "Shipped Back",      zh: "已退发",          ar: "تمت إعادة الشحن" },
  "inv.returns.timeline.completed": { en: "Completed",         zh: "已完成",          ar: "مكتمل" },
  "inv.returns.timeline.cancelled": { en: "Cancelled",         zh: "已取消",          ar: "تم الإلغاء" },
  "inv.returns.timeline.voided":    { en: "Voided",            zh: "已作废",          ar: "تم الإبطال" },

  /* ============================================================
     Phase INV-H4A — Product Variants + Batch Foundation.
     ============================================================ */

  /* ── Header / nav ──────────────────────────────────────────── */
  "inv.tab.batches":               { en: "Batches",             zh: "批次",            ar: "الدُفعات" },

  /* ── Variants ──────────────────────────────────────────────── */
  "inv.variants.title":            { en: "Variants",            zh: "变体",            ar: "المتغيرات" },
  "inv.variants.empty":            { en: "No variants yet.",    zh: "暂无变体。",      ar: "لا توجد متغيرات بعد." },
  "inv.variants.hint": {
    en: "Add a variant when this item exists in multiple flavours (color, voltage, size).",
    zh: "当此物料存在多种规格（颜色、电压、尺寸）时添加变体。",
    ar: "أضف متغيرًا عندما يكون لهذا الصنف أكثر من شكل (لون، فولتية، حجم).",
  },
  "inv.variants.add":              { en: "Add variant",         zh: "添加变体",        ar: "إضافة متغير" },
  "inv.variants.edit":             { en: "Edit",                zh: "编辑",            ar: "تعديل" },
  "inv.variants.archive":          { en: "Archive",             zh: "归档",            ar: "أرشفة" },
  "inv.variants.col.name":         { en: "Name",                zh: "名称",            ar: "الاسم" },
  "inv.variants.col.code":         { en: "Code",                zh: "代码",            ar: "الرمز" },
  "inv.variants.col.attributes":   { en: "Attributes",          zh: "属性",            ar: "السمات" },
  "inv.variants.col.qty":          { en: "On hand",             zh: "在库",            ar: "متوفر" },
  "inv.variants.col.value":        { en: "Value",               zh: "价值",            ar: "القيمة" },
  "inv.variants.col.status":       { en: "Status",              zh: "状态",            ar: "الحالة" },
  "inv.variants.form.name":        { en: "Variant name",        zh: "变体名称",        ar: "اسم المتغير" },
  "inv.variants.form.code":        { en: "Variant code",        zh: "变体代码",        ar: "رمز المتغير" },
  "inv.variants.form.attributes":  { en: "Attributes (color, voltage, size …)", zh: "属性（颜色、电压、尺寸…）", ar: "السمات (لون، فولتية، حجم…)" },
  "inv.variants.form.barcode":     { en: "Barcode",             zh: "条码",            ar: "الباركود" },
  "inv.variants.form.cost":        { en: "Cost price",          zh: "成本价",          ar: "سعر التكلفة" },
  "inv.variants.form.save":        { en: "Save variant",        zh: "保存变体",        ar: "حفظ المتغير" },
  "inv.variants.status.active":    { en: "Active",              zh: "活动",            ar: "نشط" },
  "inv.variants.status.inactive":  { en: "Inactive",            zh: "停用",            ar: "غير نشط" },
  "inv.variants.status.archived":  { en: "Archived",            zh: "已归档",          ar: "مؤرشف" },

  /* ── Batches ───────────────────────────────────────────────── */
  "inv.batches.title":             { en: "Batches & Lots",      zh: "批次与批号",      ar: "الدفعات والأرقام التسلسلية" },
  "inv.batches.subtitle": {
    en: "Lot / batch records with expiry dates, manufacture dates, and remaining quantity. Visibility only — expired stock is not auto-blocked.",
    zh: "带有效期、生产日期与剩余数量的批次记录。仅作可视化，过期不会自动锁定。",
    ar: "سجلات الدفعات/الأرقام التسلسلية مع تواريخ الإنتاج والانتهاء والكميات المتبقية. للمعاينة فقط — لا يتم الحجب تلقائيًا.",
  },
  "inv.batches.new":               { en: "New batch",           zh: "新建批次",        ar: "دفعة جديدة" },
  "inv.batches.empty.title":       { en: "No batches yet",      zh: "暂无批次",        ar: "لا توجد دفعات بعد" },
  "inv.batches.empty.hint": {
    en: "Create a batch when you receive stock that you want to track by lot or expiry.",
    zh: "当您按批次或有效期追踪入库时，创建批次。",
    ar: "أنشئ دفعة عند استلام مخزون ترغب في تتبعه برقم تسلسلي أو تاريخ انتهاء.",
  },

  "inv.batches.col.no":            { en: "Batch #",             zh: "批次号",          ar: "رقم الدفعة" },
  "inv.batches.col.item":          { en: "Item",                zh: "物料",            ar: "الصنف" },
  "inv.batches.col.variant":       { en: "Variant",             zh: "变体",            ar: "المتغير" },
  "inv.batches.col.warehouse":     { en: "Warehouse",           zh: "仓库",            ar: "المستودع" },
  "inv.batches.col.expiry":        { en: "Expiry",              zh: "有效期",          ar: "تاريخ الانتهاء" },
  "inv.batches.col.qty":           { en: "Remaining",           zh: "剩余",            ar: "المتبقي" },
  "inv.batches.col.status":        { en: "Status",              zh: "状态",            ar: "الحالة" },

  "inv.batches.tab.all":           { en: "All",                 zh: "全部",            ar: "الكل" },
  "inv.batches.tab.normal":        { en: "Normal",              zh: "正常",            ar: "عادي" },
  "inv.batches.tab.near_expiry":   { en: "Near expiry",         zh: "临期",            ar: "قارب الانتهاء" },
  "inv.batches.tab.expired":       { en: "Expired",             zh: "已过期",          ar: "منتهي الصلاحية" },
  "inv.batches.tab.depleted":      { en: "Depleted",            zh: "已耗尽",          ar: "مستنفد" },

  "inv.batches.status.normal":     { en: "Normal",              zh: "正常",            ar: "عادي" },
  "inv.batches.status.near_expiry":{ en: "Near expiry",         zh: "临期",            ar: "قارب الانتهاء" },
  "inv.batches.status.expired":    { en: "Expired",             zh: "已过期",          ar: "منتهي الصلاحية" },
  "inv.batches.status.depleted":   { en: "Depleted",            zh: "已耗尽",          ar: "مستنفد" },

  "inv.batches.form.no":             { en: "Batch number",         zh: "批次号",          ar: "رقم الدفعة" },
  "inv.batches.form.supplier_no":    { en: "Supplier batch number",zh: "供应商批次号",    ar: "رقم دفعة المورد" },
  "inv.batches.form.manufacture":    { en: "Manufacture date",     zh: "生产日期",        ar: "تاريخ الإنتاج" },
  "inv.batches.form.expiry":         { en: "Expiry date",          zh: "有效期至",        ar: "تاريخ الانتهاء" },
  "inv.batches.form.qty_initial":    { en: "Initial quantity",     zh: "初始数量",        ar: "الكمية الابتدائية" },
  "inv.batches.form.item":           { en: "Item",                 zh: "物料",            ar: "الصنف" },
  "inv.batches.form.variant":        { en: "Variant (optional)",   zh: "变体（可选）",    ar: "المتغير (اختياري)" },
  "inv.batches.form.warehouse":      { en: "Warehouse",            zh: "仓库",            ar: "المستودع" },
  "inv.batches.form.notes":          { en: "Notes",                zh: "备注",            ar: "ملاحظات" },
  "inv.batches.form.save":           { en: "Create batch",         zh: "创建批次",        ar: "إنشاء دفعة" },

  /* ── KPI ───────────────────────────────────────────────────── */
  "inv.dashboard.kpi.expired_batches":    { en: "Expired batches",    zh: "过期批次",        ar: "دفعات منتهية" },
  "inv.dashboard.kpi.near_expiry_batches":{ en: "Near-expiry batches",zh: "临期批次",        ar: "دفعات قاربت الانتهاء" },

  /* ── Movement form pickers ─────────────────────────────────── */
  "inv.movements.form.variant":      { en: "Variant (optional)",   zh: "变体（可选）",    ar: "المتغير (اختياري)" },
  "inv.movements.form.batch":        { en: "Batch (optional)",     zh: "批次（可选）",    ar: "الدفعة (اختياري)" },
  "inv.movements.form.no_variants":  { en: "No variants for this item.", zh: "此物料无变体。", ar: "لا توجد متغيرات لهذا الصنف." },
  "inv.movements.form.no_batches":   { en: "No batches match.",    zh: "无匹配批次。",     ar: "لا توجد دفعات مطابقة." },

  /* ── Balances drill-down ───────────────────────────────────── */
  "inv.balances.group_by":           { en: "Group by",             zh: "分组方式",        ar: "تجميع حسب" },
  "inv.balances.group_by.item":      { en: "Item",                 zh: "物料",            ar: "الصنف" },
  "inv.balances.group_by.variant":   { en: "Item + Variant",       zh: "物料 + 变体",     ar: "الصنف + المتغير" },
  "inv.balances.group_by.batch":     { en: "Item + Variant + Batch", zh: "物料 + 变体 + 批次", ar: "الصنف + المتغير + الدفعة" },

  /* ── INV-H4B Serial tracking ───────────────────────────────── */
  "inv.tab.serials":                 { en: "Serials",              zh: "序列号",          ar: "الأرقام التسلسلية" },
  "inv.serials.title":               { en: "Serials",              zh: "序列号",          ar: "الأرقام التسلسلية" },
  "inv.serials.subtitle":            { en: "Per-unit identity & lifecycle", zh: "单件标识与生命周期", ar: "هوية وحياة كل وحدة" },
  "inv.serials.search.placeholder":  { en: "Search serial number…", zh: "搜索序列号…",     ar: "ابحث عن رقم تسلسلي…" },
  "inv.serials.filter.item.all":     { en: "All items",            zh: "全部物料",        ar: "كل الأصناف" },
  "inv.serials.filter.warehouse.all":{ en: "All warehouses",       zh: "全部仓库",        ar: "كل المستودعات" },
  "inv.serials.filter.condition.all":{ en: "Any condition",        zh: "任意状况",        ar: "أي حالة" },
  "inv.serials.condition.new":       { en: "New",                  zh: "新品",            ar: "جديد" },
  "inv.serials.condition.opened":    { en: "Opened",               zh: "已开封",          ar: "مفتوح" },
  "inv.serials.condition.refurbished":{ en: "Refurbished",         zh: "翻新",            ar: "مُجدّد" },
  "inv.serials.condition.damaged":   { en: "Damaged",              zh: "损坏",            ar: "تالف" },
  "inv.serials.tab.all":             { en: "All",                  zh: "全部",            ar: "الكل" },
  "inv.serials.tab.in_stock":        { en: "In stock",             zh: "在库",            ar: "في المخزون" },
  "inv.serials.tab.in_transit":      { en: "In transit",           zh: "在途",            ar: "في النقل" },
  "inv.serials.tab.sold":            { en: "Sold",                 zh: "已售",            ar: "مباع" },
  "inv.serials.tab.returned":        { en: "Returned",             zh: "已退回",          ar: "مُرتجع" },
  "inv.serials.tab.damaged":         { en: "Damaged",              zh: "损坏",            ar: "تالف" },
  "inv.serials.tab.scrapped":        { en: "Scrapped",             zh: "报废",            ar: "خُردة" },
  "inv.serials.col.serial":          { en: "Serial",               zh: "序列号",          ar: "الرقم التسلسلي" },
  "inv.serials.col.item":            { en: "Item",                 zh: "物料",            ar: "الصنف" },
  "inv.serials.col.variant":         { en: "Variant",              zh: "变体",            ar: "المتغير" },
  "inv.serials.col.warehouse":       { en: "Warehouse",            zh: "仓库",            ar: "المستودع" },
  "inv.serials.col.status":          { en: "Status",               zh: "状态",            ar: "الحالة" },
  "inv.serials.col.condition":       { en: "Condition",            zh: "状况",            ar: "الحالة المادية" },
  "inv.serials.col.party":           { en: "Customer / Supplier",  zh: "客户 / 供应商",    ar: "العميل / المورد" },
  "inv.serials.col.updated":         { en: "Last activity",        zh: "最近活动",        ar: "آخر نشاط" },
  "inv.serials.empty.title":         { en: "No serials yet",       zh: "暂无序列号",      ar: "لا توجد أرقام تسلسلية بعد" },
  "inv.serials.empty.description":   { en: "Turn on serial tracking on a product, then receive stock to register serials.", zh: "在产品上启用序列号跟踪，然后接收库存以登记序列号。", ar: "فعّل تتبع الأرقام التسلسلية على منتج ثم استلم المخزون لتسجيل الأرقام." },

  /* ── Track Serials toggle ──────────────────────────────────── */
  "inv.item.track_serials":          { en: "Track serial numbers", zh: "跟踪序列号",      ar: "تتبع الأرقام التسلسلية" },
  "inv.item.track_serials.hint":     { en: "Each unit gets a unique serial. Movements require an exact serial match.", zh: "每个单元都有唯一序列号。移动需精确匹配。", ar: "كل وحدة لها رقم تسلسلي فريد. تتطلب الحركات مطابقة دقيقة." },
  "inv.loading":                     { en: "Loading…",             zh: "加载中…",         ar: "جارٍ التحميل…" },

  /* ============================================================
     Phase INV-H5A — UX + operator workflow stabilization.
     ============================================================ */

  /* ── Operator-friendly movement labels ─────────────────────── */
  "inv.action.receive":              { en: "Receive Stock",         zh: "入库",            ar: "استلام المخزون" },
  "inv.action.ship":                 { en: "Ship Stock",            zh: "发货",            ar: "شحن المخزون" },
  "inv.action.transfer":             { en: "Transfer Stock",        zh: "调拨",            ar: "تحويل المخزون" },
  "inv.action.adjust":               { en: "Stock Count / Adjust",  zh: "盘点/调整",       ar: "جرد/تعديل" },
  "inv.action.return":               { en: "Return",                zh: "退货",            ar: "مرتجع" },
  "inv.action.receive.hint":         { en: "Bring stock in from a supplier or opening balance.", zh: "从供应商或期初余额收货。", ar: "إدخال مخزون من مورد أو رصيد افتتاحي." },
  "inv.action.ship.hint":            { en: "Send stock out to a customer.", zh: "向客户发货。", ar: "إرسال المخزون إلى عميل." },
  "inv.action.transfer.hint":        { en: "Move stock between warehouses.", zh: "在仓库之间转移库存。", ar: "نقل المخزون بين المستودعات." },
  "inv.action.adjust.hint":          { en: "Reconcile a stock count or correct a balance.", zh: "盘点对账或纠正余额。", ar: "تسوية جرد أو تصحيح رصيد." },
  "inv.action.return.hint":          { en: "Process a customer or supplier return.", zh: "处理客户或供应商退货。", ar: "معالجة مرتجع عميل أو مورد." },

  /* ── Dashboard ─────────────────────────────────────────────── */
  "inv.home.title":                  { en: "Inventory Operations",  zh: "库存运营",        ar: "عمليات المخزون" },
  "inv.home.subtitle":               { en: "What needs doing today — receive, ship, transfer, adjust.", zh: "今日需办：入库、发货、调拨、调整。", ar: "ما يلزم اليوم — استلام، شحن، تحويل، تعديل." },
  "inv.home.quick.title":            { en: "Quick actions",         zh: "快捷操作",        ar: "إجراءات سريعة" },
  "inv.home.add_internal":           { en: "Add Internal Item",     zh: "添加内部物品",     ar: "إضافة عنصر داخلي" },
  "inv.home.alerts.title":           { en: "Needs attention",       zh: "需关注",          ar: "يستدعي الانتباه" },
  "inv.home.alerts.empty":           { en: "All clear — nothing waiting.", zh: "一切就绪 — 无待办。", ar: "كل شيء على ما يرام — لا انتظار." },
  "inv.home.today.title":            { en: "Today",                 zh: "今日",            ar: "اليوم" },
  "inv.home.lookup.title":           { en: "Quick lookup",          zh: "快速查找",        ar: "بحث سريع" },
  "inv.home.lookup.item":            { en: "Item code, name, or SKU…", zh: "物料代码、名称或 SKU…", ar: "كود الصنف أو الاسم أو SKU…" },
  "inv.home.lookup.serial":          { en: "Serial number…",        zh: "序列号…",         ar: "رقم تسلسلي…" },
  "inv.home.lookup.batch":           { en: "Batch number…",         zh: "批次号…",         ar: "رقم دفعة…" },
  "inv.home.intel.title":            { en: "Operational intelligence", zh: "运营洞察",     ar: "ذكاء تشغيلي" },
  "inv.home.intel.fastest":          { en: "Fastest moving (30d)",  zh: "周转最快（30天）", ar: "الأسرع حركة (٣٠ يوم)" },
  "inv.home.intel.stagnant":         { en: "Stagnant stock (>180d)", zh: "滞销库存（>180天）", ar: "مخزون راكد (+١٨٠ يوم)" },
  "inv.home.intel.busiest":          { en: "Busiest warehouse (7d)", zh: "最繁忙仓库（7天）", ar: "المستودع الأكثر نشاطًا (٧ أيام)" },
  "inv.home.intel.returned":         { en: "Most returned (30d)",   zh: "退货最多（30天）", ar: "الأكثر إرجاعًا (٣٠ يوم)" },

  /* ── Alert labels ──────────────────────────────────────────── */
  "inv.alert.low_stock":             { en: "Low stock items",       zh: "低库存物料",      ar: "أصناف منخفضة المخزون" },
  "inv.alert.expired_batches":       { en: "Expired batches",       zh: "过期批次",        ar: "دفعات منتهية" },
  "inv.alert.pending_approvals":     { en: "Pending approvals",     zh: "待审批",          ar: "بانتظار الاعتماد" },
  "inv.alert.pending_transfers":     { en: "Pending transfers",     zh: "待处理调拨",      ar: "تحويلات قيد التنفيذ" },
  "inv.alert.pending_returns":       { en: "Pending returns",       zh: "待处理退货",      ar: "مرتجعات قيد التنفيذ" },
  "inv.alert.stuck_serials":         { en: "Stuck serials (>7d in transit)", zh: "卡住的序列号（在途>7天）", ar: "أرقام تسلسلية معلقة (+٧ أيام نقل)" },
  "inv.alert.stale_drafts":          { en: "Stale drafts (>7d)",    zh: "陈旧草稿（>7天）", ar: "مسودات قديمة (+٧ أيام)" },
  "inv.alert.serial_mismatch":       { en: "Serial mismatch",       zh: "序列号不匹配",    ar: "عدم تطابق الرقم التسلسلي" },

  /* ── Today section ─────────────────────────────────────────── */
  "inv.today.receipts":              { en: "Receipts",              zh: "收货",            ar: "الاستلامات" },
  "inv.today.shipments":             { en: "Shipments",             zh: "发货",            ar: "الشحنات" },
  "inv.today.transfers":             { en: "Transfers",             zh: "调拨",            ar: "التحويلات" },
  "inv.today.returns":               { en: "Returns",               zh: "退货",            ar: "المرتجعات" },

  /* ── Global search ─────────────────────────────────────────── */
  "inv.search.title":                { en: "Inventory Search",      zh: "库存搜索",        ar: "بحث المخزون" },
  "inv.search.placeholder":          { en: "SKU · serial · batch · item code · barcode · product name", zh: "SKU·序列·批次·代码·条码·名称", ar: "SKU·تسلسلي·دفعة·كود·باركود·اسم" },
  "inv.search.empty":                { en: "Type to search across items, serials, batches, transfers, returns, and movements.", zh: "输入以搜索物料、序列号、批次、调拨、退货与库存分录。", ar: "اكتب للبحث في الأصناف والأرقام التسلسلية والدفعات والتحويلات والمرتجعات والحركات." },
  "inv.search.no_results":           { en: "No results.",           zh: "无结果。",        ar: "لا توجد نتائج." },
  "inv.search.group.items":          { en: "Items",                 zh: "物料",            ar: "الأصناف" },
  "inv.search.group.serials":        { en: "Serials",               zh: "序列号",          ar: "أرقام تسلسلية" },
  "inv.search.group.batches":        { en: "Batches",               zh: "批次",            ar: "دفعات" },
  "inv.search.group.transfers":      { en: "Transfers",             zh: "调拨",            ar: "تحويلات" },
  "inv.search.group.returns":        { en: "Returns",               zh: "退货",            ar: "مرتجعات" },
  "inv.search.group.movements":      { en: "Movements",             zh: "库存分录",        ar: "حركات" },

  /* ── Bulk action bar ───────────────────────────────────────── */
  "inv.bulk.selected":               { en: "{n} selected",          zh: "已选 {n}",        ar: "{n} محدد" },
  "inv.bulk.clear":                  { en: "Clear",                 zh: "清除",            ar: "مسح" },
  "inv.bulk.approve":                { en: "Approve all",           zh: "全部批准",        ar: "اعتماد الكل" },
  "inv.bulk.void":                   { en: "Void drafts",           zh: "作废草稿",        ar: "إبطال المسودات" },
  "inv.bulk.archive":                { en: "Archive",               zh: "归档",            ar: "أرشفة" },
  "inv.bulk.receive":                { en: "Receive items",         zh: "收货",            ar: "استلام البنود" },
  "inv.bulk.complete":               { en: "Mark received",         zh: "标记已收",        ar: "تأشير الاستلام" },

  /* ── Mobile + FAB ──────────────────────────────────────────── */
  "inv.mobile.create":               { en: "Create",                zh: "新建",            ar: "إنشاء" },

  /* ── Traceability card ─────────────────────────────────────── */
  "inv.trace.title":                 { en: "Traceability",          zh: "可追溯",          ar: "تتبع كامل" },
  "inv.trace.latest":                { en: "Latest movement",       zh: "最近分录",        ar: "آخر حركة" },
  "inv.trace.current_warehouse":     { en: "Current warehouse",     zh: "当前仓库",        ar: "المستودع الحالي" },
  "inv.trace.transfers":             { en: "Linked transfers",      zh: "相关调拨",        ar: "التحويلات المرتبطة" },
  "inv.trace.returns":               { en: "Linked returns",        zh: "相关退货",        ar: "المرتجعات المرتبطة" },
  "inv.trace.shipment":              { en: "Linked shipment",       zh: "相关发货",        ar: "الشحنة المرتبطة" },
  "inv.trace.party":                 { en: "Customer / Supplier",   zh: "客户/供应商",     ar: "العميل/المورد" },
  "inv.trace.journal":               { en: "Accounting entry",      zh: "会计分录",        ar: "القيد المحاسبي" },
  "inv.trace.empty":                 { en: "No traceability links yet.", zh: "暂无追溯链接。", ar: "لا توجد روابط تتبع بعد." },

  /* ── Warnings ──────────────────────────────────────────────── */
  "inv.warn.low_stock":              { en: "Below reorder point",   zh: "低于补货点",      ar: "تحت نقطة إعادة الطلب" },
  "inv.warn.expired":                { en: "Expired",               zh: "已过期",          ar: "منتهي الصلاحية" },
  "inv.warn.near_expiry":            { en: "Near expiry",           zh: "临期",            ar: "قارب الانتهاء" },
  "inv.warn.serial_required":        { en: "Serial required",       zh: "需要序列号",      ar: "رقم تسلسلي مطلوب" },
  "inv.warn.stale_draft":            { en: "Draft >7d old",         zh: "草稿 >7 天",      ar: "مسودة لأكثر من ٧ أيام" },

  /* ── Empty states (operator-friendly) ──────────────────────── */
  "inv.empty.transfers.pending":     { en: "No stock transfers waiting for approval.", zh: "无待审批调拨。", ar: "لا توجد تحويلات تنتظر الاعتماد." },
  "inv.empty.returns.pending":       { en: "No returns waiting for processing.", zh: "无待处理退货。", ar: "لا توجد مرتجعات قيد المعالجة." },
  "inv.empty.movements":             { en: "No movements yet — receive, ship, or adjust stock to get started.", zh: "暂无分录 — 入库、发货或调整以开始。", ar: "لا توجد حركات بعد — استلم أو اشحن أو عدّل للبدء." },
  "inv.empty.batches":               { en: "No batches yet — create a batch when you receive lot-tracked stock.", zh: "暂无批次 — 收到批次跟踪的库存时创建。", ar: "لا توجد دفعات بعد — أنشئ دفعة عند استلام مخزون متتبع." },
  "inv.empty.cta.receive":           { en: "Receive stock",         zh: "入库",            ar: "استلام مخزون" },
  "inv.empty.cta.transfer":          { en: "Create transfer",       zh: "新建调拨",        ar: "إنشاء تحويل" },
  "inv.empty.cta.adjust":            { en: "Create adjustment",     zh: "新建调整",        ar: "إنشاء تعديل" },

  /* ── Shortcuts hint ────────────────────────────────────────── */
  "inv.shortcuts.hint":              { en: "Shortcuts: R receive · S ship · T transfer · A adjust · F find", zh: "快捷键：R 入库·S 发货·T 调拨·A 调整·F 搜索", ar: "اختصارات: R استلام · S شحن · T تحويل · A تعديل · F بحث" },
};
