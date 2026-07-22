"use client";

/* ---------------------------------------------------------------------------
   Settings → Sounds — full control over every sound the Hub makes.

   One engine (src/lib/notificationSound.ts) plays everything; this panel
   edits its preferences. Two categories exist today:
     · Notifications — inbox: task assignments, approvals, reminders
     · Messages      — Discuss chat messages
   Each has its own on/off switch and its own tone, on top of a master
   switch, Do Not Disturb and a global volume. Tones are synthesized with
   Web Audio (except Classic, the original WAV) — no downloads, identical
   offline and in mainland China. The ▶ button previews any tone at the
   current volume even while sounds are off, because previewing is how you
   pick the tone you're about to turn back on.

   Prefs are device-local (localStorage), like ringtones on a phone.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  SOUND_ACTIVITIES,
  SOUND_TONES,
  type SoundActivity,
  type SoundCategory,
  type SoundPrefs,
  type SoundTone,
  getSoundPrefs,
  previewSound,
  setSoundPrefs,
  subscribeSoundPrefs,
} from "@/lib/notificationSound";
import { SelectControl, SettingsCard, SwitchRow } from "@/components/settings/tabs/ui";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";

const TONE_LABELS: Record<Exclude<SoundTone, "none">, string> = {
  classic: "Classic",
  chime: "Chime",
  ding: "Ding",
  bell: "Bell",
  pop: "Pop",
  glass: "Glass",
  pulse: "Pulse",
};

/* Same labels as Settings → Notification preferences "By activity", so the
   two screens read as one system. */
const ACTIVITY_LABELS: Record<SoundActivity, string> = {
  mentions: "Mentions and replies",
  approvals: "Approvals",
  assignments: "Assignments",
  tasks_due: "Task reminders",
  quotation_activity: "Quotation activity",
  low_stock: "Low stock",
  qa_reports: "QA reports",
  price_fx: "Price and FX changes",
};

export default function SoundsTab() {
  const [prefs, setPrefs] = useState<SoundPrefs>(getSoundPrefs);
  useEffect(() => subscribeSoundPrefs(setPrefs), []);

  const muted = !prefs.master || prefs.dnd;

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Sound"
        subtitle="One switch for everything, plus volume. Changes apply instantly on this device."
      >
        <SwitchRow
          label="All sounds"
          hint="Master switch — off silences every sound in the Hub."
          checked={prefs.master}
          onChange={(on) => setSoundPrefs({ master: on })}
        />
        <SwitchRow
          label="Do not disturb"
          hint="Temporarily silence everything without touching your other settings."
          checked={prefs.dnd}
          onChange={(on) => setSoundPrefs({ dnd: on })}
        />
        {/* Volume — released slider previews at the new level so you hear
            what you chose without hunting for a test button. */}
        <div className="flex items-center gap-3 py-3">
          <Volume2Icon className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[var(--text-primary)]">Volume</div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(prefs.volume * 100)}
              onChange={(e) => setSoundPrefs({ volume: Number(e.target.value) / 100 })}
              onMouseUp={() => previewSound(prefs.notification.tone)}
              onTouchEnd={() => previewSound(prefs.notification.tone)}
              className="mt-1.5 w-full accent-[var(--bg-inverted)]"
            />
          </div>
          <span className="w-10 shrink-0 text-end text-[12px] tabular-nums text-[var(--text-muted)]">
            {Math.round(prefs.volume * 100)}%
          </span>
        </div>
      </SettingsCard>

      <CategoryCard
        title="Notifications"
        subtitle="Task assignments, approvals, reminders — the bell."
        category="notification"
        prefs={prefs}
        muted={muted}
      />
      <CategoryCard
        title="Messages"
        subtitle="Discuss chat messages. Muted conversations stay silent regardless."
        category="message"
        prefs={prefs}
        muted={muted}
      />

      <p className="px-1 text-[11.5px] text-[var(--text-dim)]">
        Tones are generated on this device — nothing to download, and they work
        offline. Sound settings are per-device, like a phone&apos;s ringtone.
      </p>
    </div>
  );
}

function CategoryCard({
  title,
  subtitle,
  category,
  prefs,
  muted,
}: {
  title: string;
  subtitle: string;
  category: SoundCategory;
  prefs: SoundPrefs;
  muted: boolean;
}) {
  const cat = prefs[category];
  return (
    <SettingsCard title={title} subtitle={subtitle}>
      <SwitchRow
        label={`${title} sound`}
        hint={muted ? "Currently silenced by the master switch / Do Not Disturb." : undefined}
        checked={cat.enabled}
        onChange={(on) => setSoundPrefs({ [category]: { enabled: on } } as Partial<SoundPrefs>)}
      />
      <div className="pt-2">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          Tone
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          {SOUND_TONES.map((tone, i) => (
            <div
              key={tone}
              className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? "border-t border-[var(--border-subtle)]" : ""} ${
                cat.tone === tone ? "bg-[var(--bg-surface)]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setSoundPrefs({ [category]: { tone } } as Partial<SoundPrefs>)}
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
              >
                {/* Radio dot */}
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                    cat.tone === tone
                      ? "border-[var(--text-primary)]"
                      : "border-[var(--border-color)]"
                  }`}
                >
                  {cat.tone === tone && (
                    <span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />
                  )}
                </span>
                <span className={`text-[13px] ${cat.tone === tone ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                  {TONE_LABELS[tone]}
                </span>
                {tone === "classic" && (
                  <span className="text-[10.5px] text-[var(--text-dim)]">default</span>
                )}
              </button>
              {/* Preview — deliberately works even while sounds are off. */}
              <button
                type="button"
                onClick={() => previewSound(tone)}
                title="Preview"
                aria-label={`Preview ${TONE_LABELS[tone]}`}
                className="shrink-0 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Per-activity overrides — notifications only. Each activity from
          Notification preferences can carry its OWN tone, so an approval is
          audibly different from a task reminder. "Default" inherits the tone
          selected above. */}
      {category === "notification" && (
        <div className="pt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Per-activity tones
          </div>
          <p className="mb-2 text-[11px] text-[var(--text-dim)]">
            Give any activity its own sound. &ldquo;Default&rdquo; uses the tone selected above.
          </p>
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            {SOUND_ACTIVITIES.map((act, i) => {
              const override = prefs.notification.activityTones?.[act];
              const effective = override ?? prefs.notification.tone;
              return (
                <div
                  key={act}
                  className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? "border-t border-[var(--border-subtle)]" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">
                    {ACTIVITY_LABELS[act]}
                  </span>
                  <SelectControl<string>
                    value={override ?? "default"}
                    onChange={(v) =>
                      setSoundPrefs({
                        notification: {
                          activityTones: { [act]: v === "default" ? undefined : (v as SoundTone) },
                        },
                      })
                    }
                    options={[
                      { value: "default", label: "Default" },
                      ...SOUND_TONES.map((t) => ({ value: t as string, label: TONE_LABELS[t] })),
                      { value: "none", label: "Silent" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => previewSound(effective)}
                    title="Preview"
                    aria-label={`Preview ${ACTIVITY_LABELS[act]} sound`}
                    className="shrink-0 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                  >
                    ▶
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
