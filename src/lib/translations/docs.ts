import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   docs — shared i18n strings for the Quotations + Invoices doc-builder
   apps. The printed A4 document body stays in English so the customer's
   copy is consistent regardless of which Hub language the user picked.
   --------------------------------------------------------------------------- */

export const docsT: Translations = {
  /* ── App titles + subtitles ── */
  "quot.title":          { en: "Quotations",       zh: "报价单",            ar: "عروض الأسعار" },
  "quot.new":            { en: "New Quotation",    zh: "新建报价单",         ar: "عرض سعر جديد" },
  "quot.singular":       { en: "quotation",        zh: "报价单",            ar: "عرض سعر" },
  "quot.plural":         { en: "quotations",       zh: "报价单",            ar: "عروض الأسعار" },
  "quot.none":           { en: "No quotations yet", zh: "还没有报价单。",     ar: "لا توجد عروض أسعار بعد." },
  "quot.createFirst":    { en: "Create your first quotation to get started.",
                           zh: "创建您的第一个报价单开始使用。",
                           ar: "أنشئ عرض السعر الأول للبدء." },
  "quot.deleteConfirm":  { en: "Delete this quotation?",
                           zh: "删除此报价单？",
                           ar: "حذف عرض السعر هذا؟" },

  "inv.title":           { en: "Invoices",         zh: "发票",              ar: "الفواتير" },
  "inv.new":             { en: "New Invoice",      zh: "新建发票",          ar: "فاتورة جديدة" },
  "inv.singular":        { en: "invoice",          zh: "发票",              ar: "فاتورة" },
  "inv.plural":          { en: "invoices",         zh: "发票",              ar: "فواتير" },
  "inv.none":            { en: "No invoices yet",  zh: "还没有发票。",       ar: "لا توجد فواتير بعد." },
  "inv.createFirst":     { en: "Create your first invoice to get started.",
                           zh: "创建您的第一个发票开始使用。",
                           ar: "أنشئ الفاتورة الأولى للبدء." },
  "inv.deleteConfirm":   { en: "Delete this invoice?",
                           zh: "删除此发票？",
                           ar: "حذف هذه الفاتورة؟" },

  /* ── KPI labels ── */
  "kpi.total":           { en: "Total",            zh: "总数",              ar: "الإجمالي" },
  "kpi.drafts":          { en: "Drafts",           zh: "草稿",              ar: "المسودات" },
  "kpi.finalised":       { en: "Finalised",        zh: "已定稿",            ar: "المُعتمدة" },
  "kpi.totalValue":      { en: "Total value (USD)", zh: "总价值 (USD)",      ar: "القيمة الإجمالية (USD)" },
  "kpi.totalBilled":     { en: "Total billed (USD)", zh: "开票总额 (USD)",    ar: "إجمالي الفوترة (USD)" },
  "kpi.expiringSoon":    { en: "{n} expiring within 7 days",
                           zh: "{n} 将在 7 天内到期",
                           ar: "{n} ينتهي خلال 7 أيام" },
  "kpi.pastDue":         { en: "{n} past due date",
                           zh: "{n} 已逾期",
                           ar: "{n} متأخرة" },

  /* ── Toolbar buttons (editor) ── */
  "btn.back":            { en: "Back",             zh: "返回",              ar: "رجوع" },
  "btn.saveDraft":       { en: "Save Draft",       zh: "保存草稿",          ar: "حفظ كمسودة" },
  "btn.saveFinal":       { en: "Save Final",       zh: "保存定稿",          ar: "حفظ نهائي" },
  "btn.convertToInvoice":{ en: "Convert to Invoice", zh: "转为发票",         ar: "تحويل إلى فاتورة" },
  "btn.exportPDF":       { en: "Export PDF",       zh: "导出 PDF",          ar: "تصدير PDF" },
  "btn.print":           { en: "Print",            zh: "打印",              ar: "طباعة" },
  "btn.recordPayment":   { en: "Record Payment",   zh: "记录付款",          ar: "تسجيل دفعة" },

  /* ── Status chip ── */
  "status.draft":        { en: "DRAFT",            zh: "草稿",              ar: "مسودة" },
  "status.final":        { en: "FINAL",            zh: "定稿",              ar: "نهائي" },

  /* ── Editor header form (top dark row) ── */
  "field.customerName":  { en: "Customer Name (optional)",
                           zh: "客户姓名 (选填)",
                           ar: "اسم العميل (اختياري)" },
  "field.companyName":   { en: "Company Name (optional)",
                           zh: "公司名称 (选填)",
                           ar: "اسم الشركة (اختياري)" },

  /* ── Alerts / prompts ── */
  "alert.saveFirstConvert":
    { en: "Save the quotation before converting.",
      zh: "请先保存报价单再进行转换。",
      ar: "احفظ عرض السعر قبل التحويل." },
  "alert.saveFirstPayment":
    { en: "Save the invoice first, then record a payment.",
      zh: "请先保存发票再记录付款。",
      ar: "احفظ الفاتورة أولًا ثم سجّل الدفعة." },
  "prompt.payAmount":    { en: "Payment amount (USD). Open balance:",
                           zh: "付款金额 (USD)。未结余额：",
                           ar: "مبلغ الدفع (USD). الرصيد المستحق:" },
  "prompt.payMethod":    { en: "Method (bank_transfer / cash / card / cheque / other)",
                           zh: "付款方式 (bank_transfer / cash / card / cheque / other)",
                           ar: "الطريقة (bank_transfer / cash / card / cheque / other)" },
  "prompt.payRef":       { en: "Reference (optional)",
                           zh: "参考号 (选填)",
                           ar: "المرجع (اختياري)" },

  /* ── Payment chip ── */
  "paid.paid":           { en: "Paid",             zh: "已付",              ar: "مدفوع" },
  "paid.balance":        { en: "Balance",          zh: "余额",              ar: "الرصيد" },

  /* ── Row actions on list ── */
  "list.delete":         { en: "Delete",           zh: "删除",              ar: "حذف" },
  "list.unnamedCustomer":{ en: "Unnamed Customer", zh: "未命名客户",         ar: "عميل غير مسمى" },

  /* ── Convert-to-invoice tooltip ── */
  "tip.convert":         { en: "Create an invoice from this quotation",
                           zh: "根据此报价单创建发票",
                           ar: "إنشاء فاتورة من عرض السعر هذا" },
};
