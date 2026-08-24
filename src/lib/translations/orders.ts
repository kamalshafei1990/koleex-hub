import type { Translations } from "@/lib/i18n";

export const ordersT: Translations = {
  "app.title":        { en: "Orders", zh: "订单", ar: "الأوردرات" },
  "app.subtitle":     { en: "One deal, and every document raised against it",
                        zh: "一笔交易，及其全部单据",
                        ar: "صفقة واحدة، وكل المستندات الصادرة عليها" },

  /* ── filters ── */
  "nav.all":          { en: "All orders", zh: "全部订单", ar: "كل الأوردرات" },
  "nav.open":         { en: "Open",       zh: "进行中",   ar: "مفتوحة" },
  "nav.shipped":      { en: "Shipped",    zh: "已发货",   ar: "مشحونة" },
  "nav.closed":       { en: "Closed",     zh: "已完成",   ar: "مقفولة" },
  "nav.cancelled":    { en: "Cancelled",  zh: "已取消",   ar: "ملغاة" },

  /* The FILTER names a bucket; the BADGE names one order. Reusing the filter
     label as the badge is how "Drafts" ended up printed on a single row. */
  "status.open":      { en: "Open",      zh: "进行中", ar: "مفتوح" },
  "status.shipped":   { en: "Shipped",   zh: "已发货", ar: "مشحون" },
  "status.closed":    { en: "Closed",    zh: "已完成", ar: "مقفول" },
  "status.cancelled": { en: "Cancelled", zh: "已取消", ar: "ملغي" },

  "search.placeholder": { en: "Search by order number, customer or code",
                          zh: "按订单号、客户或编号搜索",
                          ar: "دوّر برقم الأوردر أو العميل أو الكود" },

  /* ── documents ── */
  "doc.quotations":   { en: "Quotations", zh: "报价单", ar: "عروض الأسعار" },
  "doc.invoices":     { en: "Invoices",   zh: "发票",   ar: "الفواتير" },
  "doc.contracts":    { en: "Contracts",  zh: "合同",   ar: "العقود" },
  "doc.none":         { en: "No documents yet", zh: "暂无单据", ar: "مفيش مستندات لسه" },

  /* ── empty and error ── */
  "empty.title":      { en: "No orders yet", zh: "暂无订单", ar: "مفيش أوردرات لسه" },
  "empty.body":       { en: "An order appears when a quotation becomes an invoice, or when a contract is raised.",
                        zh: "当报价转为发票，或开出合同时，订单会出现在这里。",
                        ar: "الأوردر بيظهر لمّا عرض السعر يتحوّل لفاتورة، أو لمّا يتعمل عقد." },
  "error.load":       { en: "Could not load orders.", zh: "无法加载订单。", ar: "مقدرتش أحمّل الأوردرات." },
  "action.retry":     { en: "Retry", zh: "重试", ar: "حاول تاني" },

  /* ── detail ── */
  "detail.customer":  { en: "Customer",  zh: "客户",   ar: "العميل" },
  "detail.value":     { en: "Order value", zh: "订单金额", ar: "قيمة الأوردر" },
  "detail.opened":    { en: "Opened",    zh: "创建于", ar: "اتفتح" },
  "detail.notes":     { en: "Notes",     zh: "备注",   ar: "ملاحظات" },
  "detail.notFound":  { en: "Order not found.", zh: "未找到该订单。", ar: "الأوردر مش موجود." },
  "detail.back":      { en: "Orders",    zh: "订单",   ar: "الأوردرات" },
};
