"use client";

/* ---------------------------------------------------------------------------
   /finance/fx-rates — Manage FX rates + view recent exchanges.

   Shows three blocks:
     · Hero: tenant base currency + most-recent rate per non-base currency
     · Add-rate form (from, to, rate, effective date)
     · Rate table with delete + recent FX exchange operations
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage, ErpPanel, ErpTable,
  type ErpColumn,
} from "@/components/ui/erp/ErpUi";
import RrIcon from "@/components/ui/RrIcon";
import { SmartField, SmartInput, SmartSelect } from "@/components/ui/create/SmartCreate";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";

interface RateRow {
  id: string; from_currency: string; to_currency: string;
  rate: number; effective_date: string; created_at: string; notes: string | null;
}

const CURRENCIES = ["CNY", "USD", "EUR", "GBP", "JPY", "AED", "SAR", "EGP", "HKD"];

function fmtRate(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function fmtDay(iso: string) { return iso.slice(0, 10); }

interface PairUsage {
  pair: string; from_currency: string; to_currency: string;
  has_rate: boolean; rate: number | null; effective_date: string | null;
  stale_days: number | null;
  open_invoice_count: number; open_bill_count: number; open_total_original: number;
}
interface FxStatus {
  base_currency: string;
  pairs: PairUsage[];
  missing_pairs: PairUsage[];
  stale_pairs: PairUsage[];
}

export default function FxRatesManager() {
  const [rates, setRates] = useState<RateRow[]>([]);
  const [status, setStatus] = useState<FxStatus | null>(null);
  /* Base currency comes from the shared cached hook. It feeds both the
     display labels and the "To" select default — once it resolves, the
     form auto-flips from "USD" → tenant base. */
  const baseCurrencyResolved = useBaseCurrencyOptional();
  const baseCurrency = baseCurrencyResolved ?? "";
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  /* Form state */
  const [from, setFrom] = useState("USD");
  const [to, setTo]     = useState<string>("USD");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [toTouched, setToTouched] = useState(false);

  /* As soon as the tenant base resolves, snap the "To" field to it —
     unless the operator has already picked something else. */
  useEffect(() => {
    if (baseCurrencyResolved && !toTouched) setTo(baseCurrencyResolved);
  }, [baseCurrencyResolved, toTouched]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rRes, sRes] = await Promise.all([
        fetch("/api/finance/fx/rates", { cache: "no-store" }),
        fetch("/api/finance/fx/status", { cache: "no-store" }),
      ]);
      const rJ = await rRes.json();
      const sJ = await sRes.json().catch(() => ({}));
      if (!rRes.ok) throw new Error(humanizeError(rJ.error || `HTTP ${rRes.status}`));
      setRates(rJ.rates ?? []);
      if (sJ.status) setStatus(sJ.status as FxStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addRate() {
    if (!rate || Number(rate) <= 0) { setError("Rate must be > 0."); return; }
    if (from.toUpperCase() === to.toUpperCase()) { setError("From and To must differ."); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/finance/fx/rates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_currency: from, to_currency: to,
          rate: Number(rate), effective_date: date, notes: notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setRate(""); setNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function deleteRate(id: string) {
    if (!window.confirm("Delete this FX rate?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/finance/fx/rates?id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  /* Latest rate per pair (group by from→to). */
  const latestByPair = useMemo(() => {
    const map = new Map<string, RateRow>();
    for (const r of rates) {
      const key = `${r.from_currency}→${r.to_currency}`;
      const cur = map.get(key);
      if (!cur || cur.effective_date < r.effective_date) map.set(key, r);
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.from_currency}${a.to_currency}`.localeCompare(`${b.from_currency}${b.to_currency}`));
  }, [rates]);

  const columns: Array<ErpColumn<RateRow>> = [
    { key: "pair", header: "Pair", render: (r) => <span className="font-mono">{r.from_currency} → {r.to_currency}</span> },
    { key: "rate", header: "Rate", align: "right", render: (r) => fmtRate(r.rate) },
    { key: "eff",  header: "Effective", render: (r) => fmtDay(r.effective_date) },
    { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
    { key: "act",  header: "", align: "right", render: (r) => (
      <button type="button" onClick={() => deleteRate(r.id)}
              className="rounded-md border border-rose-300/30 bg-rose-300/[0.06] px-2 py-0.5 text-[10.5px] text-rose-200 hover:bg-rose-300/[0.10]">
        Delete
      </button>
    ) },
  ];

  return (
    <ErpPage
      title="Exchange Rates"
      subtitle={`Main operating currency: ${baseCurrency}`}
      icon="balance-scale-left"
      backHref="/finance/workspace"
      action={
        <Link href="/finance/setup?card=fx-rates"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="info" size={12} /> About FX
        </Link>
      }
    >
      {error && <div className="rounded-md border border-rose-300/40 bg-rose-300/[0.06] px-3 py-2 text-[12px] text-rose-200">{error}</div>}

      {/* Status — pairs in use + missing + stale */}
      {status && (status.missing_pairs.length > 0 || status.stale_pairs.length > 0 || status.pairs.length > 0) && (
        <section>
          <ErpEyebrow>FX coverage status</ErpEyebrow>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            {/* Missing required pairs */}
            {status.missing_pairs.length > 0 ? (
              <ErpPanel className="border-rose-300/40 bg-rose-300/[0.05] px-4 py-3">
                <div className="flex items-center gap-2 text-[11.5px] text-rose-200">
                  <RrIcon name="cross-circle" size={12} /> Missing rates
                </div>
                <div className="mt-2 space-y-1.5">
                  {status.missing_pairs.map((p) => (
                    <div key={p.pair} className="flex items-baseline justify-between text-[11.5px]">
                      <span className="font-mono">{p.from_currency} → {p.to_currency}</span>
                      <span className="text-[10.5px] text-gray-400">
                        used by {p.open_invoice_count + p.open_bill_count} open doc{p.open_invoice_count + p.open_bill_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-rose-200/80">
                  Add a rate row below — without it, base-amount conversions fall back to 1:1.
                </div>
              </ErpPanel>
            ) : (
              <ErpPanel className="px-4 py-3">
                <div className="flex items-center gap-2 text-[11.5px] text-emerald-200">
                  <RrIcon name="check" size={12} /> All exposed pairs configured
                </div>
                <div className="mt-2 text-[10.5px] text-gray-500">
                  Every non-base currency in use has a rate row.
                </div>
              </ErpPanel>
            )}
            {/* Stale rates */}
            {status.stale_pairs.length > 0 ? (
              <ErpPanel className="border-amber-300/40 bg-amber-300/[0.05] px-4 py-3">
                <div className="flex items-center gap-2 text-[11.5px] text-amber-200">
                  <RrIcon name="clock" size={12} /> Stale rates (&gt;14d)
                </div>
                <div className="mt-2 space-y-1.5">
                  {status.stale_pairs.map((p) => (
                    <div key={p.pair} className="flex items-baseline justify-between text-[11.5px]">
                      <span className="font-mono">{p.from_currency} → {p.to_currency}</span>
                      <span className="text-[10.5px] text-gray-400">{p.stale_days}d ago</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-amber-200/80">
                  Update with the latest mid-market rate to keep conversions accurate.
                </div>
              </ErpPanel>
            ) : (
              <ErpPanel className="px-4 py-3">
                <div className="flex items-center gap-2 text-[11.5px] text-emerald-200">
                  <RrIcon name="check" size={12} /> Rates fresh
                </div>
                <div className="mt-2 text-[10.5px] text-gray-500">
                  Every configured rate is within 14 days.
                </div>
              </ErpPanel>
            )}
            {/* Used by open documents */}
            <ErpPanel className="px-4 py-3">
              <div className="flex items-center gap-2 text-[11.5px] text-gray-300">
                <RrIcon name="signal-stream" size={12} /> Open exposure
              </div>
              <div className="mt-2 space-y-1.5">
                {status.pairs.length === 0 ? (
                  <div className="text-[10.5px] text-gray-500">No non-base currency open documents.</div>
                ) : status.pairs.slice(0, 5).map((p) => (
                  <div key={p.pair} className="flex items-baseline justify-between text-[11.5px]">
                    <span className="font-mono">{p.from_currency}</span>
                    <span className="text-[10.5px] text-gray-400">
                      {p.open_invoice_count} inv · {p.open_bill_count} bill
                    </span>
                  </div>
                ))}
              </div>
            </ErpPanel>
          </div>
        </section>
      )}

      {/* Hero — latest rate per pair */}
      <section>
        <ErpEyebrow>Latest rate per pair</ErpEyebrow>
        {latestByPair.length === 0 ? (
          <ErpPanel className="mt-2 px-4 py-6 text-center text-[12px] text-gray-500">
            No rates configured yet. Add one below — a Chinese tenant typically wants <span className="font-mono">USD → CNY</span>.
          </ErpPanel>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {latestByPair.map((r) => (
              <ErpPanel key={r.id} className="px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{r.from_currency} → {r.to_currency}</div>
                <div className="mt-1 font-mono text-[20px] leading-none tabular-nums">{fmtRate(r.rate)}</div>
                <div className="mt-1 text-[10px] text-gray-500">eff {fmtDay(r.effective_date)}</div>
              </ErpPanel>
            ))}
          </div>
        )}
      </section>

      {/* Add new rate */}
      <section>
        <ErpEyebrow>Add rate</ErpEyebrow>
        <ErpPanel className="mt-2 px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SmartField label="From">
              <SmartSelect value={from} onChange={(e) => setFrom(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SmartSelect>
            </SmartField>
            <SmartField label="To">
              <SmartSelect value={to} onChange={(e) => { setTo(e.target.value); setToTouched(true); }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SmartSelect>
            </SmartField>
            <SmartField label="Rate" required hint="1 unit of From = ? units of To">
              <SmartInput type="number" step="0.0001" min="0" value={rate}
                          onChange={(e) => setRate(e.target.value)} placeholder="7.25" />
            </SmartField>
            <SmartField label="Effective" required>
              <SmartInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </SmartField>
            <SmartField label="Notes">
              <SmartInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="(optional)" />
            </SmartField>
          </div>
          <div className="mt-3 flex items-center justify-end">
            <button type="button" disabled={busy} onClick={addRate}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14] disabled:opacity-50">
              <RrIcon name={busy ? "loading" : "plus"} size={12} />
              {busy ? "Saving…" : "Save rate"}
            </button>
          </div>
          <div className="mt-2 text-[10.5px] text-gray-500">
            Tip: as a Chinese tenant your base is <span className="font-mono">CNY</span>.
            Add <span className="font-mono">USD → CNY</span> so customer payments in USD convert correctly when posted.
          </div>
        </ErpPanel>
      </section>

      {/* Full table */}
      <section>
        <ErpEyebrow>All rates</ErpEyebrow>
        {loading ? (
          <div className="px-1 py-3 text-[12px] text-gray-500">Loading…</div>
        ) : (
          <ErpTable<RateRow>
            rows={rates}
            columns={columns}
            rowKey={(r) => r.id}
            empty="No rates yet."
          />
        )}
      </section>
      <ErpHairline />
    </ErpPage>
  );
}
