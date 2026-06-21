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
  fxEffectiveCnyPerUsd?: number;
  fxSafetyBufferPercent?: number;
  fxUpdatedAt?: string | null;
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
  taxRefundRatePercent?: number;
  channels?: { tierCode: string; tierName: string; channelCode: string | null; multiplier: number; unitPriceUsd: number | null; pureProfitUsd: number | null; pureMarginPercent: number | null; taxRefundUsd: number; profitWithRefundUsd: number | null; marginWithRefundPercent: number | null; effectiveMarginPercent: number | null; approvalRequired: boolean }[];
  markets?: { code: string; bandCode: string | null; adjustmentPercent: number; regionalFobUsd: number | null }[];
}

interface MarketOpt { code: string; name: string }

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cny = (n: number | null | undefined) =>
  n == null ? "—" : `¥${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

/* Short "freshness" label for the FX rate: today / yesterday / N d ago. */
function fxAgeLabel(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function PricingIntelligenceCard({
  costCny,
  currency,
}: {
  costCny: number | null;
  currency?: string | null;
}) {
  const isCny = !currency || currency.toUpperCase() === "CNY";
  const cost = costCny && costCny > 0 ? String(costCny) : "";
  const [country, setCountry] = useState("EG");
  const [markets, setMarkets] = useState<MarketOpt[]>([]);
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Recompute on cost / country change. First compute fires immediately so the
  // breakdown appears as fast as possible; later edits are debounced so rapid
  // typing in the Cost Price field doesn't spam the engine.
  useEffect(() => {
    const n = Number(cost);
    if (!isCny || !Number.isFinite(n) || n <= 0) { setData(null); return; }
    if (debRef.current) clearTimeout(debRef.current);
    const delay = data ? 350 : 0;
    debRef.current = setTimeout(() => run(n, country), delay);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cost, country, isCny, run]);

  const base = data?.base;
  const market = data?.market;

  const flow = useMemo(() => {
    if (!base) return [];
    return [
      { k: "Base FOB", v: usd(base.globalFobUsd), sub: `Level ${base.productLevelCode ?? "—"}` },
      { k: market?.bandCode ? `Band ${market.bandCode}` : "Market", v: pct(market?.adjustmentPercent ?? 0), sub: `${country} · all channels` },
      { k: "End-user (market)", v: usd(market?.regionalFobUsd), sub: "retail + band", strong: true },
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
      {/* Controls — cost comes from the Cost Price field above; pick the market */}
      <div className="flex flex-wrap items-end gap-3">
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
        {data?.fxCnyPerUsd && (() => {
          const buffer = Number(data.fxSafetyBufferPercent ?? 0);
          const pricingFx = buffer > 0 && data.fxEffectiveCnyPerUsd ? data.fxEffectiveCnyPerUsd : data.fxCnyPerUsd;
          return (
            <div
              className="ms-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/[0.07] text-[11px] font-semibold text-[var(--text-primary)]"
              title={
                buffer > 0
                  ? `Pricing FX ¥${pricingFx} / $1 = live ¥${data.fxCnyPerUsd} − ${buffer}% safety buffer. Live rate auto-updated daily${data.fxUpdatedAt ? ` (last ${new Date(data.fxUpdatedAt).toLocaleString()})` : ""}.`
                  : `Exchange rate used for the USD prices. Auto-updated daily from live FX${data.fxUpdatedAt ? ` — last updated ${new Date(data.fxUpdatedAt).toLocaleString()}` : ""}.`
              }
            >
              {loading
                ? <SpinnerIcon className="h-3 w-3 animate-spin text-[var(--accent)]" />
                : <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
              <span className="text-[var(--accent)]">FX</span>
              <span className="tabular-nums">¥{pricingFx} / $1</span>
              {buffer > 0 && (
                <span className="text-[var(--text-ghost)] font-normal">· −{buffer}% buffer</span>
              )}
              {data.fxUpdatedAt && (
                <span className="text-[var(--text-ghost)] font-normal">· {fxAgeLabel(data.fxUpdatedAt)}</span>
              )}
            </div>
          );
        })()}
      </div>

      {!hasCost ? (
        <Note>
          Enter the <b>Cost Price</b> above and the system auto-detects the product level, applies the margin,
          market band and channel ladder from <b>Commercial Setup</b>.
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
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-[12px] min-w-[520px]">
                <thead>
                  <tr className="bg-[var(--bg-surface-subtle)]/60 text-[9px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                    <th className="text-left px-3 py-2">Customer tier</th>
                    <th className="text-right px-3 py-2">Unit price</th>
                    <th className="text-right px-3 py-2">Pure margin</th>
                    <th className="text-right px-3 py-2">Tax refund</th>
                    <th className="text-right px-3 py-2">+ Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.channels ?? []).map((c) => (
                    <tr key={c.tierCode} className="border-t border-[var(--border-subtle)]/60">
                      <td className="px-3 py-2 text-[var(--text-primary)]">{c.tierName}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[var(--text-primary)] tabular-nums">{usd(c.unitPriceUsd)}</td>
                      {/* PURE commercial margin — the governed number. */}
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={`font-semibold ${c.approvalRequired ? "text-amber-400" : "text-[var(--text-primary)]"}`}>{pct(c.pureMarginPercent)}</span>
                        <span className="block text-[10px] text-[var(--text-ghost)]">{usd(c.pureProfitUsd)}</span>
                      </td>
                      {/* Tax refund — a SEPARATE line, never blended in. */}
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--accent)]">
                        +{usd(c.taxRefundUsd)}
                      </td>
                      {/* Margin including the refund (total picture only). */}
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="text-[var(--text-secondary)]">{pct(c.marginWithRefundPercent)}</span>
                        <span className="block text-[10px] text-[var(--text-ghost)]">{usd(c.profitWithRefundUsd)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-[var(--text-ghost)] mt-1.5">
              <b>Pure margin</b> is your real commercial margin — the tax refund is <b>never</b> mixed in. The <b>+ Refund</b> column adds the {pct(data?.taxRefundRatePercent ?? 0)} export VAT rebate as a separate bonus on top. Sequential channel ladder; the market band is applied to the base, so every channel varies by market.
            </p>
            {(data?.channels ?? []).some((c) => c.approvalRequired) && (
              <p className="text-[10px] text-amber-400/80 mt-1">Amber <b>pure margin</b> = below the level&apos;s minimum-margin floor (approval needed) — the floor governs pure margin, so you can never price down to live on the refund.</p>
            )}
          </div>

          {/* Key markets regional FOB */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPinIcon className="h-4 w-4 text-[var(--text-dim)]" />
              <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">End-user price across key markets</h4>
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
              Change them there and this recalculates. The factory cost comes from the Cost Price field above.
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
