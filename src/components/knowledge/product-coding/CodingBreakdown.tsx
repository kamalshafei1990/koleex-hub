"use client";

/* ---------------------------------------------------------------------------
   CodingBreakdown — the interactive heart of the knowledge document.

   - Renders the bilingual numbered code diagram (mirrors the printed
     reference card).
   - Below the diagram: the configuration tables, one per axis.
   - Hover or click any segment → the matching config table glows and
     the others soft-fade. Hovering a config table goes the other way
     (segment lights up).
   - Keyboard / focus accessible (each segment is a button).

   State is local to one breakdown so multiple breakdowns on the same
   page (Lockstitch, Overlock, Interlock) don't interfere.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import {
  CodeSegment,
  CodePrefix,
  Dash,
  ColumnHeaderRow,
  ConfigCard,
} from "./primitives";
import type { CodingBreakdownDef } from "./data";

export default function CodingBreakdown({
  def,
}: {
  def: CodingBreakdownDef;
}) {
  /* `active` is the user's CLICKED / locked selection.
     `hover` is transient. Effective active = hover ?? active. */
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? active;

  function setLocked(idx: number) {
    setActive((cur) => (cur === idx ? null : idx));
  }

  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* ── Glass header strip with subtle gradient depth ── */}
      <div
        className="relative px-5 py-5 sm:px-7 sm:py-6 border-b border-[var(--border-faint)]"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-secondary) 100%)",
        }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
              {def.title}
            </h3>
            <p className="mt-1 text-[12.5px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
              {def.subtitle}
            </p>
          </div>
          <div className="font-mono text-[11.5px] text-[var(--text-dim)] flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/70"
            />
            {def.example}
          </div>
        </div>
      </div>

      {/* ── Diagram ── */}
      <div className="px-5 sm:px-7 pt-6">
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
          <div className="flex items-end gap-1.5 min-w-max">
            <CodePrefix value={def.prefix} />
            <Dash />
            {def.segments.map((s, i) => (
              <span key={i} className="flex items-end gap-1.5">
                {s.sep === "before" && <Dash />}
                <CodeSegment
                  value={s.value}
                  index={s.index}
                  empty={s.empty}
                  active={effective === s.index}
                  linked={effective !== null}
                  onEnter={() => setHover(s.index)}
                  onLeave={() => setHover(null)}
                  onClick={() => setLocked(s.index)}
                />
              </span>
            ))}
          </div>
        </div>

        <ColumnHeaderRow
          cells={def.segments.map((s) => ({
            label: s.header,
            sub: s.sub,
            index: s.index,
          }))}
          activeIndex={effective}
        />
      </div>

      {/* ── Tables grid (linked to active segment) ── */}
      <div className="px-5 sm:px-7 py-6 mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {def.tables.map((t) => {
            const isActive = effective === t.segmentNumber;
            const isFaded = effective !== null && !isActive;
            return (
              <ConfigCard
                key={t.segmentNumber}
                segmentNumber={t.segmentNumber}
                title={t.title}
                sub={t.sub}
                rows={t.rows}
                active={isActive}
                faded={isFaded}
                onEnter={() => setHover(t.segmentNumber)}
                onLeave={() => setHover(null)}
              />
            );
          })}
        </div>

        {active !== null && (
          <div className="mt-4 text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)]">
            Segment {String(active).padStart(2, "0")} locked · click again to release
          </div>
        )}
      </div>
    </article>
  );
}
