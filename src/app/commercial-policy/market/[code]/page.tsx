"use client";

/* ---------------------------------------------------------------------------
   Market Profile page — /commercial-policy/market/[code]

   Full-page country market profile (opened from Country Segmentation).
   Mirrors the global-system reference: header + Market Actions, a two-column
   Market Overview / Notes block, a 4-KPI row, Customers in this Market, and
   Future-Ready Analytics placeholders. Band is editable in place (single-
   country PATCH on the band-countries API).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate from "@/components/admin/AuthGate";
import { getCountryByCode } from "@/lib/commercial-policy/countries";
import type { MarketBandRow, BandCountryRow } from "@/lib/server/commercial-policy";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

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

export default function MarketProfilePage() {
  return (
    <AuthGate title="Market Profile" subtitle="Country market identity and pricing context">
      <MarketProfileView />
    </AuthGate>
  );
}

function MarketProfileView() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const country = getCountryByCode(code);

  const [bands, setBands] = useState<MarketBandRow[]>([]);
  const [bandCountries, setBandCountries] = useState<BandCountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerLite[] | null>(null);
  const [custSearch, setCustSearch] = useState("");

  const [editingBand, setEditingBand] = useState(false);
  const [savingBand, setSavingBand] = useState(false);
  const [bandErr, setBandErr] = useState<string | null>(null);
  const [engineOn, setEngineOn] = useState<boolean | null>(null);

  /* Policy snapshot → bands + assignments + engine status. */
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const res = await fetch("/api/commercial-policy", { credentials: "include" });
        if (!res.ok) { if (!off) setLoadErr(`Couldn't load policy (${res.status})`); return; }
        const j = (await res.json()) as {
          marketBands?: MarketBandRow[];
          bandCountries?: BandCountryRow[];
          settings?: { use_policy_engine?: boolean } | null;
        };
        if (off) return;
        setBands(j.marketBands ?? []);
        setBandCountries(j.bandCountries ?? []);
        setEngineOn(!!j.settings?.use_policy_engine);
      } catch (e) {
        if (!off) setLoadErr(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, []);

  /* Customers in this market. Country is free text on the customer record,
     so match tolerantly on the country name OR ISO code (trimmed/cased). */
  useEffect(() => {
    if (!country) return;
    let off = false;
    (async () => {
      try {
        const res = await fetch("/api/customers", { credentials: "include" });
        if (!res.ok) { if (!off) setCustomers([]); return; }
        const j = (await res.json()) as { customers?: CustomerLite[] };
        if (off) return;
        const name = country.name.toLowerCase();
        const iso = country.code.toLowerCase();
        setCustomers((j.customers ?? []).filter((c) => {
          const v = (c.country ?? "").toLowerCase().trim();
          return v !== "" && (v === name || v === iso);
        }));
      } catch { if (!off) setCustomers([]); }
    })();
    return () => { off = true; };
  }, [country]);

  const activeBands = useMemo(
    () => [...bands].filter((b) => b.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [bands],
  );
  const bandById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const bandByCode = useMemo(() => new Map(bands.map((b) => [b.code.toUpperCase(), b])), [bands]);

  /* Is this country's band actually persisted (what the engine reads), or
     just a suggested default from the master list (not yet applied)? */
  const isSaved = useMemo(
    () => bandCountries.some((bc) => bc.country_code.toUpperCase() === code && bandById.has(bc.band_id)),
    [bandCountries, code, bandById],
  );

  const effectiveBandId = useMemo(() => {
    const saved = bandCountries.find((bc) => bc.country_code.toUpperCase() === code);
    if (saved && bandById.has(saved.band_id)) return saved.band_id;
    const def = country?.band ? bandByCode.get(country.band.toUpperCase()) : undefined;
    return def ? def.id : UNASSIGNED;
  }, [bandCountries, code, bandById, bandByCode, country]);

  const [bandId, setBandId] = useState<string>(UNASSIGNED);
  useEffect(() => { setBandId(effectiveBandId); }, [effectiveBandId]);
  const band = bandId === UNASSIGNED ? null : bandById.get(bandId) ?? null;

  const saveBand = useCallback(async (next: string) => {
    const prev = bandId;
    setBandId(next);
    setSavingBand(true);
    setBandErr(null);
    try {
      const res = await fetch("/api/commercial-policy/band-countries", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_code: code, band_id: next === UNASSIGNED ? null : next }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; bandCountries?: BandCountryRow[] };
      if (!res.ok) { setBandErr(j.error || `Save failed (${res.status})`); setBandId(prev); return; }
      setBandCountries(j.bandCountries ?? []);
      setEditingBand(false);
    } catch (e) {
      setBandErr(e instanceof Error ? e.message : "Network error"); setBandId(prev);
    } finally { setSavingBand(false); }
  }, [bandId, code]);

  const customersView = useMemo(() => {
    if (!customers) return [];
    const n = custSearch.trim().toLowerCase();
    if (!n) return customers;
    return customers.filter((c) => `${c.name} ${c.company_name ?? ""}`.toLowerCase().includes(n));
  }, [customers, custSearch]);
  const activeCount = customers?.filter((c) => (c.status ?? "active") === "active").length ?? 0;

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full relative"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* Header */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 py-4">
            <Link
              href="/commercial-policy#cp-markets"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <span className="text-[28px] leading-none">{country?.flag ?? "🏳️"}</span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                {country?.name ?? code}
              </h1>
              <p className="text-[12px] text-[var(--text-dim)]">
                {band ? `Band ${band.code} · ${fmtPct(band.adjustment_percent)}` : "Unassigned · no market adjustment"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-28 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-24"><SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
          ) : !country ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-8 text-center text-[13px] text-[var(--text-dim)]">
              Unknown country code &ldquo;{code}&rdquo;. <Link href="/commercial-policy#cp-markets" className="underline">Back to segmentation</Link>.
            </div>
          ) : (
            <>
              {loadErr && <p className="text-[12px] text-red-400">{loadErr}</p>}

              {/* Market Actions */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-4 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-2 mr-1">
                  <MapPinIcon className="h-4 w-4" /> Market Actions
                </span>
                <button
                  type="button"
                  onClick={() => setEditingBand((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-strong)] transition"
                >
                  <PencilIcon className="h-3.5 w-3.5" /> Edit Market
                </button>
                <a
                  href="#customers"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-strong)] transition"
                >
                  <UsersIcon className="h-3.5 w-3.5" /> View Customers
                </a>
                <Link
                  href="/customers"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-lg hover:opacity-90 transition"
                >
                  <UserPlusIcon className="h-3.5 w-3.5" /> Add Customer
                </Link>
              </section>

              {/* Overview + Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <section className="lg:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPinIcon className="h-4 w-4 text-[var(--text-dim)]" />
                    <h2 className="text-[14px] font-semibold">Market Overview</h2>
                  </div>
                  <p className="text-[12px] text-[var(--text-dim)] mb-4">Core market identity and pricing context.</p>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[22px]">{country.flag}</span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold truncate">{country.name}</div>
                        <div className="text-[11px] text-[var(--text-dim)]">{band ? `Band ${band.code} · ${fmtPct(band.adjustment_percent)}` : "Unassigned"}</div>
                      </div>
                    </div>
                    {editingBand ? (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={bandId}
                          onChange={(e) => saveBand(e.target.value)}
                          disabled={savingBand}
                          className="h-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] px-2 outline-none focus:border-[var(--border-strong)] disabled:opacity-50"
                        >
                          {activeBands.map((b) => <option key={b.id} value={b.id}>Band {b.code} ({fmtPct(b.adjustment_percent)})</option>)}
                          <option value={UNASSIGNED}>Unassigned</option>
                        </select>
                        {savingBand ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <CheckIcon size={14} className="text-[var(--text-dim)]" />}
                      </span>
                    ) : (
                      <span className={`text-[10px] px-2 py-1 rounded-full shrink-0 ${
                        !band
                          ? "border border-[var(--border-subtle)] text-[var(--text-dim)]"
                          : isSaved
                            ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                            : "border border-amber-500/40 text-amber-400"
                      }`}>
                        {!band ? "No band" : isSaved ? "Saved" : "Default — not saved"}
                      </span>
                    )}
                  </div>
                  {bandErr && <p className="text-[12px] text-red-400 mb-3">{bandErr}</p>}

                  {/* Honest sync status: what does this band actually drive? */}
                  <div className={`text-[11px] mb-4 rounded-lg px-3 py-2 ${
                    !isSaved
                      ? "bg-amber-500/[0.08] text-amber-300/90 border border-amber-500/20"
                      : "bg-[var(--bg-primary)] text-[var(--text-dim)] border border-[var(--border-subtle)]"
                  }`}>
                    {!isSaved
                      ? "Suggested default from the country list — not saved yet. Click Edit Market and choose a band to store it."
                      : engineOn
                        ? "Saved and applied: the pricing-policy engine uses this band for quotes in this market."
                        : "Saved. The pricing-policy engine is currently OFF (manual pricing), so this isn't auto-applied to prices yet — turn it on in Commercial Setup → Settings. Note: the standalone Price Calculator uses its own country table and is not driven by this."}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <OverviewField label="Band" value={band ? `Band ${band.code}` : "—"} />
                    <OverviewField label="Adjustment %" value={band ? fmtPct(band.adjustment_percent) : "—"} />
                    <OverviewField label="Region" value={country.region || "—"} />
                    <OverviewField label="Currency" value={country.currency || "—"} />
                    <OverviewField label="Dial code" value={country.dialCode || "—"} />
                    <OverviewField label="ISO code" value={<span className="font-mono">{country.code}</span>} />
                  </div>
                  {band?.label && (
                    <p className="mt-3 text-[11px] text-[var(--text-dim)]">{band.label}{band.description ? ` — ${band.description}` : ""}</p>
                  )}
                </section>

                <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <FileIcon className="h-4 w-4 text-[var(--text-dim)]" />
                    <h2 className="text-[14px] font-semibold">Market Notes &amp; Strategy</h2>
                  </div>
                  <p className="text-[12px] text-[var(--text-dim)] mb-4">Internal pricing remarks, market risk, and strategy notes.</p>
                  <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-10 text-center text-[12px] text-[var(--text-dim)]">
                    No notes yet. Per-market notes storage is on the roadmap.
                  </div>
                </section>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Total Customers" value={customers == null ? "…" : String(customers.length)} />
                <Kpi label="Active Customers" value={customers == null ? "…" : String(activeCount)} />
                <Kpi label="Total Sales" value="—" muted />
                <Kpi label="Average Order Value" value="—" muted />
              </div>

              {/* Customers */}
              <section id="customers" className="scroll-mt-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                <div className="flex items-center gap-2 mb-1">
                  <UsersIcon className="h-4 w-4 text-[var(--text-dim)]" />
                  <h2 className="text-[14px] font-semibold">Customers in this Market</h2>
                </div>
                <p className="text-[12px] text-[var(--text-dim)] mb-4">All customer accounts linked to this market.</p>
                <div className="relative mb-4">
                  <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
                  <input
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                    placeholder="Search customers…"
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
                {customers == null ? (
                  <div className="flex items-center gap-2 py-6 text-[var(--text-dim)] text-[13px]"><SpinnerIcon className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : customersView.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-[var(--text-dim)] border border-dashed border-[var(--border-subtle)] rounded-xl">
                    No customers linked to this market.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {customersView.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[13px] truncate">{c.name}</div>
                          {c.company_name && <div className="text-[11px] text-[var(--text-dim)] truncate">{c.company_name}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.customer_type && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)] capitalize">{c.customer_type}</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${(c.status ?? "active") === "active" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>{c.status ?? "active"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Future-ready analytics */}
              <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
                <h2 className="text-[14px] font-semibold mb-1">Future-Ready Analytics</h2>
                <p className="text-[12px] text-[var(--text-dim)] mb-4">Activates once orders are linked to customers in this market.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {["Top Products in this Market", "Sales Trend", "Revenue by Period", "Order Count"].map((t) => (
                    <div key={t} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
                      <div className="text-[12px] font-semibold mb-1">{t}</div>
                      <div className="text-[15px] text-[var(--text-dim)]">No data available</div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="text-[13px] text-[var(--text-primary)] mt-0.5">{value}</div>
    </div>
  );
}

function Kpi({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className={`text-[22px] font-bold mt-1 ${muted ? "text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{value}</div>
    </div>
  );
}
