"use client";

/* Settings → Language & region. Date / time / number / units / currency
   format, persisted in accounts.preferences.display. The format helpers live
   in src/lib/display-prefs (formatDatePref/formatTimePref/formatNumberPref);
   Login history already renders through them, and new date/number surfaces
   should adopt them too. */

import { useEffect, useMemo, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type {
  DisplayPrefs, DateFormatPref, TimeFormatPref, NumberFormatPref,
  UnitsPref, CurrencyDisplayPref, WeekStartPref,
} from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import {
  cacheDisplayPreferences, formatDatePref, formatTimePref, formatNumberPref,
} from "@/lib/display-prefs";
import { SettingsCard, ControlRow, Segmented, SelectControl } from "./ui";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

export default function RegionTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [d, setD] = useState<DisplayPrefs>(() => withDefaults(account.preferences).display as DisplayPrefs);
  const { t } = useTranslation(settingsT);
  const now = useMemo(() => new Date(), []);

  /* Keep in sync with the shared `display` slice when the account refreshes
     (e.g. after Display & accessibility saved), so format edits don't
     overwrite a just-changed text size. */
  useEffect(() => {
    setD(withDefaults(account.preferences).display as DisplayPrefs);
  }, [account.preferences]);

  function patch(next: Partial<DisplayPrefs>) {
    const merged = { ...d, ...next };
    setD(merged);
    cacheDisplayPreferences(merged);
    // Persist ONLY the display slice; the server merges it onto the rest.
    void updateAccountPreferences(account.id, { display: merged }).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      {/* Live preview so the effect is visible even before other apps adopt it. */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
        <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider mb-1">{t("region.preview")}</p>
        <p className="text-[14px] font-medium text-[var(--text-primary)]">
          {formatDatePref(now, d.date_format)} · {formatTimePref(now, d.time_format)} · {formatNumberPref(1234.5, d.number_format)}
        </p>
      </div>

      <SettingsCard title={t("region.dateTime")}>
        <ControlRow label={t("region.dateFormat")}>
          <Segmented<DateFormatPref>
            value={d.date_format}
            onChange={(v) => patch({ date_format: v })}
            options={[
              { value: "dmy", label: "D/M/Y" },
              { value: "mdy", label: "M/D/Y" },
              { value: "iso", label: "ISO" },
            ]}
          />
        </ControlRow>
        <ControlRow label={t("region.timeFormat")} last>
          <Segmented<TimeFormatPref>
            value={d.time_format}
            onChange={(v) => patch({ time_format: v })}
            options={[{ value: "24h", label: "24h" }, { value: "12h", label: "12h" }]}
          />
        </ControlRow>
      </SettingsCard>

      <SettingsCard title={t("region.numbersUnits")}>
        <ControlRow label={t("region.numberFormat")} hint={t("region.numberFormat.hint")}>
          <SelectControl<NumberFormatPref>
            value={d.number_format}
            onChange={(v) => patch({ number_format: v })}
            options={[
              { value: "comma_dot", label: "1,234.50" },
              { value: "dot_comma", label: "1.234,50" },
              { value: "space_comma", label: "1 234,50" },
            ]}
          />
        </ControlRow>
        <ControlRow label={t("region.units")} hint={t("region.units.hint")}>
          <Segmented<UnitsPref>
            value={d.units}
            onChange={(v) => patch({ units: v })}
            options={[{ value: "metric", label: t("region.metric") }, { value: "imperial", label: t("region.imperial") }]}
          />
        </ControlRow>
        <ControlRow label={t("region.currency")} last>
          <Segmented<CurrencyDisplayPref>
            value={d.currency_display}
            onChange={(v) => patch({ currency_display: v })}
            options={[{ value: "symbol", label: "$" }, { value: "code", label: "USD" }]}
          />
        </ControlRow>
      </SettingsCard>

      <SettingsCard title={t("region.calendar")}>
        <ControlRow label={t("region.weekStart")} last>
          <Segmented<WeekStartPref>
            value={d.week_start}
            onChange={(v) => patch({ week_start: v })}
            options={[{ value: 0, label: t("region.sun") }, { value: 1, label: t("region.mon") }, { value: 6, label: t("region.sat") }]}
          />
        </ControlRow>
      </SettingsCard>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        {t("region.footer")}
      </p>
    </div>
  );
}
