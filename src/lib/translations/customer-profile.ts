import type { Translations } from "@/lib/i18n";

/* Translations for the Customer Profile page (/customers/[id]).
   The page was previously English-only; every visible string is keyed here
   so it follows the app language (en / zh / ar). Storage/data values are
   untouched — this only changes what the operator sees. */
export const customerProfileT: Translations = {
  // Not-found + loading
  "notFound.title": { en: "Customer not found", zh: "未找到客户", ar: "لم يتم العثور على العميل" },
  "notFound.back": { en: "Back to customers", zh: "返回客户列表", ar: "العودة إلى العملاء" },

  // Header
  "header.title": { en: "Customer Profile", zh: "客户资料", ar: "ملف العميل" },
  "header.editInList": { en: "Edit in list", zh: "在列表中编辑", ar: "تعديل في القائمة" },
  "status.active": { en: "Active", zh: "活跃", ar: "نشط" },
  "status.inactive": { en: "Inactive", zh: "停用", ar: "غير نشط" },
  "entity.person": { en: "Person", zh: "个人", ar: "فرد" },
  "entity.company": { en: "Company", zh: "公司", ar: "شركة" },
  "title.unnamed": { en: "Unnamed customer", zh: "未命名客户", ar: "عميل بدون اسم" },

  // Commercial-record nudge
  "nudge.noCommercial": {
    en: "No matching row in the commercial customers table. Pricing, invoicing, and AI agent lookups may fall back to defaults. A match can be created by adding a row with the same email or company name.",
    zh: "商务客户表中没有匹配记录。定价、开票和 AI 查询可能会回退到默认值。可通过添加相同邮箱或公司名称的记录来建立匹配。",
    ar: "لا يوجد سجل مطابق في جدول العملاء التجاري. قد تعتمد التسعير والفوترة واستعلامات الوكيل الذكي على القيم الافتراضية. يمكن إنشاء تطابق بإضافة سجل بنفس البريد الإلكتروني أو اسم الشركة.",
  },

  // Tabs
  "tab.activity": { en: "Activity", zh: "动态", ar: "النشاط" },
  "tab.commercial": { en: "Commercial", zh: "商务", ar: "التجاري" },
  "tab.details": { en: "Details", zh: "详情", ar: "التفاصيل" },

  // Activity
  "activity.open": { en: "Open", zh: "打开", ar: "فتح" },
  "activity.total": { en: "total", zh: "条", ar: "الإجمالي" },
  "activity.nothing": { en: "Nothing yet.", zh: "暂无。", ar: "لا شيء بعد." },
  "activity.emptyTitle": { en: "No activity yet", zh: "暂无动态", ar: "لا يوجد نشاط بعد" },
  "activity.emptyHint": {
    en: "Create a quotation, invoice, or opportunity for this customer and it will show here.",
    zh: "为该客户创建报价、发票或商机后，将在此处显示。",
    ar: "أنشئ عرض سعر أو فاتورة أو فرصة لهذا العميل وستظهر هنا.",
  },
  "card.opportunities": { en: "Opportunities", zh: "商机", ar: "الفرص" },
  "card.quotations": { en: "Quotations", zh: "报价", ar: "عروض الأسعار" },
  "card.invoices": { en: "Invoices", zh: "发票", ar: "الفواتير" },
  "card.projects": { en: "Projects", zh: "项目", ar: "المشاريع" },
  "card.tasks": { en: "Open Tasks", zh: "待办任务", ar: "المهام المفتوحة" },
  "card.empty.opportunities": { en: "No open opportunities", zh: "暂无进行中的商机", ar: "لا توجد فرص مفتوحة" },
  "card.empty.quotations": { en: "No quotations issued", zh: "暂无报价", ar: "لم يتم إصدار عروض أسعار" },
  "card.empty.invoices": { en: "No invoices issued", zh: "暂无发票", ar: "لم يتم إصدار فواتير" },
  "card.empty.projects": { en: "No projects linked", zh: "暂无关联项目", ar: "لا توجد مشاريع مرتبطة" },
  "card.empty.tasks": { en: "No open tasks", zh: "暂无待办任务", ar: "لا توجد مهام مفتوحة" },

  // Commercial tab
  "sec.salesCredit": { en: "Sales & Credit", zh: "销售与信用", ar: "المبيعات والائتمان" },
  "sec.salesCredit.desc": { en: "From the Customers directory.", zh: "来自客户目录。", ar: "من دليل العملاء." },
  "sec.linked": { en: "Linked Commercial Record", zh: "关联商务记录", ar: "السجل التجاري المرتبط" },
  "sec.linked.desc": { en: "From the pricing-engine customers table.", zh: "来自定价引擎客户表。", ar: "من جدول عملاء محرك التسعير." },
  "sec.linked.none": {
    en: "No linked row found (matched by email / company name). The pricing engine will fall back to default tier rules for this customer.",
    zh: "未找到关联记录（按邮箱/公司名称匹配）。定价引擎将对该客户使用默认等级规则。",
    ar: "لم يتم العثور على سجل مرتبط (المطابقة بالبريد الإلكتروني / اسم الشركة). سيعتمد محرك التسعير على قواعد المستوى الافتراضية لهذا العميل.",
  },
  "sec.touchpoints": { en: "Touchpoints", zh: "联系记录", ar: "نقاط الاتصال" },
  "sec.touchpoints.desc": { en: "Recent and upcoming contact dates.", zh: "近期及即将进行的联系日期。", ar: "تواريخ الاتصال الأخيرة والقادمة." },
  "sec.address": { en: "Address", zh: "地址", ar: "العنوان" },
  "sec.channels": { en: "Contact Channels", zh: "联系方式", ar: "قنوات الاتصال" },
  "sec.notes": { en: "Notes", zh: "备注", ar: "ملاحظات" },
  "notes.public": { en: "Public", zh: "公开", ar: "عام" },
  "notes.internal": { en: "Internal", zh: "内部", ar: "داخلي" },

  // Field labels
  "f.tier": { en: "Tier", zh: "等级", ar: "المستوى" },
  "f.entityType": { en: "Entity type", zh: "实体类型", ar: "نوع الكيان" },
  "f.salesRep": { en: "Sales rep", zh: "销售代表", ar: "مندوب المبيعات" },
  "f.paymentTerms": { en: "Payment terms", zh: "付款条件", ar: "شروط الدفع" },
  "f.creditLimit": { en: "Credit limit", zh: "信用额度", ar: "حد الائتمان" },
  "f.creditCurrency": { en: "Credit currency", zh: "信用货币", ar: "عملة الائتمان" },
  "f.approvedBy": { en: "Approved by", zh: "批准人", ar: "تمت الموافقة بواسطة" },
  "f.approvedOn": { en: "Approved on", zh: "批准日期", ar: "تاريخ الموافقة" },
  "f.customerCode": { en: "Customer code", zh: "客户编码", ar: "رمز العميل" },
  "f.name": { en: "Name", zh: "名称", ar: "الاسم" },
  "f.pricingTier": { en: "Pricing tier", zh: "定价等级", ar: "مستوى التسعير" },
  "f.salesperson": { en: "Salesperson", zh: "销售员", ar: "البائع" },
  "f.currency": { en: "Currency", zh: "货币", ar: "العملة" },
  "f.lastContact": { en: "Last contact", zh: "最近联系", ar: "آخر اتصال" },
  "f.nextFollowup": { en: "Next follow-up", zh: "下次跟进", ar: "المتابعة القادمة" },
  "f.status": { en: "Status", zh: "状态", ar: "الحالة" },
  "f.firstContact": { en: "First contact", zh: "首次联系", ar: "أول اتصال" },
  "f.followUp": { en: "Follow-up", zh: "跟进", ar: "المتابعة" },
  "f.preferredChannel": { en: "Preferred channel", zh: "首选渠道", ar: "القناة المفضلة" },
  "f.language": { en: "Language", zh: "语言", ar: "اللغة" },
  "f.line1": { en: "Line 1", zh: "地址行 1", ar: "السطر 1" },
  "f.line2": { en: "Line 2", zh: "地址行 2", ar: "السطر 2" },
  "f.city": { en: "City", zh: "城市", ar: "المدينة" },
  "f.state": { en: "State", zh: "省/州", ar: "المنطقة" },
  "f.postal": { en: "Postal", zh: "邮编", ar: "الرمز البريدي" },
  "f.country": { en: "Country", zh: "国家", ar: "الدولة" },
  "f.email": { en: "Email", zh: "邮箱", ar: "البريد الإلكتروني" },
  "f.phone": { en: "Phone", zh: "电话", ar: "الهاتف" },
  "f.whatsapp": { en: "WhatsApp", zh: "WhatsApp", ar: "واتساب" },
  "f.whatsappBiz": { en: "WhatsApp Business", zh: "WhatsApp 商业版", ar: "واتساب للأعمال" },
  "f.wechat": { en: "WeChat", zh: "微信", ar: "ويتشات" },
  "f.telegram": { en: "Telegram", zh: "Telegram", ar: "تيليجرام" },
  "f.line": { en: "LINE", zh: "LINE", ar: "لاين" },
  "f.skype": { en: "Skype", zh: "Skype", ar: "سكايب" },

  // Tier labels
  "tier.end_user": { en: "End User", zh: "终端用户", ar: "المستخدم النهائي" },
  "tier.silver": { en: "Silver", zh: "白银", ar: "فضي" },
  "tier.gold": { en: "Gold", zh: "黄金", ar: "ذهبي" },
  "tier.platinum": { en: "Platinum", zh: "铂金", ar: "بلاتيني" },
  "tier.diamond": { en: "Diamond", zh: "钻石", ar: "ماسي" },
};
