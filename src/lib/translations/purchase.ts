import type { Translations } from "@/lib/i18n";

export const purchaseT: Translations = {
  /* ── Page / Title ── */
  "purchase.title":    { en: "Purchases",   zh: "采购",     ar: "المشتريات" },
  "purchase.subtitle": { en: "Requisitions · RFQs · Orders · Receipts · Bills · Payments", zh: "请购 · 询价 · 订单 · 收货 · 账单 · 付款", ar: "الطلبات · العروض · أوامر الشراء · الاستلامات · الفواتير · المدفوعات" },

  /* ── Group labels ── */
  "purchase.groupOverview":    { en: "Overview",    zh: "概览",  ar: "نظرة عامة" },
  "purchase.groupProcurement": { en: "Procurement", zh: "采购",  ar: "المشتريات" },
  "purchase.groupBills":       { en: "Bills",       zh: "账单",  ar: "الفواتير" },
  "purchase.groupVendors":     { en: "Vendors",     zh: "供应商",ar: "الموردون" },
  "purchase.groupSetup":       { en: "Setup",       zh: "设置",  ar: "الإعدادات" },
  "purchase.groupReports":     { en: "Reports",     zh: "报告",  ar: "التقارير" },

  /* ── Tab labels ── */
  "purchase.tabDashboard":    { en: "Dashboard",      zh: "仪表盘",      ar: "لوحة التحكم" },
  "purchase.tabRequisitions": { en: "Requisitions",   zh: "请购单",      ar: "طلبات الشراء" },
  "purchase.tabRFQs":         { en: "RFQs",           zh: "询价单",      ar: "طلبات عروض" },
  "purchase.tabOrders":       { en: "Purchase Orders",zh: "采购订单",    ar: "أوامر الشراء" },
  "purchase.tabReceipts":     { en: "Receipts",       zh: "收货",        ar: "الاستلامات" },
  "purchase.tabBills":        { en: "Vendor Bills",   zh: "供应商账单",  ar: "فواتير الموردين" },
  "purchase.tabPayments":     { en: "Payments",       zh: "付款",        ar: "المدفوعات" },
  "purchase.tabReturns":      { en: "Returns",        zh: "退货",        ar: "المرتجعات" },
  "purchase.tabSuppliers":    { en: "Suppliers",      zh: "供应商",      ar: "الموردون" },
  "purchase.tabContracts":    { en: "Contracts",      zh: "合同",        ar: "العقود" },
  "purchase.tabCategories":   { en: "Categories",     zh: "分类",        ar: "الفئات" },
  "purchase.tabPriceLists":   { en: "Price Lists",    zh: "价格表",      ar: "قوائم الأسعار" },
  "purchase.tabApprovals":    { en: "Approvals",      zh: "审批",        ar: "الموافقات" },
  "purchase.tabReports":      { en: "Reports",        zh: "报告",        ar: "التقارير" },

  /* ── Dashboard KPIs ── */
  "purchase.kpi.openOrders":      { en: "Open POs",          zh: "未结订单",   ar: "أوامر مفتوحة" },
  "purchase.kpi.spendMTD":        { en: "Spend MTD",         zh: "本月支出",   ar: "إنفاق الشهر" },
  "purchase.kpi.spendYTD":        { en: "Spend YTD",         zh: "本年支出",   ar: "إنفاق السنة" },
  "purchase.kpi.outstandingBills":{ en: "Outstanding Bills", zh: "未付账单",   ar: "فواتير مستحقة" },
  "purchase.kpi.pendingReqs":     { en: "Pending Requests",  zh: "待审请购",   ar: "طلبات معلقة" },
  "purchase.kpi.openRFQs":        { en: "Open RFQs",         zh: "进行中询价", ar: "عروض مفتوحة" },
  "purchase.kpi.activeSuppliers": { en: "Active Suppliers",  zh: "活跃供应商", ar: "موردون نشطون" },
  "purchase.kpi.overdue":         { en: "Overdue Bills",     zh: "逾期账单",   ar: "متأخرة" },

  /* ── Common labels ── */
  "purchase.openInApp":   { en: "Open full app", zh: "打开完整应用", ar: "فتح التطبيق الكامل" },
  "purchase.recent":      { en: "Recent",        zh: "最近",        ar: "الحديث" },
  "purchase.allTime":     { en: "All time",      zh: "全部时间",    ar: "كل الأوقات" },
  "purchase.thisMonth":   { en: "This month",    zh: "本月",        ar: "هذا الشهر" },

  /* ── Empty states ── */
  "purchase.empty.noReqs":      { en: "No requisitions yet. File one to start the procurement workflow.", zh: "暂无请购单。",   ar: "لا توجد طلبات شراء بعد." },
  "purchase.empty.noRFQs":      { en: "No RFQs yet. Send one to a supplier when you need a quote.",       zh: "暂无询价单。",   ar: "لا توجد طلبات عروض بعد." },
  "purchase.empty.noOrders":    { en: "No purchase orders yet.",                                            zh: "暂无采购订单。", ar: "لا توجد أوامر شراء بعد." },
  "purchase.empty.noReceipts":  { en: "No goods receipts recorded yet.",                                    zh: "暂无收货记录。", ar: "لم يتم تسجيل استلامات بعد." },
  "purchase.empty.noBills":     { en: "No vendor bills yet.",                                              zh: "暂无供应商账单。", ar: "لا توجد فواتير موردين بعد." },
  "purchase.empty.noPayments":  { en: "No payments recorded yet.",                                          zh: "暂无付款记录。", ar: "لم يتم تسجيل مدفوعات بعد." },
  "purchase.empty.noReturns":   { en: "No returns recorded yet.",                                           zh: "暂无退货记录。", ar: "لم يتم تسجيل مرتجعات بعد." },
  "purchase.empty.noSuppliers": { en: "No suppliers yet. Add one in Contacts to get started.",              zh: "暂无供应商。",   ar: "لا يوجد موردون بعد." },
  "purchase.empty.noContracts": { en: "No supplier contracts yet.",                                        zh: "暂无供应商合同。",ar: "لا توجد عقود بعد." },
  "purchase.empty.noCategories":{ en: "No spend categories defined.",                                      zh: "未定义采购分类。",ar: "لم يتم تعريف فئات." },
  "purchase.empty.noPriceLists":{ en: "No vendor price lists configured.",                                 zh: "未配置供应商价格表。", ar: "لم يتم تكوين قوائم أسعار." },
  "purchase.empty.noApprovals": { en: "No approval rules configured.",                                     zh: "未配置审批规则。",ar: "لم يتم تكوين قواعد الموافقة." },
  "purchase.empty.notReady":    { en: "Reports populate once you have orders, bills, and payments.",       zh: "数据足够后将填充报告。", ar: "ستظهر التقارير عند توفر بيانات." },
};
