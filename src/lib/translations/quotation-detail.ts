import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   quotation-detail — i18n strings for /quotations/[id], the read-mostly
   detail page (status moves, line review, delete). The builder and the
   printed A4 body keep their own dictionary (docs.ts); this one is only the
   page chrome around a saved quotation.
   --------------------------------------------------------------------------- */

export const quotationDetailT: Translations = {
  /* ── Page chrome ── */
  "qd.title":              { en: "Quotation",            zh: "报价单",            ar: "عرض السعر" },
  "qd.back":               { en: "Back to quotations",   zh: "返回报价单",         ar: "العودة إلى عروض الأسعار" },
  "qd.backShort":          { en: "Quotations",           zh: "报价单",            ar: "عروض الأسعار" },
  "qd.openInBuilder":      { en: "Open in builder",      zh: "在编辑器中打开",      ar: "فتح في المحرر" },
  "qd.delete":             { en: "Delete",               zh: "删除",              ar: "حذف" },
  "qd.retry":              { en: "Retry",                zh: "重试",              ar: "إعادة المحاولة" },
  "qd.reload":             { en: "Reload",               zh: "重新加载",           ar: "إعادة التحميل" },

  /* ── Load states ── */
  "qd.notFound":           { en: "Quotation not found",  zh: "未找到报价单",        ar: "عرض السعر غير موجود" },
  "qd.notFoundHint":       { en: "It may have been deleted, or the link belongs to another workspace.",
                             zh: "它可能已被删除，或该链接属于其他工作区。",
                             ar: "ربما تم حذفه، أو أن الرابط يخص مساحة عمل أخرى." },
  "qd.loadFailed":         { en: "Couldn't load this quotation",
                             zh: "无法加载此报价单",
                             ar: "تعذّر تحميل عرض السعر هذا" },
  "qd.loadFailedStatus":   { en: "Failed to load quotation ({status})",
                             zh: "加载报价单失败 ({status})",
                             ar: "فشل تحميل عرض السعر ({status})" },
  "qd.networkError":       { en: "Network error",        zh: "网络错误",           ar: "خطأ في الشبكة" },
  "qd.unknownError":       { en: "Unknown error.",       zh: "未知错误。",          ar: "خطأ غير معروف." },

  /* ── Meta ── */
  "qd.customer":           { en: "Customer",             zh: "客户",              ar: "العميل" },
  "qd.notLinked":          { en: "Not linked",           zh: "未关联",             ar: "غير مرتبط" },
  "qd.issued":             { en: "Issued",               zh: "签发日期",           ar: "تاريخ الإصدار" },
  "qd.validTill":          { en: "Valid till",           zh: "有效期至",           ar: "صالح حتى" },
  "qd.currency":           { en: "Currency",             zh: "货币",              ar: "العملة" },
  "qd.version":            { en: "Version {n}",          zh: "版本 {n}",           ar: "الإصدار {n}" },
  "qd.total":              { en: "Total",                zh: "总计",              ar: "الإجمالي" },
  "qd.viaCatalog":         { en: "Requested via catalog", zh: "通过产品目录请求",    ar: "طلب عبر الكتالوج" },

  /* ── Status vocabulary (same five values as the builder) ── */
  "qd.status.draft":       { en: "Draft",                zh: "草稿",              ar: "مسودة" },
  "qd.status.sent":        { en: "Sent",                 zh: "已发送",             ar: "مُرسل" },
  "qd.status.accepted":    { en: "Accepted",             zh: "已接受",             ar: "مقبول" },
  "qd.status.rejected":    { en: "Rejected",             zh: "已拒绝",             ar: "مرفوض" },
  "qd.status.expired":     { en: "Expired",              zh: "已过期",             ar: "منتهي" },
  "qd.moveTo":             { en: "Move to:",             zh: "更改为：",           ar: "نقل إلى:" },
  "qd.statusUpdated":      { en: "Status updated to {status}",
                             zh: "状态已更新为 {status}",
                             ar: "تم تحديث الحالة إلى {status}" },
  "qd.conflict":           { en: "This quotation was updated by another user. Reload to see the latest version.",
                             zh: "此报价单已被其他用户更新。请重新加载以查看最新版本。",
                             ar: "تم تحديث عرض السعر هذا بواسطة مستخدم آخر. أعد التحميل لرؤية أحدث نسخة." },
  "qd.conflictBy":         { en: "Changed by {name}",    zh: "由 {name} 更改",      ar: "تم التغيير بواسطة {name}" },
  "qd.forbidden":          { en: "Your role can't change quotations. Ask a Super Admin to adjust your permissions.",
                             zh: "您的角色无权更改报价单。请联系超级管理员调整权限。",
                             ar: "لا يملك دورك صلاحية تغيير عروض الأسعار. اطلب من المشرف العام تعديل صلاحياتك." },
  "qd.actionFailed":       { en: "Failed ({status})",    zh: "失败 ({status})",     ar: "فشل ({status})" },

  /* ── Customer message / notes ── */
  "qd.customerMessage":    { en: "Customer message",     zh: "客户留言",           ar: "رسالة العميل" },
  "qd.internalNotes":      { en: "Internal notes",       zh: "内部备注",           ar: "ملاحظات داخلية" },

  /* ── Line items ── */
  "qd.lineItems":          { en: "Line items",           zh: "明细项目",           ar: "البنود" },
  "qd.itemCount":          { en: "{n} items",            zh: "{n} 项",            ar: "{n} بنود" },
  "qd.itemCountOne":       { en: "1 item",               zh: "1 项",              ar: "بند واحد" },
  "qd.noLines":            { en: "No line items.",       zh: "没有明细项目。",       ar: "لا توجد بنود." },
  "qd.col.product":        { en: "Product",              zh: "产品",              ar: "المنتج" },
  "qd.col.qty":            { en: "Qty",                  zh: "数量",              ar: "الكمية" },
  "qd.col.unitPrice":      { en: "Unit price",           zh: "单价",              ar: "سعر الوحدة" },
  "qd.col.discount":       { en: "Discount",             zh: "折扣",              ar: "الخصم" },
  "qd.col.lineTotal":      { en: "Line total",           zh: "小计",              ar: "إجمالي البند" },
  "qd.unnamedProduct":     { en: "(Unnamed product)",    zh: "（未命名产品）",       ar: "(منتج بدون اسم)" },
  "qd.tbd":                { en: "TBD",                  zh: "待定",              ar: "قيد التحديد" },
  "qd.tbdHint":            { en: "Some lines still have TBD pricing. Set unit prices in the builder before sending to the customer.",
                             zh: "部分明细尚未定价。请先在编辑器中设置单价，再发送给客户。",
                             ar: "بعض البنود لا تزال بدون سعر. حدّد أسعار الوحدات في المحرر قبل الإرسال إلى العميل." },

  /* ── Delete ── */
  "qd.deleteTitle":        { en: "Delete {no}? This removes the quotation and its line items and cannot be undone.",
                             zh: "删除 {no}？这将删除报价单及其明细，且无法撤销。",
                             ar: "حذف {no}؟ سيؤدي هذا إلى إزالة عرض السعر وبنوده ولا يمكن التراجع عنه." },
  "qd.deleteReason":       { en: "Reason (optional):",   zh: "原因（选填）：",       ar: "السبب (اختياري):" },
  "qd.deleteConfirm":      { en: "Delete",               zh: "删除",              ar: "حذف" },
  "qd.deleteFailed":       { en: "Delete failed ({status})",
                             zh: "删除失败 ({status})",
                             ar: "فشل الحذف ({status})" },
  "qd.deleteForbidden":    { en: "Your role can't delete quotations. Ask a Super Admin to adjust your permissions.",
                             zh: "您的角色无权删除报价单。请联系超级管理员调整权限。",
                             ar: "لا يملك دورك صلاحية حذف عروض الأسعار. اطلب من المشرف العام تعديل صلاحياتك." },
  "qd.deleted":            { en: "Quotation deleted",    zh: "报价单已删除",        ar: "تم حذف عرض السعر" },
};
