"use client";

/* Settings → Language & region. Date / time / number / units / currency
   format, persisted in accounts.preferences.display and consumed by
   src/lib/format-prefs helpers (formatDatePref, formatNumberPref, …). */

import { useMemo, useState } from "react";
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

export default function RegionTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [d, setD] = useState<DisplayPrefs>(() => withDefaults(account.preferences).display as DisplayPrefs);
  const now = useMemo(() => new Date(), []);

  function patch(next: Partial<DisplayPrefs>) {
    const merged = { ...d, ...next };
    setD(merged);
    cacheDisplayPreferences(merged);
    const prefs = { ...withDefaults(account.preferences), display: merged };
    void updateAccountPreferences(account.id, prefs).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      {/* Live preview so the effect is visible even before other apps adopt it. */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
        <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider mb-1">Preview</p>
        <p className="text-[14px] font-medium text-[var(--text-primary)]">
          {formatDatePref(now, d.date_format)} · {formatTimePref(now, d.time_format)} · {formatNumberPref(1234.5, d.number_format)}
        </p>
      </div>

      <SettingsCard title="Date & time">
        <ControlRow label="Date format">
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
        <ControlRow label="Time format" last>
          <Segmented<TimeFormatPref>
            value={d.time_format}
            onChange={(v) => patch({ time_format: v })}
            options={[{ value: "24h", label: "24h" }, { value: "12h", label: "12h" }]}
          />
        </ControlRow>
      </SettingsCard>

      <SettingsCard title="Numbers & units">
        <ControlRow label="Number format" hint="Thousands and decimal separators.">
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
        <ControlRow label="Units" hint="Dimensions and weights.">
          <Segmented<UnitsPref>
            value={d.units}
            onChange={(v) => patch({ units: v })}
            options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]}
          />
        </ControlRow>
        <ControlRow label="Currency display" last>
          <Segmented<CurrencyDisplayPref>
            value={d.currency_display}
            onChange={(v) => patch({ currency_display: v })}
            options={[{ value: "symbol", label: "$" }, { value: "code", label: "USD" }]}
          />
        </ControlRow>
      </SettingsCard>

      <SettingsCard title="Calendar">
        <ControlRow label="First day of week" last>
          <Segmented<WeekStartPref>
            value={d.week_start}
            onChange={(v) => patch({ week_start: v })}
            options={[{ value: 0, label: "Sun" }, { value: 1, label: "Mon" }, { value: 6, label: "Sat" }]}
          />
        </ControlRow>
      </SettingsCard>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        Formats apply where the hub displays dates and numbers. Interface language is in Preferences.
      </p>
    </div>
  );
}
