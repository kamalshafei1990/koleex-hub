"use client";

/* Leave — my balances, my requests, and the form that files a new one.
   The form is the HR app's leave form with the employee picker removed:
   the server already knows who I am. */

import { useMemo, useState } from "react";
import type { MyLeaveRequest } from "@/lib/me-hr-types";
import { computeBusinessDays, calendarDays, rangesOverlap } from "@/lib/hr/leave-days";
import DatePicker from "@/components/ui/DatePicker";
import HrFileField, { resolveHrFileUrl } from "@/components/hr/HrFileField";
import {
  cardCls, inputCls, textareaCls, primaryBtnCls, cancelBtnCls, dangerBtnCls,
  fmtDate, ModalShell, FieldLabel, StatusBadge, EmptyState, LEAVE_STATUS_MAP, makeTranslationHelpers,
} from "@/components/hr/shared";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { ERROR_KEYS, fmtNum, meFetch, type MeTabProps } from "./shared";

const EMPTY_FORM = {
  leave_type_id: "", start_date: "", end_date: "", reason: "",
  half_day: false, half_day_period: "", attachment_url: "",
  contact_phone: "", contact_address: "", destination: "", handover_notes: "",
  emergency_contact_name: "", emergency_contact_phone: "",
};

export default function Leave({ bundle, setBundle, t, lang }: MeTabProps) {
  const { tLeaveType, tStatus } = makeTranslationHelpers(t);
  const { types, balances, requests } = bundle.leave;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<MyLeaveRequest | null>(null);
  const [more, setMore] = useState(false);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const typeOf = (id: string) => types.find((x) => x.id === id) ?? null;
  const typeName = (id: string) => { const ty = typeOf(id); return ty ? tLeaveType(ty.name, ty.code) : "—"; };

  const dateError = !!form.start_date && !!form.end_date && form.end_date < form.start_date;
  const isSingleDay = !!form.start_date && form.start_date === form.end_date;
  const working = dateError || !form.start_date || !form.end_date ? 0 : computeBusinessDays(form.start_date, form.end_date);
  const calendar = dateError || !form.start_date || !form.end_date ? 0 : calendarDays(form.start_date, form.end_date);
  const requested = form.half_day && isSingleDay ? 0.5 : working;
  const selectedType = typeOf(form.leave_type_id);
  const balance = balances.find((b) => b.leaveTypeId === form.leave_type_id) ?? null;
  const after = balance ? balance.remaining - requested : null;

  const overlapping = useMemo(() => {
    if (!form.start_date || !form.end_date || dateError) return [];
    return requests.filter((r) => (r.status === "pending" || r.status === "approved") && rangesOverlap(r.start_date, r.end_date, form.start_date, form.end_date));
  }, [requests, form.start_date, form.end_date, dateError]);

  const canSubmit = !!form.leave_type_id && !!form.start_date && !!form.end_date && !dateError && requested > 0
    && (!form.half_day || !!form.half_day_period) && (!selectedType?.requiresDoc || !!form.attachment_url) && overlapping.length === 0;

  const close = () => { setOpen(false); setError(null); setForm(EMPTY_FORM); setMore(false); };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const body = { ...form, half_day: form.half_day && isSingleDay, half_day_period: form.half_day && isSingleDay ? form.half_day_period : null };
    const res = await meFetch<{ request: MyLeaveRequest }>("/api/me/hr/leave", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { setError(t(ERROR_KEYS[res.error] ?? "hr.me.error")); return; }
    const row = res.data.request;
    setBundle((prev) => ({ ...prev, leave: { ...prev.leave, requests: [row, ...prev.leave.requests].sort((a, b) => (a.start_date < b.start_date ? 1 : -1)) } }));
    close();
  };

  const cancel = async (r: MyLeaveRequest) => {
    setCancelling(r.id);
    const res = await meFetch<{ ok: true }>(`/api/me/hr/leave/${r.id}`, { method: "DELETE" });
    setCancelling(null);
    setConfirmCancel(null);
    if (!res.ok) return;
    setBundle((prev) => ({ ...prev, leave: { ...prev.leave, requests: prev.leave.requests.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)) } }));
  };

  const openAttachment = async (value: string) => {
    const url = await resolveHrFileUrl(value);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      {/* Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {balances.map((b) => (
            <div key={b.leaveTypeId} className={`${cardCls} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{typeName(b.leaveTypeId)}</div>
              <div className="mt-1 text-[24px] font-bold leading-none tabular-nums text-[var(--text-primary)]">{fmtNum(b.remaining)}</div>
              <div className="mt-1.5 text-[12px] text-[var(--text-dim)] tabular-nums">{t("hr.used")} {fmtNum(b.used)} / {fmtNum(b.entitled + b.carriedOver + b.adjustment)}</div>
              {b.virtual && <div className="mt-1 text-[11px] text-[var(--text-faint)]">{t("hr.me.virtualBalance")}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Requests */}
      <section className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.leaveRequests")}</h3>
          <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} inline-flex items-center gap-2 !h-9 !px-4`}>
            <PlusIcon className="h-4 w-4" /> {t("hr.newRequest")}
          </button>
        </div>
        {requests.length === 0 ? (
          <EmptyState icon={CalendarPlusIcon} title={t("hr.noLeaveRequests")} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{typeName(r.leave_type_id)}</span>
                    <StatusBadge status={r.status} map={LEAVE_STATUS_MAP} label={tStatus(r.status)} />
                  </div>
                  <div className="mt-0.5 text-[var(--text-secondary)] tabular-nums">
                    {fmtDate(r.start_date)}{r.start_date !== r.end_date ? ` → ${fmtDate(r.end_date)}` : ""} · {r.days} {r.days === 1 ? t("hr.day") : t("hr.days")}
                    {r.half_day && r.half_day_period ? ` · ${t(`hr.${r.half_day_period}`)}` : ""}
                  </div>
                  {r.reason && <div className="mt-0.5 text-[12px] text-[var(--text-dim)] truncate">{r.reason}</div>}
                  {r.review_notes && <div className="mt-0.5 text-[12px] text-[var(--text-dim)]">{t("hr.reviewNotes")}: {r.review_notes}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.attachment_url && (
                    <button type="button" onClick={() => openAttachment(r.attachment_url!)} className="h-8 px-3 rounded-lg text-[12px] font-medium text-[#0066FF] hover:bg-[var(--bg-surface)] transition-colors">{t("hr.openAttachment")}</button>
                  )}
                  {r.status === "pending" && (
                    <button type="button" onClick={() => setConfirmCancel(r)} disabled={cancelling === r.id}
                      className="h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-dim)] hover:text-[#FF3333] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50">
                      {cancelling === r.id ? <SpinnerIcon size={12} /> : t("hr.me.cancelRequest")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cancel confirm */}
      <ModalShell open={!!confirmCancel} onClose={() => setConfirmCancel(null)} title={t("hr.me.cancelRequest")} width="max-w-[420px]"
        footer={<>
          <button type="button" onClick={() => setConfirmCancel(null)} className={cancelBtnCls}>{t("hr.close")}</button>
          <button type="button" onClick={() => confirmCancel && cancel(confirmCancel)} disabled={!!cancelling} className={dangerBtnCls}>{t("hr.me.cancelRequest")}</button>
        </>}>
        <p className="text-[13px] text-[var(--text-secondary)]">{t("hr.me.cancelConfirm")}</p>
        {confirmCancel && <p className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">{typeName(confirmCancel.leave_type_id)} · {fmtDate(confirmCancel.start_date)}{confirmCancel.start_date !== confirmCancel.end_date ? ` → ${fmtDate(confirmCancel.end_date)}` : ""}</p>}
      </ModalShell>

      {/* New request */}
      <ModalShell open={open} onClose={close} title={t("hr.newLeaveRequest")} width="max-w-[560px]"
        footer={<>
          <button type="button" onClick={close} className={cancelBtnCls}>{t("hr.cancel")}</button>
          <button type="button" onClick={submit} disabled={!canSubmit || saving} className={`${primaryBtnCls} inline-flex items-center gap-2`}>
            {saving && <SpinnerIcon size={13} />} {t("hr.submit")}
          </button>
        </>}>
        <div>
          <FieldLabel>{t("hr.leaveType")}</FieldLabel>
          <select value={form.leave_type_id} onChange={(e) => set("leave_type_id", e.target.value)} className={inputCls}>
            <option value="">{t("hr.selectType")}</option>
            {types.map((ty) => <option key={ty.id} value={ty.id}>{tLeaveType(ty.name, ty.code)}</option>)}
          </select>
          {balance && (
            <p className="mt-1.5 text-[12px] text-[var(--text-dim)] tabular-nums">
              {t("hr.remaining")} {fmtNum(balance.remaining)}{requested > 0 && after !== null ? ` · ${t("hr.afterThisRequest")} ${fmtNum(after)}` : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t("hr.startDate")}</FieldLabel>
            <DatePicker value={form.start_date} lang={lang} min={bundle.serverDate} placeholder={t("hr.pickDate")}
              onChange={(iso) => setForm((f) => ({ ...f, start_date: iso, end_date: f.end_date && f.end_date < iso ? iso : f.end_date || iso, half_day: f.half_day && (f.end_date || iso) === iso }))} />
          </div>
          <div>
            <FieldLabel>{t("hr.endDate")}</FieldLabel>
            <DatePicker value={form.end_date} lang={lang} min={form.start_date || bundle.serverDate} placeholder={t("hr.pickDate")}
              onChange={(iso) => setForm((f) => ({ ...f, end_date: iso, half_day: f.half_day && f.start_date === iso }))} />
          </div>
        </div>
        {dateError && <p className="text-[12px] text-[#FF3333]">{t("hr.endBeforeStart")}</p>}
        {!dateError && calendar > 0 && (
          <p className="text-[12px] text-[var(--text-dim)] tabular-nums">
            {t("hr.duration")}: {requested} {requested === 1 ? t("hr.workingDay") : t("hr.workingDays")} · {calendar} {t("hr.calendarDays")}
          </p>
        )}
        {overlapping.length > 0 && <p className="text-[12px] text-[#FFCC00]">{t("hr.overlapWarning")}</p>}
        {balance && after !== null && after < 0 && selectedType && selectedType.defaultDays > 0 && <p className="text-[12px] text-[#FF3333]">{t("hr.exceedsBalance")}</p>}

        {isSingleDay && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <input type="checkbox" checked={form.half_day} onChange={(e) => set("half_day", e.target.checked)} className="h-4 w-4" />
              {t("hr.halfDayLabel")}
            </label>
            {form.half_day && (
              <select value={form.half_day_period} onChange={(e) => set("half_day_period", e.target.value)} className={`${inputCls} !w-auto`}>
                <option value="">{t("hr.periodLabel")}</option>
                <option value="morning">{t("hr.morning")}</option>
                <option value="afternoon">{t("hr.afternoon")}</option>
              </select>
            )}
          </div>
        )}

        <div>
          <FieldLabel>{t("hr.reasonLabel")}</FieldLabel>
          <textarea value={form.reason} onChange={(e) => set("reason", e.target.value)} rows={3} placeholder={t("hr.optionalReason")} className={textareaCls} />
        </div>

        <div>
          <FieldLabel>{t("hr.attachment")}{selectedType?.requiresDoc ? " *" : ""}</FieldLabel>
          <HrFileField value={form.attachment_url} onChange={(p) => set("attachment_url", p)} folder="leave" endpoint="/api/me/hr/upload"
            label={t("hr.dropFileHere")} hint={t("hr.attachmentHint")} browseLabel={t("hr.browseFiles")} removeLabel={t("hr.removeFile")} errorLabel={t("hr.uploadFailed")} />
          {selectedType?.requiresDoc && !form.attachment_url && <p className="mt-1 text-[12px] text-[var(--text-dim)]">{t("hr.me.attachmentRequired")}</p>}
        </div>

        <button type="button" onClick={() => setMore((m) => !m)} className="text-[12px] font-medium text-[#0066FF]">
          {more ? t("hr.me.lessDetails") : t("hr.me.moreDetails")}
        </button>
        {more && (
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.whileAwaySection")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>{t("hr.contactPhone")}</FieldLabel><input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className={inputCls} /></div>
              <div><FieldLabel>{t("hr.destination")}</FieldLabel><input value={form.destination} onChange={(e) => set("destination", e.target.value)} className={inputCls} /></div>
            </div>
            <div><FieldLabel>{t("hr.contactAddress")}</FieldLabel><input value={form.contact_address} onChange={(e) => set("contact_address", e.target.value)} className={inputCls} /></div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.coverSection")}</div>
            <div><FieldLabel>{t("hr.handoverNotes")}</FieldLabel><textarea value={form.handover_notes} onChange={(e) => set("handover_notes", e.target.value)} rows={2} className={textareaCls} /></div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.emergencySection")}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>{t("hr.emergencyName")}</FieldLabel><input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} className={inputCls} /></div>
              <div><FieldLabel>{t("hr.emergencyPhone")}</FieldLabel><input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} className={inputCls} /></div>
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-[#FF3333]">{error}</p>}
      </ModalShell>
    </div>
  );
}
