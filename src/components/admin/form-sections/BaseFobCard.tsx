"use client";

/* ---------------------------------------------------------------------------
   BaseFobCard — the country-agnostic "base FOB" derived from the Cost Price.

   cost (CNY) → net internal (uplift) → auto product level → base margin
             → Global FOB (USD)

   Runs the live policy engine via /api/products/price-preview (base block
   only; market/channel live in the FOB Pricing card below). Synced to
   Commercial Setup — change a level's cost band or margin and this moves.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";

interface Base {
  factoryCostCny: number;
  netInternalCostCny: number;
  netInternalCostUsd: number;
  productLevelCode: string | null;
  productLevelName: string | null;
  baseMarginPercent: number | null;
  minMarginFloorPercent: number | null;
  globalFobUsd: number | null;
}

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cny = (n: number | null | undefined) =>
  n == null ? "—" : `¥${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function BaseFobCard({
  costCny,
  currency,
}: {
  costCny: number | null;
  currency?: string | null;
}) {
  const isCny = !currency || currency.toUpperCase() === "CNY";
  const cost = costCny && costCny > 0 ? costCny : 0;
  const [base, setBase] = useState<Base | null>(null);
  const [uplift, setUplift] = useState(0);
  const [fx, setFx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isCny || cost <= 0) { setBase(null); return; }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setLoading(true); setErr(null);
      fetch(`/api/products/price-preview?cost_cny=${encodeURIComponent(cost)}`, { credentials: "include" })
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as { base?: Base; error?: string; reason?: string; costUpliftPercent?: number; fxCnyPerUsd?: number };
          if (r.status === 403) { setErr(j.reason || "Commercial Policy access required."); setBase(null); return; }
          if (!j.base) { setErr(j.error || "Couldn't compute the base FOB."); setBase(null); return; }
          setBase(j.base); setUplift(j.costUpliftPercent ?? 0); setFx(j.fxCnyPerUsd ?? null);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Network error"))
        .finally(() => setLoading(false));
    }, 350);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [cost, isCny]);

  if (!isCny) {
    return <Note>Set the cost in <b>CNY</b> to derive the base FOB.</Note>;
  }
  if (cost <= 0) {
    return <Note>Enter the <b>Cost Price</b> above — the base FOB is derived automatically from the product level.</Note>;
  }
  if (err) {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[12px] text-amber-300/90 flex items-start gap-2">
        <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" /> {err}
      </div>
    );
  }
  if (!base) {
    return <div className="flex items-center gap-2 py-6 text-[var(--text-dim)] text-[13px]"><SpinnerIcon className="h-4 w-4 animate-spin" /> Computing…</div>;
  }

  const steps = [
    { k: "Factory cost", v: cny(base.factoryCostCny), sub: "CNY" },
    { k: "Net internal", v: cny(base.netInternalCostCny), sub: `+${uplift}% uplift · ${usd(base.netInternalCostUsd)}` },
    { k: base.productLevelCode ? `Level ${base.productLevelCode}` : "Level", v: `+${base.baseMarginPercent ?? 0}%`, sub: `${base.productLevelName ?? "margin"}${base.minMarginFloorPercent != null ? ` · floor ${base.minMarginFloorPercent}%` : ""}` },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-3">
      {/* derivation chain */}
      <div className="flex flex-wrap items-stretch gap-1.5 flex-1">
        {steps.map((s, i) => (
          <div key={i} className="flex items-stretch gap-1.5">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 px-3 py-2 min-w-[112px]">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-ghost)] truncate">{s.k}</div>
              <div className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5">{s.v}</div>
              <div className="text-[9px] text-[var(--text-ghost)] truncate">{s.sub}</div>
            </div>
            <div className="flex items-center text-[var(--text-ghost)]"><ArrowRightIcon className="h-3.5 w-3.5" /></div>
          </div>
        ))}
      </div>
      {/* result — the hero number, accent-highlighted so it stands out */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/[0.08] px-5 py-3 flex flex-col justify-center min-w-[200px] ring-1 ring-[var(--accent)]/15">
        {/* accent edge bar */}
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
        <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
          Base FOB (USD) {loading && <SpinnerIcon className="h-3 w-3 animate-spin" />}
        </div>
        <div className="text-[26px] font-black text-[var(--accent)] leading-tight mt-0.5 tabular-nums">{usd(base.globalFobUsd)}</div>
        <div className="text-[10px] text-[var(--text-ghost)]">Global · before market &amp; customer{fx ? ` · fx ¥${fx}/$` : ""}</div>
      </div>
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
