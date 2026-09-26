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
};
