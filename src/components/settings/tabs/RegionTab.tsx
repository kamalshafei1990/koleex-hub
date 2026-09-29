"use client";

/* Settings → Language & region: interface language (this device), time
   format and first day of the week, persisted in accounts.preferences.display.
   Dates are always D/M/Y. The format helpers live in src/lib/display-prefs
   (formatDatePref / formatTimePref). */

import { useEffect, useMemo, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { DisplayPrefs, TimeFormatPref, WeekStartPref } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import {
  saveDisplayPreferencesLocally, formatDatePref, formatTimePref,
} from "@/lib/display-prefs";
import { SettingsCard, ControlRow, Segmented, SaveError } from "./ui";
import { usePrefSlice } from "./usePrefSlice";
import type { Lang } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

export default function RegionTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  /* Only the fields changed are sent; a failed save is put back and said
     (usePrefSlice). */
  const { value: d, patch, failed } = usePrefSlice<DisplayPrefs>(
    withDefaults(account.preferences).display as DisplayPrefs,
    (changed) => updateAccountPreferences(account.id, { display: changed as DisplayPrefs }).then((ok) => { if (ok) onChanged(); return ok; }),
    (merged) => saveDisplayPreferencesLocally(merged),
  );

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

  return (
    <div className="space-y-4">
      <SaveError show={failed} text={t("saveFailed")} />
      {/* Live preview. Every control on this screen appears here — the old
          one showed date/time/number only, so three of the seven settings
          had no visible effect at all while you were choosing them. */}
      <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
        <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider mb-2">{t("region.preview")}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] font-medium text-[var(--text-primary)]">
          <span>{formatDatePref(now, "dmy")}</span>
          <span className="text-[var(--text-faint)]">·</span>
          <span>{formatTimePref(now, d.time_format)}</span>
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
        <ControlRow label={t("region.timeFormat")} last>
          <Segmented<TimeFormatPref>
            value={d.time_format}
            onChange={(v) => patch({ time_format: v })}
            options={[{ value: "24h", label: "24h" }, { value: "12h", label: "12h" }]}
          />
        </ControlRow>
      </SettingsCard>

      {/* Number format, units and currency display lived here, and nothing in
          the Hub read them; the date-format picker offered M/D/Y and ISO
          while the Hub's rule is D/M/Y. Controls that change nothing are
          taken away rather than left to be trusted (Settings audit,
          29/09/2026). The stored values are kept, unused. */}
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
