"use client";

/* ---------------------------------------------------------------------------
   RiskLadder — the six payment methods as one vertical scale.

   WHY A LADDER AND NOT SIX BADGES. A newcomer's real question is never "is
   D/A safe?" in isolation — it is "safer or riskier than what?". Payment
   terms only mean anything RELATIVE to each other, and every step that
   protects the seller exposes the buyer by exactly as much. A ladder shows
   both facts at once: position carries the comparison, and the two end
   labels carry the direction.

   It renders entirely from PAYMENT_LADDER — the six entries in data.ts that
   carry a rung — so adding or reordering a method there moves it here with
   no edit to this file, and the L/C variants and guarantees, which carry no
   rung, never appear on it.
   --------------------------------------------------------------------------- */

import { PAYMENT_LADDER } from "@/lib/trade-terms/data";
import { TRADE_TERMS_UI, type TradeLang } from "@/lib/trade-terms/ui";

export default function RiskLadder({
  lang, onOpen, openId, summary, names,
}: {
  lang: TradeLang;
  onOpen: (id: string) => void | Promise<void>;
  openId: string | null;
  /* Passed in rather than imported: the ladder must show the ACTIVE
     language's sentence, and importing the English file here would both
     hard-wire English and pull it into this chunk. */
  summary: Record<string, string>;
  /** Spoken names in the active language; empty for English. */
  names: Record<string, string>;
}) {
  const t = TRADE_TERMS_UI[lang];
  const rungs = PAYMENT_LADDER;
  const max = rungs.length;

  return (
    <section className="kx-glass mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 md:p-5">
      <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t.ladderTitle}</h2>

      <div className="mt-1 flex items-center justify-between text-[10.5px] text-[var(--text-ghost)]">
        <span>{t.ladderSafest}</span>
        <span>{t.ladderRiskiest}</span>
      </div>

      {/* One bar, six segments. Opacity carries the gradient of exposure —
          no traffic-light colours, which would read as good/bad when the
          honest picture is a trade-off between two parties. */}
      <div className="mt-2 flex gap-1" role="list">
        {rungs.map((p) => {
          const active = openId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="listitem"
              onClick={() => void onOpen(p.id)}
              aria-pressed={active}
              title={summary[p.id]}
              className={`group flex-1 rounded-lg border px-2 py-2.5 text-start transition-colors ${
                active
                  ? "border-[#7FA9D6]/50 bg-[#7FA9D6]/10"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
              }`}
            >
              <span
                className="block h-1 rounded-full bg-[#7FA9D6]"
                style={{ opacity: 1 - (p.ladder - 1) / max }}
                aria-hidden
              />
              <span className="mt-2 block text-[11px] font-semibold leading-tight text-[var(--text-secondary)]">
                {p.abbr ?? names[p.id] ?? p.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
