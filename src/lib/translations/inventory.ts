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
};
