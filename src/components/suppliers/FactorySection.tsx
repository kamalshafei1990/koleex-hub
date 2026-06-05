"use client";

/* ---------------------------------------------------------------------------
   FactorySection — operational Factory Intelligence for the Supplier 360.

   View mode: structured monochrome cards (overview, capacity, capabilities,
   markets, materials). Edit mode: inline structured form with section-level
   save (PUT /factory for the profile table + PATCH for the three capability
   flags that live on contacts). Optimistic refetch via onSaved.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import { humanizeError } from "@/lib/ui/humanize-error";
import { FACTORY_TYPE_LABELS, factoryTypeLabel } from "@/lib/suppliers/intelligence";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Row = Record<string, unknown>;

const str = (r: Row, k: string): string => {
  const v = r[k];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
};
const numOrEmpty = (r: Row, k: string): string => {
  const v = r[k];
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
};
const arr = (r: Row, k: string): string[] => (Array.isArray(r[k]) ? (r[k] as unknown[]).map(String) : []);
const isTrue = (r: Row, k: string): boolean => r[k] === true;
const fmtNum = (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : "";
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{children}</div>
);

/* a read-only metric cell */
const Metric = ({ label, value, unit }: { label: string; value: string; unit?: string }) =>
  value ? (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{value}</span>
        {unit ? <span className="text-xs font-medium text-[var(--text-faint)]">{unit}</span> : null}
      </div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</div>
    </div>
  ) : null;

const Chips = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c, i) => (
        <span key={`${c}-${i}`} className="rounded-full bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {c}
        </span>
      ))}
    </div>
  ) : null;

/* form atoms */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
    {children}
  </label>
);
const inputCls =
  "w-full rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

const CAPABILITIES: { key: string; label: string; src: "factory" | "contact"; col: string }[] = [
  { key: "oem", label: "OEM", src: "contact", col: "supports_oem_branding" },
  { key: "odm", label: "ODM", src: "factory", col: "odm_supported" },
  { key: "private_label", label: "Private label", src: "factory", col: "private_label_supported" },
  { key: "low_moq", label: "Low MOQ", src: "factory", col: "low_moq_supported" },
  { key: "packaging", label: "Custom packaging", src: "contact", col: "supports_packaging_customization" },
  { key: "samples", label: "Samples", src: "factory", col: "supports_samples_contact" }, // resolved below
];

export default function FactorySection({
  supplierId,
  supplier,
  factory,
  onSaved,
}: {
  supplierId: string;
  supplier: Row;
  factory: Row | null;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation(contactsT);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const f = factory ?? {};

  const hasData = useMemo(
    () =>
      !!factory &&
      [
        "factory_name", "factory_type", "employee_count", "production_lines", "monthly_capacity",
        "annual_output", "factory_size_sqm", "lead_time_days", "export_percentage",
        "qc_staff_count", "rd_staff_count",
      ].some((k) => f[k] != null && f[k] !== "") ||
      arr(f, "main_export_markets").length > 0 ||
      arr(f, "production_categories").length > 0 ||
      arr(f, "supported_materials").length > 0,
    [factory, f],
  );

  /* ── edit draft ── */
  const initial = () => ({
    factory_name: str(f, "factory_name"),
    factory_type: str(f, "factory_type"),
    employee_count: numOrEmpty(f, "employee_count"),
    qc_staff_count: numOrEmpty(f, "qc_staff_count"),
    rd_staff_count: numOrEmpty(f, "rd_staff_count"),
    production_lines: numOrEmpty(f, "production_lines"),
    factory_size_sqm: numOrEmpty(f, "factory_size_sqm"),
    monthly_capacity: numOrEmpty(f, "monthly_capacity"),
    capacity_unit: str(f, "capacity_unit"),
    annual_output: numOrEmpty(f, "annual_output"),
    output_unit: str(f, "output_unit"),
    lead_time_days: numOrEmpty(f, "lead_time_days"),
    export_percentage: numOrEmpty(f, "export_percentage"),
    main_export_markets: arr(f, "main_export_markets").join(", "),
    production_categories: arr(f, "production_categories").join(", "),
    supported_materials: arr(f, "supported_materials").join(", "),
    oem: isTrue(supplier, "supports_oem_branding"),
    odm: isTrue(f, "odm_supported"),
    private_label: isTrue(f, "private_label_supported"),
    low_moq: isTrue(f, "low_moq_supported"),
    packaging: isTrue(supplier, "supports_packaging_customization"),
    samples: isTrue(supplier, "supports_samples"),
  });
  const [d, setD] = useState(initial);
  const set = (k: keyof ReturnType<typeof initial>, v: unknown) => setD((p) => ({ ...p, [k]: v }));

  const openEdit = () => { setD(initial()); setErr(null); setEditing(true); };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      const factoryBody = {
        factory_name: d.factory_name,
        factory_type: d.factory_type || null,
        employee_count: d.employee_count,
        qc_staff_count: d.qc_staff_count,
        rd_staff_count: d.rd_staff_count,
        production_lines: d.production_lines,
        factory_size_sqm: d.factory_size_sqm,
        monthly_capacity: d.monthly_capacity,
        capacity_unit: d.capacity_unit,
        annual_output: d.annual_output,
        output_unit: d.output_unit,
        lead_time_days: d.lead_time_days,
        export_percentage: d.export_percentage,
        main_export_markets: csv(d.main_export_markets),
        production_categories: csv(d.production_categories),
        supported_materials: csv(d.supported_materials),
        odm_supported: d.odm,
        private_label_supported: d.private_label,
        low_moq_supported: d.low_moq,
      };
      const r1 = await fetch(`/api/suppliers/${supplierId}/factory`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(factoryBody),
      });
      if (!r1.ok) {
        const j = await r1.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r1.status}`));
      }
      // capability flags that live on contacts
      const r2 = await fetch(`/api/suppliers/${supplierId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supports_oem_branding: d.oem,
          supports_packaging_customization: d.packaging,
          supports_samples: d.samples,
        }),
      });
      if (!r2.ok) {
        const j = await r2.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r2.status}`));
      }
      setEditing(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  /* ── VIEW MODE ── */
  if (!editing) {
    const capView = [
      { label: t("fs.capOem", "OEM"), on: isTrue(supplier, "supports_oem_branding") },
      { label: t("fs.capOdm", "ODM"), on: isTrue(f, "odm_supported") },
      { label: t("fs.capPrivateLabel", "Private label"), on: isTrue(f, "private_label_supported") },
      { label: t("fs.capLowMoq", "Low MOQ"), on: isTrue(f, "low_moq_supported") },
      { label: t("fs.capPackaging", "Custom packaging"), on: isTrue(supplier, "supports_packaging_customization") },
      { label: t("fs.capSamples", "Samples"), on: isTrue(supplier, "supports_samples") },
    ].filter((c) => c.on);

    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FactoryIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("fs.title", "Factory Intelligence")}</h3>
          </div>
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Edit3Icon className="h-3.5 w-3.5" /> {hasData ? t("fs.edit", "Edit") : t("fs.addFactoryData", "Add factory data")}
          </button>
        </div>

        {!hasData ? (
          <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">
            {t("fs.emptyState", "No factory intelligence yet — add capacity, capabilities, and export markets to strengthen sourcing readiness.")}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-5 space-y-4">
              {str(f, "factory_name") || str(f, "factory_type") ? (
                <div className="flex flex-wrap items-center gap-2">
                  {str(f, "factory_name") ? <span className="text-base font-semibold text-[var(--text-primary)]">{str(f, "factory_name")}</span> : null}
                  {str(f, "factory_type") ? (
                    <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                      {t("opt." + str(f, "factory_type"), factoryTypeLabel(str(f, "factory_type")))}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-4">
                <Metric label={t("fs.employees", "Employees")} value={fmtNum(f.employee_count)} />
                <Metric label={t("fs.productionLines", "Production lines")} value={fmtNum(f.production_lines)} />
                <Metric label={t("fs.qcStaff", "QC staff")} value={fmtNum(f.qc_staff_count)} />
                <Metric label={t("fs.rdStaff", "R&D staff")} value={fmtNum(f.rd_staff_count)} />
                <Metric label={t("fs.factoryArea", "Factory area")} value={fmtNum(f.factory_size_sqm)} unit="m²" />
                <Metric label={t("fs.founded", "Founded")} value={str(supplier, "year_established")} />
              </div>
            </div>

            {/* Capacity */}
            {(f.monthly_capacity || f.annual_output || f.lead_time_days || f.export_percentage) ? (
              <div className="space-y-2">
                <SectionLabel>{t("fs.capacityOperations", "Capacity & operations")}</SectionLabel>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl bg-[var(--bg-surface-subtle)] p-5 sm:grid-cols-4">
                  <Metric label={t("fs.monthlyCapacity", "Monthly capacity")} value={fmtNum(f.monthly_capacity)} unit={str(f, "capacity_unit")} />
                  <Metric label={t("fs.annualOutput", "Annual output")} value={fmtNum(f.annual_output)} unit={str(f, "output_unit")} />
                  <Metric label={t("fs.productionLeadTime", "Production lead time")} value={fmtNum(f.lead_time_days)} unit={t("fs.daysUnit", "days")} />
                  <Metric label={t("fs.exportShare", "Export share")} value={f.export_percentage != null ? String(f.export_percentage) : ""} unit="%" />
                </div>
              </div>
            ) : null}

            {/* Capabilities */}
            {capView.length ? (
              <div className="space-y-2">
                <SectionLabel>{t("fs.manufacturingCapabilities", "Manufacturing capabilities")}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {capView.map((c) => (
                    <span key={c.label} className="rounded-full bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]">
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Markets / categories / materials */}
            {arr(f, "main_export_markets").length ? (
              <div className="space-y-2"><SectionLabel>{t("fs.mainExportMarkets", "Main export markets")}</SectionLabel><div className="flex items-center gap-2"><GlobeIcon className="h-4 w-4 shrink-0 text-[var(--text-faint)]" /><Chips items={arr(f, "main_export_markets")} /></div></div>
            ) : null}
            {arr(f, "production_categories").length ? (
              <div className="space-y-2"><SectionLabel>{t("fs.productionCategories", "Production categories")}</SectionLabel><div className="flex items-center gap-2"><PackageIcon className="h-4 w-4 shrink-0 text-[var(--text-faint)]" /><Chips items={arr(f, "production_categories")} /></div></div>
            ) : null}
            {arr(f, "supported_materials").length ? (
              <div className="space-y-2"><SectionLabel>{t("fs.supportedMaterials", "Supported materials")}</SectionLabel><Chips items={arr(f, "supported_materials")} /></div>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  /* ── EDIT MODE ── */
  return (
    <section className="space-y-5" {...kxInspectAttrs({ component: "SupplierFactorySection", module: "Suppliers", section: "Production", recordId: supplierId })}>
      <div className="flex items-center gap-2">
        <FactoryIcon className="h-4 w-4 text-[var(--text-secondary)]" />
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("fs.editTitle", "Edit Factory Intelligence")}</h3>
      </div>

      <div className="space-y-5 rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <Field label={t("fs.factoryName", "Factory name")}><input className={inputCls} value={d.factory_name} onChange={(e) => set("factory_name", e.target.value)} placeholder={t("fs.factoryNamePlaceholder", "e.g. Main plant — Taizhou")} /></Field>
          <Field label={t("fs.factoryType", "Factory type")}>
            <select className={inputCls} value={d.factory_type} onChange={(e) => set("factory_type", e.target.value)}>
              <option value="">—</option>
              {Object.entries(FACTORY_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{t("opt." + k, label)}</option>)}
            </select>
          </Field>
          <Field label={t("fs.employees", "Employees")}><input type="number" min={0} className={inputCls} value={d.employee_count} onChange={(e) => set("employee_count", e.target.value)} /></Field>
          <Field label={t("fs.productionLines", "Production lines")}><input type="number" min={0} className={inputCls} value={d.production_lines} onChange={(e) => set("production_lines", e.target.value)} /></Field>
          <Field label={t("fs.qcStaff", "QC staff")}><input type="number" min={0} className={inputCls} value={d.qc_staff_count} onChange={(e) => set("qc_staff_count", e.target.value)} /></Field>
          <Field label={t("fs.rdStaff", "R&D staff")}><input type="number" min={0} className={inputCls} value={d.rd_staff_count} onChange={(e) => set("rd_staff_count", e.target.value)} /></Field>
          <Field label={t("fs.factoryAreaSqm", "Factory area (m²)")}><input type="number" min={0} className={inputCls} value={d.factory_size_sqm} onChange={(e) => set("factory_size_sqm", e.target.value)} /></Field>
          <Field label={t("fs.productionLeadTimeDays", "Production lead time (days)")}><input type="number" min={0} className={inputCls} value={d.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} /></Field>
          <Field label={t("fs.exportSharePct", "Export share (%)")}><input type="number" min={0} max={100} className={inputCls} value={d.export_percentage} onChange={(e) => set("export_percentage", e.target.value)} /></Field>
          <Field label={t("fs.monthlyCapacity", "Monthly capacity")}><input type="number" min={0} className={inputCls} value={d.monthly_capacity} onChange={(e) => set("monthly_capacity", e.target.value)} /></Field>
          <Field label={t("fs.capacityUnit", "Capacity unit")}><input className={inputCls} value={d.capacity_unit} onChange={(e) => set("capacity_unit", e.target.value)} placeholder={t("fs.capacityUnitPlaceholder", "units/mo")} /></Field>
          <Field label={t("fs.annualOutput", "Annual output")}><input type="number" min={0} className={inputCls} value={d.annual_output} onChange={(e) => set("annual_output", e.target.value)} /></Field>
          <Field label={t("fs.outputUnit", "Output unit")}><input className={inputCls} value={d.output_unit} onChange={(e) => set("output_unit", e.target.value)} placeholder={t("fs.outputUnitPlaceholder", "units/yr")} /></Field>
        </div>

        <div className="space-y-2">
          <SectionLabel>{t("fs.manufacturingCapabilities", "Manufacturing capabilities")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {([
              ["oem", t("fs.capOem", "OEM")], ["odm", t("fs.capOdm", "ODM")], ["private_label", t("fs.capPrivateLabel", "Private label")],
              ["low_moq", t("fs.capLowMoq", "Low MOQ")], ["packaging", t("fs.capPackaging", "Custom packaging")], ["samples", t("fs.capSamples", "Samples")],
            ] as const).map(([k, label]) => {
              const on = d[k] as boolean;
              return (
                <button key={k} type="button" onClick={() => set(k, !on)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${on ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("fs.mainExportMarketsCsv", "Main export markets (comma-separated)")}><input className={inputCls} value={d.main_export_markets} onChange={(e) => set("main_export_markets", e.target.value)} placeholder={t("fs.mainExportMarketsPlaceholder", "USA, EU, Middle East")} /></Field>
          <Field label={t("fs.productionCategoriesCsv", "Production categories (comma-separated)")}><input className={inputCls} value={d.production_categories} onChange={(e) => set("production_categories", e.target.value)} placeholder={t("fs.productionCategoriesPlaceholder", "Lockstitch heads, Servo motors")} /></Field>
          <Field label={t("fs.supportedMaterialsCsv", "Supported materials (comma-separated)")}><input className={inputCls} value={d.supported_materials} onChange={(e) => set("supported_materials", e.target.value)} placeholder={t("fs.supportedMaterialsPlaceholder", "Steel, Aluminium, ABS")} /></Field>
        </div>

        {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}
        <div className="flex items-center gap-3">
          <button type="button" disabled={saving} onClick={save}
            className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {saving ? t("fs.saving", "Saving…") : t("fs.saveFactoryData", "Save factory data")}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("fs.cancel", "Cancel")}</button>
        </div>
      </div>
    </section>
  );
}
