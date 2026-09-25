import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the manager's team templates (Phase 5A):
   the team summary, the 1-on-1 minutes and the promotion or bonus
   recommendation (`tpl.<key>.s.*`: sections, hints, criteria, columns,
   answers). Loaded with a report of this family (./index.ts), never on the
   other Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.team_summary.s.summary": { en: "Team summary", zh: "团队总结", ar: "ملخّص الفريق" },
  "tpl.team_summary.s.summary.hint": { en: "Koleex AI can write it from what your team sent in these days.", zh: "Koleex AI 可根据团队这些天提交的报告撰写。", ar: "Koleex AI يقدر يكتبه من اللي فريقك بعته في الأيام دي." },
  "tpl.team_summary.s.attention": { en: "Needs attention", zh: "需要关注", ar: "محتاج اهتمام" },
  "tpl.team_summary.s.attention.hint": { en: "Problems, blockers, delays — one per line.", zh: "问题、阻碍、延误——每行一项。", ar: "مشاكل، معوّقات، تأخير — كل واحدة في سطر." },
  "tpl.team_summary.s.decisions": { en: "Decisions needed", zh: "需要的决定", ar: "قرارات مطلوبة" },
  "tpl.team_summary.s.decisions.hint": { en: "What you need decided above you.", zh: "需要上级决定的事项。", ar: "اللي محتاج قرار من فوقك." },
  "tpl.team_summary.s.reports": { en: "The team's reports", zh: "团队报告", ar: "تقارير الفريق" },
  "tpl.team_summary.s.work": { en: "The team's work", zh: "团队工作", ar: "شغل الفريق" },
  "tpl.team_summary.s.attendance": { en: "The team's attendance", zh: "团队考勤", ar: "حضور الفريق" },
  "tpl.team_summary.s.next": { en: "Next steps", zh: "下一步", ar: "الخطوات الجاية" },
  "tpl.one_on_one.s.discussed": { en: "What we talked about", zh: "谈话内容", ar: "اتكلمنا في إيه" },
  "tpl.one_on_one.s.discussed.hint": { en: "Put the person you met in \"To\" — they receive the minutes.", zh: "请把面谈对象加入“收件人”——对方会收到纪要。", ar: "حط الشخص اللي قعدت معاه في «إلى» — هو اللي هيستلم المحضر." },
  "tpl.one_on_one.s.wins": { en: "Wins", zh: "成绩", ar: "النجاحات" },
  "tpl.one_on_one.s.challenges": { en: "Challenges", zh: "挑战", ar: "التحديات" },
  "tpl.one_on_one.s.actions": { en: "Agreed actions", zh: "商定的行动", ar: "الخطوات المتفق عليها" },
  "tpl.one_on_one.s.actions.c.action": { en: "Action", zh: "行动", ar: "الخطوة" },
  "tpl.one_on_one.s.actions.c.owner": { en: "Who", zh: "负责人", ar: "مين" },
  "tpl.one_on_one.s.actions.c.due": { en: "By", zh: "截止日期", ar: "قبل" },
  "tpl.one_on_one.s.support": { en: "Support needed", zh: "需要的支持", ar: "الدعم المطلوب" },
  "tpl.one_on_one.s.feedback": { en: "Feedback", zh: "反馈", ar: "ملاحظات وتقييم" },
  "tpl.promotion_recommendation.s.employee": { en: "Employee", zh: "员工", ar: "الموظف" },
  "tpl.promotion_recommendation.s.employee.hint": { en: "Name and current position.", zh: "姓名和现任职位。", ar: "الاسم والوظيفة الحالية." },
  "tpl.promotion_recommendation.s.recommendation": { en: "Recommendation", zh: "推荐", ar: "الترشيح" },
  "tpl.promotion_recommendation.s.recommendation.o.promotion": { en: "Promotion", zh: "晋升", ar: "ترقية" },
  "tpl.promotion_recommendation.s.recommendation.o.raise": { en: "Pay raise", zh: "加薪", ar: "زيادة مرتب" },
  "tpl.promotion_recommendation.s.recommendation.o.bonus": { en: "Bonus", zh: "奖金", ar: "مكافأة" },
  "tpl.promotion_recommendation.s.recommendation.o.new_role": { en: "New role", zh: "新职位", ar: "دور جديد" },
  "tpl.promotion_recommendation.s.recommendation.o.other": { en: "Other", zh: "其他", ar: "حاجة تانية" },
  "tpl.promotion_recommendation.s.current": { en: "Now", zh: "现状", ar: "دلوقتي" },
  "tpl.promotion_recommendation.s.current.hint": { en: "Current role, grade or pay.", zh: "现任职位、职级或薪资。", ar: "الوظيفة أو الدرجة أو المرتب الحالي." },
  "tpl.promotion_recommendation.s.proposed": { en: "Proposed", zh: "建议", ar: "المقترح" },
  "tpl.promotion_recommendation.s.proposed.hint": { en: "New role, grade, raise or bonus amount.", zh: "新职位、职级、加薪或奖金金额。", ar: "الوظيفة أو الدرجة الجديدة، أو قيمة الزيادة أو المكافأة." },
  "tpl.promotion_recommendation.s.justification": { en: "Why", zh: "理由", ar: "ليه" },
  "tpl.promotion_recommendation.s.achievements": { en: "Achievements", zh: "成就", ar: "الإنجازات" },
  "tpl.promotion_recommendation.s.rating": { en: "Rating", zh: "评分", ar: "التقييم" },
  "tpl.promotion_recommendation.s.rating.i.performance": { en: "Performance", zh: "业绩", ar: "الأداء" },
  "tpl.promotion_recommendation.s.rating.i.reliability": { en: "Reliability", zh: "可靠性", ar: "الالتزام" },
  "tpl.promotion_recommendation.s.rating.i.teamwork": { en: "Teamwork", zh: "团队合作", ar: "العمل الجماعي" },
  "tpl.promotion_recommendation.s.rating.i.initiative": { en: "Initiative", zh: "主动性", ar: "المبادرة" },
  "tpl.promotion_recommendation.s.rating.i.skills": { en: "Skills", zh: "技能", ar: "المهارات" },
  "tpl.promotion_recommendation.s.effective": { en: "From when", zh: "生效时间", ar: "من إمتى" },
  "tpl.promotion_recommendation.s.sign": { en: "Manager's signature", zh: "主管签名", ar: "توقيع المدير" },
};

export default words;
