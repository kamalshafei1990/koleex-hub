import type { Translations } from "@/lib/i18n";

/* HR and My HR — leave, attendance, overtime, corrections, document expiry.
   Writers: lib/server/leave-review.ts, api/me/hr/attendance (+ corrections),
   api/hr/attendance/corrections/[id], api/hr/attendance/overtime,
   api/cron/attendance, api/cron/hr-expiry-reminders. */
export const hrTpl: Translations = {
  /* ── Leave: the approver's copy ── */
  "leave_approval_request.one.s": { en: "Leave request — {name}", zh: "请假申请 — {name}", ar: "طلب إجازة — {name}" },
  "leave_approval_request.one.b": {
    en: "{leaveType:leave_type} · {from}[[ → {to}]] · {days} day",
    zh: "{leaveType:leave_type} · {from}[[ 至 {to}]] · {days} 天",
    ar: "{leaveType:leave_type} · {from}[[ إلى {to}]] · {days} يوم",
  },
  "leave_approval_request.many.s": { en: "Leave request — {name}", zh: "请假申请 — {name}", ar: "طلب إجازة — {name}" },
  "leave_approval_request.many.b": {
    en: "{leaveType:leave_type} · {from}[[ → {to}]] · {days} days",
    zh: "{leaveType:leave_type} · {from}[[ 至 {to}]] · {days} 天",
    ar: "{leaveType:leave_type} · {from}[[ إلى {to}]] · عدد الأيام: {days}",
  },
  "leave_approval_request.hr.s": {
    en: "Leave request — {name} (manager approved)",
    zh: "请假申请 — {name}（经理已批准）",
    ar: "طلب إجازة — {name} (وافق المدير)",
  },
  "leave_approval_request.hr.b": {
    en: "{leaveType:leave_type} · {from}[[ → {to}]]",
    zh: "{leaveType:leave_type} · {from}[[ 至 {to}]]",
    ar: "{leaveType:leave_type} · {from}[[ إلى {to}]]",
  },

  /* ── Leave: the requester's copy ── */
  "leave_request_decided.manager_approved.s": {
    en: "Your leave request was approved by your manager",
    zh: "你的请假申请已获经理批准",
    ar: "وافق مديرك على طلب إجازتك",
  },
  "leave_request_decided.manager_approved.b": {
    en: "{leaveType:leave_type} · {from}[[ → {to}]] — now with HR",
    zh: "{leaveType:leave_type} · {from}[[ 至 {to}]] — 现已转交人事审批",
    ar: "{leaveType:leave_type} · {from}[[ إلى {to}]] — الآن لدى الموارد البشرية",
  },
  "leave_request_decided.s": {
    en: "Your leave request was {decision:leave_decision}",
    zh: "你的请假申请{decision:leave_decision}",
    ar: "طلب إجازتك {decision:leave_decision}",
  },
  "leave_request_decided.b": {
    en: "{leaveType:leave_type} · {from}[[ → {to}]][[ — {notes:free}]]",
    zh: "{leaveType:leave_type} · {from}[[ 至 {to}]][[ — {notes:free}]]",
    ar: "{leaveType:leave_type} · {from}[[ إلى {to}]][[ — {notes:free}]]",
  },

  /* ── Attendance: requests to approve ── */
  "attendance_overtime_approval_request.s": {
    en: "Overtime to approve — {name}",
    zh: "待审批加班 — {name}",
    ar: "عمل إضافي بانتظار الموافقة — {name}",
  },
  "attendance_overtime_approval_request.b": {
    en: "{date} · {duration} after {workEnd}",
    zh: "{date} · {workEnd} 之后 {duration}",
    ar: "{date} · {duration} بعد {workEnd}",
  },
  "attendance_correction_approval_request.s": {
    en: "Attendance correction — {name}",
    zh: "考勤更正 — {name}",
    ar: "تصحيح الحضور — {name}",
  },
  "attendance_correction_approval_request.b": {
    en: "{date}[[ · in {clockIn}]][[ · out {clockOut}]] · {reason:free}",
    zh: "{date}[[ · 上班 {clockIn}]][[ · 下班 {clockOut}]] · {reason:free}",
    ar: "{date}[[ · دخول {clockIn}]][[ · انصراف {clockOut}]] · {reason:free}",
  },

  /* ── Attendance: the employee's copy ── */
  "hr_attendance_correction_decided.s": {
    en: "Attendance correction {decision:attendance_decision} — {date}",
    zh: "考勤更正{decision:attendance_decision} — {date}",
    ar: "تصحيح الحضور {decision:attendance_decision} — {date}",
  },
  "hr_attendance_overtime_decided.s": { en: "Overtime decided", zh: "加班审批结果", ar: "صدر قرار العمل الإضافي" },
  "hr_attendance_overtime_decided.one.s": { en: "Overtime decided", zh: "加班审批结果", ar: "صدر قرار العمل الإضافي" },
  "hr_attendance_overtime_decided.one.b": {
    en: "{date}: {decision:attendance_decision}[[ {duration}]]",
    zh: "{date}：{decision:attendance_decision}[[ {duration}]]",
    ar: "{date}: {decision:attendance_decision}[[ {duration}]]",
  },
  "hr_attendance_auto_closed.s": {
    en: "Attendance closed automatically — {date}",
    zh: "考勤已自动关闭 — {date}",
    ar: "أُغلق الحضور تلقائيًا — {date}",
  },
  "hr_attendance_auto_closed.b": {
    en: "Nobody clocked out, so the day was closed at {workEnd}. If you left later, ask for a correction in My HR.",
    zh: "当天没有打卡下班，系统已于 {workEnd} 关闭当天考勤。如果你离开得更晚，请在“我的人事”中申请更正。",
    ar: "لم يُسجَّل الانصراف، لذا أُغلق اليوم عند {workEnd}. إذا غادرت لاحقًا، فاطلب تصحيحًا من «شؤوني الوظيفية».",
  },
  "hr_attendance_clockout_reminder.s": { en: "Don't forget to clock out", zh: "别忘了打卡下班", ar: "لا تنسَ تسجيل الانصراف" },
  "hr_attendance_clockout_reminder.b": {
    en: "Your working day ended at {workEnd}. Clock out in My HR when you leave.",
    zh: "你的工作日已于 {workEnd} 结束。离开时请在“我的人事”中打卡下班。",
    ar: "انتهى يوم عملك عند {workEnd}. سجّل الانصراف من «شؤوني الوظيفية» عند مغادرتك.",
  },

  /* ── Document expiry (HR) ── */
  "hr_expiry.s": {
    en: "{field:hr_expiry_field} expiring soon: {name}",
    zh: "{field:hr_expiry_field}即将到期：{name}",
    ar: "{field:hr_expiry_field} على وشك الانتهاء: {name}",
  },
  "hr_expiry.b": {
    en: "{field:hr_expiry_field} for {name} expires on {date}. Review and renew before the deadline.",
    zh: "{name}的{field:hr_expiry_field}将于 {date} 到期。请在截止日期前审核并续办。",
    ar: "تاريخ انتهاء {field:hr_expiry_field} لدى {name}: {date}. يُرجى المراجعة والتجديد قبل الموعد النهائي.",
  },

  /* ── Enums ── */
  "enum.leave_decision.approved": { en: "approved", zh: "已获批准", ar: "مقبول" },
  "enum.leave_decision.rejected": { en: "declined", zh: "未获批准", ar: "مرفوض" },

  "enum.attendance_decision.approved": { en: "approved", zh: "已批准", ar: "معتمد" },
  "enum.attendance_decision.rejected": { en: "not approved", zh: "未获批准", ar: "غير معتمد" },

  /* hr_expiry's `field` is the koleex_employees column that is expiring. */
  "enum.hr_expiry_field.visa_expiry_date": { en: "Visa", zh: "签证", ar: "التأشيرة" },
  "enum.hr_expiry_field.insurance_expiry_date": { en: "Insurance", zh: "保险", ar: "التأمين" },
  "enum.hr_expiry_field.contract_end_date": { en: "Contract", zh: "合同", ar: "العقد" },
  "enum.hr_expiry_field.probation_end_date": { en: "Probation", zh: "试用期", ar: "فترة التجربة" },
  "enum.hr_expiry_field.driving_license_expiry": { en: "Driving licence", zh: "驾驶证", ar: "رخصة القيادة" },

  /* hr_leave_types.code → the English is the row's `name` as stored today
     (leave-review passes the code only when this word equals that name, so
     a renamed or new type keeps its own name and never changes the English).
     zh / ar follow translations/hr.ts `hr.leaveType.*`. */
  "enum.leave_type.adoption": { en: "Adoption Leave", zh: "收养假", ar: "إجازة تبنٍّ" },
  "enum.leave_type.annual": { en: "Annual Leave", zh: "年假", ar: "إجازة سنوية" },
  "enum.leave_type.bereavement": { en: "Bereavement Leave", zh: "丧假", ar: "إجازة وفاة" },
  "enum.leave_type.breastfeeding": { en: "Breastfeeding Leave", zh: "哺乳假", ar: "إجازة رضاعة" },
  "enum.leave_type.business_travel": { en: "Business Travel", zh: "出差", ar: "سفر عمل" },
  "enum.leave_type.childcare": { en: "Childcare Leave", zh: "照顾子女假", ar: "إجازة رعاية طفل" },
  "enum.leave_type.compassionate": { en: "Compassionate", zh: "丧假", ar: "إجازة عزاء" },
  "enum.leave_type.eldercare": { en: "Eldercare Leave", zh: "护理老人假", ar: "إجازة رعاية مسن" },
  "enum.leave_type.emergency": { en: "Emergency Leave", zh: "急事假", ar: "إجازة طارئة" },
  "enum.leave_type.home_visit": { en: "Home Visit Leave", zh: "探亲假", ar: "إجازة زيارة الأهل" },
  "enum.leave_type.jury_duty": { en: "Jury Duty Leave", zh: "陪审假", ar: "إجازة أداء واجب المحلفين" },
  "enum.leave_type.marriage": { en: "Marriage Leave", zh: "婚假", ar: "إجازة زواج" },
  "enum.leave_type.maternity": { en: "Maternity Leave", zh: "产假", ar: "إجازة أمومة" },
  "enum.leave_type.medical_appointment": { en: "Medical Appointment Leave", zh: "就医假", ar: "إجازة موعد طبي" },
  "enum.leave_type.menstrual": { en: "Menstrual Leave", zh: "痛经假", ar: "إجازة الدورة الشهرية" },
  "enum.leave_type.military_service": { en: "Military Service Leave", zh: "服兵役假", ar: "إجازة خدمة عسكرية" },
  "enum.leave_type.miscarriage": { en: "Miscarriage Leave", zh: "流产假", ar: "إجازة إجهاض" },
  "enum.leave_type.parental": { en: "Parental Leave", zh: "育儿假", ar: "إجازة والدية" },
  "enum.leave_type.paternity": { en: "Paternity Leave", zh: "陪产假", ar: "إجازة أبوة" },
  "enum.leave_type.personal": { en: "Personal Leave", zh: "事假", ar: "إجازة شخصية" },
  "enum.leave_type.pilgrimage": { en: "Pilgrimage Leave", zh: "朝觐假", ar: "إجازة حج" },
  "enum.leave_type.prenatal": { en: "Prenatal Leave", zh: "产检假", ar: "إجازة فحص الحمل" },
  "enum.leave_type.quarantine": { en: "Quarantine Leave", zh: "隔离假", ar: "إجازة حجر صحي" },
  "enum.leave_type.relocation": { en: "Relocation Leave", zh: "搬家假", ar: "إجازة انتقال" },
  "enum.leave_type.sabbatical": { en: "Sabbatical Leave", zh: "公休长假", ar: "إجازة تفرغ" },
  "enum.leave_type.sick": { en: "Sick Leave", zh: "病假", ar: "إجازة مرضية" },
  "enum.leave_type.study": { en: "Study Leave", zh: "学习假", ar: "إجازة دراسية" },
  "enum.leave_type.time_off_in_lieu": { en: "Time Off in Lieu", zh: "调休", ar: "إجازة بدل عمل إضافي" },
  "enum.leave_type.unpaid": { en: "Unpaid Leave", zh: "无薪假", ar: "إجازة بدون راتب" },
  "enum.leave_type.voting": { en: "Voting Leave", zh: "选举假", ar: "إجازة تصويت" },
  "enum.leave_type.work_injury": { en: "Work Injury Leave", zh: "工伤假", ar: "إجازة إصابة عمل" },
};
