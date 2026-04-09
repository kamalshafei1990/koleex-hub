"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus, Search, Calculator, Trash2, Copy, Filter, X,
  Loader2, MoreHorizontal, CheckCircle2, Clock, Globe,
  Building2, Package, FileText, ArrowUpDown,
} from "lucide-react";
import {
  fetchSimulations, deleteSimulation, duplicateSimulation,
} from "@/lib/landed-cost-admin";
import type { SimulationRow } from "@/lib/landed-cost-types";
import { useTranslation } from "@/lib/i18n";
import { landedCostT } from "@/lib/translations/landed-cost";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LandedCostListPage() {
  const { t, lang } = useTranslation(landedCostT);
  const isRtl = lang === "ar";
  const [simulations, setSimulations] = useState<SimulationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "name" | "total">("updated");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchSimulations().then(data => { setSimulations(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let list = simulations;
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.customer_company || "").toLowerCase().includes(q) ||
        (s.product_name || "").toLowerCase().includes(q) ||
        (s.sku || "").toLowerCase().includes(q) ||
        (s.customer_country || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "total") list = [...list].sort((a, b) => (b.results?.totalLandedCost || 0) - (a.results?.totalLandedCost || 0));
    return list;
  }, [simulations, search, statusFilter, sortBy]);

  async function handleDelete(id: string) {
    if (!confirm(t("list.deleteConfirm"))) return;
    const ok = await deleteSimulation(id);
    if (ok) setSimulations(prev => prev.filter(s => s.id !== id));
    setMenuOpen(null);
  }

  async function handleDuplicate(id: string) {
    const newId = await duplicateSimulation(id);
    if (newId) {
      const refreshed = await fetchSimulations();
      setSimulations(refreshed);
    }
    setMenuOpen(null);
  }

  const draftCount = simulations.filter(s => s.status === "draft").length;
  const completedCount = simulations.filter(s => s.status === "completed").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight">{t("list.title")}</h1>
              <p className="text-[12px] text-[var(--text-dim)]">
                {simulations.length} {simulations.length !== 1 ? t("list.simulationsPlural") : t("list.simulations")}
                {draftCount > 0 && <span className="ml-2 text-amber-400">{draftCount} {t("draft")}</span>}
                {completedCount > 0 && <span className="ml-2 text-emerald-400">{completedCount} {t("completed")}</span>}
              </p>
            </div>
          </div>
          <Link href="/landed-cost/new" className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg">
            <Plus className="h-4 w-4" /> {t("list.newSimulation")}
          </Link>
        </div>

        {/* ── Search & Filters ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className={`absolute ${isRtl ? "right-3.5" : "left-3.5"} top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-ghost)]`} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("list.searchPlaceholder")}
              className={`w-full h-10 ${isRtl ? "pr-10 pl-4" : "pl-10 pr-4"} rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all`}
            />
            {search && (
              <button onClick={() => setSearch("")} className={`absolute ${isRtl ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-[var(--text-ghost)] hover:text-[var(--text-primary)]`}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none cursor-pointer appearance-none"
            >
              <option value="">{t("list.allStatus")}</option>
              <option value="draft">{t("draft")}</option>
              <option value="completed">{t("completed")}</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as "updated" | "name" | "total")}
              className="h-10 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none cursor-pointer appearance-none"
            >
              <option value="updated">{t("list.recentlyUpdated")}</option>
              <option value="name">{t("list.nameAZ")}</option>
              <option value="total">{t("list.highestCost")}</option>
            </select>
          </div>
        </div>

        {/* ── Empty State ── */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] mb-4">
              <Calculator className="h-7 w-7" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
              {search || statusFilter ? t("list.noSimsFound") : t("list.noSimsYet")}
            </p>
            <p className="text-[13px] text-[var(--text-dim)] mb-5 max-w-sm">
              {search || statusFilter
                ? t("list.adjustFilters")
                : t("list.createFirstSim")}
            </p>
            {!search && !statusFilter && (
              <Link href="/landed-cost/new" className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all">
                <Plus className="h-4 w-4" /> {t("list.createSimulation")}
              </Link>
            )}
          </div>
        )}

        {/* ── Simulation Cards ── */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(sim => {
              const r = sim.results || {} as Record<string, number>;
              const total = r.totalLandedCost || 0;
              const perUnit = r.landedCostPerUnit || 0;
              return (
                <div key={sim.id} className="group relative bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden hover:shadow-[0_2px_16px_rgba(0,0,0,0.18)] hover:border-[var(--border-focus)] transition-all">
                  <Link href={`/landed-cost/${sim.id}`} className="block p-5">
                    {/* Top: name + status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1 mr-3">
                        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate leading-snug">{sim.name}</h3>
                        <p className="text-[11px] text-[var(--text-dim)] mt-0.5 truncate">
                          {sim.customer_company || sim.customer_name || t("list.noCustomer")}
                          {sim.customer_country && <span> · {sim.customer_country}</span>}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                        sim.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {t(sim.status)}
                      </span>
                    </div>

                    {/* Product info */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <Package className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
                      <span className="text-[11px] text-[var(--text-dim)] truncate">
                        {sim.product_name || t("list.noProduct")}{sim.sku ? ` · ${sim.sku}` : ""}
                      </span>
                    </div>

                    {/* Big total */}
                    <div className="bg-[var(--bg-primary)] rounded-xl px-4 py-3 mb-3 border border-[var(--border-subtle)]">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-0.5">{t("list.totalLandedCost")}</p>
                          <p className="text-[20px] font-bold font-mono tracking-tight">{sim.currency} {fmt(total)}</p>
                        </div>
                        <div className={isRtl ? "text-left" : "text-right"}>
                          <p className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-0.5">{t("perUnit")}</p>
                          <p className="text-[14px] font-semibold font-mono">{fmt(perUnit)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] text-[var(--text-ghost)]">
                        <span>{sim.quantity} {t("units")}</span>
                        <span>{sim.price_basis}</span>
                        <span>{sim.currency}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-ghost)]">
                        {new Date(sim.updated_at).toLocaleDateString(lang === "ar" ? "ar-EG" : lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </Link>

                  {/* Actions menu */}
                  <div className={`absolute top-4 ${isRtl ? "left-4" : "right-4"} z-10`}>
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(menuOpen === sim.id ? null : sim.id); }}
                      className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] transition-all"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {menuOpen === sim.id && (
                      <div className={`absolute ${isRtl ? "left-0" : "right-0"} top-8 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden min-w-[140px] z-20`}>
                        <Link href={`/landed-cost/${sim.id}`} className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]/50 transition-colors" onClick={() => setMenuOpen(null)}>
                          <FileText className="h-3.5 w-3.5 text-[var(--text-dim)]" /> {t("list.open")}
                        </Link>
                        <button onClick={() => handleDuplicate(sim.id)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]/50 transition-colors">
                          <Copy className="h-3.5 w-3.5 text-[var(--text-dim)]" /> {t("list.duplicate")}
                        </button>
                        <button onClick={() => handleDelete(sim.id)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-red-400 hover:bg-red-500/[0.06] transition-colors">
                          <Trash2 className="h-3.5 w-3.5" /> {t("list.delete")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
