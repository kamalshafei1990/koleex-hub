import type { Translations } from "@/lib/i18n";

export const invoicesT: Translations = {
  "app.title":        { en: "Invoices",            zh: "发票",              ar: "الفواتير" },
  "app.subtitle":     { en: "Bill customers, track receivables, record payments.",
                        zh: "向客户开具发票、跟踪应收账款、记录付款。",
                        ar: "فوترة العملاء، متابعة المستحقات، وتسجيل المدفوعات." },
  "action.new":       { en: "New invoice",         zh: "新建发票",          ar: "فاتورة جديدة" },

  /* Status + filter */
  "status.draft":     { en: "Draft",               zh: "草稿",              ar: "مسودة" },
  "status.sent":      { en: "Sent",                zh: "已发送",            ar: "مرسلة" },
  "status.issued":    { en: "Issued",              zh: "已开具",            ar: "صادرة" },
  "status.partial":   { en: "Partial",             zh: "部分付款",          ar: "مدفوعة جزئيًا" },
  "status.paid":      { en: "Paid",                zh: "已付款",            ar: "مدفوعة" },
  "status.overdue":   { en: "Overdue",             zh: "逾期",              ar: "متأخرة" },
  "status.cancelled": { en: "Cancelled",           zh: "已取消",            ar: "ملغاة" },
  "status.void":      { en: "Void",                zh: "作废",              ar: "باطلة" },
  "filter.all":       { en: "All",                 zh: "全部",              ar: "الكل" },
  "filter.open":      { en: "Open",                zh: "未结",              ar: "غير مسددة" },

  /* Toolbar / list */
  "list.search":      { en: "Search invoice #",    zh: "搜索发票编号",       ar: "بحث برقم الفاتورة" },
  "list.total":       { en: "Total",               zh: "总额",              ar: "الإجمالي" },
  "list.balance":     { en: "Balance",             zh: "未付余额",          ar: "الرصيد المستحق" },
  "list.dueOn":       { en: "Due",                 zh: "到期日",            ar: "الاستحقاق" },

  /* KPI */
  "kpi.outstanding":  { en: "Outstanding",         zh: "未收款",            ar: "المستحقات" },
  "kpi.overdue":      { en: "Overdue",             zh: "逾期",              ar: "متأخرة" },
  "kpi.paidThisMonth":{ en: "Paid this month",     zh: "本月已收",          ar: "المحصلة هذا الشهر" },
  "kpi.count":        { en: "Invoices",            zh: "发票",              ar: "فواتير" },

  /* Form */
  "form.customer":    { en: "Customer",            zh: "客户",              ar: "العميل" },
  "form.issueDate":   { en: "Issue date",          zh: "开票日期",          ar: "تاريخ الإصدار" },
  "form.dueDate":     { en: "Due date",            zh: "到期日",            ar: "تاريخ الاستحقاق" },
  "form.currency":    { en: "Currency",            zh: "币种",              ar: "العملة" },
  "form.paymentTerms":{ en: "Payment terms",       zh: "付款条件",          ar: "شروط الدفع" },
  "form.notes":       { en: "Notes",               zh: "备注",              ar: "ملاحظات" },
  "form.terms":       { en: "Terms",               zh: "条款",              ar: "الشروط" },
  "form.taxRate":     { en: "Tax rate (%)",        zh: "税率 (%)",          ar: "نسبة الضريبة (%)" },
  "form.discountPct": { en: "Discount (%)",        zh: "折扣 (%)",          ar: "الخصم (%)" },

  /* Line editor */
  "line.product":     { en: "Product",             zh: "产品",              ar: "المنتج" },
  "line.description": { en: "Description",         zh: "描述",              ar: "الوصف" },
  "line.qty":         { en: "Qty",                 zh: "数量",              ar: "الكمية" },
  "line.price":       { en: "Unit price",          zh: "单价",              ar: "سعر الوحدة" },
  "line.tax":         { en: "Tax %",               zh: "税 %",              ar: "ضريبة %" },
  "line.disc":        { en: "Disc %",              zh: "折扣 %",            ar: "خصم %" },
  "line.total":       { en: "Line total",          zh: "小计",              ar: "الإجمالي" },
  "line.add":         { en: "Add line",            zh: "添加行",            ar: "إضافة بند" },
  "line.remove":      { en: "Remove",              zh: "删除",              ar: "حذف" },

  /* Totals */
  "totals.subtotal":  { en: "Subtotal",            zh: "小计",              ar: "المجموع قبل" },
  "totals.discount":  { en: "Discount",            zh: "折扣",              ar: "الخصم" },
  "totals.tax":       { en: "Tax",                 zh: "税",                ar: "الضريبة" },
  "totals.total":     { en: "Total",               zh: "总计",              ar: "الإجمالي" },
  "totals.paid":      { en: "Paid",                zh: "已付",              ar: "المدفوع" },
  "totals.balance":   { en: "Balance due",         zh: "应付余额",          ar: "المبلغ المستحق" },

  /* Payment modal */
  "pay.title":        { en: "Record payment",      zh: "记录付款",          ar: "تسجيل دفعة" },
  "pay.amount":       { en: "Amount",              zh: "金额",              ar: "المبلغ" },
  "pay.method":       { en: "Method",              zh: "方式",              ar: "الطريقة" },
  "pay.method.bank":  { en: "Bank transfer",       zh: "银行转账",          ar: "تحويل بنكي" },
  "pay.method.cash":  { en: "Cash",                zh: "现金",              ar: "نقدي" },
  "pay.method.card":  { en: "Card",                zh: "信用卡",            ar: "بطاقة" },
  "pay.method.cheque":{ en: "Cheque",              zh: "支票",              ar: "شيك" },
  "pay.method.other": { en: "Other",               zh: "其他",              ar: "أخرى" },
  "pay.reference":    { en: "Reference",           zh: "参考号",            ar: "المرجع" },
  "pay.date":         { en: "Received on",         zh: "收款日期",          ar: "تاريخ الاستلام" },
  "pay.noPayments":   { en: "No payments recorded yet.",
                        zh: "尚未记录任何付款。",
                        ar: "لم يتم تسجيل أي مدفوعات." },

  /* Actions */
  "btn.cancel":       { en: "Cancel",              zh: "取消",              ar: "إلغاء" },
  "btn.save":         { en: "Save",                zh: "保存",              ar: "حفظ" },
  "btn.create":       { en: "Create",              zh: "创建",              ar: "إنشاء" },
  "btn.delete":       { en: "Delete",              zh: "删除",              ar: "حذف" },
  "btn.send":         { en: "Send",                zh: "发送",              ar: "إرسال" },
  "btn.markSent":     { en: "Mark as sent",        zh: "标记为已发送",       ar: "تعليم كمرسلة" },
  "btn.markPaid":     { en: "Mark as paid",        zh: "标记为已付款",       ar: "تعليم كمدفوعة" },
  "btn.print":        { en: "Print / PDF",         zh: "打印 / PDF",        ar: "طباعة / PDF" },
  "btn.recordPayment":{ en: "Record payment",      zh: "记录付款",          ar: "تسجيل دفعة" },
  "btn.back":         { en: "Back",                zh: "返回",              ar: "رجوع" },

  /* Empty */
  "empty.list":       { en: "No invoices yet.",    zh: "还没有发票。",       ar: "لا توجد فواتير بعد." },
  "empty.lines":      { en: "No lines. Add your first line to get started.",
                        zh: "没有明细。添加第一条明细以开始。",
                        ar: "لا توجد بنود. أضف أول بند لتبدأ." },
  "empty.firstLine":  { en: "Add line",            zh: "添加行",            ar: "إضافة بند" },

  /* Detail header */
  "detail.invoice":   { en: "Invoice",             zh: "发票",              ar: "فاتورة" },
  "detail.from":      { en: "From",                zh: "开票方",            ar: "من" },
  "detail.billTo":    { en: "Bill to",             zh: "收票方",            ar: "إلى" },
  "detail.linkedTo":  { en: "Linked to",           zh: "关联到",            ar: "مرتبطة بـ" },
  "detail.payments":  { en: "Payments",            zh: "付款记录",          ar: "المدفوعات" },

  /* Confirmations */
  "confirm.delete":   { en: "Delete this invoice?",
                        zh: "删除此发票？",
                        ar: "حذف هذه الفاتورة؟" },

  /* Entity strip (used by EntityInvoicesStrip on customer pages) */
  "strip.title":      { en: "Invoices",            zh: "发票",              ar: "الفواتير" },
  "strip.empty":      { en: "No invoices linked to this customer.",
                        zh: "没有关联到此客户的发票。",
                        ar: "لا توجد فواتير مرتبطة بهذا العميل." },
};
