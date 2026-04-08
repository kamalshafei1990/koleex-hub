"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Settings, Save, Loader2, Eye, EyeOff, Shield,
  Percent, Users, Globe, Search, Layers, ChevronDown, Plus, Trash2,
} from "lucide-react";
import {
  fetchPricingConfig, savePricingConfig,
  DEFAULT_CONFIG,
  type PricingConfig, type CustomerChannel, type CountryEntry, type PricingCategory,
} from "@/lib/pricing-config";

/* ═══════════════════ TABS ═══════════════════ */

type TabId = "ui" | "limits" | "channels" | "countries" | "categories";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "ui", label: "UI Visibility", icon: Eye },
  { id: "limits", label: "Limits & Defaults", icon: Percent },
  { id: "channels", label: "Customer Channels", icon: Users },
  { id: "countries", label: "Countries & Bands", icon: Globe },
  { id: "categories", label: "Product Categories", icon: Layers },
];

/* ═══════════════════ COMPONENT ═══════════════════ */

export default function PricingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<TabId>("ui");
  const [countrySearch, setCountrySearch] = useState("");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const c = await fetchPricingConfig();
    setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function handleSave() {
    setSaving(true);
    const ok = await savePricingConfig(config);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  /* ── Updaters ── */
  function setUI(key: keyof PricingConfig["ui"], val: boolean) {
    setConfig(c => ({ ...c, ui: { ...c.ui, [key]: val } }));
  }
  function setBand(band: "A" | "B" | "C", val: number) {
    setConfig(c => ({ ...c, bands: { ...c.bands, [band]: val } }));
  }
  function updateCustomer(idx: number, patch: Partial<CustomerChannel>) {
    setConfig(c => ({ ...c, customers: c.customers.map((ch, i) => i === idx ? { ...ch, ...patch } : ch) }));
  }
  function updateCountry(idx: number, patch: Partial<CountryEntry>) {
    setConfig(c => {
      const countries = c.countries.map((co, i) => {
        if (i !== idx) return co;
        const merged = { ...co, ...patch };
        if (patch.band) {
          merged.adjustmentPct = c.bands[patch.band] / 100;
        }
        return merged;
      });
      return { ...c, countries };
    });
  }
  function addCountry() {
    setConfig(c => ({
      ...c,
      countries: [...c.countries, { code: "", name: "", currency: "", adjustmentPct: 0, band: "B" as const }],
    }));
  }
  function removeCountry(idx: number) {
    setConfig(c => ({ ...c, countries: c.countries.filter((_, i) => i !== idx) }));
  }
  function updateCategory(idx: number, patch: Partial<PricingCategory>) {
    setConfig(c => ({ ...c, categories: c.categories.map((cat, i) => i === idx ? { ...cat, ...patch } : cat) }));
  }
  function addCategory() {
    setConfig(c => ({
      ...c,
      categories: [...c.categories, { id: `level${c.categories.length + 1}`, name: "", min: 0, max: 0, marginPct: 0 }],
    }));
  }
  function removeCategory(idx: number) {
    setConfig(c => ({ ...c, categories: c.categories.filter((_, i) => i !== idx) }));
  }

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return config.countries;
    const q = countrySearch.toLowerCase();
    return config.countries.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q)
    );
  }, [config.countries, countrySearch]);

  const inputCls = "w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-all";
  const selectCls = "w-full h-10 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-all appearance-none cursor-pointer";
  const labelCls = "block text-[12px] font-medium text-[var(--text-subtle)] mb-1.5";

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/price-calculator" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Settings className="h-4 w-4" /></div>
            <h1 className="text-xl md:text-[26px] font-bold tracking-tight truncate">System Control Panel</h1>
          </div>
          <button onClick={handleSave} disabled={saving} className="ml-auto h-10 px-5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save & Apply"}
          </button>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">Configure Pricing Rules, Margins & UI Visibility</p>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 h-9 px-4 rounded-lg text-[12px] font-medium flex items-center gap-2 transition-all ${isActive ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]"}`}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ═══════ TAB: UI Visibility ═══════ */}
        {activeTab === "ui" && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Eye className="h-4 w-4" /></div>
              <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">UI Visibility & Features</span>
            </div>
            <div className="border-t border-[var(--border-subtle)]">
              {([
                { key: "showOverride" as const, label: "Enable Manual Price Override Box", desc: "Allows users to override auto-calculated profit margin" },
                { key: "showFxRisk" as const, label: "Enable FX Risk Manager Button", desc: "Shows the FX Risk scenario selector for currency hedging" },
                { key: "showTaxRefund" as const, label: "Enable Tax Refund Calculator", desc: "Adds tax refund toggle to show profit including refund" },
              ]).map((item, i, arr) => (
                <div key={item.key} className={`flex items-center justify-between px-6 py-4 ${i < arr.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}`}>
                  <div>
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{item.label}</span>
                    <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{item.desc}</p>
                  </div>
                  <button onClick={() => setUI(item.key, !config.ui[item.key])} className={`relative w-11 h-6 rounded-full transition-colors ${config.ui[item.key] ? "bg-emerald-500" : "bg-[var(--bg-inverted)]/[0.15]"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${config.ui[item.key] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ TAB: Limits & Defaults ═══════ */}
        {activeTab === "limits" && (
          <div className="space-y-4">
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Percent className="h-4 w-4" /></div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">Global Limits & Defaults</span>
              </div>
              <div className="px-6 pb-6 pt-2 border-t border-[var(--border-subtle)] space-y-5">
                <div>
                  <label className={labelCls}>Max Allowed Manual Discount (%)</label>
                  <input type="number" min={0} max={100} value={config.maxDiscount} onChange={e => setConfig(c => ({ ...c, maxDiscount: parseInt(e.target.value) || 0 }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Default Tax Refund Rate (%)</label>
                  <input type="number" min={0} max={100} value={config.defaultTaxRefund} onChange={e => setConfig(c => ({ ...c, defaultTaxRefund: parseInt(e.target.value) || 0 }))} className={inputCls} />
                </div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Shield className="h-4 w-4" /></div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">Regional Band Modifiers</span>
              </div>
              <div className="border-t border-[var(--border-subtle)]">
                {(["A", "B", "C"] as const).map((band, i) => {
                  const colors = { A: "text-red-400", B: "text-blue-400", C: "text-amber-400" };
                  return (
                    <div key={band} className={`flex items-center justify-between px-6 py-4 ${i < 2 ? "border-b border-[var(--border-subtle)]" : ""}`}>
                      <span className={`text-[13px] font-semibold ${colors[band]}`}>Band {band} Modifier (%)</span>
                      <input type="number" value={config.bands[band]} onChange={e => setBand(band, parseFloat(e.target.value) || 0)} className="w-24 h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] text-center outline-none focus:border-[var(--border-focus)] transition-all" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB: Customer Channels ═══════ */}
        {activeTab === "channels" && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Users className="h-4 w-4" /></div>
              <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Customer Channels Margin Setup</span>
            </div>
            <p className="px-6 text-[11px] text-[var(--text-dim)] -mt-1 pb-2">Define which channels are visible and configure their sequential markups.</p>
            <div className="border-t border-[var(--border-subtle)]">
              {config.customers.map((ch, idx) => (
                <div key={ch.id} className={`flex items-center gap-4 px-6 py-4 ${idx < config.customers.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}`}>
                  <button onClick={() => updateCustomer(idx, { visible: !ch.visible })} className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${ch.visible ? "bg-emerald-500 border-emerald-500" : "border-[var(--border-subtle)] bg-transparent"}`}>
                    {ch.visible && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <span className={`text-[13px] font-medium w-28 shrink-0 ${ch.visible ? "text-[var(--text-primary)]" : "text-[var(--text-dim)] line-through"}`}>{ch.name}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <input type="number" value={ch.markupPct * 100} onChange={e => updateCustomer(idx, { markupPct: (parseFloat(e.target.value) || 0) / 100 })} className="w-20 h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] text-center outline-none focus:border-[var(--border-focus)] transition-all" />
                    <span className="text-[11px] text-[var(--text-ghost)]">% {ch.relLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ TAB: Countries & Bands ═══════ */}
        {activeTab === "countries" && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Globe className="h-4 w-4" /></div>
              <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Countries & Regional Bands</span>
              <button onClick={addCountry} className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="px-6 pb-3 border-t border-[var(--border-subtle)] pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)]" />
                <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Search countries..." className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-2 bg-[var(--bg-surface-subtle)] text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider sticky top-0">
                <span className="w-16">Code</span>
                <span className="flex-1">Country</span>
                <span className="w-20">Currency</span>
                <span className="w-20 text-center">Band</span>
                <span className="w-20 text-center">Adj %</span>
                <span className="w-8"></span>
              </div>
              {filteredCountries.map((co) => {
                const realIdx = config.countries.indexOf(co);
                const bandColors = { A: "text-red-400 bg-red-400/10 border-red-400/20", B: "text-blue-400 bg-blue-400/10 border-blue-400/20", C: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
                return (
                  <div key={`${co.code}-${realIdx}`} className="flex items-center gap-3 px-6 py-2.5 border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]/50 transition-colors">
                    <input type="text" value={co.code} onChange={e => updateCountry(realIdx, { code: e.target.value.toUpperCase() })} className="w-16 h-8 px-2 rounded-md bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] text-center outline-none focus:border-[var(--border-focus)]" maxLength={3} />
                    <input type="text" value={co.name} onChange={e => updateCountry(realIdx, { name: e.target.value })} className="flex-1 h-8 px-3 rounded-md bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
                    <input type="text" value={co.currency} onChange={e => updateCountry(realIdx, { currency: e.target.value.toUpperCase() })} className="w-20 h-8 px-2 rounded-md bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] text-center outline-none focus:border-[var(--border-focus)]" maxLength={3} />
                    <select value={co.band} onChange={e => updateCountry(realIdx, { band: e.target.value as "A" | "B" | "C" })} className={`w-20 h-8 px-2 rounded-md border text-[11px] font-semibold text-center outline-none cursor-pointer ${bandColors[co.band]}`}>
                      <option value="A">Band A</option>
                      <option value="B">Band B</option>
                      <option value="C">Band C</option>
                    </select>
                    <span className="w-20 text-center text-[12px] font-mono text-[var(--text-dim)]">{co.adjustmentPct >= 0 ? "+" : ""}{(co.adjustmentPct * 100).toFixed(0)}%</span>
                    <button onClick={() => removeCountry(realIdx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center gap-4 text-[11px] text-[var(--text-dim)]">
              <span className="text-red-400 font-semibold">Band A</span> = {config.bands.A}%
              <span className="text-blue-400 font-semibold ml-2">Band B</span> = {config.bands.B}%
              <span className="text-amber-400 font-semibold ml-2">Band C</span> = {config.bands.C}%
              <span className="ml-auto">{config.countries.length} countries</span>
            </div>
          </div>
        )}

        {/* ═══════ TAB: Product Categories ═══════ */}
        {activeTab === "categories" && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0"><Layers className="h-4 w-4" /></div>
              <span className="text-[14px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Product Category Margin Levels</span>
              <button onClick={addCategory} className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="border-t border-[var(--border-subtle)]">
              {config.categories.map((cat, idx) => (
                <div key={cat.id} className={`px-6 py-4 space-y-3 ${idx < config.categories.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-[var(--text-ghost)] w-5 text-center">{idx + 1}</span>
                    <input type="text" value={cat.name} onChange={e => updateCategory(idx, { name: e.target.value })} placeholder="Category name" className={`${inputCls} flex-1`} />
                    <button onClick={() => removeCategory(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pl-8">
                    <div>
                      <label className={labelCls}>Min Cost (CNY)</label>
                      <input type="number" min={0} value={cat.min} onChange={e => updateCategory(idx, { min: parseFloat(e.target.value) || 0 })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Max Cost (CNY)</label>
                      <input type="number" min={0} value={cat.max} onChange={e => updateCategory(idx, { max: parseFloat(e.target.value) || 0 })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Margin (%)</label>
                      <input type="number" min={0} max={100} step={0.1} value={cat.marginPct * 100} onChange={e => updateCategory(idx, { marginPct: (parseFloat(e.target.value) || 0) / 100 })} className={inputCls} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom Save ── */}
        <div className="mt-6 flex items-center justify-end">
          <button onClick={handleSave} disabled={saving} className="h-12 px-8 rounded-xl bg-emerald-600 text-white text-[14px] font-semibold flex items-center gap-2.5 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings & Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
