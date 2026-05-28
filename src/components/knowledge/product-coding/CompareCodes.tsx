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

  const diffCount = useMemo(() => {
    return def.segments.reduce(
      (n, s) =>
        n +
        ((selA[s.index] ?? "") !== (selB[s.index] ?? "") ? 1 : 0),
      0,
    );
  }, [def, selA, selB]);

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
    </div>
  );
}
