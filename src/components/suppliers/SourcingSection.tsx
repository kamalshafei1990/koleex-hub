"use client";

/* ---------------------------------------------------------------------------
   SourcingSection — Procurement Decision Intelligence for the Supplier 360.

   A computed sourcing-suitability score (separate from readiness + risk) with
   manual override + priority, dependency indicators, per-product sourcing roles
   (preferred / approved / backup / experimental / blocked) layered on the
   existing supplier_product_links, category specializations, and a side-by-side
   supplier comparison panel (the comparison engine answers "which supplier is
   best/safest/cheapest"). Monochrome, restrained, comparison-oriented.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  SOURCING_ROLE_LABELS, SOURCING_ROLE_ORDER, sourcingRoleLabel, SOURCING_ROLE_RANK,
  sourcingBand, RISK_LEVEL_LABELS,
} from "@/lib/suppliers/intelligence";
import NetworkIcon from "@/components/icons/ui/NetworkIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import ArrowRightLeftIcon from "@/components/icons/ui/ArrowRightLeftIcon";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Row = Record<string, unknown>;
const str = (r: Row, k: string): string => { const v = r[k]; return typeof v === "string" ? v : typeof v === "number" ? String(v) : ""; };

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{children}</div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>{children}</label>
);
const inputCls = "w-full rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";
const QUALITY = ["", "low", "medium", "high"];
const roleCls: Record<string, string> = {
  preferred: "bg-[var(--text-primary)] text-[var(--bg-primary)]",
  approved: "bg-[var(--bg-surface)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]",
  backup: "bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]",
  experimental: "bg-amber-500/15 text-amber-300",
  blocked: "bg-rose-500/15 text-rose-300",
};
const bandCls: Record<string, string> = {
  strong: "bg-[var(--text-primary)] text-[var(--bg-primary)]",
  viable: "bg-[var(--bg-surface)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]",
  weak: "bg-amber-500/15 text-amber-300",
  none: "bg-[var(--bg-surface)] text-[var(--text-faint)] ring-1 ring-[var(--border-subtle)]",
};

type Summary = { score: number | null; priority: number | null; preferredProducts: number; blockedProducts: number; soleSource: boolean } | null;

export default function SourcingSection({
  supplierId, supplierName, sourcing, sourcingProfile, sourcingLinks, specializations, onSaved,
}: {
  supplierId: string;
  supplierName: string;
  sourcing: Summary;
  sourcingProfile: Row | null;
  sourcingLinks: Row[];
  specializations: Row[];
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation(contactsT);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const band = sourcingBand(sourcing?.score ?? null);

  // profile editor
  const sp = sourcingProfile ?? {};
  const [pEdit, setPEdit] = useState(false);
  const [pOverride, setPOverride] = useState("");
  const [pPriority, setPPriority] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [pDiv, setPDiv] = useState("");
  const [pBusy, setPBusy] = useState(false);
  const openProfile = () => {
    setPOverride(typeof sp.sourcing_score_override === "number" ? String(sp.sourcing_score_override) : "");
    setPPriority(typeof sp.sourcing_priority === "number" ? String(sp.sourcing_priority) : "");
    setPNotes(str(sp, "sourcing_notes")); setPDiv(str(sp, "diversification_note")); setErr(null); setPEdit(true);
  };
  const saveProfile = async () => {
    setPBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/sourcing`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcing_score_override: pOverride, sourcing_priority: pPriority, sourcing_notes: pNotes, diversification_note: pDiv }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      setPEdit(false); await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setPBusy(false); }
  };

  // assign product role
  const [addOpen, setAddOpen] = useState(false);
  const [products, setProducts] = useState<Row[]>([]);
  const [pq, setPq] = useState("");
  const [selProduct, setSelProduct] = useState<Row | null>(null);
  const [aRole, setARole] = useState("preferred");
  const [aLead, setALead] = useState(""); const [aMoq, setAMoq] = useState(""); const [aPrice, setAPrice] = useState(""); const [aQuality, setAQuality] = useState("");
  const [aCapacity, setACapacity] = useState(""); const [aCapacityUnit, setACapacityUnit] = useState("units / month");
  const [aBusy, setABusy] = useState(false); const [aErr, setAErr] = useState<string | null>(null);
  useEffect(() => { if (!addOpen || products.length) return;
    fetch("/api/products", { credentials: "include" }).then((r) => r.json()).then((j) => setProducts(Array.isArray(j.products) ? j.products : [])).catch(() => {}); }, [addOpen, products.length]);
  const productMatches = useMemo(() => {
    const q = pq.trim().toLowerCase(); if (!q) return [];
    return products.filter((p) => str(p, "product_name").toLowerCase().includes(q)).slice(0, 6);
  }, [pq, products]);
  const addRole = async () => {
    if (!selProduct) { setAErr(t("srcg.pickProduct", "Pick a product")); return; }
    setABusy(true); setAErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/sourcing/links`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: str(selProduct, "id"), sourcing_role: aRole, lead_time_days: aLead, moq: aMoq, target_price: aPrice, quality_level: aQuality, capacity: aCapacity, capacity_unit: aCapacity ? aCapacityUnit : "" }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      setAddOpen(false); setSelProduct(null); setPq(""); setALead(""); setAMoq(""); setAPrice(""); setAQuality(""); setACapacity(""); await onSaved();
    } catch (e) { setAErr(e instanceof Error ? e.message : String(e)); } finally { setABusy(false); }
  };
  const setRole = async (link: Row, role: string) => {
    const id = str(link, "id"); setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/sourcing/links/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourcing_role: role }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusyId(null); }
  };
  const removeRole = async (link: Row) => {
    const id = str(link, "id"); if (!confirm(t("srcg.confirmRemoveRole", "Remove this product sourcing role?"))) return;
    setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/sourcing/links/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusyId(null); }
  };

  // comparison panel
  const [cmpOpen, setCmpOpen] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<Row[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set([supplierId]));
  const [cmpRows, setCmpRows] = useState<Row[] | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);
  useEffect(() => { if (!cmpOpen || allSuppliers.length) return;
    fetch("/api/suppliers", { credentials: "include" }).then((r) => r.json()).then((j) => setAllSuppliers(Array.isArray(j.suppliers) ? j.suppliers : [])).catch(() => {}); }, [cmpOpen, allSuppliers.length]);
  const runCompare = async () => {
    setCmpBusy(true);
    try {
      const ids = [...picked].join(",");
      const r = await fetch(`/api/suppliers/compare?ids=${encodeURIComponent(ids)}`, { credentials: "include" });
      const j = await r.json();
      setCmpRows(Array.isArray(j.suppliers) ? j.suppliers : []);
    } catch { setCmpRows([]); } finally { setCmpBusy(false); }
  };
  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const links = useMemo(() => [...sourcingLinks].sort((a, b) => (SOURCING_ROLE_RANK[str(a, "sourcing_role")] ?? 5) - (SOURCING_ROLE_RANK[str(b, "sourcing_role")] ?? 5)), [sourcingLinks]);

  return (
    <section className="space-y-6" {...kxInspectAttrs({ component: "SupplierSourcingSection", module: "Suppliers", section: "Production", recordId: supplierId })}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><NetworkIcon className="h-4 w-4 text-[var(--text-secondary)]" /><h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("srcg.title", "Sourcing Intelligence")}</h3></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setCmpRows(null); setPicked(new Set([supplierId])); setCmpOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowRightLeftIcon className="h-3.5 w-3.5" /> {t("srcg.compare", "Compare")}</button>
          <button type="button" onClick={() => { setSelProduct(null); setPq(""); setARole("preferred"); setAErr(null); setAddOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3.5 w-3.5" /> {t("srcg.assignRole", "Assign role")}</button>
          <button type="button" onClick={openProfile} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Edit3Icon className="h-3.5 w-3.5" /> {t("srcg.score", "Score")}</button>
        </div>
      </div>

      {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4">
          <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{sourcing?.score ?? "—"}</span>{sourcing?.score != null ? <span className="text-xs text-[var(--text-faint)]">/100</span> : null}</div>
          <div className="mt-1"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${bandCls[band.tone]}`}><GaugeIcon className="mr-1 h-2.5 w-2.5" />{band.label}</span></div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{t("srcg.sourcingScore", "Sourcing score")}</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4"><div className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{sourcing?.priority ?? "—"}</div><div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{t("srcg.priority", "Priority")}</div></div>
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4"><div className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{sourcing?.preferredProducts ?? 0}</div><div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{t("srcg.preferredProducts", "Preferred products")}</div></div>
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4"><div className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{sourcing?.blockedProducts ?? 0}</div><div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{t("srcg.blockedProducts", "Blocked products")}</div></div>
      </div>

      {sourcing?.soleSource ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2 text-[12px] text-amber-300"><TriangleWarningIcon className="h-4 w-4 shrink-0" />{t("srcg.dependencyExposure", "Dependency exposure: high reliance with no qualified backup. Consider diversifying.")}</div>
      ) : null}
      {str(sp, "diversification_note") || str(sp, "sourcing_notes") ? (
        <div className="space-y-1.5 rounded-2xl bg-[var(--bg-surface-subtle)] p-4">
          {str(sp, "sourcing_notes") ? <div className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{str(sp, "sourcing_notes")}</div> : null}
          {str(sp, "diversification_note") ? <div className="text-[11px] text-[var(--text-faint)]"><span className="uppercase tracking-wide">{t("srcg.diversificationLabel", "Diversification:")}</span> {str(sp, "diversification_note")}</div> : null}
        </div>
      ) : null}

      {/* product sourcing roles */}
      <div className="space-y-2.5">
        <SectionLabel>{t("srcg.productRolesSection", "Product sourcing roles")}</SectionLabel>
        {links.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-8 text-center text-sm text-[var(--text-faint)]">{t("srcg.noRolesYet", "No product sourcing roles yet — assign preferred / approved / backup roles per product.")}</div>
        ) : (
          <div className="space-y-2">
            {links.map((l) => {
              const id = str(l, "id");
              const prod = (l.products as Row | null) ?? {};
              const terms = [str(l, "lead_time_days") && t("srcg.leadTerm", "{n}d lead").replace("{n}", str(l, "lead_time_days")), str(l, "moq") && t("srcg.moqTerm", "MOQ {n}").replace("{n}", str(l, "moq")), str(l, "capacity") && `${str(l, "capacity")}${str(l, "capacity_unit") ? " " + str(l, "capacity_unit") : ""}`, str(l, "target_price") && `≤ ${str(l, "target_price")}`, str(l, "quality_level") && t("srcg.qualityTerm", "{q} quality").replace("{q}", str(l, "quality_level"))].filter(Boolean) as string[];
              return (
                <div key={id} className="rounded-xl bg-[var(--bg-surface-subtle)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleCls[str(l, "sourcing_role")] ?? roleCls.approved}`}>{sourcingRoleLabel(str(l, "sourcing_role"))}</span>
                        <PackageIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                        <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{str(prod, "product_name") || t("srcg.productFallback", "Product")}</span>
                      </div>
                      {terms.length ? <div className="mt-1 flex flex-wrap gap-1.5">{terms.map((t, i) => <span key={i} className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{t}</span>)}</div> : null}
                      {str(l, "risk_notes") ? <div className="mt-1 text-[11px] text-[var(--text-faint)]">{str(l, "risk_notes")}</div> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <select value={str(l, "sourcing_role")} disabled={busyId === id} onChange={(e) => setRole(l, e.target.value)} className="rounded-md bg-[var(--bg-surface)] px-1.5 py-1 text-[11px] text-[var(--text-secondary)] outline-none">
                        {SOURCING_ROLE_ORDER.map((r) => <option key={r} value={r}>{SOURCING_ROLE_LABELS[r]}</option>)}
                      </select>
                      <button type="button" disabled={busyId === id} onClick={() => removeRole(l)} className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-rose-400 disabled:opacity-40" title={t("srcg.removeRole", "Remove role")}><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* category specializations (read-only, from Foundation) */}
      {specializations.length ? (
        <div className="space-y-2.5">
          <SectionLabel>{t("srcg.categorySpecsSection", "Category specializations")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {specializations.map((s) => (
              <span key={str(s, "id")} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                <AwardIcon className="h-3 w-3 text-[var(--text-faint)]" />{str(s, "category_label")}{str(s, "strength_score") ? ` · ${str(s, "strength_score")}` : ""}{s.is_primary ? ` · ${t("srcg.primary", "primary")}` : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* profile editor modal */}
      {pEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !pBusy && setPEdit(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><GaugeIcon className="h-4 w-4 text-[var(--text-secondary)]" /><span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("srcg.sourcingScore", "Sourcing score")}</span></div>
            <div className="text-[11px] text-[var(--text-faint)]">{t("srcg.autoScorePrefix", "Auto score (from risk · readiness · negotiation · certs): ")}<span className="font-semibold text-[var(--text-secondary)]">{sourcing?.score ?? "—"}</span>{t("srcg.autoScoreSuffix", ". Set an override to pin it.")}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("srcg.scoreOverrideLabel", "Score override (0–100)")}><input type="number" min={0} max={100} className={inputCls} value={pOverride} onChange={(e) => setPOverride(e.target.value)} placeholder={t("srcg.autoPlaceholder", "auto")} /></Field>
              <Field label={t("srcg.priority", "Priority")}><input type="number" className={inputCls} value={pPriority} onChange={(e) => setPPriority(e.target.value)} /></Field>
            </div>
            <Field label={t("srcg.sourcingNotesLabel", "Sourcing notes")}><textarea className={`${inputCls} min-h-[56px]`} value={pNotes} onChange={(e) => setPNotes(e.target.value)} /></Field>
            <Field label={t("srcg.diversificationNoteLabel", "Diversification note")}><input className={inputCls} value={pDiv} onChange={(e) => setPDiv(e.target.value)} placeholder={t("srcg.diversificationPlaceholder", "e.g. need a 2nd source outside CN")} /></Field>
            <div className="flex items-center gap-3">
              <button type="button" disabled={pBusy} onClick={saveProfile} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{pBusy ? t("srcg.saving", "Saving…") : t("srcg.save", "Save")}</button>
              <button type="button" onClick={() => setPEdit(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("srcg.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* assign role modal */}
      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !aBusy && setAddOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-md space-y-4 overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><PackageIcon className="h-4 w-4 text-[var(--text-secondary)]" /><span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("srcg.assignModalTitle", "Assign product sourcing role")}</span></div>
            <Field label={t("srcg.productLabel", "Product")}>
              {selProduct ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2"><span className="text-[12px] text-[var(--text-primary)]">{str(selProduct, "product_name")}</span><button type="button" onClick={() => setSelProduct(null)} className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("srcg.change", "change")}</button></div>
              ) : (
                <>
                  <input className={inputCls} value={pq} onChange={(e) => setPq(e.target.value)} placeholder={t("srcg.searchProducts", "Search products…")} />
                  {productMatches.length ? (
                    <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      {productMatches.map((p) => <button key={str(p, "id")} type="button" onClick={() => { setSelProduct(p); setPq(""); }} className="block w-full px-3 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]">{str(p, "product_name")}</button>)}
                    </div>
                  ) : null}
                </>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("srcg.roleLabel", "Role")}><select className={inputCls} value={aRole} onChange={(e) => setARole(e.target.value)}>{SOURCING_ROLE_ORDER.map((r) => <option key={r} value={r}>{SOURCING_ROLE_LABELS[r]}</option>)}</select></Field>
              <Field label={t("srcg.qualityLabel", "Quality")}><select className={inputCls} value={aQuality} onChange={(e) => setAQuality(e.target.value)}>{QUALITY.map((q) => <option key={q} value={q}>{q ? q[0].toUpperCase() + q.slice(1) : "—"}</option>)}</select></Field>
              <Field label={t("srcg.leadTimeLabel", "Lead time (days)")}><input type="number" className={inputCls} value={aLead} onChange={(e) => setALead(e.target.value)} /></Field>
              <Field label={t("srcg.moqLabel", "MOQ")}><input className={inputCls} value={aMoq} onChange={(e) => setAMoq(e.target.value)} /></Field>
              <Field label={t("srcg.capacityLabel", "Capacity (per product)")}><input className={inputCls} value={aCapacity} onChange={(e) => setACapacity(e.target.value)} placeholder="e.g. 5000" inputMode="decimal" /></Field>
              <Field label={t("srcg.capacityUnitLabel", "Capacity unit")}>
                <select className={inputCls} value={aCapacityUnit} onChange={(e) => setACapacityUnit(e.target.value)}>
                  {["units / month", "units / week", "units / day", "units / year", "pcs / month", "tons / month", "containers / month"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("srcg.targetPriceLabel", "Target price")}><input className={inputCls} value={aPrice} onChange={(e) => setAPrice(e.target.value)} placeholder={t("srcg.targetPricePlaceholder", "e.g. ≤ $420/unit")} /></Field>
            {aErr ? <div className="text-[12px] text-rose-400">{aErr}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={aBusy} onClick={addRole} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{aBusy ? t("srcg.saving", "Saving…") : t("srcg.assignRole", "Assign role")}</button>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("srcg.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* comparison modal */}
      {cmpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !cmpBusy && setCmpOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-3xl space-y-4 overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><ArrowRightLeftIcon className="h-4 w-4 text-[var(--text-secondary)]" /><span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("srcg.compareModalTitle", "Compare suppliers")}</span></div>
            {!cmpRows ? (
              <>
                <div className="text-[11px] text-[var(--text-faint)]">{t("srcg.comparePrompt", "Pick suppliers to compare by sourcing score, risk, certs, negotiation.")}</div>
                <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-[var(--border-subtle)] p-2">
                  {allSuppliers.map((s) => { const sid = str(s, "id"); const on = picked.has(sid);
                    return <button key={sid} type="button" onClick={() => togglePick(sid)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] ${on ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]"}`}><span className={`h-3 w-3 rounded-sm ring-1 ring-[var(--border-subtle)] ${on ? "bg-[var(--text-primary)]" : ""}`} />{str(s, "name") || sid.slice(0, 8)}{sid === supplierId ? ` ${t("srcg.thisSuffix", "(this)")}` : ""}</button>; })}
                  {allSuppliers.length === 0 ? <div className="px-2 py-3 text-center text-[11px] text-[var(--text-faint)]">{t("srcg.loadingSuppliers", "Loading suppliers…")}</div> : null}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={cmpBusy || picked.size < 1} onClick={runCompare} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{cmpBusy ? t("srcg.comparing", "Comparing…") : t("srcg.compareN", "Compare {n}").replace("{n}", String(picked.size))}</button>
                  <button type="button" onClick={() => setCmpOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("srcg.cancel", "Cancel")}</button>
                </div>
              </>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead><tr className="border-b border-[var(--border-subtle)] text-left text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                      <th className="py-2 pr-3 font-medium">{t("srcg.thSupplier", "Supplier")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thSourcing", "Sourcing")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thRisk", "Risk")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thTrust", "Trust")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thNego", "Nego")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thCerts", "Certs")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thCountry", "Country")}</th><th className="py-2 pr-3 font-medium">{t("srcg.thPref", "Pref")}</th>
                    </tr></thead>
                    <tbody>
                      {(cmpRows as Row[]).map((s, i) => (
                        <tr key={str(s, "id")} className="border-b border-[var(--border-subtle)]/50">
                          <td className="py-2 pr-3 font-medium text-[var(--text-primary)]">{i === 0 ? "★ " : ""}{str(s, "name") || str(s, "id").slice(0, 8)}</td>
                          <td className="py-2 pr-3 tabular-nums text-[var(--text-primary)]">{s.sourcingScore != null ? String(s.sourcingScore) : "—"}</td>
                          <td className="py-2 pr-3 text-[var(--text-secondary)]">{s.riskLevel ? RISK_LEVEL_LABELS[String(s.riskLevel)] : "—"}</td>
                          <td className="py-2 pr-3 text-[var(--text-secondary)]">{s.trustLevel ? String(s.trustLevel) : "—"}</td>
                          <td className="py-2 pr-3 tabular-nums text-[var(--text-secondary)]">{s.negotiationScore != null ? String(s.negotiationScore) : "—"}</td>
                          <td className="py-2 pr-3 tabular-nums text-[var(--text-secondary)]">{String(s.certsActive ?? 0)}</td>
                          <td className="py-2 pr-3 text-[var(--text-secondary)]">{str(s, "country") || "—"}</td>
                          <td className="py-2 pr-3 tabular-nums text-[var(--text-secondary)]">{String(s.preferredProducts ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setCmpRows(null)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("srcg.back", "← Back")}</button>
                  <button type="button" onClick={() => setCmpOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("srcg.close", "Close")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
