import type { Translations } from "@/lib/i18n";

/* Finance — the `approvals.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_APPROVALS: Translations = {
  "approvals.subtitle.long":{ en: "Review items waiting on your decision.",
                              zh: "审核等待您决定的项目。",
                              ar: "راجع البنود التي تنتظر قرارك." },

  /* ── Approvals ─────────────────────────────────────────────────── */
  "approvals.title":        { en: "Approvals",                    zh: "审批",                  ar: "الموافقات" },
  "approvals.subtitle":     { en: "Review items waiting on your decision.",
                              zh: "审核等待您决定的项目。",
                              ar: "راجع البنود التي تنتظر قرارك." },

  /* ── FinanceApprovals (pending queue) ─────────────────────────── */
  "approvals.subtitleQueue":   { en: "Review and approve pending work",
                                  zh: "审核并批准待办工作。",
                                  ar: "راجع البنود المعلقة واعتمدها." },
  "approvals.workspace":       { en: "Workspace",                       zh: "工作台",                   ar: "مساحة العمل" },
  "approvals.pendingCount":    { en: "Pending ({n})",                   zh: "待审批 ({n})",             ar: "بانتظار ({n})" },
  "approvals.readOnly":        { en: "Read-only · approver permission required",
                                  zh: "只读 · 需要审批权限",
                                  ar: "للقراءة فقط · صلاحية الاعتماد مطلوبة" },
  "approvals.empty":           { en: "No items awaiting action.",       zh: "暂无待处理项。",            ar: "لا توجد بنود بانتظار إجراء." },
  "approvals.activity":        { en: "Activity",                        zh: "活动",                    ar: "النشاط" },
  "approvals.lastEvents":      { en: "Last {n} events",                 zh: "最近 {n} 次事件",          ar: "آخر {n} حدثًا" },
  "approvals.activityEmpty":   { en: "No activity yet.",                zh: "暂无活动记录。",            ar: "لا يوجد نشاط بعد." },
  "approvals.btn.submit":      { en: "Submit",                          zh: "提交",                    ar: "تقديم" },
  "approvals.btn.approve":     { en: "Approve",                         zh: "批准",                    ar: "اعتماد" },
  "approvals.btn.reject":      { en: "Reject",                          zh: "驳回",                    ar: "رفض" },
  "approvals.rejectPrompt":    { en: "Reason for rejection (min 3 chars):",
                                  zh: "驳回原因（最少 3 个字符）：",
                                  ar: "سبب الرفض (3 أحرف على الأقل):" },
  "approvals.kind.expense":    { en: "Expense",                         zh: "费用",                    ar: "مصروف" },
  "approvals.kind.payment":    { en: "Payment",                         zh: "付款",                    ar: "دفعة" },
  "approvals.kind.bill":       { en: "Bill",                            zh: "账单",                    ar: "فاتورة" },
  "approvals.kind.journal":    { en: "Journal",                         zh: "日记账",                  ar: "قيد" },
  "approvals.status.draft":    { en: "draft",                           zh: "草稿",                    ar: "مسودة" },
  "approvals.status.submitted":{ en: "submitted",                       zh: "已提交",                  ar: "مقدمة" },
  "approvals.status.pending":  { en: "pending",                         zh: "审核中",                  ar: "قيد الانتظار" },
  "approvals.status.approved": { en: "approved",                        zh: "已批准",                  ar: "معتمدة" },
  "approvals.status.rejected": { en: "rejected",                        zh: "已驳回",                  ar: "مرفوضة" },
  "approvals.system":          { en: "system",                          zh: "系统",                    ar: "النظام" },
};
