import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the HR templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */

/* Phase 5C: words several of the HR types share. */
const EMPLOYEE = { en: "Employee", zh: "员工", ar: "الموظف" };
const CANDIDATE = { en: "Candidate", zh: "候选人", ar: "المرشح" };
const NOTES = { en: "Notes", zh: "备注", ar: "ملاحظات" };
const BUDGET = { en: "Budget", zh: "预算", ar: "الميزانية" };
const ITEM = { en: "Item", zh: "项目", ar: "البند" };
const MONTH = { en: "The month in short", zh: "本月概况", ar: "الشهر باختصار" };
const READING = { en: "What the numbers say", zh: "数字说明了什么", ar: "الأرقام بتقول إيه" };
const ACTIONS = { en: "What we will do", zh: "后续措施", ar: "هنعمل إيه" };
const WHO_BY = { en: "What, who and by when — one per line.", zh: "什么事、谁负责、何时之前——每行一项。", ar: "إيه، ومين، ولحد إمتى — كل حاجة في سطر." };
const ONBOARDING_STEPS = { en: "Onboarding steps", zh: "入职步骤", ar: "خطوات التعريف" };
const ATTITUDE = { en: "Attitude", zh: "态度", ar: "الحماس والإيجابية" };
const TEAMWORK = { en: "Teamwork", zh: "团队合作", ar: "العمل الجماعي" };
const WORK_QUALITY = { en: "Quality of work", zh: "工作质量", ar: "جودة الشغل" };
const EMPLOYEE_SIGN = { en: "Employee signature", zh: "员工签字", ar: "توقيع الموظف" };

const words: Translations = {
  "tpl.hr_incident.s.what": { en: "What happened", zh: "发生了什么", ar: "إيه اللي حصل" },
  "tpl.hr_incident.s.where_when": { en: "Where and when", zh: "地点和时间", ar: "فين وإمتى" },
  "tpl.hr_incident.s.people": { en: "People involved", zh: "相关人员", ar: "الأشخاص" },
  "tpl.hr_incident.s.action": { en: "What was done", zh: "已采取的措施", ar: "اتعمل إيه" },
  "tpl.hr_grievance.s.subject": { en: "Subject", zh: "主题", ar: "الموضوع" },
  "tpl.hr_grievance.s.details": { en: "Details", zh: "详情", ar: "التفاصيل" },
  "tpl.hr_grievance.s.wanted": { en: "What you would like to happen", zh: "你希望的处理方式", ar: "عايز إيه يحصل" },
  "tpl.hr_warning.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.hr_warning.s.incident": { en: "What happened", zh: "发生了什么", ar: "إيه اللي حصل" },
  "tpl.hr_warning.s.rule": { en: "Rule or policy", zh: "违反的规定", ar: "القاعدة أو السياسة" },
  "tpl.hr_warning.s.action": { en: "Action and next step", zh: "处理及后续", ar: "الإجراء والخطوة الجاية" },
  "tpl.hr_exit_interview.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.hr_exit_interview.s.reasons": { en: "Reasons for leaving", zh: "离职原因", ar: "أسباب المشي" },
  "tpl.hr_exit_interview.s.liked": { en: "What they liked", zh: "喜欢的方面", ar: "اللي كان عاجبه" },
  "tpl.hr_exit_interview.s.improve": { en: "What we should improve", zh: "需要改进的地方", ar: "اللي نحسنه" },
  "tpl.hr_exit_interview.s.return": { en: "Would they come back?", zh: "是否愿意回来？", ar: "ممكن يرجع؟" },
  "tpl.probation_review.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.probation_review.s.performance": { en: "How they did", zh: "工作表现", ar: "أداؤه كان عامل إزاي" },
  "tpl.probation_review.s.strengths": { en: "Strengths", zh: "优点", ar: "نقاط القوة" },
  "tpl.probation_review.s.concerns": { en: "Concerns", zh: "需要改进之处", ar: "ملاحظات أو مخاوف" },
  "tpl.probation_review.s.recommendation": { en: "Recommendation: confirm, extend or end", zh: "建议：转正、延长或终止", ar: "رأيك: تثبيت، تمديد، ولا إنهاء" },

  /* ── Phase 5C: hiring ── */
  "tpl.hr_hiring_plan.s.roles": { en: "Jobs needed", zh: "所需职位", ar: "الوظايف المطلوبة" },
  "tpl.hr_hiring_plan.s.roles.c.role": { en: "Job", zh: "职位", ar: "الوظيفة" },
  "tpl.hr_hiring_plan.s.roles.c.department": { en: "Department", zh: "部门", ar: "القسم" },
  "tpl.hr_hiring_plan.s.roles.c.count": { en: "How many", zh: "人数", ar: "العدد" },
  "tpl.hr_hiring_plan.s.roles.c.needed_by": { en: "Needed by", zh: "到岗日期", ar: "مطلوب لحد" },
  "tpl.hr_hiring_plan.s.roles.c.reason": { en: "Reason", zh: "原因", ar: "السبب" },
  "tpl.hr_hiring_plan.s.summary": { en: "The plan in short", zh: "计划概要", ar: "الخطة باختصار" },
  "tpl.hr_hiring_plan.s.summary.hint": { en: "How many people, for which teams, and why now.", zh: "招多少人、为哪些团队、为什么是现在。", ar: "كام واحد، لأنهي فرق، وليه دلوقتي." },
  "tpl.hr_hiring_plan.s.budget": BUDGET,
  "tpl.hr_hiring_plan.s.budget.hint": { en: "What the new people will cost, and whether the budget covers it.", zh: "新增人员的成本，以及预算是否够用。", ar: "الناس الجديدة هتتكلف كام، والميزانية تكفي ولا لأ." },

  "tpl.hr_pipeline.s.pipeline": { en: "Open jobs and candidates", zh: "在招职位和候选人", ar: "الوظايف المفتوحة والمرشحين" },
  "tpl.hr_pipeline.s.summary": { en: "This week in hiring", zh: "本周招聘情况", ar: "التوظيف الأسبوع ده" },
  "tpl.hr_pipeline.s.summary.hint": { en: "Where each job stands, and anything stuck.", zh: "各职位进展到哪一步，有没有卡住的。", ar: "كل وظيفة وصلت لفين، وأي حاجة واقفة." },
  "tpl.hr_pipeline.s.next": { en: "Next steps", zh: "下一步", ar: "الخطوات الجاية" },
  "tpl.hr_pipeline.s.next.hint": { en: "Interviews to book, offers to send — one per line.", zh: "要安排的面试、要发出的录用通知——每行一项。", ar: "مقابلات نحجزها، وعروض نبعتها — كل حاجة في سطر." },

  "tpl.hr_interview.s.candidate": CANDIDATE,
  "tpl.hr_interview.s.candidate.hint": { en: "Full name, and how they applied.", zh: "全名及应聘渠道。", ar: "الاسم بالكامل، واتقدم إزاي." },
  "tpl.hr_interview.s.role": { en: "Job applied for", zh: "应聘职位", ar: "الوظيفة اللي متقدم لها" },
  "tpl.hr_interview.s.scores": { en: "Scores", zh: "评分", ar: "التقييم" },
  "tpl.hr_interview.s.scores.i.experience": { en: "Experience", zh: "经验", ar: "الخبرة" },
  "tpl.hr_interview.s.scores.i.skills": { en: "Skills", zh: "技能", ar: "المهارات" },
  "tpl.hr_interview.s.scores.i.communication": { en: "Communication", zh: "沟通能力", ar: "التواصل" },
  "tpl.hr_interview.s.scores.i.attitude": ATTITUDE,
  "tpl.hr_interview.s.scores.i.culture": { en: "Culture fit", zh: "文化契合度", ar: "التوافق مع الشركة" },
  "tpl.hr_interview.s.scores.i.language": { en: "Languages", zh: "语言能力", ar: "اللغات" },
  "tpl.hr_interview.s.verdict": { en: "Your verdict", zh: "结论", ar: "رأيك" },
  "tpl.hr_interview.s.verdict.o.hire": { en: "Hire", zh: "录用", ar: "تعيين" },
  "tpl.hr_interview.s.verdict.o.second_interview": { en: "Second interview", zh: "复试", ar: "مقابلة تانية" },
  "tpl.hr_interview.s.verdict.o.keep": { en: "Keep on file", zh: "存档备用", ar: "نحتفظ بالملف" },
  "tpl.hr_interview.s.verdict.o.reject": { en: "Reject", zh: "不录用", ar: "رفض" },
  "tpl.hr_interview.s.notes": NOTES,
  "tpl.hr_interview.s.notes.hint": { en: "What the scores don't show — expected pay, when they can start, any doubts.", zh: "评分体现不了的——期望薪资、何时能到岗、任何顾虑。", ar: "اللي التقييم مش بيبيّنه — المرتب اللي طالبه، يقدر يبدأ إمتى، وأي تحفّظ." },

  "tpl.hr_reference_check.s.candidate": CANDIDATE,
  "tpl.hr_reference_check.s.candidate.hint": { en: "Full name and the job they applied for.", zh: "全名及应聘职位。", ar: "الاسم بالكامل والوظيفة اللي متقدم لها." },
  "tpl.hr_reference_check.s.referees": { en: "Who we spoke to", zh: "联系过的证明人", ar: "كلمنا مين" },
  "tpl.hr_reference_check.s.referees.c.referee": { en: "Name", zh: "姓名", ar: "الاسم" },
  "tpl.hr_reference_check.s.referees.c.company": { en: "Company", zh: "公司", ar: "الشركة" },
  "tpl.hr_reference_check.s.referees.c.relation": { en: "Relationship", zh: "与候选人关系", ar: "علاقته بالمرشح" },
  "tpl.hr_reference_check.s.said": { en: "What they said", zh: "对方评价", ar: "قالوا إيه" },
  "tpl.hr_reference_check.s.said.hint": { en: "Their work, their conduct, why they left — and would they hire them again?", zh: "工作表现、为人、离职原因——是否愿意再次雇用？", ar: "شغله، وأخلاقه، وليه ساب — ويشغّلوه تاني ولا لأ؟" },
  "tpl.hr_reference_check.s.verdict": { en: "Overall", zh: "总体评价", ar: "الخلاصة" },
  "tpl.hr_reference_check.s.verdict.o.positive": { en: "Positive", zh: "正面", ar: "إيجابي" },
  "tpl.hr_reference_check.s.verdict.o.mixed": { en: "Mixed", zh: "好坏参半", ar: "بين وبين" },
  "tpl.hr_reference_check.s.verdict.o.negative": { en: "Negative", zh: "负面", ar: "سلبي" },

  "tpl.hr_offer.s.candidate": CANDIDATE,
  "tpl.hr_offer.s.candidate.hint": { en: "Full name, and how the interviews went.", zh: "全名及面试情况。", ar: "الاسم بالكامل، والمقابلات مشيت إزاي." },
  "tpl.hr_offer.s.role": { en: "Job offered", zh: "录用职位", ar: "الوظيفة المعروضة" },
  "tpl.hr_offer.s.role.hint": { en: "Job title, department and who they report to.", zh: "职位名称、部门及汇报对象。", ar: "اسم الوظيفة، والقسم، وهيتبع مين." },
  "tpl.hr_offer.s.package": { en: "Pay and benefits", zh: "薪资福利", ar: "المرتب والمزايا" },
  "tpl.hr_offer.s.package.c.item": ITEM,
  "tpl.hr_offer.s.package.c.monthly": { en: "Per month", zh: "每月金额", ar: "في الشهر" },
  "tpl.hr_offer.s.start": { en: "Start date", zh: "入职日期", ar: "ميعاد البداية" },
  "tpl.hr_offer.s.start.hint": { en: "When they can start, and the notice their current job needs.", zh: "何时可以入职，现职需要提前多久通知。", ar: "يقدر يبدأ إمتى، وشغله الحالي محتاج مهلة قد إيه." },
  "tpl.hr_offer.s.reason": { en: "Why this offer", zh: "理由", ar: "ليه العرض ده" },
  "tpl.hr_offer.s.reason.hint": { en: "Why this candidate, and why this pay.", zh: "为什么是这位候选人、为什么是这个薪资。", ar: "ليه المرشح ده، وليه المرتب ده." },

  "tpl.hr_onboarding.s.employee": EMPLOYEE,
  "tpl.hr_onboarding.s.steps": ONBOARDING_STEPS,
  "tpl.hr_onboarding.s.setup": { en: "Ready for day one", zh: "首日准备", ar: "التجهيز لأول يوم" },
  "tpl.hr_onboarding.s.setup.i.account": { en: "Account created", zh: "账号已开通", ar: "الحساب اتعمل" },
  "tpl.hr_onboarding.s.setup.i.devices": { en: "Computer and devices handed over", zh: "电脑和设备已交付", ar: "الكمبيوتر والأجهزة اتسلمت" },
  "tpl.hr_onboarding.s.setup.i.email": { en: "Work email set up", zh: "工作邮箱已开通", ar: "إيميل الشغل اتعمل" },
  "tpl.hr_onboarding.s.setup.i.contract": { en: "Contract signed", zh: "合同已签订", ar: "العقد اتمضى" },
  "tpl.hr_onboarding.s.setup.i.id_badge": { en: "ID badge issued", zh: "工牌已发放", ar: "الكارنيه اتسلم" },
  "tpl.hr_onboarding.s.setup.i.introduction": { en: "Introduced to the team", zh: "已介绍给团队", ar: "اتعرّف على الفريق" },
  "tpl.hr_onboarding.s.setup.i.policies": { en: "Company rules explained", zh: "已讲解公司制度", ar: "لوايح الشركة اتشرحت" },
  "tpl.hr_onboarding.s.setup.i.training": { en: "Training planned", zh: "已安排培训", ar: "ميعاد التدريب اتحدد" },
  "tpl.hr_onboarding.s.notes": NOTES,
  "tpl.hr_onboarding.s.notes.hint": { en: "Anything still missing, and who will sort it out.", zh: "还缺什么，由谁负责落实。", ar: "أي حاجة لسه ناقصة، ومين هيخلّصها." },

  "tpl.hr_new_hire.s.employee": EMPLOYEE,
  "tpl.hr_new_hire.s.onboarding": ONBOARDING_STEPS,
  "tpl.hr_new_hire.s.days": { en: "Attendance this week", zh: "本周考勤", ar: "الحضور الأسبوع ده" },
  "tpl.hr_new_hire.s.learned": { en: "What they learned", zh: "学到了什么", ar: "اتعلم إيه" },
  "tpl.hr_new_hire.s.learned.hint": { en: "Systems, products, tasks — one per line.", zh: "系统、产品、任务——每行一项。", ar: "البرامج، المنتجات، المهام — كل حاجة في سطر." },
  "tpl.hr_new_hire.s.support": { en: "Help they need", zh: "需要的帮助", ar: "محتاج مساعدة في إيه" },
  "tpl.hr_new_hire.s.support.hint": { en: "Training, tools, or time with someone who knows the work.", zh: "培训、工具，或与熟悉业务的同事一起工作的时间。", ar: "تدريب، أدوات، أو وقت مع حد فاهم الشغل." },
  "tpl.hr_new_hire.s.rating": { en: "Rating", zh: "评分", ar: "التقييم" },
  "tpl.hr_new_hire.s.rating.i.learning": { en: "Learning speed", zh: "学习速度", ar: "سرعة التعلم" },
  "tpl.hr_new_hire.s.rating.i.quality": WORK_QUALITY,
  "tpl.hr_new_hire.s.rating.i.attitude": ATTITUDE,
  "tpl.hr_new_hire.s.rating.i.teamwork": TEAMWORK,
  "tpl.hr_new_hire.s.manager_view": { en: "Manager's view", zh: "主管意见", ar: "رأي المدير" },
  "tpl.hr_new_hire.s.manager_view.hint": { en: "On track, or what must change before the month ends.", zh: "是否步入正轨，月底前需要调整什么。", ar: "ماشي كويس، ولا محتاج يتغير إيه قبل ما الشهر يخلص." },

  /* ── Phase 5C: time ── */
  "tpl.hr_attendance.s.sheet": { en: "Attendance this month", zh: "本月考勤", ar: "الحضور الشهر ده" },
  "tpl.hr_attendance.s.summary": MONTH,
  "tpl.hr_attendance.s.summary.hint": { en: "Who stands out, good or bad, and any pattern to act on.", zh: "表现突出（好或差）的人，以及需要处理的规律。", ar: "مين ملفت بالحلو أو بالوحش، وأي حاجة بتتكرر محتاجة تصرّف." },

  "tpl.hr_lateness.s.late": { en: "Late and absent this month", zh: "本月迟到和缺勤", ar: "التأخير والغياب الشهر ده" },
  "tpl.hr_lateness.s.summary": READING,
  "tpl.hr_lateness.s.summary.hint": { en: "Who is late or absent most, and why.", zh: "谁迟到或缺勤最多，原因是什么。", ar: "مين أكتر واحد بيتأخر أو بيغيب، وليه." },
  "tpl.hr_lateness.s.actions": ACTIONS,
  "tpl.hr_lateness.s.actions.hint": { en: "A talk, a warning, a schedule change — one per line.", zh: "谈话、警告、调整排班——每行一项。", ar: "قعدة، إنذار، تغيير مواعيد — كل حاجة في سطر." },

  "tpl.hr_leave.s.taken": { en: "Leave this month", zh: "本月休假", ar: "الإجازات الشهر ده" },
  "tpl.hr_leave.s.balances": { en: "Leave balances this year", zh: "今年假期余额", ar: "رصيد الإجازات السنة دي" },
  "tpl.hr_leave.s.summary": MONTH,
  "tpl.hr_leave.s.summary.hint": { en: "Who is away soon, and who has too much leave left.", zh: "谁即将休假，谁剩余假期太多。", ar: "مين هياخد إجازة قريب، ومين رصيده كبير أوي." },

  "tpl.hr_overtime.s.overtime": { en: "Overtime this month", zh: "本月加班", ar: "الأوفرتايم الشهر ده" },
  "tpl.hr_overtime.s.summary": MONTH,
  "tpl.hr_overtime.s.summary.hint": { en: "Who worked the most extra hours, and why.", zh: "谁加班最多，原因是什么。", ar: "مين اشتغل ساعات زيادة أكتر، وليه." },

  /* ── Phase 5C: pay ── */
  "tpl.hr_payroll.s.payslips": { en: "This month's payslips", zh: "本月工资条", ar: "مرتبات الشهر ده" },
  "tpl.hr_payroll.s.summary": MONTH,
  "tpl.hr_payroll.s.summary.hint": { en: "The total against last month, and what moved it.", zh: "总额与上月相比，以及变化的原因。", ar: "الإجمالي قصاد الشهر اللي فات، وإيه اللي غيّره." },
  "tpl.hr_payroll.s.changes": { en: "Changes this month", zh: "本月变动", ar: "التغييرات الشهر ده" },
  "tpl.hr_payroll.s.changes.hint": { en: "Raises, deductions, joiners and leavers — one per line.", zh: "调薪、扣款、入职和离职——每行一项。", ar: "زيادات، خصومات، ناس جت وناس مشيت — كل حاجة في سطر." },

  "tpl.hr_staff_cost.s.cost": { en: "Monthly cost by department", zh: "各部门月度成本", ar: "التكلفة الشهرية لكل قسم" },
  "tpl.hr_staff_cost.s.summary": READING,
  "tpl.hr_staff_cost.s.summary.hint": { en: "Where the cost sits, and what changed since last month.", zh: "成本集中在哪里，与上月相比有何变化。", ar: "التكلفة متركزة فين، وإيه اللي اتغير عن الشهر اللي فات." },

  "tpl.hr_insurance.s.insured": { en: "Who is insured", zh: "投保人员", ar: "المؤمن عليهم" },
  "tpl.hr_insurance.s.notes": NOTES,
  "tpl.hr_insurance.s.notes.hint": { en: "Who is not covered yet, and what renews soon.", zh: "谁还没有投保，哪些即将续保。", ar: "مين لسه مش متأمن عليه، وإيه اللي هيتجدد قريب." },

  "tpl.hr_salary_review.s.salaries": { en: "Current and proposed pay", zh: "现薪与建议薪资", ar: "المرتب الحالي والمقترح" },
  "tpl.hr_salary_review.s.basis": { en: "How the raises were decided", zh: "调薪依据", ar: "الزيادات اتحسبت على أساس إيه" },
  "tpl.hr_salary_review.s.basis.hint": { en: "Appraisal results, market pay, the cost of living — what the raises rest on.", zh: "考核结果、市场薪资、生活成本——调薪的依据。", ar: "نتايج التقييم، ومرتبات السوق، والغلا — الزيادات مبنية على إيه." },
  "tpl.hr_salary_review.s.budget": BUDGET,
  "tpl.hr_salary_review.s.budget.hint": { en: "What the raises add in a year, and whether the budget allows it.", zh: "调薪每年增加多少成本，预算是否允许。", ar: "الزيادات هتزوّد كام في السنة، والميزانية تسمح ولا لأ." },

  /* ── Phase 5C: performance ── */
  "tpl.hr_appraisal.s.employee": EMPLOYEE,
  "tpl.hr_appraisal.s.record": { en: "Appraisal record", zh: "考核记录", ar: "سجل التقييمات" },
  "tpl.hr_appraisal.s.scores": { en: "This quarter's rating", zh: "本季度评分", ar: "تقييم الربع ده" },
  "tpl.hr_appraisal.s.scores.i.goals": { en: "Goals met", zh: "目标达成", ar: "تحقيق الأهداف" },
  "tpl.hr_appraisal.s.scores.i.quality": WORK_QUALITY,
  "tpl.hr_appraisal.s.scores.i.productivity": { en: "Productivity", zh: "工作效率", ar: "الإنتاجية" },
  "tpl.hr_appraisal.s.scores.i.teamwork": TEAMWORK,
  "tpl.hr_appraisal.s.scores.i.initiative": { en: "Initiative", zh: "主动性", ar: "المبادرة" },
  "tpl.hr_appraisal.s.strengths": { en: "Strengths", zh: "优点", ar: "نقاط القوة" },
  "tpl.hr_appraisal.s.strengths.hint": { en: "What they do well, with an example — one per line.", zh: "做得好的地方，附一个例子——每行一项。", ar: "اللي بيعمله كويس، بمثال — كل حاجة في سطر." },
  "tpl.hr_appraisal.s.improve": { en: "To improve", zh: "待改进", ar: "محتاج يتحسن في إيه" },
  "tpl.hr_appraisal.s.improve.hint": { en: "What should get better, and how.", zh: "需要改进什么、怎么改进。", ar: "إيه اللي لازم يتحسن، وإزاي." },
  "tpl.hr_appraisal.s.goals_next": { en: "Goals for next quarter", zh: "下季度目标", ar: "أهداف الربع الجاي" },
  "tpl.hr_appraisal.s.goals_next.hint": { en: "Clear goals with a date — one per line.", zh: "明确的目标和期限——每行一项。", ar: "أهداف واضحة بميعاد — كل هدف في سطر." },
  "tpl.hr_appraisal.s.summary": { en: "Overall", zh: "总体评价", ar: "الخلاصة" },
  "tpl.hr_appraisal.s.summary.hint": { en: "The quarter in a few lines, and what comes next for them.", zh: "用几句话概括本季度，以及接下来的安排。", ar: "الربع في كام سطر، وإيه الخطوة الجاية معاه." },

  "tpl.hr_appraisal_results.s.results": { en: "Scores by department", zh: "各部门分数", ar: "الدرجات لكل قسم" },
  "tpl.hr_appraisal_results.s.summary": { en: "What the results say", zh: "结果说明了什么", ar: "النتايج بتقول إيه" },
  "tpl.hr_appraisal_results.s.summary.hint": { en: "Which teams did best and worst, and why.", zh: "哪些团队最好、哪些最弱，原因是什么。", ar: "أنهي فرق كانت الأحسن وأنهي الأضعف، وليه." },
  "tpl.hr_appraisal_results.s.actions": ACTIONS,
  "tpl.hr_appraisal_results.s.actions.hint": { en: "Training, coaching, rewards — one per line.", zh: "培训、辅导、奖励——每行一项。", ar: "تدريب، متابعة، مكافآت — كل حاجة في سطر." },

  "tpl.hr_training.s.plan": { en: "Training planned", zh: "培训计划", ar: "التدريبات المخططة" },
  "tpl.hr_training.s.plan.c.course": { en: "Course", zh: "课程", ar: "الدورة" },
  "tpl.hr_training.s.plan.c.audience": { en: "For whom", zh: "对象", ar: "لمين" },
  "tpl.hr_training.s.plan.c.month": { en: "Month", zh: "月份", ar: "الشهر" },
  "tpl.hr_training.s.plan.c.cost": { en: "Cost", zh: "费用", ar: "التكلفة" },
  "tpl.hr_training.s.log": { en: "Who attended what", zh: "参训情况", ar: "مين حضر إيه" },
  "tpl.hr_training.s.summary": { en: "The month in training", zh: "本月培训情况", ar: "التدريب الشهر ده" },
  "tpl.hr_training.s.summary.hint": { en: "What ran, what slipped, and what people said about it.", zh: "完成了哪些、推迟了哪些，学员反馈如何。", ar: "إيه اللي اتعمل، وإيه اللي اتأجل، والناس قالت إيه." },

  "tpl.hr_skills.s.skills": { en: "Skills across the company", zh: "全公司技能", ar: "مهارات الشركة" },
  "tpl.hr_skills.s.gaps": { en: "Skill gaps", zh: "技能差距", ar: "المهارات الناقصة" },
  "tpl.hr_skills.s.gaps.hint": { en: "Skills the jobs need and people lack — one per line.", zh: "岗位需要但员工欠缺的技能——每行一项。", ar: "المهارات اللي الشغل محتاجها وناقصة — كل واحدة في سطر." },
  "tpl.hr_skills.s.summary": READING,
  "tpl.hr_skills.s.summary.hint": { en: "Where we are strong, where we are weak, and what to train.", zh: "哪里强、哪里弱、需要培训什么。", ar: "إحنا أقويا فين، وضعاف فين، ونتدرب على إيه." },

  "tpl.hr_behavior.s.behavior": { en: "Latest behavior assessments", zh: "最新行为评估", ar: "آخر تقييمات السلوك" },
  "tpl.hr_behavior.s.summary": READING,
  "tpl.hr_behavior.s.summary.hint": { en: "Who needs attention, and what lies behind it.", zh: "谁需要关注，背后的原因是什么。", ar: "مين محتاج اهتمام، وإيه السبب." },
  "tpl.hr_behavior.s.actions": ACTIONS,
  "tpl.hr_behavior.s.actions.hint": { en: "Talks, coaching, warnings — one per line.", zh: "谈话、辅导、警告——每行一项。", ar: "قعدة، متابعة، إنذار — كل حاجة في سطر." },

  /* ── Phase 5C: relations ── */
  "tpl.hr_investigation.s.employee": EMPLOYEE,
  "tpl.hr_investigation.s.subject": { en: "Subject", zh: "调查事由", ar: "موضوع التحقيق" },
  "tpl.hr_investigation.s.subject.hint": { en: "What is being investigated, and when it happened.", zh: "调查什么事，何时发生。", ar: "بنحقق في إيه، وحصل إمتى." },
  "tpl.hr_investigation.s.attendees": { en: "Who attended", zh: "出席人员", ar: "الحاضرين" },
  "tpl.hr_investigation.s.attendees.hint": { en: "Each person present, and in what role — one per line.", zh: "每位出席者及其身份——每行一人。", ar: "كل واحد حضر وبصفته إيه — كل واحد في سطر." },
  "tpl.hr_investigation.s.statements": { en: "Statements", zh: "陈述", ar: "الأقوال" },
  "tpl.hr_investigation.s.statements.hint": { en: "Who said what — one person per line.", zh: "谁说了什么——每人一行。", ar: "مين قال إيه — كل واحد في سطر." },
  "tpl.hr_investigation.s.documents": { en: "Documents reviewed", zh: "查阅的文件", ar: "المستندات اللي اتراجعت" },
  "tpl.hr_investigation.s.documents.hint": { en: "Records, messages, photos — one per line.", zh: "记录、消息、照片——每行一项。", ar: "سجلات، رسايل، صور — كل حاجة في سطر." },
  "tpl.hr_investigation.s.findings": { en: "What we found", zh: "调查发现", ar: "اللي وصلنا له" },
  "tpl.hr_investigation.s.findings.hint": { en: "What the facts show, and which rule was broken, if any.", zh: "事实表明了什么，是否违反了哪项规定。", ar: "الوقايع بتقول إيه، وهل فيه لايحة اتخالفت." },
  "tpl.hr_investigation.s.outcome": { en: "Outcome", zh: "处理结果", ar: "القرار" },
  "tpl.hr_investigation.s.outcome.o.no_action": { en: "No action", zh: "不予处理", ar: "مفيش إجراء" },
  "tpl.hr_investigation.s.outcome.o.verbal_warning": { en: "Verbal warning", zh: "口头警告", ar: "إنذار شفوي" },
  "tpl.hr_investigation.s.outcome.o.written_warning": { en: "Written warning", zh: "书面警告", ar: "إنذار كتابي" },
  "tpl.hr_investigation.s.outcome.o.deduction": { en: "Pay deduction", zh: "扣薪", ar: "خصم من المرتب" },
  "tpl.hr_investigation.s.outcome.o.suspension": { en: "Suspension", zh: "停职", ar: "إيقاف عن الشغل" },
  "tpl.hr_investigation.s.outcome.o.termination": { en: "Dismissal", zh: "辞退", ar: "فصل" },
  "tpl.hr_investigation.s.outcome.o.other": { en: "Other", zh: "其他", ar: "حاجة تانية" },
  "tpl.hr_investigation.s.hr_sign": { en: "HR signature", zh: "人事签字", ar: "توقيع الـ HR" },
  "tpl.hr_investigation.s.employee_sign": EMPLOYEE_SIGN,

  "tpl.hr_grievance_summary.s.counts": { en: "Grievances by month", zh: "每月申诉数", ar: "الشكاوى كل شهر" },
  "tpl.hr_grievance_summary.s.summary": READING,
  "tpl.hr_grievance_summary.s.summary.hint": { en: "The trend and the main themes — never a name.", zh: "趋势和主要问题——不写任何姓名。", ar: "الشكاوى بتزيد ولا بتقل، ومواضيعها الأساسية — من غير أي اسم." },
  "tpl.hr_grievance_summary.s.actions": ACTIONS,
  "tpl.hr_grievance_summary.s.actions.hint": { en: "Changes that answer the complaints — one per line.", zh: "针对申诉要做的改变——每行一项。", ar: "تغييرات ترد على الشكاوى — كل واحدة في سطر." },

  /* ── Phase 5C: movement & exit ── */
  "tpl.hr_movement.s.moves": { en: "Who joined, moved or left", zh: "入职、调动和离职人员", ar: "مين اتعيّن واتنقل ومشي" },
  "tpl.hr_movement.s.summary": MONTH,
  "tpl.hr_movement.s.summary.hint": { en: "The changes that matter, and any gap they leave.", zh: "重要的变动，以及留下的空缺。", ar: "التغييرات المهمة، وأي مكان فضي بسببها." },

  "tpl.hr_turnover.s.turnover": { en: "Turnover by department", zh: "各部门流动率", ar: "الدوران لكل قسم" },
  "tpl.hr_turnover.s.reasons": { en: "Why people left", zh: "离职原因", ar: "الناس مشيت ليه" },
  "tpl.hr_turnover.s.reasons.hint": { en: "The main reasons, from the exit interviews — one per line.", zh: "主要原因，来自离职面谈——每行一项。", ar: "الأسباب الأساسية من مقابلات الخروج — كل سبب في سطر." },
  "tpl.hr_turnover.s.summary": READING,
  "tpl.hr_turnover.s.summary.hint": { en: "Where people leave most, and what would keep them.", zh: "哪里离职最多，怎样才能留住人。", ar: "الناس بتمشي أكتر من أنهي قسم، وإيه اللي يخليهم يفضلوا." },

  "tpl.hr_end_of_service.s.employee": EMPLOYEE,
  "tpl.hr_end_of_service.s.leave": { en: "Leave balance", zh: "假期余额", ar: "رصيد الإجازات" },
  "tpl.hr_end_of_service.s.dues": { en: "What they are owed", zh: "应付款项", ar: "المستحقات" },
  "tpl.hr_end_of_service.s.dues.c.item": ITEM,
  "tpl.hr_end_of_service.s.dues.c.amount": { en: "Amount", zh: "金额", ar: "المبلغ" },
  "tpl.hr_end_of_service.s.custody": { en: "Company items returned", zh: "公司物品归还", ar: "تسليم العهدة" },
  "tpl.hr_end_of_service.s.custody.i.laptop": { en: "Laptop returned", zh: "笔记本电脑已归还", ar: "اللابتوب اترجع" },
  "tpl.hr_end_of_service.s.custody.i.phone": { en: "Phone and line returned", zh: "手机及号码已归还", ar: "الموبايل والخط اترجعوا" },
  "tpl.hr_end_of_service.s.custody.i.car": { en: "Car returned", zh: "公司车辆已归还", ar: "العربية اترجعت" },
  "tpl.hr_end_of_service.s.custody.i.keys": { en: "Keys returned", zh: "钥匙已归还", ar: "المفاتيح اترجعت" },
  "tpl.hr_end_of_service.s.custody.i.card": { en: "ID and access cards returned", zh: "工牌和门禁卡已归还", ar: "الكارنيه وكارت الدخول اترجعوا" },
  "tpl.hr_end_of_service.s.custody.i.documents": { en: "Company files handed back", zh: "公司文件已交回", ar: "ملفات الشركة اترجعت" },
  "tpl.hr_end_of_service.s.custody.i.tools": { en: "Tools and equipment returned", zh: "工具设备已归还", ar: "العدة والأدوات اترجعت" },
  "tpl.hr_end_of_service.s.handover": { en: "Handover", zh: "工作交接", ar: "تسليم الشغل" },
  "tpl.hr_end_of_service.s.handover.hint": { en: "Who takes over the work, and what is still open.", zh: "由谁接手工作，还有哪些未完成。", ar: "مين هيستلم الشغل، وإيه اللي لسه مفتوح." },
  "tpl.hr_end_of_service.s.employee_sign": EMPLOYEE_SIGN,

  /* ── Phase 5C: records & safety ── */
  "tpl.hr_expiring.s.expiring": { en: "Expiring in the next three months", zh: "未来三个月内到期", ar: "اللي هينتهي في التلات شهور الجاية" },
  "tpl.hr_expiring.s.summary": { en: "What needs renewing", zh: "需要续办的事项", ar: "المطلوب تجديده" },
  "tpl.hr_expiring.s.summary.hint": { en: "The most urgent first, and anything already late.", zh: "最紧急的先写，已过期的也要列出。", ar: "المستعجل الأول، وأي حاجة ميعادها فات." },
  "tpl.hr_expiring.s.actions": { en: "Who renews what", zh: "续办分工", ar: "مين يجدد إيه" },
  "tpl.hr_expiring.s.actions.hint": WHO_BY,

  "tpl.hr_contracts.s.contracts": { en: "Ending in the next three months", zh: "未来三个月内到期", ar: "هتنتهي في التلات شهور الجاية" },
  "tpl.hr_contracts.s.summary": { en: "Renew or not", zh: "是否续签", ar: "نجدد ولا لأ" },
  "tpl.hr_contracts.s.summary.hint": { en: "For each contract: renew, change or end — and why.", zh: "每份合同：续签、变更还是终止——及原因。", ar: "كل عقد: يتجدد، يتغير، ولا ينتهي — وليه." },

  "tpl.hr_missing_files.s.files": { en: "What each file lacks", zh: "各档案缺少的内容", ar: "كل ملف ناقصه إيه" },
  "tpl.hr_missing_files.s.plan": { en: "Plan to complete them", zh: "补全计划", ar: "هنكمّلها إزاي" },
  "tpl.hr_missing_files.s.plan.hint": { en: "Who fills in what, and by when.", zh: "谁补什么、何时之前完成。", ar: "مين يكمّل إيه، ولحد إمتى." },

  "tpl.hr_safety_inspection.s.checks": { en: "Safety, point by point", zh: "逐项安全检查", ar: "السلامة بند بند" },
  "tpl.hr_safety_inspection.s.checks.i.extinguishers": { en: "Fire extinguishers checked and in date", zh: "灭火器已检查且在有效期内", ar: "طفايات الحريق اتفحصت وصالحة" },
  "tpl.hr_safety_inspection.s.checks.i.exits": { en: "Emergency exits clear and marked", zh: "安全出口畅通且标识清楚", ar: "مخارج الطوارئ فاضية وعليها علامات" },
  "tpl.hr_safety_inspection.s.checks.i.first_aid": { en: "First-aid kit stocked", zh: "急救箱物品齐全", ar: "شنطة الإسعافات كاملة" },
  "tpl.hr_safety_inspection.s.checks.i.electrical": { en: "Wiring and sockets safe", zh: "电线和插座安全", ar: "الكهربا والبرايز سليمة" },
  "tpl.hr_safety_inspection.s.checks.i.storage": { en: "Goods stored safely", zh: "货物存放安全", ar: "البضاعة متخزنة بأمان" },
  "tpl.hr_safety_inspection.s.checks.i.ppe": { en: "Protective gear available and worn", zh: "防护用品齐备并正确佩戴", ar: "أدوات الوقاية موجودة ومستخدمة" },
  "tpl.hr_safety_inspection.s.checks.i.cleanliness": { en: "Clean, with walkways clear", zh: "环境整洁，通道无杂物", ar: "المكان نضيف والممرات فاضية" },
  "tpl.hr_safety_inspection.s.checks.i.signs": { en: "Safety signs in place", zh: "安全标识齐全", ar: "يافطات السلامة متعلقة" },
  "tpl.hr_safety_inspection.s.actions": { en: "To fix", zh: "待整改", ar: "محتاج يتصلّح" },
  "tpl.hr_safety_inspection.s.actions.hint": WHO_BY,
  "tpl.hr_safety_inspection.s.sign": { en: "Inspector signature", zh: "检查人签字", ar: "توقيع اللي فتّش" },

  "tpl.hr_monthly.s.kpis": { en: "HR numbers this month", zh: "本月人事数据", ar: "أرقام الـ HR الشهر ده" },
  "tpl.hr_monthly.s.cost": { en: "Staff cost by department", zh: "各部门人工成本", ar: "تكلفة الموظفين لكل قسم" },
  "tpl.hr_monthly.s.summary": MONTH,
  "tpl.hr_monthly.s.summary.hint": { en: "The headline for the month — what went well and what didn't.", zh: "本月要点——哪些顺利、哪些不顺。", ar: "أهم حاجة في الشهر — إيه اللي مشي كويس وإيه اللي لأ." },
  "tpl.hr_monthly.s.highlights": { en: "Highlights", zh: "亮点", ar: "أهم الحاجات" },
  "tpl.hr_monthly.s.highlights.hint": { en: "Key hires, exits, wins or problems — one per line.", zh: "重要的入职、离职、成绩或问题——每行一项。", ar: "تعيينات أو خروج مهم، نجاحات أو مشاكل — كل حاجة في سطر." },
  "tpl.hr_monthly.s.next": { en: "Next month", zh: "下月计划", ar: "الشهر الجاي" },
  "tpl.hr_monthly.s.next.hint": { en: "Hiring, training and reviews coming up — one per line.", zh: "即将进行的招聘、培训和考核——每行一项。", ar: "توظيف، وتدريب، وتقييمات جاية — كل حاجة في سطر." },

  "tpl.hr_headcount.s.headcount": { en: "People by department and contract", zh: "各部门人数及合同类型", ar: "عدد الناس لكل قسم ونوع عقد" },
  "tpl.hr_headcount.s.summary": READING,
  "tpl.hr_headcount.s.summary.hint": { en: "Where the team is growing or thin, and any gap in the structure.", zh: "哪里在增长、哪里人手不足，架构有无空缺。", ar: "فين الفريق بيكبر أو ناقص، وأي مكان فاضي في الهيكل." },
};

export default words;
