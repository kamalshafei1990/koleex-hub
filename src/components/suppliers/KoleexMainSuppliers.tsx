"use client";

/* ---------------------------------------------------------------------------
   Koleex Main Suppliers — a visual sourcing-coverage board.

   A strategic map (NOT a table): Division → Category → Subcategory → the
   suppliers that cover it, with sourcing roles + coverage-health intelligence.

   Taxonomy is read at runtime from /api/suppliers/taxonomy (the Supabase
   divisions/categories/subcategories tables the admin edits), so adding or
   renaming a category/subcategory — or swapping an icon — shows up here. The
   only new persistence is the thin supplier_coverage assignment join.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import SuppliersHeader from "./SuppliersHeader";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import { taxonomyLogoUrl } from "@/components/knowledge/product-coding/taxonomy-logo";
import {
  indexCoverage, computeCoverageHealth, coverageNodeKey,
  COVERAGE_ROLES, type CoverageRole, type CoverageRow, type CoverageHealthStatus,
  type TaxonomyDivision,
} from "@/lib/suppliers/coverage";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import FileIcon from "@/components/icons/ui/FileIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";

/* ── role label + tone (monochrome; rose only for blocked) ── */
function roleLabel(t: (k: string, f?: string) => string, role: CoverageRole): string {
  return t("cov.role." + role, role.charAt(0).toUpperCase() + role.slice(1));
}
const roleTextClass = (role: CoverageRole) =>
  role === "blocked" ? "text-rose-500"
  : role === "preferred" ? "text-[var(--text-primary)] font-semibold"
  : "text-[var(--text-faint)]";

const HEALTH_TONE: Record<CoverageHealthStatus, { dot: string; text: string; ring: string }> = {
  healthy:  { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/25" },
  warning:  { dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",     ring: "ring-amber-500/25" },
  critical: { dot: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400",       ring: "ring-rose-500/25" },
  none:     { dot: "bg-[var(--text-ghost)]", text: "text-[var(--text-faint)]",       ring: "ring-[var(--border-subtle)]" },
};
const riskDot = (risk: string | null) =>
  risk === "low" ? "bg-emerald-500" : risk === "medium" ? "bg-amber-500" : (risk === "high" || risk === "critical") ? "bg-rose-500" : "";

interface PickerSupplier { id: string; name: string; logo: string | null }
interface PickerSub { code: string; label: string }   // `code` carries the effective coverage key
interface PickerTarget {
  divisionSlug: string;
  categorySlug: string;
  categoryLabel: string;
  subcategories: PickerSub[];   // all subcategories of the category (the choices)
  presetCode?: string;          // the subcategory the user clicked "Add" on (pre-selected)
}
interface CatalogTarget { url: string; name: string }

/* Session cache so repeat visits paint instantly (stale-while-revalidate). */
const COV_CACHE = "kx:sup:coverage";
const TAX_CACHE = "kx:sup:taxonomy";
function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try { const r = window.sessionStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
}
function writeCache(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* quota — ignore */ }
}

export default function KoleexMainSuppliers() {
  const { t } = useTranslation(contactsT);
  const router = useRouter();

  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [tree, setTree] = useState<TaxonomyDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [collapsedDiv, setCollapsedDiv] = useState<Set<string>>(new Set());
  const [collapsedCat, setCollapsedCat] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [catalog, setCatalog] = useState<CatalogTarget | null>(null);
  const didInitCollapse = useRef(false);

  const byNode = useMemo(() => indexCoverage(rows), [rows]);

  // First paint: collapse every division with no coverage so the board opens
  // focused on what's mapped (and renders fewer cards). Runs once.
  const applyCollapseInit = useCallback((cov: CoverageRow[], tax: TaxonomyDivision[]) => {
    if (didInitCollapse.current || tax.length === 0) return;
    didInitCollapse.current = true;
    const covered = new Set(cov.map((r) => r.division_slug));
    const liveWithCoverage = tax.filter((d) => d.categories.length > 0 && covered.has(d.id));
    const firstLive = tax.find((x) => x.categories.length > 0)?.id;
    const toCollapse = new Set(
      tax.filter((d) => d.categories.length > 0 && (liveWithCoverage.length > 0 ? !covered.has(d.id) : d.id !== firstLive)).map((d) => d.id),
    );
    setCollapsedDiv(toCollapse);
  }, []);

  const load = useCallback(async () => {
    // Stale-while-revalidate: paint cached data instantly, then refresh.
    const cachedCov = readCache<CoverageRow[]>(COV_CACHE);
    const cachedTax = readCache<TaxonomyDivision[]>(TAX_CACHE);
    const hadCache = Array.isArray(cachedCov) && Array.isArray(cachedTax);
    if (hadCache) {
      setRows(cachedCov!); setTree(cachedTax!); applyCollapseInit(cachedCov!, cachedTax!); setLoading(false);
    } else {
      setLoading(true);
    }
    setErr(null);
    try {
      const [covRes, taxRes] = await Promise.all([
        fetch("/api/suppliers/coverage", { credentials: "include", cache: "no-store" }),
        fetch("/api/suppliers/taxonomy", { credentials: "include", cache: "no-store" }),
      ]);
      if (!covRes.ok || !taxRes.ok) throw new Error(`${covRes.status}/${taxRes.status}`);
      const covJson = (await covRes.json()) as { coverage: CoverageRow[] };
      const taxJson = (await taxRes.json()) as { divisions: TaxonomyDivision[] };
      const cov = Array.isArray(covJson.coverage) ? covJson.coverage : [];
      const tax = Array.isArray(taxJson.divisions) ? taxJson.divisions : [];
      setRows(cov); setTree(tax);
      writeCache(COV_CACHE, cov); writeCache(TAX_CACHE, tax);
      applyCollapseInit(cov, tax);
    } catch {
      if (!hadCache) setErr(t("cov.loadError", "Couldn't load the sourcing map. Please retry."));
    } finally { setLoading(false); }
  }, [t, applyCollapseInit]);

  useEffect(() => { void load(); }, [load]);

  // Keep the coverage cache in sync after optimistic add/remove/role changes.
  useEffect(() => { if (didInitCollapse.current) writeCache(COV_CACHE, rows); }, [rows]);

  /* ── mutations (optimistic) ── */
  const removeRow = useCallback(async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const res = await fetch(`/api/suppliers/coverage/${id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (!res || !res.ok) setRows(prev);
  }, [rows]);

  const changeRole = useCallback(async (id: string, role: CoverageRole) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, sourcing_role: role } : x)));
    const res = await fetch(`/api/suppliers/coverage/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourcing_role: role }),
    }).catch(() => null);
    if (!res || !res.ok) setRows(prev);
  }, [rows]);

  const onAssigned = useCallback((newRows: CoverageRow[]) => {
    setRows((r) => {
      const byId = new Map(r.map((x) => [x.id, x]));
      for (const row of newRows) {
        // Drop any stale entry with the same (supplier, category, subcategory) key, then set by id.
        for (const [id, x] of byId) {
          if (x.supplier_id === row.supplier_id && x.category_slug === row.category_slug && x.subcategory_code === row.subcategory_code) byId.delete(id);
        }
        byId.set(row.id, row);
      }
      return [...byId.values()];
    });
  }, []);

  /* ── distinct-supplier counters ── */
  const catSupplierCount = useCallback((c: TaxonomyDivision["categories"][number]) => {
    const set = new Set<string>();
    for (const s of c.subcategories) (byNode.get(coverageNodeKey(c.slug, s.key)) ?? []).forEach((r) => set.add(r.supplier_id));
    return set.size;
  }, [byNode]);
  const divSupplierCount = useCallback((d: TaxonomyDivision) => {
    const set = new Set<string>();
    for (const c of d.categories) for (const s of c.subcategories) (byNode.get(coverageNodeKey(c.slug, s.key)) ?? []).forEach((r) => set.add(r.supplier_id));
    return set.size;
  }, [byNode]);

  /* ── portfolio summary across the taxonomy ── */
  const summary = useMemo(() => {
    let subTotal = 0, covered = 0, critical = 0, gaps = 0;
    const suppliers = new Set<string>();
    for (const d of tree) {
      for (const c of d.categories) {
        for (const s of c.subcategories) {
          subTotal++;
          const list = byNode.get(coverageNodeKey(c.slug, s.key)) ?? [];
          list.forEach((r) => suppliers.add(r.supplier_id));
          const h = computeCoverageHealth(list);
          if (h.status === "none") gaps++;
          else { covered++; if (h.status === "critical") critical++; }
        }
      }
    }
    return { suppliers: suppliers.size, subTotal, covered, critical, gaps };
  }, [tree, byNode]);

  const liveDivisions = tree.filter((d) => d.categories.length > 0);
  const plannedDivisions = tree.filter((d) => d.categories.length === 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
      <SuppliersHeader
        title={t("cov.title", "Koleex Main Suppliers")}
        subtitle={t("cov.subtitle", "Sourcing coverage map — who we depend on, by division → category → subcategory")}
      />

      {/* Portfolio summary */}
      <section className="mt-6 grid grid-cols-2 gap-3 @container sm:grid-cols-4">
        <SummaryStat label={t("cov.sumSuppliers", "Suppliers mapped")} value={summary.suppliers} />
        <SummaryStat label={t("cov.sumCovered", "Subcategories covered")} value={`${summary.covered}/${summary.subTotal}`} />
        <SummaryStat label={t("cov.sumCritical", "At-risk")} value={summary.critical} tone={summary.critical ? "rose" : "emerald"} hint={t("cov.sumCriticalHint", "sole-source / no approved")} />
        <SummaryStat label={t("cov.sumGaps", "Coverage gaps")} value={summary.gaps} tone={summary.gaps ? "amber" : "emerald"} hint={t("cov.sumGapsHint", "no supplier yet")} />
      </section>

      {loading ? (
        <div className="mt-10 flex items-center justify-center py-20 text-sm text-[var(--text-faint)]">{t("cov.loading", "Loading sourcing map…")}</div>
      ) : err ? (
        <div className="mt-10 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-rose-500">
          {err}{" "}
          <button onClick={() => void load()} className="ms-2 underline">{t("cov.retry", "Retry")}</button>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {liveDivisions.map((d) => {
            const divCollapsed = collapsedDiv.has(d.id);
            const divSuppliers = divSupplierCount(d);
            return (
              <section key={d.id}>
                {/* ── Division header (sticky, large) ── */}
                <button
                  type="button"
                  onClick={() => setCollapsedDiv((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })}
                  className="sticky top-0 z-20 flex w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 px-5 py-4 text-start backdrop-blur"
                >
                  <AngleDownIcon className={`h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform ${divCollapsed ? "-rotate-90 rtl:rotate-90" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] truncate">{d.name}</h2>
                    {d.description ? <p className="text-[12px] text-[var(--text-faint)] truncate">{d.description}</p> : null}
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-[var(--text-faint)]">
                    {d.categories.length} {t("cov.categories", "categories")}
                    {divSuppliers > 0 ? <> · {divSuppliers} {t("cov.suppliers", "suppliers")}</> : null}
                  </span>
                </button>

                {!divCollapsed && (
                  <div className="mt-5 space-y-6">
                    {d.categories.map((c) => {
                      const catKey = `${d.id}:${c.slug}`;
                      const catCollapsed = collapsedCat.has(catKey);
                      const catLogo = taxonomyLogoUrl("categories", c.slug);
                      const catSuppliers = catSupplierCount(c);
                      let catCritical = 0;
                      for (const s of c.subcategories) {
                        const list = byNode.get(coverageNodeKey(c.slug, s.key)) ?? [];
                        if (computeCoverageHealth(list).status === "critical") catCritical++;
                      }
                      return (
                        <div key={c.slug} className="ps-1">
                          {/* ── Category header (medium) — toggle + add-across-category ── */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCollapsedCat((s) => { const n = new Set(s); n.has(catKey) ? n.delete(catKey) : n.add(catKey); return n; })}
                              className="flex flex-1 min-w-0 items-center gap-2.5 py-2 text-start"
                            >
                              <AngleDownIcon className={`h-3.5 w-3.5 shrink-0 text-[var(--text-ghost)] transition-transform ${catCollapsed ? "-rotate-90 rtl:rotate-90" : ""}`} />
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] ring-1 ring-[var(--border-subtle)] shrink-0">
                                {catLogo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={catLogo} alt="" className="h-4 w-4 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                ) : <Building2Icon className="h-4 w-4 text-[var(--text-faint)]" />}
                              </span>
                              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{c.label}</h3>
                              <span className="shrink-0 text-[11px] text-[var(--text-faint)]">· {c.subcategories.length} {t("cov.subcategories", "subcategories")}</span>
                              {catSuppliers > 0 && (
                                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-faint)]">
                                  <UsersIcon className="h-3 w-3" />{catSuppliers}
                                </span>
                              )}
                              {catCritical > 0 && (
                                <span className="ms-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-rose-500">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />{catCritical} {t("cov.atRisk", "at risk")}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPicker({ divisionSlug: d.id, categorySlug: c.slug, categoryLabel: c.label, subcategories: c.subcategories.map((s) => ({ code: s.key, label: s.label })) })}
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
                              title={t("cov.addAcrossCategory", "Add a supplier across this category")}
                            >
                              <PlusIcon size={11} /> {t("cov.addSupplier", "Add supplier")}
                            </button>
                          </div>

                          {!catCollapsed && (
                            <div className="grid grid-cols-1 gap-3 ps-7 @container xl:grid-cols-2">
                              {c.subcategories.map((s) => {
                                const list = byNode.get(coverageNodeKey(c.slug, s.key)) ?? [];
                                return (
                                  <SubcategoryCard
                                    key={s.key}
                                    label={s.label}
                                    code={s.code}
                                    rows={list}
                                    t={t}
                                    onAdd={() => setPicker({ divisionSlug: d.id, categorySlug: c.slug, categoryLabel: c.label, subcategories: c.subcategories.map((x) => ({ code: x.key, label: x.label })), presetCode: s.key })}
                                    onOpen={(id) => router.push(`/suppliers/${id}`)}
                                    onRemove={removeRow}
                                    onChangeRole={changeRole}
                                    onViewCatalog={(cat) => setCatalog(cat)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {/* Planned divisions — no coded taxonomy yet */}
          {plannedDivisions.length > 0 && (
            <section>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-ghost)] mb-3">{t("cov.planned", "Planned divisions")}</div>
              <div className="flex flex-wrap gap-2">
                {plannedDivisions.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border-subtle)] px-3 py-1 text-[11px] text-[var(--text-ghost)]">
                    {d.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {picker && (
        <SupplierPicker
          target={picker}
          existingByCode={Object.fromEntries(picker.subcategories.map((s) => [s.code, (byNode.get(coverageNodeKey(picker.categorySlug, s.code)) ?? []).map((r) => r.supplier_id)]))}
          t={t}
          onClose={() => setPicker(null)}
          onAssigned={onAssigned}
        />
      )}

      {catalog && <CatalogModal catalog={catalog} t={t} onClose={() => setCatalog(null)} />}
    </div>
  );
}

/* ── Portfolio summary stat ── */
function SummaryStat({ label, value, tone, hint }: { label: string; value: number | string; tone?: "rose" | "amber" | "emerald"; hint?: string }) {
  const toneText = tone === "rose" ? "text-rose-500" : tone === "amber" ? "text-amber-500" : tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-primary)]";
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</span>
      <span className={`mt-1 text-2xl font-bold tabular-nums ${toneText}`}>{value}</span>
      {hint ? <span className="mt-0.5 text-[11px] text-[var(--text-ghost)]">{hint}</span> : null}
    </div>
  );
}

/* ── Subcategory section: coverage health + supplier cards + add ── */
function SubcategoryCard({ label, code, rows, t, onAdd, onOpen, onRemove, onChangeRole, onViewCatalog }: {
  label: string; code: string | null; rows: CoverageRow[];
  t: (k: string, f?: string) => string;
  onAdd: () => void; onOpen: (id: string) => void;
  onRemove: (id: string) => void; onChangeRole: (id: string, role: CoverageRole) => void;
  onViewCatalog: (c: CatalogTarget) => void;
}) {
  const health = computeCoverageHealth(rows);
  const tone = HEALTH_TONE[health.status];
  const healthLabel = health.status === "healthy" ? t("cov.healthy", "Good")
    : health.status === "warning" ? t("cov.warning", "Thin")
    : health.status === "critical" ? t("cov.critical", "Risk")
    : t("cov.empty", "Empty");

  return (
    <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 ring-1 ring-inset ${tone.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {code ? <span className="font-mono text-[10px] text-[var(--text-ghost)]">{code}</span> : null}
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{label}</h4>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            <span className={`text-[11px] font-medium ${tone.text}`}>{healthLabel}</span>
            {rows.length > 0 && (
              <span className="text-[11px] text-[var(--text-faint)]">
                · {health.usable} {t("cov.suppliers", "suppliers")}{health.backups ? ` · ${health.backups} ${t("cov.backups", "backup")}` : ""}
                {health.soleSource ? ` · ${t("cov.soleSource", "sole source")}` : ""}
              </span>
            )}
          </div>
        </div>
        <button
          type="button" onClick={onAdd}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
        >
          <PlusIcon size={11} /> {t("cov.add", "Add")}
        </button>
      </div>

      {rows.length === 0 ? (
        <button type="button" onClick={onAdd} className="mt-2.5 w-full rounded-lg border border-dashed border-[var(--border-subtle)] py-2.5 text-center text-[11px] text-[var(--text-ghost)] hover:text-[var(--text-faint)] hover:border-[var(--border-color)] transition-colors">
          {t("cov.noSuppliers", "No suppliers yet — add coverage")}
        </button>
      ) : (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {rows.map((r) => (
            <SupplierChip key={r.id} row={r} t={t} onOpen={onOpen} onRemove={onRemove} onChangeRole={onChangeRole} onViewCatalog={onViewCatalog} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Compact supplier card/chip ── */
function SupplierChip({ row, t, onOpen, onRemove, onChangeRole, onViewCatalog }: {
  row: CoverageRow; t: (k: string, f?: string) => string;
  onOpen: (id: string) => void; onRemove: (id: string) => void; onChangeRole: (id: string, role: CoverageRole) => void;
  onViewCatalog: (c: CatalogTarget) => void;
}) {
  const s = row.supplier;
  const initials = (s?.name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const rDot = riskDot(s?.riskLevel ?? null);
  return (
    <div className="group/chip flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 transition-colors hover:border-[var(--border-color)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--bg-surface)] ring-1 ring-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)]">
        {s?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logo} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : initials}
      </span>
      <button type="button" onClick={() => s && onOpen(s.id)} className="min-w-0 flex-1 text-start">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)] truncate group-hover/chip:text-[var(--accent,#0066FF)]">{s?.name ?? "—"}</span>
          {rDot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${rDot}`} title={s?.riskLevel ?? ""} />}
        </div>
        <div className="flex items-center gap-1.5">
          {row.is_main_supplier && <span className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{t("cov.main", "Main")}</span>}
          {typeof s?.sourcingScore === "number" && <span className="text-[10px] tabular-nums text-[var(--text-ghost)]">{Math.round(s.sourcingScore)}</span>}
        </div>
      </button>

      {/* Catalog state — accent-blue button when a catalog/brochure PDF exists,
         otherwise a muted "No catalog" hint so the absence is explicit. */}
      {s?.catalogUrl ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewCatalog({ url: s.catalogUrl!, name: s.catalogName || s.name || t("cov.catalog", "Catalog") }); }}
          aria-label={t("cov.viewCatalog", "View catalog")}
          title={t("cov.viewCatalog", "View catalog")}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[#0066FF]/35 bg-[#0066FF]/10 px-2 py-1 text-[11px] font-semibold text-[#0066FF] hover:bg-[#0066FF]/18 transition-colors"
        >
          <FileIcon className="h-3 w-3" /> {t("cov.catalog", "Catalog")}
        </button>
      ) : (
        <span
          title={t("cov.noCatalogHint", "No catalog uploaded yet — add one from Supplier 360 → Media")}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--border-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--text-ghost)]"
        >
          <FileIcon className="h-3 w-3" /> {t("cov.noCatalog", "No catalog")}
        </span>
      )}

      {/* Role select — compact, native, monochrome */}
      <select
        value={row.sourcing_role}
        onChange={(e) => onChangeRole(row.id, e.target.value as CoverageRole)}
        onClick={(e) => e.stopPropagation()}
        aria-label={t("cov.role", "Sourcing role")}
        className={`shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 pe-1 text-[10px] font-semibold uppercase tracking-wide outline-none hover:border-[var(--border-subtle)] ${roleTextClass(row.sourcing_role)}`}
      >
        {COVERAGE_ROLES.map((r) => (
          <option key={r} value={r} className="text-[var(--text-primary)]">{roleLabel(t, r)}</option>
        ))}
      </select>

      <button
        type="button" onClick={() => onRemove(row.id)}
        aria-label={t("cov.remove", "Remove")}
        className="shrink-0 rounded-md p-1 text-[var(--text-ghost)] opacity-0 transition-opacity hover:text-rose-500 group-hover/chip:opacity-100"
      >
        <CrossIcon size={12} />
      </button>
    </div>
  );
}

/* ── Catalog PDF popup — inline viewer, never a full page / new route ── */
function CatalogModal({ catalog, t, onClose }: { catalog: CatalogTarget; t: (k: string, f?: string) => string; onClose: () => void }) {
  return (
    <ScrollLockOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--bg-overlay)] p-4" onClick={onClose}>
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
            <h3 className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{catalog.name}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={catalog.url} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
            >
              {t("cov.openInNewTab", "Open in new tab")}
            </a>
            <button onClick={onClose} aria-label={t("cov.close", "Close")} className="rounded-lg p-1 text-[var(--text-faint)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
          </div>
        </div>
        <iframe src={catalog.url} title={catalog.name} className="h-full w-full flex-1 bg-[var(--bg-surface)]" />
      </div>
    </ScrollLockOverlay>
  );
}

/* ── Searchable supplier picker — assigns one supplier to one OR MANY
   subcategories of a category in a single action (a supplier routinely makes
   products across several subcategories, or an entire category). ── */
function SupplierPicker({ target, existingByCode, t, onClose, onAssigned }: {
  target: PickerTarget; existingByCode: Record<string, string[]>;
  t: (k: string, f?: string) => string;
  onClose: () => void; onAssigned: (rows: CoverageRow[]) => void;
}) {
  const [all, setAll] = useState<PickerSupplier[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<CoverageRole>("approved");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Selected subcategories: pre-select the one clicked (per-sub Add); empty when
  // opened from the category header (user picks, or taps "All in category").
  const [selected, setSelected] = useState<Set<string>>(() => new Set(target.presetCode ? [target.presetCode] : []));

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/suppliers", { credentials: "include" });
        const json = (await res.json()) as { suppliers?: PickerSupplier[] };
        if (alive) setAll(Array.isArray(json.suppliers) ? json.suppliers : []);
      } catch { if (alive) setError(t("cov.pickLoadError", "Couldn't load suppliers.")); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [t]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((s) => !term || s.name.toLowerCase().includes(term));
  }, [all, q]);

  const allSelected = selected.size === target.subcategories.length && target.subcategories.length > 0;
  const toggleCode = (code: string) => setSelected((p) => { const n = new Set(p); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(target.subcategories.map((s) => s.code)));

  const assign = async (sup: PickerSupplier) => {
    if (busyId || selected.size === 0) return;
    setBusyId(sup.id); setError(null);
    const chosen = target.subcategories.filter((s) => selected.has(s.code));
    try {
      const res = await fetch("/api/suppliers/coverage", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: sup.id, division_slug: target.divisionSlug, category_slug: target.categorySlug,
          sourcing_role: role, subcategories: chosen.map((s) => ({ code: s.code, label: s.label })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { rows?: CoverageRow[] };
      onAssigned(Array.isArray(json.rows) ? json.rows : []);
      onClose();
    } catch {
      setError(t("cov.assignError", "Couldn't assign. Please try again."));
      setBusyId(null);
    }
  };

  return (
    <ScrollLockOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--bg-overlay)] p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--border-subtle)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{t("cov.addTo", "Add supplier to")} {target.categoryLabel}</h3>
              <p className="text-[11px] text-[var(--text-faint)]">{t("cov.pickSubsHint", "Pick the subcategories this supplier covers")}</p>
            </div>
            <button onClick={onClose} aria-label={t("cov.close", "Close")} className="shrink-0 rounded-lg p-1 text-[var(--text-faint)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
          </div>

          {/* role selector */}
          <div className="mt-3 flex flex-wrap gap-1">
            {COVERAGE_ROLES.map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${role === r ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                {roleLabel(t, r)}
              </button>
            ))}
          </div>

          {/* subcategory multi-select */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">
                {t("cov.applyTo", "Apply to")} · {selected.size}/{target.subcategories.length}
              </span>
              <button type="button" onClick={toggleAll} className="text-[11px] font-medium text-[var(--accent,#0066FF)] hover:underline">
                {allSelected ? t("cov.clearAll", "Clear") : t("cov.allInCategory", "All in category")}
              </button>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {target.subcategories.map((s) => {
                const on = selected.has(s.code);
                return (
                  <button key={s.code} type="button" onClick={() => toggleCode(s.code)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${on ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* search */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
            <SearchIcon size={14} className="text-[var(--text-faint)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cov.searchSuppliers", "Search suppliers…")}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {selected.size === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-faint)]">{t("cov.pickSubFirst", "Select at least one subcategory above")}</div>
          ) : loading ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-faint)]">{t("cov.loading", "Loading…")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-faint)]">{t("cov.noResults", "No suppliers match.")}</div>
          ) : (
            filtered.map((s) => {
              const initials = s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              // How many of the selected subcategories this supplier already covers.
              const inCount = [...selected].filter((code) => (existingByCode[code] ?? []).includes(s.id)).length;
              return (
                <button key={s.id} type="button" disabled={!!busyId} onClick={() => assign(s)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-[var(--bg-surface-subtle)] disabled:opacity-60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--bg-surface)] ring-1 ring-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-faint)]">
                    {s.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{s.name}</span>
                  {busyId === s.id ? <span className="text-[10px] text-[var(--text-faint)]">…</span>
                    : inCount > 0 ? <span className="shrink-0 text-[10px] text-[var(--text-ghost)]">{t("cov.coversN", "covers {n}").replace("{n}", String(inCount))}</span>
                    : <PlusIcon size={13} className="shrink-0 text-[var(--text-faint)]" />}
                </button>
              );
            })
          )}
          {error ? <div className="px-2.5 py-2 text-[11px] text-rose-500">{error}</div> : null}
        </div>
      </div>
    </ScrollLockOverlay>
  );
}
