"use client";

/* ---------------------------------------------------------------------------
   Sourcing Command Center — tenant-wide procurement intelligence workspace.

   Read-only intelligence (computed live by /api/suppliers/sourcing/overview)
   plus saved views / watchlists (persisted). Monochrome, operational,
   scan-first — A. global health · B. category matrix · C. dependency heat ·
   D. ranking board (sort + filter + compare) · E. recommendations · F. saved
   views & watchlists. Desktop + mobile parity; fits the viewport width.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SuppliersNav from "./SuppliersNav";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import NetworkIcon from "@/components/icons/ui/NetworkIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import BookmarkIcon from "@/components/icons/ui/BookmarkIcon";
import Globe2Icon from "@/components/icons/ui/Globe2Icon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";

/* ── types mirror the overview API ── */
interface Overview { totalSuppliers: number; activeSuppliers: number; preferredSuppliers: number; blockedSuppliers: number; highRiskSuppliers: number; soleSourceSuppliers: number; missingCerts: number; avgSourcingScore: number | null; avgNegotiationScore: number | null; avgReadiness: number | null; }
interface CategoryRow { category: string; supplierCount: number; preferred: number; approved: number; blocked: number; avgLeadTime: number | null; avgSourcingScore: number | null; backupMissing: boolean; supplierIds: string[]; }
interface Concentration { country: string; count: number; pct: number; }
interface Signal { key: string; severity: "warning" | "critical"; title: string; detail: string; supplierId?: string; }
interface Rec { id: string; type: string; severity: "info" | "warning" | "critical"; title: string; detail: string; supplierId?: string; visibility: string; }
interface BoardRow { id: string; name: string; country: string | null; active: boolean; strategicStatus: string | null; sourcingScore: number | null; readiness: number | null; negotiationScore: number | null; riskLevel: string | null; trustLevel: string | null; certsActive: number; leadTime: string | null; moq: string | null; preferred: number; blocked: number; }
interface OverviewPayload { overview: Overview; categories: CategoryRow[]; concentration: Concentration[]; dependencies: Signal[]; recommendations: Rec[]; suppliers: BoardRow[]; callerTier: string; }
interface Watchlist { id: string; name: string; kind: string; description: string | null; filters: Record<string, unknown>; supplier_ids: string[]; visibility_tier: string; created_at: string; }

type SortKey = "sourcingScore" | "readiness" | "negotiationScore" | "certsActive" | "riskLevel";
const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SORTS: { key: SortKey; label: string }[] = [
  { key: "sourcingScore", label: "Sourcing" },
  { key: "readiness", label: "Readiness" },
  { key: "negotiationScore", label: "Negotiation" },
  { key: "certsActive", label: "Certs" },
  { key: "riskLevel", label: "Risk" },
];

const num = (v: number | null) => (v == null ? "—" : String(v));
const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ── small presentational primitives (monochrome) ── */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{children}</div>;
}
function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{hint}</div> : null}
    </div>
  );
}
function SectionHeader({ icon, title, sub, right }: { icon: React.ReactNode; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-secondary)]">{icon}</span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
          {sub ? <p className="text-[11px] text-[var(--text-secondary)]">{sub}</p> : null}
        </div>
      </div>
      {right}
    </div>
  );
}
function SevTag({ sev }: { sev: "info" | "warning" | "critical" }) {
  const label = sev === "critical" ? "Critical" : sev === "warning" ? "Attention" : "Info";
  const weight = sev === "critical" ? "border-[var(--text-primary)] text-[var(--text-primary)]" : sev === "warning" ? "border-[var(--border-strong)] text-[var(--text-secondary)]" : "border-[var(--border-subtle)] text-[var(--text-faint)]";
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${weight}`}>{label}</span>;
}

export default function SourcingCommandCenter() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ranking board controls
  const [sortKey, setSortKey] = useState<SortKey>("sourcingScore");
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // watchlists
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [wlName, setWlName] = useState("");
  const [wlBusy, setWlBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [ov, wl] = await Promise.all([
        fetch("/api/suppliers/sourcing/overview", { cache: "no-store" }),
        fetch("/api/suppliers/sourcing/watchlists", { cache: "no-store" }),
      ]);
      if (!ov.ok) throw new Error((await ov.json().catch(() => ({}))).error || "Failed to load command center");
      setData(await ov.json());
      if (wl.ok) setWatchlists((await wl.json()).watchlists ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const board = useMemo(() => {
    if (!data) return [];
    let rows = [...data.suppliers];
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.country || "").toLowerCase().includes(q));
    if (riskFilter) rows = rows.filter((r) => r.riskLevel === riskFilter);
    if (preferredOnly) rows = rows.filter((r) => r.preferred > 0);
    rows.sort((a, b) => {
      if (sortKey === "riskLevel") return (RISK_RANK[a.riskLevel ?? ""] ?? 9) - (RISK_RANK[b.riskLevel ?? ""] ?? 9);
      const av = a[sortKey] as number | null, bv = b[sortKey] as number | null;
      return (bv == null ? -1 : bv) - (av == null ? -1 : av);
    });
    return rows;
  }, [data, query, riskFilter, preferredOnly, sortKey]);

  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selRows = useMemo(() => (data ? data.suppliers.filter((r) => selected.includes(r.id)) : []), [data, selected]);

  const createWatchlist = useCallback(async () => {
    if (!wlName.trim()) return;
    setWlBusy(true);
    try {
      const res = await fetch("/api/suppliers/sourcing/watchlists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wlName.trim(), kind: "watchlist", supplier_ids: selected, filters: { query, riskFilter, preferredOnly, sortKey } }),
      });
      if (res.ok) { setWlName(""); setShowCreate(false); const wl = await fetch("/api/suppliers/sourcing/watchlists", { cache: "no-store" }); if (wl.ok) setWatchlists((await wl.json()).watchlists ?? []); }
    } finally { setWlBusy(false); }
  }, [wlName, selected, query, riskFilter, preferredOnly, sortKey]);

  const deleteWatchlist = useCallback(async (id: string) => {
    await fetch(`/api/suppliers/sourcing/watchlists/${id}`, { method: "DELETE" });
    setWatchlists((w) => w.filter((x) => x.id !== id));
  }, []);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-[var(--text-secondary)]"><SpinnerIcon className="h-5 w-5 animate-spin" /><span className="ml-2 text-sm">Loading command center…</span></div>;
  }
  if (err || !data) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <TriangleWarningIcon className="mx-auto h-6 w-6 text-[var(--text-secondary)]" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{err || "No data available."}</p>
        <button onClick={() => void load()} className="mt-4 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]">Retry</button>
      </div>
    );
  }

  const o = data.overview;
  const isMgmt = data.callerTier === "management";

  return (
    <>
    <SuppliersNav active="sourcing" />
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]"><GaugeIcon className="h-5 w-5" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">Procurement Intelligence</span></div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Sourcing Command Center</h1>
        <p className="text-[12px] text-[var(--text-secondary)]">{o.activeSuppliers} active suppliers · {data.categories.length} categories · viewing as <span className="font-medium text-[var(--text-primary)]">{titleCase(data.callerTier)}</span></p>
      </div>

      {/* A. Global procurement overview — grouped for scannability */}
      <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div>
          <GroupLabel>Portfolio</GroupLabel>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Active" value={o.activeSuppliers} hint={`${o.totalSuppliers} total`} />
            <StatCard label="Preferred" value={o.preferredSuppliers} />
            <StatCard label="Blocked" value={o.blockedSuppliers} />
          </div>
        </div>
        <div>
          <GroupLabel>Risk exposure</GroupLabel>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="High risk" value={o.highRiskSuppliers} />
            <StatCard label="Sole-source" value={o.soleSourceSuppliers} hint="no backup" />
            <StatCard label="Missing certs" value={o.missingCerts} />
          </div>
        </div>
        <div>
          <GroupLabel>Average scores</GroupLabel>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Sourcing" value={num(o.avgSourcingScore)} />
            <StatCard label="Negotiation" value={num(o.avgNegotiationScore)} />
            <StatCard label="Readiness" value={num(o.avgReadiness)} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* B. Category sourcing matrix */}
        <section className="lg:col-span-2">
          <SectionHeader icon={<LayersIcon className="h-4 w-4" />} title="Category sourcing matrix" sub="Coverage, roles, and backup posture per category" />
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <th className="px-4 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 text-center font-semibold">Suppliers</th>
                    <th className="px-3 py-2 text-center font-semibold">Pref</th>
                    <th className="px-3 py-2 text-center font-semibold">Block</th>
                    <th className="px-3 py-2 text-center font-semibold">Lead</th>
                    <th className="px-3 py-2 text-center font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--text-faint)]">No categorised supplier links yet.</td></tr>
                  ) : data.categories.map((c) => (
                    <tr key={c.category} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/suppliers?category=${encodeURIComponent(c.category)}`} className="font-medium text-[var(--text-primary)] hover:underline">{titleCase(c.category)}</Link>
                        {c.backupMissing ? <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]"><TriangleWarningIcon className="h-3 w-3" />no backup</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{c.supplierCount}</td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{c.preferred}</td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{c.blocked}</td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{c.avgLeadTime == null ? "—" : `${c.avgLeadTime}d`}</td>
                      <td className="px-3 py-2.5 text-center font-medium text-[var(--text-primary)]">{num(c.avgSourcingScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* C. Dependency & concentration heat */}
        <section>
          <SectionHeader icon={<NetworkIcon className="h-4 w-4" />} title="Dependency & concentration" sub="Single-source and geographic exposure" />
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]"><Globe2Icon className="h-3.5 w-3.5" />Country concentration</div>
              {data.concentration.length === 0 ? <p className="text-[12px] text-[var(--text-faint)]">No country data.</p> : data.concentration.slice(0, 6).map((c) => (
                <div key={c.country} className="mb-1.5 last:mb-0">
                  <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--text-primary)]">{c.country}</span><span className="text-[var(--text-secondary)]">{c.count} · {c.pct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]"><div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${c.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {data.dependencies.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--text-faint)]">No dependency warnings — coverage looks healthy.</div>
              ) : data.dependencies.map((d) => (
                <div key={d.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">{d.title}</p>
                    <SevTag sev={d.severity} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{d.detail}</p>
                  {d.supplierId ? <Link href={`/suppliers/${d.supplierId}`} className="mt-1 inline-block text-[11px] font-medium text-[var(--text-primary)] hover:underline">Open supplier →</Link> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* D. Supplier ranking board */}
      <section className="mt-8">
        <SectionHeader
          icon={<ScaleIcon className="h-4 w-4" />}
          title="Supplier ranking board"
          sub="Sort, filter, and compare suppliers across sourcing signals"
          right={
            <button onClick={() => { setCompareMode((v) => !v); setSelected([]); }} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium ${compareMode ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"}`}><ScaleIcon className="h-3.5 w-3.5" />{compareMode ? "Comparing" : "Compare"}</button>
          }
        />
        {/* controls */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or country" className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-9 pr-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none" />
          </div>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none">
            <option value="">All risk</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)]"><input type="checkbox" checked={preferredOnly} onChange={(e) => setPreferredOnly(e.target.checked)} className="accent-[var(--text-primary)]" />Preferred only</label>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
            {SORTS.map((s) => (
              <button key={s.key} onClick={() => setSortKey(s.key)} className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${sortKey === s.key ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* compare strip */}
        {compareMode && selRows.length > 0 ? (
          <div className="mb-3 overflow-x-auto rounded-xl border border-[var(--text-primary)] bg-[var(--bg-surface)] p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Comparing {selRows.length}</span><button onClick={() => setShowCreate(true)} className="text-[11px] font-medium text-[var(--text-primary)] hover:underline">Save as watchlist</button></div>
            <table className="w-full min-w-[520px] text-[12px]">
              <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]"><th className="py-1 pr-3">Supplier</th><th className="px-2 py-1 text-center">Sourcing</th><th className="px-2 py-1 text-center">Readiness</th><th className="px-2 py-1 text-center">Nego</th><th className="px-2 py-1 text-center">Risk</th><th className="px-2 py-1 text-center">Certs</th></tr></thead>
              <tbody>{selRows.map((r) => (<tr key={r.id} className="border-t border-[var(--border-subtle)]"><td className="py-1.5 pr-3 font-medium text-[var(--text-primary)]">{r.name}</td><td className="px-2 py-1.5 text-center">{num(r.sourcingScore)}</td><td className="px-2 py-1.5 text-center">{num(r.readiness)}</td><td className="px-2 py-1.5 text-center">{num(r.negotiationScore)}</td><td className="px-2 py-1.5 text-center">{r.riskLevel ? titleCase(r.riskLevel) : "—"}</td><td className="px-2 py-1.5 text-center">{r.certsActive}</td></tr>))}</tbody>
            </table>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  {compareMode ? <th className="w-8 px-3 py-2" /> : null}
                  <th className="px-4 py-2 font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-center font-semibold">Sourcing</th>
                  <th className="px-3 py-2 text-center font-semibold">Readiness</th>
                  <th className="px-3 py-2 text-center font-semibold">Nego</th>
                  <th className="px-3 py-2 text-center font-semibold">Risk</th>
                  <th className="px-3 py-2 text-center font-semibold">Certs</th>
                  <th className="px-3 py-2 text-center font-semibold">Pref</th>
                </tr>
              </thead>
              <tbody>
                {board.length === 0 ? (
                  <tr><td colSpan={compareMode ? 8 : 7} className="px-4 py-6 text-center text-[var(--text-faint)]">No suppliers match.</td></tr>
                ) : board.map((r, i) => (
                  <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-subtle)]">
                    {compareMode ? <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} className="accent-[var(--text-primary)]" /></td> : null}
                    <td className="px-4 py-2.5">
                      <Link href={`/suppliers/${r.id}`} className="font-medium text-[var(--text-primary)] hover:underline">{i + 1}. {r.name}</Link>
                      <div className="text-[11px] text-[var(--text-faint)]">{r.country || "—"}{r.blocked > 0 ? " · blocked" : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-primary)]">{num(r.sourcingScore)}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{num(r.readiness)}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{num(r.negotiationScore)}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{r.riskLevel ? titleCase(r.riskLevel) : "—"}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{r.certsActive}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{r.preferred}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* E. Procurement insights */}
        <section className="lg:col-span-2">
          <SectionHeader icon={<SparklesIcon className="h-4 w-4" />} title="Procurement insights" sub={`Rule-generated recommendations${isMgmt ? "" : " (procurement view)"}`} />
          {data.recommendations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[12px] text-[var(--text-faint)]">No recommendations — sourcing posture looks balanced.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.recommendations.map((r) => (
                <div key={r.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">{r.title}</p>
                    <SevTag sev={r.severity} />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{r.detail}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">{titleCase(r.type)}</span>
                    {r.supplierId ? <Link href={`/suppliers/${r.supplierId}`} className="text-[11px] font-medium text-[var(--text-primary)] hover:underline">Open →</Link> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* F. Saved views & watchlists */}
        <section>
          <SectionHeader
            icon={<BookmarkIcon className="h-4 w-4" />}
            title="Saved views & watchlists"
            sub="Pin suppliers and save filter states"
            right={<button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"><PlusIcon className="h-3.5 w-3.5" />New</button>}
          />
          {showCreate ? (
            <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <input value={wlName} onChange={(e) => setWlName(e.target.value)} placeholder="Watchlist name" className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none" />
              <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{selected.length > 0 ? `${selected.length} supplier(s) will be followed (from compare selection).` : "Current filters will be saved. Select suppliers in compare mode to follow them."}</p>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setShowCreate(false); setWlName(""); }} className="rounded-lg px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
                <button onClick={() => void createWatchlist()} disabled={!wlName.trim() || wlBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--bg-primary)] disabled:opacity-40">{wlBusy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : null}Save</button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {watchlists.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--text-faint)]">No saved views yet.</div>
            ) : watchlists.map((w) => (
              <div key={w.id} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{w.name}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{w.kind === "view" ? "Saved view" : "Watchlist"}{w.supplier_ids.length ? ` · ${w.supplier_ids.length} followed` : ""}</p>
                </div>
                <button onClick={() => void deleteWatchlist(w.id)} className="shrink-0 rounded-md p-1 text-[var(--text-faint)] hover:text-[var(--text-primary)]" aria-label="Delete"><TrashIcon className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    </>
  );
}
