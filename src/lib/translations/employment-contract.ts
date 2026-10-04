/* employment-contract — the clauses of the Koleex employment contract in the
 * three house languages. {placeholders} are filled by the document from the
 * employee record, the salary register and the country policy. Each language
 * is a complete contract on its own (the owner asked for "print multi-page in
 * 3 languages", not a trilingual sheet).
 */
import type { Lang } from "@/lib/i18n";

export interface ContractCopy {
  title: string;
  preamble: string;
  employer: string;
  employee: string;
  articles: Array<{ title: string; body: string }>;
  signatures: { employer: string; employee: string; date: string; name: string; sign: string };
  pageOf: string; // "Page {n} of {m}"
  meta: { date: string; number: string; position: string; start: string };
  weekdays: string[]; // Sunday..Saturday
  na: string;
}

export const EMPLOYMENT_CONTRACT: Record<Lang, ContractCopy> = {
  en: {
    title: "EMPLOYMENT CONTRACT",
    preamble: "This Employment Contract is made on {date} between the Employer and the Employee named below, who agree to the following terms.",
    employer: "Employer", employee: "Employee",
    meta: { date: "Date", number: "Employee No", position: "Position", start: "Start date" },
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    na: "—",
    articles: [
      { title: "1. Position and duties", body: "The Employer engages the Employee as {position} in the {department} department, based at the Employer's {workLocation} in {workCountry}. The Employee shall perform the duties of the position with diligence and in accordance with the Employer's policies, and may be assigned related duties consistent with the position." },
      { title: "2. Term and probation", body: "Employment begins on {hireDate}{contractEndClause}. The first period of employment, ending on {probationEnd}, is a probationary period during which either party may end the employment with the notice required by law. Confirmation after probation is recorded by the Employer in writing." },
      { title: "3. Working hours and rest days", body: "Normal working hours are {workStart} to {workEnd} ({minHours} hours a day) in the {timezone} zone. The weekly rest days are {weekend}. Public holidays follow the official calendar of {workCountry}. Overtime is worked only at the Employer's request and is compensated according to the Employer's payroll rules and applicable law." },
      { title: "4. Remuneration", body: "The Employee receives a {frequency} salary of {salary}{allowancesClause}, paid in arrears through the Employer's payroll after the statutory deductions and contributions of {workCountry}. Salary is reviewed by the Employer periodically; any change is recorded in the salary register and takes effect from the date recorded there." },
      { title: "5. Leave", body: "The Employee is entitled to {annualLeave} working days of paid annual leave per year, in addition to public holidays, and to sick, maternity/paternity and other leave as provided by the Employer's leave policy and applicable law. Leave is requested through the Employer's HR system and is subject to approval by the direct manager and HR." },
      { title: "6. Confidentiality and intellectual property", body: "The Employee shall keep confidential all non-public information of the Employer, its customers and its suppliers — including prices, costs, supplier identities, customer lists, product designs and technical data — during and after employment. Work product created in the course of employment belongs to the Employer. The Employee shall return all Employer property and data on the last day of employment." },
      { title: "7. Conduct and policies", body: "The Employee shall comply with the Employer's code of conduct, attendance policy, information-security rules and the instructions of the direct manager, and shall not engage in any activity that competes with or conflicts with the interests of the Employer without written consent." },
      { title: "8. Termination", body: "Either party may terminate this Contract by giving the notice required by the law of {workCountry}, in writing. The Employer may terminate without notice for serious misconduct as defined by law. On termination the Employer settles the salary and any accrued leave due up to the last day of employment." },
      { title: "9. Governing law", body: "This Contract is governed by the employment law of {workCountry}. Where a term of this Contract is less favourable to the Employee than a mandatory provision of that law, the provision of the law applies in its place." },
      { title: "10. Entire agreement", body: "This Contract, together with the Employer's policies as amended from time to time, is the entire agreement between the parties on the subject of employment and replaces any earlier understanding. Amendments are valid only in writing signed by both parties." },
    ],
    signatures: { employer: "For the Employer", employee: "The Employee", date: "Date", name: "Name", sign: "Signature" },
    pageOf: "Page {n} of {m}",
  },
  zh: {
    title: "劳动合同",
    preamble: "本劳动合同于 {date} 由下列用人单位与劳动者签订，双方同意遵守以下条款。",
    employer: "用人单位", employee: "劳动者",
    meta: { date: "日期", number: "工号", position: "职位", start: "入职日期" },
    weekdays: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
    na: "—",
    articles: [
      { title: "第一条 岗位与职责", body: "用人单位聘用劳动者担任 {department} 部门的 {position}，工作地点为用人单位位于 {workCountry} 的 {workLocation}。劳动者应勤勉履行岗位职责，遵守用人单位的各项制度，并可被安排与岗位相符的相关工作。" },
      { title: "第二条 合同期限与试用期", body: "劳动关系自 {hireDate} 起建立{contractEndClause}。至 {probationEnd} 止为试用期，试用期内任何一方均可依法定通知期解除劳动关系。试用期满后由用人单位书面确认转正。" },
      { title: "第三条 工作时间与休息日", body: "正常工作时间为 {workStart} 至 {workEnd}（每日 {minHours} 小时，按 {timezone} 时区计）。每周休息日为 {weekend}。法定节假日按 {workCountry} 官方日历执行。加班须经用人单位安排，并按用人单位薪酬规则及适用法律给予补偿。" },
      { title: "第四条 薪酬", body: "劳动者薪酬为每{frequency} {salary}{allowancesClause}，经 {workCountry} 法定扣缴后通过用人单位薪酬系统发放。用人单位定期审核薪酬；任何调整以薪酬登记为准，自登记之日起生效。" },
      { title: "第五条 假期", body: "劳动者每年享有 {annualLeave} 个工作日的带薪年假（法定节假日除外），并依用人单位假期制度及适用法律享有病假、产假/陪产假及其他假期。休假须通过用人单位人事系统申请，并经直属主管及人事批准。" },
      { title: "第六条 保密与知识产权", body: "劳动者在职期间及离职后，应对用人单位及其客户、供应商的一切非公开信息保密，包括价格、成本、供应商身份、客户名单、产品设计及技术资料。职务成果归用人单位所有。劳动者应于离职当日归还用人单位全部财产与数据。" },
      { title: "第七条 行为规范", body: "劳动者应遵守用人单位的行为准则、考勤制度、信息安全规定及直属主管的指示，未经书面同意不得从事与用人单位利益相竞争或冲突的活动。" },
      { title: "第八条 合同解除", body: "任何一方均可按 {workCountry} 法律规定的通知期以书面形式解除本合同。劳动者有法律规定的严重违纪行为的，用人单位可即时解除。解除时用人单位结清至最后工作日的薪酬及应享未休假期。" },
      { title: "第九条 适用法律", body: "本合同适用 {workCountry} 劳动法律。本合同任何条款低于该法律强制性规定的，以法律规定为准。" },
      { title: "第十条 完整协议", body: "本合同连同用人单位不时修订的各项制度构成双方关于劳动关系的全部协议，并取代此前的任何约定。任何修改须经双方书面签署方为有效。" },
    ],
    signatures: { employer: "用人单位（盖章）", employee: "劳动者", date: "日期", name: "姓名", sign: "签字" },
    pageOf: "第 {n} 页，共 {m} 页",
  },
  ar: {
    title: "عقد عمل",
    preamble: "حُرِّر عقد العمل هذا بتاريخ {date} بين صاحب العمل والموظف المذكورين أدناه، اللذين اتفقا على الشروط التالية.",
    employer: "صاحب العمل", employee: "الموظف",
    meta: { date: "التاريخ", number: "رقم الموظف", position: "المنصب", start: "تاريخ البدء" },
    weekdays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    na: "—",
    articles: [
      { title: "١. المنصب والمهام", body: "يعيّن صاحب العمل الموظف بوظيفة {position} في قسم {department}، ومقر عمله {workLocation} التابع لصاحب العمل في {workCountry}. يؤدي الموظف مهام وظيفته بعناية ووفق سياسات صاحب العمل، ويجوز تكليفه بمهام ذات صلة تتفق مع منصبه." },
      { title: "٢. مدة العقد وفترة الاختبار", body: "يبدأ العمل في {hireDate}{contractEndClause}. تُعد الفترة الأولى المنتهية في {probationEnd} فترة اختبار يجوز خلالها لأي من الطرفين إنهاء العمل بالإخطار الذي يقرره القانون. يُثبت صاحب العمل التثبيت بعد فترة الاختبار كتابةً." },
      { title: "٣. ساعات العمل وأيام الراحة", body: "ساعات العمل المعتادة من {workStart} إلى {workEnd} ({minHours} ساعات يومياً) بتوقيت {timezone}. أيام الراحة الأسبوعية هي {weekend}. تُتبع العطلات الرسمية وفق التقويم الرسمي لـ{workCountry}. لا يُؤدَّى العمل الإضافي إلا بطلب صاحب العمل ويُعوَّض وفق قواعد الرواتب لدى صاحب العمل والقانون المطبَّق." },
      { title: "٤. الأجر", body: "يتقاضى الموظف أجراً {frequency} قدره {salary}{allowancesClause}، يُدفع عن المدة المنقضية من خلال نظام الرواتب لدى صاحب العمل بعد الاستقطاعات والاشتراكات القانونية في {workCountry}. يراجع صاحب العمل الأجر دورياً، ويُثبت أي تغيير في سجل الرواتب ويسري من التاريخ المسجل فيه." },
      { title: "٥. الإجازات", body: "يستحق الموظف {annualLeave} يوم عمل إجازة سنوية مدفوعة الأجر كل عام، إضافة إلى العطلات الرسمية، وإجازات مرضية وأمومة/أبوة وغيرها وفق سياسة الإجازات لدى صاحب العمل والقانون المطبَّق. تُطلب الإجازة عبر نظام الموارد البشرية وتخضع لموافقة المدير المباشر والموارد البشرية." },
      { title: "٦. السرية والملكية الفكرية", body: "يلتزم الموظف بالحفاظ على سرية كل المعلومات غير العلنية الخاصة بصاحب العمل وعملائه ومورّديه — بما فيها الأسعار والتكاليف وهويات المورّدين وقوائم العملاء وتصاميم المنتجات والبيانات الفنية — أثناء العمل وبعده. يعود ناتج العمل المُنجز خلال العمل إلى صاحب العمل. يعيد الموظف كل ممتلكات صاحب العمل وبياناته في آخر يوم عمل." },
      { title: "٧. السلوك والسياسات", body: "يلتزم الموظف بمدونة السلوك وسياسة الحضور وقواعد أمن المعلومات لدى صاحب العمل وبتعليمات مديره المباشر، ولا يمارس أي نشاط ينافس مصالح صاحب العمل أو يتعارض معها دون موافقة كتابية." },
      { title: "٨. إنهاء العقد", body: "يجوز لأي من الطرفين إنهاء هذا العقد كتابةً بالإخطار الذي يقرره قانون {workCountry}. ويجوز لصاحب العمل الإنهاء دون إخطار في حالات الإخلال الجسيم المحددة قانوناً. عند الإنهاء يسوّي صاحب العمل الأجر وأي إجازات مستحقة حتى آخر يوم عمل." },
      { title: "٩. القانون الواجب التطبيق", body: "يخضع هذا العقد لقانون العمل في {workCountry}. وإذا كان أي شرط فيه أقل مزيةً للموظف من نص آمر في ذلك القانون، حلّ نص القانون محله." },
      { title: "١٠. الاتفاق الكامل", body: "يشكّل هذا العقد مع سياسات صاحب العمل بصيغتها المعدَّلة من وقت لآخر كامل الاتفاق بين الطرفين بشأن العمل، ويحل محل أي تفاهم سابق. لا تصح التعديلات إلا كتابةً وبتوقيع الطرفين." },
    ],
    signatures: { employer: "عن صاحب العمل", employee: "الموظف", date: "التاريخ", name: "الاسم", sign: "التوقيع" },
    pageOf: "صفحة {n} من {m}",
  },
};
