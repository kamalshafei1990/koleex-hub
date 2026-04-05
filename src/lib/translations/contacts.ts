import type { Translations } from "@/lib/i18n";

export const contactsT: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     PAGE-LEVEL
     ═══════════════════════════════════════════════════════════════════════════ */
  "title":                { en: "Contacts",              zh: "联系人",               ar: "جهات الاتصال" },
  "newContact":           { en: "New Contact",           zh: "新建联系人",            ar: "جهة اتصال جديدة" },
  "editContact":          { en: "Edit Contact",          zh: "编辑联系人",            ar: "تعديل جهة الاتصال" },
  "back":                 { en: "Back",                  zh: "返回",                 ar: "رجوع" },
  "hub":                  { en: "Hub",                   zh: "中心",                 ar: "المركز" },
  "searchPlaceholder":    { en: "Search contacts...",    zh: "搜索联系人...",          ar: "بحث جهات الاتصال..." },
  "noContactsFound":      { en: "No contacts found",    zh: "未找到联系人",            ar: "لم يتم العثور على جهات اتصال" },
  "selectContact":        { en: "Select a contact to view details", zh: "选择联系人以查看详情", ar: "اختر جهة اتصال لعرض التفاصيل" },
  "unnamedContact":       { en: "Unnamed Contact",       zh: "未命名联系人",           ar: "جهة اتصال بدون اسم" },

  /* ── Tab Labels ── */
  "tab.all":              { en: "All",                   zh: "全部",                 ar: "الكل" },
  "tab.customers":        { en: "Customers",             zh: "客户",                 ar: "العملاء" },
  "tab.suppliers":        { en: "Suppliers",             zh: "供应商",               ar: "الموردون" },
  "tab.companies":        { en: "Companies",             zh: "公司",                 ar: "الشركات" },
  "tab.people":           { en: "People",                zh: "人脉",                 ar: "الأشخاص" },
  "tab.employees":        { en: "Employees",             zh: "员工",                 ar: "الموظفون" },

  /* ── Buttons ── */
  "btn.save":             { en: "Save",                  zh: "保存",                 ar: "حفظ" },
  "btn.saving":           { en: "Saving...",             zh: "保存中...",             ar: "جارٍ الحفظ..." },
  "btn.cancel":           { en: "Cancel",                zh: "取消",                 ar: "إلغاء" },
  "btn.delete":           { en: "Delete",                zh: "删除",                 ar: "حذف" },
  "btn.edit":             { en: "Edit",                  zh: "编辑",                 ar: "تعديل" },
  "btn.add":              { en: "Add",                   zh: "添加",                 ar: "إضافة" },
  "btn.remove":           { en: "Remove",                zh: "移除",                 ar: "إزالة" },
  "btn.copy":             { en: "Copy",                  zh: "复制",                 ar: "نسخ" },
  "btn.copied":           { en: "Copied",                zh: "已复制",               ar: "تم النسخ" },
  "btn.preview":          { en: "Preview",               zh: "预览",                 ar: "معاينة" },
  "btn.download":         { en: "Download",              zh: "下载",                 ar: "تنزيل" },
  "btn.open":             { en: "Open",                  zh: "打开",                 ar: "فتح" },
  "btn.upload":           { en: "Upload",                zh: "上传",                 ar: "رفع" },
  "btn.change":           { en: "Change",                zh: "更改",                 ar: "تغيير" },
  "btn.retry":            { en: "I've Run the SQL — Retry", zh: "我已运行SQL — 重试", ar: "لقد قمت بتشغيل SQL — إعادة المحاولة" },
  "btn.backToHub":        { en: "Back to Hub",           zh: "返回中心",              ar: "العودة إلى المركز" },
  "btn.copyFixSql":       { en: "Copy Fix SQL",          zh: "复制修复SQL",           ar: "نسخ SQL للإصلاح" },

  /* ── Error Messages ── */
  "error.saveFailed":     { en: "Save Failed",           zh: "保存失败",              ar: "فشل الحفظ" },
  "error.updateFailed":   { en: "Failed to update contact. Check your database RLS policies.", zh: "更新联系人失败。请检查数据库RLS策略。", ar: "فشل تحديث جهة الاتصال. تحقق من سياسات RLS في قاعدة البيانات." },
  "error.createFailed":   { en: "Failed to create contact. Check your database RLS policies.", zh: "创建联系人失败。请检查数据库RLS策略。", ar: "فشل إنشاء جهة الاتصال. تحقق من سياسات RLS في قاعدة البيانات." },
  "error.unexpected":     { en: "An unexpected error occurred.", zh: "发生意外错误。", ar: "حدث خطأ غير متوقع." },
  "error.rlsHint":        { en: "This is usually caused by missing RLS policies. Copy the fix SQL and run it in Supabase Dashboard → SQL Editor.", zh: "这通常是因为缺少RLS策略。请复制修复SQL并在Supabase仪表板 → SQL编辑器中运行。", ar: "يحدث هذا عادةً بسبب سياسات RLS المفقودة. انسخ SQL للإصلاح وقم بتشغيله في لوحة تحكم Supabase → محرر SQL." },

  /* ── Setup Screen ── */
  "setup.title":          { en: "Database Setup Required", zh: "需要设置数据库", ar: "يلزم إعداد قاعدة البيانات" },
  "setup.desc":           { en: "The contacts table needs additional columns. Copy the SQL below and run it in your", zh: "联系人表需要额外的列。请复制下面的SQL并在您的", ar: "يحتاج جدول جهات الاتصال إلى أعمدة إضافية. انسخ SQL أدناه وقم بتشغيله في" },
  "setup.sqlMigration":   { en: "SQL Migration",         zh: "SQL迁移",              ar: "ترحيل SQL" },

  /* ── Delete Confirmation ── */
  "delete.title":         { en: "Delete Contact",        zh: "删除联系人",            ar: "حذف جهة الاتصال" },
  "delete.confirm":       { en: "Are you sure you want to delete", zh: "您确定要删除", ar: "هل أنت متأكد أنك تريد حذف" },
  "delete.cannotUndo":    { en: "? This cannot be undone.", zh: "？此操作无法撤销。", ar: "؟ لا يمكن التراجع عن هذا الإجراء." },

  /* ── Type Chooser Modal ── */
  "typeChooser.title":       { en: "New Contact",              zh: "新建联系人",            ar: "جهة اتصال جديدة" },
  "typeChooser.desc":        { en: "Choose the contact type",  zh: "选择联系人类型",         ar: "اختر نوع جهة الاتصال" },
  "typeChooser.customerQ":   { en: "What type of customer?",   zh: "什么类型的客户？",       ar: "ما نوع العميل؟" },
  "typeChooser.customerDesc":{ en: "Select the customer entity type", zh: "选择客户实体类型", ar: "اختر نوع كيان العميل" },
  "typeChooser.individual":  { en: "Individual",               zh: "个人",                 ar: "فرد" },
  "typeChooser.business":    { en: "Business",                 zh: "企业",                 ar: "شركة" },
  "typeChooser.individualDesc": { en: "A person you do business with", zh: "与您有业务往来的个人", ar: "شخص تتعامل معه تجارياً" },
  "typeChooser.businessDesc":   { en: "A company or organization",     zh: "公司或组织",          ar: "شركة أو مؤسسة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     CONTACT TYPES
     ═══════════════════════════════════════════════════════════════════════════ */
  "type.customer":        { en: "Customer",              zh: "客户",                 ar: "عميل" },
  "type.supplier":        { en: "Supplier",              zh: "供应商",               ar: "مورّد" },
  "type.company":         { en: "Company",               zh: "公司",                 ar: "شركة" },
  "type.people":          { en: "People",                zh: "人脉",                 ar: "شخص" },
  "type.employee":        { en: "Employee",              zh: "员工",                 ar: "موظف" },

  /* ── Entity Types ── */
  "entity.individual":    { en: "Individual",            zh: "个人",                 ar: "فرد" },
  "entity.business":      { en: "Business",              zh: "企业",                 ar: "شركة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     CUSTOMER TIERS
     ═══════════════════════════════════════════════════════════════════════════ */
  "tier.end_user":        { en: "End User",              zh: "终端用户",              ar: "مستخدم نهائي" },
  "tier.silver":          { en: "Silver",                zh: "银牌",                 ar: "فضي" },
  "tier.gold":            { en: "Gold",                  zh: "金牌",                 ar: "ذهبي" },
  "tier.platinum":        { en: "Platinum",              zh: "白金",                 ar: "بلاتيني" },
  "tier.diamond":         { en: "Diamond",               zh: "钻石",                 ar: "ماسي" },

  /* ═══════════════════════════════════════════════════════════════════════════
     TITLES / HONORIFICS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Mr.":              { en: "Mr.",                   zh: "先生",                 ar: "السيد" },
  "opt.Mrs.":             { en: "Mrs.",                  zh: "女士",                 ar: "السيدة" },
  "opt.Ms.":              { en: "Ms.",                   zh: "小姐",                 ar: "الآنسة" },
  "opt.Dr.":              { en: "Dr.",                   zh: "博士",                 ar: "دكتور" },
  "opt.Prof.":            { en: "Prof.",                 zh: "教授",                 ar: "بروفيسور" },
  "opt.Eng.":             { en: "Eng.",                  zh: "工程师",               ar: "مهندس" },
  "opt.Sheikh":           { en: "Sheikh",                zh: "谢赫",                 ar: "شيخ" },
  "opt.H.E.":             { en: "H.E.",                  zh: "阁下",                 ar: "معالي" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHONE LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.mobile":           { en: "mobile",                zh: "手机",                 ar: "جوال" },
  "opt.home":             { en: "home",                  zh: "住宅",                 ar: "منزل" },
  "opt.work":             { en: "work",                  zh: "工作",                 ar: "عمل" },
  "opt.main":             { en: "main",                  zh: "主号",                 ar: "رئيسي" },
  "opt.work fax":         { en: "work fax",              zh: "工作传真",              ar: "فاكس عمل" },
  "opt.home fax":         { en: "home fax",              zh: "住宅传真",              ar: "فاكس منزل" },
  "opt.pager":            { en: "pager",                 zh: "寻呼机",               ar: "بيجر" },
  "opt.other":            { en: "other",                 zh: "其他",                 ar: "أخرى" },

  /* ═══════════════════════════════════════════════════════════════════════════
     EMAIL LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.iCloud":           { en: "iCloud",                zh: "iCloud",               ar: "iCloud" },

  /* ═══════════════════════════════════════════════════════════════════════════
     WEBSITE LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.homepage":         { en: "homepage",              zh: "主页",                 ar: "الصفحة الرئيسية" },
  "opt.blog":             { en: "blog",                  zh: "博客",                 ar: "مدونة" },

  /* ═══════════════════════════════════════════════════════════════════════════
     ADDRESS LABELS (share opt.home, opt.work, opt.other above)
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.warehouse":        { en: "warehouse",             zh: "仓库",                 ar: "مستودع" },
  "opt.port":             { en: "port",                  zh: "港口",                 ar: "ميناء" },
  "opt.office":           { en: "office",                zh: "办公室",               ar: "مكتب" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SOCIAL PLATFORMS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.WhatsApp":         { en: "WhatsApp",              zh: "WhatsApp",             ar: "واتساب" },
  "opt.WeChat":           { en: "WeChat",                zh: "微信",                 ar: "وي تشات" },
  "opt.LinkedIn":         { en: "LinkedIn",              zh: "领英",                 ar: "لينكد إن" },
  "opt.Instagram":        { en: "Instagram",             zh: "Instagram",            ar: "إنستغرام" },
  "opt.Facebook":         { en: "Facebook",              zh: "Facebook",             ar: "فيسبوك" },
  "opt.Twitter/X":        { en: "Twitter/X",             zh: "Twitter/X",            ar: "تويتر/X" },
  "opt.Telegram":         { en: "Telegram",              zh: "Telegram",             ar: "تيليجرام" },
  "opt.Snapchat":         { en: "Snapchat",              zh: "Snapchat",             ar: "سناب شات" },
  "opt.TikTok":           { en: "TikTok",                zh: "抖音/TikTok",          ar: "تيك توك" },
  "opt.Skype":            { en: "Skype",                 zh: "Skype",                ar: "سكايب" },
  "opt.Other":            { en: "Other",                 zh: "其他",                 ar: "أخرى" },

  /* ═══════════════════════════════════════════════════════════════════════════
     RELATIONSHIPS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Parent":           { en: "Parent",                zh: "父母",                 ar: "والد/والدة" },
  "opt.Father":           { en: "Father",                zh: "父亲",                 ar: "الأب" },
  "opt.Mother":           { en: "Mother",                zh: "母亲",                 ar: "الأم" },
  "opt.Brother":          { en: "Brother",               zh: "兄弟",                 ar: "أخ" },
  "opt.Sister":           { en: "Sister",                zh: "姐妹",                 ar: "أخت" },
  "opt.Child":            { en: "Child",                 zh: "子女",                 ar: "طفل" },
  "opt.Son":              { en: "Son",                   zh: "儿子",                 ar: "ابن" },
  "opt.Daughter":         { en: "Daughter",              zh: "女儿",                 ar: "ابنة" },
  "opt.Spouse":           { en: "Spouse",                zh: "配偶",                 ar: "زوج/زوجة" },
  "opt.Friend":           { en: "Friend",                zh: "朋友",                 ar: "صديق" },
  "opt.Assistant":        { en: "Assistant",             zh: "助理",                 ar: "مساعد" },
  "opt.Manager":          { en: "Manager",               zh: "经理",                 ar: "مدير" },

  /* ═══════════════════════════════════════════════════════════════════════════
     INDUSTRIES
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Agriculture":          { en: "Agriculture",            zh: "农业",             ar: "الزراعة" },
  "opt.Automotive":           { en: "Automotive",             zh: "汽车",             ar: "السيارات" },
  "opt.Banking & Finance":    { en: "Banking & Finance",      zh: "银行与金融",        ar: "البنوك والتمويل" },
  "opt.Chemicals":            { en: "Chemicals",              zh: "化工",             ar: "الكيماويات" },
  "opt.Construction":         { en: "Construction",           zh: "建筑",             ar: "البناء" },
  "opt.Consumer Goods":       { en: "Consumer Goods",         zh: "消费品",            ar: "السلع الاستهلاكية" },
  "opt.E-Commerce":           { en: "E-Commerce",             zh: "电子商务",           ar: "التجارة الإلكترونية" },
  "opt.Education":            { en: "Education",              zh: "教育",             ar: "التعليم" },
  "opt.Electronics":          { en: "Electronics",            zh: "电子",             ar: "الإلكترونيات" },
  "opt.Energy & Utilities":   { en: "Energy & Utilities",     zh: "能源与公用事业",     ar: "الطاقة والمرافق" },
  "opt.F&B":                  { en: "F&B",                    zh: "餐饮",             ar: "الأغذية والمشروبات" },
  "opt.Fashion & Apparel":    { en: "Fashion & Apparel",      zh: "时尚与服饰",        ar: "الأزياء والملابس" },
  "opt.Healthcare":           { en: "Healthcare",             zh: "医疗保健",           ar: "الرعاية الصحية" },
  "opt.Hospitality":          { en: "Hospitality",            zh: "酒店业",            ar: "الضيافة" },
  "opt.IT & Technology":      { en: "IT & Technology",        zh: "信息技术",           ar: "تكنولوجيا المعلومات" },
  "opt.Logistics & Transport":{ en: "Logistics & Transport",  zh: "物流与运输",        ar: "الخدمات اللوجستية والنقل" },
  "opt.Manufacturing":        { en: "Manufacturing",          zh: "制造业",            ar: "التصنيع" },
  "opt.Media & Entertainment":{ en: "Media & Entertainment",  zh: "媒体与娱乐",        ar: "الإعلام والترفيه" },
  "opt.Mining":               { en: "Mining",                 zh: "矿业",             ar: "التعدين" },
  "opt.Oil & Gas":            { en: "Oil & Gas",              zh: "石油与天然气",       ar: "النفط والغاز" },
  "opt.Pharmaceuticals":      { en: "Pharmaceuticals",        zh: "制药",             ar: "الأدوية" },
  "opt.Real Estate":          { en: "Real Estate",            zh: "房地产",            ar: "العقارات" },
  "opt.Retail":               { en: "Retail",                 zh: "零售",             ar: "التجزئة" },
  "opt.Telecom":              { en: "Telecom",                zh: "电信",             ar: "الاتصالات" },

  /* ═══════════════════════════════════════════════════════════════════════════
     LEAD SOURCES
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Referral":              { en: "Referral",               zh: "推荐",             ar: "إحالة" },
  "opt.Website":               { en: "Website",                zh: "网站",             ar: "موقع إلكتروني" },
  "opt.Exhibition / Trade Show": { en: "Exhibition / Trade Show", zh: "展会/贸易展",   ar: "معرض / معرض تجاري" },
  "opt.Cold Call":             { en: "Cold Call",               zh: "冷电话",            ar: "اتصال بارد" },
  "opt.Social Media":          { en: "Social Media",            zh: "社交媒体",          ar: "وسائل التواصل الاجتماعي" },
  "opt.Email Campaign":        { en: "Email Campaign",          zh: "邮件营销",          ar: "حملة بريد إلكتروني" },
  "opt.Partner":               { en: "Partner",                 zh: "合作伙伴",          ar: "شريك" },
  "opt.Walk-in":               { en: "Walk-in",                 zh: "上门",             ar: "زيارة مباشرة" },
  "opt.Advertisement":         { en: "Advertisement",           zh: "广告",             ar: "إعلان" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PAYMENT TERMS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Prepaid":           { en: "Prepaid",              zh: "预付",                 ar: "مسبق الدفع" },
  "opt.COD":               { en: "COD",                  zh: "货到付款",              ar: "الدفع عند التسليم" },
  "opt.Net 15":            { en: "Net 15",               zh: "净15天",               ar: "صافي 15 يوم" },
  "opt.Net 30":            { en: "Net 30",               zh: "净30天",               ar: "صافي 30 يوم" },
  "opt.Net 45":            { en: "Net 45",               zh: "净45天",               ar: "صافي 45 يوم" },
  "opt.Net 60":            { en: "Net 60",               zh: "净60天",               ar: "صافي 60 يوم" },
  "opt.Net 90":            { en: "Net 90",               zh: "净90天",               ar: "صافي 90 يوم" },
  "opt.EOM":               { en: "EOM",                  zh: "月末付款",              ar: "نهاية الشهر" },
  "opt.2/10 Net 30":       { en: "2/10 Net 30",          zh: "2/10 净30天",          ar: "2/10 صافي 30" },
  "opt.CIA":               { en: "CIA",                  zh: "预付现金",              ar: "الدفع النقدي المسبق" },
  "opt.CWO":               { en: "CWO",                  zh: "订单付款",              ar: "الدفع مع الطلب" },
  "opt.Upon Receipt":      { en: "Upon Receipt",         zh: "收货付款",              ar: "عند الاستلام" },
  "opt.Custom":            { en: "Custom",               zh: "自定义",               ar: "مخصص" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SHIPPING METHODS
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Sea Freight":       { en: "Sea Freight",           zh: "海运",                 ar: "شحن بحري" },
  "opt.Air Freight":       { en: "Air Freight",           zh: "空运",                 ar: "شحن جوي" },
  "opt.Land / Truck":      { en: "Land / Truck",          zh: "陆运/卡车",             ar: "شحن بري / شاحنة" },
  "opt.Express / Courier": { en: "Express / Courier",     zh: "快递",                 ar: "بريد سريع / شحن سريع" },
  "opt.Rail":              { en: "Rail",                  zh: "铁路",                 ar: "شحن بالسكك الحديدية" },
  "opt.Multimodal":        { en: "Multimodal",            zh: "多式联运",              ar: "شحن متعدد الوسائط" },

  /* ═══════════════════════════════════════════════════════════════════════════
     INCOTERMS (international standards — keep as-is)
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.EXW":  { en: "EXW", zh: "EXW", ar: "EXW" },
  "opt.FCA":  { en: "FCA", zh: "FCA", ar: "FCA" },
  "opt.FAS":  { en: "FAS", zh: "FAS", ar: "FAS" },
  "opt.FOB":  { en: "FOB", zh: "FOB", ar: "FOB" },
  "opt.CFR":  { en: "CFR", zh: "CFR", ar: "CFR" },
  "opt.CIF":  { en: "CIF", zh: "CIF", ar: "CIF" },
  "opt.CPT":  { en: "CPT", zh: "CPT", ar: "CPT" },
  "opt.CIP":  { en: "CIP", zh: "CIP", ar: "CIP" },
  "opt.DAP":  { en: "DAP", zh: "DAP", ar: "DAP" },
  "opt.DPU":  { en: "DPU", zh: "DPU", ar: "DPU" },
  "opt.DDP":  { en: "DDP", zh: "DDP", ar: "DDP" },

  /* ═══════════════════════════════════════════════════════════════════════════
     COMMUNICATION PREFERENCES
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Phone":             { en: "Phone",                zh: "电话",                 ar: "هاتف" },
  "opt.Email":             { en: "Email",                zh: "邮件",                 ar: "بريد إلكتروني" },
  "opt.SMS":               { en: "SMS",                  zh: "短信",                 ar: "رسالة نصية" },
  "opt.In-Person":         { en: "In-Person",            zh: "面对面",               ar: "شخصياً" },
  "opt.Video Call":        { en: "Video Call",            zh: "视频通话",              ar: "مكالمة فيديو" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SUPPLIER TYPES
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Manufacturer":      { en: "Manufacturer",         zh: "制造商",               ar: "مصنّع" },
  "opt.Distributor":       { en: "Distributor",           zh: "分销商",               ar: "موزع" },
  "opt.Wholesaler":        { en: "Wholesaler",            zh: "批发商",               ar: "تاجر جملة" },
  "opt.Agent":             { en: "Agent",                 zh: "代理",                 ar: "وكيل" },
  "opt.Trading Company":   { en: "Trading Company",       zh: "贸易公司",              ar: "شركة تجارية" },
  "opt.Service Provider":  { en: "Service Provider",      zh: "服务提供商",            ar: "مزود خدمات" },
  "opt.Freelancer":        { en: "Freelancer",            zh: "自由职业者",            ar: "مستقل" },
  "opt.OEM":               { en: "OEM",                   zh: "OEM代工",              ar: "OEM" },
  "opt.ODM":               { en: "ODM",                   zh: "ODM设计代工",          ar: "ODM" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SUPPLIER SOURCES
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.Alibaba":           { en: "Alibaba",              zh: "阿里巴巴",              ar: "علي بابا" },
  "opt.Made-in-China":     { en: "Made-in-China",        zh: "中国制造网",            ar: "صنع في الصين" },
  "opt.Global Sources":    { en: "Global Sources",       zh: "环球资源",              ar: "مصادر عالمية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SAMPLE STATUSES
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.None":              { en: "None",                 zh: "无",                   ar: "لا يوجد" },
  "opt.Requested":         { en: "Requested",            zh: "已请求",               ar: "مطلوب" },
  "opt.Received":          { en: "Received",             zh: "已收到",               ar: "مستلم" },
  "opt.Approved":          { en: "Approved",             zh: "已批准",               ar: "معتمد" },
  "opt.Rejected":          { en: "Rejected",             zh: "已拒绝",               ar: "مرفوض" },

  /* ═══════════════════════════════════════════════════════════════════════════
     CERTIFICATIONS (international standards — keep as-is)
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.ISO 9001":   { en: "ISO 9001",   zh: "ISO 9001",  ar: "ISO 9001" },
  "opt.ISO 14001":  { en: "ISO 14001",  zh: "ISO 14001", ar: "ISO 14001" },
  "opt.ISO 45001":  { en: "ISO 45001",  zh: "ISO 45001", ar: "ISO 45001" },
  "opt.CE":         { en: "CE",          zh: "CE",        ar: "CE" },
  "opt.FDA":        { en: "FDA",         zh: "FDA",       ar: "FDA" },
  "opt.BSCI":       { en: "BSCI",        zh: "BSCI",     ar: "BSCI" },
  "opt.SEDEX":      { en: "SEDEX",       zh: "SEDEX",    ar: "SEDEX" },
  "opt.SA8000":     { en: "SA8000",      zh: "SA8000",   ar: "SA8000" },
  "opt.GMP":        { en: "GMP",         zh: "GMP",      ar: "GMP" },
  "opt.HACCP":      { en: "HACCP",       zh: "HACCP",    ar: "HACCP" },
  "opt.UL":         { en: "UL",          zh: "UL",       ar: "UL" },
  "opt.RoHS":       { en: "RoHS",        zh: "RoHS",     ar: "RoHS" },
  "opt.REACH":      { en: "REACH",       zh: "REACH",    ar: "REACH" },
  "opt.FSC":        { en: "FSC",         zh: "FSC",      ar: "FSC" },
  "opt.GOTS":       { en: "GOTS",        zh: "GOTS",     ar: "GOTS" },

  /* ═══════════════════════════════════════════════════════════════════════════
     LANGUAGES (keep as-is since they're proper names)
     ═══════════════════════════════════════════════════════════════════════════ */
  "opt.English":              { en: "English",              zh: "英语",               ar: "الإنجليزية" },
  "opt.Arabic":               { en: "Arabic",               zh: "阿拉伯语",            ar: "العربية" },
  "opt.Chinese (Mandarin)":   { en: "Chinese (Mandarin)",   zh: "中文（普通话）",       ar: "الصينية (الماندرين)" },
  "opt.Chinese (Cantonese)":  { en: "Chinese (Cantonese)",  zh: "中文（粤语）",         ar: "الصينية (الكانتونية)" },
  "opt.Spanish":              { en: "Spanish",              zh: "西班牙语",             ar: "الإسبانية" },
  "opt.French":               { en: "French",               zh: "法语",               ar: "الفرنسية" },
  "opt.German":               { en: "German",               zh: "德语",               ar: "الألمانية" },
  "opt.Portuguese":           { en: "Portuguese",           zh: "葡萄牙语",             ar: "البرتغالية" },
  "opt.Russian":              { en: "Russian",              zh: "俄语",               ar: "الروسية" },
  "opt.Japanese":             { en: "Japanese",             zh: "日语",               ar: "اليابانية" },
  "opt.Korean":               { en: "Korean",               zh: "韩语",               ar: "الكورية" },
  "opt.Hindi":                { en: "Hindi",                zh: "印地语",               ar: "الهندية" },
  "opt.Turkish":              { en: "Turkish",              zh: "土耳其语",             ar: "التركية" },
  "opt.Italian":              { en: "Italian",              zh: "意大利语",             ar: "الإيطالية" },
  "opt.Dutch":                { en: "Dutch",                zh: "荷兰语",               ar: "الهولندية" },
  "opt.Thai":                 { en: "Thai",                 zh: "泰语",               ar: "التايلاندية" },
  "opt.Vietnamese":           { en: "Vietnamese",           zh: "越南语",               ar: "الفيتنامية" },
  "opt.Indonesian":           { en: "Indonesian",           zh: "印尼语",               ar: "الإندونيسية" },
  "opt.Malay":                { en: "Malay",                zh: "马来语",               ar: "الماليزية" },
  "opt.Tagalog":              { en: "Tagalog",              zh: "他加禄语",             ar: "التاغالوغية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     MONTHS
     ═══════════════════════════════════════════════════════════════════════════ */
  "month.January":         { en: "January",              zh: "一月",                 ar: "يناير" },
  "month.February":        { en: "February",             zh: "二月",                 ar: "فبراير" },
  "month.March":           { en: "March",                zh: "三月",                 ar: "مارس" },
  "month.April":           { en: "April",                zh: "四月",                 ar: "أبريل" },
  "month.May":             { en: "May",                  zh: "五月",                 ar: "مايو" },
  "month.June":            { en: "June",                 zh: "六月",                 ar: "يونيو" },
  "month.July":            { en: "July",                 zh: "七月",                 ar: "يوليو" },
  "month.August":          { en: "August",               zh: "八月",                 ar: "أغسطس" },
  "month.September":       { en: "September",            zh: "九月",                 ar: "سبتمبر" },
  "month.October":         { en: "October",              zh: "十月",                 ar: "أكتوبر" },
  "month.November":        { en: "November",             zh: "十一月",               ar: "نوفمبر" },
  "month.December":        { en: "December",             zh: "十二月",               ar: "ديسمبر" },

  /* ═══════════════════════════════════════════════════════════════════════════
     FORM SECTION HEADINGS
     ═══════════════════════════════════════════════════════════════════════════ */
  "section.basicInfo":          { en: "Basic Information",          zh: "基本信息",              ar: "المعلومات الأساسية" },
  "section.phoneNumbers":       { en: "Phone Numbers",             zh: "电话号码",              ar: "أرقام الهاتف" },
  "section.emailAddresses":     { en: "Email Addresses",           zh: "邮箱地址",              ar: "عناوين البريد الإلكتروني" },
  "section.addresses":          { en: "Addresses",                 zh: "地址",                 ar: "العناوين" },
  "section.location":           { en: "Location",                  zh: "位置",                 ar: "الموقع" },
  "section.websites":           { en: "Websites",                  zh: "网站",                 ar: "المواقع الإلكترونية" },
  "section.birthday":           { en: "Birthday",                  zh: "生日",                 ar: "تاريخ الميلاد" },
  "section.socialProfiles":     { en: "Social Profiles",           zh: "社交账号",              ar: "الحسابات الاجتماعية" },
  "section.relatedPeople":      { en: "Related People",            zh: "相关人员",              ar: "الأشخاص المرتبطون" },
  "section.notes":              { en: "Notes",                     zh: "备注",                 ar: "ملاحظات" },
  "section.customFields":       { en: "Custom Fields",             zh: "自定义字段",            ar: "حقول مخصصة" },
  "section.businessCard":       { en: "Business Card",             zh: "名片",                 ar: "بطاقة العمل" },
  "section.companyInfo":        { en: "Company Info",              zh: "公司信息",              ar: "معلومات الشركة" },
  "section.companyName":        { en: "Company Name",              zh: "公司名称",              ar: "اسم الشركة" },
  "section.companyInformation": { en: "Company Information",       zh: "公司信息",              ar: "معلومات الشركة" },
  "section.contactDetails":     { en: "Contact Details",           zh: "联系方式",              ar: "تفاصيل الاتصال" },
  "section.contactPersons":     { en: "Contact Persons",           zh: "联系人",               ar: "جهات الاتصال" },
  "section.companyProfile":     { en: "Company Profile",           zh: "公司简介",              ar: "ملف الشركة" },
  "section.financialBusiness":  { en: "Financial & Business",      zh: "财务与业务",            ar: "المالية والأعمال" },
  "section.classification":     { en: "Classification & Segmentation", zh: "分类与细分",        ar: "التصنيف والتقسيم" },
  "section.relationshipActivity": { en: "Relationship & Activity", zh: "关系与活动",            ar: "العلاقات والأنشطة" },
  "section.tradeShipping":      { en: "Trade & Shipping",          zh: "贸易与运输",            ar: "التجارة والشحن" },
  "section.paymentCurrency":    { en: "Payment & Currency",        zh: "付款与货币",            ar: "الدفع والعملة" },
  "section.bankAccounts":       { en: "Bank Accounts",             zh: "银行账户",              ar: "الحسابات المصرفية" },
  "section.bankAccountInfo":    { en: "Bank Account Information",  zh: "银行账户信息",           ar: "معلومات الحساب المصرفي" },
  "section.catalogue":          { en: "Catalogue",                 zh: "目录",                 ar: "الكتالوج" },
  "section.documents":          { en: "Documents",                 zh: "文件",                 ar: "المستندات" },
  "section.documentsAttachments": { en: "Documents & Attachments", zh: "文件与附件",            ar: "المستندات والمرفقات" },
  "section.qualityPerformance": { en: "Quality & Performance",     zh: "质量与绩效",            ar: "الجودة والأداء" },
  "section.products":           { en: "Products",                  zh: "产品",                 ar: "المنتجات" },
  "section.customerType":       { en: "Customer Type",             zh: "客户类型",              ar: "نوع العميل" },
  /* ── Employee Sections ── */
  "section.workContact":        { en: "Work Contact",              zh: "工作联系方式",           ar: "جهة اتصال العمل" },
  "section.work":               { en: "Work",                      zh: "工作",                 ar: "العمل" },
  "section.workLocation":       { en: "Work Location",             zh: "工作地点",              ar: "موقع العمل" },
  "section.resume":             { en: "Resume",                    zh: "简历",                 ar: "السيرة الذاتية" },
  "section.personalInfo":       { en: "Personal Information",      zh: "个人信息",              ar: "المعلومات الشخصية" },
  "section.emergencyContact":   { en: "Emergency Contact",         zh: "紧急联系人",            ar: "جهة اتصال الطوارئ" },
  "section.visaWorkPermit":     { en: "Visa & Work Permit",        zh: "签证与工作许可",         ar: "التأشيرة وتصريح العمل" },
  "section.citizenship":        { en: "Citizenship",               zh: "国籍",                 ar: "الجنسية" },
  "section.privateLocation":    { en: "Private Location",          zh: "私人地址",              ar: "الموقع الخاص" },
  "section.privateContact":     { en: "Private Contact",           zh: "私人联系方式",           ar: "جهة اتصال خاصة" },
  "section.family":             { en: "Family",                    zh: "家庭",                 ar: "العائلة" },
  "section.education":          { en: "Education",                 zh: "教育",                 ar: "التعليم" },

  /* ═══════════════════════════════════════════════════════════════════════════
     FORM FIELD LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "field.title":                { en: "Title",                     zh: "称谓",                 ar: "اللقب" },
  "field.firstName":            { en: "First Name",                zh: "名",                   ar: "الاسم الأول" },
  "field.middleName":           { en: "Middle Name",               zh: "中间名",               ar: "الاسم الأوسط" },
  "field.lastName":             { en: "Last Name / Family Name",   zh: "姓氏",                 ar: "اسم العائلة" },
  "field.company":              { en: "Company",                   zh: "公司",                 ar: "الشركة" },
  "field.companyName":          { en: "Company Name",              zh: "公司名称",              ar: "اسم الشركة" },
  "field.position":             { en: "Position",                  zh: "职位",                 ar: "المنصب" },
  "field.phoneNumber":          { en: "Phone number",              zh: "电话号码",              ar: "رقم الهاتف" },
  "field.emailAddress":         { en: "Email address",             zh: "邮箱地址",              ar: "عنوان البريد الإلكتروني" },
  "field.street":               { en: "Street",                    zh: "街道",                 ar: "الشارع" },
  "field.city":                 { en: "City",                      zh: "城市",                 ar: "المدينة" },
  "field.state":                { en: "State",                     zh: "州/省",                ar: "الولاية" },
  "field.zipCode":              { en: "ZIP Code",                  zh: "邮编",                 ar: "الرمز البريدي" },
  "field.country":              { en: "Country",                   zh: "国家",                 ar: "الدولة" },
  "field.provinceState":        { en: "Province / State",          zh: "省/州",                ar: "المحافظة / الولاية" },
  "field.searchCountry":        { en: "Search country...",         zh: "搜索国家...",            ar: "بحث عن الدولة..." },
  "field.searchProvince":       { en: "Search province...",        zh: "搜索省份...",            ar: "بحث عن المحافظة..." },
  "field.searchCity":           { en: "Search city...",            zh: "搜索城市...",            ar: "بحث عن المدينة..." },
  "field.day":                  { en: "Day",                       zh: "日",                   ar: "اليوم" },
  "field.month":                { en: "Month",                     zh: "月",                   ar: "الشهر" },
  "field.year":                 { en: "Year",                      zh: "年",                   ar: "السنة" },
  "field.industry":             { en: "Industry",                  zh: "行业",                 ar: "الصناعة" },
  "field.source":               { en: "Source",                    zh: "来源",                 ar: "المصدر" },
  "field.taxId":                { en: "Tax ID / Registration No.", zh: "税号/注册号",            ar: "الرقم الضريبي / رقم التسجيل" },
  "field.taxIdImport":          { en: "Tax ID / Import License",   zh: "税号/进口许可证",        ar: "الرقم الضريبي / رخصة الاستيراد" },
  "field.language":             { en: "Language",                  zh: "语言",                 ar: "اللغة" },
  "field.totalRevenue":         { en: "Total Revenue",             zh: "总收入",               ar: "إجمالي الإيرادات" },
  "field.lastOrderDate":        { en: "Last Order Date",           zh: "最后订单日期",           ar: "تاريخ آخر طلب" },
  "field.paymentTerms":         { en: "Payment Terms",             zh: "付款条款",              ar: "شروط الدفع" },
  "field.creditLimit":          { en: "Credit Limit",              zh: "信用额度",              ar: "الحد الائتماني" },
  "field.outstandingBalance":   { en: "Outstanding Balance",       zh: "未结余额",              ar: "الرصيد المستحق" },
  "field.currency":             { en: "Currency",                  zh: "货币",                 ar: "العملة" },
  "field.bankName":             { en: "Bank Name",                 zh: "银行名称",              ar: "اسم البنك" },
  "field.accountName":          { en: "Account Name",              zh: "账户名称",              ar: "اسم الحساب" },
  "field.accountNumber":        { en: "Account Number",            zh: "账户号码",              ar: "رقم الحساب" },
  "field.iban":                 { en: "IBAN",                      zh: "IBAN",                 ar: "IBAN" },
  "field.swiftCode":            { en: "SWIFT / BIC Code",          zh: "SWIFT / BIC 代码",     ar: "رمز SWIFT / BIC" },
  "field.branch":               { en: "Branch",                    zh: "支行",                 ar: "الفرع" },
  "field.incoterms":            { en: "Incoterms",                 zh: "国际贸易术语",           ar: "شروط التجارة الدولية" },
  "field.shippingMethod":       { en: "Shipping Method",           zh: "运输方式",              ar: "طريقة الشحن" },
  "field.shippingAddress":      { en: "Shipping Address",          zh: "发货地址",              ar: "عنوان الشحن" },
  "field.shippingAddresses":    { en: "Shipping Addresses",        zh: "发货地址",              ar: "عناوين الشحن" },
  "field.supplierType":         { en: "Supplier Type",             zh: "供应商类型",            ar: "نوع المورّد" },
  "field.supplierSource":       { en: "Source",                    zh: "来源",                 ar: "المصدر" },
  "field.contactEmail":         { en: "Email",                     zh: "邮箱",                 ar: "البريد الإلكتروني" },
  "field.contactTel":           { en: "Tel",                       zh: "座机",                 ar: "الهاتف" },
  "field.contactMobile":        { en: "Mobile",                    zh: "手机",                 ar: "الجوال" },
  "field.website":              { en: "Website",                   zh: "网站",                 ar: "الموقع الإلكتروني" },
  "field.supplierAddress":      { en: "Address",                   zh: "地址",                 ar: "العنوان" },
  "field.division":             { en: "Division",                  zh: "事业部",               ar: "القسم" },
  "field.category":             { en: "Category",                  zh: "类别",                 ar: "الفئة" },
  "field.certifications":       { en: "Certifications",            zh: "认证",                 ar: "الشهادات" },
  "field.sampleStatus":         { en: "Sample Status",             zh: "样品状态",              ar: "حالة العينة" },
  "field.qualityObs":           { en: "Quality Notes",             zh: "质量备注",              ar: "ملاحظات الجودة" },
  "field.reliabilityScore":     { en: "Reliability Score (%)",     zh: "可靠性评分 (%)",         ar: "درجة الموثوقية (%)" },
  "field.lastQualityIssueDate": { en: "Last Quality Issue",        zh: "最后质量问题",           ar: "آخر مشكلة جودة" },
  "field.factoryVisitDate":     { en: "Factory Visit Date",        zh: "工厂验厂日期",           ar: "تاريخ زيارة المصنع" },
  "field.productCategories":    { en: "Product Categories",        zh: "产品类别",              ar: "فئات المنتجات" },
  "field.brandNames":           { en: "Brand Names",               zh: "品牌名称",              ar: "أسماء العلامات التجارية" },
  "field.brand":                { en: "Brand",                     zh: "品牌",                 ar: "العلامة التجارية" },
  "field.moq":                  { en: "MOQ (Minimum Order Quantity)", zh: "最低起订量 (MOQ)",    ar: "الحد الأدنى للطلب (MOQ)" },
  "field.leadTime":             { en: "Lead Time",                 zh: "交货期",               ar: "وقت التسليم" },
  "field.totalPurchases":       { en: "Total Purchases",           zh: "总采购额",              ar: "إجمالي المشتريات" },
  "field.originCountry":        { en: "Origin Country",            zh: "原产国",               ar: "بلد المنشأ" },
  "field.rating":               { en: "Rating",                    zh: "评分",                 ar: "التقييم" },
  "field.companyNameEn":        { en: "Company Name in English",   zh: "公司英文名称",           ar: "اسم الشركة بالإنجليزية" },
  "field.companyNameCn":        { en: "Company Name in Chinese",   zh: "公司中文名称",           ar: "اسم الشركة بالصينية" },
  "field.additionalNames":      { en: "Additional Company Names",  zh: "其他公司名称",           ar: "أسماء الشركة الإضافية" },
  "field.otherNames":           { en: "Other Names",               zh: "其他名称",              ar: "أسماء أخرى" },
  "field.paymentInfo":          { en: "Payment Information",       zh: "付款信息",              ar: "معلومات الدفع" },
  "field.accountManager":       { en: "Account Manager",           zh: "客户经理",              ar: "مدير الحساب" },
  "field.tags":                 { en: "Tags",                      zh: "标签",                 ar: "العلامات" },
  "field.communication":        { en: "Communication",             zh: "沟通方式",              ar: "التواصل" },
  "field.firstContact":         { en: "First Contact",             zh: "首次联系",              ar: "أول اتصال" },
  "field.lastContacted":        { en: "Last Contacted",            zh: "最后联系",              ar: "آخر اتصال" },
  "field.followUpDate":         { en: "Follow-up Date",            zh: "跟进日期",              ar: "تاريخ المتابعة" },
  "field.prefers":              { en: "Prefers",                   zh: "偏好",                 ar: "يفضل" },
  /* ── Employee Fields ── */
  "field.department":           { en: "Department",                zh: "部门",                 ar: "القسم" },
  "field.jobPosition":          { en: "Job Position",              zh: "职位",                 ar: "المسمى الوظيفي" },
  "field.jobTitle":             { en: "Job Title",                 zh: "职称",                 ar: "المسمى المهني" },
  "field.managementLevel":      { en: "Management",                zh: "管理层级",              ar: "مستوى الإدارة" },
  "field.directManager":        { en: "Manager",                   zh: "直属经理",              ar: "المدير المباشر" },
  "field.workTel":              { en: "Work Tel",                  zh: "工作电话",              ar: "هاتف العمل" },
  "field.workMobile":           { en: "Work Mobile",               zh: "工作手机",              ar: "جوال العمل" },
  "field.workEmail":            { en: "Work Email",                zh: "工作邮箱",              ar: "بريد العمل" },
  "field.workAddress":          { en: "Work Address",              zh: "工作地址",              ar: "عنوان العمل" },
  "field.workLocationLabel":    { en: "Work Location",             zh: "工作地点",              ar: "موقع العمل" },
  "field.legalName":            { en: "Legal Name",                zh: "法定姓名",              ar: "الاسم القانوني" },
  "field.placeOfBirth":         { en: "Place of Birth",            zh: "出生地",               ar: "مكان الميلاد" },
  "field.gender":               { en: "Gender",                    zh: "性别",                 ar: "الجنس" },
  "field.maritalStatus":        { en: "Marital Status",            zh: "婚姻状况",              ar: "الحالة الاجتماعية" },
  "field.numberOfChildren":     { en: "Number of Children",        zh: "子女数量",              ar: "عدد الأطفال" },
  "field.nationalIdNumber":     { en: "ID No.",                    zh: "身份证号",              ar: "رقم الهوية" },
  "field.ssn":                  { en: "SSN No.",                   zh: "社保号",               ar: "رقم الضمان الاجتماعي" },
  "field.passportNo":           { en: "Passport No.",              zh: "护照号",               ar: "رقم جواز السفر" },
  "field.visaNo":               { en: "Visa No.",                  zh: "签证号",               ar: "رقم التأشيرة" },
  "field.workPermit":           { en: "Work Permit",               zh: "工作许可",              ar: "تصريح العمل" },
  "field.nationality":          { en: "Nationality",               zh: "国籍",                 ar: "الجنسية" },
  "field.nationalityCountry":   { en: "Nationality (Country)",     zh: "国籍（国家）",           ar: "الجنسية (الدولة)" },
  "field.privateAddress":       { en: "Private Address",           zh: "私人地址",              ar: "العنوان الخاص" },
  "field.homeWorkDistance":     { en: "Home-Work Distance",        zh: "住所到公司距离",         ar: "المسافة بين المنزل والعمل" },
  "field.distanceToWork":       { en: "Distance",                  zh: "距离",                 ar: "المسافة" },
  "field.certificateLevel":     { en: "Certificate Level",         zh: "学历等级",              ar: "مستوى الشهادة" },
  "field.fieldOfStudy":         { en: "Field of Study",            zh: "专业",                 ar: "مجال الدراسة" },
  "field.privateEmail":         { en: "Email",                     zh: "邮箱",                 ar: "البريد الإلكتروني" },
  "field.privatePhone":         { en: "Phone",                     zh: "电话",                 ar: "الهاتف" },
  "field.bankAccount":          { en: "Bank Account",              zh: "银行账户",              ar: "الحساب المصرفي" },
  "field.contactName":          { en: "Contact name",              zh: "联系人姓名",            ar: "اسم جهة الاتصال" },
  "field.documents":            { en: "Documents",                 zh: "文件",                 ar: "المستندات" },

  /* ── Social Profile Fields ── */
  "field.platform":             { en: "Platform",                  zh: "平台",                 ar: "المنصة" },
  "field.username":             { en: "Username / Handle",         zh: "用户名",               ar: "اسم المستخدم" },
  "field.profileUrl":           { en: "Profile URL",               zh: "个人主页链接",           ar: "رابط الملف الشخصي" },
  "field.qrCode":               { en: "QR Code",                   zh: "二维码",               ar: "رمز QR" },

  /* ── Related Person Fields ── */
  "field.name":                 { en: "Name",                      zh: "姓名",                 ar: "الاسم" },
  "field.relationship":         { en: "Relationship",              zh: "关系",                 ar: "العلاقة" },
  "field.notes":                { en: "Notes",                     zh: "备注",                 ar: "ملاحظات" },
  "field.email":                { en: "Email",                     zh: "邮箱",                 ar: "البريد الإلكتروني" },
  "field.phone":                { en: "Phone",                     zh: "电话",                 ar: "الهاتف" },
  "field.lastNameField":        { en: "Last Name",                 zh: "姓氏",                 ar: "الاسم الأخير" },

  /* ── Resume Fields ── */
  "field.resumeTitle":          { en: "Title",                     zh: "标题",                 ar: "العنوان" },
  "field.startDate":            { en: "Start Date",                zh: "开始日期",              ar: "تاريخ البدء" },
  "field.endDate":              { en: "End Date",                  zh: "结束日期",              ar: "تاريخ الانتهاء" },
  "field.currentlyOngoing":     { en: "Currently ongoing / No end date", zh: "正在进行中/无结束日期", ar: "مستمر حالياً / بدون تاريخ انتهاء" },
  "field.courseType":            { en: "Course Type",               zh: "课程类型",              ar: "نوع الدورة" },
  "field.external":             { en: "External",                  zh: "外部",                 ar: "خارجي" },
  "field.onsite":               { en: "Onsite",                    zh: "现场",                 ar: "في الموقع" },
  "field.externalUrl":          { en: "External URL",              zh: "外部链接",              ar: "رابط خارجي" },
  "field.certificate":          { en: "Certificate",               zh: "证书",                 ar: "الشهادة" },
  "field.uploadCertificate":    { en: "Upload certificate",        zh: "上传证书",              ar: "رفع الشهادة" },

  /* ── Resume Line Types ── */
  "resumeType.experience":      { en: "Experience",                zh: "经验",                 ar: "الخبرة" },
  "resumeType.education":       { en: "Education",                 zh: "教育",                 ar: "التعليم" },
  "resumeType.training":        { en: "Training",                  zh: "培训",                 ar: "التدريب" },
  "resumeType.certification":   { en: "Certification",             zh: "认证",                 ar: "الشهادة" },
  "resumeType.internalCert":    { en: "Internal Certification",    zh: "内部认证",              ar: "شهادة داخلية" },

  /* ── Gender Options ── */
  "opt.male":               { en: "Male",                  zh: "男",                   ar: "ذكر" },
  "opt.female":             { en: "Female",                zh: "女",                   ar: "أنثى" },

  /* ── Marital Status Options ── */
  "opt.single":             { en: "Single",                zh: "未婚",                 ar: "أعزب" },
  "opt.married":            { en: "Married",               zh: "已婚",                 ar: "متزوج" },
  "opt.divorced":           { en: "Divorced",              zh: "离异",                 ar: "مطلق" },
  "opt.widowed":            { en: "Widowed",               zh: "丧偶",                 ar: "أرمل" },

  /* ── Certificate Level Options ── */
  "opt.high_school":        { en: "High School",           zh: "高中",                 ar: "ثانوية" },
  "opt.diploma":            { en: "Diploma",               zh: "大专",                 ar: "دبلوم" },
  "opt.bachelor":           { en: "Bachelor's Degree",     zh: "学士学位",              ar: "بكالوريوس" },
  "opt.master":             { en: "Master's Degree",       zh: "硕士学位",              ar: "ماجستير" },
  "opt.doctorate":          { en: "Doctorate / PhD",       zh: "博士学位",              ar: "دكتوراه" },

  /* ═══════════════════════════════════════════════════════════════════════════
     ADD-ITEM BUTTON LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "add.phone":             { en: "add phone",             zh: "添加电话",              ar: "إضافة هاتف" },
  "add.email":             { en: "add email",             zh: "添加邮箱",              ar: "إضافة بريد إلكتروني" },
  "add.address":           { en: "add address",           zh: "添加地址",              ar: "إضافة عنوان" },
  "add.website":           { en: "add website",           zh: "添加网站",              ar: "إضافة موقع إلكتروني" },
  "add.socialProfile":     { en: "add social profile",    zh: "添加社交账号",           ar: "إضافة حساب اجتماعي" },
  "add.relatedPerson":     { en: "add related person",    zh: "添加相关人员",           ar: "إضافة شخص مرتبط" },
  "add.contactPerson":     { en: "add contact person",    zh: "添加联系人",            ar: "إضافة جهة اتصال" },
  "add.companyName":       { en: "add company name",      zh: "添加公司名称",           ar: "إضافة اسم شركة" },
  "add.field":             { en: "add field",             zh: "添加字段",              ar: "إضافة حقل" },
  "add.document":          { en: "add document",          zh: "添加文件",              ar: "إضافة مستند" },
  "add.bankAccount":       { en: "add bank account",      zh: "添加银行账户",           ar: "إضافة حساب مصرفي" },
  "add.shippingAddress":   { en: "add shipping address",  zh: "添加发货地址",           ar: "إضافة عنوان شحن" },
  "add.emergencyContact":  { en: "add emergency contact", zh: "添加紧急联系人",         ar: "إضافة جهة اتصال طوارئ" },
  "add.tag":               { en: "Add tag...",            zh: "添加标签...",            ar: "إضافة علامة..." },
  "add.brand":             { en: "Add brand...",          zh: "添加品牌...",            ar: "إضافة علامة تجارية..." },
  "add.certification":     { en: "Add certification...",  zh: "添加认证...",            ar: "إضافة شهادة..." },

  /* ═══════════════════════════════════════════════════════════════════════════
     KPI / DASHBOARD LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "kpi.total":             { en: "Total",                 zh: "总数",                 ar: "الإجمالي" },
  "kpi.active":            { en: "Active",                zh: "活跃",                 ar: "نشط" },
  "kpi.inactive":          { en: "Inactive",              zh: "不活跃",               ar: "غير نشط" },
  "kpi.countries":         { en: "Countries",             zh: "国家",                 ar: "الدول" },
  "kpi.vip":               { en: "VIP",                   zh: "VIP",                  ar: "VIP" },
  "kpi.new":               { en: "New",                   zh: "新增",                 ar: "جديد" },
  "kpi.avgRating":         { en: "Avg Rating",            zh: "平均评分",              ar: "متوسط التقييم" },
  "kpi.catalogues":        { en: "Catalogues",            zh: "目录",                 ar: "الكتالوجات" },
  "kpi.contacts":          { en: "Contacts",              zh: "联系人",               ar: "جهات الاتصال" },
  "kpi.divisions":         { en: "Divisions",             zh: "事业部",               ar: "الأقسام" },
  "kpi.categories":        { en: "Categories",            zh: "类别",                 ar: "الفئات" },
  "kpi.customerTiers":     { en: "Customer Tiers",        zh: "客户等级",              ar: "مستويات العملاء" },
  "kpi.overview":          { en: "Overview",              zh: "概览",                 ar: "نظرة عامة" },
  "kpi.keyMetrics":        { en: "Key metrics and insights", zh: "关键指标和洞察",      ar: "المقاييس والرؤى الرئيسية" },
  "kpi.ofTotal":           { en: "of total",              zh: "占总数",               ar: "من الإجمالي" },
  "kpi.allSuppliers":      { en: "All suppliers",         zh: "所有供应商",            ar: "جميع الموردين" },
  "kpi.allCustomers":      { en: "All customers",         zh: "所有客户",              ar: "جميع العملاء" },
  "kpi.sourceCountries":   { en: "Source countries",      zh: "来源国家",              ar: "دول المصدر" },
  "kpi.globalReach":       { en: "Global reach",          zh: "全球覆盖",              ar: "الانتشار العالمي" },
  "kpi.rated":             { en: "rated",                 zh: "已评分",               ar: "مُقيّم" },
  "kpi.diamondPlatinum":   { en: "Diamond & Platinum",    zh: "钻石和白金",            ar: "الماسي والبلاتيني" },
  "kpi.suppliersCatalogues":  { en: "Suppliers with catalogues", zh: "有目录的供应商",   ar: "الموردون مع كتالوجات" },
  "kpi.withContactPersons":   { en: "With contact persons",     zh: "有联系人",         ar: "مع جهات اتصال" },
  "kpi.productDivisions":     { en: "Product divisions",        zh: "产品事业部",       ar: "أقسام المنتجات" },
  "kpi.productCategories":    { en: "Product categories",       zh: "产品类别",         ar: "فئات المنتجات" },
  "kpi.addedThisMonth":       { en: "Added this month",         zh: "本月新增",         ar: "أُضيف هذا الشهر" },
  "kpi.newSuppliersMonth":    { en: "New suppliers this month", zh: "本月新供应商",      ar: "موردون جدد هذا الشهر" },
  "kpi.newCustomersMonth":    { en: "New customers this month", zh: "本月新客户",       ar: "عملاء جدد هذا الشهر" },
  "kpi.selectSupplier":       { en: "Select a supplier from the list to view details", zh: "从列表中选择供应商以查看详情", ar: "اختر مورداً من القائمة لعرض التفاصيل" },
  "kpi.selectCustomer":       { en: "Select a customer from the list to view details", zh: "从列表中选择客户以查看详情", ar: "اختر عميلاً من القائمة لعرض التفاصيل" },

  /* ═══════════════════════════════════════════════════════════════════════════
     DETAIL VIEW LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "detail.phone":           { en: "Phone",                zh: "电话",                 ar: "الهاتف" },
  "detail.email":           { en: "Email",                zh: "邮箱",                 ar: "البريد الإلكتروني" },
  "detail.address":         { en: "Address",              zh: "地址",                 ar: "العنوان" },
  "detail.website":         { en: "Website",              zh: "网站",                 ar: "الموقع الإلكتروني" },
  "detail.tel":             { en: "Tel",                  zh: "座机",                 ar: "الهاتف" },
  "detail.mobile":          { en: "Mobile",               zh: "手机",                 ar: "الجوال" },
  "detail.front":           { en: "Front",                zh: "正面",                 ar: "الأمام" },
  "detail.back":            { en: "Back",                 zh: "背面",                 ar: "الخلف" },
  "detail.english":         { en: "English",              zh: "英文",                 ar: "الإنجليزية" },
  "detail.chinese":         { en: "Chinese",              zh: "中文",                 ar: "الصينية" },
  "detail.brands":          { en: "Brands",               zh: "品牌",                 ar: "العلامات التجارية" },
  "detail.reliability":     { en: "Reliability",          zh: "可靠性",               ar: "الموثوقية" },
  "detail.qualityNotes":    { en: "Quality Notes",        zh: "质量备注",              ar: "ملاحظات الجودة" },
  "detail.present":         { en: "Present",              zh: "至今",                 ar: "حتى الآن" },
  "detail.type":            { en: "Type",                 zh: "类型",                 ar: "النوع" },
  "detail.activeCustomer":  { en: "Active Customer",      zh: "活跃客户",              ar: "عميل نشط" },
  "detail.outstanding":     { en: "Outstanding",          zh: "未结",                 ar: "مستحق" },
  "detail.creditLimit":     { en: "Credit Limit",         zh: "信用额度",              ar: "الحد الائتماني" },
  "detail.lastOrder":       { en: "Last Order",           zh: "最后订单",              ar: "آخر طلب" },
  "detail.firstContactLabel": { en: "First Contact",      zh: "首次联系",              ar: "أول اتصال" },
  "detail.lastContactedLabel": { en: "Last Contacted",    zh: "最后联系",              ar: "آخر اتصال" },
  "detail.followUpLabel":   { en: "Follow-up Date",       zh: "跟进日期",              ar: "تاريخ المتابعة" },
  "detail.shippingMethodLabel": { en: "Shipping Method",  zh: "运输方式",              ar: "طريقة الشحن" },
  "detail.productsPlaceholder": { en: "Products linked to this supplier will appear here when created in the Products module.", zh: "在产品模块中创建后，与此供应商关联的产品将显示在这里。", ar: "ستظهر المنتجات المرتبطة بهذا المورّد هنا عند إنشائها في وحدة المنتجات." },
  "detail.noCountries":     { en: "No countries found",   zh: "未找到国家",            ar: "لم يتم العثور على دول" },
  "detail.noProvinces":     { en: "No provinces found",   zh: "未找到省份",            ar: "لم يتم العثور على محافظات" },
  "detail.noCities":        { en: "No cities found",      zh: "未找到城市",            ar: "لم يتم العثور على مدن" },
  "detail.select":          { en: "Select...",            zh: "选择...",              ar: "اختر..." },
  "detail.birthday":         { en: "Birthday",             zh: "生日",                 ar: "تاريخ الميلاد" },
  "detail.children":         { en: "Children",             zh: "子女",                 ar: "الأطفال" },
  "detail.distance":         { en: "Distance",             zh: "距离",                 ar: "المسافة" },
  "detail.idNo":             { en: "ID No.",               zh: "身份证号",              ar: "رقم الهوية" },
  "detail.ssnNo":            { en: "SSN No.",              zh: "社保号",               ar: "رقم الضمان" },

  /* ═══════════════════════════════════════════════════════════════════════════
     PHOTO / LOGO LABELS
     ═══════════════════════════════════════════════════════════════════════════ */
  "photo.addPhoto":        { en: "Add Photo",             zh: "添加照片",              ar: "إضافة صورة" },
  "photo.addLogo":         { en: "Add Logo",              zh: "添加Logo",             ar: "إضافة شعار" },
  "photo.changePhoto":     { en: "Change Photo",          zh: "更换照片",              ar: "تغيير الصورة" },
  "photo.changeLogo":      { en: "Change Logo",           zh: "更换Logo",             ar: "تغيير الشعار" },
  "photo.uploadFront":     { en: "Upload Front",          zh: "上传正面",              ar: "رفع الأمام" },
  "photo.uploadBack":      { en: "Upload Back",           zh: "上传背面",              ar: "رفع الخلف" },
  "photo.uploadQr":        { en: "Upload QR",             zh: "上传二维码",            ar: "رفع رمز QR" },
  "photo.uploadCatalogue": { en: "Upload catalogue (PDF or image)", zh: "上传目录（PDF或图片）", ar: "رفع الكتالوج (PDF أو صورة)" },
  "photo.uploadDocument":  { en: "Upload document (contract, license, ID...)", zh: "上传文件（合同、许可证、身份证...）", ar: "رفع مستند (عقد، رخصة، هوية...)" },
  "photo.uploadDoc":       { en: "Upload document",        zh: "上传文件",              ar: "رفع مستند" },

  /* ═══════════════════════════════════════════════════════════════════════════
     MISC / PLACEHOLDERS
     ═══════════════════════════════════════════════════════════════════════════ */
  "placeholder.acme":      { en: "e.g. Acme Corporation",      zh: "例如：华为科技有限公司",      ar: "مثال: شركة أكمي" },
  "placeholder.technology": { en: "e.g. Technology",             zh: "例如：科技",                ar: "مثال: التكنولوجيا" },
  "placeholder.techMfg":   { en: "e.g. Technology, Manufacturing, Retail", zh: "例如：科技、制造、零售", ar: "مثال: التكنولوجيا، التصنيع، التجزئة" },
  "placeholder.referral":  { en: "e.g. Referral, Website",      zh: "例如：推荐、网站",           ar: "مثال: إحالة، موقع إلكتروني" },
  "placeholder.vatCr":     { en: "e.g. VAT / CR number",        zh: "例如：增值税号/营业执照号",    ar: "مثال: رقم ضريبة القيمة المضافة" },
  "placeholder.addNotes":  { en: "Add notes...",                 zh: "添加备注...",               ar: "إضافة ملاحظات..." },
  "placeholder.addTag":    { en: "Add tag...",                   zh: "添加标签...",               ar: "إضافة علامة..." },
  "placeholder.addBrand":  { en: "Add brand...",                 zh: "添加品牌...",               ar: "إضافة علامة تجارية..." },
  "placeholder.qualityObs": { en: "Quality observations...",     zh: "质量观察...",               ar: "ملاحظات الجودة..." },
  "placeholder.fieldName":  { en: "Field Name",                  zh: "字段名称",                 ar: "اسم الحقل" },
  "placeholder.value":      { en: "Value",                       zh: "值",                      ar: "القيمة" },
  "placeholder.countryProvCity": { en: "Country / Province / City", zh: "国家/省份/城市",        ar: "الدولة / المحافظة / المدينة" },
  "placeholder.phoneNumber":    { en: "Phone number",              zh: "电话号码",               ar: "رقم الهاتف" },
  "placeholder.emailAddress":   { en: "Email address",             zh: "邮箱地址",               ar: "عنوان البريد الإلكتروني" },
  "placeholder.street":         { en: "Street",                    zh: "街道",                  ar: "الشارع" },
  "placeholder.city":           { en: "City",                      zh: "城市",                  ar: "المدينة" },
  "placeholder.state":          { en: "State",                     zh: "省/州",                 ar: "الولاية" },
  "placeholder.country":        { en: "Country",                   zh: "国家",                  ar: "الدولة" },
  "placeholder.zipCode":        { en: "ZIP Code",                  zh: "邮编",                  ar: "الرمز البريدي" },
  "placeholder.bankTransfer":   { en: "Bank transfer details, payment notes, etc.", zh: "银行转账详情、付款备注等", ar: "تفاصيل التحويل البنكي، ملاحظات الدفع، إلخ." },
  "placeholder.docName":        { en: "Document name (e.g. Business License)", zh: "文件名称（例如：营业执照）", ar: "اسم المستند (مثال: رخصة تجارية)" },
  "placeholder.manager":        { en: "Direct manager name",       zh: "直属经理姓名",           ar: "اسم المدير المباشر" },
  "placeholder.officeAddress":  { en: "Office address",            zh: "办公地址",               ar: "عنوان المكتب" },
  "placeholder.seniorMgmt":     { en: "e.g. Senior Management",    zh: "例如：高级管理层",        ar: "مثال: الإدارة العليا" },
  "placeholder.engineering":    { en: "e.g. Engineering",          zh: "例如：工程部",            ar: "مثال: الهندسة" },
  "placeholder.softwareEng":    { en: "e.g. Software Engineer",    zh: "例如：软件工程师",        ar: "مثال: مهندس برمجيات" },
  "placeholder.leadDev":        { en: "e.g. Lead Developer",       zh: "例如：首席开发",          ar: "مثال: مطور رئيسي" },
  "placeholder.workLocation":   { en: "e.g. Dubai Office, Remote", zh: "例如：迪拜办公室、远程",   ar: "مثال: مكتب دبي، عن بُعد" },
  "placeholder.bankAccount":    { en: "Bank account details",      zh: "银行账户详情",            ar: "تفاصيل الحساب البنكي" },
  "placeholder.legalName":      { en: "Full legal name",           zh: "法定全名",               ar: "الاسم القانوني الكامل" },
  "placeholder.cityCountry":    { en: "City, Country",             zh: "城市，国家",             ar: "المدينة، الدولة" },
  "placeholder.visaNo":         { en: "Visa number",               zh: "签证号码",               ar: "رقم التأشيرة" },
  "placeholder.workPermit":     { en: "Work permit number",        zh: "工作许可证号码",          ar: "رقم تصريح العمل" },
  "placeholder.nationalId":     { en: "National ID number",        zh: "身份证号码",             ar: "رقم الهوية الوطنية" },
  "placeholder.ssn":            { en: "Social security number",    zh: "社会保险号码",           ar: "رقم الضمان الاجتماعي" },
  "placeholder.passport":       { en: "Passport number",           zh: "护照号码",               ar: "رقم جواز السفر" },
  "placeholder.homeAddress":    { en: "Home address",              zh: "家庭住址",               ar: "عنوان المنزل" },
  "placeholder.companyNameEn":  { en: "e.g. Shenzhen ABC Trading Co., Ltd.", zh: "例如：深圳ABC贸易有限公司", ar: "مثال: شركة شنجن ABC للتجارة المحدودة" },
  "placeholder.companyNameCn":  { en: "e.g. 深圳ABC贸易有限公司",     zh: "例如：深圳ABC贸易有限公司",  ar: "مثال: شركة شنجن ABC (بالصينية)" },
  "placeholder.reliabilityScore": { en: "e.g. 95",                 zh: "例如：95",               ar: "مثال: 95" },
  "placeholder.fieldOfStudy":   { en: "e.g. Computer Science",     zh: "例如：计算机科学",        ar: "مثال: علوم الحاسوب" },
  "tooltip.nationalId":         { en: "National Identity Card Number", zh: "国民身份证号码",        ar: "رقم بطاقة الهوية الوطنية" },
  "tooltip.ssn":                { en: "Social Security Number",    zh: "社会保险号码",           ar: "رقم الضمان الاجتماعي" },
  "misc.untitled":          { en: "Untitled",                    zh: "未命名",                   ar: "بدون عنوان" },
  "misc.account":           { en: "Account",                     zh: "账户",                    ar: "حساب" },
};
