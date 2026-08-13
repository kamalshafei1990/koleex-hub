import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Documents — the packing-list / commercial-invoice builder.

   Had ZERO t() calls across five files.

   ⚠️ THIS DICTIONARY COVERS THE APP CHROME ONLY, AND THAT LINE IS DELIBERATE.

   The documents this screen produces are EXPORT PAPERWORK. A packing list and
   a commercial invoice are presented to customs, to the carrier, and to the
   bank against a letter of credit. Their field captions are what makes them
   recognisable to those parties:

       PACKING LIST · COMMERCIAL INVOICE · Invoice No · Port of Loading ·
       Port of Discharge · HS Code · G.W · N.W · Country of Origin ·
       Authorised Signature · Company Stamp · ACID No. (Egypt NAFEZA)

   Translating the printed sheet is not an i18n improvement — it is a change to
   a legal document, and it can get the shipment rejected. Those strings stay
   English and are NOT in this file. If a localised sheet is ever wanted it has
   to be a deliberate second template, decided by the owner, not a side effect
   of a translation sweep.

   Also left English on purpose: the registered company name
   ("KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD.") and the brand line
   ("SHAPING THE FUTURE.") — a legal entity name and a trademark.

   What IS translated: the buttons, tabs, tooltips and status text that belong
   to the Hub around the document — everything the operator clicks, none of
   what the customs officer reads.
   --------------------------------------------------------------------------- */

export const documentsT: Translations = {
  /* Screen + navigation */
  "title":          { en: "Documents",       zh: "单证",       ar: "المستندات" },
  "newDocument":    { en: "New document",    zh: "新建单证",   ar: "مستند جديد" },
  "savedDocuments": { en: "Saved documents", zh: "已保存单证", ar: "المستندات المحفوظة" },
  "packingList":    { en: "Packing List",    zh: "装箱单",     ar: "قائمة التعبئة" },
  "invoice":        { en: "Invoice",         zh: "发票",       ar: "الفاتورة" },
  "quotation":      { en: "Quotation",       zh: "报价单",     ar: "عرض السعر" },
  "shipping":       { en: "Shipping",        zh: "运输",       ar: "الشحن" },
  "others":         { en: "Others",          zh: "其他",       ar: "أخرى" },
  "blankA4":        { en: "Blank A4 · fill · save · print", zh: "空白 A4 · 填写 · 保存 · 打印", ar: "A4 فاضية · املأ · احفظ · اطبع" },

  /* Toolbar actions */
  "print":          { en: "Print",     zh: "打印",   ar: "طباعة" },
  "excel":          { en: "Excel",     zh: "Excel", ar: "Excel" },
  "send":           { en: "Send",      zh: "发送",   ar: "إرسال" },
  "duplicate":      { en: "Duplicate", zh: "复制",   ar: "نسخة" },
  "delete":         { en: "Delete",    zh: "删除",   ar: "حذف" },
  "addRow":         { en: "Add row",    zh: "添加行", ar: "إضافة سطر" },
  "removeRow":      { en: "Remove row", zh: "删除行", ar: "حذف السطر" },

  /* Tooltips */
  "tip.print":      { en: "Open the browser print dialog and pick 'Save as PDF'.", zh: "打开浏览器打印对话框并选择“另存为 PDF”。", ar: "افتح نافذة الطباعة في المتصفح واختار «حفظ كـ PDF»." },
  "tip.excel":      { en: "Download this document as an Excel (.xlsx) spreadsheet.", zh: "将此单证下载为 Excel (.xlsx) 表格。", ar: "نزّل المستند ده كملف Excel‏ (.xlsx)." },
  "tip.send":       { en: "Open your mail app pre-filled with the recipient and a cover note.", zh: "打开邮件应用，收件人与说明已预填。", ar: "افتح تطبيق البريد وفيه المستلم وخطاب مرفق جاهزين." },
  "tip.duplicate":  { en: "Clone this document into a new draft (fresh number).", zh: "复制为新草稿（重新编号）。", ar: "انسخ المستند لمسودّة جديدة (برقم جديد)." },
  "tip.delete":     { en: "Delete this saved document", zh: "删除已保存的单证", ar: "احذف المستند المحفوظ ده" },
  "tip.status":     { en: "Click to change status", zh: "点击更改状态", ar: "اضغط لتغيير الحالة" },

  /* Status + empty states */
  "unsaved":        { en: "Unsaved",  zh: "未保存", ar: "غير محفوظ" },
  "unsavedChanges": { en: "You have unsaved changes", zh: "你有未保存的更改", ar: "عندك تعديلات مش محفوظة" },
  "noMatches":      { en: "No matches", zh: "没有匹配项", ar: "لا توجد نتائج" },
};
