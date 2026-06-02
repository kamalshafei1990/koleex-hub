"use client";

/* ---------------------------------------------------------------------------
   RegistryBrowser — the Database → Visual Registry section.

   Browses the KOLEEX business structure (Division → Category → Subcategory →
   Product System) as a card-based drill-down, with a live deterministic
   intelligence panel (coverage / DNA / readiness / gaps) for the selected
   scope, plus a global Coverage dashboard (per-division health + missing
   assets). Reuses the Quality/DNA/Registry engines — no new analysis logic.
   KOLEEX dark / minimal. Apple/Figma feel, not ERP tables.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import type { RegistryCoverage, RegistryIntelligence } from "@/lib/visual-library/types";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface Node { id: string; name: string; description?: string | null; visual_style?: string | null; approval_state?: string;
  category_count?: number; subcategory_count?: number; system_count?: number; asset_link_count?: number; system_type?: string; complexity_level?: string }

const toneText = (n: number) => n >= 80 ? "text-emerald-400" : n >= 55 ? "text-amber-400" : "text-rose-400";
const barCls = (n: number) => n >= 80 ? "bg-emerald-400" : n >= 55 ? "bg-amber-400" : "bg-rose-400";

export default function RegistryBrowser() {
  const [view, setView] = useState<"browse" | "coverage">("browse");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5">
        {(["browse", "coverage"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${view === v ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
            {v === "browse" ? "Browse structure" : "Coverage dashboard"}
          </button>
        ))}
      </div>
      {view === "browse" ? <BrowseView /> : <CoverageDashboard />}
    </div>
  );
}

/* ═══ Browse: drill-down + scope intelligence ═══ */
function BrowseView() {
  const [div, setDiv] = useState<Node | null>(null);
  const [cat, setCat] = useState<Node | null>(null);
  const [sub, setSub] = useState<Node | null>(null);

  const [divisions, setDivisions] = useState<Node[]>([]);
  const [cats, setCats] = useState<Node[]>([]);
  const [subs, setSubs] = useState<Node[]>([]);
  const [systems, setSystems] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/visual-registry/divisions", { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { divisions: [] }).then((j) => setDivisions(j.divisions ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setCat(null); setSub(null); setCats([]); setSubs([]); setSystems([]);
    if (!div) return;
    fetch(`/api/visual-registry/categories?division_id=${div.id}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { categories: [] }).then((j) => setCats(j.categories ?? [])).catch(() => {});
  }, [div]);
  useEffect(() => {
    setSub(null); setSubs([]); setSystems([]);
    if (!cat) return;
    fetch(`/api/visual-registry/subcategories?category_id=${cat.id}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { subcategories: [] }).then((j) => setSubs(j.subcategories ?? [])).catch(() => {});
  }, [cat]);
  useEffect(() => {
    setSystems([]);
    if (!sub) return;
    fetch(`/api/visual-registry/systems?subcategory_id=${sub.id}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { systems: [] }).then((j) => setSystems(j.systems ?? [])).catch(() => {});
  }, [sub]);

  const scope = sub ? { scope: "subcategory" as const, id: sub.id, name: sub.name }
    : cat ? { scope: "category" as const, id: cat.id, name: cat.name }
    : div ? { scope: "division" as const, id: div.id, name: div.name } : null;

  const level = sub ? "systems" : cat ? "subcategories" : div ? "categories" : "divisions";
  const list = level === "systems" ? systems : level === "subcategories" ? subs : level === "categories" ? cats : divisions;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        {/* Breadcrumb */}
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-[12px]">
          <Crumb label="Divisions" active={!div} onClick={() => { setDiv(null); }} />
          {div && <><Sep /><Crumb label={div.name} active={!cat} onClick={() => setCat(null)} /></>}
          {cat && <><Sep /><Crumb label={cat.name} active={!sub} onClick={() => setSub(null)} /></>}
          {sub && <><Sep /><Crumb label={sub.name} active onClick={() => {}} /></>}
        </nav>

        {loading ? (
          <div className="flex justify-center py-16 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-12 text-center text-[12.5px] text-[var(--text-dim)]">
            {level === "systems" ? "No product systems under this subcategory yet." : level === "categories" ? "No categories in this division yet." : level === "subcategories" ? "No subcategories in this category yet." : "No divisions yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {list.map((n) => {
              const clickable = level !== "systems";
              const childCount = n.category_count ?? n.subcategory_count ?? n.system_count;
              return (
                <button key={n.id} type="button" disabled={!clickable}
                  onClick={() => { if (level === "divisions") setDiv(n); else if (level === "categories") setCat(n); else if (level === "subcategories") setSub(n); }}
                  className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-left transition-colors ${clickable ? "hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]" : "cursor-default"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">{n.name}</span>
                    {level === "systems" && n.system_type && <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-[var(--text-dim)]">{n.system_type}</span>}
                  </div>
                  {n.description && <p className="mt-1 line-clamp-2 text-[11.5px] text-[var(--text-dim)]">{n.description}</p>}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
                    {n.visual_style && <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5">{n.visual_style}</span>}
                    {childCount !== undefined && <span className="tabular-nums">{childCount} {level === "divisions" ? "categories" : level === "categories" ? "subcategories" : "systems"}</span>}
                    {n.asset_link_count !== undefined && <span className="tabular-nums">· {n.asset_link_count} assets</span>}
                    {level === "systems" && n.complexity_level && <span>· {n.complexity_level} complexity</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Intelligence panel for selected scope */}
      <div>{scope ? <ScopePanel key={`${scope.scope}:${scope.id}`} scope={scope.scope} id={scope.id} name={scope.name} /> : (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-6 text-center text-[12px] text-[var(--text-dim)]">
          Select a division to see its coverage, DNA purity, readiness and gaps.
        </div>
      )}</div>
    </div>
  );
}

function ScopePanel({ scope, id, name }: { scope: "division" | "category" | "subcategory"; id: string; name: string }) {
  const [data, setData] = useState<{ coverage: RegistryCoverage; intelligence: RegistryIntelligence } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/visual-registry/coverage?scope=${scope}&id=${id}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : null).then((j) => setData(j)).catch(() => {}).finally(() => setLoading(false));
  }, [scope, id]);

  if (loading) return <div className="flex justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 text-[var(--text-dim)]"><SpinnerIcon size={16} className="animate-spin" /></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[12px] text-[var(--text-dim)]">No intelligence.</div>;
  const { coverage: c, intelligence: i } = data;

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between">
        <div><div className="text-[13px] font-semibold text-[var(--text-primary)]">{name}</div><div className="text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">{scope}</div></div>
        <div className="text-right"><div className={`text-[24px] font-bold tabular-nums ${toneText(i.health)}`}>{i.health}</div><div className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">health</div></div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="Coverage" value={c.coverage_score} />
        <Stat label="DNA purity" value={i.dna_purity} />
        <Stat label="Consistency" value={i.visual_consistency} />
        <Stat label="Readability" value={i.readability} />
        <Stat label="Duplicate exposure" value={i.duplicate_exposure} invert />
        <Stat label="Style drift" value={i.style_drift} invert />
      </div>

      <div>
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Readiness</div>
        <Bar label="UI" value={i.ui_readiness} /><Bar label="ERP" value={i.erp_readiness} />
        <Bar label="Website" value={i.website_readiness} /><Bar label="Product page" value={i.product_page_readiness} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)]"><span>Systems coverage</span><span className="tabular-nums text-[var(--text-muted)]">{c.systems_covered}/{c.systems_total}</span></div>
        {c.systems_missing.length > 0 && <div className="flex flex-wrap gap-1">{c.systems_missing.slice(0, 8).map((s) => <span key={s} className="rounded-full border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">{s}</span>)}</div>}
      </div>

      {c.roles.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Roles covered</div>
          <div className="flex flex-wrap gap-1">{c.roles.map((r) => <span key={r.role} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{r.role.replace(/-/g, " ")} · {r.count}</span>)}</div>
        </div>
      )}

      {i.notes.length > 0 && (
        <div className="space-y-1">
          {i.notes.map((n, k) => <div key={k} className="flex items-start gap-1.5 rounded-lg border border-amber-500/15 bg-amber-500/5 px-2 py-1 text-[10.5px] text-amber-300/90"><span className="mt-px">›</span><span>{n}</span></div>)}
        </div>
      )}
    </div>
  );
}

/* ═══ Coverage dashboard (global) ═══ */
function CoverageDashboard() {
  const [health, setHealth] = useState<{ divisions: Node2[]; global: Record<string, number> } | null>(null);
  const [missing, setMissing] = useState<{ missing_systems: { id: string; name: string; subcategory: string | null }[]; empty_subcategories: { id: string; name: string; category: string | null }[]; counts: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/visual-registry/health", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
      fetch("/api/visual-registry/missing-assets", { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([h, m]) => { setHealth(h); setMissing(m); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>;

  const g = health?.global ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <GCard label="Global health" value={g.health} />
        <GCard label="Coverage" value={g.coverage_score} />
        <GCard label="Consistency" value={g.design_consistency} />
        <GCard label="UI ready" value={g.ui_readiness} />
        <GCard label="ERP ready" value={g.erp_readiness} />
        <GCard label="Website ready" value={g.website_readiness} />
        <GCard label="Product page" value={g.product_page_readiness} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
        <table className="w-full border-collapse text-left">
          <thead><tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">
            <th className="px-3 py-2 font-medium">Division</th><th className="px-3 py-2 font-medium">Health</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Coverage</th><th className="hidden px-3 py-2 font-medium md:table-cell">DNA</th>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">Assets</th><th className="hidden px-3 py-2 font-medium lg:table-cell">Missing systems</th>
          </tr></thead>
          <tbody>
            {(health?.divisions ?? []).map((d) => (
              <tr key={d.id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-3 py-2 text-[12.5px] text-[var(--text-primary)]">{d.name}</td>
                <td className="px-3 py-2"><MiniBar value={d.health} /></td>
                <td className="hidden px-3 py-2 sm:table-cell"><MiniBar value={d.coverage_score} /></td>
                <td className="hidden px-3 py-2 md:table-cell"><span className={`text-[12px] tabular-nums ${toneText(d.dna_purity)}`}>{d.dna_purity}</span></td>
                <td className="hidden px-3 py-2 tabular-nums text-[12px] text-[var(--text-muted)] lg:table-cell">{d.total_assets}</td>
                <td className="hidden px-3 py-2 tabular-nums text-[12px] lg:table-cell"><span className={d.missing_systems > 0 ? "text-amber-400" : "text-[var(--text-dim)]"}>{d.missing_systems}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <GapCard title="Product systems with no visual asset" count={missing?.counts?.missing_systems ?? 0}
          items={(missing?.missing_systems ?? []).map((s) => ({ id: s.id, primary: s.name, secondary: s.subcategory }))} />
        <GapCard title="Subcategories with no linked assets" count={missing?.counts?.empty_subcategories ?? 0}
          items={(missing?.empty_subcategories ?? []).map((s) => ({ id: s.id, primary: s.name, secondary: s.category }))} />
      </div>
    </div>
  );
}
interface Node2 { id: string; name: string; health: number; coverage_score: number; dna_purity: number; total_assets: number; missing_systems: number }

/* ── primitives ── */
function Crumb({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`max-w-[180px] truncate ${active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>{label}</button>;
}
function Sep() { return <span className="text-[var(--text-dim)]">›</span>; }
function Stat({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const good = invert ? value <= 30 : value >= 70; const mid = invert ? value <= 60 : value >= 50;
  const cls = good ? "text-emerald-400" : mid ? "text-amber-400" : "text-rose-400";
  return <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5"><span className="text-[var(--text-dim)]">{label}</span><span className={`font-semibold tabular-nums ${cls}`}>{value}</span></div>;
}
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text-muted)]">{label}</span><span className="tabular-nums text-[var(--text-dim)]">{value}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-full rounded-full ${barCls(value)}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}
function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-full rounded-full ${barCls(value)}`} style={{ width: `${value}%` }} /></div>
      <span className={`text-[11.5px] tabular-nums ${toneText(value)}`}>{value}</span>
    </div>
  );
}
function GCard({ label, value }: { label: string; value: number | undefined }) {
  return <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5"><div className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{label}</div><div className={`mt-1 text-[22px] font-bold tabular-nums ${toneText(value ?? 0)}`}>{value ?? "—"}</div></div>;
}
function GapCard({ title, count, items }: { title: string; count: number; items: { id: string; primary: string; secondary: string | null }[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex items-center justify-between"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h4><span className={`text-[12px] font-semibold tabular-nums ${count > 0 ? "text-amber-400" : "text-emerald-400"}`}>{count}</span></div>
      {items.length === 0 ? <p className="text-[11.5px] text-[var(--text-dim)]">None — fully covered.</p> : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[11.5px]">
              <span className="truncate text-[var(--text-primary)]">{it.primary}</span>
              {it.secondary && <span className="shrink-0 text-[10.5px] text-[var(--text-dim)]">{it.secondary}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
