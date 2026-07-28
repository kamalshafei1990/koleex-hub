/* ---------------------------------------------------------------------------
   doc-labels — the printable-document label dictionary (Quotation / Invoice).

   This is NOT the app-UI i18n (lib/i18n reads the operator's interface
   language). The DOCUMENT's language is a property of the document itself:
   a Chinese quotation stays Chinese for everyone who opens, prints or PDFs
   it, regardless of who is looking. It therefore lives in the doc payload
   (`docLang`) and is resolved through here, never through useTranslation.

   Chinese strings use the standard export-trade vocabulary (报价单 /
   商业发票 / 单价 / 交货期 …) — the terms a Chinese supplier or customs
   broker expects on paper, not literal word-by-word translations.

   The amount-in-words line stays in ENGLISH in both languages on purpose:
   Chinese export invoices conventionally spell amounts as "SAY US DOLLARS
   …" even when the rest of the document is Chinese, and banks expect it.
   Only its LABEL translates.

   Free-form content (product descriptions, terms the operator typed) is
   never translated here — the operator writes it in whatever language the
   customer needs. This dictionary covers the fixed template chrome only.
   --------------------------------------------------------------------------- */

export type DocLang = "en" | "zh";

const LABELS = {
  /* ── Title & meta strip ── */
  "title.quotation":       { en: "QUOTATION",           zh: "报价单" },
  "title.invoice":         { en: "COMMERCIAL INVOICE",  zh: "商业发票" },
  "meta.quotationNo":      { en: "Quotation No",        zh: "报价单号" },
  "meta.invoiceNo":        { en: "Invoice No",          zh: "发票号" },
  "meta.date":             { en: "Date",                zh: "日期" },
  "meta.validTill":        { en: "Valid Till",          zh: "有效期至" },
  "meta.currency":         { en: "Currency",            zh: "币种" },
  "meta.clientNo":         { en: "Client No",           zh: "客户编号" },

  /* ── Party cards ── */
  "party.from":            { en: "From",                zh: "卖方" },
  "party.quotationTo":     { en: "Quotation To",        zh: "买方" },
  "party.invoiceTo":       { en: "Invoice To",          zh: "买方" },
  "party.phone":           { en: "Phone",               zh: "电话" },
  "party.mobile":          { en: "Mobile",              zh: "手机" },
  "party.email":           { en: "Email",               zh: "邮箱" },
  "party.web":             { en: "Web",                 zh: "网址" },
  "party.acid":            { en: "ACID No.",            zh: "ACID 编号" },

  /* ── Items table ── */
  "col.no":                { en: "NO.",                 zh: "序号" },
  "col.item":              { en: "ITEM",                zh: "品名" },
  "col.model":             { en: "MODEL",               zh: "型号" },
  "col.picture":           { en: "PICTURE",             zh: "图片" },
  "col.unitPrice":         { en: "UNIT PRICE",          zh: "单价" },
  "col.qty":               { en: "QTY",                 zh: "数量" },
  "col.total":             { en: "TOTAL",               zh: "金额" },

  /* ── Totals block ── */
  "sum.subtotal":          { en: "Subtotal",            zh: "小计" },
  "sum.shipping":          { en: "Shipping",            zh: "运费" },
  "sum.tax":               { en: "Tax",                 zh: "税费" },
  "sum.discount":          { en: "Discount",            zh: "折扣" },
  "sum.total":             { en: "Total",               zh: "总计" },
  "sum.totalInLetters":    { en: "Total in Letters",    zh: "大写金额" },

  /* ── Bank block ── */
  "bank.info":             { en: "Bank Information",    zh: "银行信息" },
  "bank.name":             { en: "Bank Name",           zh: "银行名称" },
  "bank.address":          { en: "Bank Address",        zh: "银行地址" },
  "bank.beneficiary":      { en: "Beneficiary",         zh: "收款人" },
  "bank.accountNo":        { en: "Account No",          zh: "账号" },
  "bank.swift":            { en: "SWIFT Code",          zh: "SWIFT 代码" },

  /* ── Terms strip (quick-fill fields) ── */
  "terms.title":           { en: "Terms & Conditions",  zh: "条款与条件" },
  "terms.payment":         { en: "Payment term",        zh: "付款方式" },
  "terms.incoterm":        { en: "Price type (Incoterm)", zh: "价格条款" },
  "terms.route":           { en: "Shipment Route",      zh: "运输路线" },
  "terms.loadingPort":     { en: "Loading port",        zh: "装运港" },
  "terms.destinationPort": { en: "Destination port",    zh: "目的港" },
  "terms.container":       { en: "Container type",      zh: "柜型" },
  "terms.shippingMarks":   { en: "Shipping marks",      zh: "唛头" },
  "terms.leadTime":        { en: "Lead time (days)",    zh: "交货期（天）" },
  "terms.countedFrom":     { en: "Counted from",        zh: "起算日" },
  "terms.documents":       { en: "Documents Provided",  zh: "随附单据" },
  "terms.legal":           { en: "Legal Clauses",       zh: "法律条款" },
  "terms.bankCharges":     { en: "Bank charges",        zh: "银行费用" },
  "terms.cancellation":    { en: "Cancellation policy", zh: "取消政策" },
  "terms.law":             { en: "Governing law / arbitration", zh: "适用法律 / 仲裁" },
  "terms.warranty":        { en: "Warranty",            zh: "质保" },
  "terms.validity":        { en: "Validity",            zh: "报价有效期" },

  /* ── Signature block & footer ── */
  "sig.authorisedStamp":   { en: "Authorised Stamp",    zh: "公司盖章" },
  "sig.authorisedSignature": { en: "Authorised Signature", zh: "授权签字" },
  "sig.customerStamp":     { en: "Customer Stamp",      zh: "客户盖章" },
  "sig.customerSignature": { en: "Customer Signature",  zh: "客户签字" },
  "footer.thanks":         { en: "Thank you for choosing Koleex", zh: "感谢您选择 Koleex" },
  "footer.page":           { en: "Page",                zh: "页" },
} as const;

export type DocLabelKey = keyof typeof LABELS;

/** Resolve one template label in the document's language. English is the
 *  fallback for anything unmapped, so a missing key can never blank a
 *  printed document. */
export function docLabel(lang: DocLang | undefined, key: DocLabelKey): string {
  const entry = LABELS[key];
  if (!entry) return key;
  return (lang === "zh" ? entry.zh : entry.en) || entry.en;
}

/** Bound helper — `const L = docLabels(current.docLang)` then `L("col.qty")`. */
export function docLabels(lang: DocLang | undefined) {
  return (key: DocLabelKey) => docLabel(lang, key);
}
