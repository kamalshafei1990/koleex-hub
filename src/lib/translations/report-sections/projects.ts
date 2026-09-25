import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Projects templates (Phase 5C). */
const PROJECT = { en: "Project", zh: "项目", ar: "المشروع" };
const FACTS = { en: "The project in numbers", zh: "项目概况", ar: "المشروع بالأرقام" };
const TEAM = { en: "The team", zh: "项目团队", ar: "فريق المشروع" };
const SCHEDULE = { en: "The plan: due and done", zh: "计划：截止与完成", ar: "الخطة: المواعيد واللي خلص" };
const OVERDUE = { en: "Overdue tasks", zh: "逾期任务", ar: "المهام المتأخرة" };
const MILESTONES = { en: "Milestones", zh: "里程碑", ar: "المراحل" };
const BUDGET = { en: "Budget and hours", zh: "预算与工时", ar: "الميزانية والساعات" };
const RISKS = { en: "Risks", zh: "风险", ar: "المخاطر" };
const WEEK = { en: "The week in short", zh: "本周概要", ar: "الأسبوع باختصار" };

const words: Translations = {
  /* ── Starting a project ── */
  "tpl.prj_proposal.s.problem": { en: "The problem", zh: "要解决的问题", ar: "المشكلة" },
  "tpl.prj_proposal.s.problem.hint": { en: "What is wrong or missing today, and who it affects.", zh: "目前有什么问题或缺什么，影响到谁。", ar: "إيه اللي غلط أو ناقص دلوقتي، ومين بيتأثر بيه." },
  "tpl.prj_proposal.s.idea": { en: "The idea", zh: "方案", ar: "الفكرة" },
  "tpl.prj_proposal.s.idea.hint": { en: "What you propose to do, in a few lines.", zh: "你建议怎么做，简要说明。", ar: "بتقترح نعمل إيه، في كام سطر." },
  "tpl.prj_proposal.s.cost": { en: "What it will cost", zh: "费用估算", ar: "هيتكلف كام" },
  "tpl.prj_proposal.s.cost.c.item": { en: "Item", zh: "费用项", ar: "البند" },
  "tpl.prj_proposal.s.cost.c.amount": { en: "Amount", zh: "金额", ar: "المبلغ" },
  "tpl.prj_proposal.s.benefit": { en: "The benefit", zh: "收益", ar: "العائد" },
  "tpl.prj_proposal.s.benefit.hint": { en: "What we gain — money, time, quality or customers.", zh: "我们能得到什么——资金、时间、质量或客户。", ar: "هنكسب إيه — فلوس، وقت، جودة، أو عملاء." },
  "tpl.prj_proposal.s.risks": RISKS,
  "tpl.prj_proposal.s.risks.hint": { en: "What could go wrong, or cost more than planned.", zh: "可能出错或超出预算的地方。", ar: "إيه اللي ممكن يبوظ، أو يتكلف أكتر من المحسوب." },
  "tpl.prj_proposal.s.timeline": { en: "Timeline", zh: "时间安排", ar: "المدة والمواعيد" },
  "tpl.prj_proposal.s.timeline.hint": { en: "When it could start and how long it would take.", zh: "何时可以开始，需要多长时间。", ar: "ممكن يبدأ إمتى، وهياخد قد إيه." },

  "tpl.prj_charter.s.project": PROJECT,
  "tpl.prj_charter.s.facts": FACTS,
  "tpl.prj_charter.s.goal": { en: "The goal", zh: "目标", ar: "الهدف" },
  "tpl.prj_charter.s.goal.hint": { en: "What the project must achieve, and how we will know it has.", zh: "项目要达成什么，以及如何判断已经达成。", ar: "المشروع لازم يحقق إيه، وهنعرف إزاي إنه حققه." },
  "tpl.prj_charter.s.in_scope": { en: "In scope", zh: "范围内", ar: "جوه النطاق" },
  "tpl.prj_charter.s.in_scope.hint": { en: "What the project will deliver.", zh: "项目将交付的内容。", ar: "المشروع هيسلّم إيه." },
  "tpl.prj_charter.s.out_scope": { en: "Out of scope", zh: "范围外", ar: "برّه النطاق" },
  "tpl.prj_charter.s.out_scope.hint": { en: "What it will not do, so nobody expects it.", zh: "项目不包括的内容，以免误解。", ar: "اللي المشروع مش هيعمله، عشان محدش يستناه." },
  "tpl.prj_charter.s.team": TEAM,
  "tpl.prj_charter.s.milestones": { en: "Milestones", zh: "里程碑", ar: "المراحل ومواعيدها" },
  "tpl.prj_charter.s.milestones.hint": { en: "Each milestone and its date.", zh: "每个里程碑及其日期。", ar: "كل مرحلة وميعادها." },
  "tpl.prj_charter.s.budget": { en: "Budget", zh: "预算", ar: "الميزانية" },
  "tpl.prj_charter.s.budget.hint": { en: "The money and hours the project may use.", zh: "项目可使用的资金和工时。", ar: "الفلوس والساعات اللي المشروع يقدر يصرفها." },

  "tpl.prj_plan.s.project": PROJECT,
  "tpl.prj_plan.s.schedule": SCHEDULE,
  "tpl.prj_plan.s.team": TEAM,
  "tpl.prj_plan.s.phases": { en: "Phases", zh: "阶段", ar: "مراحل التنفيذ" },
  "tpl.prj_plan.s.phases.hint": { en: "Each phase: what it covers, when it starts and ends.", zh: "每个阶段：包含什么，何时开始和结束。", ar: "كل مرحلة: فيها إيه، وبتبدأ وتخلص إمتى." },
  "tpl.prj_plan.s.resources": { en: "Resources", zh: "资源", ar: "الموارد" },
  "tpl.prj_plan.s.resources.hint": { en: "The people, money, tools and outside help the plan needs.", zh: "计划所需的人员、资金、工具和外部支持。", ar: "الناس والفلوس والأدوات والمساعدة من برّه اللي الخطة محتاجاها." },

  "tpl.prj_stakeholders.s.project": PROJECT,
  "tpl.prj_stakeholders.s.map": { en: "Stakeholders", zh: "利益相关方", ar: "أصحاب المصلحة" },
  "tpl.prj_stakeholders.s.map.c.who": { en: "Who", zh: "相关方", ar: "مين" },
  "tpl.prj_stakeholders.s.map.c.role": { en: "Role", zh: "角色", ar: "دوره" },
  "tpl.prj_stakeholders.s.map.c.influence": { en: "Influence", zh: "影响力", ar: "تأثيره" },
  "tpl.prj_stakeholders.s.map.c.interest": { en: "Interest", zh: "关注度", ar: "اهتمامه" },
  "tpl.prj_stakeholders.s.map.c.how": { en: "How to inform", zh: "沟通方式", ar: "هنبلّغه إزاي" },

  /* ── Running it ── */
  "tpl.prj_status.s.project": PROJECT,
  "tpl.prj_status.s.facts": FACTS,
  "tpl.prj_status.s.done": { en: "Done this week", zh: "本周完成", ar: "اللي خلص الأسبوع ده" },
  "tpl.prj_status.s.overdue": OVERDUE,
  "tpl.prj_status.s.milestones": MILESTONES,
  "tpl.prj_status.s.highlights": WEEK,
  "tpl.prj_status.s.highlights.hint": { en: "Where the project stands this week, and what changed.", zh: "项目本周进展如何，有哪些变化。", ar: "المشروع وصل لفين الأسبوع ده، وإيه اللي اتغيّر." },
  "tpl.prj_status.s.risks": { en: "Risks and problems", zh: "风险和问题", ar: "المخاطر والمشاكل" },
  "tpl.prj_status.s.risks.hint": { en: "What could delay the project, and the help you need.", zh: "可能导致项目延误的因素，以及你需要的支持。", ar: "إيه اللي ممكن يأخّر المشروع، ومحتاج مساعدة في إيه." },
  "tpl.prj_status.s.next": { en: "Next week", zh: "下周计划", ar: "الأسبوع الجاي" },

  "tpl.prj_progress.s.project": PROJECT,
  "tpl.prj_progress.s.schedule": SCHEDULE,
  "tpl.prj_progress.s.summary": { en: "Where we stand against the plan", zh: "对照计划的进展", ar: "إحنا فين من الخطة" },
  "tpl.prj_progress.s.summary.hint": { en: "What is late or early, why, and how we catch up.", zh: "哪些延误或提前、原因，以及如何赶上。", ar: "إيه المتأخر وإيه السابق، وليه، وهنلحق إزاي." },

  "tpl.prj_budget.s.project": PROJECT,
  "tpl.prj_budget.s.budget": BUDGET,
  "tpl.prj_budget.s.expenses": { en: "Expenses on the project", zh: "项目费用", ar: "مصاريف المشروع" },
  "tpl.prj_budget.s.summary": { en: "Spending against the budget", zh: "支出与预算对比", ar: "المصروف قصاد الميزانية" },
  "tpl.prj_budget.s.summary.hint": { en: "Whether we are within the budget, and what it will take to finish.", zh: "是否在预算之内，以及完成还需要多少。", ar: "إحنا جوه الميزانية ولا لأ، ومحتاجين قد إيه لحد ما نخلص." },

  "tpl.prj_resources.s.project": PROJECT,
  "tpl.prj_resources.s.team": { en: "The team and their hours", zh: "团队成员及工时", ar: "الفريق وساعاته" },
  "tpl.prj_resources.s.needs": { en: "What we need", zh: "资源需求", ar: "محتاجين إيه" },
  "tpl.prj_resources.s.needs.hint": { en: "Who has too much or too little work, and who or what is missing.", zh: "谁的工作太多或太少，还缺哪些人或资源。", ar: "مين عليه شغل كتير ومين فاضي، وناقصنا مين أو إيه." },

  "tpl.prj_overdue.s.project": PROJECT,
  "tpl.prj_overdue.s.overdue": OVERDUE,
  "tpl.prj_overdue.s.actions": { en: "How we catch up", zh: "补救措施", ar: "هنلحق إزاي" },
  "tpl.prj_overdue.s.actions.hint": { en: "For each late task: the next step, who takes it, by when.", zh: "每项逾期任务：下一步、由谁负责、何时完成。", ar: "لكل مهمة متأخرة: الخطوة الجاية، ومين ياخدها، ولحد إمتى." },

  "tpl.prj_dependencies.s.project": PROJECT,
  "tpl.prj_dependencies.s.blocked": { en: "Waiting on other tasks", zh: "等待其他任务", ar: "مهام مستنية مهام تانية" },
  "tpl.prj_dependencies.s.cross": { en: "Waiting on other projects or teams", zh: "等待其他项目或团队", ar: "مستنيين مشاريع أو فرق تانية" },
  "tpl.prj_dependencies.s.cross.hint": { en: "What we wait for from outside the project, and from whom.", zh: "我们在等待项目外部的什么，由谁提供。", ar: "مستنيين إيه من برّه المشروع، ومن مين." },
  "tpl.prj_dependencies.s.summary": { en: "What is holding us up", zh: "主要阻碍", ar: "إيه اللي معطّلنا" },
  "tpl.prj_dependencies.s.summary.hint": { en: "The blockers that matter most, and who can clear them.", zh: "最关键的阻碍，以及谁能解决。", ar: "أهم العوائق، ومين يقدر يشيلها." },

  "tpl.prj_risks.s.project": PROJECT,
  "tpl.prj_risks.s.risks": RISKS,
  "tpl.prj_risks.s.risks.c.risk": { en: "Risk", zh: "风险描述", ar: "الخطر" },
  "tpl.prj_risks.s.risks.c.likelihood": { en: "Likelihood", zh: "可能性", ar: "احتماله" },
  "tpl.prj_risks.s.risks.c.impact": { en: "Impact", zh: "影响", ar: "تأثيره" },
  "tpl.prj_risks.s.risks.c.owner": { en: "Owner", zh: "负责人", ar: "مين مسؤول" },
  "tpl.prj_risks.s.risks.c.action": { en: "Action", zh: "应对措施", ar: "هنعمل إيه" },
  "tpl.prj_risks.s.risks.c.status": { en: "Status", zh: "状态", ar: "الحالة" },
  "tpl.prj_risks.s.issues": { en: "Current issues", zh: "当前问题", ar: "مشاكل حاصلة دلوقتي" },
  "tpl.prj_risks.s.issues.hint": { en: "Problems that have already happened, and who is on each.", zh: "已经发生的问题，以及各自由谁处理。", ar: "مشاكل حصلت فعلاً، ومين ماسك كل واحدة." },

  "tpl.prj_change.s.project": PROJECT,
  "tpl.prj_change.s.kind": { en: "What changes", zh: "变更类型", ar: "التغيير في إيه" },
  "tpl.prj_change.s.kind.o.scope": { en: "Scope", zh: "范围", ar: "النطاق" },
  "tpl.prj_change.s.kind.o.schedule": { en: "Schedule", zh: "进度", ar: "المواعيد" },
  "tpl.prj_change.s.kind.o.cost": { en: "Cost", zh: "成本", ar: "التكلفة" },
  "tpl.prj_change.s.kind.o.quality": { en: "Quality", zh: "质量", ar: "الجودة" },
  "tpl.prj_change.s.change": { en: "The change", zh: "变更内容", ar: "التغيير" },
  "tpl.prj_change.s.change.hint": { en: "What exactly changes, compared with the plan.", zh: "与原计划相比，具体改变什么。", ar: "إيه اللي هيتغيّر بالظبط عن الخطة." },
  "tpl.prj_change.s.reason": { en: "Why", zh: "变更原因", ar: "ليه" },
  "tpl.prj_change.s.reason.hint": { en: "Why it is needed, and what happens if we do not change.", zh: "为什么需要变更，不变更会怎样。", ar: "ليه محتاجينه، ولو ماغيّرناش هيحصل إيه." },
  "tpl.prj_change.s.impact": { en: "The impact", zh: "影响", ar: "التأثير" },
  "tpl.prj_change.s.impact.c.item": { en: "What it affects", zh: "受影响的内容", ar: "بيأثر على إيه" },
  "tpl.prj_change.s.impact.c.days": { en: "Days", zh: "天数", ar: "الأيام" },
  "tpl.prj_change.s.impact.c.cost": { en: "Cost", zh: "费用", ar: "التكلفة" },

  "tpl.prj_milestone.s.project": PROJECT,
  "tpl.prj_milestone.s.milestones": MILESTONES,
  "tpl.prj_milestone.s.done": { en: "Tasks finished", zh: "已完成的任务", ar: "المهام اللي خلصت" },
  "tpl.prj_milestone.s.delivered": { en: "What was delivered", zh: "已交付的成果", ar: "اتسلّم إيه" },
  "tpl.prj_milestone.s.delivered.hint": { en: "The milestone reached, and what it delivered.", zh: "达成的里程碑及其交付的成果。", ar: "المرحلة اللي خلصت، وسلّمت إيه." },
  "tpl.prj_milestone.s.next": { en: "What comes next", zh: "下一步", ar: "الجاي إيه" },
  "tpl.prj_milestone.s.next.hint": { en: "The next milestone, its date and what it needs.", zh: "下一个里程碑、日期及所需条件。", ar: "المرحلة الجاية، وميعادها، ومحتاجة إيه." },

  "tpl.prj_acceptance.s.project": PROJECT,
  "tpl.prj_acceptance.s.deliverable": { en: "The deliverable", zh: "交付成果", ar: "المخرج اللي بيتسلّم" },
  "tpl.prj_acceptance.s.deliverable.hint": { en: "What is being handed over, and which part of the scope it covers.", zh: "交付的是什么，对应范围中的哪一部分。", ar: "إيه اللي بيتسلّم، وتبع أنهي جزء من النطاق." },
  "tpl.prj_acceptance.s.checks": { en: "Acceptance checks", zh: "验收检查", ar: "فحص الاستلام" },
  "tpl.prj_acceptance.s.checks.i.scope": { en: "Everything in the scope is delivered", zh: "范围内的内容已全部交付", ar: "كل اللي في النطاق اتسلّم" },
  "tpl.prj_acceptance.s.checks.i.quality": { en: "Meets the agreed quality", zh: "符合约定的质量", ar: "مطابق للجودة المتفق عليها" },
  "tpl.prj_acceptance.s.checks.i.documents": { en: "Documents handed over", zh: "相关文件已移交", ar: "المستندات اتسلّمت" },
  "tpl.prj_acceptance.s.checks.i.training": { en: "Users trained", zh: "使用人员已完成培训", ar: "المستخدمين اتدرّبوا" },
  "tpl.prj_acceptance.s.checks.i.issues_listed": { en: "Open issues listed", zh: "遗留问题已列明", ar: "المشاكل المفتوحة متسجّلة" },
  "tpl.prj_acceptance.s.open_issues": { en: "Open issues", zh: "遗留问题", ar: "حاجات لسه مفتوحة" },
  "tpl.prj_acceptance.s.open_issues.hint": { en: "What is still to fix after handover, and by when.", zh: "交付后仍需解决的问题及期限。", ar: "اللي لسه محتاج يتصلّح بعد التسليم، ولحد إمتى." },
  "tpl.prj_acceptance.s.owner_sign": { en: "Project owner's signature", zh: "项目所有者签字", ar: "توقيع صاحب المشروع" },

  "tpl.prj_quality.s.project": PROJECT,
  "tpl.prj_quality.s.checks": { en: "Quality checks", zh: "质量检查", ar: "فحص الجودة" },
  "tpl.prj_quality.s.checks.i.requirements": { en: "Meets every requirement", zh: "满足全部要求", ar: "مطابق لكل المطلوب" },
  "tpl.prj_quality.s.checks.i.tested": { en: "Tested and working", zh: "已测试且运行正常", ar: "اتجرّب وشغال" },
  "tpl.prj_quality.s.checks.i.reviewed": { en: "Checked by a second person", zh: "已由第二人复核", ar: "حد تاني راجعه" },
  "tpl.prj_quality.s.checks.i.documented": { en: "Documentation complete", zh: "文档齐全", ar: "التوثيق كامل" },
  "tpl.prj_quality.s.checks.i.standards": { en: "Follows our standards", zh: "符合公司标准", ar: "ماشي على معاييرنا" },
  "tpl.prj_quality.s.issues": { en: "Issues found", zh: "发现的问题", ar: "المشاكل اللي لقيناها" },
  "tpl.prj_quality.s.issues.hint": { en: "Each problem found, and what must be fixed before handover.", zh: "发现的每个问题，以及交付前必须修复的内容。", ar: "كل مشكلة لقيتها، واللي لازم يتصلّح قبل التسليم." },
  "tpl.prj_quality.s.verdict": { en: "Verdict", zh: "结论", ar: "الرأي النهائي" },
  "tpl.prj_quality.s.verdict.hint": { en: "Ready to hand over, ready after fixes, or not ready.", zh: "可以交付、修复后交付，或尚不能交付。", ar: "جاهز للتسليم، ولا بعد التصليح، ولا لسه مش جاهز." },

  /* ── Every project ── */
  "tpl.prj_portfolio.s.portfolio": { en: "All projects", zh: "所有项目", ar: "كل المشاريع" },
  "tpl.prj_portfolio.s.summary": WEEK,
  "tpl.prj_portfolio.s.summary.hint": { en: "Which projects need attention, and what you need decided.", zh: "哪些项目需要关注，需要做出哪些决定。", ar: "أنهي مشاريع محتاجة اهتمام، ومحتاج قرار في إيه." },

  "tpl.prj_at_risk.s.risky": { en: "Projects at risk", zh: "风险项目", ar: "المشاريع اللي في خطر" },
  "tpl.prj_at_risk.s.summary": { en: "What needs to be done", zh: "需要采取的行动", ar: "اللي محتاج يتعمل" },
  "tpl.prj_at_risk.s.summary.hint": { en: "The decisions and help needed to get them back on track.", zh: "让这些项目回到正轨所需的决定和支持。", ar: "القرارات والمساعدة المطلوبة عشان يرجعوا لمسارهم." },

  /* ── Closing it ── */
  "tpl.prj_closure.s.project": PROJECT,
  "tpl.prj_closure.s.facts": FACTS,
  "tpl.prj_closure.s.budget": BUDGET,
  "tpl.prj_closure.s.result": { en: "The result", zh: "项目成果", ar: "النتيجة" },
  "tpl.prj_closure.s.result.hint": { en: "What the project delivered against its goal.", zh: "项目对照目标交付了什么。", ar: "المشروع سلّم إيه قصاد هدفه." },
  "tpl.prj_closure.s.went_well": { en: "What went well", zh: "做得好的地方", ar: "اللي مشي كويس" },
  "tpl.prj_closure.s.lessons": { en: "Lessons learned", zh: "经验教训", ar: "الدروس المستفادة" },
  "tpl.prj_closure.s.lessons.hint": { en: "What we know now that we wish we had known at the start.", zh: "现在明白、但希望一开始就知道的事。", ar: "حاجات عرفناها دلوقتي وكان نفسنا نعرفها من الأول." },
  "tpl.prj_closure.s.repeat": { en: "Do again", zh: "继续沿用", ar: "نكرّره" },
  "tpl.prj_closure.s.repeat.hint": { en: "What the next project should do the same way.", zh: "下一个项目应沿用的做法。", ar: "اللي المشروع الجاي يعمله بنفس الطريقة." },
  "tpl.prj_closure.s.stop": { en: "Stop doing", zh: "不再做", ar: "نبطّله" },
  "tpl.prj_closure.s.stop.hint": { en: "What the next project should not do again.", zh: "下一个项目不应再做的事。", ar: "اللي المشروع الجاي مايعملوش تاني." },

  "tpl.prj_post_review.s.project": PROJECT,
  "tpl.prj_post_review.s.benefit": { en: "Did it bring the benefit?", zh: "是否实现了预期收益", ar: "جاب الفايدة المطلوبة؟" },
  "tpl.prj_post_review.s.benefit.o.achieved": { en: "Achieved", zh: "已实现", ar: "اتحققت" },
  "tpl.prj_post_review.s.benefit.o.partly": { en: "Partly", zh: "部分实现", ar: "جزء منها" },
  "tpl.prj_post_review.s.benefit.o.not_achieved": { en: "Not achieved", zh: "未实现", ar: "ماتحققتش" },
  "tpl.prj_post_review.s.evidence": { en: "The evidence", zh: "依据", ar: "الدليل" },
  "tpl.prj_post_review.s.evidence.hint": { en: "The numbers or facts that show it, compared with before the project.", zh: "能说明结果的数据或事实，并与项目前对比。", ar: "الأرقام أو الحقايق اللي بتثبت ده، مقارنة بقبل المشروع." },
  "tpl.prj_post_review.s.followups": { en: "Follow-ups", zh: "后续行动", ar: "المتابعات" },
  "tpl.prj_post_review.s.followups.hint": { en: "What is still needed to get the full benefit.", zh: "为获得全部收益仍需做的事。", ar: "لسه محتاجين نعمل إيه عشان الفايدة تكمل." },

  "tpl.prj_team_eval.s.project": PROJECT,
  "tpl.prj_team_eval.s.team": { en: "The team and their scores", zh: "团队成员及评分", ar: "الفريق وتقييم كل واحد" },
  "tpl.prj_team_eval.s.summary": { en: "The team in short", zh: "团队总评", ar: "الفريق باختصار" },
  "tpl.prj_team_eval.s.summary.hint": { en: "How the team worked together, and who stood out and why.", zh: "团队协作情况，谁表现突出及原因。", ar: "الفريق اشتغل مع بعض إزاي، ومين كان مميز وليه." },
};

export default words;
