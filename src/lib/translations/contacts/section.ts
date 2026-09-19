import type { Translations } from "@/lib/i18n";

/* Contacts — the `section.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_SECTION: Translations = {
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

  /* ── Commercial Profile ── */
  "section.commercialProfile":  { en: "Commercial Profile",  zh: "商业档案",         ar: "الملف التجاري" },

  /* ── Pricing & Discounts ── */
  "section.pricingDiscounts":        { en: "Pricing & Discounts",   zh: "价格与折扣",       ar: "التسعير والخصومات" },

  /* ── Segmentation & Health ── */
  "section.segmentationHealth": { en: "Segmentation & Health", zh: "细分与健康",      ar: "التقسيم والصحة" },

  /* ── Credit Management ── */
  "section.creditManagement":       { en: "Credit Management",   zh: "信用管理",        ar: "إدارة الائتمان" },

  /* ── Credit Insurance ── */
  "section.creditInsurance":            { en: "Credit Insurance",   zh: "信用保险",       ar: "تأمين الائتمان" },

  /* ── Legal Identity ── */
  "section.legalIdentity":       { en: "Legal Identity",         zh: "法律身份",         ar: "الهوية القانونية" },

  /* ── International Trade IDs ── */
  "section.tradeIdentifiers":   { en: "International Trade IDs", zh: "国际贸易识别码",   ar: "معرفات التجارة الدولية" },

  /* ── KYC & Risk ── */
  "section.kycRisk":                 { en: "KYC & Risk",           zh: "KYC与风险",       ar: "KYC والمخاطر" },

  /* ── Flags & Audit ── */
  "section.flagsAudit":       { en: "Flags & Audit",              zh: "标记与审计",       ar: "العلامات والتدقيق" },

  /* ── Logistics & Trade Operations ── */
  "section.logisticsTrade":         { en: "Logistics & Trade Operations", zh: "物流与贸易运营", ar: "اللوجستيات وعمليات التجارة" },

  /* ── Classification & Carriers ── */
  "section.tradeCodes":             { en: "Classification & Carriers", zh: "分类与承运商", ar: "التصنيف والناقلين" },

  /* ── Messaging IDs ── */
  "section.messagingIds":     { en: "Messaging IDs",  zh: "即时通讯账号",   ar: "معرفات المراسلة" },

  /* ── Internal Notes ── */
  "section.internalNotes":          { en: "Internal Notes",  zh: "内部备注",         ar: "ملاحظات داخلية" },

  /* ═══════════════════════════════════════════════════════════════════════════
     SUPPLIER ADD/EDIT FORM — sections, subsections, fields, hints, placeholders
     (zh + ar added so the supplier form is fully localized)
     ═══════════════════════════════════════════════════════════════════════════ */
  "section.classifications":    { en: "Classifications",           zh: "分类",                 ar: "التصنيفات" },
  "section.factory":            { en: "Factory",                   zh: "工厂",                 ar: "المصنع" },
  "section.negotiation":        { en: "Negotiation",               zh: "谈判",                 ar: "التفاوض" },
  "section.paymentInfo":        { en: "Payment Information",        zh: "付款信息",              ar: "معلومات الدفع" },
  "section.pipeline":           { en: "Pipeline",                  zh: "销售管道",              ar: "مسار الصفقات" },
  "section.risk":               { en: "Risk",                      zh: "风险",                 ar: "المخاطر" },
  "section.socialMedia":        { en: "Social Media",              zh: "社交媒体",              ar: "وسائل التواصل" },
  "section.strategicStatus":    { en: "Strategic Status",          zh: "战略状态",              ar: "الحالة الاستراتيجية" },
};
