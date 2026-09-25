"use client";

/* ---------------------------------------------------------------------------
   HolidaysPanel — Super Admin only: the tenant's holidays (report GEN-10),
   listed, added and removed through the existing routes
   (POST /api/calendar/holidays, DELETE /api/calendar/holidays/[id], both of
   which refuse anyone but a Super Admin). Country-scoped holidays only; the
   customer scope keeps its seed data.

     · national / official — a date, optionally every year
     · weekly — a rest day (weekday), shown as the one "Weekend" hint

   Removing is a soft delete on the server (is_active = false).
   --------------------------------------------------------------------------- */

import { useId, useState } from "react";
import { Button, ConfirmDialog, Drawer } from "@/components/kds";
import { PlusIcon, TrashIcon } from "@/components/icons/ui";
import { useTranslation } from "@/lib/i18n";
import { calendarT } from "@/lib/translations/calendar";
import { createHoliday, deleteHoliday, type HolidayRow, type HolidayType } from "@/lib/calendar-holidays";

const TYPES: HolidayType[] = ["national", "official", "weekly"];
/* JS weekday (0=Sun) in ISO order, labelled with the calendar's wd.<iso> keys. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
const labelClass = "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";

function dmy(key: string | null): string {
  if (!key) return "";
  const [y, m, d] = key.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function HolidaysPanel({
  open,
  onClose,
  rows,
  onChanged,
  onError,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  rows: HolidayRow[];
  /** Reload the list after a change. */
  onChanged: () => void;
  onError: (msg: string) => void;
  onDone: (msg: string) => void;
}) {
  const { t } = useTranslation(calendarT);
  const ids = { name: useId(), type: useId(), country: useId(), date: useId(), weekday: useId() };
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("national");
  const [country, setCountry] = useState("");
  const [date, setDate] = useState("");
  const [weekday, setWeekday] = useState(5);
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HolidayRow | null>(null);

  const sorted = [...rows].sort((a, b) =>
    (a.holiday_type === "weekly" ? 0 : 1) - (b.holiday_type === "weekly" ? 0 : 1) ||
    (a.holiday_date ?? "").localeCompare(b.holiday_date ?? "") ||
    a.name.localeCompare(b.name));

  const canAdd = !!name.trim() && (type === "weekly" || /^\d{4}-\d{2}-\d{2}$/.test(date));

  async function add() {
    if (!canAdd || busy) return;
    setBusy(true);
    const row = await createHoliday({
      name: name.trim(),
      holiday_type: type,
      country: country.trim() || null,
      holiday_date: type === "weekly" ? null : date,
      weekday: type === "weekly" ? weekday : null,
      recurs_annually: type !== "weekly" && annual,
    });
    setBusy(false);
    if (!row) { onError(t("holidays.err.save")); return; }
    setName(""); setDate(""); setAnnual(false);
    onDone(t("holidays.added"));
    onChanged();
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    const ok = await deleteHoliday(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
    if (!ok) { onError(t("holidays.err.delete")); return; }
    onDone(t("holidays.removed"));
    onChanged();
  }

  return (
    <>
      <Drawer open={open} onClose={onClose} eyebrow={t("app.title")} title={t("holidays.manage")}>
        {/* Add */}
        <section aria-labelledby={ids.name + "-h"} className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <h3 id={ids.name + "-h"} className="text-[12px] font-semibold text-[var(--text-primary)]">{t("holidays.add")}</h3>
          <div>
            <label htmlFor={ids.name} className={labelClass}>{t("holidays.name")}</label>
            <input id={ids.name} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={ids.type} className={labelClass}>{t("holidays.type")}</label>
              <select id={ids.type} className={inputClass} value={type} onChange={(e) => setType(e.target.value as HolidayType)}>
                {TYPES.map((ty) => <option key={ty} value={ty}>{t(`holidays.type.${ty}`)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={ids.country} className={labelClass}>{t("holidays.country")}</label>
              <input id={ids.country} className={inputClass} value={country} maxLength={60} placeholder={t("holidays.country.placeholder")} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          {type === "weekly" ? (
            <div>
              <label htmlFor={ids.weekday} className={labelClass}>{t("holidays.weekday")}</label>
              <select id={ids.weekday} className={inputClass} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS.map((wd) => <option key={wd} value={wd}>{t(`wd.${wd === 0 ? 7 : wd}`)}</option>)}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label htmlFor={ids.date} className={labelClass}>{t("holidays.date")}</label>
                <input id={ids.date} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input type="checkbox" checked={annual} onChange={(e) => setAnnual(e.target.checked)} className="h-4 w-4 rounded border-[var(--border-subtle)]" />
                <span className="text-[13px] text-[var(--text-muted)]">{t("holidays.annual")}</span>
              </label>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={() => { void add(); }} disabled={!canAdd || busy} className="flex items-center gap-2 disabled:opacity-50">
              <PlusIcon className="h-4 w-4" aria-hidden /> {t("holidays.add")}
            </Button>
          </div>
        </section>

        {/* List */}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {t("holidays")} · {sorted.length}
          </h3>
          {sorted.length === 0 ? (
            <p className="text-[12px] text-[var(--text-dim)]">{t("holidays.none")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              {sorted.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{h.name}</p>
                    <p className="truncate text-[11px] text-[var(--text-dim)] tabular-nums">
                      {[
                        t(`holidays.type.${h.holiday_type}`),
                        h.holiday_type === "weekly" && h.weekday != null ? t(`wd.${h.weekday === 0 ? 7 : h.weekday}`) : dmy(h.holiday_date),
                        h.recurs_annually ? t("holidays.annual") : null,
                        h.country || (h.scope_type === "customer" ? t("holidays.customer") : null),
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(h)}
                    disabled={busy}
                    aria-label={`${t("modal.delete")} · ${h.name}`}
                    className="h-8 w-8 shrink-0 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--state-error)] hover:border-[var(--state-error)]/40 flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Drawer>

      <ConfirmDialog
        open={!!pendingDelete}
        title={t("holidays.confirmDelete")}
        message={pendingDelete ? t("holidays.confirmDelete.msg").replace("{name}", pendingDelete.name) : ""}
        confirmLabel={t("modal.delete")}
        cancelLabel={t("modal.cancel")}
        busy={busy}
        onConfirm={() => { void remove(); }}
        onCancel={() => { if (!busy) setPendingDelete(null); }}
      />
    </>
  );
}
