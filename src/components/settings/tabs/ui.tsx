"use client";

/* Shared iOS-style building blocks for the Settings detail tabs. Monochrome
   per brand; the accent (blue) only marks the selected segment / on-toggle.
   Dual-skin: Aurora selection = kx-seg-on (Hub-Blue ring + 10% fill), Core
   keeps the original inverted pill. */

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import KdsSelect from "@/components/kds/Select";
import { useSkin } from "@/lib/appearance";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/** The ONE disclosure chevron for the Settings app — the master list, the
 *  admin link rows and the push link all draw this, so they can never drift
 *  apart (they used to mix this glyph with a literal "›" character).
 *
 *  Direction is baked in, because a chevron is a DIRECTION, not decoration:
 *  the default points the way the reader is going and mirrors itself under
 *  RTL (it used to keep pointing right in Arabic, away from the row it
 *  opens); `back` is the return arrow and mirrors the other way. */
export function Chevron({ className = "", back = false }: { className?: string; back?: boolean }) {
  const facing = back ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180";
  return (
    <svg className={`${facing} ${className}`} width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Renders at the end of <body>. A settings card is frosted glass
 *  (backdrop-filter), and a `fixed` dialog inside one is positioned against
 *  the card, not the screen — so confirmations go through here. Tabs mount
 *  on the client only, so `document` is always there. */
export function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/** A save that did not reach the server — the control has already been put
 *  back to what is stored; this says why it moved. */
export function SaveError({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return (
    <p role="alert" className="rounded-xl border border-[#FF3333]/30 bg-[#FF3333]/[0.06] px-3 py-2 text-[12.5px] text-[#FF6B6B]">
      {text}
    </p>
  );
}

export function SettingsCard({ title, subtitle, children, flush }: {
  title?: string; subtitle?: string; children: ReactNode; flush?: boolean;
}) {
  return (
    /* kx-glass: detail cards are LEAF tiles — nothing inside a settings tab
       renders a fixed-without-portal child, so they can carry true frost
       (a translucent panel with no blur would show the moving ground
       straight through the text). Core: the solid card is untouched. */
    <section className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      {title && <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{title}</h2>}
      {subtitle && <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && title && <div className="mb-4" />}
      {/* `flush` = list semantics: rows sit edge-to-edge so each row's
          bottom border IS the divider to the next one. The default 4px
          space-y detaches that line from the following row, which reads as
          a floating hairline once rows also have a hover highlight. */}
      <div className={flush ? "" : "space-y-1"}>{children}</div>
    </section>
  );
}

/** The value a row reports at its inline end — ONE definition, used by both
 *  the settings rows here and the master-list rows in app/settings/page.tsx.
 *
 *  Those two are NOT the same component and should not be merged: one is a
 *  setting (chevron only when there is somewhere to go), the other a
 *  navigation item (always navigates, carries a selected state). Forcing them
 *  together needs an `active` flag and a `compact` flag, which is two
 *  components wearing one name.
 *
 *  But the VALUE has to look identical in both, and within a day of shipping
 *  it already did not: 12.5px + tabular-nums here, 12px + truncate + a 40% cap
 *  there. Same idea, two sizes. So the thing that must match is the thing that
 *  is shared, and the parts that legitimately differ stay apart.
 *
 *  Returns null rather than an em dash. A dash is a value meaning "empty",
 *  which is a different statement from having no state to report. */
export function RowValue({ value }: { value?: ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <span className="shrink-0 max-w-[45%] truncate text-[12px] text-[var(--text-dim)] tabular-nums">
      {value}
    </span>
  );
}

/** THE READING ROW: a label, its current value, and a chevron ONLY if there
 *  is somewhere to go.
 *
 *  This is the piece the Settings app did not have. `ControlRow` hosts a
 *  control; nothing here reported a value and then got out of the way, so the
 *  only way to learn a setting's state was to open it. Owner's reference is
 *  iOS Settings, where every row carries its answer on the right — WLAN "Not
 *  Connected", iCloud "50 GB", Birthday "July 20, 1990" — and a whole screen
 *  can be read without entering anything.
 *
 *  THE CHEVRON IS THE AFFORDANCE, AND IT IS ENFORCED HERE RATHER THAN LEFT TO
 *  DISCIPLINE. Pass a handler and the row becomes a button with a chevron;
 *  pass none and it renders as plain text with no chevron and no hover. That
 *  is the same contract iOS's About screen uses — Model Number and Serial have
 *  no chevron because they are facts, not doors — and it is the reason a
 *  reader never taps something that cannot be tapped.
 *
 *  NO PLACEHOLDER FOR A MISSING VALUE. A row with nothing to report shows
 *  nothing; an em dash would be a value that says "empty", which is different
 *  from having no state at all. Use `value="Set Up"` for the third case the
 *  reference names: configured, unconfigured, and not-yet-set-up are three
 *  states, not two. */
export function SettingsRow({
  label, hint, value, icon, onClick, href, destructive, last,
}: {
  label: string;
  hint?: string;
  /** Current state, shown at the inline end. Omit when the row has none. */
  value?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Sign out, delete, reset — red label, and by convention alone in its own group. */
  destructive?: boolean;
  last?: boolean;
}) {
  /* A CHEVRON MEANS "THERE IS MORE BEHIND THIS", SO AN ACTION MUST NOT HAVE
     ONE. Destructive rows are interactive but they do not disclose — Sign Out
     does not take you anywhere, it does something — so they drop the chevron
     and centre their label, the way the reference draws them. Caught on the
     probe: the first version tied the chevron to "has a handler" alone and
     put an arrow on Sign Out, promising a screen that does not exist. */
  const isAction = !!destructive;
  const interactive = !!(onClick || href);
  const body = (
    <>
      {icon && (
        <span className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
          {icon}
        </span>
      )}
      <span className={`min-w-0 flex-1 ${isAction ? "text-center" : "text-start"}`}>
        <span className={`block text-[13px] font-medium ${isAction ? "text-[#FF3333]" : "text-[var(--text-primary)]"}`}>
          {label}
        </span>
        {hint && <span className="block text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</span>}
      </span>
      <RowValue value={value} />
      {interactive && !isAction && <Chevron className="shrink-0 text-[var(--text-ghost)]" />}
    </>
  );
  /* gap-3 not gap-4: the chevron needs to sit close to the value it belongs
     to, or the two read as separate columns. */
  const cls = `w-full flex items-center gap-3 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`;
  if (href) return <a href={href} className={cls}>{body}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** A card with the label ABOVE it and the explanation BELOW it.
 *
 *  `SettingsCard` puts its title inside the card, which is right for a titled
 *  panel and wrong for a list group: in the reference the small uppercase
 *  label sits outside, so the card itself contains nothing but rows, and the
 *  sentence that explains the group sits under it in muted text — right where
 *  the reader looks after touching the control, instead of in a tooltip.
 *
 *  Both are optional. Most groups in the reference carry NEITHER: the gap
 *  between cards does the grouping, and a header is spent only where the
 *  grouping itself is information (iOS uses none through most of General, and
 *  names every group in Accessibility, where "Vision / Hearing / Speech" IS
 *  the point). Do not add a header just because a group exists. */
export function SettingsGroup({ header, footer, children, flush = true }: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  /** Rows edge-to-edge, each row's bottom border acting as the divider. */
  flush?: boolean;
}) {
  return (
    <div>
      {header && (
        <h3 className="mb-2 ps-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">
          {header}
        </h3>
      )}
      {/* Same material as SettingsCard — kx-glass is Aurora-scoped, so Core
          renders the flat card it always had. px only: a flush list needs its
          rows to reach the card's edges, and their own py does the spacing. */}
      <section className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] px-5 md:px-6">
        <div className={flush ? "" : "space-y-1 py-2"}>{children}</div>
      </section>
      {footer && (
        <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-[var(--text-dim)]">{footer}</p>
      )}
    </div>
  );
}

/** A miniature of the Hub rendered in a GIVEN skin + theme, so a choice can
 *  be seen before it is made.
 *
 *  Style and theme were two rows of word-buttons — "Aurora / Core",
 *  "Light / Dark / Auto" — which asks the reader to pick a look from its name.
 *  The reference does not: Light and Dark are two little screens with a radio
 *  under each, and the answer is visible before the tap. We have four
 *  combinations and none of them were visible until applied.
 *
 *  IT IS TOKEN-DRIVEN, NOT PAINTED. This works because `[data-theme="light"]`
 *  and `[data-theme="dark"]` are plain attribute selectors in globals.css, not
 *  `:root`-bound — verified live before building on it: a nested div carrying
 *  the attribute reports --bg-primary #fff while the page around it reports
 *  #0a0a0a. So the preview redeclares the real tokens for its own subtree and
 *  cannot drift from the thing it is previewing. Hand-picked hexes would have
 *  been a second source of truth that silently goes stale.
 *
 *  THE AURORA GROUND IS A STILL. The real one is a canvas, and four canvases
 *  on a settings screen is a cost the canon already refuses for blur, let
 *  alone animation. The gradient stands in for the wave; everything else —
 *  fills, text, border, the glass card — is the genuine token. */
export function AppearancePreview({ skin, theme, label, selected, onSelect }: {
  skin: "aurora" | "core";
  theme: "light" | "dark";
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-col items-center gap-2 group"
    >
      <span
        data-kx-skin={skin}
        data-theme={theme}
        aria-hidden
        className={`block w-[84px] h-[112px] rounded-xl overflow-hidden border-2 transition-colors ${
          selected ? "border-[#567FB2]" : "border-[var(--border-subtle)] group-hover:border-[var(--border-color)]"
        }`}
      >
        <span className="relative block h-full w-full bg-[var(--bg-primary)]">
          {skin === "aurora" && (
            <span
              className="absolute inset-0 block"
              style={{
                background:
                  theme === "dark"
                    ? "radial-gradient(120% 80% at 30% 15%, #1d2a3d 0%, #0b0f16 60%)"
                    : "radial-gradient(120% 80% at 30% 15%, #dbe7f5 0%, #f4f7fb 60%)",
              }}
            />
          )}
          {/* header strip */}
          <span className="absolute inset-x-0 top-0 h-4 block bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]" />
          {/* a card with two lines of "content" */}
          <span className="absolute inset-x-2 top-6 block rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1.5">
            <span className="block h-1 w-3/4 rounded-full bg-[var(--text-primary)] opacity-80" />
            <span className="mt-1 block h-1 w-1/2 rounded-full bg-[var(--text-primary)] opacity-35" />
          </span>
          {/* the one accent, so the preview shows where colour lands */}
          <span className="absolute start-2 bottom-2 block h-2.5 w-8 rounded-full bg-[#567FB2]" />
        </span>
      </span>
      <span className={`text-[11.5px] ${selected ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-dim)]"}`}>
        {label}
      </span>
    </button>
  );
}

/** A labeled row that hosts a control on the right (segmented / select). */
export function ControlRow({ label, hint, children, last }: {
  label: string; hint?: string; children: ReactNode; last?: boolean;
}) {
  return (
    /* On a phone the control goes UNDER its label: beside it, a three-way
       choice squeezed the label to ~100 px (less in Arabic). From sm up the
       row is side by side as before. */
    <div className={`flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0 max-sm:overflow-x-auto max-sm:no-scrollbar">{children}</div>
    </div>
  );
}

/** iOS-style segmented control. The shell is PADDED (p-0.5) so the Aurora
 *  seg-on ring renders free of the container edge — a ring inside an
 *  overflow-hidden joined pair clips at the corners (burned on the PD view
 *  toggle; this shell was never joined, so both skins share the markup). */
export function Segmented<T extends string | number>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const aurora = useSkin() === "aurora";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            /* 36 px tall and at least 44 wide: h-7 was under the size a
               finger can hit reliably. */
            className={`px-3 h-9 min-w-11 rounded-md text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2]/60 ${
              active
                ? aurora
                  ? "kx-seg-on text-[var(--text-primary)]"
                  : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** iOS-style on/off switch row. ON = emerald green with a white knob — the
 *  ONE toggle design for the whole system (standing rule): green track when
 *  on, neutral track when off, white circle always. */
export function SwitchRow({ label, hint, checked, onChange, last, icon, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean;
  /** Optional leading glyph (Semantic Icon Registry). */
  icon?: React.ReactNode;
  /** Shown but not flippable (e.g. decided elsewhere, or saving). */
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      {icon && (
        <span className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        /* The track stays 24 px; the ::before layer grows the hit area to
           44 px so a thumb does not miss it. */
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2]/60 before:absolute before:-inset-2.5 before:content-[''] ${
          checked ? "bg-emerald-500" : "bg-[var(--border-color,#6b7280)]"
        }`}
      >
        {/* Logical, not physical: left-0.5 + translate-x-5 ran the knob the
            WRONG WAY in Arabic (off parked at the inline-end). inset-inline
            keeps "off = start, on = end" true in both directions. */}
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${checked ? "start-[22px]" : "start-0.5"}`} />
      </button>
    </div>
  );
}

/** Native select styled to match, for longer option lists. */
export function SelectControl<T extends string | number>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    /* The generic survives the swap: KdsSelect speaks strings, so the raw
       value is mapped back to the typed option exactly as the native one
       did — a number-valued setting still calls onChange with a number. */
    <KdsSelect
      value={String(value)}
      onChange={(raw) => {
        const match = options.find((o) => String(o.value) === raw);
        if (match) onChange(match.value);
      }}
      options={options.map((o) => ({ value: String(o.value), label: o.label }))}
      /* On a phone ControlRow stacks and the wrapper spans the row, so the
         trigger spans it too — sized to its label, the chevron (pinned to
         the wrapper's end) floated off on its own. */
      wrapperClassName="shrink-0"
      panelWidthClassName="min-w-[11rem]"
      triggerClassName="max-sm:w-full h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] ps-2.5 pe-7 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] text-start"
    />
  );
}

/** The Save bar of a draft-and-save tab (Profile, Koleex AI).
 *
 *  Drawn only while there is something to save or to say. It used to be
 *  drawn always, as a full-width strip with a gradient scrim: the pane's
 *  scroller carries the dock's 8rem clearance (.kx-dock-pad), so a sticky
 *  bottom-0 strip rested 128px up the screen, and a disabled Save sat over
 *  the settings, fading the row beneath it, with nothing to save.
 *
 *  Now a compact card at the end of the pane, clear of the dock and the
 *  report button, covering one row at most while it is up. */
export function SaveBar({ dirty, saving, error, toast, onSave, labels }: {
  dirty: boolean; saving: boolean; error: string | null; toast: string | null;
  onSave: () => void;
  labels: { save: string; saving: string; unsaved: string };
}) {
  if (!dirty && !saving && !error && !toast) return null;
  const status = error
    ? <span role="alert" className="text-[12px] text-[#FF6B6B] min-w-0">{error}</span>
    : toast && !dirty
      ? <span role="status" className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1.5"><CheckIcon size={12} />{toast}</span>
      : <span className="text-[12px] text-[var(--text-dim)]">{labels.unsaved}</span>;
  return (
    <div className="sticky bottom-3 z-20 flex justify-end pointer-events-none">
      <div className="kx-save-card pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] ps-4 pe-1.5 py-1.5 shadow-lg">
        {status}
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="h-9 shrink-0 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? <SpinnerIcon className="h-4 w-4" /> : <CheckIcon size={14} />}
          {saving ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}
