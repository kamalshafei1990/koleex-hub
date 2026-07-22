"use client";

/* ---------------------------------------------------------------------------
   Settings → Sounds — full control over every sound the Hub makes.

   Layout follows iOS Sounds & Haptics, which is the pattern people already
   know: the main screen is a list of grouped ROWS showing each alert and its
   CURRENT tone ("Approvals … Bell ›"); tapping a row opens a picker screen
   listing the tones with a checkmark on the selected one. Tapping a tone in
   that list selects AND plays it, exactly like choosing a text tone on a
   phone — you never hunt for a separate preview button.

   One engine (src/lib/notificationSound.ts) plays everything; this panel only
   edits its preferences. Tones are synthesized with Web Audio (except
   Classic, the original WAV) — no downloads, identical offline and in
   mainland China. Prefs are device-local (localStorage), like a phone's
   ringtone.
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
import { SettingsCard, SwitchRow } from "@/components/settings/tabs/ui";
import VlIcon from "@/components/ui/VlIcon";
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

const CATEGORY_LABELS: Record<SoundCategory, string> = {
  notification: "Notifications",
  message: "Messages",
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

/** What the picker screen is currently editing. */
type PickerTarget =
  | { kind: "category"; category: SoundCategory }
  | { kind: "activity"; activity: SoundActivity };

export default function SoundsTab() {
  const [prefs, setPrefs] = useState<SoundPrefs>(getSoundPrefs);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  useEffect(() => subscribeSoundPrefs(setPrefs), []);

  /* Picker replaces the pane, iOS-push style — one thing on screen at a
     time, and the back chevron returns to the list. */
  if (picker) {
    return <TonePicker target={picker} prefs={prefs} onBack={() => setPicker(null)} />;
  }

  const muted = !prefs.master || prefs.dnd;

  return (
    <div className="space-y-4">
      <SettingsCard
        flush
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
        {/* Volume — releasing the slider previews at the new level so you
            hear what you chose without hunting for a test button. */}
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
              /* Painted by hand rather than with accent-color, which colours
                 the track AND the thumb the same colour. Blue fill + WHITE
                 thumb, per the owner's call — the green rule is for TOGGLES
                 (on/off state); a slider is a value control, so it carries
                 the brand's accent blue instead. */
              style={{
                background: `linear-gradient(to right, var(--kx-slider-fill) 0 ${Math.round(prefs.volume * 100)}%, var(--kx-slider-rest) ${Math.round(prefs.volume * 100)}% 100%)`,
              }}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full [--kx-slider-fill:var(--accent-blue,#0066FF)] [--kx-slider-rest:var(--border-color,#6b7280)]
                [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow
                [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow"
            />
          </div>
          <span className="w-10 shrink-0 text-end text-[12px] tabular-nums text-[var(--text-muted)]">
            {Math.round(prefs.volume * 100)}%
          </span>
        </div>
      </SettingsCard>

      {/* ── Alerts and sounds ─────────────────────────────────────────────
          The two top-level channels, each with its own on/off and its own
          tone row. Mirrors iOS's "Alerts and System Sounds" block. */}
      <SettingsCard
        flush
        title="Alerts and sounds"
        subtitle={muted ? "Currently silenced by the master switch / Do Not Disturb." : "Pick a different sound for each kind of alert."}
      >
        <SwitchRow
          label="Notification sounds"
          hint="Task assignments, approvals, reminders — the bell."
          checked={prefs.notification.enabled}
          onChange={(on) => setSoundPrefs({ notification: { enabled: on } })}
        />
        <NavRow
          label="Notification tone"
          value={TONE_LABELS[prefs.notification.tone as Exclude<SoundTone, "none">] ?? "Silent"}
          onClick={() => setPicker({ kind: "category", category: "notification" })}
        />
        <SwitchRow
          label="Message sounds"
          hint="Discuss chat messages. Muted conversations stay silent regardless."
          checked={prefs.message.enabled}
          onChange={(on) => setSoundPrefs({ message: { enabled: on } })}
        />
        <NavRow
          label="Message tone"
          value={TONE_LABELS[prefs.message.tone as Exclude<SoundTone, "none">] ?? "Silent"}
          onClick={() => setPicker({ kind: "category", category: "message" })}
          last
        />
      </SettingsCard>

      {/* ── Per-activity tones ────────────────────────────────────────────
          Exactly the activities from Notification preferences, each able to
          carry its own sound so an approval is audibly different from a task
          reminder. "Default" inherits the notification tone above. */}
      <SettingsCard
        flush
        title="By activity"
        subtitle="Give any activity its own sound. Default uses the notification tone."
      >
        {SOUND_ACTIVITIES.map((act, i) => {
          const override = prefs.notification.activityTones?.[act];
          return (
            <NavRow
              key={act}
              label={ACTIVITY_LABELS[act]}
              value={
                override === undefined
                  ? "Default"
                  : override === "none"
                    ? "Silent"
                    : TONE_LABELS[override]
              }
              onClick={() => setPicker({ kind: "activity", activity: act })}
              last={i === SOUND_ACTIVITIES.length - 1}
            />
          );
        })}
      </SettingsCard>

      <p className="px-1 text-[11.5px] text-[var(--text-dim)]">
        Tones are generated on this device — nothing to download, and they work
        offline. Sound settings are per-device, like a phone&apos;s ringtone.
      </p>
    </div>
  );
}

/* ── A tappable row: label left, current value + chevron right ──────────── */
function NavRow({
  label,
  value,
  onClick,
  last,
}: {
  label: string;
  value: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      /* rounded-lg: the highlight has to be a SHAPE, not a full-bleed
         band with square corners sitting inside a 16px-rounded card. */
      className={`flex w-full items-center justify-between gap-4 rounded-lg px-2 py-3 text-start transition-colors hover:bg-[var(--bg-surface-hover)] ${
        last ? "" : "border-b border-[var(--border-faint)]"
      }`}
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[13px] text-[var(--text-muted)]">{value}</span>
        {/* -90° turns the down-chevron into the standard "drills in" arrow —
            one Visual Library asset instead of a second near-identical one. */}
        <VlIcon slug="angle-small-down" size={14} className="-rotate-90 text-[var(--text-dim)]" />
      </span>
    </button>
  );
}

/* ── Tone picker screen ─────────────────────────────────────────────────── */
function TonePicker({
  target,
  prefs,
  onBack,
}: {
  target: PickerTarget;
  prefs: SoundPrefs;
  onBack: () => void;
}) {
  const isActivity = target.kind === "activity";
  const title = isActivity
    ? ACTIVITY_LABELS[target.activity]
    : `${CATEGORY_LABELS[target.category]} tone`;

  /* Current selection. For an activity, `undefined` means "inherit the
     notification tone" and is shown as its own row rather than as a tone. */
  const current: SoundTone | undefined = isActivity
    ? prefs.notification.activityTones?.[target.activity]
    : prefs[target.category].tone;

  /* Select AND play, the way a phone does it — hearing the tone is the whole
     point of opening this screen. The engine's own gates are bypassed for
     the preview so you can audition while sounds are off. */
  const choose = (tone: SoundTone | undefined) => {
    if (isActivity) {
      setSoundPrefs({ notification: { activityTones: { [target.activity]: tone } } });
      previewSound(tone ?? prefs.notification.tone);
    } else {
      setSoundPrefs({ [target.category]: { tone: tone ?? "classic" } } as Partial<SoundPrefs>);
      previewSound(tone ?? "classic");
    }
  };

  return (
    <div className="space-y-4">
      {/* Picker header — back chevron + what we're choosing for. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Sounds"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
        >
          <VlIcon slug="angle-small-down" size={16} className="rotate-90" />
        </button>
        <h2 className="min-w-0 truncate text-[15px] font-bold text-[var(--text-primary)]">{title}</h2>
      </div>

      {/* Group 1 — the non-tone choices, set apart the way iOS separates
          "None" from the tone list. */}
      {/* Untitled group, the way iOS sets "None" apart from the tone
          list without giving it a heading. */}
      <SettingsCard flush>
        {isActivity && (
          <ToneRow
            label="Default"
            hint={`Same as the notification tone (${TONE_LABELS[prefs.notification.tone as Exclude<SoundTone, "none">] ?? "Silent"})`}
            selected={current === undefined}
            onClick={() => choose(undefined)}
          />
        )}
        <ToneRow
          label="Silent"
          hint={isActivity ? "No sound for this activity." : "No sound for this channel."}
          selected={current === "none"}
          onClick={() => choose("none")}
          last
        />
      </SettingsCard>

      {/* Group 2 — the tones. Tapping plays. */}
      <SettingsCard flush title="Alert tones" subtitle="Tap a tone to hear it and select it.">
        {SOUND_TONES.map((tone, i) => (
          <ToneRow
            key={tone}
            label={TONE_LABELS[tone]}
            selected={current === tone}
            onClick={() => choose(tone)}
            last={i === SOUND_TONES.length - 1}
          />
        ))}
      </SettingsCard>
    </div>
  );
}

function ToneRow({
  label,
  hint,
  selected,
  onClick,
  last,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-[var(--bg-surface-hover)] ${
        last ? "" : "border-b border-[var(--border-faint)]"
      }`}
    >
      <span className="min-w-0">
        <span className={`block truncate text-[13px] ${selected ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] text-[var(--text-dim)]">{hint}</span>}
      </span>
      {/* Checkmark marks the selection, iOS-style — no radio dots, no extra
          preview button, because the row itself plays the tone.
          h-5 + flex, NOT a text-centred inline box: an inline icon sits on
          the text baseline and its line box made the selected row 4px taller
          than every other row in the list. */}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {selected && <VlIcon slug="check" size={14} className="text-[var(--text-primary)]" />}
      </span>
    </button>
  );
}
