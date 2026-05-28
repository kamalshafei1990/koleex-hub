"use client";

/* ---------------------------------------------------------------------------
   BreakdownCard — v22.

   Each XSL / XSO / XSI card is now a live mini SKU builder:

     · The big monospace code in the header updates in real time as the
       user clicks value pills. Pills behave exactly like the Live SKU
       builder selectors — selected pill inverts to black-on-white.
     · A Copy button writes the live code to clipboard; a Reset button
       restores the canonical example. Both sit in the header.
     · Formula cells reflect the LIVE state, not the static example.
       Empty axes render as a dashed empty box; filled axes show their
       current value.
     · Hover/click on a formula cell or its axis block still highlights
       the matching axis everywhere on the card (the V17 affordance).
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import type { CodingBreakdownDef } from "./data";
import { HubIcon } from "./icon-registry";

type Selection = Record<number, string>;

function initialFromDef(def: CodingBreakdownDef): Selection {
  const s: Selection = {};
  for (const seg of def.segments) {
    s[seg.index] = seg.empty ? "" : seg.value;
  }
  return s;
}

/* Build a canonical code string from the current selection. Mirrors the
   SKU-builder rule: empty + "/" segments are skipped from the joined
   code; everything else is dash-joined after the prefix. */
function buildCode(def: CodingBreakdownDef, sel: Selection): string {
  const parts: string[] = [def.prefix];
  for (const seg of def.segments) {
    const v = sel[seg.index];
    if (v && v !== "" && v !== "/") parts.push(v);
  }
  return parts.join("-");
}

function FormulaCell({
  value,
  index,
  empty,
  prefix,
  active,
  dimmed,
  onEnter,
  onLeave,
  onClick,
}: {
  value: string;
  index?: number;
  empty?: boolean;
  prefix?: boolean;
  active?: boolean;
  dimmed?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  if (prefix) {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center justify-center min-w-[54px] h-11 px-3 rounded-lg border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] text-[14px] font-bold tracking-wider font-mono">
          {value}
        </div>
        <div className="h-5" aria-hidden />
      </div>
    );
  }
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      aria-pressed={active ? "true" : "false"}
      className="flex flex-col items-center gap-2 shrink-0 outline-none"
    >
      <div
        className={`flex items-center justify-center min-w-[54px] h-11 px-3 rounded-lg border text-[14px] font-bold tracking-wider font-mono transition-colors duration-150 ${
          empty
            ? "border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] bg-[var(--bg-surface)]"
            : active
              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        } ${dimmed ? "opacity-40" : ""}`}
      >
        {empty ? "" : value}
      </div>
      {typeof index === "number" && (
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none bg-[var(--text-primary)] text-[var(--bg-primary)] ${
            dimmed ? "opacity-40" : ""
          }`}
        >
          {index}
        </div>
      )}
    </button>
  );
}

function Dash() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center h-11 px-1 text-[var(--text-dim)] text-[16px] font-bold">
        —
      </div>
      <div className="h-5" aria-hidden />
    </div>
  );
}

export default function BreakdownCard({ def }: { def: CodingBreakdownDef }) {
  /* Hover/active axis highlight (kept from v17). */
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? active;

  /* Live selection state — each axis carries the current picked value. */
  const initial = useMemo(() => initialFromDef(def), [def]);
  const [sel, setSel] = useState<Selection>(initial);
  const builtCode = useMemo(() => buildCode(def, sel), [def, sel]);

  /* Copy-to-clipboard state. */
  const [copied, setCopied] = useState(false);

  function toggleAxis(idx: number) {
    setActive((cur) => (cur === idx ? null : idx));
  }

  function pickValue(segNumber: number, code: string) {
    setSel((cur) => ({ ...cur, [segNumber]: code }));
  }

  function reset() {
    setSel(initial);
    setActive(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(builtCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const isDirty = JSON.stringify(sel) !== JSON.stringify(initial);

  return (
    <article
      id={def.id}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* ── Header — same shell as the Live SKU builder ─────────── */}
      <div
        className="px-5 sm:px-7 py-5 border-b border-[var(--border-faint)] flex flex-wrap items-center justify-between gap-4"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 0%, var(--bg-surface-hover) 0%, transparent 60%), var(--bg-secondary)",
        }}
      >
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            {def.title.split(" · ")[0]} · Live reference
          </div>
          <div className="mt-2 font-mono text-[22px] sm:text-[28px] font-bold tracking-wider text-[var(--text-primary)] truncate">
            {builtCode}
          </div>
        </div>

        {/* Header toolbar — Reset + Copy */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reset}
            disabled={!isDirty}
            className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            aria-label="Reset to canonical example"
          >
            <span aria-hidden>↺</span>
            Reset
          </button>
          <button
            type="button"
            onClick={copy}
            className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-1.5"
            aria-label="Copy code"
          >
            <HubIcon domain="utility" k={copied ? "check" : "copy"} size={13} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* ── Subtitle ───────────────────────────────────────────── */}
      <div className="px-5 sm:px-7 pt-5 text-[12.5px] text-[var(--text-faint)] leading-relaxed max-w-3xl">
        {def.subtitle}{" "}
        <span className="text-[var(--text-primary)] font-medium">
          Click any value below to compose a code — reset returns to the canonical example.
        </span>
      </div>

      {/* ── Formula anatomy strip — reflects LIVE selection ─────── */}
      <div className="px-5 sm:px-7 pt-5 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
          Code anatomy
        </div>
        <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4 overflow-x-auto">
          <div className="flex items-end gap-1.5 min-w-max justify-center">
            <FormulaCell value={def.prefix} prefix />
            <Dash />
            {def.segments.map((s, i) => {
              const v = sel[s.index] ?? "";
              const isEmpty = v === "" || v === "/";
              return (
                <span key={i} className="flex items-end gap-1.5">
                  {s.sep === "before" && <Dash />}
                  <FormulaCell
                    value={isEmpty ? "" : v}
                    index={s.index}
                    empty={isEmpty}
                    active={effective === s.index}
                    dimmed={effective !== null && effective !== s.index}
                    onEnter={() => setHover(s.index)}
                    onLeave={() => setHover(null)}
                    onClick={() => toggleAxis(s.index)}
                  />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Axis selector list — clickable pills set the segment ── */}
      <div className="p-5 sm:p-7 pt-3 space-y-4">
        {def.tables.map((t) => {
          const isActive = effective === t.segmentNumber;
          const isDimmed = effective !== null && !isActive;
          const current = sel[t.segmentNumber] ?? "";
          return (
            <div
              key={t.segmentNumber}
              onMouseEnter={() => setHover(t.segmentNumber)}
              onMouseLeave={() => setHover(null)}
              className={`rounded-lg p-3 transition-colors ${
                isActive
                  ? "bg-[var(--bg-surface-subtle)]"
                  : "hover:bg-[var(--bg-surface-subtle)]"
              } ${isDimmed ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none">
                  {t.segmentNumber}
                </div>
                <div className="text-[11.5px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  {t.title}
                </div>
                {current && current !== "" && current !== "/" && (
                  <div className="ml-auto text-[10px] font-mono font-bold text-[var(--text-faint)] uppercase tracking-wider">
                    {current}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.rows.map((r) => {
                  const isSelected = current === r.code;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      title={r.meaning}
                      onClick={(e) => {
                        e.stopPropagation();
                        pickValue(t.segmentNumber, r.code);
                      }}
                      className={`h-7 px-2.5 rounded-md border text-[11px] font-mono transition-colors flex items-center ${
                        isSelected
                          ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      <span
                        className={`font-bold ${isSelected ? "" : "text-[var(--text-primary)]"}`}
                      >
                        {r.code}
                      </span>
                      <span className="ml-1.5 hidden sm:inline opacity-80 font-sans font-medium">
                        {r.meaning}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
