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
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import SuppliersHeader from "./SuppliersHeader";
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
    <div className="flex min-h-[96px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase leading-tight tracking-[0.14em] text-[var(--text-faint)]">{label}</div>
      <div className="mt-auto text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</div>
      <div className="min-h-[14px] text-[11px] leading-tight text-[var(--text-secondary)]">{hint ?? ""}</div>
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
function SevTag({ sev, label }: { sev: "info" | "warning" | "critical"; label: string }) {
  const weight = sev === "critical" ? "border-[var(--text-primary)] text-[var(--text-primary)]" : sev === "warning" ? "border-[var(--border-strong)] text-[var(--text-secondary)]" : "border-[var(--border-subtle)] text-[var(--text-faint)]";
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${weight}`}>{label}</span>;
}

export default function SourcingCommandCenter() {
  const { t } = useTranslation(contactsT);
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
    return <div className="flex min-h-[60vh] items-center justify-center text-[var(--text-secondary)]"><SpinnerIcon className="h-5 w-5 animate-spin" /><span className="ml-2 text-sm">{t("scc.loading", "Loading command center…")}</span></div>;
  }
  if (err || !data) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <TriangleWarningIcon className="mx-auto h-6 w-6 text-[var(--text-secondary)]" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{err || t("scc.noData", "No data available.")}</p>
        <button onClick={() => void load()} className="mt-4 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]">{t("scc.retry", "Retry")}</button>
      </div>
    );
  }

  const o = data.overview;
  const isMgmt = data.callerTier === "management";
  const sevLabel = (sev: "info" | "warning" | "critical") =>
    sev === "critical" ? t("scc.sevCritical", "Critical") : sev === "warning" ? t("scc.sevAttention", "Attention") : t("scc.sevInfo", "Info");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
      <SuppliersHeader
        title={t("scc.title", "Sourcing Command Center")}
        subtitle={`${o.activeSuppliers} ${t("scc.activeSuppliers", "active suppliers")} · ${data.categories.length} ${t("scc.categories", "categories")} · ${t("scc.viewingAs", "viewing as")} ${titleCase(data.callerTier)}`}
      />

      <div className="mt-6">
      {/* A. Global procurement overview — one aligned grid, grouped by label */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <div className="col-span-3"><GroupLabel>{t("scc.portfolio", "Portfolio")}</GroupLabel></div>
        <StatCard label={t("scc.active", "Active")} value={o.activeSuppliers} hint={`${o.totalSuppliers} ${t("scc.total", "total")}`} />
        <StatCard label={t("scc.preferred", "Preferred")} value={o.preferredSuppliers} />
        <StatCard label={t("scc.blocked", "Blocked")} value={o.blockedSuppliers} />
        <div className="col-span-3 mt-2"><GroupLabel>{t("scc.riskExposure", "Risk exposure")}</GroupLabel></div>
        <StatCard label={t("scc.highRisk", "High risk")} value={o.highRiskSuppliers} />
        <StatCard label={t("scc.soleSource", "Sole-source")} value={o.soleSourceSuppliers} hint={t("scc.noBackupHint", "no backup")} />
        <StatCard label={t("scc.missingCerts", "Missing certs")} value={o.missingCerts} />
        <div className="col-span-3 mt-2"><GroupLabel>{t("scc.averageScores", "Average scores")}</GroupLabel></div>
        <StatCard label={t("scc.sourcing", "Sourcing")} value={num(o.avgSourcingScore)} />
        <StatCard label={t("scc.negotiation", "Negotiation")} value={num(o.avgNegotiationScore)} />
        <StatCard label={t("scc.readiness", "Readiness")} value={num(o.avgReadiness)} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* B. Category sourcing matrix */}
        <section className="lg:col-span-2">
          <SectionHeader icon={<LayersIcon className="h-4 w-4" />} title={t("scc.categoryMatrixTitle", "Category sourcing matrix")} sub={t("scc.categoryMatrixSub", "Coverage, roles, and backup posture per category")} />
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-0 text-sm sm:min-w-[480px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <th className="px-4 py-2 font-semibold">{t("scc.thCategory", "Category")}</th>
                    <th className="px-3 py-2 text-center font-semibold">{t("scc.thSuppliers", "Suppliers")}</th>
                    <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">{t("scc.thPref", "Pref")}</th>
                    <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">{t("scc.thBlock", "Block")}</th>
                    <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">{t("scc.thLead", "Lead")}</th>
                    <th className="px-3 py-2 text-center font-semibold">{t("scc.thScore", "Score")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--text-faint)]">{t("scc.noCategories", "No categorised supplier links yet.")}</td></tr>
                  ) : data.categories.map((c) => (
                    <tr key={c.category} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/suppliers?category=${encodeURIComponent(c.category)}`} className="font-medium text-[var(--text-primary)] hover:underline">{titleCase(c.category)}</Link>
                        {c.backupMissing ? <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]"><TriangleWarningIcon className="h-3 w-3" />{t("scc.noBackup", "no backup")}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{c.supplierCount}</td>
                      <td className="hidden px-3 py-2.5 text-center text-[var(--text-secondary)] sm:table-cell">{c.preferred}</td>
                      <td className="hidden px-3 py-2.5 text-center text-[var(--text-secondary)] sm:table-cell">{c.blocked}</td>
                      <td className="hidden px-3 py-2.5 text-center text-[var(--text-secondary)] sm:table-cell">{c.avgLeadTime == null ? "—" : `${c.avgLeadTime}d`}</td>
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
          <SectionHeader icon={<NetworkIcon className="h-4 w-4" />} title={t("scc.dependencyTitle", "Dependency & concentration")} sub={t("scc.dependencySub", "Single-source and geographic exposure")} />
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]"><Globe2Icon className="h-3.5 w-3.5" />{t("scc.countryConcentration", "Country concentration")}</div>
              {data.concentration.length === 0 ? <p className="text-[12px] text-[var(--text-faint)]">{t("scc.noCountryData", "No country data.")}</p> : data.concentration.slice(0, 6).map((c) => (
                <div key={c.country} className="mb-1.5 last:mb-0">
                  <div className="flex items-center justify-between text-[12px]"><span className="text-[var(--text-primary)]">{c.country}</span><span className="text-[var(--text-secondary)]">{c.count} · {c.pct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]"><div className="h-full rounded-full bg-[var(--text-secondary)]" style={{ width: `${c.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {data.dependencies.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--text-faint)]">{t("scc.noDependencyWarnings", "No dependency warnings — coverage looks healthy.")}</div>
              ) : data.dependencies.map((d) => (
                <div key={d.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">{d.title}</p>
                    <SevTag sev={d.severity} label={sevLabel(d.severity)} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{d.detail}</p>
                  {d.supplierId ? <Link href={`/suppliers/${d.supplierId}`} className="mt-1 inline-block text-[11px] font-medium text-[var(--text-primary)] hover:underline">{t("scc.openSupplier", "Open supplier →")}</Link> : null}
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
          title={t("scc.rankingBoardTitle", "Supplier ranking board")}
          sub={t("scc.rankingBoardSub", "Sort, filter, and compare suppliers across sourcing signals")}
          right={
            <button onClick={() => { setCompareMode((v) => !v); setSelected([]); }} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium ${compareMode ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"}`}><ScaleIcon className="h-3.5 w-3.5" />{compareMode ? t("scc.comparing", "Comparing") : t("scc.compare", "Compare")}</button>
          }
        />
        {/* controls */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("scc.searchPlaceholder", "Search name or country")} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-9 pr-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none" />
          </div>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none">
            <option value="">{t("scc.allRisk", "All risk")}</option><option value="low">{t("opt.low", "Low")}</option><option value="medium">{t("opt.medium", "Medium")}</option><option value="high">{t("opt.high", "High")}</option><option value="critical">{t("opt.critical", "Critical")}</option>
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)]"><input type="checkbox" checked={preferredOnly} onChange={(e) => setPreferredOnly(e.target.checked)} className="accent-[var(--text-primary)]" />{t("scc.preferredOnly", "Preferred only")}</label>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
            {SORTS.map((s) => (
              <button key={s.key} onClick={() => setSortKey(s.key)} className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${sortKey === s.key ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{t("scc." + s.key, s.label)}</button>
            ))}
          </div>
        </div>

        {/* compare strip */}
        {compareMode && selRows.length > 0 ? (
          <div className="mb-3 overflow-x-auto rounded-xl border border-[var(--text-primary)] bg-[var(--bg-surface)] p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{t("scc.comparing", "Comparing")} {selRows.length}</span><button onClick={() => setShowCreate(true)} className="text-[11px] font-medium text-[var(--text-primary)] hover:underline">{t("scc.saveAsWatchlist", "Save as watchlist")}</button></div>
            <table className="w-full min-w-[520px] text-[12px]">
              <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]"><th className="py-1 pr-3">{t("scc.thSupplier", "Supplier")}</th><th className="px-2 py-1 text-center">{t("scc.sourcing", "Sourcing")}</th><th className="px-2 py-1 text-center">{t("scc.readiness", "Readiness")}</th><th className="px-2 py-1 text-center">{t("scc.thNego", "Nego")}</th><th className="px-2 py-1 text-center">{t("scc.thRisk", "Risk")}</th><th className="px-2 py-1 text-center">{t("scc.thCerts", "Certs")}</th></tr></thead>
              <tbody>{selRows.map((r) => (<tr key={r.id} className="border-t border-[var(--border-subtle)]"><td className="py-1.5 pr-3 font-medium text-[var(--text-primary)]">{r.name}</td><td className="px-2 py-1.5 text-center">{num(r.sourcingScore)}</td><td className="px-2 py-1.5 text-center">{num(r.readiness)}</td><td className="px-2 py-1.5 text-center">{num(r.negotiationScore)}</td><td className="px-2 py-1.5 text-center">{r.riskLevel ? t("opt." + r.riskLevel, titleCase(r.riskLevel)) : "—"}</td><td className="px-2 py-1.5 text-center">{r.certsActive}</td></tr>))}</tbody>
            </table>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 text-sm sm:min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  {compareMode ? <th className="w-8 px-3 py-2" /> : null}
                  <th className="px-4 py-2 font-semibold">{t("scc.thSupplier", "Supplier")}</th>
                  <th className="px-3 py-2 text-center font-semibold">{t("scc.sourcing", "Sourcing")}</th>
                  <th className="px-3 py-2 text-center font-semibold">{t("scc.readiness", "Readiness")}</th>
                  <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">{t("scc.thNego", "Nego")}</th>
                  <th className="px-3 py-2 text-center font-semibold">{t("scc.thRisk", "Risk")}</th>
                  <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">{t("scc.thCerts", "Certs")}</th>
                  <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">{t("scc.thPref", "Pref")}</th>
                </tr>
              </thead>
              <tbody>
                {board.length === 0 ? (
                  <tr><td colSpan={compareMode ? 8 : 7} className="px-4 py-6 text-center text-[var(--text-faint)]">{t("scc.noSuppliersMatch", "No suppliers match.")}</td></tr>
                ) : board.map((r, i) => (
                  <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface-subtle)]">
                    {compareMode ? <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} className="accent-[var(--text-primary)]" /></td> : null}
                    <td className="px-4 py-2.5">
                      <Link href={`/suppliers/${r.id}`} className="font-medium text-[var(--text-primary)] hover:underline">{i + 1}. {r.name}</Link>
                      <div className="text-[11px] text-[var(--text-faint)]">{r.country || "—"}{r.blocked > 0 ? ` · ${t("scc.blockedSuffix", "blocked")}` : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-primary)]">{num(r.sourcingScore)}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{num(r.readiness)}</td>
                    <td className="hidden px-3 py-2.5 text-center text-[var(--text-secondary)] sm:table-cell">{num(r.negotiationScore)}</td>
                    <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{r.riskLevel ? t("opt." + r.riskLevel, titleCase(r.riskLevel)) : "—"}</td>
                    <td className="hidden px-3 py-2.5 text-center text-[var(--text-secondary)] sm:table-cell">{r.certsActive}</td>
                    <td className="hidden px-3 py-2.5 text-center text-[var(--text-secondary)] sm:table-cell">{r.preferred}</td>
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
          <SectionHeader icon={<SparklesIcon className="h-4 w-4" />} title={t("scc.insightsTitle", "Procurement insights")} sub={`${t("scc.insightsSub", "Rule-generated recommendations")}${isMgmt ? "" : ` ${t("scc.procurementView", "(procurement view)")}`}`} />
          {data.recommendations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[12px] text-[var(--text-faint)]">{t("scc.noRecommendations", "No recommendations — sourcing posture looks balanced.")}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.recommendations.map((r) => (
                <div key={r.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">{r.title}</p>
                    <SevTag sev={r.severity} label={sevLabel(r.severity)} />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{r.detail}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]">{titleCase(r.type)}</span>
                    {r.supplierId ? <Link href={`/suppliers/${r.supplierId}`} className="text-[11px] font-medium text-[var(--text-primary)] hover:underline">{t("scc.open", "Open →")}</Link> : null}
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
            title={t("scc.savedViewsTitle", "Saved views & watchlists")}
            sub={t("scc.savedViewsSub", "Pin suppliers and save filter states")}
            right={<button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"><PlusIcon className="h-3.5 w-3.5" />{t("scc.new", "New")}</button>}
          />
          {showCreate ? (
            <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <input value={wlName} onChange={(e) => setWlName(e.target.value)} placeholder={t("scc.watchlistNamePlaceholder", "Watchlist name")} className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none" />
              <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{selected.length > 0 ? `${selected.length} ${t("scc.suppliersWillBeFollowed", "supplier(s) will be followed (from compare selection).")}` : t("scc.currentFiltersSaved", "Current filters will be saved. Select suppliers in compare mode to follow them.")}</p>
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setShowCreate(false); setWlName(""); }} className="rounded-lg px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("scc.cancel", "Cancel")}</button>
                <button onClick={() => void createWatchlist()} disabled={!wlName.trim() || wlBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--bg-primary)] disabled:opacity-40">{wlBusy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : null}{t("scc.save", "Save")}</button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {watchlists.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--text-faint)]">{t("scc.noSavedViews", "No saved views yet.")}</div>
            ) : watchlists.map((w) => (
              <div key={w.id} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{w.name}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{w.kind === "view" ? t("scc.savedView", "Saved view") : t("scc.watchlist", "Watchlist")}{w.supplier_ids.length ? ` · ${w.supplier_ids.length} ${t("scc.followed", "followed")}` : ""}</p>
                </div>
                <button onClick={() => void deleteWatchlist(w.id)} className="shrink-0 rounded-md p-1 text-[var(--text-faint)] hover:text-[var(--text-primary)]" aria-label={t("scc.delete", "Delete")}><TrashIcon className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
