"use client";

/* ---------------------------------------------------------------------------
   CompareCodes — pick a machine type (XSL / XSO / XSI) and lay two
   BreakdownCards side-by-side. The strip above the cards counts how
   many axes differ between Side A and Side B, computed from the live
   selections each card emits via onSelChange.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import BreakdownCard, {
  initialFromDef,
  type Selection,
} from "./BreakdownCard";
import {
  LOCKSTITCH,
  OVERLOCK,
  INTERLOCK,
  type CodingBreakdownDef,
} from "./data";
import { useT, useTL } from "./i18n";

const DEFS: Array<{ id: string; def: CodingBreakdownDef; nameKey: string }> = [
  { id: "lockstitch", def: LOCKSTITCH, nameKey: "Lockstitch Machines" },
  { id: "overlock", def: OVERLOCK, nameKey: "Overlock Machines" },
  { id: "interlock", def: INTERLOCK, nameKey: "Interlock Machines" },
];

export default function CompareCodes() {
  const t = useT();
  const tl = useTL();
  const [defId, setDefId] = useState<string>("lockstitch");
  const def = DEFS.find((d) => d.id === defId)!.def;

  const [selA, setSelA] = useState<Selection>(() => initialFromDef(def));
  const [selB, setSelB] = useState<Selection>(() => initialFromDef(def));

  /* When the user picks a different machine type, reset both selections
     to that def's canonical example. */
  function switchDef(id: string) {
    setDefId(id);
    const nextDef = DEFS.find((d) => d.id === id)!.def;
    setSelA(initialFromDef(nextDef));
    setSelB(initialFromDef(nextDef));
  }

  const diffSegments = useMemo(() => {
    return def.segments.filter(
      (s) => (selA[s.index] ?? "") !== (selB[s.index] ?? ""),
    );
  }, [def, selA, selB]);
  const diffCount = diffSegments.length;
  const totalAxes = def.segments.length;
  const compatibilityPct = useMemo(() => {
    return totalAxes === 0
      ? 100
      : Math.round(((totalAxes - diffCount) / totalAxes) * 100);
  }, [diffCount, totalAxes]);

  /* Each diffing axis maps to one or more commercial impact tags. */
  const impactTags = useMemo(() => {
    const tags = new Set<string>();
    for (const s of diffSegments) {
      const h = s.header.toLowerCase();
      if (h.includes("model") || h.includes("function")) {
        tags.add("compare.impact.price");
        tags.add("compare.impact.bom");
      }
      if (h.includes("seam") || h.includes("table") || h.includes("length")) {
        tags.add("compare.impact.packing");
      }
      if (h.includes("motor")) {
        tags.add("compare.impact.bom");
        tags.add("compare.impact.price");
      }
      if (h.includes("hook") || h.includes("stitch")) {
        tags.add("compare.impact.bom");
        tags.add("compare.impact.accessories");
      }
      if (h.includes("fabric")) {
        tags.add("compare.impact.accessories");
      }
      if (h.includes("special") || h.includes("needle") || h.includes("thread")) {
        tags.add("compare.impact.accessories");
        tags.add("compare.impact.bom");
      }
    }
    return Array.from(tags);
  }, [diffSegments]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Toolbar — machine-type picker + diff count */}
      <div className="px-5 sm:px-7 py-4 border-b border-[var(--border-faint)] flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            {t("compare.pick_type")}
          </span>
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5"
            role="radiogroup"
            aria-label={t("compare.pick_type")}
          >
            {DEFS.map((d) => {
              const isActive = defId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => switchDef(d.id)}
                  className={`h-7 px-2.5 rounded-md text-[11.5px] font-semibold transition-colors flex items-center gap-2 ${
                    isActive
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="font-mono" dir="ltr">
                    {d.def.prefix}
                  </span>
                  <span className="hidden sm:inline opacity-80 font-medium">
                    {tl(d.nameKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          className={`text-[11.5px] font-semibold ${
            diffCount > 0
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-faint)]"
          }`}
        >
          {diffCount > 0
            ? t("compare.diff_axes", { n: diffCount })
            : t("compare.no_diff")}
        </div>
      </div>

      {/* Two cards side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-5 sm:p-7">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            {t("compare.side_a")}
          </div>
          <BreakdownCard
            def={def}
            showPermalink={false}
            onSelChange={setSelA}
            key={`A-${defId}`}
          />
        </div>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            {t("compare.side_b")}
          </div>
          <BreakdownCard
            def={def}
            showPermalink={false}
            onSelChange={setSelB}
            key={`B-${defId}`}
          />
        </div>
      </div>

      {/* ── v30: Diff summary + compatibility score + impact ───── */}
      <div className="border-t border-[var(--border-faint)] px-5 sm:px-7 py-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Difference summary */}
        <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            {t("compare.summary.title")}
          </div>
          {diffCount === 0 ? (
            <div className="text-[12.5px] text-[var(--text-faint)]">
              {t("compare.no_diff")}
            </div>
          ) : (
            <ul className="space-y-1">
              {diffSegments.map((s) => (
                <li
                  key={s.index}
                  className="text-[12px] text-[var(--text-primary)] flex items-center gap-2"
                >
                  <span
                    className="font-mono text-[10.5px] text-[var(--text-faint)] w-4 text-center"
                    dir="ltr"
                  >
                    {s.index}
                  </span>
                  <span>
                    {t("compare.summary.row_differs", {
                      axis: tl(s.header),
                    })}
                  </span>
                  <span className="ml-auto flex items-center gap-1 font-mono text-[10.5px]" dir="ltr">
                    <span className="text-[var(--text-faint)]">
                      {selA[s.index] || "—"}
                    </span>
                    <span className="text-[var(--text-dim)]">→</span>
                    <span className="text-[var(--text-primary)] font-bold">
                      {selB[s.index] || "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compatibility score */}
        <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            {t("compare.score.label")}
          </div>
          <div
            className="font-mono text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-none"
            dir="ltr"
          >
            {compatibilityPct}%
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)]">
            {t("compare.score.value", { pct: compatibilityPct })}
          </div>
          {/* Bar */}
          <div className="mt-3 h-1 rounded-sm bg-[var(--border-faint)] overflow-hidden">
            <div
              className="h-full bg-[var(--text-primary)] transition-all duration-300"
              style={{ width: `${compatibilityPct}%` }}
            />
          </div>
        </div>

        {/* Commercial impact */}
        <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            {t("compare.impact.title")}
          </div>
          {impactTags.length === 0 ? (
            <div className="text-[12.5px] text-[var(--text-faint)]">
              {t("compare.impact.none")}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {impactTags.map((tag) => (
                <li
                  key={tag}
                  className="text-[12px] text-[var(--text-primary)] flex items-center gap-2"
                >
                  <span
                    aria-hidden
                    className="h-1 w-1 rounded-full bg-[var(--text-primary)]"
                  />
                  {t(tag)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
