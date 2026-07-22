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
   edits its preferences. Two tone groups: the Koleex library (real
   recordings in /public/sounds, trimmed and loudness-matched, fetched only
   when chosen) and the basic tones (synthesized with Web Audio — no
   download at all, so they still work offline). Prefs are device-local
   (localStorage), like a phone's ringtone.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  LIBRARY_LABELS,
  SOUND_ACTIVITIES,
  SOUND_LIBRARY,
  SOUND_TONES,
  type LibraryTone,
  type SoundActivity,
  type SoundCategory,
  type SoundPrefs,
  type SoundTone,
  type SynthTone,
  getSoundPrefs,
  previewSound,
  setSoundPrefs,
  subscribeSoundPrefs,
} from "@/lib/notificationSound";
import { SettingsCard, SwitchRow } from "@/components/settings/tabs/ui";
import VlIcon from "@/components/ui/VlIcon";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import { KX_RANGE_CLASS, kxRangeStyle } from "@/components/ui/rangeSlider";

const TONE_LABELS: Record<"classic" | SynthTone, string> = {
  classic: "Classic",
  chime: "Chime",
  ding: "Ding",
  bell: "Bell",
  pop: "Pop",
  glass: "Glass",
  pulse: "Pulse",
};

/** Display name for ANY tone — built-in, library, or silent. One helper so
 *  the summary rows and the picker can never disagree about a name. */
function toneLabel(tone: SoundTone | undefined): string {
  if (tone === undefined) return "Default";
  if (tone === "none") return "Silent";
  return (
    LIBRARY_LABELS[tone as LibraryTone] ??
    TONE_LABELS[tone as "classic" | SynthTone] ??
    "Silent"
  );
}

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
              style={kxRangeStyle(prefs.volume * 100)}
              className={`mt-2 ${KX_RANGE_CLASS}`}
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
          value={toneLabel(prefs.notification.tone)}
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
          value={toneLabel(prefs.message.tone)}
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
              value={toneLabel(override)}
              onClick={() => setPicker({ kind: "activity", activity: act })}
              last={i === SOUND_ACTIVITIES.length - 1}
            />
          );
        })}
      </SettingsCard>

      <p className="px-1 text-[11.5px] text-[var(--text-dim)]">
        Koleex tones are real recordings, loudness-matched so none is louder
        than another; only the tone you pick is downloaded. Basic tones are
        generated on this device and always work offline. Sound settings are
        per-device, like a phone&apos;s ringtone.
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
            hint={`Same as the notification tone (${toneLabel(prefs.notification.tone)})`}
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

      {/* Group 2 — the real recordings. First, because these are the ones
          people actually want; the synthesized set is the fallback. */}
      <SettingsCard flush title="Koleex tones" subtitle="Tap a tone to hear it and select it.">
        {SOUND_LIBRARY.map((tone, i) => (
          <ToneRow
            key={tone}
            label={LIBRARY_LABELS[tone as LibraryTone]}
            selected={current === tone}
            onClick={() => choose(tone)}
            last={i === SOUND_LIBRARY.length - 1}
          />
        ))}
      </SettingsCard>

      {/* Group 3 — the built-ins. Kept because they need no network at all,
          which matters on a bad connection or offline. */}
      <SettingsCard flush title="Basic tones" subtitle="Generated on this device — no download, works offline.">
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
