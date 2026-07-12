"use client";

/* Settings → Display & Accessibility. Edits accounts.preferences.display
   (jsonb) and applies instantly to <html> — no Save button, iOS-style. */

import { useEffect, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { DisplayPrefs, TextSizePref, DensityPref } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import {
  applyDisplayPreferences, cacheDisplayPreferences, getTheme, setTheme,
  type ThemeMode,
} from "@/lib/display-prefs";
import { SettingsCard, ControlRow, Segmented, SwitchRow } from "./ui";

export default function DisplayTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [d, setD] = useState<DisplayPrefs>(() => withDefaults(account.preferences).display as DisplayPrefs);
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  /* Theme is the app's binary light/dark switch (localStorage). Read the
     current value on mount and keep in sync if the header toggle changes it. */
  useEffect(() => {
    setThemeState(getTheme());
    const onThemeChange = (e: Event) => {
      const t = (e as CustomEvent<ThemeMode>).detail;
      if (t === "light" || t === "dark") setThemeState(t);
    };
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  function pickTheme(t: ThemeMode) {
    setThemeState(t);
    setTheme(t);   // localStorage + data-theme + "themechange" event (header syncs)
  }

  /* Re-sync local state whenever the account refreshes (e.g. after another
     tab saved the shared `display` slice) so edits merge onto fresh values. */
  useEffect(() => {
    setD(withDefaults(account.preferences).display as DisplayPrefs);
  }, [account.preferences]);

  function patch(next: Partial<DisplayPrefs>) {
    const merged = { ...d, ...next };
    setD(merged);
    applyDisplayPreferences(merged);       // live, whole-app
    cacheDisplayPreferences(merged);
    // Persist ONLY the display slice; the server merges it onto the rest.
    void updateAccountPreferences(account.id, { display: merged }).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      <SettingsCard title="Display" subtitle="Changes apply across the hub instantly.">
        <ControlRow label="Theme" hint="Light or dark appearance.">
          <Segmented<ThemeMode>
            value={theme}
            onChange={pickTheme}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          />
        </ControlRow>
        <ControlRow label="Text size" hint="Scale interface text — layout stays put.">
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
        <ControlRow label="Density" hint="Comfortable spacing, or compact to fit more." last>
          <Segmented<DensityPref>
            value={d.density}
            onChange={(v) => patch({ density: v })}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </ControlRow>
      </SettingsCard>

      <SettingsCard title="Accessibility" subtitle="Make the hub easier to read and use.">
        <SwitchRow
          label="Bold text"
          hint="Heavier text weight for legibility."
          checked={d.bold_text}
          onChange={(v) => patch({ bold_text: v })}
        />
        <SwitchRow
          label="Underline links"
          hint="Always underline links, not just on hover."
          checked={d.underline_links}
          onChange={(v) => patch({ underline_links: v })}
        />
        <SwitchRow
          label="Always show focus ring"
          hint="Strong outline on the focused control (keyboard users)."
          checked={d.focus_ring}
          onChange={(v) => patch({ focus_ring: v })}
        />
        <SwitchRow
          label="Reduce motion"
          hint="Minimize animations and transitions."
          checked={d.reduce_motion}
          onChange={(v) => patch({ reduce_motion: v })}
        />
        <SwitchRow
          label="Increase contrast"
          hint="Stronger borders and clearer secondary text."
          checked={d.high_contrast}
          onChange={(v) => patch({ high_contrast: v })}
        />
        <SwitchRow
          label="Reduce transparency"
          hint="Turn off blur and translucency for legibility."
          checked={d.reduce_transparency}
          onChange={(v) => patch({ reduce_transparency: v })}
          last
        />
      </SettingsCard>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        Language is in Preferences. Date, time and number formats are in Language &amp; region.
      </p>
    </div>
  );
}
