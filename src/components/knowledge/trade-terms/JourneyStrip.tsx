"use client";

/* ---------------------------------------------------------------------------
   JourneyStrip — one line from the seller's factory to the buyer's door, with
   two markers on it: where RISK passes, and where the seller's COST stops.

   WHY THIS COMPONENT EARNS ITS PLACE. The single most misunderstood thing
   about Incoterms is that in the C group (CFR, CIF, CPT, CIP) those two
   points are deliberately NOT the same: the seller pays carriage all the way
   to destination while risk passed back at origin. Explaining that in prose
   takes a paragraph and still loses people. Drawn on one line it is obvious
   at a glance — two markers in different places, and the gap between them IS
   the concept.

   It is also why Incoterm carries riskPassesAt and costEndsAt as separate
   fields rather than one "delivery point": the data models the split, so the
   strip renders it without a single special case.

   NO LIBRARY, NO CANVAS, NO MEASUREMENT. Pure flow layout with percentage
   offsets — nothing to lay out twice, nothing to re-measure on resize, and
   nothing that can shift after paint. It costs the page essentially nothing.

   THE TWO END LABELS ARE ANCHORED, NOT CENTRED. A label centred on the 0%
   station hangs half its width outside the card, and the owner's screenshot
   showed exactly that: "Seller's premises" and "Buyer's door" cut off at
   both edges. The first label is pinned to the start edge and reads
   forward; the last is pinned to the end edge and reads back. Only the
   three middle stations are centred on their dot.

   TWO ROWS OF LABELS, ALTERNATING. Five labels on one row need ~370px; a
   card on a phone has ~300px and a card in the three-column desktop grid
   not much more, so neighbours collided in both (measured: "Export cleared"
   began 33px before "Seller's premises" ended). Stations 1 and 3 drop to a
   second row, so no label ever has a horizontal neighbour closer than the
   station two away — the timeline convention, and it needs no measuring.

   RTL. `insetInlineStart` flips with direction, but `translateX` does not —
   so every centred element carries `rtl:translate-x-1/2` to undo the
   physical shift that `-translate-x-1/2` gets wrong once the line runs
   right-to-left. Without it the Arabic strip sat one dot-width off.
   --------------------------------------------------------------------------- */

import type { JourneyStage } from "@/lib/trade-terms/types";

/* Nine data stages collapse onto five visible stations: more than five reads
   as a diagram to study rather than a line to glance at, which defeats the
   purpose. Positions are percentages along the line. */
const STATION_AT: Record<JourneyStage, number> = {
  sellerPremises: 0,
  exportCleared: 25,
  alongsideShip: 38,
  onBoard: 50,
  mainCarriage: 62,
  arrivalPort: 75,
  importCleared: 88,
  destination: 100,
  unloaded: 100,
};

const STATIONS: { at: number; key: string }[] = [
  { at: 0, key: "seller" },
  { at: 25, key: "export" },
  { at: 50, key: "onBoard" },
  { at: 75, key: "arrival" },
  { at: 100, key: "destination" },
];

export interface JourneyStripProps {
  riskAt: JourneyStage;
  costEndsAt: JourneyStage;
  /** Station labels, already translated by the caller. */
  labels: { seller: string; export: string; onBoard: string; arrival: string; destination: string };
  /** Marker labels, already translated. */
  riskLabel: string;
  costLabel: string;
}

export default function JourneyStrip({
  riskAt, costEndsAt, labels, riskLabel, costLabel,
}: JourneyStripProps) {
  const risk = STATION_AT[riskAt];
  const cost = STATION_AT[costEndsAt];
  /* When the two coincide — the E, F and D groups — one combined marker is
     the honest picture. Two stacked pins on the same spot would imply a
     distinction that the rule does not make. */
  const together = risk === cost;

  return (
    <div className="mt-4" role="group" aria-label={`${riskLabel} · ${costLabel}`}>
      {/* The line + stations */}
      <div className="relative h-px bg-[var(--border-subtle)] mx-1">
        {STATIONS.map((s) => (
          <span
            key={s.key}
            className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-[var(--text-ghost)]"
            style={{ insetInlineStart: `${s.at}%` }}
            aria-hidden
          />
        ))}

        {/* The seller's cost run, drawn as a filled span from origin to the
            point where the seller stops paying. Seeing the bar extend past
            the risk pin is what makes the C-group split land. */}
        <span
          className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--text-dim)]"
          style={{ insetInlineStart: 0, width: `${cost}%` }}
          aria-hidden
        />

        {/* RISK marker — the one thing a reader must take away. */}
        <span
          className="absolute -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${risk}%`, top: "-5px" }}
        >
          <span className="block h-2.5 w-2.5 rounded-full bg-[#7FA9D6] ring-4 ring-[#7FA9D6]/15" />
        </span>

        {!together && (
          <span
            className="absolute -translate-x-1/2 rtl:translate-x-1/2"
            style={{ insetInlineStart: `${cost}%`, top: "-4px" }}
          >
            <span className="block h-2 w-2 rounded-full bg-[var(--text-dim)]" />
          </span>
        )}
      </div>

      {/* Station names — ends anchored, middles centred, odd stations on a
          second row (see header). */}
      <div className="relative mt-2 h-12 mx-1">
        {STATIONS.map((s, idx) => {
          const first = idx === 0;
          const last = idx === STATIONS.length - 1;
          const lower = idx % 2 === 1;
          const cls = first
            ? "text-start w-[5.5rem]"
            : last
              ? "text-end w-[5.5rem]"
              : "text-center w-20 -translate-x-1/2 rtl:translate-x-1/2";
          const pos = {
            ...(first ? { insetInlineStart: 0 } : last ? { insetInlineEnd: 0 } : { insetInlineStart: `${s.at}%` }),
            top: lower ? "1.25rem" : 0,
          };
          return (
            <span
              key={s.key}
              className={`absolute text-[10px] leading-tight ${lower ? "text-[var(--text-dim)]" : "text-[var(--text-ghost)]"} ${cls}`}
              style={pos}
            >
              {labels[s.key as keyof typeof labels]}
            </span>
          );
        })}
      </div>

      {/* Legend. Written as a sentence per marker rather than a colour key:
          a newcomer should not have to decode a legend to read a diagram
          that exists to save them from decoding prose. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[#7FA9D6]" aria-hidden />
          {riskLabel}
        </span>
        {!together && (
          <span className="inline-flex items-center gap-1.5 text-[var(--text-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-dim)]" aria-hidden />
            {costLabel}
          </span>
        )}
      </div>
    </div>
  );
}
