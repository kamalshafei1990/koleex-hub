import type { Translations } from "@/lib/i18n";

/* Reports words — The printed sheet. One file per place that reads them (26
   Sep 2026): each screen imports only its own, and ../reports.ts spreads
   them all for the server. validate:reports §26 fails when a screen reads a
   word it did not import. */
export const reportPrintT: Translations = {
  /* The printed sheet speaks formally — it leaves the building. */
  "print.period":       { en: "Period", zh: "期间", ar: "الفترة" },
  "print.from":         { en: "From", zh: "发件人", ar: "من" },
  "print.to":           { en: "To", zh: "收件人", ar: "إلى" },
  "print.cc":           { en: "Copy", zh: "抄送", ar: "نسخة إلى" },
  "print.status":       { en: "Status", zh: "状态", ar: "الحالة" },
  "print.sent":         { en: "Sent", zh: "发送于", ar: "أُرسل في" },
  "print.version":      { en: "Version", zh: "版本", ar: "الإصدار" },
  "print.confidential": { en: "Confidential", zh: "机密", ar: "سري" },
  "print.cont":         { en: "continued", zh: "续", ar: "تابع" },
  "print.review":       { en: "Review", zh: "审阅", ar: "المراجعة" },
  "print.approvedBy":   { en: "Approved by", zh: "批准人", ar: "اعتمده" },
  "print.returnedBy":   { en: "Returned by", zh: "退回人", ar: "أعاده" },
  "print.pageOf":       { en: "Page {n} of {m}", zh: "第 {n} 页，共 {m} 页", ar: "صفحة {n} من {m}" },
  "print.status.draft":     { en: "Draft", zh: "草稿", ar: "مسودة" },
  "print.status.submitted": { en: "Sent", zh: "已发送", ar: "مُرسل" },
  "print.status.approved":  { en: "Approved", zh: "已批准", ar: "معتمد" },
  "print.status.returned":  { en: "Returned", zh: "已退回", ar: "مُعاد للمراجعة" },
  "print.button":       { en: "Print", zh: "打印", ar: "اطبع" },
  "print.attachments":  { en: "Photos and files", zh: "照片和文件", ar: "الصور والملفات" },
  /* The copy the customer receives, and its blank paper form (28 Sep 2026). */
  "print.copy.SR":       { en: "Service report", zh: "服务报告", ar: "تقرير خدمة" },
  "print.copy.IR":       { en: "Installation report", zh: "安装报告", ar: "تقرير تركيب" },
  "print.copy.no":       { en: "Report no.", zh: "报告编号", ar: "رقم التقرير" },
  "print.copy.date":     { en: "Date", zh: "日期", ar: "التاريخ" },
  "print.copy.customer": { en: "Customer", zh: "客户", ar: "العميل" },
  "print.copy.machine":  { en: "Machine · serial no.", zh: "机器 · 序列号", ar: "الآلة · الرقم التسلسلي" },
  "print.copy.tech":     { en: "Technician", zh: "技术员", ar: "الفني" },
  "print.blank.name":    { en: "Name", zh: "姓名", ar: "الاسم" },
};
