import type { Translations } from "@/lib/i18n";

export const travelT: Translations = {
  "app.title":       { en: "Travel",  zh: "商务出行", ar: "السفر" },
  "app.subtitle":    { en: "Invitation letters for business visas",
                       zh: "商务签证邀请函",
                       ar: "خطابات الدعوة لتأشيرات العمل" },

  /* ── list ── */
  "nav.all":         { en: "All letters", zh: "全部邀请函", ar: "كل الخطابات" },
  "nav.draft":       { en: "Drafts",      zh: "草稿",      ar: "مسودات" },
  "nav.issued":      { en: "Issued",      zh: "已签发",    ar: "صادرة" },
  /* The FILTER is plural ("Drafts" — a bucket of them); the STATUS of one
     letter is singular. Reusing the filter label as the badge printed
     "Drafts" on a single row. */
  "status.draft":    { en: "Draft",       zh: "草稿",      ar: "مسودة" },
  "status.issued":   { en: "Issued",      zh: "已签发",    ar: "صادر" },
  "nav.settings":    { en: "Settings",    zh: "设置",      ar: "الإعدادات" },
  "action.new":      { en: "New invitation", zh: "新建邀请函", ar: "دعوة جديدة" },
  "empty.title":     { en: "No invitation letters yet", zh: "暂无邀请函", ar: "مفيش خطابات دعوة لسه" },
  "empty.body":      { en: "Create one for a customer travelling to China.",
                       zh: "为来华访问的客户创建一份。",
                       ar: "اعمل واحد لعميل جاي الصين." },
  "search.placeholder": { en: "Search by name, passport or reference",
                          zh: "按姓名、护照或编号搜索",
                          ar: "دوّر بالاسم أو الجواز أو الرقم المرجعي" },

  /* ── form sections ── */
  "sec.visitor":     { en: "Visitor",  zh: "访客信息", ar: "الزائر" },
  "sec.company":     { en: "Their company", zh: "所属公司", ar: "شركته" },
  "sec.visit":       { en: "The visit", zh: "访问安排", ar: "الزيارة" },
  "sec.letter":      { en: "The letter", zh: "函件信息", ar: "الخطاب" },

  /* ── fields ── */
  "f.customer":      { en: "Customer",            zh: "客户",       ar: "العميل" },
  "f.name":          { en: "Full name",           zh: "姓名",       ar: "الاسم الكامل" },
  "f.name.hint":     { en: "Exactly as printed in the passport",
                       zh: "须与护照完全一致",
                       ar: "زي ما هو في الجواز بالظبط" },
  "f.gender":        { en: "Gender",              zh: "性别",       ar: "النوع" },
  "f.male":          { en: "Male",                zh: "男",         ar: "ذكر" },
  "f.female":        { en: "Female",              zh: "女",         ar: "أنثى" },
  "f.dob":           { en: "Date of birth",       zh: "出生日期",   ar: "تاريخ الميلاد" },
  "f.nationality":   { en: "Nationality",         zh: "国籍",       ar: "الجنسية" },
  "f.countryCode":   { en: "Country code",        zh: "国家代码",   ar: "كود الدولة" },
  "f.countryCode.hint": { en: "Fills itself from the nationality — EG for Egypt, IN for India",
                          zh: "由国籍自动填写——例如埃及为 EG",
                          ar: "بيتملا لوحده من الجنسية — EG لمصر، IN للهند" },
  "f.passportNo":    { en: "Passport number",     zh: "护照号码",   ar: "رقم الجواز" },
  "f.issue":         { en: "Date of issue",       zh: "签发日期",   ar: "تاريخ الإصدار" },
  "f.expiry":        { en: "Date of expiry",      zh: "有效期至",   ar: "تاريخ الانتهاء" },
  "f.company":       { en: "Company name",        zh: "公司名称",   ar: "اسم الشركة" },
  "f.position":      { en: "Position",            zh: "职务",       ar: "المنصب" },
  "f.position.hint": { en: "Leave empty and the letter simply says he is our customer",
                       zh: "留空则函件仅说明其为我司客户",
                       ar: "سيبه فاضي والخطاب هيقول إنه عميلنا بس" },
  "f.country":       { en: "Country",             zh: "国家",       ar: "البلد" },
  "f.purpose":       { en: "Reason for the visit", zh: "访问事由",  ar: "سبب الزيارة" },
  "f.exhibition":    { en: "Exhibition name",     zh: "展会名称",   ar: "اسم المعرض" },
  "f.note":          { en: "Extra note",          zh: "补充说明",   ar: "ملاحظة إضافية" },
  /* One field, printed verbatim on BOTH pages — so English text here appears
     in English in the middle of the Chinese letter. Said plainly, because it
     is a choice the operator has to make, not a bug to discover later. */
  "f.note.hint":     { en: "Printed word for word on both pages — write it in Chinese too if it must read as Chinese",
                       zh: "将原样印在中英文两页上——如需中文呈现，请一并用中文书写",
                       ar: "بيتطبع زي ما هو في الصفحتين — اكتبه بالصيني كمان لو لازم يبان صيني" },
  "f.arrivalCity":   { en: "Arrival city",        zh: "入境城市",   ar: "مدينة الوصول" },
  "f.arrival":       { en: "Arrival date",        zh: "入境日期",   ar: "تاريخ الوصول" },
  "f.departure":     { en: "Departure date",      zh: "离境日期",   ar: "تاريخ المغادرة" },
  "f.duration":      { en: "Duration",            zh: "停留天数",   ar: "المدة" },
  "f.duration.hint": { en: "Calculated from the dates",
                       zh: "由日期自动计算",
                       ar: "بتتحسب من التواريخ" },
  "f.cities":        { en: "Cities to visit",     zh: "拟访城市",   ar: "المدن اللي هيزورها" },
  "f.visaType":      { en: "Visa type",           zh: "签证类型",   ar: "نوع التأشيرة" },
  "f.single":        { en: "Single entry",        zh: "一次入境",   ar: "دخول واحد" },
  "f.multi":         { en: "Multiple entry (M)",  zh: "多次往返（M）", ar: "متعدد الدخول (M)" },
  "f.letterDate":    { en: "Letter date",         zh: "函件日期",   ar: "تاريخ الخطاب" },
  "f.reference":     { en: "Reference",           zh: "编号",       ar: "رقم مرجعي" },
  "f.days":          { en: "days",                zh: "天",         ar: "يوم" },

  /* ── passport scan ── */
  "scan.title":      { en: "Passport scan",       zh: "护照扫描件", ar: "صورة الجواز" },
  "scan.upload":     { en: "Upload a scan",       zh: "上传扫描件", ar: "ارفع صورة" },
  "scan.read":       { en: "Read the passport",   zh: "读取护照信息", ar: "اقرا الجواز" },
  "scan.reading":    { en: "Reading…",            zh: "读取中…",    ar: "بيقرا…" },
  "scan.replace":    { en: "Replace",             zh: "替换",       ar: "استبدل" },
  "scan.remove":     { en: "Remove",              zh: "删除",       ar: "امسح" },
  "scan.view":       { en: "View",                zh: "查看",       ar: "اعرض" },
  "scan.hint":       { en: "The system reads the machine-readable zone at the bottom of the data page.",
                       zh: "系统将读取资料页底部的机读区。",
                       ar: "النظام بيقرا الشريط الأسفل من صفحة البيانات." },

  /* ── actions ── */
  "act.save":        { en: "Save",       zh: "保存",   ar: "احفظ" },
  "act.saving":      { en: "Saving…",    zh: "保存中…", ar: "بيحفظ…" },
  "act.cancel":      { en: "Cancel",     zh: "取消",   ar: "إلغاء" },
  "act.preview":     { en: "Preview",    zh: "预览",   ar: "معاينة" },
  "act.pdf":         { en: "Export PDF", zh: "导出 PDF", ar: "تصدير PDF" },
  "act.duplicate":   { en: "Duplicate",  zh: "复制",   ar: "نسخة" },
  "act.delete":      { en: "Delete",     zh: "删除",   ar: "امسح" },
  "act.edit":        { en: "Edit",       zh: "编辑",   ar: "تعديل" },

  /* ── delete confirmation ── */
  "del.title":       { en: "Delete this invitation?", zh: "删除此邀请函？", ar: "تمسح الدعوة دي؟" },
  "del.body":        { en: "This is permanent and cannot be undone.",
                       zh: "此操作不可撤销。",
                       ar: "ده نهائي ومش هينفع يترجع." },

  /* ── warnings ── */
  "warn.title":      { en: "Check before sending", zh: "发送前请核对", ar: "راجع قبل ما تبعت" },
};
