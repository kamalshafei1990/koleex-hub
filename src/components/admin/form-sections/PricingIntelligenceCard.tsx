"use client";

/* ---------------------------------------------------------------------------
   PricingIntelligenceCard — the live FOB pricing breakdown for the Product
   Data → Price tab. Given the product's factory cost (CNY), it calls
   /api/products/price-preview which runs the SAME policy engine the rest of
   the system uses against the LIVE Commercial-Setup snapshot. So:

     cost → auto product level → margin → Global FOB (USD)
          → market band adjustment → Regional FOB
          → channel multiplier → per-customer-tier selling price + margin

   Edit anything in Commercial Setup (levels, margins, bands, channels) and
   this recomputes — one engine, one source of truth.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";

interface Preview {
  ok?: boolean;
  error?: string;
  reason?: string;
  fxCnyPerUsd?: number;
  costUpliftPercent?: number;
  base?: {
    factoryCostCny: number;
    netInternalCostCny: number;
    netInternalCostUsd: number;
    productLevelCode: string | null;
    productLevelName: string | null;
    baseMarginPercent: number | null;
    minMarginFloorPercent: number | null;
    globalFobUsd: number | null;
  };
  market?: { countryCode: string | null; bandCode: string | null; adjustmentPercent: number; regionalFobUsd: number | null };
  channels?: { tierCode: string; tierName: string; channelCode: string | null; multiplier: number; unitPriceUsd: number | null; effectiveMarginPercent: number | null; approvalRequired: boolean }[];
  markets?: { code: string; bandCode: string | null; adjustmentPercent: number; regionalFobUsd: number | null }[];
}

interface MarketOpt { code: string; name: string }

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cny = (n: number | null | undefined) =>
  n == null ? "—" : `¥${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

export default function PricingIntelligenceCard({
  costCny,
  currency,
}: {
  costCny: number | null;
  currency?: string | null;
}) {
  const isCny = !currency || currency.toUpperCase() === "CNY";
  const [cost, setCost] = useState<string>(costCny ? String(costCny) : "");
  const [country, setCountry] = useState("EG");
  const [markets, setMarkets] = useState<MarketOpt[]>([]);
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the preview cost in sync if the upstream supplier cost changes.
  useEffect(() => { setCost(costCny ? String(costCny) : ""); }, [costCny]);

  // Country options (full managed list) for the market selector.
  useEffect(() => {
    fetch("/api/commercial-policy/market-adjustments", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { markets?: MarketOpt[] } | null) => {
        if (j?.markets?.length) setMarkets(j.markets.map((m) => ({ code: m.code, name: m.name })));
      })
      .catch(() => {});
  }, []);

  const run = useCallback((costVal: number, countryVal: string) => {
    setLoading(true);
    setErr(null);
    fetch(`/api/products/price-preview?cost_cny=${encodeURIComponent(costVal)}&country=${encodeURIComponent(countryVal)}&qty=1`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Preview;
        if (r.status === 403) { setErr(j.reason || "Commercial Policy access required to view the live pricing breakdown."); setData(null); return; }
        if (!r.ok && !j.base) { setErr(j.error || `Couldn't compute pricing (${r.status})`); setData(null); return; }
        setData(j);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Network error"))
      .finally(() => setLoading(false));
  }, []);

  // Debounced recompute on cost / country change.
  useEffect(() => {
    const n = Number(cost);
    if (!isCny || !Number.isFinite(n) || n <= 0) { setData(null); return; }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => run(n, country), 350);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [cost, country, isCny, run]);

  const base = data?.base;
  const market = data?.market;

  const flow = useMemo(() => {
    if (!base) return [];
    return [
      { k: "Factory cost", v: cny(base.factoryCostCny), sub: "CNY" },
      { k: "Net internal", v: cny(base.netInternalCostCny), sub: `+${data?.costUpliftPercent ?? 0}% uplift · ${usd(base.netInternalCostUsd)}` },
      { k: base.productLevelCode ? `Level ${base.productLevelCode}` : "Level", v: pct(base.baseMarginPercent), sub: base.productLevelName ?? "margin" },
      { k: "Global FOB", v: usd(base.globalFobUsd), sub: "before market" },
      { k: market?.bandCode ? `Band ${market.bandCode}` : "Market", v: pct(market?.adjustmentPercent ?? 0), sub: country },
      { k: "Regional FOB", v: usd(market?.regionalFobUsd), sub: country, strong: true },
    ];
  }, [base, market, data, country]);

  /* ── States that aren't the full breakdown ── */
  if (!isCny) {
    return (
      <Note>
        Supplier cost is in <b>{currency}</b>. The pricing engine works from a <b>CNY</b> factory cost —
        set the supplier currency to CNY (or add a CNY cost) to see the live FOB breakdown.
      </Note>
    );
  }
  const hasCost = Number(cost) > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1">Factory cost (CNY)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[var(--text-ghost)]">¥</span>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
              className="w-40 h-9 pl-7 pr-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1">Market</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-9 px-2.5 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] min-w-[160px]"
          >
            {markets.length === 0 && <option value="EG">Egypt</option>}
            {markets.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </select>
        </div>
        {data?.fxCnyPerUsd && (
          <div className="ms-auto text-[11px] text-[var(--text-dim)] flex items-center gap-1.5">
            {loading && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            FX ¥{data.fxCnyPerUsd}/$
          </div>
        )}
      </div>

      {!hasCost ? (
        <Note>
          Enter the factory cost above (or set it on the <b>Supplier</b> tab) — the system auto-detects the
          product level, applies the margin, market band and channel ladder from <b>Commercial Setup</b>.
        </Note>
      ) : err ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[12px] text-amber-300/90 flex items-start gap-2">
          <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" /> {err}
        </div>
      ) : !base ? (
        <div className="flex items-center gap-2 py-8 text-[var(--text-dim)] text-[13px]">
          <SpinnerIcon className="h-4 w-4 animate-spin" /> Computing…
        </div>
      ) : (
        <>
          {/* Flow: cost → … → regional FOB */}
          <div className="flex flex-wrap items-stretch gap-1.5">
            {flow.map((s, i) => (
              <div key={i} className="flex items-stretch gap-1.5">
                <div className={`rounded-xl border px-3 py-2 min-w-[104px] ${s.strong ? "border-[var(--border-strong)] bg-[var(--bg-inverted)]/[0.04]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50"}`}>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-ghost)] truncate">{s.k}</div>
                  <div className={`text-[15px] font-bold mt-0.5 ${s.strong ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>{s.v}</div>
                  <div className="text-[9px] text-[var(--text-ghost)] truncate">{s.sub}</div>
                </div>
                {i < flow.length - 1 && (
                  <div className="flex items-center text-[var(--text-ghost)]"><ArrowRightIcon className="h-3.5 w-3.5" /></div>
                )}
              </div>
            ))}
          </div>

          {/* Channel ladder (per customer tier) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UsersIcon className="h-4 w-4 text-[var(--text-dim)]" />
              <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">Selling price by customer — {country}</h4>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[var(--bg-surface-subtle)]/60 text-[9px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                    <th className="text-left px-3 py-2">Customer tier</th>
                    <th className="text-left px-3 py-2">Channel</th>
                    <th className="text-right px-3 py-2">Unit price</th>
                    <th className="text-right px-3 py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.channels ?? []).map((c) => (
                    <tr key={c.tierCode} className="border-t border-[var(--border-subtle)]/60">
                      <td className="px-3 py-2 text-[var(--text-primary)]">{c.tierName}</td>
                      <td className="px-3 py-2 text-[var(--text-dim)]">{c.channelCode ?? "—"} <span className="opacity-60">×{c.multiplier}</span></td>
                      <td className="px-3 py-2 text-right font-semibold text-[var(--text-primary)] tabular-nums">{usd(c.unitPriceUsd)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={c.approvalRequired ? "text-amber-400" : "text-[var(--text-dim)]"}>{pct(c.effectiveMarginPercent)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(data?.channels ?? []).some((c) => c.approvalRequired) && (
              <p className="text-[10px] text-amber-400/80 mt-1.5">Amber margin = below the level&apos;s minimum-margin floor (approval needed at that price).</p>
            )}
          </div>

          {/* Key markets regional FOB */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPinIcon className="h-4 w-4 text-[var(--text-dim)]" />
              <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">Regional FOB across key markets</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(data?.markets ?? []).map((m) => (
                <button
                  type="button"
                  key={m.code}
                  onClick={() => setCountry(m.code)}
                  className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${m.code === country ? "border-[var(--border-strong)] bg-[var(--bg-inverted)]/[0.04]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 hover:border-[var(--border-strong)]"}`}
                >
                  <div className="text-[10px] font-semibold text-[var(--text-primary)]">{m.code} <span className="text-[var(--text-ghost)] font-normal">{m.bandCode ? `· ${m.bandCode}` : ""} {pct(m.adjustmentPercent)}</span></div>
                  <div className="text-[13px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{usd(m.regionalFobUsd)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sync footer */}
          <div className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 px-3 py-2.5 text-[11px] text-[var(--text-dim)]">
            <InfoIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Computed live from <a href="/commercial-policy" className="underline text-[var(--text-primary)]">Commercial Setup</a> — product levels, margins, market bands and channel ladder.
              Change them there and this recalculates. Cost comes from the Supplier tab; edit the box above to preview a different cost.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 px-4 py-3 text-[12px] text-[var(--text-dim)] flex items-start gap-2">
      <InfoIcon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--text-ghost)]" />
      <span>{children}</span>
    </div>
  );
}
