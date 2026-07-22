"use client";

/* Settings → Language & region. Date / time / number / units / currency
   format, persisted in accounts.preferences.display. The format helpers live
   in src/lib/display-prefs (formatDatePref/formatTimePref/formatNumberPref);
   Login history already renders through them, and new date/number surfaces
   should adopt them too. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type {
  DisplayPrefs, DateFormatPref, TimeFormatPref, NumberFormatPref,
  UnitsPref, CurrencyDisplayPref, WeekStartPref,
} from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import {
  saveDisplayPreferencesLocally, formatDatePref, formatTimePref, formatNumberPref,
} from "@/lib/display-prefs";
import { SettingsCard, ControlRow, Segmented, SelectControl } from "./ui";
import type { Lang } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

export default function RegionTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [d, setD] = useState<DisplayPrefs>(() => withDefaults(account.preferences).display as DisplayPrefs);
  /* What we last wrote. The account refresh below can arrive carrying the
     PRE-save snapshot (shared identity cache), which would visibly revert the
     user's choice a second after they made it — so ignore incoming snapshots
     until they catch up with our own write. */
  const savedRef = useRef<string | null>(null);

  const { t } = useTranslation(settingsT);
  const now = useMemo(() => new Date(), []);

  /* Interface language lived only in Preferences, which meant the section
     NAMED "Language & region" had no language in it and its own footer told
     you to go elsewhere. Same mechanism as the header picker (localStorage +
     "langchange"), so the two stay in lockstep. */
  const [uiLang, setUiLang] = useState<Lang>("en");
  useEffect(() => {
    const read = () => {
      const v = localStorage.getItem("koleex-lang");
      setUiLang(v === "zh" || v === "ar" ? v : "en");
    };
    read();
    const onLang = (e: Event) => setUiLang((e as CustomEvent<Lang>).detail);
    window.addEventListener("langchange", onLang);
    return () => window.removeEventListener("langchange", onLang);
  }, []);

  function pickLang(next: Lang) {
    setUiLang(next);
    document.documentElement.setAttribute("lang", next);
    document.documentElement.setAttribute("dir", next === "ar" ? "rtl" : "ltr");
    try { localStorage.setItem("koleex-lang", next); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent("langchange", { detail: next }));
  }

  /* Keep in sync with the shared `display` slice when the account refreshes
     (e.g. after Display & accessibility saved), so format edits don't
     overwrite a just-changed text size. */
  useEffect(() => {
    const incoming = withDefaults(account.preferences).display as DisplayPrefs;
    const json = JSON.stringify(incoming);
    if (savedRef.current !== null) {
      if (json !== savedRef.current) return;   // still stale — keep the local edit
      savedRef.current = null;                 // caught up; resume normal syncing
    }
    setD(incoming);
  }, [account.preferences]);

  function patch(next: Partial<DisplayPrefs>) {
    const merged = { ...d, ...next };
    savedRef.current = JSON.stringify(merged);
    setD(merged);
    saveDisplayPreferencesLocally(merged);
    // Persist ONLY the display slice; the server merges it onto the rest.
    void updateAccountPreferences(account.id, { display: merged }).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      {/* Live preview. Every control on this screen appears here — the old
          one showed date/time/number only, so three of the seven settings
          had no visible effect at all while you were choosing them. */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
        <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider mb-2">{t("region.preview")}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] font-medium text-[var(--text-primary)]">
          <span>{formatDatePref(now, d.date_format)}</span>
          <span className="text-[var(--text-faint)]">·</span>
          <span>{formatTimePref(now, d.time_format)}</span>
          <span className="text-[var(--text-faint)]">·</span>
          <span>
            {d.currency_display === "code" ? "USD " : "$"}
            {formatNumberPref(1234.5, d.number_format)}
          </span>
          <span className="text-[var(--text-faint)]">·</span>
          <span>{d.units === "metric" ? "12 kg · 30 cm" : "26 lb · 12 in"}</span>
        </div>
        <p className="mt-1.5 text-[11.5px] text-[var(--text-dim)]">
          {t("region.preview.weekStart").replace(
            "{day}",
            d.week_start === 0 ? t("region.sunday") : d.week_start === 6 ? t("region.saturday") : t("region.monday"),
          )}
        </p>
      </div>

      <SettingsCard title={t("region.language")} subtitle={t("region.language.sub")}>
        <ControlRow label={t("region.interfaceLang")} hint={t("region.interfaceLang.hint")} last>
          <Segmented<Lang>
            value={uiLang}
            onChange={pickLang}
            options={[
              { value: "en", label: "English" },
              { value: "zh", label: "中文" },
              { value: "ar", label: "العربية" },
            ]}
          />
        </ControlRow>
      </SettingsCard>

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
        <ControlRow label={t("region.weekStart")} hint={t("region.weekStart.hint")} last>
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
