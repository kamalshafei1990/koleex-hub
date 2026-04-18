"use client";

/* ---------------------------------------------------------------------------
   CalendarTab — user-level calendar preferences.

   Fields (persisted to accounts.preferences.calendar jsonb):
     - Timezone         — IANA zone from COMMON_TIMEZONES
     - Working Hours    — start + end time + active weekdays
     - Default Meeting Duration (minutes)
     - Out-of-office    — toggle + date range + message

   These fields feed into the Calendar app's rendering (future project B):
   when we render a user's week view, we'll use their timezone + working hours
   to shade the grid; Out-of-office shows as a greyed band.

   Important: NO Google integration here — the Calendar app is self-contained
   per user decision.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import CalendarIcon from "@/components/icons/ui/CalendarRawIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import Globe2Icon from "@/components/icons/ui/Globe2Icon";
import PlaneIcon from "@/components/icons/ui/PlaneIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import type {
  AccountWithLinks,
  AccountPreferences,
} from "@/types/supabase";
import {
  COMMON_TIMEZONES,
  WEEKDAYS,
  withDefaults,
} from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
import {
  tabCardClass,
  tabSectionTitle,
  selectClass,
  inputClass,
  textareaClass,
  labelClass,
  Toggle,
  TabActionBar,
} from "./shared";

interface Props {
  account: AccountWithLinks;
  onChanged?: (prefs: AccountPreferences) => void;
}

export default function CalendarTab({ account, onChanged }: Props) {
  const { t } = useTranslation(accountsT);
  const initial = useMemo(
    () => withDefaults(account.preferences),
    [account.preferences],
  );

  const [prefs, setPrefs] = useState<AccountPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPrefs(initial), [initial]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);
  const cal = prefs.calendar ?? {};
  const wh = cal.working_hours ?? { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };
  const ooo = cal.out_of_office ?? { enabled: false };

  function patchCal(patch: Partial<typeof cal>) {
    setPrefs({ ...prefs, calendar: { ...cal, ...patch } });
  }

  function toggleDay(iso: number) {
    const days = wh.days.includes(iso)
      ? wh.days.filter((d) => d !== iso)
      : [...wh.days, iso].sort((a, b) => a - b);
    patchCal({ working_hours: { ...wh, days } });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const ok = await updateAccountPreferences(account.id, prefs);
    setSaving(false);
    if (!ok) {
      setError(t("acc.err.calendarFailed"));
      return;
    }
    setToast(t("acc.msg.calendarSaved"));
    onChanged?.(prefs);
  }

  return (
    <div className="space-y-4">
      {/* Timezone */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <Globe2Icon className="h-3.5 w-3.5" />
          {t("acc.cal.timezone")}
        </h2>
        <select
          className={selectClass}
          value={cal.timezone ?? "Asia/Dubai"}
          onChange={(e) => patchCal({ timezone: e.target.value })}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-[var(--text-dim)] mt-2">
          {t("acc.cal.timezoneHint")}
        </p>
      </section>

      {/* Working Hours */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <ClockIcon className="h-3.5 w-3.5" />
          {t("acc.cal.workingHours")}
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>{t("acc.cal.start")}</label>
            <input
              type="time"
              className={inputClass}
              value={wh.start}
              onChange={(e) =>
                patchCal({ working_hours: { ...wh, start: e.target.value } })
              }
            />
          </div>
          <div>
            <label className={labelClass}>{t("acc.cal.end")}</label>
            <input
              type="time"
              className={inputClass}
              value={wh.end}
              onChange={(e) =>
                patchCal({ working_hours: { ...wh, end: e.target.value } })
              }
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("acc.cal.activeDays")}</label>
          <div className="flex gap-2 flex-wrap">
            {WEEKDAYS.map((d) => {
              const on = wh.days.includes(d.iso);
              return (
                <button
                  type="button"
                  key={d.iso}
                  onClick={() => toggleDay(d.iso)}
                  className={`h-9 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                    on
                      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                      : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Default Meeting Duration */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <CalendarIcon className="h-3.5 w-3.5" />
          {t("acc.cal.defaultMeeting")}
        </h2>
        <select
          className={selectClass}
          value={cal.default_meeting_duration_min ?? 30}
          onChange={(e) =>
            patchCal({ default_meeting_duration_min: Number(e.target.value) })
          }
        >
          <option value={15}>{t("acc.cal.15min")}</option>
          <option value={30}>{t("acc.cal.30min")}</option>
          <option value={45}>{t("acc.cal.45min")}</option>
          <option value={60}>{t("acc.cal.1hr")}</option>
          <option value={90}>{t("acc.cal.1_5hr")}</option>
          <option value={120}>{t("acc.cal.2hr")}</option>
        </select>
        <p className="text-[11px] text-[var(--text-dim)] mt-2">
          {t("acc.cal.meetingHint")}
        </p>
      </section>

      {/* Out of Office */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <PlaneIcon className="h-3.5 w-3.5" />
          {t("acc.cal.outOfOffice")}
        </h2>
        <Toggle
          label={t("acc.cal.oooToggle")}
          description={t("acc.cal.oooDescription")}
          checked={ooo.enabled}
          onChange={(v) => patchCal({ out_of_office: { ...ooo, enabled: v } })}
        />
        {ooo.enabled && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t("acc.cal.startDate")}</label>
                <input
                  type="date"
                  className={inputClass}
                  value={ooo.start ?? ""}
                  onChange={(e) =>
                    patchCal({ out_of_office: { ...ooo, start: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className={labelClass}>{t("acc.cal.endDate")}</label>
                <input
                  type="date"
                  className={inputClass}
                  value={ooo.end ?? ""}
                  onChange={(e) =>
                    patchCal({ out_of_office: { ...ooo, end: e.target.value } })
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("acc.cal.autoReply")}</label>
              <textarea
                className={textareaClass}
                rows={4}
                value={ooo.message ?? ""}
                onChange={(e) =>
                  patchCal({ out_of_office: { ...ooo, message: e.target.value } })
                }
                placeholder={t("acc.cal.autoReplyPlaceholder")}
              />
            </div>
          </div>
        )}
      </section>

      {toast && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className={tabCardClass}>
        <TabActionBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onReset={() => setPrefs(initial)}
        />
      </section>
    </div>
  );
}
