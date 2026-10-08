"use client";

/* ---------------------------------------------------------------------------
   PriceOptionsFobList — the supplier's OTHER price options, each priced.

   The Base FOB card answers "what does the MAIN price become"; the owner's
   follow-up (2026-08-28) was "what about the other options?" — the ¥33,000
   dual-purpose, the ¥38,000 raised-height… This list asks the SAME policy
   engine (price-preview → computePolicyPrice, Commercial Setup is the SoT —
   nothing is re-computed client-side) for the Base FOB of every option in
   ONE request, and shows it next to each ladder row.

   `landed` per option is computed by the CALLER with the same cost-basis
   extras (packing / delivery / VAT) as the main price — one quote, one
   basis. When extras apply, the row shows the landed ¥ it was priced from.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export interface PriceOptionFobItem {
  /** Index of this option in the link's price_options — edit target. */
  idx: number;
  /** The supplier's entered option price (display). */
  raw: number;
  /** Landed cost actually sent to the engine (raw + extras + VAT). */
  landed: number;
  /** The option's note, already locale-resolved. */
  label: string;
}

export default function PriceOptionsFobList({
  items,
  selectedRaw,
  onSelect,
  onEditPrice,
}: {
  items: PriceOptionFobItem[];
  /** Raw ¥ of the option the Price tab is previewing, or null = main price. */
  selectedRaw?: number | null;
  /** Click an option to preview the whole Price tab from ITS cost; click
   *  again to return to the main price. */
  onSelect?: (raw: number | null) => void;
  /** Edit the option's ¥ directly on the card — syncs to the Supplier
   *  tab's price ladder (same contract as the main factory-cost input).
   *  Absent = read-only price (member-override view). */
  onEditPrice?: (idx: number, value: string) => void;
}) {
  const [fobs, setFobs] = useState<Record<string, number | null>>({});

  const key = items.map((i) => i.landed).join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const costs = key.split(",").map(Number).filter((v) => Number.isFinite(v) && v > 0);
    if (costs.length === 0) return;
    /* Debounced — inline price edits change the key on every keystroke. */
    const timer = setTimeout(() => {
    fetch(
      `/api/products/price-preview?cost_cny=${costs[0]}&qty=1&extra_costs=${encodeURIComponent(costs.join(","))}`,
      { credentials: "include" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { extraFobs?: { cost: number; baseFobUsd: number | null }[] } | null) => {
        if (cancelled || !j?.extraFobs) return;
        const map: Record<string, number | null> = {};
        for (const e of j.extraFobs) map[String(e.cost)] = e.baseFobUsd;
        setFobs(map);
      })
      .catch(() => undefined);
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key]);

  const usd = (v: number | null | undefined) =>
    v == null ? null : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /* Cards, not text rows (owner: "better to be in a cards shape") — the
     same visual vocabulary as the market tiles: label on top, the two
     numbers big underneath, accent ring on the selected card. */
  return (
    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {items.map((o, oi) => {
        const fob = usd(fobs[String(o.landed)]);
        const hasExtras = o.landed !== o.raw;
        const selectable = !!onSelect;
        const active = selectedRaw !== null && selectedRaw !== undefined && selectedRaw === o.raw;
        const body = (
          <>
            {o.label ? (
              <div className={`text-[10px] leading-snug ${active ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"} line-clamp-2 min-h-[26px]`}>{o.label}</div>
            ) : (
              <div className="min-h-[26px]" />
            )}
            <div className="mt-1 flex items-baseline justify-between gap-2 flex-wrap">
              {onEditPrice ? (
                /* Inline-editable ¥ — the card still selects on click, so the
                   input swallows its own events. Width tracks the digits. */
                <span className={`inline-flex items-baseline gap-0.5 text-[15px] font-bold tabular-nums ${active ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                  ¥
                  <input
                    inputMode="decimal"
                    value={String(o.raw)}
                    size={Math.max(3, String(o.raw).length)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) onEditPrice(o.idx, v);
                    }}
                    className="bg-transparent border-b border-dashed border-[var(--border-strong)] outline-none focus:border-[var(--accent)] text-inherit font-bold tabular-nums w-auto min-w-0"
                    style={{ width: `${Math.max(3, String(o.raw).length) + 1}ch` }}
                    title="Edit this option's price — syncs to the Supplier tab"
                  />
                </span>
              ) : (
                <span className={`text-[15px] font-bold tabular-nums ${active ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>¥{o.raw.toLocaleString()}</span>
              )}
              {fob ? (
                <span className="text-[13px] font-bold tabular-nums text-[var(--accent)]">FOB {fob}</span>
              ) : null}
            </div>
            {hasExtras ? (
              <div className="text-[9.5px] text-[var(--text-ghost)] tabular-nums mt-0.5">landed ¥{o.landed.toLocaleString()}</div>
            ) : null}
          </>
        );
        const cardCls = `text-left rounded-xl border px-3 py-2.5 transition-colors ${
          active
            ? "border-[var(--accent)]/70 bg-[var(--accent)]/[0.08]"
            : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 hover:border-[var(--border-strong)]"
        }`;
        if (!selectable) {
          return <div key={oi} className={cardCls}>{body}</div>;
        }
        return (
          <div
            key={oi}
            role="button"
            tabIndex={0}
            onClick={() => onSelect!(active ? null : o.raw)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect!(active ? null : o.raw); } }}
            title={active ? "Click to price from the main price again" : "Click to price the whole tab from this option"}
            className={`${cardCls} cursor-pointer select-none`}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
