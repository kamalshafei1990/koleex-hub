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
};
