import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the compliance & control templates
   (Phase 5D). */
const SIGN = { en: "Your signature", zh: "你的签名", ar: "توقيعك" };
const ACTIONS = { en: "Follow-ups", zh: "后续行动", ar: "المتابعات" };
const ACTIONS_HINT = { en: "One per line — what, who, and by when.", zh: "每行一项——什么事、由谁、何时之前。", ar: "واحدة في كل سطر — إيه، مين، ولحد إمتى." };

const words: Translations = {
  "tpl.cmp_conflict.s.kind": { en: "What you declare", zh: "申报内容", ar: "بتقرّ بإيه" },
  "tpl.cmp_conflict.s.kind.o.none": { en: "No conflict of interest", zh: "无利益冲突", ar: "مفيش تعارض مصالح" },
  "tpl.cmp_conflict.s.kind.o.family": { en: "A family member or relative", zh: "家人或亲属", ar: "حد من العيلة أو قريب" },
  "tpl.cmp_conflict.s.kind.o.financial": { en: "A financial interest", zh: "经济利益", ar: "مصلحة مالية" },
  "tpl.cmp_conflict.s.kind.o.outside_work": { en: "Work outside the company", zh: "公司以外的工作", ar: "شغل برّه الشركة" },
  "tpl.cmp_conflict.s.kind.o.gift": { en: "A gift or hospitality", zh: "礼品或招待", ar: "هدية أو عزومة" },
  "tpl.cmp_conflict.s.kind.o.other": { en: "Something else", zh: "其他", ar: "حاجة تانية" },
  "tpl.cmp_conflict.s.details": { en: "Details", zh: "详情", ar: "التفاصيل" },
  "tpl.cmp_conflict.s.details.hint": { en: "Who, your relationship, since when, and the decisions it could touch.", zh: "涉及谁、你们的关系、从何时开始，以及可能影响的决定。", ar: "مين، علاقتك بيه، من إمتى، والقرارات اللي ممكن يأثر عليها." },
  "tpl.cmp_conflict.s.parties": { en: "The customer or supplier it is about", zh: "涉及的客户或供应商", ar: "العميل أو المورد المقصود" },
  "tpl.cmp_conflict.s.measures": { en: "What you propose", zh: "你的建议", ar: "إنت بتقترح إيه" },
  "tpl.cmp_conflict.s.measures.hint": { en: "For example: someone else decides on this supplier.", zh: "例如：由其他人负责该供应商的决定。", ar: "مثلًا: حد تاني ياخد القرار في المورد ده." },
  "tpl.cmp_conflict.s.sign": SIGN,

  "tpl.cmp_equipment.s.what": { en: "What happened to it", zh: "发生了什么", ar: "حصله إيه" },
  "tpl.cmp_equipment.s.what.o.lost": { en: "Lost", zh: "丢失", ar: "ضاع" },
  "tpl.cmp_equipment.s.what.o.damaged": { en: "Damaged", zh: "损坏", ar: "باظ" },
  "tpl.cmp_equipment.s.what.o.stolen": { en: "Stolen", zh: "被盗", ar: "اتسرق" },
  "tpl.cmp_equipment.s.item": { en: "The item", zh: "物品", ar: "الحاجة" },
  "tpl.cmp_equipment.s.item.hint": { en: "What it is, and its serial number or asset tag.", zh: "物品名称及序列号或资产编号。", ar: "هي إيه، ورقمها التسلسلي أو رقم العهدة." },
  "tpl.cmp_equipment.s.when_where": { en: "When and where", zh: "时间和地点", ar: "إمتى وفين" },
  "tpl.cmp_equipment.s.how": { en: "How it happened", zh: "经过", ar: "حصل إزاي" },
  "tpl.cmp_equipment.s.steps": { en: "What was done", zh: "已采取的措施", ar: "اتعمل إيه" },
  "tpl.cmp_equipment.s.steps.i.manager_told": { en: "The manager was told", zh: "已告知经理", ar: "المدير عرف" },
  "tpl.cmp_equipment.s.steps.i.police_report": { en: "Reported to the police", zh: "已报警", ar: "اتعمل محضر" },
  "tpl.cmp_equipment.s.steps.i.insurer_told": { en: "The insurer was told", zh: "已通知保险公司", ar: "شركة التأمين عرفت" },
  "tpl.cmp_equipment.s.steps.i.data_wiped": { en: "A device's data was locked or wiped", zh: "设备数据已锁定或清除", ar: "بيانات الجهاز اتقفلت أو اتمسحت" },
  "tpl.cmp_equipment.s.steps.i.replacement_asked": { en: "A replacement was asked for", zh: "已申请更换", ar: "اتطلب بديل" },
  "tpl.cmp_equipment.s.sign": SIGN,

  "tpl.cmp_security.s.kind": { en: "What kind of incident", zh: "事件类型", ar: "نوع الحادثة" },
  "tpl.cmp_security.s.kind.o.phishing": { en: "A suspicious message or link", zh: "可疑邮件或链接", ar: "رسالة أو لينك مشبوه" },
  "tpl.cmp_security.s.kind.o.password": { en: "A password seen or shared", zh: "密码泄露或被共享", ar: "باسورد اتعرف أو اتشارك" },
  "tpl.cmp_security.s.kind.o.device": { en: "A lost or stolen device", zh: "设备丢失或被盗", ar: "جهاز ضاع أو اتسرق" },
  "tpl.cmp_security.s.kind.o.data_leak": { en: "Company data went out", zh: "公司数据外泄", ar: "بيانات الشركة طلعت برّه" },
  "tpl.cmp_security.s.kind.o.malware": { en: "A virus or harmful program", zh: "病毒或恶意程序", ar: "فيروس أو برنامج ضار" },
  "tpl.cmp_security.s.kind.o.access": { en: "Access someone should not have", zh: "不应有的访问权限", ar: "صلاحية مكانش المفروض تبقى معاه" },
  "tpl.cmp_security.s.kind.o.other": { en: "Something else", zh: "其他", ar: "حاجة تانية" },
  "tpl.cmp_security.s.what": { en: "What happened", zh: "发生了什么", ar: "إيه اللي حصل" },
  "tpl.cmp_security.s.when": { en: "When it happened, and when you noticed", zh: "发生时间及发现时间", ar: "حصل إمتى، وإنت خدت بالك إمتى" },
  "tpl.cmp_security.s.affected": { en: "What was affected", zh: "受影响的范围", ar: "إيه اللي اتأثر" },
  "tpl.cmp_security.s.affected.hint": { en: "Accounts, devices, files, customers — as far as you know.", zh: "账户、设备、文件、客户——就你所知。", ar: "حسابات، أجهزة، ملفات، عملاء — على قد ما تعرف." },
  "tpl.cmp_security.s.steps": { en: "What was done", zh: "已采取的措施", ar: "اتعمل إيه" },
  "tpl.cmp_security.s.steps.i.password_changed": { en: "Passwords changed", zh: "已修改密码", ar: "الباسوردات اتغيرت" },
  "tpl.cmp_security.s.steps.i.signed_out": { en: "Signed out everywhere", zh: "已在所有设备退出登录", ar: "اتعمل خروج من كل الأجهزة" },
  "tpl.cmp_security.s.steps.i.device_locked": { en: "The device was locked or wiped", zh: "设备已锁定或清除", ar: "الجهاز اتقفل أو اتمسح" },
  "tpl.cmp_security.s.steps.i.admin_told": { en: "The system admin was told", zh: "已通知系统管理员", ar: "أدمن السيستم عرف" },
  "tpl.cmp_security.s.steps.i.customers_told": { en: "The customers affected were told", zh: "已通知受影响的客户", ar: "العملاء اللي اتأثروا عرفوا" },
  "tpl.cmp_security.s.prevent": { en: "How it won't happen again", zh: "如何防止再次发生", ar: "إزاي ما يتكررش" },

  "tpl.cmp_access_review.s.accounts": { en: "Who holds what", zh: "谁拥有哪些权限", ar: "مين معاه إيه" },
  "tpl.cmp_access_review.s.changes": { en: "What should change", zh: "需要调整的权限", ar: "إيه اللي لازم يتغير" },
  "tpl.cmp_access_review.s.changes.hint": { en: "One per line — the account, the right, and why (a job changed, someone left).", zh: "每行一项——账户、权限及原因（岗位变动、有人离职）。", ar: "واحدة في كل سطر — الحساب، والصلاحية، وليه (الشغل اتغير، حد مشي)." },
  "tpl.cmp_access_review.s.sign": { en: "Reviewed by", zh: "审核人", ar: "اتراجع بواسطة" },

  "tpl.cmp_usage.s.usage": { en: "Who used the Hub, and how much", zh: "谁在使用系统、使用多少", ar: "مين استخدم السيستم، وقد إيه" },
  "tpl.cmp_usage.s.summary": { en: "What stands out", zh: "值得注意的情况", ar: "إيه اللي لافت للنظر" },
  "tpl.cmp_usage.s.summary.hint": { en: "Who barely uses it, and where training or help would pay off.", zh: "谁几乎不用，哪里需要培训或帮助。", ar: "مين بالكاد بيستخدمه، وفين التدريب أو المساعدة هتفرق." },
  "tpl.cmp_usage.s.actions": ACTIONS,
  "tpl.cmp_usage.s.actions.hint": ACTIONS_HINT,

  "tpl.cmp_car_log.s.trips": { en: "The trips", zh: "行程记录", ar: "المشاوير" },
  "tpl.cmp_car_log.s.trips.c.date": { en: "Date", zh: "日期", ar: "التاريخ" },
  "tpl.cmp_car_log.s.trips.c.from": { en: "From", zh: "出发地", ar: "من" },
  "tpl.cmp_car_log.s.trips.c.to": { en: "To", zh: "目的地", ar: "لـ" },
  "tpl.cmp_car_log.s.trips.c.purpose": { en: "Purpose", zh: "事由", ar: "الغرض" },
  "tpl.cmp_car_log.s.trips.c.km": { en: "Km", zh: "公里", ar: "كم" },
  "tpl.cmp_car_log.s.trips.c.amount": { en: "Amount", zh: "金额", ar: "المبلغ" },
  "tpl.cmp_car_log.s.notes": { en: "Notes", zh: "备注", ar: "ملاحظات" },
  "tpl.cmp_car_log.s.notes.hint": { en: "Fuel, parking or tolls not in the table, and the rate per km you used.", zh: "表格以外的油费、停车费或过路费，以及你采用的每公里费率。", ar: "بنزين أو ركنة أو كارتة مش في الجدول، وسعر الكيلو اللي حسبت بيه." },
  "tpl.cmp_car_log.s.sign": SIGN,

  "tpl.cmp_contracts.s.dates": { en: "Deliveries due and warranties ending", zh: "即将到期的交货与保修", ar: "تسليمات قرّبت وضمانات بتخلص" },
  "tpl.cmp_contracts.s.summary": { en: "What needs doing", zh: "需要处理的事项", ar: "محتاجين نعمل إيه" },
  "tpl.cmp_contracts.s.summary.hint": { en: "A late delivery to warn the customer about, a warranty to renew or close.", zh: "需要提前告知客户的延迟交货，需要续期或结束的保修。", ar: "تسليم هيتأخر ولازم نبلّغ العميل، ضمان محتاج يتجدد أو يتقفل." },
  "tpl.cmp_contracts.s.actions": ACTIONS,
  "tpl.cmp_contracts.s.actions.hint": ACTIONS_HINT,
};

export default words;
