import type { Translations } from "@/lib/i18n";

/* Contacts — the `opt.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_OPT: Translations = {
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
  "opt.home":             { en: "home",                  zh: "住宅",                 ar: "منزل" },
  "opt.work":             { en: "work",                  zh: "工作",                 ar: "عمل" },
  "opt.main":             { en: "main",                  zh: "主号",                 ar: "رئيسي" },
  "opt.work fax":         { en: "work fax",              zh: "工作传真",              ar: "فاكس عمل" },
  "opt.home fax":         { en: "home fax",              zh: "住宅传真",              ar: "فاكس منزل" },
  "opt.pager":            { en: "pager",                 zh: "寻呼机",               ar: "بيجر" },

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

  /* ── Dropdown option VALUES (rendered via tOpt = t("opt."+value)) ──
     Supplier types (new), trade-finance terms, contact-person enums, risk-item
     enums, level scales, response speeds, languages, factory units. ── */
  "opt.Spare Parts":            { en: "Spare Parts",   zh: "备件",        ar: "قطع الغيار" },
  "opt.Machinery":              { en: "Machinery",     zh: "机械",        ar: "الآلات" },
  "opt.Packaging":              { en: "Packaging",     zh: "包装",        ar: "التغليف" },
  "opt.Textile":                { en: "Textile",       zh: "纺织",        ar: "المنسوجات" },
  "opt.Chemical":               { en: "Chemical",      zh: "化工",        ar: "الكيماويات" },
  "opt.Logistics":              { en: "Logistics",     zh: "物流",        ar: "الخدمات اللوجستية" },

  "opt.T/T":                    { en: "T/T",  zh: "电汇 (T/T)",   ar: "تحويل بنكي (T/T)" },
  "opt.L/C":                    { en: "L/C",  zh: "信用证 (L/C)", ar: "اعتماد مستندي (L/C)" },
  "opt.D/P":                    { en: "D/P",  zh: "付款交单 (D/P)", ar: "الدفع مقابل المستندات (D/P)" },
  "opt.D/A":                    { en: "D/A",  zh: "承兑交单 (D/A)", ar: "القبول مقابل المستندات (D/A)" },

  "opt.sales":                  { en: "Sales",        zh: "销售",      ar: "المبيعات" },
  "opt.boss":                   { en: "Boss",         zh: "老板",      ar: "المدير" },
  "opt.owner":                  { en: "Owner",        zh: "所有者",     ar: "المالك" },
  "opt.support":                { en: "Support",      zh: "客服支持",   ar: "الدعم" },
  "opt.finance":                { en: "Finance",      zh: "财务",      ar: "المالية" },
  "opt.logistics":              { en: "Logistics",    zh: "物流",      ar: "اللوجستيات" },
  "opt.qc":                     { en: "QC",           zh: "质检",      ar: "مراقبة الجودة" },
  "opt.engineering":            { en: "Engineering",  zh: "工程",      ar: "الهندسة" },
  "opt.management":             { en: "Management",   zh: "管理层",     ar: "الإدارة" },
  "opt.other":                  { en: "Other",        zh: "其他",      ar: "أخرى" },

  "opt.high":                   { en: "High",         zh: "高",        ar: "مرتفع" },
  "opt.medium":                 { en: "Medium",       zh: "中",        ar: "متوسط" },
  "opt.low":                    { en: "Low",          zh: "低",        ar: "منخفض" },
  "opt.critical":               { en: "Critical",     zh: "严重",      ar: "حرج" },
  "opt.unknown":                { en: "Unknown",      zh: "未知",      ar: "غير معروف" },

  "opt.wechat":                 { en: "WeChat",       zh: "微信",      ar: "WeChat" },
  "opt.wecom":                  { en: "WeCom",        zh: "企业微信",   ar: "WeCom" },
  "opt.whatsapp":               { en: "WhatsApp",     zh: "WhatsApp",  ar: "واتساب" },
  "opt.telegram":               { en: "Telegram",     zh: "Telegram",  ar: "تيليجرام" },
  "opt.email":                  { en: "Email",        zh: "邮箱",      ar: "البريد الإلكتروني" },
  "opt.mobile":                 { en: "Mobile",       zh: "手机",      ar: "الجوال" },
  "opt.line":                   { en: "LINE",         zh: "LINE",      ar: "LINE" },
  "opt.skype":                  { en: "Skype",        zh: "Skype",     ar: "Skype" },

  "opt.operational":            { en: "Operational",  zh: "运营",      ar: "تشغيلي" },
  "opt.financial":              { en: "Financial",    zh: "财务",      ar: "مالي" },
  "opt.strategic":              { en: "Strategic",    zh: "战略",      ar: "استراتيجي" },
  "opt.geographic":             { en: "Geographic",   zh: "地理",      ar: "جغرافي" },
  "opt.relationship":           { en: "Relationship", zh: "关系",      ar: "علاقة" },
  "opt.open":                   { en: "Open",         zh: "未处理",     ar: "مفتوح" },
  "opt.mitigating":             { en: "Mitigating",   zh: "处理中",     ar: "قيد المعالجة" },
  "opt.resolved":               { en: "Resolved",     zh: "已解决",     ar: "تم الحل" },

  "opt.Within 1 hour":          { en: "Within 1 hour",   zh: "1小时内",  ar: "خلال ساعة" },
  "opt.Within 2 hours":         { en: "Within 2 hours",  zh: "2小时内",  ar: "خلال ساعتين" },
  "opt.Same day":               { en: "Same day",        zh: "当天",     ar: "نفس اليوم" },
  "opt.Within 24 hours":        { en: "Within 24 hours", zh: "24小时内", ar: "خلال 24 ساعة" },
  "opt.Within 48 hours":        { en: "Within 48 hours", zh: "48小时内", ar: "خلال 48 ساعة" },
  "opt.2–3 days":               { en: "2–3 days",        zh: "2–3天",   ar: "2–3 أيام" },
  "opt.Slow / varies":          { en: "Slow / varies",   zh: "较慢 / 不定", ar: "بطيء / متغيّر" },


  "opt.units / month":          { en: "units / month",       zh: "件 / 月",      ar: "وحدة / شهر" },
  "opt.pcs / month":            { en: "pcs / month",         zh: "个 / 月",      ar: "قطعة / شهر" },
  "opt.sets / month":           { en: "sets / month",        zh: "套 / 月",      ar: "طقم / شهر" },
  "opt.pairs / month":          { en: "pairs / month",       zh: "双 / 月",      ar: "زوج / شهر" },
  "opt.tons / month":           { en: "tons / month",        zh: "吨 / 月",      ar: "طن / شهر" },
  "opt.meters / month":         { en: "meters / month",      zh: "米 / 月",      ar: "متر / شهر" },
  "opt.rolls / month":          { en: "rolls / month",       zh: "卷 / 月",      ar: "لفة / شهر" },
  "opt.containers / month":     { en: "containers / month",  zh: "集装箱 / 月",   ar: "حاوية / شهر" },
  "opt.units / year":           { en: "units / year",        zh: "件 / 年",      ar: "وحدة / سنة" },
  "opt.pcs / year":             { en: "pcs / year",          zh: "个 / 年",      ar: "قطعة / سنة" },
  "opt.sets / year":            { en: "sets / year",         zh: "套 / 年",      ar: "طقم / سنة" },
  "opt.pairs / year":           { en: "pairs / year",        zh: "双 / 年",      ar: "زوج / سنة" },
  "opt.tons / year":            { en: "tons / year",         zh: "吨 / 年",      ar: "طن / سنة" },
  "opt.meters / year":          { en: "meters / year",       zh: "米 / 年",      ar: "متر / سنة" },
  "opt.rolls / year":           { en: "rolls / year",        zh: "卷 / 年",      ar: "لفة / سنة" },
  "opt.containers / year":      { en: "containers / year",   zh: "集装箱 / 年",   ar: "حاوية / سنة" },

  /* Factory type / strategic status / classification enum values (these
     dropdowns previously rendered from English-only maps in intelligence.ts). */
  "opt.own_factory":            { en: "Own factory",          zh: "自有工厂",      ar: "مصنع مملوك" },
  "opt.partner_factory":        { en: "Partner factory",      zh: "合作工厂",      ar: "مصنع شريك" },
  "opt.contract_manufacturer":  { en: "Contract manufacturer", zh: "代工厂",       ar: "مصنع تعاقدي" },
  "opt.trading_only":           { en: "Trading (no factory)", zh: "贸易(无工厂)",  ar: "تجاري (بدون مصنع)" },
  "opt.multiple":               { en: "Multiple factories",   zh: "多个工厂",      ar: "مصانع متعددة" },

  "opt.prospect":               { en: "Prospect",     zh: "潜在",       ar: "مُحتمَل" },
  "opt.trial":                  { en: "Trial",        zh: "试用",       ar: "تجريبي" },
  "opt.experimental":           { en: "Experimental", zh: "试验性",     ar: "اختباري" },
  "opt.backup":                 { en: "Backup",       zh: "备用",       ar: "احتياطي" },
  "opt.approved":               { en: "Approved",     zh: "已批准",     ar: "معتمد" },
  "opt.preferred":              { en: "Preferred",    zh: "优选",       ar: "مُفضّل" },
  "opt.under_review":           { en: "Under Review", zh: "审核中",     ar: "قيد المراجعة" },
  "opt.suspended":              { en: "Suspended",    zh: "已暂停",     ar: "موقوف" },
  "opt.inactive":               { en: "Inactive",     zh: "不活跃",     ar: "غير نشط" },
  "opt.phasing_out":            { en: "Phasing Out",  zh: "逐步淘汰",   ar: "قيد الإيقاف التدريجي" },
  "opt.blocked":                { en: "Blocked",      zh: "已封锁",     ar: "محظور" },
  "opt.blacklisted":            { en: "Blacklisted",  zh: "黑名单",     ar: "القائمة السوداء" },

  "opt.manufacturer":           { en: "Manufacturer",        zh: "制造商",        ar: "مُصنِّع" },
  "opt.factory_trading":        { en: "Factory + Trading",   zh: "工厂 + 贸易",    ar: "مصنع + تجارة" },
  "opt.pure_trading":           { en: "Pure Trading",        zh: "纯贸易",        ar: "تجارة فقط" },
  "opt.oem_specialist":         { en: "OEM Specialist",      zh: "OEM 专家",      ar: "متخصص OEM" },
  "opt.odm_specialist":         { en: "ODM Specialist",      zh: "ODM 专家",      ar: "متخصص ODM" },
  "opt.component":              { en: "Component Supplier",  zh: "零部件供应商",   ar: "مورّد مكوّنات" },
  "opt.electronics":            { en: "Electronics Supplier", zh: "电子供应商",    ar: "مورّد إلكترونيات" },
  "opt.packaging":              { en: "Packaging Supplier",  zh: "包装供应商",     ar: "مورّد تغليف" },
  "opt.raw_material":           { en: "Raw Material Supplier", zh: "原材料供应商",  ar: "مورّد مواد خام" },
  "opt.assembly":               { en: "Assembly Supplier",   zh: "组装供应商",     ar: "مورّد تجميع" },
  "opt.software":               { en: "Software Supplier",   zh: "软件供应商",     ar: "مورّد برمجيات" },
  "opt.logistics_partner":      { en: "Logistics Partner",   zh: "物流合作伙伴",   ar: "شريك لوجستي" },
  "opt.service_provider":       { en: "Service Provider",    zh: "服务提供商",     ar: "مزوّد خدمة" },
  "opt.spare_parts":            { en: "Spare Parts",         zh: "备件",          ar: "قطع الغيار" },
  "opt.textile":                { en: "Textile",             zh: "纺织",          ar: "منسوجات" },
  "opt.chemical":               { en: "Chemical",            zh: "化工",          ar: "كيماويات" },
  "opt.accessories":            { en: "Accessories",         zh: "配件",          ar: "إكسسوارات" },
  "opt.machinery":              { en: "Machinery",           zh: "机械",          ar: "آلات" },
};
