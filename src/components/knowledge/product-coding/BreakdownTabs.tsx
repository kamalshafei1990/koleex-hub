"use client";

/* ---------------------------------------------------------------------------
   BreakdownTabs — collapses the three stacked technical breakdowns
   into a single tab strip so only one is visible at a time. Cuts ~60%
   of vertical noise from the V2 layout where all three were stacked.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import CodingBreakdown from "./CodingBreakdown";
import type { CodingBreakdownDef } from "./data";

export default function BreakdownTabs({
  defs,
}: {
  defs: CodingBreakdownDef[];
}) {
  const [active, setActive] = useState<string>(defs[0]?.id ?? "");
  const current = defs.find((d) => d.id === active) ?? defs[0];

  return (
    <div className="space-y-4">
      {/* Tab strip — segmented control matching the Hub design system. */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-0.5">
          {defs.map((d) => {
            const isActive = d.id === current?.id;
            const code = d.prefix; // XSL / XSO / XSI
            const label = d.title.split(" · ")[0] ?? d.title;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActive(d.id)}
                aria-pressed={isActive}
                className={`h-8 px-3.5 rounded-md text-[12px] font-semibold transition-colors flex items-center gap-2 ${
                  isActive
                    ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="font-mono tracking-wider">{code}</span>
                <span className="hidden sm:inline opacity-80 font-medium">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="text-[10.5px] font-mono text-[var(--text-faint)]">
          {current?.example}
        </div>
      </div>

      {current && <CodingBreakdown def={current} />}
    </div>
  );
}
