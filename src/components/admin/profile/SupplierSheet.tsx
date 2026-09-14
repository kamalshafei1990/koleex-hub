"use client";

/* ---------------------------------------------------------------------------
   SupplierSheet — the Supplier tab of the product profile, editable in place.

   THE EDITOR'S SUPPLIER TAB, READ-ONLY UNTIL EDIT. One card per linked
   supplier, the editor's blocks in the editor's order:

     identity          logo · name (→ Suppliers app) · primary
     as supplied       photo · product name (+ languages) · model number
     cost              factory cost ¥ + note (+ languages) · other prices ·
                       cost includes · tax · packing / delivery / VAT extras ·
                       the landed cost pricing works from        (CALCULATED)
     from the supplier supply type · MOQ · lead time · payment terms ·
                       currency · incoterms                     (Suppliers app)
     quotation         quoted on · valid until · volume tiers · quotation file
     samples & service sample · sample cost · supplier warranty
     sourcing strategy status · why · min order value · tooling owner / cost

   Every row stays a row; the value becomes the control. The whole link set
   saves through PUT /api/product-suppliers (replace-the-set), so a viewer
   without cost access — whose payload has no cost numbers — never gets Edit
   here: a save from that payload would blank the costs.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IMG } from "@/lib/cdn";
import { landedCostCny, saveProductSuppliers, uploadProductFile, fetchSupplierNames, type ProductSupplierLinkRow, type SupplierLite } from "@/lib/products-admin";
import { LOCALES } from "@/types/product-form";
import KdsSelect from "@/components/kds/Select";
import Toggle from "@/components/kds/Toggle";
import DatePicker from "@/components/ui/DatePicker";
import BoundIcon from "@/components/common/BoundIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import { Group, FieldRow, Blank, YesNo, CalcBadge, INP_B, TA } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type Row = Record<string, unknown>;
type I18n = Record<string, string>;
type Opt = { price: string; note: string; note_i18n: I18n };
type Tier = { min_qty: string; price: string };
type LinkD = {
  _k: string; supplier_id: string; is_primary: boolean; show_in_catalog: boolean;
  supplier_product_photo: string; supplier_product_name: string; supplier_product_name_i18n: I18n; supplier_product_code: string;
  unit_cost_cny: string; notes: string; notes_i18n: I18n; price_options: Opt[];
  cost_basis: string; cost_includes_tax: boolean;
  cost_extras: { tax_rate_percent: string; delivery_cny: string; packing_cny: string; combined_cny: string; combined: boolean };
  price_quoted_on: string; price_valid_until: string; price_tiers: Tier[]; quotation_file_url: string; quotation_file_name: string;
  sample_available: boolean; sample_cost: string; supplier_warranty_months: string;
  sourcing_status: string; preferred_reason: string; min_order_value: string; tooling_owner: string; tooling_cost: string;
  /* pass-through link columns the editor does not touch */
  supply_type: string; incoterms: string; moq: string; lead_time_days: string; payment_terms: string; currency: string;
};
type Draft = { links: LinkD[] };

const SOURCING = ["preferred", "backup", "trial", "phasing_out"] as const;
const SOURCING_FB: Record<string, string> = { preferred: "Preferred", backup: "Backup", trial: "Trial", phasing_out: "Phasing out" };
const TOOLING = ["koleex", "supplier", "shared"] as const;
const TOOLING_FB: Record<string, string> = { koleex: "KOLEEX-owned", supplier: "Supplier-owned", shared: "Shared" };
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const obj = (v: unknown): I18n => (v && typeof v === "object" && !Array.isArray(v) ? (v as I18n) : {});
const numOrNull = (v: string) => { const x = v.trim(); if (!x) return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && v !== null && v !== "" ? n.toLocaleString() : "—"; };
const fmtDay = (v: string) => { if (!v) return ""; const [y, m, d] = v.slice(0, 10).split("-"); return d && m && y ? `${d}/${m}/${y}` : v; };

export default function SupplierSheet({
  suppliers, costVisible, productId, t, lang, motion, canEdit, onDirtyChange, onSaved, notSet, glyph,
}: {
  suppliers: Array<Row & { supplier: { name: string; logo: string | null; supply_type?: string | null; incoterms?: string | null } | null }>;
  costVisible: boolean;
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  lang: string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (rows: Row[]) => void;
  notSet: string;
  glyph: (label: string) => React.ReactNode;
}) {
  const linkOf = (r: Row, i: number): LinkD => {
    const ex = (r.cost_extras ?? {}) as Record<string, unknown>;
    return {
      _k: str(r.id) || `n${i}`, supplier_id: str(r.supplier_id), is_primary: !!r.is_primary, show_in_catalog: !!r.show_in_catalog,
      supplier_product_photo: str(r.supplier_product_photo), supplier_product_name: str(r.supplier_product_name),
      supplier_product_name_i18n: obj(r.supplier_product_name_i18n), supplier_product_code: str(r.supplier_product_code),
      unit_cost_cny: str(r.unit_cost_cny), notes: str(r.notes), notes_i18n: obj(r.notes_i18n),
      price_options: (Array.isArray(r.price_options) ? r.price_options : []).map((o) => ({ price: str((o as Row).price), note: str((o as Row).note), note_i18n: obj((o as Row).note_i18n) })),
      cost_basis: str(r.cost_basis) || "delivered", cost_includes_tax: r.cost_includes_tax !== false,
      cost_extras: { tax_rate_percent: str(ex.tax_rate_percent), delivery_cny: str(ex.delivery_cny), packing_cny: str(ex.packing_cny), combined_cny: str(ex.combined_cny), combined: !!ex.combined },
      price_quoted_on: str(r.price_quoted_on).slice(0, 10), price_valid_until: str(r.price_valid_until).slice(0, 10),
      price_tiers: (Array.isArray(r.price_tiers) ? r.price_tiers : []).map((x) => ({ min_qty: str((x as Row).min_qty), price: str((x as Row).price) })),
      quotation_file_url: str(r.quotation_file_url), quotation_file_name: str(r.quotation_file_name),
      sample_available: !!r.sample_available, sample_cost: str(r.sample_cost), supplier_warranty_months: str(r.supplier_warranty_months),
      sourcing_status: str(r.sourcing_status), preferred_reason: str(r.preferred_reason), min_order_value: str(r.min_order_value),
      tooling_owner: str(r.tooling_owner), tooling_cost: str(r.tooling_cost),
      supply_type: str(r.supply_type), incoterms: str(r.incoterms), moq: str(r.moq), lead_time_days: str(r.lead_time_days), payment_terms: str(r.payment_terms), currency: str(r.currency),
    };
  };
  const toRow = (l: LinkD): ProductSupplierLinkRow => ({
    supplier_id: l.supplier_id, is_primary: l.is_primary, show_in_catalog: l.show_in_catalog,
    supplier_product_code: l.supplier_product_code.trim() || null, moq: numOrNull(l.moq), lead_time_days: numOrNull(l.lead_time_days),
    unit_cost_cny: numOrNull(l.unit_cost_cny), currency: l.currency || null, payment_terms: l.payment_terms || null,
    notes: l.notes.trim() || null, notes_i18n: Object.keys(l.notes_i18n).length ? l.notes_i18n : null,
    price_options: l.price_options.map((o) => ({ price: numOrNull(o.price), note: o.note, note_i18n: Object.keys(o.note_i18n).length ? o.note_i18n : null })),
    supplier_product_name: l.supplier_product_name.trim() || null,
    supplier_product_name_i18n: Object.keys(l.supplier_product_name_i18n).length ? l.supplier_product_name_i18n : null,
    supplier_product_photo: l.supplier_product_photo || null, supply_type: l.supply_type || null,
    sample_available: l.sample_available, sample_cost: numOrNull(l.sample_cost), incoterms: l.incoterms || null,
    supplier_warranty_months: numOrNull(l.supplier_warranty_months),
    price_tiers: l.price_tiers.map((x) => ({ min_qty: numOrNull(x.min_qty), price: numOrNull(x.price) })),
    price_quoted_on: l.price_quoted_on || null, price_valid_until: l.price_valid_until || null,
    quotation_file_url: l.quotation_file_url || null, quotation_file_name: l.quotation_file_name || null,
    sourcing_status: l.sourcing_status || null, preferred_reason: l.preferred_reason.trim() || null,
    min_order_value: numOrNull(l.min_order_value), tooling_owner: l.tooling_owner || null, tooling_cost: numOrNull(l.tooling_cost),
    cost_basis: (["factory_only", "packing", "delivered"].includes(l.cost_basis) ? l.cost_basis : "delivered") as ProductSupplierLinkRow["cost_basis"],
    cost_includes_tax: l.cost_includes_tax,
    cost_extras: {
      tax_rate_percent: numOrNull(l.cost_extras.tax_rate_percent), delivery_cny: numOrNull(l.cost_extras.delivery_cny),
      packing_cny: numOrNull(l.cost_extras.packing_cny), combined_cny: numOrNull(l.cost_extras.combined_cny), combined: l.cost_extras.combined,
    },
  });

  const [masters, setMasters] = useState<SupplierLite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [trMsg, setTrMsg] = useState<{ key: string; text: string } | null>(null);
  const [addId, setAddId] = useState("");

  const sheet = useSheetEdit<"supplier", Draft>({
    t, onDirtyChange,
    makeDraft: () => ({ links: suppliers.map(linkOf) }),
    valid: (_c, d) => d.links.every((l) => /^[0-9a-f-]{36}$/i.test(l.supplier_id)),
    commit: async (_c, d) => {
      if (!productId) return;
      const rows = d.links.map(toRow);
      /* At most one primary; the first link is primary when none is marked. */
      if (rows.length && !rows.some((r) => r.is_primary)) rows[0].is_primary = true;
      const ok = await saveProductSuppliers(productId, rows);
      if (!ok) throw new Error(t("pr.saveFailed", "Couldn't save — try again."));
      onSaved(rows.map((r) => {
        const m = masters?.find((x) => x.id === r.supplier_id);
        const prev = suppliers.find((s) => s.supplier_id === r.supplier_id);
        return { ...r, supplier: prev?.supplier ?? (m ? { name: m.name, logo: m.logo, supply_type: m.supply_type ?? null, incoterms: null } : null) };
      }) as Row[]);
    },
  });
  const e = sheet.editing === "supplier";
  const d = sheet.draft;
  const links: LinkD[] = e && d ? d.links : suppliers.map(linkOf);

  /* The supplier master (Suppliers app): logo, defaults, contact — read-only here. */
  useEffect(() => {
    if (masters) return;
    let alive = true;
    fetchSupplierNames().then((m) => { if (alive) setMasters(m); }).catch(() => {});
    return () => { alive = false; };
  }, [masters]);
  const masterOf = (id: string) => masters?.find((m) => m.id === id) ?? null;
  const unlinked = useMemo(() => (masters ?? []).filter((m) => !links.some((l) => l.supplier_id === m.id)), [masters, links]);

  const upd = (k: string, u: Partial<LinkD> | ((l: LinkD) => LinkD)) =>
    sheet.patch((dd) => ({ ...dd, links: dd.links.map((l) => (l._k === k ? (typeof u === "function" ? u(l) : { ...l, ...u }) : l)) }));
  const localeDisplay = (code: string) => {
    try { return new Intl.DisplayNames([lang === "zh" ? "zh" : lang === "ar" ? "ar" : "en"], { type: "language" }).of(code) || code; }
    catch { return LOCALES.find((l) => l.code === code)?.name || code; }
  };
  const translate = async (key: string, text: string, target: string, write: (v: string) => void) => {
    if (!text.trim() || busy) return;
    setBusy(key); setTrMsg(null);
    try {
      const res = await fetch("/api/ai/translate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ text, target_lang: target, source_lang: "auto" }) });
      const j = (await res.json()) as { translated?: string; fallback?: boolean; reason?: string };
      if (res.ok && j.translated && !j.fallback) { write(j.translated); setTrMsg({ key, text: t("sup.trDone", "Translated — review before saving.") }); }
      else setTrMsg({ key, text: j.reason === "no_provider" ? t("sup.trNoProvider", "Auto-translate is off — no translation service is configured. Type it manually for now.") : t("sup.trFailed", "Couldn't translate right now. Try again, or type it manually.") });
    } catch { setTrMsg({ key, text: t("sup.trFailed", "Couldn't translate right now. Try again, or type it manually.") }); }
    finally { setBusy(null); }
  };
  const upload = async (key: string, file: File | undefined, write: (url: string, name: string) => void, image = true) => {
    if (!file) return;
    if (image && !/^image\//.test(file.type)) { sheet.setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", file.name)); return; }
    setBusy(key);
    try { const up = await uploadProductFile(file); if (up?.url) write(up.url, file.name); }
    finally { setBusy(null); }
  };

  /* ── Shared bits ── */
  const inp = `${INP_B} w-full`;
  const small = `${INP_B} h-8 text-[12px] w-full`;
  const sel = `${INP_B} w-full pe-8 text-start`;
  const tob = (x: string, mono?: boolean) => (x ? <span className={mono ? "font-mono text-[12.5px] font-medium" : ""}>{x}</span> : <Blank label={notSet} />);
  const yes = t("pp.yes", "Yes"); const no = t("pp.no", "No");
  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0";
  const sub = (title: string, right?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 pt-4 mt-1 mb-1">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{title}</span>
      {right}
    </div>
  );
  const aiBtn = (key: string, onClick: () => void, disabled?: boolean) => (
    <button type="button" onClick={onClick} disabled={!!busy || disabled}
      className="kx-ai-glow inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10.5px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/30 disabled:opacity-50 whitespace-nowrap">
      {busy === key ? <SpinnerIcon className="h-3 w-3" /> : <SparklesIcon className="h-3 w-3" />} {busy === key ? t("sup.translating", "Translating…") : t("sup.autoTranslate", "Auto-translate")}
    </button>
  );
  /* A source text + its translations, view and edit. */
  const i18nBlock = (key: string, source: string, map: I18n, write: (m: I18n) => void, ph: (lang: string) => string) => {
    const filled = Object.entries(map).filter(([, v]) => (v || "").trim());
    if (!e) {
      return filled.length ? (
        <div className="mt-1 space-y-0.5">
          {filled.map(([code, v]) => (
            <div key={code} dir={code === "ar" || code === "ur" ? "rtl" : "ltr"} className="text-[12px] text-[var(--text-secondary)]"><span className="text-[9.5px] uppercase tracking-wider text-[var(--text-ghost)] me-2">{localeDisplay(code)}</span>{v}</div>
          ))}
        </div>
      ) : null;
    }
    const used = new Set(Object.keys(map));
    const free = LOCALES.filter((l) => !used.has(l.code));
    return (
      <div className="mt-2 space-y-1.5">
        {Object.keys(map).map((code) => (
          <div key={code} className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-ghost)] truncate">{localeDisplay(code)}</span>
            <input dir={code === "ar" || code === "ur" ? "rtl" : "ltr"} value={map[code] ?? ""} placeholder={ph(localeDisplay(code))}
              onChange={(ev) => write({ ...map, [code]: ev.target.value })} className={`${small} font-normal`} />
            {aiBtn(`${key}:${code}`, () => void translate(`${key}:${code}`, source, code, (v) => write({ ...map, [code]: v })), !source.trim())}
            <button type="button" aria-label={t("cc.remove", "Remove")} onClick={() => { const m = { ...map }; delete m[code]; write(m); }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {free.length > 0 && (
          <KdsSelect value="" onChange={(code) => write({ ...map, [code]: "" })} options={free.map((l) => ({ value: l.code, label: localeDisplay(l.code) }))}
            placeholder={`+ ${t("sup.addLanguage", "Add another language")}`} triggerClassName={`${INP_B} h-7 text-[11px] pe-8 text-start w-auto min-w-[200px]`} />
        )}
        {trMsg && trMsg.key.startsWith(key) && <p className="text-[11px] text-[var(--text-muted)]">{trMsg.text}</p>}
      </div>
    );
  };
  const money$ = (v: string, key: string, onChange: (v: string) => void, ph = "0") => (
    <div className="relative">
      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--text-ghost)]">¥</span>
      <input inputMode="decimal" value={v} placeholder={ph} onChange={(ev) => onChange(ev.target.value.replace(/[^0-9.]/g, ""))} className={`${key === "sm" ? small : inp} ps-7 tabular-nums`} />
    </div>
  );

  return (
    <div onKeyDown={sheet.onKeyDown}>
      <Group
        motion={motion}
        icon={<BoundIcon semanticKey="field.supplier" className="h-4 w-4" fallback={<FactoryIcon className="h-4 w-4" />} />}
        title={t("pp.sec.supplier", "Supplier & Sourcing")}
        count={String(links.length)}
        {...sheet.gp("supplier", canEdit && costVisible)}
      >
        {links.length === 0 && !e ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noSupplier", "No supplier linked.")}</p>
        ) : (
          <div className="space-y-4">
            {links.map((l) => {
              const m = masterOf(l.supplier_id);
              const joined = suppliers.find((s) => str(s.supplier_id) === l.supplier_id)?.supplier ?? null;
              const name = joined?.name ?? m?.name ?? "—";
              const logo = joined?.logo ?? m?.logo ?? null;
              const landed = landedCostCny({ unit_cost_cny: numOrNull(l.unit_cost_cny), cost_basis: l.cost_basis, cost_includes_tax: l.cost_includes_tax, cost_extras: {
                tax_rate_percent: numOrNull(l.cost_extras.tax_rate_percent), delivery_cny: numOrNull(l.cost_extras.delivery_cny), packing_cny: numOrNull(l.cost_extras.packing_cny), combined_cny: numOrNull(l.cost_extras.combined_cny), combined: l.cost_extras.combined,
              } });
              const missing: string[] = [];
              if (l.cost_basis === "factory_only" && (l.cost_extras.combined ? !l.cost_extras.combined_cny : (!l.cost_extras.packing_cny && !l.cost_extras.delivery_cny))) missing.push(t("sup.missPackDelivery", "packing + delivery"));
              if (l.cost_basis === "packing" && !l.cost_extras.delivery_cny) missing.push(t("sup.missDelivery", "delivery"));
              if (!l.cost_includes_tax && !l.cost_extras.tax_rate_percent) missing.push(t("sup.taxRate", "VAT rate (%)"));
              const expired = l.price_valid_until ? new Date(l.price_valid_until) < new Date(new Date().toDateString()) : false;
              return (
                <div key={l._k} className="rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4">
                  {/* identity */}
                  <div className="flex items-center gap-2.5 mb-3 min-w-0">
                    <span className="h-9 w-9 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shrink-0">
                      {logo ? <img src={IMG.thumb(logo)} alt="" className="h-full w-full object-contain p-0.5" /> : <FactoryIcon className="h-4 w-4 text-gray-400" />}
                    </span>
                    <span className="min-w-0">
                      <Link href={`/suppliers/${l.supplier_id}`} className="block text-[13px] font-semibold text-[var(--text-primary)] truncate hover:underline">{name} <ExternalLinkIcon className="inline h-3 w-3 text-[var(--text-ghost)] align-[-1px]" /></Link>
                      <span className="block text-[10px] text-[var(--text-ghost)]">{t("sup.managedIn", "Managed in the Suppliers app")}</span>
                    </span>
                    <span className="flex-1" />
                    {l.is_primary ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0"><StarIcon className="h-3 w-3" /> {t("pp.primary", "Primary")}</span>
                    ) : e ? (
                      <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, links: dd.links.map((x) => ({ ...x, is_primary: x._k === l._k })) }))} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"><StarIcon className="h-3 w-3" /> {t("sup.makePrimary", "Make primary")}</button>
                    ) : null}
                    {e && (
                      <button type="button" aria-label={t("sup.removeLink", "Remove supplier link")} onClick={() => sheet.patch((dd) => ({ ...dd, links: dd.links.filter((x) => x._k !== l._k) }))} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300 shrink-0"><CrossIcon className="h-3.5 w-3.5" /></button>
                    )}
                  </div>

                  {/* as supplied */}
                  <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-ghost)] mb-2">{t("pp.f.supPhoto", "Supplier product photo")}</div>
                      <label className={`block aspect-square w-full rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] overflow-hidden flex items-center justify-center ${e ? "cursor-pointer hover:border-[var(--border-focus)]" : ""}`}>
                        {l.supplier_product_photo ? <img src={IMG.card(l.supplier_product_photo)} alt="" className="h-full w-full object-contain p-2" /> : <span className="text-[12px] text-[var(--text-ghost)] italic">{busy === `photo:${l._k}` ? t("sup.uploading", "Uploading…") : e ? t("sup.dropOrClick", "drop or click") : notSet}</span>}
                        {e && <input type="file" accept="image/*" className="hidden" onChange={(ev) => void upload(`photo:${l._k}`, ev.target.files?.[0], (url) => upd(l._k, { supplier_product_photo: url }))} />}
                      </label>
                      {e && l.supplier_product_photo && <button type="button" onClick={() => upd(l._k, { supplier_product_photo: "" })} className="mt-1 text-[11px] text-[var(--text-ghost)] hover:text-rose-300">{t("sup.removePhoto", "Remove photo")}</button>}
                    </div>
                    <div className={grid}>
                      <FieldRow label={t("pp.f.supName", "Supplier product name")} glyph={glyph(t("pp.f.supName", "Supplier product name"))} wide
                        value={<>{tob(l.supplier_product_name)}{i18nBlock(`name:${l._k}`, l.supplier_product_name, l.supplier_product_name_i18n, (mm) => upd(l._k, { supplier_product_name_i18n: mm }), (ln) => t("sup.nameInLang", "Product name in {lang}").replace("{lang}", ln))}</>}
                        input={e ? <><input value={l.supplier_product_name} placeholder={t("sup.productNamePh", "What the supplier calls this product")} onChange={(ev) => upd(l._k, { supplier_product_name: ev.target.value })} className={inp} />{i18nBlock(`name:${l._k}`, l.supplier_product_name, l.supplier_product_name_i18n, (mm) => upd(l._k, { supplier_product_name_i18n: mm }), (ln) => t("sup.nameInLang", "Product name in {lang}").replace("{lang}", ln))}</> : undefined} />
                      <FieldRow label={t("sup.modelNumber", "Model number")} glyph={glyph(t("pp.f.supCode", "Supplier product code"))}
                        value={tob(l.supplier_product_code, true)}
                        input={e ? <input value={l.supplier_product_code} placeholder={`${t("sup.eg", "e.g.")} JK-58420`} onChange={(ev) => upd(l._k, { supplier_product_code: ev.target.value })} className={`${inp} font-mono`} /> : undefined} />
                      <FieldRow label={t("sup.supplyType", "Supply type")} glyph={glyph(t("pp.f.supplyType", "Supply type"))} help={t("sup.fromApp", "from the Suppliers app")}
                        value={tob(joined?.supply_type ?? m?.supply_type ?? l.supply_type)} />
                    </div>
                  </div>

                  {/* cost */}
                  {costVisible && (
                    <>
                      {sub(t("sup.costPrice", "Cost price"), <span className="text-[10px] text-[var(--text-ghost)]">{t("sup.cnyTitle", "Factory cost is always entered in CNY (¥) — the pricing engine works from the CNY cost.")}</span>)}
                      <div className={grid}>
                        <FieldRow label={t("pricing.factoryCostCny", "Factory cost (CNY)")} glyph={glyph(t("pp.f.unitCost", "Unit cost (CNY)"))}
                          badge={l.price_options.length ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]" title={t("sup.mainPriceIs", "The main factory cost — the pricing engine works from this figure.")}>{t("sup.mainChip", "Main")}</span> : undefined}
                          value={l.unit_cost_cny ? <span className="tabular-nums">¥{money(l.unit_cost_cny)}</span> : <Blank label={notSet} />}
                          input={e ? money$(l.unit_cost_cny, "lg", (v) => upd(l._k, { unit_cost_cny: v }), `${t("sup.eg", "e.g.")} 1850`) : undefined} />
                        <FieldRow label={t("pr.landed", "Landed cost")} glyph={glyph(t("pr.landed", "Landed cost"))} badge={<CalcBadge label={t("pk.calculated", "Calculated")} />}
                          value={landed.landed !== null ? <span className="tabular-nums">¥{money(landed.landed)}</span> : <Blank label={notSet} />}
                          help={landed.landed !== null ? (landed.parts.length || landed.taxPercent !== null ? `¥${money(l.unit_cost_cny)}${landed.parts.map((pt) => ` + ¥${pt.amount.toLocaleString()} ${pt.label}`).join("")}${landed.taxPercent !== null ? ` + ${landed.taxPercent}% VAT` : ""}` : t("pr.landedSame", "Same as the factory cost — nothing to add.")) : undefined} />
                        <FieldRow label={t("sup.costNote", "Price note")} glyph={glyph(t("sup.costNote", "Price note"))} wide
                          value={<>{tob(l.notes)}{i18nBlock(`note:${l._k}`, l.notes, l.notes_i18n, (mm) => upd(l._k, { notes_i18n: mm }), (ln) => t("sup.noteInLang", "Price note in {lang}").replace("{lang}", ln))}</>}
                          input={e ? <><textarea value={l.notes} placeholder={t("sup.costNotePh2", "Note for this price (optional)…")} onChange={(ev) => upd(l._k, { notes: ev.target.value })} className={TA} />{i18nBlock(`note:${l._k}`, l.notes, l.notes_i18n, (mm) => upd(l._k, { notes_i18n: mm }), (ln) => t("sup.noteInLang", "Price note in {lang}").replace("{lang}", ln))}</> : undefined} />
                        <FieldRow label={t("pr.options", "The supplier's price options")} glyph={glyph(t("pr.options", "The supplier's price options"))} wide
                          value={l.price_options.length ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {l.price_options.map((o, i) => (
                                <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                                  <div className="text-[15px] font-bold tabular-nums">¥{money(o.price)}</div>
                                  <div className="text-[11px] text-[var(--text-muted)] leading-snug">{((o.note_i18n ?? {})[lang] || "").trim() || o.note || "—"}</div>
                                </div>
                              ))}
                            </div>
                          ) : <Blank label={notSet} />}
                          input={e ? (
                            <div className="space-y-2">
                              {l.price_options.map((o, i) => (
                                <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-[130px] shrink-0">{money$(o.price, "sm", (v) => upd(l._k, (x) => ({ ...x, price_options: x.price_options.map((y, yi) => (yi === i ? { ...y, price: v } : y)) })), t("sup.unitPricePh", "Unit price"))}</div>
                                    <input value={o.note} placeholder={t("sup.priceOptNotePh", "What this price covers…")} onChange={(ev) => upd(l._k, (x) => ({ ...x, price_options: x.price_options.map((y, yi) => (yi === i ? { ...y, note: ev.target.value } : y)) }))} className={`${small} font-normal`} />
                                    <button type="button" aria-label={t("sup.removePrice", "Remove this price")} onClick={() => upd(l._k, (x) => ({ ...x, price_options: x.price_options.filter((_, yi) => yi !== i) }))} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
                                  </div>
                                  {i18nBlock(`opt:${l._k}:${i}`, o.note, o.note_i18n, (mm) => upd(l._k, (x) => ({ ...x, price_options: x.price_options.map((y, yi) => (yi === i ? { ...y, note_i18n: mm } : y)) })), (ln) => t("sup.noteInLang", "Price note in {lang}").replace("{lang}", ln))}
                                </div>
                              ))}
                              <button type="button" onClick={() => upd(l._k, (x) => ({ ...x, price_options: [...x.price_options, { price: "", note: "", note_i18n: {} }] }))} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3 w-3" /> {t("sup.addAnotherPrice", "Add another price")}</button>
                            </div>
                          ) : undefined} />
                        <FieldRow label={t("sup.costIncludes", "Cost includes")} glyph={glyph(t("pr.basis", "Cost basis"))}
                          value={l.cost_basis === "factory_only" ? t("sup.costFactory", "Factory only (ex-works)") : l.cost_basis === "packing" ? t("sup.costPacking", "+ Packing (no delivery)") : t("sup.costDelivered", "Delivered to Koleex (full landed)")}
                          input={e ? <KdsSelect value={l.cost_basis} onChange={(v) => upd(l._k, { cost_basis: v })} options={[{ value: "delivered", label: t("sup.costDelivered", "Delivered to Koleex (full landed)") }, { value: "packing", label: t("sup.costPacking", "+ Packing (no delivery)") }, { value: "factory_only", label: t("sup.costFactory", "Factory only (ex-works)") }]} triggerClassName={sel} /> : undefined} />
                        <FieldRow label={t("sup.taxVat", "Tax (VAT)")} glyph={glyph(t("pr.tax", "Tax"))}
                          value={<YesNo v={l.cost_includes_tax} yes={t("sup.taxIncluded", "Tax included")} no={t("sup.taxNotIncluded", "Tax NOT included")} />}
                          help={!l.cost_includes_tax && !e ? (l.cost_extras.tax_rate_percent ? `${l.cost_extras.tax_rate_percent}% VAT` : undefined) : undefined}
                          input={e ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <Toggle checked={l.cost_includes_tax} onChange={(v) => upd(l._k, { cost_includes_tax: v })} />
                              <span className="text-[12px] text-[var(--text-muted)]">{l.cost_includes_tax ? t("sup.taxIncluded", "Tax included") : t("sup.taxNotIncluded", "Tax NOT included")}</span>
                              {!l.cost_includes_tax && (
                                <span className="inline-flex items-center gap-1.5"><span className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">{t("sup.taxRate", "VAT rate (%)")}</span>
                                  <input inputMode="decimal" value={l.cost_extras.tax_rate_percent} placeholder="13" onChange={(ev) => upd(l._k, { cost_extras: { ...l.cost_extras, tax_rate_percent: ev.target.value.replace(/[^0-9.]/g, "") } })} className={`${small} w-[72px] tabular-nums`} /></span>
                              )}
                            </div>
                          ) : undefined} />
                        {(l.cost_basis !== "delivered") && (
                          <FieldRow label={l.cost_basis === "factory_only" ? (l.cost_extras.combined ? t("sup.packDeliveryCombined", "Packing + delivery (¥)") : `${t("sup.packingCost", "Packing (¥)")} · ${t("sup.deliveryCost", "Delivery (¥)")}`) : t("sup.deliveryCost", "Delivery (¥)")}
                            glyph={glyph(t("sup.deliveryCost", "Delivery (¥)"))} wide
                            value={<span className="tabular-nums">{l.cost_basis === "factory_only"
                              ? (l.cost_extras.combined ? (l.cost_extras.combined_cny ? `¥${money(l.cost_extras.combined_cny)}` : notSet) : `¥${money(l.cost_extras.packing_cny)} · ¥${money(l.cost_extras.delivery_cny)}`)
                              : (l.cost_extras.delivery_cny ? `¥${money(l.cost_extras.delivery_cny)}` : notSet)}</span>}
                            input={e ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {l.cost_basis === "factory_only" ? (
                                  l.cost_extras.combined
                                    ? <div className="w-[150px]">{money$(l.cost_extras.combined_cny, "sm", (v) => upd(l._k, { cost_extras: { ...l.cost_extras, combined_cny: v } }), "e.g. 1500")}</div>
                                    : <><div className="w-[130px]">{money$(l.cost_extras.packing_cny, "sm", (v) => upd(l._k, { cost_extras: { ...l.cost_extras, packing_cny: v } }), t("sup.packingCost", "Packing (¥)"))}</div><div className="w-[130px]">{money$(l.cost_extras.delivery_cny, "sm", (v) => upd(l._k, { cost_extras: { ...l.cost_extras, delivery_cny: v } }), t("sup.deliveryCost", "Delivery (¥)"))}</div></>
                                ) : <div className="w-[150px]">{money$(l.cost_extras.delivery_cny, "sm", (v) => upd(l._k, { cost_extras: { ...l.cost_extras, delivery_cny: v } }), "e.g. 800")}</div>}
                                {l.cost_basis === "factory_only" && (
                                  <button type="button" onClick={() => upd(l._k, { cost_extras: { ...l.cost_extras, combined: !l.cost_extras.combined } })} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline">
                                    {l.cost_extras.combined ? t("sup.splitPackDelivery", "Enter packing & delivery separately") : t("sup.combinePackDelivery", "Enter packing + delivery as ONE cost")}
                                  </button>
                                )}
                              </div>
                            ) : undefined} />
                        )}
                      </div>
                      {missing.length > 0 && <p className="mt-2 text-[10.5px] text-amber-400/90">⚠ {t("sup.costWarnA2", "This cost is NOT full-landed/tax-in — enter the missing")} {missing.join(" · ")} {t("sup.costWarnB2", "so pricing can work from the true landed cost.")}</p>}
                    </>
                  )}

                  {/* from the supplier — master data */}
                  {sub(t("sup.fromSupplier", "From the supplier"), <span className="text-[10px] text-[var(--text-ghost)]">{t("sup.editInSuppliers", "edit in the Suppliers app")}</span>)}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                    {([
                      [t("sup.supplyType", "Supply type"), joined?.supply_type ?? m?.supply_type],
                      ["MOQ", m?.moq],
                      [t("sup.leadTime", "Lead time"), m?.lead_time],
                      [t("sup.paymentTerms", "Payment terms"), m?.payment_terms],
                      [t("sup.currency", "Currency"), m?.currency],
                      [t("pp.f.incoterms", "Incoterms"), joined?.incoterms],
                    ] as Array<[string, string | null | undefined]>).map(([lb, v]) => (
                      <div key={lb}><div className="text-[9.5px] uppercase tracking-wider text-[var(--text-ghost)]">{lb}</div><div className="text-[12px] text-[var(--text-primary)] truncate">{v || "—"}</div></div>
                    ))}
                  </div>

                  {/* quotation & volume */}
                  {costVisible && (
                    <>
                      {sub(t("sup.quoteVolume", "Quotation & volume pricing"), l.price_valid_until ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)]" style={{ color: expired ? "var(--state-error,#FF3333)" : "var(--state-success,#00CC66)" }}>{expired ? t("sup.quoteExpired", "Quote expired") : t("sup.quoteValid", "Quote valid")}</span> : undefined)}
                      <div className={grid}>
                        <FieldRow label={t("sup.quotedOn", "Quoted on")} glyph={glyph(t("sup.quotedOn", "Quoted on"))} value={tob(fmtDay(l.price_quoted_on))}
                          input={e ? <DatePicker value={l.price_quoted_on} onChange={(iso) => upd(l._k, { price_quoted_on: iso })} heightCls="h-9" /> : undefined} />
                        <FieldRow label={t("sup.validUntil", "Valid until")} glyph={glyph(t("sup.validUntil", "Valid until"))} value={tob(fmtDay(l.price_valid_until))}
                          input={e ? <DatePicker value={l.price_valid_until} onChange={(iso) => upd(l._k, { price_valid_until: iso })} heightCls="h-9" /> : undefined} />
                        <FieldRow label={t("sup.volumePricing", "Volume pricing (qty → unit price)")} glyph={glyph(t("sup.volumePricing", "Volume pricing"))}
                          value={l.price_tiers.length ? <span className="flex flex-wrap gap-1.5">{l.price_tiers.map((x, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] tabular-nums">{x.min_qty || "—"}+ → ¥{money(x.price)}</span>)}</span> : <Blank label={notSet} />}
                          input={e ? (
                            <div className="space-y-1.5">
                              {l.price_tiers.map((x, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <input inputMode="numeric" value={x.min_qty} placeholder={t("sup.minQtyPh", "Min qty (e.g. 10)")} onChange={(ev) => upd(l._k, (y) => ({ ...y, price_tiers: y.price_tiers.map((z, zi) => (zi === i ? { ...z, min_qty: ev.target.value.replace(/[^0-9]/g, "") } : z)) }))} className={`${small} tabular-nums`} />
                                  <div className="w-full">{money$(x.price, "sm", (v) => upd(l._k, (y) => ({ ...y, price_tiers: y.price_tiers.map((z, zi) => (zi === i ? { ...z, price: v } : z)) })), t("sup.unitPricePh", "Unit price"))}</div>
                                  <button type="button" aria-label={t("sup.removeTier", "Remove tier")} onClick={() => upd(l._k, (y) => ({ ...y, price_tiers: y.price_tiers.filter((_, zi) => zi !== i) }))} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => upd(l._k, (y) => ({ ...y, price_tiers: [...y.price_tiers, { min_qty: "", price: "" }] }))} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3 w-3" /> {t("sup.addTier", "Add price tier")}</button>
                            </div>
                          ) : undefined} />
                        <FieldRow label={t("sup.quoteFile", "Supplier quotation / spec file")} glyph={glyph(t("sup.quoteFile", "Supplier quotation / spec file"))}
                          value={l.quotation_file_url ? <a href={l.quotation_file_url} target="_blank" rel="noreferrer" className="text-[12.5px] text-[var(--accent,#0066FF)] hover:underline truncate block">{l.quotation_file_name || t("sup.viewQuote", "View quotation")}</a> : <Blank label={notSet} />}
                          input={e ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              {l.quotation_file_url && <a href={l.quotation_file_url} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--accent,#0066FF)] hover:underline truncate max-w-[200px]">{l.quotation_file_name || t("sup.viewQuote", "View quotation")}</a>}
                              <label className="h-8 px-3 inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                                {busy === `quote:${l._k}` ? t("sup.uploading", "Uploading…") : t("sup.uploadQuote", "Upload quotation (PDF/image)")}
                                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(ev) => void upload(`quote:${l._k}`, ev.target.files?.[0], (url, nm) => upd(l._k, { quotation_file_url: url, quotation_file_name: nm }), false)} />
                              </label>
                              {l.quotation_file_url && <button type="button" onClick={() => upd(l._k, { quotation_file_url: "", quotation_file_name: "" })} className="text-[11px] text-[var(--text-ghost)] hover:text-rose-300">{t("sup.removeFile", "Remove file")}</button>}
                            </div>
                          ) : undefined} />
                      </div>
                    </>
                  )}

                  {/* samples & service */}
                  {sub(t("sup.samples", "Samples"))}
                  <div className={grid}>
                    <FieldRow label={t("pp.f.sampleAvail", "Sample available")} glyph={glyph(t("pp.f.sampleAvail", "Sample available"))}
                      value={<YesNo v={l.sample_available} yes={yes} no={no} />} input={e ? <Toggle checked={l.sample_available} onChange={(v) => upd(l._k, { sample_available: v })} /> : undefined} />
                    {costVisible && (
                      <FieldRow label={t("sup.sampleCost", "Sample cost")} glyph={glyph(t("sup.sampleCost", "Sample cost"))}
                        value={l.sample_cost ? <span className="tabular-nums">¥{money(l.sample_cost)}</span> : <Blank label={notSet} />}
                        input={e ? money$(l.sample_cost, "lg", (v) => upd(l._k, { sample_cost: v }), `${t("sup.eg", "e.g.")} 200`) : undefined} />
                    )}
                    <FieldRow label={t("pp.f.supWarranty", "Supplier warranty (months)")} glyph={glyph(t("pp.f.supWarranty", "Supplier warranty (months)"))}
                      value={tob(l.supplier_warranty_months)}
                      input={e ? <input inputMode="numeric" value={l.supplier_warranty_months} placeholder={`${t("sup.eg", "e.g.")} 12`} onChange={(ev) => upd(l._k, { supplier_warranty_months: ev.target.value.replace(/[^0-9]/g, "") })} className={`${inp} tabular-nums`} /> : undefined} />
                  </div>

                  {/* sourcing strategy */}
                  {sub(t("sup.sourcingStrategy", "Sourcing strategy"))}
                  <div className={grid}>
                    <FieldRow label={t("sup.sourcingStatus", "Sourcing status")} glyph={glyph(t("pp.f.sourcing", "Sourcing status"))}
                      value={l.sourcing_status ? t(`sup.st.${l.sourcing_status}`, SOURCING_FB[l.sourcing_status] ?? l.sourcing_status) : <Blank label={notSet} />}
                      input={e ? <KdsSelect value={l.sourcing_status} onChange={(v) => upd(l._k, { sourcing_status: v })} options={SOURCING.map((s) => ({ value: s, label: t(`sup.st.${s}`, SOURCING_FB[s]) }))} placeholder={notSet} triggerClassName={sel} /> : undefined} />
                    <FieldRow label={t("sup.whyThisSupplier", "Why this supplier")} glyph={glyph(t("sup.whyThisSupplier", "Why this supplier"))}
                      value={tob(l.preferred_reason)}
                      input={e ? <input value={l.preferred_reason} placeholder={t("sup.whyPh", "e.g. best price / quality / fastest lead time")} onChange={(ev) => upd(l._k, { preferred_reason: ev.target.value })} className={inp} /> : undefined} />
                    {costVisible && (
                      <FieldRow label={t("sup.minOrderValue", "Min order value")} glyph={glyph(t("sup.minOrderValue", "Min order value"))}
                        value={l.min_order_value ? <span className="tabular-nums">¥{money(l.min_order_value)}</span> : <Blank label={notSet} />}
                        input={e ? money$(l.min_order_value, "lg", (v) => upd(l._k, { min_order_value: v }), `${t("sup.eg", "e.g.")} 5000`) : undefined} />
                    )}
                    <FieldRow label={t("sup.toolingOwner", "Tooling / mold owner")} glyph={glyph(t("sup.toolingOwner", "Tooling / mold owner"))}
                      value={l.tooling_owner ? t(`sup.to.${l.tooling_owner}`, TOOLING_FB[l.tooling_owner] ?? l.tooling_owner) : <Blank label={notSet} />}
                      input={e ? <KdsSelect value={l.tooling_owner} onChange={(v) => upd(l._k, { tooling_owner: v })} options={TOOLING.map((s) => ({ value: s, label: t(`sup.to.${s}`, TOOLING_FB[s]) }))} placeholder={notSet} triggerClassName={sel} /> : undefined} />
                    {costVisible && (
                      <FieldRow label={t("sup.toolingCost", "Tooling / mold cost")} glyph={glyph(t("sup.toolingCost", "Tooling / mold cost"))}
                        value={l.tooling_cost ? <span className="tabular-nums">¥{money(l.tooling_cost)}</span> : <Blank label={notSet} />}
                        input={e ? money$(l.tooling_cost, "lg", (v) => upd(l._k, { tooling_cost: v }), `${t("sup.eg", "e.g.")} 12000`) : undefined} />
                    )}
                  </div>
                </div>
              );
            })}

            {/* link another supplier */}
            {e && (
              <div className="flex items-center gap-2 flex-wrap rounded-xl border border-dashed border-[var(--border-subtle)] p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("sup.linkSupplier", "Link a supplier")}</span>
                <KdsSelect value={addId} onChange={setAddId}
                  options={unlinked.map((m) => ({ value: m.id, label: m.name, icon: m.logo ? <img src={IMG.thumb(m.logo)} alt="" className="h-4 w-4 object-contain" /> : undefined }))}
                  placeholder={masters ? (unlinked.length ? t("sup.searchPh", "Search suppliers by name…") : t("sup.allLinked", "All suppliers linked")) : t("sup.loadingSuppliers", "Loading suppliers…")}
                  triggerClassName={`${INP_B} h-8 text-[12px] pe-8 text-start min-w-[260px]`} />
                <button type="button" disabled={!addId} onClick={() => {
                  const m = masterOf(addId); if (!m) return;
                  sheet.patch((dd) => ({ ...dd, links: [...dd.links, { ...linkOf({ supplier_id: m.id, cost_basis: "delivered", cost_includes_tax: true, currency: "CNY", supply_type: m.supply_type ?? "" }, dd.links.length), _k: crypto.randomUUID(), is_primary: dd.links.length === 0 }] }));
                  setAddId("");
                }} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"><PlusIcon className="h-3 w-3" /> {t("sup.linkSupplier", "Link a supplier")}</button>
              </div>
            )}
          </div>
        )}
      </Group>
    </div>
  );
}
