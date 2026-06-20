"use client";

/* ---------------------------------------------------------------------------
   MarketProfileDrawer — the per-country market profile that opens when a user
   clicks a country in Country Segmentation. Mirrors the global-system mock:
   identity (flag · band · adjustment), Market Overview (band / adjustment /
   region / currency / dial code), Customers in this Market (live, matched by
   country name), and future-ready analytics placeholders.

   A policy admin can re-band the market right here via the band picker, which
   PATCHes /api/commercial-policy/band-countries for this single country.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Country } from "@/lib/commercial-policy/countries";
import type { MarketBandRow, BandCountryRow } from "@/lib/server/commercial-policy";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const UNASSIGNED = "__none__";

interface CustomerLite {
  id: string;
  name: string;
  company_name: string | null;
  country: string | null;
  customer_type: string | null;
  status: string | null;
}

function fmtPct(n: number): string {
  if (n === 0) return "0%";
  return `${n > 0 ? "+" : ""}${n}%`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="text-[13px] text-[var(--text-primary)] mt-0.5">{value}</div>
    </div>
  );
}

export default function MarketProfileDrawer({
  country,
  bands,
  currentBandId,
  canEdit,
  onClose,
  onBandSaved,
}: {
  country: Country;
  bands: MarketBandRow[];
  currentBandId: string; // band id or UNASSIGNED
  canEdit: boolean;
  onClose: () => void;
  onBandSaved: (fresh: BandCountryRow[]) => void;
}) {
  const activeBands = useMemo(
    () => [...bands].filter((b) => b.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [bands],
  );
  const [bandId, setBandId] = useState(currentBandId);
  const [savingBand, setSavingBand] = useState(false);
  const [bandErr, setBandErr] = useState<string | null>(null);

  const band = activeBands.find((b) => b.id === bandId) ?? null;

  const [customers, setCustomers] = useState<CustomerLite[] | null>(null);
  const [custErr, setCustErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customers", { credentials: "include" });
        if (!res.ok) { if (!cancelled) setCustErr(`Couldn't load customers (${res.status})`); return; }
        const json = (await res.json()) as { customers?: CustomerLite[] };
        if (cancelled) return;
        const needle = country.name.toLowerCase();
        const inMarket = (json.customers ?? []).filter(
          (c) => (c.country ?? "").toLowerCase().trim() === needle,
        );
        setCustomers(inMarket);
      } catch (e) {
        if (!cancelled) setCustErr(e instanceof Error ? e.message : "Network error");
      }
    })();
    return () => { cancelled = true; };
  }, [country.name]);

  const changeBand = useCallback(async (next: string) => {
    const prev = bandId;
    setBandId(next);
    setSavingBand(true);
    setBandErr(null);
    try {
      const res = await fetch("/api/commercial-policy/band-countries", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_code: country.code, band_id: next === UNASSIGNED ? null : next }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; bandCountries?: BandCountryRow[] };
      if (!res.ok) { setBandErr(json.error || `Save failed (${res.status})`); setBandId(prev); return; }
      onBandSaved(json.bandCountries ?? []);
    } catch (e) {
      setBandErr(e instanceof Error ? e.message : "Network error");
      setBandId(prev);
    } finally {
      setSavingBand(false);
    }
  }, [bandId, country.code, onBandSaved]);

  const activeCount = customers?.filter((c) => (c.status ?? "active") === "active").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full overflow-y-auto bg-[var(--bg-secondary)] border-l border-[var(--border-subtle)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[28px] leading-none">{country.flag}</span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold text-[var(--text-primary)] truncate">{country.name}</h2>
              <p className="text-[12px] text-[var(--text-dim)]">
                {band ? `Band ${band.code} · ${fmtPct(band.adjustment_percent)}` : "Unassigned · no market adjustment"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition"
          >
            <CrossIcon size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Market Overview */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MapPinIcon className="h-4 w-4 text-[var(--text-dim)]" />
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Market Overview</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Band picker (editable) */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
                  Market Band {savingBand && <SpinnerIcon className="h-3 w-3 animate-spin" />}
                </div>
                {canEdit ? (
                  <select
                    value={bandId}
                    onChange={(e) => changeBand(e.target.value)}
                    disabled={savingBand}
                    className="mt-1 w-full h-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] px-2 outline-none focus:border-[var(--border-strong)] disabled:opacity-50"
                  >
                    {activeBands.map((b) => (
                      <option key={b.id} value={b.id}>Band {b.code} ({fmtPct(b.adjustment_percent)})</option>
                    ))}
                    <option value={UNASSIGNED}>Unassigned</option>
                  </select>
                ) : (
                  <div className="text-[13px] text-[var(--text-primary)] mt-0.5">{band ? `Band ${band.code}` : "Unassigned"}</div>
                )}
              </div>
              <Field label="Adjustment %" value={band ? fmtPct(band.adjustment_percent) : "—"} />
              <Field label="Region" value={country.region || "—"} />
              <Field label="Currency" value={country.currency || "—"} />
              <Field label="Dial code" value={country.dialCode || "—"} />
              <Field label="ISO code" value={<span className="font-mono">{country.code}</span>} />
            </div>
            {bandErr && <p className="mt-2 text-[12px] text-red-400">{bandErr}</p>}
            {band?.label && (
              <p className="mt-2 text-[11px] text-[var(--text-dim)]">{band.label}{band.description ? ` — ${band.description}` : ""}</p>
            )}
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-2 gap-2">
            <Field label="Total Customers" value={customers == null ? "…" : customers.length} />
            <Field label="Active Customers" value={customers == null ? "…" : activeCount} />
            <Field label="Total Sales" value={<span className="text-[var(--text-dim)]">—</span>} />
            <Field label="Avg Order Value" value={<span className="text-[var(--text-dim)]">—</span>} />
          </section>

          {/* Customers in this market */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <UsersIcon className="h-4 w-4 text-[var(--text-dim)]" />
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Customers in this Market</h3>
            </div>
            {custErr ? (
              <p className="text-[12px] text-[var(--text-dim)]">{custErr}</p>
            ) : customers == null ? (
              <div className="flex items-center gap-2 py-6 text-[var(--text-dim)] text-[13px]">
                <SpinnerIcon className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : customers.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--text-dim)] border border-dashed border-[var(--border-subtle)] rounded-xl">
                No customers linked to this market yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {customers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[13px] text-[var(--text-primary)] truncate">{c.name}</div>
                      {c.company_name && <div className="text-[11px] text-[var(--text-dim)] truncate">{c.company_name}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.customer_type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)] capitalize">{c.customer_type}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${(c.status ?? "active") === "active" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
                        {c.status ?? "active"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-[11px] text-[var(--text-dim)] border-t border-[var(--border-subtle)] pt-3">
            Sales, revenue trend and order analytics for this market activate once orders are linked to customers in this country.
          </p>
        </div>
      </div>
    </div>
  );
}
