import type { Translations } from "@/lib/i18n";

/* Sales & purchasing (phase E) — lib/server/commerce-notify.ts and the
   sales-reminders cron: quotations, orders, contracts, CRM follow-ups,
   expense approvals, purchase receipts. */
export const commerceTpl: Translations = {
  "quotation_status_changed.s": { en: "Quotation {no}: {status:quoteStatus}", zh: "报价单 {no}：{status:quoteStatus}", ar: "عرض السعر {no}: {status:quoteStatus}" },
  "quotation_status_changed.b": { en: "Changed by {actor}", zh: "由 {actor} 更改", ar: "غيّره {actor}" },
  "quotation_expired.s": { en: "Quotation {no} expired on {date}", zh: "报价单 {no} 已于 {date} 过期", ar: "انتهت صلاحية عرض السعر {no} في {date}" },
  "quotation_expired.b": {
    en: "It was sent but never accepted — renew it or mark it expired.",
    zh: "已发送但尚未被接受——请续期或标记为过期。",
    ar: "أُرسل ولم يُقبل بعد — جدّده أو علّمه كمنتهٍ.",
  },
  "enum.quoteStatus.draft":    { en: "Draft",    zh: "草稿",   ar: "مسودة" },
  "enum.quoteStatus.sent":     { en: "Sent",     zh: "已发送", ar: "مُرسل" },
  "enum.quoteStatus.accepted": { en: "Accepted", zh: "已接受", ar: "مقبول" },
  "enum.quoteStatus.rejected": { en: "Rejected", zh: "已拒绝", ar: "مرفوض" },
  "enum.quoteStatus.expired":  { en: "Expired",  zh: "已过期", ar: "منتهي الصلاحية" },

  "order_status_changed.s": { en: "Order {no}: {status:orderStatus}", zh: "订单 {no}：{status:orderStatus}", ar: "الطلب {no}: {status:orderStatus}" },
  "order_status_changed.b": { en: "Changed by {actor}", zh: "由 {actor} 更改", ar: "غيّره {actor}" },
  "enum.orderStatus.open":      { en: "Open",      zh: "进行中", ar: "مفتوح" },
  "enum.orderStatus.shipped":   { en: "Shipped",   zh: "已发货", ar: "تم الشحن" },
  "enum.orderStatus.closed":    { en: "Closed",    zh: "已关闭", ar: "مغلق" },
  "enum.orderStatus.cancelled": { en: "Cancelled", zh: "已取消", ar: "ملغى" },

  "contract_ready.s": { en: "Contract {no} is ready to sign", zh: "合同 {no} 已可签署", ar: "العقد {no} جاهز للتوقيع" },
  "contract_ready.b": { en: "Marked ready by {actor}.", zh: "由 {actor} 标记为可签署。", ar: "جهّزه {actor} للتوقيع." },
  "contract_signed.s": { en: "Contract {no} signed", zh: "合同 {no} 已签署", ar: "تم توقيع العقد {no}" },
  "contract_signed.b": { en: "Signed by {actor}.", zh: "由 {actor} 签署。", ar: "وقّعه {actor}." },

  "crm_followup_due.s": { en: "Follow-up due: {title:free}", zh: "待跟进：{title:free}", ar: "متابعة مستحقة: {title:free}" },
  "crm_followup_due.b": { en: "Due {date}[[ · {deal:free}]]", zh: "截止 {date}[[ · {deal:free}]]", ar: "موعدها {date}[[ · {deal:free}]]" },

  "expense_approval_request.s": { en: "Expense to approve — {who}", zh: "待审批费用 — {who}", ar: "مصروف بانتظار الموافقة — {who}" },
  "expense_approval_request.b": { en: "{amount}[[ · {what:free}]]", zh: "{amount}[[ · {what:free}]]", ar: "{amount}[[ · {what:free}]]" },
  "expense_decided.s": { en: "Your expense: {decision:expenseDecision}", zh: "你的费用：{decision:expenseDecision}", ar: "مصروفك: {decision:expenseDecision}" },
  "expense_decided.b": { en: "{amount}[[ — {note:free}]]", zh: "{amount}[[ — {note:free}]]", ar: "{amount}[[ — {note:free}]]" },
  "enum.expenseDecision.approved":           { en: "approved",               zh: "已批准",     ar: "تمت الموافقة" },
  "enum.expenseDecision.partially_approved": { en: "partly approved",        zh: "已部分批准", ar: "موافقة جزئية" },
  "enum.expenseDecision.rejected":           { en: "rejected",               zh: "已拒绝",     ar: "مرفوض" },
  "enum.expenseDecision.requires_changes":   { en: "sent back for changes",  zh: "需要修改",   ar: "مطلوب تعديله" },

  "purchase_received.s": { en: "Goods received — PO {no}", zh: "已收货 — 采购单 {no}", ar: "تم استلام البضاعة — أمر الشراء {no}" },
  "purchase_received.b": { en: "Received by {actor}.", zh: "由 {actor} 签收。", ar: "استلمها {actor}." },
  "purchase_received.partial.s": { en: "Goods partly received — PO {no}", zh: "部分收货 — 采购单 {no}", ar: "استلام جزئي للبضاعة — أمر الشراء {no}" },
  "purchase_received.partial.b": { en: "Received by {actor}.", zh: "由 {actor} 签收。", ar: "استلمها {actor}." },
};
