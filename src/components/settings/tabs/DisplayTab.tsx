"use client";

/* Settings → Display & Accessibility. Edits accounts.preferences.display
   (jsonb) and applies instantly to <html> — no Save button, iOS-style. */

import { useEffect, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { DisplayPrefs, TextSizePref } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import { applyDisplayPreferences, cacheDisplayPreferences } from "@/lib/display-prefs";
import { SettingsCard, ControlRow, Segmented, SwitchRow } from "./ui";

export default function DisplayTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [d, setD] = useState<DisplayPrefs>(() => withDefaults(account.preferences).display as DisplayPrefs);

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
        <ControlRow label="Text size" hint="Scale interface text for comfort." last>
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
      </SettingsCard>

      <SettingsCard title="Accessibility" subtitle="Make the hub easier to read and use.">
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
        Theme and language are in Preferences.
      </p>
    </div>
  );
}
