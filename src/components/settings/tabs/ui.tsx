"use client";

/* Shared iOS-style building blocks for the Settings detail tabs. Monochrome
   per brand; the accent (blue) only marks the selected segment / on-toggle.
   Dual-skin: Aurora selection = kx-seg-on (Hub-Blue ring + 10% fill), Core
   keeps the original inverted pill. */

import type { ReactNode } from "react";
import KdsSelect from "@/components/kds/Select";
import { useSkin } from "@/lib/appearance";

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
      {value !== undefined && value !== null && value !== "" && (
        <span className="shrink-0 text-[12.5px] text-[var(--text-dim)] tabular-nums">{value}</span>
      )}
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

/** A labeled row that hosts a control on the right (segmented / select). */
export function ControlRow({ label, hint, children, last }: {
  label: string; hint?: string; children: ReactNode; last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
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
            className={`px-3 h-7 rounded-md text-[12px] font-medium transition-colors ${
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
export function SwitchRow({ label, hint, checked, onChange, last, icon }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean;
  /** Optional leading glyph (Semantic Icon Registry). */
  icon?: React.ReactNode;
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
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors duration-200 ${
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
      wrapperClassName="shrink-0"
      panelWidthClassName="min-w-[11rem]"
      triggerClassName="h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] ps-2.5 pe-7 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] text-start"
    />
  );
}
