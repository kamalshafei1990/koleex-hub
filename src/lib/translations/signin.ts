import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Sign-in screen — English / 中文 / العربية.

   WHY THIS EXISTS. Every other screen in the Hub can be read in three
   languages, and the switcher lives in the header — which does not exist
   until you are already inside. So the one screen a person meets BEFORE they
   can be helped was the only one they could not read. A colleague in China or
   in Egypt who does not read English was stopped at the door with no way to
   even ask for help, because the help link was in English too.
   --------------------------------------------------------------------------- */

export const signInT: Translations = {

  /* ── Brand ── */
  /* The HUB's slogan, owner's pick 2026-08-10. "Shaping the Future" is the
     GROUP's line and stays on the website and print — two slogans on one
     screen is one too many, and this screen is the Hub. */
  "tagline":        { en: "Work Smarter. Together.",
                      zh: "智慧工作 · 携手同行",
                      ar: "نعمل بذكاء. معًا." },
  "footer":         { en: "Koleex International Group · Authorized Access Only",
                      zh: "Koleex International Group · 仅限授权访问",
                      ar: "Koleex International Group · الدخول للمصرّح لهم فقط" },

  /* ── Tabs ── */
  "tab.signIn":     { en: "Sign In", zh: "登录", ar: "تسجيل الدخول" },
  "tab.join":       { en: "Become Koleex Member", zh: "成为 Koleex 会员", ar: "كن عضوًا في Koleex" },

  /* ── Sign-in panel ── */
  "welcome":        { en: "Welcome back", zh: "欢迎回来", ar: "أهلاً بعودتك" },
  "welcomeSub":     { en: "Sign in to your Koleex Hub account.",
                      zh: "登录您的 Koleex Hub 账户。",
                      ar: "سجّل الدخول إلى حسابك في Koleex Hub." },
  "username":       { en: "Username", zh: "用户名", ar: "اسم المستخدم" },
  "password":       { en: "Password", zh: "密码", ar: "كلمة المرور" },
  "signIn":         { en: "Sign In", zh: "登录", ar: "دخول" },
  "signingIn":      { en: "Signing in…", zh: "正在登录…", ar: "جارٍ الدخول…" },
  "help.link":      { en: "Having trouble? Contact your Koleex administrator.",
                      zh: "遇到问题？联系您的 Koleex 管理员。",
                      ar: "فيه مشكلة؟ تواصل مع مسؤول Koleex." },

  /* NOT "remember me". The Hub already remembers you — the session cookie
     runs 30 days — so a "remember me" box would either do nothing or force us
     to shorten the default for everyone who does not tick it. The control that
     is actually missing is the opposite one, for the office machine that four
     people share. */
  "signIn.shared":     { en: "This is a shared computer",
                         zh: "这是公用电脑",
                         ar: "الجهاز ده مشترك" },
  "signIn.sharedHint": { en: "Sign out automatically when the browser closes",
                         zh: "关闭浏览器后自动退出登录",
                         ar: "الخروج تلقائيًا لما المتصفح يتقفل" },

  /* ── Help dialog ── */
  "help.title":     { en: "Request help", zh: "请求帮助", ar: "طلب مساعدة" },
  "help.problem":   { en: "What is the problem?", zh: "遇到什么问题？", ar: "إيه المشكلة؟" },
  "help.p.forgot_password":   { en: "I forgot my password", zh: "我忘记了密码", ar: "نسيت كلمة المرور" },
  "help.p.forgot_username":   { en: "I forgot my username", zh: "我忘记了用户名", ar: "نسيت اسم المستخدم" },
  "help.p.account_locked":    { en: "My account is locked", zh: "我的账户被锁定", ar: "حسابي مقفول" },
  "help.p.account_disabled":  { en: "My account no longer works", zh: "账户无法使用", ar: "حسابي مابقاش شغّال" },
  "help.p.no_account":        { en: "I don't have an account yet", zh: "我还没有账户", ar: "لسه ماعنديش حساب" },
  "help.p.code_not_received": { en: "I can't receive my code", zh: "我收不到验证码", ar: "مش بيوصلني الكود" },
  "help.p.no_app_access":     { en: "I need an app I can't see", zh: "需要看不到的应用", ar: "محتاج تطبيق مش ظاهر" },
  "help.p.password_expired":  { en: "Password change won't complete",
                                zh: "无法完成密码修改",
                                ar: "تغيير كلمة المرور مش بيكمّل" },
  "help.p.contact_changed":   { en: "My phone or email changed",
                                zh: "手机号或邮箱已更改",
                                ar: "رقمي أو إيميلي اتغيّر" },
  "help.p.error_message":     { en: "I'm getting an error message", zh: "出现错误提示", ar: "بتطلعلي رسالة خطأ" },
  "help.country":             { en: "Country", zh: "国家", ar: "الدولة" },
  "help.p.hub_not_loading":   { en: "The Hub won't load", zh: "Hub 无法加载", ar: "الهب مش بيفتح" },
  "help.p.suspicious_activity": { en: "Someone else used my account",
                                zh: "他人使用了我的账户",
                                ar: "حد تاني دخل على حسابي" },
  "help.p.other":             { en: "Something else", zh: "其他问题", ar: "حاجة تانية" },
  "help.pick":                { en: "Choose…", zh: "请选择…", ar: "اختر…" },
  "help.username":            { en: "Your username (if you know it)",
                                zh: "您的用户名（如果知道）",
                                ar: "اسم المستخدم (لو فاكره)" },
  "help.company":             { en: "Company or department (optional)",
                                zh: "公司或部门（选填）",
                                ar: "الشركة أو القسم (اختياري)" },
  "help.urgent":              { en: "We treat this as urgent.",
                                zh: "我们会作为紧急事项处理。",
                                ar: "بنتعامل مع ده كحالة عاجلة." },
  "help.describe":  { en: "Describe the problem", zh: "描述问题", ar: "اوصف المشكلة" },
  "help.optional":  { en: "Anything else? (optional)", zh: "其他补充？（选填）", ar: "أي تفاصيل تانية؟ (اختياري)" },
  "help.ph.describe": { en: "Tell us what happened…", zh: "告诉我们发生了什么…", ar: "قولنا إيه اللي حصل…" },
  "help.ph.detail": { en: "Add any detail that would help…", zh: "补充任何有用的信息…", ar: "أضف أي تفصيلة تفيد…" },
  "help.name":      { en: "Full name", zh: "姓名", ar: "الاسم بالكامل" },
  "help.email":     { en: "Email", zh: "电子邮箱", ar: "البريد الإلكتروني" },
  "help.phone":     { en: "Phone", zh: "电话", ar: "رقم التليفون" },
  "help.send":      { en: "Send request", zh: "发送请求", ar: "إرسال الطلب" },
  "help.sending":   { en: "Sending…", zh: "发送中…", ar: "جارٍ الإرسال…" },
  "help.privacy":   { en: "Your details go to the Koleex administrators only.",
                      zh: "您的信息仅发送给 Koleex 管理员。",
                      ar: "بياناتك بتروح لمسؤولي Koleex بس." },
  "help.sentTitle": { en: "Request sent", zh: "请求已发送", ar: "الطلب اتبعت" },
  "help.sentHead":  { en: "We have your request", zh: "我们已收到您的请求", ar: "طلبك وصلنا" },
  "help.sentBody":  { en: "A Koleex administrator will contact you on the details you gave.",
                      zh: "Koleex 管理员将通过您提供的联系方式与您联系。",
                      ar: "مسؤول من Koleex هيتواصل معاك على البيانات اللي كتبتها." },
  "help.reference": { en: "Your reference", zh: "您的编号", ar: "رقمك المرجعي" },
  "help.close":     { en: "Close", zh: "关闭", ar: "إغلاق" },

  /* ── Join panel ── */
  "join.title":     { en: "New here?", zh: "第一次来？", ar: "أول مرة معانا؟" },
  "join.sub":       { en: "Tell us about you and we'll be in touch.",
                      zh: "介绍一下您自己，我们会与您联系。",
                      ar: "عرّفنا بنفسك وهنتواصل معاك." },
  "join.doneTitle": { en: "Request received", zh: "已收到请求", ar: "الطلب اتستلم" },
  /* "administrator", not "Super Admin": Admins review these too now, and the
     applicant should not be told to expect a specific rank. */
  "join.doneSub":   { en: "A Koleex administrator will review your request and reply within 1–3 working days.",
                      zh: "Koleex 管理员将审核您的请求，并在 1–3 个工作日内答复。",
                      ar: "مسؤول من Koleex هيراجع طلبك والرد هيوصلك خلال ١–٣ أيام عمل." },
  "join.doneKeepRef": { en: "Keep this reference — quote it if you contact us about your application.",
                        zh: "请保存此编号，如就申请与我们联系时请提供。",
                        ar: "احتفظ بالرقم ده — قوله لو اتواصلت معانا بخصوص طلبك." },
  "join.reference": { en: "Your reference", zh: "您的编号", ar: "رقمك المرجعي" },
};
