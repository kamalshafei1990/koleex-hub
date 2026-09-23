import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   smart-create — strings for the global Smart Create drawer (press "c").
   Tile labels and hints, section titles, the effect chips and the footer.
   --------------------------------------------------------------------------- */

export const smartCreateT: Translations = {
  "sc.eyebrow":       { en: "Smart Create",              zh: "快速创建",               ar: "إنشاء سريع" },
  "sc.title":         { en: "What do you want to add?",  zh: "您想添加什么？",          ar: "ماذا تريد أن تضيف؟" },
  "sc.filter":        { en: "Type to filter — e.g. quotation, expense, task…",
                        zh: "输入以筛选 — 例如 报价单、费用、任务…",
                        ar: "اكتب للتصفية — مثلًا عرض سعر، مصروف، مهمة…" },
  "sc.close":         { en: "Close",                     zh: "关闭",                   ar: "إغلاق" },
  "sc.recent":        { en: "Recent",                    zh: "最近使用",               ar: "الأخيرة" },
  "sc.suggested":     { en: "Suggested here",            zh: "当前推荐",               ar: "مقترح هنا" },
  "sc.all":           { en: "Everything",                zh: "全部",                   ar: "الكل" },
  "sc.noMatch":       { en: "No match for “{q}”.",       zh: "没有与“{q}”匹配的项目。", ar: "لا توجد نتيجة لـ «{q}»." },
  "sc.nothing":       { en: "Your role can’t create anything here yet. Ask an administrator for access.",
                        zh: "您的角色暂时无法在此创建内容。请联系管理员开通权限。",
                        ar: "دورك لا يسمح بإنشاء أي شيء هنا بعد. اطلب الصلاحية من المسؤول." },
  "sc.tip":           { en: "Press {key} anywhere to open · ↑ ↓ to move · Enter to open",
                        zh: "在任意位置按 {key} 打开 · ↑ ↓ 移动 · Enter 打开",
                        ar: "اضغط {key} في أي مكان للفتح · ↑ ↓ للتنقل · Enter للفتح" },
  "sc.dataEntry":     { en: "Don’t see it? Open the Data Entry hub",
                        zh: "没有找到？打开数据录入中心",
                        ar: "لا تجده؟ افتح مركز إدخال البيانات" },
  "sc.fab":           { en: "Create",                    zh: "创建",                   ar: "إنشاء" },

  /* Effect chips — what saving the record touches. */
  "sc.fx.acc":        { en: "Accounting",                zh: "会计",                   ar: "الحسابات" },
  "sc.fx.accHint":    { en: "Posts to the books",        zh: "会记入账簿",             ar: "يُسجَّل في الدفاتر المحاسبية" },
  "sc.fx.inv":        { en: "Inventory",                 zh: "库存",                   ar: "المخزون" },
  "sc.fx.invHint":    { en: "Moves or adds stock",       zh: "会变动或增加库存",       ar: "يحرّك المخزون أو يضيف إليه" },

  /* Tiles */
  "sc.quotation":     { en: "Quotation",                 zh: "报价单",                 ar: "عرض سعر" },
  "sc.quotation.h":   { en: "Price offer to a customer", zh: "给客户的报价",           ar: "عرض أسعار لعميل" },
  "sc.invoice":       { en: "Invoice",                   zh: "发票",                   ar: "فاتورة" },
  "sc.invoice.h":     { en: "Bill a customer",           zh: "向客户开票",             ar: "فوترة عميل" },
  "sc.po":            { en: "Purchase Order",            zh: "采购订单",               ar: "أمر شراء" },
  "sc.po.h":          { en: "Buy from a supplier",       zh: "向供应商采购",           ar: "الشراء من مورد" },
  "sc.expense":       { en: "Expense",                   zh: "费用",                   ar: "مصروف" },
  "sc.expense.h":     { en: "Operating cost",            zh: "运营成本",               ar: "تكلفة تشغيل" },
  "sc.customer":      { en: "Customer",                  zh: "客户",                   ar: "عميل" },
  "sc.customer.h":    { en: "Party you sell to",         zh: "您销售的对象",           ar: "جهة تبيع لها" },
  "sc.supplier":      { en: "Supplier",                  zh: "供应商",                 ar: "مورد" },
  "sc.supplier.h":    { en: "Party you buy from",        zh: "您采购的对象",           ar: "جهة تشتري منها" },
  "sc.contact":       { en: "Contact",                   zh: "联系人",                 ar: "جهة اتصال" },
  "sc.contact.h":     { en: "Person or company",         zh: "个人或公司",             ar: "شخص أو شركة" },
  "sc.item":          { en: "Inventory Item",            zh: "库存物品",               ar: "صنف مخزون" },
  "sc.item.h":        { en: "New SKU",                   zh: "新 SKU",                 ar: "SKU جديد" },
  "sc.task":          { en: "Task",                      zh: "任务",                   ar: "مهمة" },
  "sc.task.h":        { en: "A to-do for you or the team", zh: "给自己或团队的待办",   ar: "مهمة لك أو للفريق" },
  "sc.event":         { en: "Calendar Event",            zh: "日历事件",               ar: "موعد في التقويم" },
  "sc.event.h":       { en: "Meeting or reminder",       zh: "会议或提醒",             ar: "اجتماع أو تذكير" },
  "sc.fxrate":        { en: "FX Rate",                   zh: "汇率",                   ar: "سعر صرف" },
  "sc.fxrate.h":      { en: "Currency pair",             zh: "货币对",                 ar: "زوج عملات" },
  "sc.asset":         { en: "Asset",                     zh: "资产",                   ar: "أصل" },
  "sc.asset.h":       { en: "Capital purchase",          zh: "资本性采购",             ar: "شراء رأسمالي" },
  "sc.bank":          { en: "Bank Account",              zh: "银行账户",               ar: "حساب بنكي" },
  "sc.bank.h":        { en: "Add a treasury account",    zh: "添加资金账户",           ar: "إضافة حساب خزينة" },
};
