"use client";

/* ---------------------------------------------------------------------------
   TermCard — one trade term, in three layers.

   THE THREE LAYERS, AND WHY.
     1. Closed (≈3 seconds): code, full name, one sentence. Someone who meets
        "FOB Ningbo" in a contract has exactly one question — what is it and
        what changes for me — and the closed card answers it. Most readers
        never need more.
     2. Opened (≈30 seconds): the journey strip and the who-pays grid. Both
        are DRAWN FROM STRUCTURE, so they cannot contradict the prose.
     3. Deep (≈2 minutes): meaning, mechanics, when to use, when not to, and
        the mistake people actually make.

   THE PERFORMANCE RULE THIS ENFORCES. Layer 3 prose is NOT imported at the
   top of this file. The parent fetches it on first open and passes it down,
   so a reader who only browses never downloads a byte of it. Importing it
   here would defeat the entire split — the module graph would pull it into
   the page chunk regardless of whether a card is ever opened.

   Nothing here reserves a fixed height and then changes it: the card grows
   downward from its own bottom edge, so opening one never moves the cards
   above it. Content that shifts after paint is a standing rule against.
   --------------------------------------------------------------------------- */

import { useId } from "react";
import type { Incoterm, TermCopy } from "@/lib/trade-terms/types";
import JourneyStrip from "./JourneyStrip";

export interface TermCardLabels {
  seaOnly: string;
  anyMode: string;
  containerWarning: (alt: string) => string;
  alsoWritten: (aliases: string) => string;
  sellerPays: string;
  buyerPays: string;
  costRows: {
    exportPackLoad: string; exportClearance: string; mainCarriage: string;
    insurance: string; importClearance: string; dutyVat: string;
    unloadAtDestination: string;
  };
  journey: { seller: string; export: string; onBoard: string; arrival: string; destination: string };
  riskMarker: string;
  costMarker: string;
  meaning: string;
  howItWorks: string;
  useWhen: string;
  avoidWhen: string;
  pitfall: string;
  insuranceNote: (clauses: string, pct: number) => string;
  more: string;
  less: string;
}

interface Props {
  term: Incoterm;
  /** The name in the reader's language (信用证 / الاعتماد المستندي). Absent
   *  in English, where term.name already is the name. */
  localName?: string;
  oneLine: string;
  /** Undefined until the deep copy has loaded — the card stays usable
   *  without it rather than blocking on a fetch. */
  detail?: Omit<TermCopy, "oneLine">;
  open: boolean;
  onToggle: () => void;
  labels: TermCardLabels;
}

export default function TermCard({ term, localName, oneLine, detail, open, onToggle, labels }: Props) {
  const panelId = useId();
  /* Ghost line: when a local name takes the name slot, the English name
     moves down here with the other spellings — it is what the contract
     says, so it must stay findable on the card. */
  const ghost = [...(localName ? [term.name] : []), ...(term.aliases ?? [])];

  return (
    <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* The whole head is the control: a newcomer should not have to find a
          small chevron to discover there is more. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full text-start p-4 md:p-5 transition-colors hover:bg-[var(--bg-surface-subtle)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* The code is the thing being looked up — it gets the weight. */}
            <div className="text-[22px] font-bold tracking-tight text-[var(--text-primary)] leading-none">
              {term.code}
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--text-dim)]">{localName ?? term.name}</div>
            {ghost.length > 0 && (
              <div className="mt-0.5 text-[11.5px] text-[var(--text-ghost)]">{labels.alsoWritten(ghost.join(", "))}</div>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--text-dim)] whitespace-nowrap">
            {term.family === "sea" ? labels.seaOnly : labels.anyMode}
          </span>
        </div>

        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
          {oneLine}
        </p>

        {term.containerTrap && term.containerAlternative && (
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-amber-400/90">
            {labels.containerWarning(term.containerAlternative)}
          </p>
        )}

        <span className="mt-3 inline-block text-[11.5px] font-semibold text-[#7FA9D6]">
          {open ? labels.less : labels.more}
        </span>
      </button>

      {open && (
        <div id={panelId} className="px-4 md:px-5 pb-5 border-t border-[var(--border-subtle)] pt-4">
          <JourneyStrip
            riskAt={term.riskPassesAt}
            costEndsAt={term.costEndsAt}
            labels={labels.journey}
            riskLabel={labels.riskMarker}
            costLabel={labels.costMarker}
          />

          {/* Who pays what — rendered from flags, so it is impossible for this
              grid to disagree with anything written elsewhere on the page. */}
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
            {(Object.keys(labels.costRows) as (keyof typeof labels.costRows)[]).map((k) => {
              const payer = term.costs[k];
              return (
                <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-[var(--border-subtle)]/60">
                  <dt className="text-[12px] text-[var(--text-dim)]">{labels.costRows[k]}</dt>
                  <dd className={`text-[11.5px] font-semibold whitespace-nowrap ${
                    payer === "seller" ? "text-[#7FA9D6]" : "text-[var(--text-ghost)]"
                  }`}>
                    {payer === "seller" ? labels.sellerPays : labels.buyerPays}
                  </dd>
                </div>
              );
            })}
          </dl>

          {term.insuranceObligation && (
            <p className="mt-3 text-[11.5px] text-[var(--text-dim)]">
              {labels.insuranceNote(term.insuranceObligation.clauses, term.insuranceObligation.minCoverPct)}
            </p>
          )}

          {detail && (
            <div className="mt-5 space-y-4">
              <Block title={labels.meaning} body={detail.meaning} />
              <Block title={labels.howItWorks} body={detail.howItWorks} />
              {detail.useWhen && <Block title={labels.useWhen} body={detail.useWhen} />}
              {detail.avoidWhen && <Block title={labels.avoidWhen} body={detail.avoidWhen} />}
              {detail.pitfall && <Block title={labels.pitfall} body={detail.pitfall} highlight />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, body, highlight }: { title: string; body: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5" : ""}>
      <h4 className={`text-[11px] font-bold uppercase tracking-wide ${
        highlight ? "text-amber-400/90" : "text-[var(--text-ghost)]"
      }`}>
        {title}
      </h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}
