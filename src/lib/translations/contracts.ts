import type { Translations } from "@/lib/i18n";

export const contractsT: Translations = {
  "app.title":    { en: "Contracts", zh: "销售合同", ar: "العقود" },
  "app.subtitle": { en: "Every sales contract Koleex has raised, and what state it is in",
                    zh: "科力思签出的全部销售合同及其状态",
                    ar: "كل عقود البيع اللي كوليكس عملتها، وحالة كل واحد" },

  /* ── filters. The FILTER names a bucket, the BADGE names one contract —
        reusing one label for both is how "Drafts" ends up printed on a
        single row. ── */
  "nav.all":        { en: "All contracts", zh: "全部合同", ar: "كل العقود" },
  "nav.draft":      { en: "Drafts",        zh: "草稿",     ar: "مسودات" },
  "nav.ready":      { en: "Ready",         zh: "待签署",   ar: "جاهزة للتوقيع" },
  "nav.signed":     { en: "Signed",        zh: "已签署",   ar: "موقّعة" },
  "nav.superseded": { en: "Superseded",    zh: "已被取代", ar: "متبدّلة" },
  "nav.cancelled":  { en: "Cancelled",     zh: "已取消",   ar: "ملغاة" },

  "status.draft":      { en: "Draft",      zh: "草稿",     ar: "مسودة" },
  "status.ready":      { en: "Ready",      zh: "待签署",   ar: "جاهز للتوقيع" },
  "status.signed":     { en: "Signed",     zh: "已签署",   ar: "موقّع" },
  "status.superseded": { en: "Superseded", zh: "已被取代", ar: "متبدّل" },
  "status.cancelled":  { en: "Cancelled",  zh: "已取消",   ar: "ملغي" },

  /* ── the KPI band ── */
  "kpi.contracts": { en: "Contracts",   zh: "合同",     ar: "العقود" },
  "kpi.signed":    { en: "Signed",      zh: "已签署",   ar: "الموقّعة" },
  "kpi.value":     { en: "Signed value", zh: "已签金额", ar: "قيمة الموقّع" },
  "kpi.awaiting":  { en: "Awaiting signature", zh: "待签署", ar: "مستنية توقيع" },

  "search.placeholder": { en: "Search by contract number, invoice, deal or buyer",
                          zh: "按合同号、发票号、交易号或买方搜索",
                          ar: "دوّر برقم العقد أو الفاتورة أو الصفقة أو المشتري" },

  /* ── a row ── */
  "row.invoice":    { en: "Invoice",    zh: "发票",   ar: "فاتورة" },
  "row.deal":       { en: "Deal",       zh: "交易",   ar: "صفقة" },
  "row.amendment":  { en: "Amendment",  zh: "补充协议", ar: "ملحق تعديل" },
  "row.amends":     { en: "Amends",     zh: "修订",   ar: "بيعدّل" },
  "row.signedOn":   { en: "Signed",     zh: "签署于", ar: "اتوقّع" },
  "row.raisedOn":   { en: "Raised",     zh: "创建于", ar: "اتعمل" },
  "row.unsigned":   { en: "Not signed", zh: "未签署", ar: "مش موقّع" },

  /* ── raising one ── */
  "action.new":       { en: "New contract", zh: "新建合同", ar: "عقد جديد" },
  "new.title":        { en: "Raise a contract", zh: "开立合同", ar: "اعمل عقد" },
  "new.body":         { en: "A contract is always raised from an invoice — that is where the parties, goods, incoterm and payment term already live. Pick the invoice this contract is for.",
                        zh: "合同始终由发票开立——买卖双方、货物、贸易术语与付款方式均已记录在发票上。请选择本合同对应的发票。",
                        ar: "العقد دايماً بيتعمل من فاتورة — لأن الأطراف والبضاعة والإنكوتيرم وشرط الدفع مسجّلين فيها أصلاً. اختار الفاتورة اللي العقد ده بتاعها." },
  "new.search":       { en: "Search invoices", zh: "搜索发票", ar: "دوّر في الفواتير" },
  "new.hasContract":  { en: "Has a contract", zh: "已有合同", ar: "له عقد" },
  "new.open":         { en: "Open", zh: "打开", ar: "افتح" },
  "new.none":         { en: "No invoices to contract.", zh: "没有可开立合同的发票。", ar: "مفيش فواتير أعمل عليها عقد." },
  "new.failed":       { en: "Could not raise the contract.", zh: "无法创建合同。", ar: "مقدرتش أعمل العقد." },
  "action.cancel":    { en: "Cancel", zh: "取消", ar: "إلغاء" },

  /* ── empty and error ── */
  "empty.title":  { en: "No contracts yet", zh: "暂无合同", ar: "مفيش عقود لسه" },
  "empty.body":   { en: "A contract is raised from an invoice. Open an invoice and choose Sales contract, or start one here.",
                    zh: "合同由发票开立。打开一张发票并选择“销售合同”，或从这里开始。",
                    ar: "العقد بيتعمل من فاتورة. افتح فاتورة واختار «Sales contract»، أو ابدأ واحد من هنا." },
  "empty.filtered": { en: "No contracts in this state", zh: "该状态下没有合同", ar: "مفيش عقود في الحالة دي" },
  "error.load":   { en: "Could not load contracts.", zh: "无法加载合同。", ar: "مقدرتش أحمّل العقود." },
  "action.retry": { en: "Retry", zh: "重试", ar: "حاول تاني" },
};
