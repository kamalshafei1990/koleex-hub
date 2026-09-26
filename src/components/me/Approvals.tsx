"use client";

/* Approvals — the manager's step. Shown only when someone reports to me.
   Each card is one report's pending request; my decision moves it to HR
   (approve) or closes it (reject). The server re-checks that I am still
   that person's manager, so a stale list cannot decide for someone else. */

import { useState } from "react";
import type { MyTeamRequest } from "@/lib/me-hr-types";
import { resolveHrFileUrl } from "@/components/hr/HrFileField";
import { cardCls, textareaCls, primaryBtnCls, dangerBtnCls, fmtDate, EmptyState, makeTranslationHelpers } from "@/components/hr/shared";
import PersonName from "@/components/ui/PersonName";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { ERROR_KEYS, meFetch, type MeTabProps } from "./shared";

export default function Approvals({ bundle, setBundle, t }: MeTabProps) {
  const { tLeaveType } = makeTranslationHelpers(t);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const pending = bundle.team.pending;

  const typeName = (id: string) => { const ty = bundle.leave.types.find((x) => x.id === id); return ty ? tLeaveType(ty.name, ty.code) : "—"; };

  const decide = async (r: MyTeamRequest, decision: "approve" | "reject") => {
    setBusy(r.id);
    setError((e) => ({ ...e, [r.id]: "" }));
    const res = await meFetch<{ ok: true }>(`/api/me/hr/approvals/${r.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes: notes[r.id] ?? null }),
    });
    setBusy(null);
    if (!res.ok) {
      setError((e) => ({ ...e, [r.id]: t(res.error === "not_your_report" ? "hr.me.notYourReport" : ERROR_KEYS[res.error] ?? "hr.me.error") }));
      return;
    }
    setBundle((prev) => ({ ...prev, team: { ...prev.team, pending: prev.team.pending.filter((x) => x.id !== r.id) } }));
  };

  const openAttachment = async (value: string) => {
    const url = await resolveHrFileUrl(value);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-medium text-[var(--text-primary)]">{t("hr.me.approvalsTitle")}</h2>
        <p className="text-[12px] text-[var(--text-dim)] mt-0.5">{t("hr.me.approvalsHint")}</p>
      </div>
      {pending.length === 0 ? (
        <div className={cardCls}><EmptyState icon={CheckCircleIcon} title={t("hr.me.noApprovals")} /></div>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.id} className={`${cardCls} p-5`}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="min-w-0 flex-1">
                  <PersonName name={r.employee_name} alt={r.employee_name_alt} nameClassName="text-[14px] font-semibold text-[var(--text-primary)] block" altClassName="text-[12px] text-[var(--text-dim)] block" />
                  <div className="mt-1 text-[13px] text-[var(--text-secondary)] tabular-nums">
                    <span className="font-medium text-[var(--text-primary)]">{typeName(r.leave_type_id)}</span> · {fmtDate(r.start_date)}{r.start_date !== r.end_date ? ` → ${fmtDate(r.end_date)}` : ""} · {r.days} {r.days === 1 ? t("hr.day") : t("hr.days")}
                    {r.half_day && r.half_day_period ? ` · ${t(`hr.${r.half_day_period}`)}` : ""}
                  </div>
                  {r.reason && <p className="mt-1.5 text-[13px] text-[var(--text-muted)] whitespace-pre-wrap">{r.reason}</p>}
                  {r.attachment_url && (
                    <button type="button" onClick={() => openAttachment(r.attachment_url!)} className="mt-1.5 text-[12px] font-medium text-[#0066FF]">{t("hr.openAttachment")}</button>
                  )}
                  <div className="mt-1 text-[11px] text-[var(--text-faint)]">{t("hr.submittedOn")} {fmtDate(r.created_at)}</div>
                </div>
                <div className="w-full sm:w-[300px] shrink-0 space-y-2">
                  <textarea value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} rows={2} placeholder={t("hr.me.decisionNotes")} className={textareaCls} />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => decide(r, "reject")} disabled={busy === r.id} className={`${dangerBtnCls} !h-9 !px-4`}>{t("hr.reject")}</button>
                    <button type="button" onClick={() => decide(r, "approve")} disabled={busy === r.id} className={`${primaryBtnCls} !h-9 !px-4 inline-flex items-center gap-2`}>
                      {busy === r.id && <SpinnerIcon size={13} />} {t("hr.approve")}
                    </button>
                  </div>
                  {error[r.id] && <p className="text-[12px] text-[#FF3333] text-end">{error[r.id]}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
