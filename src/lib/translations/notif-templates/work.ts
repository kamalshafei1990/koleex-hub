import type { Translations } from "@/lib/i18n";

/* Projects, Planning, Inventory, Quotations, Invoices, Finance, Notes —
   lib/server/project-notify.ts, api/cron/project-task-reminders,
   lib/server/planning-notify.ts, lib/inventory/transfers.ts, notify-lite's
   low-stock alert, api/quotations, api/invoices/[id]/send,
   api/cron/finance-reminders, api/notes/[id]/shares. */

/* A finance reminder's body says only when it was due; the same two
   sentences serve all four subjects (collect / pay, named or not). */
const financeDue = { en: "Due {due}.", zh: "到期日：{due}。", ar: "مستحق في {due}." };
const financeOverdue = {
  en: "Was due {due} — still open.",
  zh: "原定 {due} 到期——仍未结清。",
  ar: "كان مستحقًا في {due} — وما زال مفتوحًا.",
};
const financeCollect = { en: "Collect from {who}[[: {amount}]]", zh: "向 {who} 收款[[：{amount}]]", ar: "تحصيل من {who}[[: {amount}]]" };
const financeCollectUnnamed = { en: "Collect from a party[[: {amount}]]", zh: "向对方收款[[：{amount}]]", ar: "تحصيل من طرف[[: {amount}]]" };
const financePay = { en: "Pay {who}[[: {amount}]]", zh: "向 {who} 付款[[：{amount}]]", ar: "دفع إلى {who}[[: {amount}]]" };
const financePayUnnamed = { en: "Pay a party[[: {amount}]]", zh: "向对方付款[[：{amount}]]", ar: "دفع إلى طرف[[: {amount}]]" };

/* {by}: the line the item crossed — its reorder point, else its minimum
   (lib/inventory/low-stock, the one rule). */
const lowStockBody = {
  en: "On hand {qty} ≤ {by:low_stock_by} {threshold}.",
  zh: "现有库存 {qty} ≤ {by:low_stock_by} {threshold}。",
  ar: "الكمية المتوفرة {qty} ≤ {by:low_stock_by} {threshold}.",
};

export const workTpl: Translations = {
  /* ── Projects ── */
  "project_task_assigned.s": { en: "Task assigned: {title:free}", zh: "已分配任务：{title:free}", ar: "تم إسناد مهمة: {title:free}" },
  "project_task_assigned.b": {
    en: "You've been assigned a task[[ due {due}]].",
    zh: "你被分配了一项任务[[，截止日期 {due}]]。",
    ar: "أُسندت إليك مهمة[[ تستحق في {due}]].",
  },

  "project_task_comment.s": { en: "New comment on: {title:free}", zh: "新评论：{title:free}", ar: "تعليق جديد على: {title:free}" },

  "project_task_due.today.s": { en: "Task due today: {title:free}", zh: "任务今天到期：{title:free}", ar: "مهمة مستحقة اليوم: {title:free}" },
  "project_task_due.today.b": { en: "Due today.", zh: "今天到期。", ar: "مستحقة اليوم." },
  "project_task_due.overdue.s": { en: "Task overdue: {title:free}", zh: "任务已逾期：{title:free}", ar: "مهمة متأخرة: {title:free}" },
  "project_task_due.overdue.b": {
    en: "Due {due} — still open.",
    zh: "截止日期 {due}——仍未完成。",
    ar: "كان موعد استحقاقها {due} — وما زالت مفتوحة.",
  },

  /* ── Planning ── `when` is "DD/MM/YYYY HH:MM UTC". An untitled item is
     named by its kind (enum.planningItemType — English = the stored code,
     exactly as the notice always read). */
  "planning_published.s": { en: "Scheduled: {title:free}", zh: "已安排：{title:free}", ar: "تمت الجدولة: {title:free}" },
  "planning_published.b": { en: "{title:free} · {when}", zh: "{title:free} · {when}", ar: "{title:free} · {when}" },
  "planning_published.untitled.s": {
    en: "Scheduled: {itemType:planningItemType}",
    zh: "已安排：{itemType:planningItemType}",
    ar: "تمت الجدولة: {itemType:planningItemType}",
  },
  "planning_published.untitled.b": {
    en: "{itemType:planningItemType} · {when}",
    zh: "{itemType:planningItemType} · {when}",
    ar: "{itemType:planningItemType} · {when}",
  },
  /* Publish-week with several items: the body is the stored list. */
  "planning_published.many.s": { en: "Scheduled: {count} items", zh: "已安排：{count} 项", ar: "عناصر مجدولة: {count}" },

  "planning_taken.s": { en: "Shift taken: {title:free}", zh: "班次已被认领：{title:free}", ar: "تم شغل الوردية: {title:free}" },
  "planning_taken.b": { en: "{actor} · {title:free} · {when}", zh: "{actor} · {title:free} · {when}", ar: "{actor} · {title:free} · {when}" },
  "planning_taken.untitled.s": {
    en: "Shift taken: {itemType:planningItemType}",
    zh: "班次已被认领：{itemType:planningItemType}",
    ar: "تم شغل الوردية: {itemType:planningItemType}",
  },
  "planning_taken.untitled.b": {
    en: "{actor} · {itemType:planningItemType} · {when}",
    zh: "{actor} · {itemType:planningItemType} · {when}",
    ar: "{actor} · {itemType:planningItemType} · {when}",
  },

  "enum.planningItemType.shift": { en: "shift", zh: "班次", ar: "وردية" },
  "enum.planningItemType.meeting": { en: "meeting", zh: "会议", ar: "اجتماع" },
  "enum.planningItemType.production": { en: "production", zh: "生产", ar: "إنتاج" },
  "enum.planningItemType.delivery": { en: "delivery", zh: "交付", ar: "توصيل" },
  "enum.planningItemType.maintenance": { en: "maintenance", zh: "维护", ar: "صيانة" },
  "enum.planningItemType.project_task": { en: "project_task", zh: "项目任务", ar: "مهمة مشروع" },
  "enum.planningItemType.room_booking": { en: "room_booking", zh: "会议室预订", ar: "حجز قاعة" },
  "enum.planningItemType.other": { en: "other", zh: "其他", ar: "أخرى" },

  /* ── Inventory ── transfer number plain; optional because the writer
     always tolerated a transfer without one. */
  "transfer_approved.s": { en: "Transfer [[{no} ]]approved", zh: "调拨[[ {no} ]]已批准", ar: "تمت الموافقة على تحويل المخزون[[ {no}]]" },
  "transfer_approved.b": { en: "Your stock transfer was approved.", zh: "你的库存调拨已获批准。", ar: "تمت الموافقة على تحويل المخزون الخاص بك." },
  "transfer_cancelled.s": { en: "Transfer [[{no} ]]cancelled", zh: "调拨[[ {no} ]]已取消", ar: "أُلغي تحويل المخزون[[ {no}]]" },
  "transfer_cancelled.b": { en: "Your stock transfer was cancelled.", zh: "你的库存调拨已取消。", ar: "أُلغي تحويل المخزون الخاص بك." },
  "transfer_shipped.s": { en: "Transfer [[{no} ]]shipped", zh: "调拨[[ {no} ]]已发货", ar: "تم شحن تحويل المخزون[[ {no}]]" },
  "transfer_shipped.b": {
    en: "Your stock transfer left the source warehouse.",
    zh: "你的库存调拨已从源仓库发出。",
    ar: "غادر تحويل المخزون الخاص بك المستودع المصدر.",
  },
  "transfer_received.s": { en: "Transfer [[{no} ]]received", zh: "调拨[[ {no} ]]已收货", ar: "تم استلام تحويل المخزون[[ {no}]]" },
  "transfer_received.b": {
    en: "Your stock transfer was received at the destination warehouse.",
    zh: "你的库存调拨已在目标仓库签收。",
    ar: "تم استلام تحويل المخزون الخاص بك في المستودع الوجهة.",
  },

  /* Item name plain — a product name, not prose. */
  "low_stock_alert.s": { en: "Low stock: {item}", zh: "库存不足：{item}", ar: "مخزون منخفض: {item}" },
  "low_stock_alert.b": lowStockBody,
  "low_stock_alert.unnamed.s": { en: "Low stock: item", zh: "库存不足：物品", ar: "مخزون منخفض: صنف" },
  "low_stock_alert.unnamed.b": lowStockBody,
  "enum.low_stock_by.reorder_point": { en: "reorder point", zh: "补货点", ar: "نقطة إعادة الطلب" },
  "enum.low_stock_by.min_stock": { en: "minimum", zh: "最低库存", ar: "الحد الأدنى" },

  /* ── Quotations / Invoices ── */
  "quotation_updated.s": { en: "Quotation [[{no} ]]updated", zh: "报价单[[ {no} ]]已更新", ar: "تم تحديث عرض السعر[[ {no}]]" },
  "quotation_updated.b": {
    en: "{actor} saved changes to your quotation.",
    zh: "{actor} 保存了对你的报价单的修改。",
    ar: "حفظ {actor} تغييرات على عرض السعر الخاص بك.",
  },

  "invoice_sent.s": { en: "Invoice {no} issued", zh: "发票 {no} 已开具", ar: "تم إصدار الفاتورة {no}" },
  "invoice_sent.b": {
    en: "An invoice for {amount} has been issued[[ and is due {due}]].",
    zh: "一张金额为 {amount} 的发票已开具[[，到期日为 {due}]]。",
    ar: "صدرت فاتورة بمبلغ {amount}[[ وتستحق في {due}]].",
  },

  /* ── Finance ── counterparty name plain; amount = "1,234 USD". */
  "finance_reminder.collect.due.s": financeCollect,
  "finance_reminder.collect.due.b": financeDue,
  "finance_reminder.collect.overdue.s": financeCollect,
  "finance_reminder.collect.overdue.b": financeOverdue,
  "finance_reminder.collect.unnamed.due.s": financeCollectUnnamed,
  "finance_reminder.collect.unnamed.due.b": financeDue,
  "finance_reminder.collect.unnamed.overdue.s": financeCollectUnnamed,
  "finance_reminder.collect.unnamed.overdue.b": financeOverdue,
  "finance_reminder.pay.due.s": financePay,
  "finance_reminder.pay.due.b": financeDue,
  "finance_reminder.pay.overdue.s": financePay,
  "finance_reminder.pay.overdue.b": financeOverdue,
  "finance_reminder.pay.unnamed.due.s": financePayUnnamed,
  "finance_reminder.pay.unnamed.due.b": financeDue,
  "finance_reminder.pay.unnamed.overdue.s": financePayUnnamed,
  "finance_reminder.pay.unnamed.overdue.b": financeOverdue,

  /* ── Notes ── the body is the note's title (a person's words, stored). */
  "note_shared.s": { en: "{actor} shared a note with you", zh: "{actor} 与你共享了一条笔记", ar: "شارك {actor} ملاحظة معك" },
  "note_shared.someone.s": { en: "Someone shared a note with you", zh: "有人与你共享了一条笔记", ar: "شارك أحدهم ملاحظة معك" },
};
