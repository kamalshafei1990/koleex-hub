import type { Translations } from "@/lib/i18n";

/* Finance — the `de.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_DE: Translations = {
  /* Starting-data rows */
  "de.start.baseCurrency.label":   { en: "Main Operating Currency",                              zh: "主要经营币种",   ar: "العملة التشغيلية الرئيسية" },
  "de.start.baseCurrency.meaning": { en: "Currency your books are kept in (KOLEEX → CNY).",      zh: "您账簿使用的币种（KOLEEX → CNY）。",                ar: "العملة التي تُمسك بها دفاترك (KOLEEX → CNY)." },
  "de.start.banks.label":          { en: "Bank Accounts",                                        zh: "银行账户",      ar: "الحسابات البنكية" },
  "de.start.banks.meaning":        { en: "Every operating, savings, and foreign-currency bank account.", zh: "所有经营、储蓄和外币银行账户。",            ar: "كل حساب بنكي تشغيلي وادخاري وبالعملات الأجنبية." },
  "de.start.fx.label":             { en: "Exchange Rates",                                       zh: "汇率",          ar: "أسعار الصرف" },
  "de.start.fx.meaning":           { en: "Conversion rates between currencies (e.g. USD → CNY).",zh: "币种之间的换算率（例如 USD → CNY）。",            ar: "أسعار التحويل بين العملات (مثلاً USD → CNY)." },
  "de.start.cash.label":           { en: "Cash Accounts",                                        zh: "现金账户",      ar: "حسابات نقد" },
  "de.start.cash.meaning":         { en: "Physical cash boxes and petty-cash floats.",           zh: "实物现金箱和零用金。",                            ar: "صناديق النقد الفعلية والصرفيات النثرية." },
  "de.start.ar.label":             { en: "Money Customers Owe Us",                               zh: "客户应付我们款",  ar: "أموال يدين بها العملاء لنا" },
  "de.start.ar.meaning":           { en: "Outstanding invoices customers haven't paid yet (technical: AR).", zh: "客户尚未支付的发票（专业术语：应收账款）。",     ar: "فواتير قائمة لم يدفعها العملاء بعد (تقنيًا: AR)." },
  "de.start.ap.label":             { en: "Money We Owe Suppliers",                               zh: "我们应付供应商款", ar: "أموال نحن مدينون بها للموردين" },
  "de.start.ap.meaning":           { en: "Outstanding bills you haven't paid yet (technical: AP).", zh: "您尚未支付的账单（专业术语：应付账款）。",            ar: "فواتير لم تدفعها بعد (تقنيًا: AP)." },
  "de.start.assets.label":         { en: "Assets",                                               zh: "资产",          ar: "الأصول" },
  "de.start.assets.meaning":       { en: "Equipment, vehicles, IT, machinery — anything depreciated over time.", zh: "设备、车辆、IT、机械 — 任何会随时间折旧的资产。",  ar: "المعدات والمركبات وتقنية المعلومات والآلات — أي شيء يُستهلك مع الوقت." },
  "de.start.loans.label":          { en: "Loans & Liabilities",                                  zh: "贷款与负债",     ar: "القروض والالتزامات" },
  "de.start.loans.meaning":        { en: "Bank loans and long-term obligations.",                zh: "银行贷款及长期负债。",                            ar: "القروض البنكية والالتزامات طويلة الأجل." },
  "de.start.equity.label":         { en: "Owner Capital",                                        zh: "所有者资本",     ar: "رأس مال المالك" },
  "de.start.equity.meaning":       { en: "Money the owners invested at formation (technical: Equity).", zh: "公司成立时所有者投入的资金（专业术语：权益）。",     ar: "الأموال التي استثمرها المالكون عند التأسيس (تقنيًا: حقوق ملكية)." },

  /* Daily-entry rows */
  "de.daily.expense.label":   { en: "Record an Expense",        zh: "记录一笔费用",       ar: "تسجيل مصروف" },
  "de.daily.expense.meaning": { en: "Operating cost — rent, salaries, marketing.", zh: "经营成本 — 租金、工资、营销。", ar: "تكلفة تشغيلية — إيجار، رواتب، تسويق." },
  "de.daily.bill.label":      { en: "Record a Vendor Bill",     zh: "记录供应商账单",     ar: "تسجيل فاتورة مورد" },
  "de.daily.bill.meaning":    { en: "Bill received from a supplier (booked into AP).", zh: "从供应商收到的账单（记入应付账款）。", ar: "فاتورة مستلمة من مورد (تُسجَّل في AP)." },
  "de.daily.invoice.label":   { en: "Issue an Invoice",         zh: "开具发票",           ar: "إصدار فاتورة" },
  "de.daily.invoice.meaning": { en: "Bill sent to a customer (booked into AR).", zh: "发给客户的发票（记入应收账款）。", ar: "فاتورة مُرسلة لعميل (تُسجَّل في AR)." },
  "de.daily.payment.label":   { en: "Record a Payment",         zh: "记录付款",           ar: "تسجيل دفعة" },
  "de.daily.payment.meaning": { en: "Money in or out, linked to an invoice / bill / expense.", zh: "资金流入或流出，关联到发票 / 账单 / 费用。", ar: "دخول أو خروج أموال مرتبطة بفاتورة / فاتورة وارد / مصروف." },
  "de.daily.so.label":        { en: "New Sales Order",          zh: "新销售订单",          ar: "أمر بيع جديد" },
  "de.daily.so.meaning":      { en: "Commitment to ship to a customer.", zh: "向客户发货的承诺。", ar: "التزام بالشحن إلى عميل." },
  "de.daily.po.label":        { en: "New Purchase Order",       zh: "新采购订单",          ar: "أمر شراء جديد" },
  "de.daily.po.meaning":      { en: "Commitment to a supplier.",zh: "对供应商的承诺。",     ar: "التزام مع مورد." },
  "de.daily.customer.label":  { en: "New Customer",             zh: "新客户",             ar: "عميل جديد" },
  "de.daily.customer.meaning":{ en: "A party you sell to.",     zh: "您销售给的一方。",     ar: "طرف تبيع له." },
  "de.daily.supplier.label":  { en: "New Supplier",             zh: "新供应商",           ar: "مورد جديد" },
  "de.daily.supplier.meaning":{ en: "A party you buy from.",    zh: "您从其采购的一方。",    ar: "طرف تشتري منه." },
  "de.daily.item.label":      { en: "New Inventory Item",       zh: "新存货项目",          ar: "صنف مخزون جديد" },
  "de.daily.item.meaning":    { en: "A product or material you stock or sell.", zh: "您库存或销售的产品或材料。", ar: "منتج أو مادة تخزّنها أو تبيعها." },
  "de.daily.asset.label":     { en: "New Asset",                zh: "新资产",             ar: "أصل جديد" },
  "de.daily.asset.meaning":   { en: "A new capital purchase, depreciated over time.", zh: "新的资本采购，将随时间折旧。", ar: "اقتناء رأسمالي جديد يُستهلك مع الوقت." },
  "de.daily.newBank.label":   { en: "New Bank Account",         zh: "新银行账户",          ar: "حساب بنكي جديد" },
  "de.daily.newBank.meaning": { en: "Add a new operating / savings / FX account.", zh: "添加新的经营 / 储蓄 / 外币账户。", ar: "أضِف حسابًا تشغيليًا / ادخاريًا / بعملة أجنبية." },
  "de.daily.fx.label":        { en: "Add an Exchange Rate",     zh: "添加汇率",           ar: "إضافة سعر صرف" },
  "de.daily.fx.meaning":      { en: "Add a new rate (e.g. when USD → CNY shifts).", zh: "添加新的汇率（例如 USD → CNY 发生变动时）。", ar: "أضف سعرًا جديدًا (مثلاً عند تغيّر USD → CNY)." },
};
