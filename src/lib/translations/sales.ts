import type { Translations } from "@/lib/i18n";

export const salesT: Translations = {
  /* ── Page / Title ── */
  "sales.title":        { en: "Sales",                    zh: "销售",                  ar: "المبيعات" },
  "sales.subtitle":     { en: "Pipeline · Quotes · Orders · Invoices", zh: "管道 · 报价 · 订单 · 发票", ar: "الأنابيب · العروض · الطلبات · الفواتير" },

  /* ── Tab labels ── */
  "sales.tabDashboard": { en: "Dashboard",   zh: "仪表盘",     ar: "لوحة التحكم" },
  "sales.tabPipeline":  { en: "Pipeline",    zh: "管道",       ar: "الأنابيب" },
  "sales.tabQuotations":{ en: "Quotations",  zh: "报价",       ar: "عروض الأسعار" },
  "sales.tabOrders":    { en: "Orders",      zh: "订单",       ar: "الطلبات" },
  "sales.tabInvoices":  { en: "Invoices",    zh: "发票",       ar: "الفواتير" },
  "sales.tabCustomers": { en: "Customers",   zh: "客户",       ar: "العملاء" },
  "sales.tabActivities":{ en: "Activities",  zh: "活动",       ar: "النشاطات" },
  "sales.tabReports":   { en: "Reports",     zh: "报告",       ar: "التقارير" },

  /* ── Dashboard KPIs ── */
  "sales.kpi.pipelineValue":  { en: "Pipeline Value",   zh: "管道价值",     ar: "قيمة الأنابيب" },
  "sales.kpi.openQuotes":     { en: "Open Quotes",      zh: "未结报价",     ar: "العروض المفتوحة" },
  "sales.kpi.openOrders":     { en: "Open Orders",      zh: "未结订单",     ar: "الطلبات المفتوحة" },
  "sales.kpi.outstanding":    { en: "Outstanding",      zh: "未付款",       ar: "المستحقة" },
  "sales.kpi.revenueMTD":     { en: "Revenue MTD",      zh: "本月收入",     ar: "إيرادات الشهر" },
  "sales.kpi.activeCustomers":{ en: "Active Customers", zh: "活跃客户",     ar: "العملاء النشطون" },
  "sales.kpi.upcomingTasks":  { en: "Upcoming Tasks",   zh: "待办任务",     ar: "المهام القادمة" },
  "sales.kpi.wonThisMonth":   { en: "Won This Month",   zh: "本月赢得",     ar: "ربحت هذا الشهر" },

  /* ── Common labels ── */
  "sales.empty.noOpps":       { en: "No active opportunities yet.",  zh: "暂无活跃机会。",      ar: "لا توجد فرص نشطة بعد." },
  "sales.empty.noQuotes":     { en: "No quotations yet.",            zh: "暂无报价。",          ar: "لا توجد عروض أسعار بعد." },
  "sales.empty.noOrders":     { en: "No sales orders yet.",          zh: "暂无销售订单。",      ar: "لا توجد طلبات مبيعات بعد." },
  "sales.empty.noInvoices":   { en: "No invoices yet.",              zh: "暂无发票。",          ar: "لا توجد فواتير بعد." },
  "sales.empty.noCustomers":  { en: "No customers yet.",             zh: "暂无客户。",          ar: "لا يوجد عملاء بعد." },
  "sales.empty.noActivities": { en: "No upcoming activities.",       zh: "暂无即将进行的活动。",ar: "لا توجد نشاطات قادمة." },

  "sales.openInApp":     { en: "Open full app",     zh: "打开完整应用",  ar: "فتح التطبيق الكامل" },
  "sales.viewAll":       { en: "View all",          zh: "查看全部",      ar: "عرض الكل" },
  "sales.recent":        { en: "Recent",            zh: "最近",          ar: "الحديث" },
  "sales.topCustomers":  { en: "Top Customers",     zh: "重点客户",      ar: "أهم العملاء" },
  "sales.thisMonth":     { en: "This month",        zh: "本月",          ar: "هذا الشهر" },
  "sales.last30Days":    { en: "Last 30 days",      zh: "过去30天",      ar: "آخر 30 يومًا" },
  "sales.allTime":       { en: "All time",          zh: "全部时间",      ar: "كل الأوقات" },

  "sales.report.revenueTrend":   { en: "Revenue trend",     zh: "收入趋势",      ar: "اتجاه الإيرادات" },
  "sales.report.pipelineFunnel": { en: "Pipeline funnel",   zh: "管道漏斗",      ar: "قمع الأنابيب" },
  "sales.report.byCategory":     { en: "Sales by category", zh: "按类别销售",    ar: "المبيعات حسب الفئة" },
  "sales.report.notReady":       { en: "Reports will populate once you have invoices and orders.", zh: "一旦您有发票和订单，报告将填充。", ar: "ستظهر التقارير بمجرد أن يكون لديك فواتير وطلبات." },
};
