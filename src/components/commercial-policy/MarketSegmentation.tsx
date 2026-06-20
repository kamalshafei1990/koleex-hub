"use client";

/* ---------------------------------------------------------------------------
   MarketSegmentation — the "which country sits in which market band" editor
   for Commercial Setup → Market Bands. Renders every world country grouped
   under its assigned band (read mode), and lets a policy admin reassign any
   country to another band via an inline picker (edit mode). Writes the full
   map through PUT /api/commercial-policy/band-countries.

   Country master list (249 entries w/ flags + default bands) comes from
   src/lib/commercial-policy/countries.ts. Effective band for a country =
   the saved DB assignment if present, else the country's default band
   letter matched to the tenant's band whose `code` matches.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import type { MarketBandRow, BandCountryRow } from "@/lib/server/commercial-policy";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

const UNASSIGNED = "__none__";

function fmtPct(n: number): string {
  if (n === 0) return "0%";
  return `${n > 0 ? "+" : ""}${n}%`;
}

export default function MarketSegmentation({
  bands,
  countries,
  canEdit,
  onSaved,
}: {
  bands: MarketBandRow[];
  countries: BandCountryRow[];
  canEdit: boolean;
  onSaved: (fresh: BandCountryRow[]) => void;
}) {
  const activeBands = useMemo(
    () => [...bands].filter((b) => b.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [bands],
  );
  const bandByCode = useMemo(() => {
    const m = new Map<string, MarketBandRow>();
    for (const b of bands) m.set(b.code.toUpperCase(), b);
    return m;
  }, [bands]);
  const bandById = useMemo(() => {
    const m = new Map<string, MarketBandRow>();
    for (const b of bands) m.set(b.id, b);
    return m;
  }, [bands]);

  /* Effective assignment: saved DB row wins; else the country's default
     band letter mapped to a tenant band; else unassigned. */
  const effective = useMemo(() => {
    const saved = new Map<string, string>();
    for (const c of countries) saved.set(c.country_code.toUpperCase(), c.band_id);
    const m = new Map<string, string>();
    for (const c of COUNTRIES) {
      const fromDb = saved.get(c.code.toUpperCase());
      if (fromDb && bandById.has(fromDb)) { m.set(c.code, fromDb); continue; }
      const def = c.band ? bandByCode.get(c.band.toUpperCase()) : undefined;
      m.set(c.code, def ? def.id : UNASSIGNED);
    }
    return m;
  }, [countries, bandById, bandByCode]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Map<string, string>>(effective);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const map = editing ? draft : effective;

  const begin = () => { setDraft(new Map(effective)); setError(null); setEditing(true); };
  const cancel = () => { setEditing(false); setSearch(""); setError(null); };
  const setCountry = (code: string, bandId: string) =>
    setDraft((d) => { const n = new Map(d); n.set(code, bandId); return n; });

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    const rows = Array.from(draft.entries())
      .filter(([, bid]) => bid && bid !== UNASSIGNED)
      .map(([country_code, band_id]) => ({ country_code, band_id }));
    try {
      const res = await fetch("/api/commercial-policy/band-countries", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; bandCountries?: BandCountryRow[] };
      if (!res.ok) { setError(json.error || `Save failed (${res.status})`); return; }
      onSaved(json.bandCountries ?? []);
      setEditing(false);
      setSearch("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved]);

  /* Group countries by their (effective/draft) band for display. */
  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const groups = new Map<string, typeof COUNTRIES>();
    for (const c of COUNTRIES) {
      if (needle && !(`${c.name} ${c.code} ${c.region}`.toLowerCase().includes(needle))) continue;
      const key = map.get(c.code) ?? UNASSIGNED;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    return groups;
  }, [map, search]);

  const totalAssigned = useMemo(
    () => Array.from(effective.values()).filter((v) => v !== UNASSIGNED).length,
    [effective],
  );

  /* Render order: active bands in sort order, then unassigned. */
  const order: { key: string; band: MarketBandRow | null }[] = [
    ...activeBands.map((b) => ({ key: b.id, band: b })),
    { key: UNASSIGNED, band: null },
  ];

  return (
    <section className="scroll-mt-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Country Segmentation</h2>
          <p className="text-[11px] text-[var(--text-dim)] mt-1">
            Which market band each country belongs to. The price engine reads this to apply the band&apos;s
            adjustment. {totalAssigned} of {COUNTRIES.length} countries assigned.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing && canEdit && (
            <button
              type="button"
              onClick={begin}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
            >
              Manage
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wide border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon size={14} />}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="relative mb-4">
          <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a country, code, or region (Egypt, EG, Africa…)"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
          />
        </div>

        <div className="space-y-5">
          {order.map(({ key, band }) => {
            const list = grouped.get(key) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                    {band ? `Band ${band.code}` : "Unassigned"}
                  </h3>
                  <span className="text-[11px] text-[var(--text-dim)]">
                    {band ? (
                      <>
                        {band.label ?? band.name} · <span className="text-[var(--text-primary)] font-medium">{fmtPct(band.adjustment_percent)}</span>
                      </>
                    ) : (
                      "No band — engine applies no market adjustment"
                    )}{" "}
                    · {list.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {list.map((c) => (
                    <div
                      key={c.code}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[15px] leading-none">{c.flag}</span>
                        <span className="text-[12px] text-[var(--text-primary)] truncate">{c.name}</span>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono shrink-0">{c.code}</span>
                      </span>
                      {editing ? (
                        <select
                          value={draft.get(c.code) ?? UNASSIGNED}
                          onChange={(e) => setCountry(c.code, e.target.value)}
                          className="shrink-0 h-7 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] px-1.5 outline-none focus:border-[var(--border-strong)]"
                        >
                          {activeBands.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.code} ({fmtPct(b.adjustment_percent)})
                            </option>
                          ))}
                          <option value={UNASSIGNED}>—</option>
                        </select>
                      ) : (
                        band && (
                          <span className="shrink-0 text-[11px] font-medium text-[var(--text-dim)] tabular-nums">
                            {fmtPct(band.adjustment_percent)}
                          </span>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Array.from(grouped.values()).every((l) => l.length === 0) && (
            <p className="py-10 text-center text-[13px] text-[var(--text-dim)]">
              No countries match &ldquo;{search}&rdquo;.
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
      </div>
    </section>
  );
}
