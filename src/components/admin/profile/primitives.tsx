"use client";

/* ---------------------------------------------------------------------------
   Profile primitives — the visual grammar every sheet on the product profile
   shares: the card (Group), the number tile (StatTile), the fact chip
   (FactChip), the CALCULATED pill and the input that stands inside a tile.

   Edit mode is NOT a different layout. Every tile stays in its cell and the
   value inside it becomes the control for that value (owner, twice: "still
   totally different layout and different field places"). Group carries the
   Edit / Cancel / Save chrome; the sheet decides what the body reads from.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import Collapse from "@/components/ui/Collapse";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

/* The editor's Section card, field-for-field: icon in a rounded square,
   title, optional badge, collapse chevron. */
export function Group({
  icon, title, count, onEdit, children, motion = "kx-tab-in", editLabel = "Edit",
  editing = false, editor, saving = false, error, onSave, onCancel, saveLabel = "Save", cancelLabel = "Cancel", canSave = true,
}: { icon?: React.ReactNode; title: string; count?: string; onEdit?: () => void; children: React.ReactNode;
  /** Translated by the caller — Group is presentational and has no dictionary. */
  editLabel?: string;
  /** Entrance class — the profile passes useTabMotion's directional pick. */
  motion?: string;
  /* ── Inline edit ──
     The card stays where it is, with its icon, title and badge; only the
     body swaps to `editor` and the header's Edit becomes Cancel / Save. The
     page around the card does not move. */
  editing?: boolean;
  editor?: React.ReactNode;
  saving?: boolean;
  error?: string | null;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  /** False = nothing changed yet, or the draft is not valid — Save waits. */
  canSave?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`${motion} scroll-mt-24 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.15)]`}>
      <div className="w-full flex items-center gap-3 px-6 py-4">
        <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
          {icon}
        </div>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1 text-left truncate">{title}</h2>
        {count && (
          /* While editing, Cancel + Save join the row; on a phone that left no
             room for the title, which truncated to nothing. The badge is the
             least important thing here, so it yields first. */
          <span className={`text-[10px] font-medium text-[var(--text-ghost)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-full shrink-0 ${editing ? "hidden sm:inline" : ""}`}>{count}</span>
        )}
        {editing ? (
          <span className="shrink-0 inline-flex items-center gap-1.5">
            <button type="button" onClick={onCancel} disabled={saving} className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50">
              {cancelLabel}
            </button>
            <button type="button" onClick={onSave} disabled={saving || !canSave} className="h-7 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold inline-flex items-center gap-1.5 transition-all disabled:opacity-40">
              {saving ? <SpinnerIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />} {saveLabel}
            </button>
          </span>
        ) : onEdit ? (
          <button type="button" onClick={onEdit} className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <PencilIcon className="h-3 w-3" /> {editLabel}
          </button>
        ) : null}
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors" aria-label={open ? "Collapse" : "Expand"}>
          <AngleDownIcon className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <Collapse open={open || editing} className="px-6 pb-6 pt-4 border-t border-[var(--border-subtle)]">
        {editing && error ? (
          <p className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">{error}</p>
        ) : null}
        {editing && editor ? editor : children}
      </Collapse>
    </section>
  );
}

export function StatTile({
  label, value, unit, tone = "plain", input, extra,
}: { label: string; value: React.ReactNode; unit?: string; tone?: "plain" | "accent" | "warn";
  /** Edit mode: the control that stands where the number stood. Same tile. */
  input?: React.ReactNode;
  /** Edit mode: a line under the number/control (a mode switch, a reset). */
  extra?: React.ReactNode }) {
  return (
    <div className={`h-full rounded-xl border px-3.5 py-3 ${
      tone === "accent"
        ? "border-[#567FB2]/30 bg-[#567FB2]/[0.07]"
        : tone === "warn"
          ? "border-amber-500/40 bg-amber-500/[0.07]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    }`}>
      <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] truncate">{label}</div>
      {input ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="min-w-0 flex-1">{input}</span>
          {unit ? <span className="text-[11px] font-medium text-[var(--text-muted)] shrink-0">{unit}</span> : null}
        </div>
      ) : (
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-[21px] leading-none font-bold tabular-nums text-[var(--text-primary)]">{value}</span>
          {unit ? <span className="text-[11px] font-medium text-[var(--text-muted)]">{unit}</span> : null}
        </div>
      )}
      {extra}
    </div>
  );
}

export function FactChip({
  icon, label, value, note, tone = "plain", wide = false, input,
}: { icon: React.ReactNode; label: string; value: string; note?: string; tone?: "plain" | "warn"; wide?: boolean;
  /** Edit mode: the control that stands where the value stood. Same chip. */
  input?: React.ReactNode }) {
  /* A BLOCK, NOT AN INLINE PILL. Content-width chips made every row ragged —
     three facts of different name lengths left three different gutters, and
     the fourth wrapped onto a line of its own. In a grid each fact takes the
     same cell, so the cards line up in columns like the numbers above them. */
  return (
    <span className={`flex h-full items-center gap-2.5 rounded-xl border px-3 py-2.5 ${wide ? "col-span-full" : ""} ${
      tone === "warn"
        ? "border-amber-500/40 bg-amber-500/[0.07]"
        : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    }`}>
      {/* Bigger and brighter than a list glyph on purpose: at 16px in
          --text-muted these read as empty squares on a dark chip. */}
      <span className={`h-11 w-11 shrink-0 rounded-lg flex items-center justify-center ${
        tone === "warn" ? "bg-amber-500/[0.14] text-amber-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
      }`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{label}</span>
        {input ? (
          <span className="block mt-1">{input}</span>
        ) : (
          <span className="block text-[13px] font-semibold text-[var(--text-primary)] break-words">{value}</span>
        )}
        {/* The forwarder's note belongs to the fact it qualifies, not to a
            stray paragraph under the card. */}
        {note ? <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 break-words">{note}</span> : null}
      </span>
    </span>
  );
}

/* The pill that marks a number the sheet works out itself — the operator
   never types it, and the label says so. */
export function CalcBadge({ label }: { label: string }) {
  return (
    <span className="font-bold uppercase tracking-[0.12em] px-1.5 py-px rounded-full border border-[#567FB2]/50 text-[#7FA9D6]">{label}</span>
  );
}

/* The input that stands inside a tile. No width of its own (the width trap:
   `w-full` + `w-16` resolves by Tailwind's emit order, not by which was
   written last), so each place sets the width it has. */
export const INP_B = "h-9 px-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] placeholder:font-normal outline-none focus:border-[var(--border-focus)] transition-colors";
export const SEG = "h-7 px-2 rounded-md text-[10.5px] font-semibold border transition-colors";
export const SEG_ON = "border-[#567FB2]/60 bg-[#567FB2]/[0.12] text-[var(--text-primary)]";
export const SEG_OFF = "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]";

/* ── The field row ────────────────────────────────────────────────────────
   Label on top, value under it, help line beneath — the shape every text
   field on the profile has always had. In edit mode the value becomes the
   control; the glyph, label and help stay exactly where they were. The glyph
   is resolved by the caller (the Visual Library binding table lives there). */
export function FieldRow({ label, value, help, input, glyph, mono, badge, wide }: {
  label: string;
  value: React.ReactNode;
  help?: string;
  input?: React.ReactNode;
  glyph?: React.ReactNode;
  mono?: boolean;
  badge?: React.ReactNode;
  /** Spans the whole grid row (long text, lists). */
  wide?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-3 first:pt-0 last:pb-0 ${wide ? "col-span-full" : ""}`}>
      {glyph ? (
        <span className="mt-0.5 h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">{glyph}</span>
      ) : (
        <span aria-hidden className="mt-0.5 h-8 w-8 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)]">{label}</span>
          {badge}
        </div>
        {input ? (
          <div className="mt-1">{input}</div>
        ) : (
          <div className={`text-[13.5px] font-semibold text-[var(--text-primary)] break-words ${mono ? "font-mono text-[12.5px] font-medium" : ""}`}>{value}</div>
        )}
        {help && <p className="mt-1 text-[10.5px] text-[var(--text-ghost)]/80 leading-relaxed">{help}</p>}
      </div>
    </div>
  );
}

/* A glyph from the Visual Library by URL: monochrome mask, inherits colour. */
export function MaskGlyph({ src, className = "h-4 w-4" }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-middle ${className}`}
      style={{ maskImage: `url("${src}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${src}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
    />
  );
}

/* The dim "Not set" — a blank is information, not a headline. */
export function Blank({ label }: { label: string }) {
  return <span className="text-[12px] text-[var(--text-ghost)] italic font-normal">{label}</span>;
}

/* Yes / No with the dot the profile has always used for booleans. */
export function YesNo({ v, yes, no }: { v: boolean; yes: string; no: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${v ? "text-emerald-400" : "text-[var(--text-dim)]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v ? "bg-emerald-500" : "bg-[var(--border-subtle)]"}`} />
      {v ? yes : no}
    </span>
  );
}

/* Segmented choice — one row of small pills, one lit. */
export function Seg<T extends string>({ value, options, onChange, allowClear }: {
  value: T | "";
  options: Array<{ v: T; label: string; on?: string }>;
  onChange: (v: T | "") => void;
  allowClear?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(active && allowClear ? "" : o.v)}
            className={`${SEG} ${active ? (o.on ?? SEG_ON) : SEG_OFF}`}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

/* Chip-list view (tags, aliases, channels). */
export function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((x, i) => (
        <span key={`${x}-${i}`} className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-primary)]">{x}</span>
      ))}
    </span>
  );
}

export const TA = `${INP_B} w-full h-auto min-h-[84px] py-2 leading-relaxed font-normal text-[13px] resize-y`;
