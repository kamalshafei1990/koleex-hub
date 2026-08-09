import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   The "Become Koleex Member" copy — split out of signin.ts.

   signin.ts is imported by AdminAuth, the auth gate that wraps every route, so
   every string in it is downloaded by every signed-in user on every cold load.
   Two thirds of the dictionary was join-form copy: five relationships, eight
   contact channels, fifteen ways of hearing about us, the document prompts —
   all in three languages, none of it ever read by somebody who already has an
   account. It travels with the form now.
   --------------------------------------------------------------------------- */

export const signInJoinT: Translations = {
  "join.relationship": { en: "Your relationship with Koleex", zh: "您与 Koleex 的关系", ar: "علاقتك بـ Koleex" },
  "rel.new_prospect":      { en: "New to Koleex", zh: "初次接触", ar: "جديد على Koleex" },
  "rel.new_prospect.d":    { en: "First time here", zh: "第一次了解我们", ar: "أول مرة" },
  "rel.existing_customer": { en: "Customer", zh: "客户", ar: "عميل" },
  "rel.existing_customer.d": { en: "We already work together", zh: "我们已有合作", ar: "بنشتغل مع بعض" },
  "rel.supplier":          { en: "Supplier", zh: "供应商", ar: "مورّد" },
  "rel.supplier.d":        { en: "I supply Koleex", zh: "我为 Koleex 供货", ar: "بورّد لـ Koleex" },
  "rel.partner":           { en: "Partner", zh: "合作伙伴", ar: "شريك" },
  "rel.partner.d":         { en: "Agent or distributor", zh: "代理或经销商", ar: "وكيل أو موزّع" },
  "rel.other":             { en: "Other", zh: "其他", ar: "غير ذلك" },
  "rel.other.d":           { en: "Something else", zh: "其他情况", ar: "حالة أخرى" },
  "join.name":      { en: "Full Name *", zh: "姓名 *", ar: "الاسم بالكامل *" },
  "join.email":     { en: "Work Email *", zh: "工作邮箱 *", ar: "بريد العمل *" },
  "join.phone":     { en: "Phone", zh: "电话", ar: "التليفون" },
  "join.company":   { en: "Company", zh: "公司", ar: "الشركة" },
  "join.jobTitle":  { en: "Job Title", zh: "职位", ar: "المسمى الوظيفي" },
  "join.country":   { en: "Country", zh: "国家", ar: "الدولة" },
  "join.selectCountry": { en: "Select country", zh: "选择国家", ar: "اختر الدولة" },
  "join.city":      { en: "City", zh: "城市", ar: "المدينة" },
  "join.heardFrom": { en: "How did you hear about us?", zh: "您如何得知我们？", ar: "كيف عرفت عنّا؟" },
  "join.purpose":   { en: "Purpose of access", zh: "申请用途", ar: "الغرض من الدخول" },
  "join.submit":    { en: "Request Access", zh: "申请访问", ar: "اطلب الدخول" },
  "join.privacy":   { en: "Your details go to the Koleex administrators only.",
                      zh: "您的信息仅发送给 Koleex 管理员。",
                      ar: "بياناتك بتروح لمسؤولي Koleex بس." },

  /* ── What this form actually is ──────────────────────────────────────
     The Hub is not a public product. Every account is issued by Koleex
     after a human reads the request, so the form has to say so before
     someone fills it in: it is an application, it takes 1–3 working days,
     and it can be refused. Saying it here is what stops the follow-up
     "why haven't I got my password yet" three hours later. */
  "join.reviewNote": {
    en: "Koleex Hub is a private system. Every request is reviewed by a Koleex administrator and answered within 1–3 working days.",
    zh: "Koleex Hub 为内部专用系统。所有申请均由 Koleex 管理员人工审核，1–3 个工作日内答复。",
    ar: "‏Koleex Hub نظام خاص. كل طلب بيراجعه مسؤول من Koleex والرد بيوصل خلال ١–٣ أيام عمل.",
  },
  /* Two audiences who should NOT be filling this in — the one path that
     says "no proof needed" is the one an attacker picks first, and a
     request for extra seats is far safer made from inside a session that
     has already proved who the company is. */

  /* ── The question that decides fastest ───────────────────────────────
     One internal message to a named colleague beats any document review,
     so this is asked of everyone who claims an existing relationship. */
  "join.koleexContact": {
    en: "Your contact at Koleex",
    zh: "您在 Koleex 的联系人",
    ar: "جهة اتصالك في Koleex",
  },
  "join.koleexContactHint": {
    en: "The person you deal with — the fastest way for us to confirm you",
    zh: "与您对接的同事 — 这是我们最快的核实方式",
    ar: "الشخص الذي تتعامل معه — أسرع وسيلة للتأكد من هويتك",
  },

  /* ── Partner ── */
  "join.partnerType":  { en: "Type of partnership", zh: "合作类型", ar: "نوع الشراكة" },
  "ptype.distributor": { en: "Distributor", zh: "经销商", ar: "موزّع" },
  "ptype.agent":       { en: "Agent", zh: "代理商", ar: "وكيل" },
  "ptype.service":     { en: "Service partner", zh: "服务伙伴", ar: "شريك خدمات" },
  "ptype.other":       { en: "Other", zh: "其他", ar: "غير ذلك" },
  "join.territory":    { en: "Market or territory", zh: "市场或区域", ar: "السوق أو المنطقة" },

  /* ── Supplier ── */
  "join.supplies":     { en: "What do you supply?", zh: "您供应什么？", ar: "بتورّد إيه؟" },
  "join.supplierCode": { en: "Supplier code (if you have one)", zh: "供应商编号（如有）", ar: "كود المورّد (لو عندك)" },

  /* ── Prospect ── */
  "join.website":      { en: "Company website", zh: "公司网站", ar: "موقع الشركة" },


  /* ── How to reach them ───────────────────────────────────────────────
     A work email is the one field we insist on, but it is often the worst
     way to actually reach somebody: a supplier in Shenzhen answers WeChat in
     minutes and email in days, and half of Egypt runs on WhatsApp. Asking
     removes a round of "we emailed you twice" from every application. */
  "join.contactVia":  { en: "How would you like us to contact you?",
                        zh: "您希望我们通过哪种方式联系您？",
                        ar: "كيف تفضّل أن نتواصل معك؟" },
  "cv.email":     { en: "Email",     zh: "邮箱",       ar: "الإيميل" },
  "cv.whatsapp":  { en: "WhatsApp",  zh: "WhatsApp",  ar: "واتساب" },
  "cv.wechat":    { en: "WeChat",    zh: "微信",       ar: "ويشات" },
  "cv.telegram":  { en: "Telegram",  zh: "Telegram",  ar: "تليجرام" },
  "cv.messenger": { en: "Messenger", zh: "Messenger", ar: "ماسنجر" },
  "cv.sms":       { en: "SMS",       zh: "短信",       ar: "رسالة نصية" },
  "cv.phone":     { en: "Phone call", zh: "电话",      ar: "مكالمة" },
  "cv.other":     { en: "Other",     zh: "其他",       ar: "طريقة تانية" },
  /* The handle field is named after the channel — "contact details" would
     leave someone guessing whether we want a number or a username. */
  "cv.h.whatsapp":  { en: "WhatsApp number",  zh: "WhatsApp 号码", ar: "رقم الواتساب" },
  "cv.h.wechat":    { en: "WeChat ID",        zh: "微信号",        ar: "معرّف الويشات" },
  "cv.h.telegram":  { en: "Telegram username or number", zh: "Telegram 用户名或号码", ar: "يوزر تليجرام أو الرقم" },
  "cv.h.messenger": { en: "Messenger profile", zh: "Messenger 主页", ar: "حساب الماسنجر" },
  "cv.h.sms":       { en: "Mobile number",     zh: "手机号码",      ar: "رقم الموبايل" },
  "cv.h.phone":     { en: "Number to call",    zh: "联系电话",      ar: "الرقم الذي نتصل به" },
  "cv.h.other":     { en: "How should we reach you?", zh: "请说明联系方式", ar: "كيف نصل إليك؟" },
  "cv.sameAsPhone": { en: "Same as the phone number above",
                      zh: "与上方电话号码相同",
                      ar: "نفس رقم التليفون فوق" },
  "cv.emailNote":   { en: "We already have your work email above.",
                      zh: "我们已获取上方的工作邮箱。",
                      ar: "بريد العمل أعلاه يكفي." },

  /* ── How they found us ───────────────────────────────────────────────
     Was six English strings hard-coded in the component, on a screen that
     reads in three languages. Now translated, and long enough to be worth
     answering — "Other" was collecting most of the traffic. */
  "hf.":                { en: "Select an option", zh: "请选择", ar: "اختر" },
  "hf.linkedin":        { en: "LinkedIn", zh: "领英 LinkedIn", ar: "لينكدإن" },
  "hf.google":          { en: "Google or another search engine", zh: "谷歌或其他搜索引擎", ar: "جوجل أو محرك بحث تاني" },
  "hf.referral":        { en: "A colleague recommended you", zh: "同事推荐", ar: "زميل رشّحكم" },
  "hf.existing_customer": { en: "A Koleex customer recommended you", zh: "Koleex 客户推荐", ar: "عميل عند Koleex رشّحكم" },
  "hf.sales_rep":       { en: "A Koleex sales representative", zh: "Koleex 销售代表", ar: "مندوب مبيعات من Koleex" },
  "hf.partner":         { en: "A Koleex partner or distributor", zh: "Koleex 合作伙伴或经销商", ar: "شريك أو موزّع لـ Koleex" },
  "hf.exhibition":      { en: "Trade show or exhibition", zh: "展会", ar: "معرض تجاري" },
  "hf.event":           { en: "Event or conference", zh: "活动或会议", ar: "فعالية أو مؤتمر" },
  "hf.website":         { en: "Koleex website", zh: "Koleex 官网", ar: "موقع Koleex" },
  "hf.marketplace":     { en: "Alibaba or another B2B marketplace", zh: "阿里巴巴或其他 B2B 平台", ar: "علي بابا أو منصة B2B تانية" },
  "hf.wechat":          { en: "WeChat", zh: "微信", ar: "ويشات" },
  "hf.social":          { en: "Instagram, Facebook or YouTube", zh: "Instagram、Facebook 或 YouTube", ar: "إنستجرام أو فيسبوك أو يوتيوب" },
  "hf.press":           { en: "Industry press or magazine", zh: "行业媒体或杂志", ar: "مجلة أو صحافة متخصصة" },
  "hf.email":           { en: "An email from Koleex", zh: "Koleex 的邮件", ar: "إيميل من Koleex" },
  "hf.other":           { en: "Somewhere else", zh: "其他途径", ar: "حتة تانية" },

  /* ── Proof ───────────────────────────────────────────────────────────
     The owner's rule: a company license from EVERY applicant, whoever they
     say they are. The second document differs by relationship and is what
     lets a reviewer decide without a follow-up email. */
  "join.docs":       { en: "Proof documents", zh: "证明文件", ar: "مستندات الإثبات" },
  "join.docsAdd":    { en: "Attach files", zh: "上传文件", ar: "أرفق ملفات" },
  "join.docsHint":   { en: "PDF, JPG or PNG · up to 2 files · 4 MB each",
                       zh: "PDF、JPG 或 PNG · 最多 2 个文件 · 每个 4 MB",
                       ar: "PDF أو JPG أو PNG · ملفين على الأكثر · ٤ ميجا للملف" },
  "join.docsNeed":   { en: "Company license or commercial registration — required",
                       zh: "营业执照或商业登记证 — 必填",
                       ar: "السجل التجاري أو رخصة الشركة — مطلوب" },
  /* Named per relationship, because "supporting document" tells nobody what
     to go and find. */
  "docs.existing_customer": { en: "Plus your last Koleex invoice, if you have it — it helps us find your account faster",
                              zh: "如有，请附上最近一张 Koleex 发票 — 便于我们更快找到您的账户",
                              ar: "ومعه آخر فاتورة من Koleex إن وُجدت — تساعدنا في الوصول إلى حسابك أسرع" },
  "docs.partner":           { en: "Plus your signed agreement with Koleex",
                              zh: "以及您与 Koleex 签署的协议",
                              ar: "ومعه الاتفاقية الموقّعة مع Koleex" },
  "docs.supplier":          { en: "Plus your latest contract or purchase order with Koleex",
                              zh: "以及最近与 Koleex 的合同或采购订单",
                              ar: "ومعه آخر عقد أو أمر شراء مع Koleex" },
  "docs.new_prospect":      { en: "The license is all we need at this stage",
                              zh: "现阶段仅需营业执照",
                              ar: "السجل التجاري يكفي في هذه المرحلة" },
  "docs.other":             { en: "Plus anything that helps us understand your request",
                              zh: "以及任何有助于我们了解您需求的材料",
                              ar: "ومعه أي مستند يساعدنا على فهم طلبك" },
  "join.docsTooBig":  { en: "That file is over 4 MB. Please attach a smaller one.",
                        zh: "该文件超过 4 MB，请上传较小的文件。",
                        ar: "حجم هذا الملف أكبر من ٤ ميجابايت. يرجى إرفاق ملف أصغر." },
  "join.docsRemove":  { en: "Remove", zh: "移除", ar: "شيل" },
  "join.docsPrivate": { en: "Documents are stored privately and seen only by the Koleex administrators reviewing your request.",
                        zh: "文件私密存储，仅供审核您申请的 Koleex 管理员查看。",
                        ar: "تُحفظ المستندات بشكل خاص ولا يطّلع عليها سوى مسؤولي Koleex الذين يراجعون طلبك." },

  "join.customerCode": { en: "Customer code or account name",
                      zh: "客户编号或账户名称",
                      ar: "كود العميل أو اسم الحساب" },
  /* The last question changes with who is asking — a brand-new contact cannot
     answer "which parts of the Hub do you need" because they have never seen
     it. */
  "join.q.new_prospect":     { en: "What are you looking for?",
                      zh: "您在寻找什么？", ar: "بتدوّر على إيه؟" },
  "join.q.existing_customer":{ en: "What do you need access to?",
                      zh: "您需要访问什么？", ar: "محتاج توصل لإيه؟" },
  /* NOT "What do you supply?" — the one-line field above already asks that,
     and a supplier was answering the same question twice on one form. */
  "join.q.supplier": { en: "Anything else we should know?",
                       zh: "还有什么需要我们了解的吗？",
                       ar: "هل هناك شيء آخر ينبغي أن نعرفه؟" },
  "join.q.partner":  { en: "What kind of partnership?", zh: "哪种合作方式？", ar: "شراكة من أي نوع؟" },
  "join.q.other":    { en: "How can we help?", zh: "我们能帮您什么？", ar: "كيف يمكننا مساعدتك؟" },
  "join.qh.new_prospect":     { en: "Tell us about your business and what you need…",
                      zh: "介绍您的业务和需求…", ar: "حدّثنا عن نشاطك وما تحتاج إليه…" },
  "join.qh.existing_customer":{ en: "Orders, quotations, invoices…",
                      zh: "订单、报价、发票…", ar: "أوردرات، عروض أسعار، فواتير…" },
  "join.qh.supplier": { en: "Machines, spare parts, materials…",
                      zh: "机器、备件、材料…", ar: "ماكينات، قطع غيار، خامات…" },
  "join.qh.partner":  { en: "Distribution, agency, technical…",
                      zh: "分销、代理、技术…", ar: "توزيع، وكالة، فني…" },
  "join.qh.other":    { en: "Tell us what you need…", zh: "告诉我们您的需求…", ar: "حدّثنا بما تحتاج إليه…" },

  /* ── Errors ── */
  "err.network":    { en: "Network problem. Please try again.",
                      zh: "网络问题，请重试。",
                      ar: "مشكلة في الشبكة. جرّب تاني." },
  "err.generic":    { en: "Could not send the request. Please try again.",
                      zh: "无法发送请求，请重试。",
                      ar: "مانفعش نبعت الطلب. جرّب تاني." },
};
