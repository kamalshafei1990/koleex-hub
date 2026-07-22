"use client";

/* Settings → Display & Accessibility. Edits accounts.preferences.display
   (jsonb) and applies instantly to <html> — no Save button, iOS-style. */

import { useEffect, useRef, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { DisplayPrefs, TextSizePref, DensityPref } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import {
  applyDisplayPreferences, saveDisplayPreferencesLocally, getThemePreference, setTheme,
  TEXT_SCALE, type ThemePreference,
} from "@/lib/display-prefs";
import { SettingsCard, ControlRow, Segmented, SwitchRow } from "./ui";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

/* The shipped defaults for everything this screen edits. Region formats are
   deliberately absent — those belong to Language & region. */
const DEFAULT_DISPLAY: Partial<DisplayPrefs> = {
  text_size: "default",
  density: "comfortable",
  bold_text: false,
  underline_links: false,
  focus_ring: false,
  reduce_motion: false,
  high_contrast: false,
  reduce_transparency: false,
};

export default function DisplayTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [d, setD] = useState<DisplayPrefs>(() => withDefaults(account.preferences).display as DisplayPrefs);
  /* What we last wrote. The account refresh below can arrive carrying the
     PRE-save snapshot (shared identity cache), which would visibly revert the
     user's choice a second after they made it — so ignore incoming snapshots
     until they catch up with our own write. */
  const savedRef = useRef<string | null>(null);

  const { t } = useTranslation(settingsT);
  const [theme, setThemeState] = useState<ThemePreference>("dark");

  /* Theme is the app's binary light/dark switch (localStorage). Read the
     current value on mount and keep in sync if the header toggle changes it. */
  useEffect(() => {
    setThemeState(getThemePreference());
    /* Listen for the MODE, not the resolved theme: while "Auto" is active the
       resolved value flips with the OS, and reacting to that would silently
       move the selection off Auto. */
    const onModeChange = (e: Event) => {
      const t = (e as CustomEvent<ThemePreference>).detail;
      if (t === "light" || t === "dark" || t === "system") setThemeState(t);
    };
    window.addEventListener("thememodechange", onModeChange);
    return () => window.removeEventListener("thememodechange", onModeChange);
  }, []);

  function pickTheme(t: ThemePreference) {
    setThemeState(t);
    setTheme(t);   // resolves + data-theme + "themechange" (header syncs)
  }

  /* Re-sync local state whenever the account refreshes (e.g. after another
     tab saved the shared `display` slice) so edits merge onto fresh values. */
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
    applyDisplayPreferences(merged);       // live, whole-app
    saveDisplayPreferencesLocally(merged);
    // Persist ONLY the display slice; the server merges it onto the rest.
    void updateAccountPreferences(account.id, { display: merged }).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      <SettingsCard title={t("display.title")} subtitle={t("display.sub")}>
        <ControlRow label={t("display.theme")} hint={theme === "system" ? t("display.theme.autoHint") : t("display.theme.hint")}>
          <Segmented<ThemePreference>
            value={theme}
            onChange={pickTheme}
            options={[
              { value: "light", label: t("display.light") },
              { value: "dark", label: t("display.dark") },
              { value: "system", label: t("display.auto") },
            ]}
          />
        </ControlRow>
        <ControlRow label={t("display.textSize")} hint={t("display.textSize.hint")}>
          <Segmented<TextSizePref>
            value={d.text_size}
            onChange={(v) => patch({ text_size: v })}
            options={[
              { value: "small", label: "S" },
              { value: "default", label: "M" },
              { value: "large", label: "L" },
              { value: "xlarge", label: "XL" },
            ]}
          />
        </ControlRow>
        {/* A sample line at the chosen scale — otherwise the only feedback for
            S/M/L/XL is the whole page shifting, which is hard to judge. */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--border-faint)]">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">{t("display.sample")}</p>
          <p
            className="min-w-0 truncate text-[var(--text-muted)]"
            style={{ fontSize: `${13 * (TEXT_SCALE[d.text_size] ?? 1)}px` }}
          >
            {t("display.sample.text")}
          </p>
        </div>
        <ControlRow label={t("display.density")} hint={t("display.density.hint")} last>
          <Segmented<DensityPref>
            value={d.density}
            onChange={(v) => patch({ density: v })}
            options={[
              { value: "comfortable", label: t("display.comfortable") },
              { value: "compact", label: t("display.compact") },
            ]}
          />
        </ControlRow>
      </SettingsCard>

      <SettingsCard title={t("display.a11y")} subtitle={t("display.a11y.sub")}>
        <SwitchRow
          label={t("display.bold")}
          hint={t("display.bold.hint")}
          checked={d.bold_text}
          onChange={(v) => patch({ bold_text: v })}
        />
        <SwitchRow
          label={t("display.underline")}
          hint={t("display.underline.hint")}
          checked={d.underline_links}
          onChange={(v) => patch({ underline_links: v })}
        />
        <SwitchRow
          label={t("display.focus")}
          hint={t("display.focus.hint")}
          checked={d.focus_ring}
          onChange={(v) => patch({ focus_ring: v })}
        />
        <SwitchRow
          label={t("display.motion")}
          hint={t("display.motion.hint")}
          checked={d.reduce_motion}
          onChange={(v) => patch({ reduce_motion: v })}
        />
        <SwitchRow
          label={t("display.contrast")}
          hint={t("display.contrast.hint")}
          checked={d.high_contrast}
          onChange={(v) => patch({ high_contrast: v })}
        />
        <SwitchRow
          label={t("display.transparency")}
          hint={t("display.transparency.hint")}
          checked={d.reduce_transparency}
          onChange={(v) => patch({ reduce_transparency: v })}
          last
        />
      </SettingsCard>

      {/* Six toggles and three scales make it easy to end up somewhere
          uncomfortable with no way back — one button restores the shipped
          defaults without touching anything outside this screen. */}
      <div className="flex items-center justify-between gap-4 px-1">
        <p className="text-[11px] text-[var(--text-faint)]">{t("display.footer")}</p>
        <button
          type="button"
          onClick={() => patch(DEFAULT_DISPLAY)}
          className="shrink-0 h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          {t("display.reset")}
        </button>
      </div>
    </div>
  );
}
