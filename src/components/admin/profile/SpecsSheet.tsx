"use client";

/* ---------------------------------------------------------------------------
   SpecsSheet — the Specs tab of the product profile, editable in place.

   THE EDITOR'S SPECIFICATIONS STEP, READ-ONLY UNTIL EDIT — its blocks:

     Product Specs        one card per group of the spec template; every field
                          a row (label · value · help · PUBLIC/INTERNAL/AI),
                          the value becoming the template's own control
                          (units, options, visual cards) on Edit. Computed
                          fields recompute from their source as you type.
     Machine Specs        sewing machines only: the sewing template's common +
                          template fields (sewing_machine_specs)
     Stand / Table specs  stands and tables only: the accessory option axes
     Technical Details    the electrical columns the template does NOT own —
                          frequency, motor power, power consumption, phase,
                          pneumatic supply

   A template product's schema_specs is the SOURCE and the legacy columns are
   mirrors: the save writes both (the editor's schemaColumnMirror), so the
   next full-form save cannot undo an inline edit.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { SpecField } from "@/types/product-schema";
import { updateProduct, fetchSewingSpecsByProductId, upsertSewingSpecs } from "@/lib/products-admin";
import { schemaColumnMirror, computeSchemaCoveredColumns } from "@/lib/product-schema/column-mirror";
import { isSewingMachineSubcategory, getTemplateForSubcategory, COMMON_SEWING_FIELDS, groupFields, SEWING_MACHINE_TEMPLATES, type TemplateField } from "@/lib/sewing-machine-templates";
import { computeDerivedValue } from "@/lib/product-schema/derived";
import type { SewingSpecsFormState } from "../form-sections/SewingMachineSection";
import AccessoryOptionsSection, { type AccessoryOptionRow, axesForSubcategory } from "../form-sections/AccessoryOptionsSection";
import KdsSelect from "@/components/kds/Select";
import Toggle from "@/components/kds/Toggle";
import BoundIcon from "@/components/common/BoundIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import TableIcon from "@/components/icons/ui/TableIcon";
import { Group, FieldRow, Blank, YesNo, Chips, CalcBadge, INP_B } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

/* ⚠️ THE TWO SPEC EDITORS ARRIVE WHEN EDIT IS PRESSED, NOT BEFORE.
   SchemaSpecsSection's field control is 995 lines with a portal, the visual
   option registry and the unit pickers behind it; SewingMachineSection is
   1337 more. The read view needs neither — it renders values as text — so a
   static import would have put both in the paint path of every product anyone
   merely LOOKS at. (`computeDerivedValue` moved to lib/product-schema/derived
   for the same reason: one pure function was dragging a whole editor in.) */
const FieldInput = dynamic(() => import("../form-sections/SchemaSpecsSection").then((m) => ({ default: m.FieldInput })), {
  ssr: false,
  loading: () => <div className="h-9 w-full max-w-[240px] rounded-lg border border-dashed border-[var(--border-subtle)] animate-pulse" />,
});
const SewingMachineSection = dynamic(() => import("../form-sections/SewingMachineSection"), {
  ssr: false,
  loading: () => <div className="h-40 rounded-xl border border-dashed border-[var(--border-subtle)] animate-pulse" />,
});

type Row = Record<string, unknown>;
type Card = `g:${string}` | "technical" | "sewing" | "accessory";
type Draft = {
  specs: Row;
  frequency_hz: string[]; motor_power_w: string; power_consumption_w: string; phase: string; pneumatic_supply: boolean;
  sewing: SewingSpecsFormState;
  accessory: AccessoryOptionRow[];
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const filled = (v: unknown) => !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0));

export default function SpecsSheet({
  product, schema, productId, t, motion, canEdit, onDirtyChange, onSaved, notSet, glyph,
}: {
  product: Row | undefined;
  schema: { name: string; version: string; groups: Array<Row & { key?: string; title?: string; fields?: Array<Row & { key: string }> }> } | null;
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (patch: Row) => void;
  notSet: string;
  glyph: (label: string) => React.ReactNode;
}) {
  const groups = useMemo(() => (schema?.groups ?? []).map((g, i) => ({ id: str(g.id) || str(g.key) || `g${i}`, title: str(g.title) || str(g.key) || "", fields: (g.fields ?? []) as unknown as SpecField[] })), [schema]);
  const allFields = useMemo(() => groups.flatMap((g) => g.fields), [groups]);
  const covered = useMemo(() => computeSchemaCoveredColumns(schema as { groups?: { fields?: { key: string }[] }[] } | null), [schema]);
  const subSlug = str(product?.subcategory_slug);
  const isAccessory = subSlug === "stands" || subSlug === "tables";
  const isSewing = !isAccessory && isSewingMachineSubcategory(subSlug, str(product?.division_slug), str(product?.category_slug));
  const techKeys = ["frequency_hz", "motor_power_w", "power_consumption_w", "phase", "pneumatic_supply"].filter((k) => !covered.has(k));

  /* Sewing specs and accessory options live in their own tables — loaded here, not in the profile payload. */
  const [sewing, setSewing] = useState<SewingSpecsFormState | null>(null);
  const [accessory, setAccessory] = useState<AccessoryOptionRow[] | null>(null);
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    if (isSewing) {
      fetchSewingSpecsByProductId(productId).then((row) => {
        if (!alive) return;
        setSewing({ template_slug: row?.template_slug || getTemplateForSubcategory(subSlug)?.slug || "", common_specs: row?.common_specs ?? {}, template_specs: row?.template_specs ?? {} });
      }).catch(() => { if (alive) setSewing({ template_slug: getTemplateForSubcategory(subSlug)?.slug || "", common_specs: {}, template_specs: {} }); });
    }
    if (isAccessory) {
      fetch(`/api/products/${productId}/options`, { credentials: "include", cache: "no-store" })
        .then((r) => r.json()).then((j: { options?: Array<Omit<AccessoryOptionRow, "_k">> }) => { if (alive) setAccessory((j.options ?? []).map((o, i) => ({ ...o, _k: `${o.axis}-${i}` }))); })
        .catch(() => { if (alive) setAccessory([]); });
    }
    return () => { alive = false; };
  }, [productId, isSewing, isAccessory, subSlug]);

  const specsOf = () => ({ ...((product?.schema_specs as Row | null) ?? {}) });
  const sheet = useSheetEdit<Card, Draft>({
    t, onDirtyChange,
    makeDraft: () => ({
      specs: specsOf(),
      frequency_hz: arr(product?.frequency_hz), motor_power_w: str(product?.motor_power_w), power_consumption_w: str(product?.power_consumption_w),
      phase: str(product?.phase), pneumatic_supply: !!product?.pneumatic_supply,
      sewing: JSON.parse(JSON.stringify(sewing ?? { template_slug: "", common_specs: {}, template_specs: {} })) as SewingSpecsFormState,
      accessory: JSON.parse(JSON.stringify(accessory ?? [])) as AccessoryOptionRow[],
    }),
    commit: async (card, d) => {
      if (!productId) return;
      if (card.startsWith("g:")) {
        /* Source + mirrors, in one PATCH. */
        const patch: Row = { schema_specs: d.specs, ...schemaColumnMirror(schema as { groups?: { fields?: { key: string }[] }[] } | null, d.specs) };
        await updateProduct(productId, patch);
        onSaved(patch);
      } else if (card === "technical") {
        const patch: Row = {};
        if (techKeys.includes("frequency_hz")) patch.frequency_hz = d.frequency_hz.map((x) => x.trim()).filter(Boolean);
        if (techKeys.includes("motor_power_w")) patch.motor_power_w = d.motor_power_w.trim() ? Math.round(Number(d.motor_power_w)) : null;
        if (techKeys.includes("power_consumption_w")) patch.power_consumption_w = d.power_consumption_w.trim() ? Math.round(Number(d.power_consumption_w)) : null;
        if (techKeys.includes("phase")) patch.phase = d.phase || null;
        if (techKeys.includes("pneumatic_supply")) patch.pneumatic_supply = d.pneumatic_supply;
        await updateProduct(productId, patch);
        onSaved(patch);
      } else if (card === "sewing") {
        const ok = await upsertSewingSpecs({ product_id: productId, template_slug: d.sewing.template_slug, common_specs: d.sewing.common_specs, template_specs: d.sewing.template_specs });
        if (!ok) throw new Error(t("pr.saveFailed", "Couldn't save — try again."));
        setSewing(d.sewing);
      } else if (card === "accessory") {
        const res = await fetch(`/api/products/${productId}/options`, {
          method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: d.accessory.filter((r) => r.value.trim()).map((r, i) => ({ axis: r.axis, value: r.value.trim(), price_delta_cny: r.affects_price ? r.price_delta_cny : 0, affects_price: r.affects_price, is_default: r.is_default, sort_order: i })) }),
        });
        if (!res.ok) throw new Error(t("pr.saveFailed", "Couldn't save — try again."));
        setAccessory(d.accessory.filter((r) => r.value.trim()));
      }
    },
  });
  const d = sheet.draft;
  const E = (c: Card) => sheet.editing === c;
  const specs: Row = sheet.editing?.startsWith("g:") && d ? d.specs : ((product?.schema_specs as Row | null) ?? {});

  /* One edit recomputes what derives from it — the editor's own cascade. */
  const derivedBySource = useMemo(() => {
    const map: Record<string, { target: string; formula: NonNullable<SpecField["computed"]>["formula"] }[]> = {};
    for (const f of allFields) if (f.computed) (map[f.computed.from] ??= []).push({ target: f.key, formula: f.computed.formula });
    return map;
  }, [allFields]);
  const setSpec = (key: string, v: unknown) => sheet.patch((dd) => {
    const next = { ...dd.specs };
    const setOne = (k: string, val: unknown) => { if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) delete next[k]; else next[k] = val; };
    setOne(key, v);
    const seen = new Set<string>();
    const cascade = (src: string) => { if (seen.has(src)) return; seen.add(src); for (const x of derivedBySource[src] ?? []) { setOne(x.target, computeDerivedValue(x.formula, next[src])); cascade(x.target); } };
    cascade(key);
    return { ...dd, specs: next };
  });

  const yes = t("pp.yes", "Yes"); const no = t("pp.no", "No");
  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0";
  const fmtSpec = (f: SpecField, v: unknown): React.ReactNode => {
    if (!filled(v)) return <Blank label={notSet} />;
    if (typeof v === "boolean") return <YesNo v={v} yes={yes} no={no} />;
    const opts = (f.options ?? []) as Array<{ value: string; label: string }>;
    const lbl = (x: unknown) => opts.find((o) => o.value === String(x))?.label ?? String(x);
    if (Array.isArray(v)) return <Chips items={v.map(lbl)} />;
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("length" in o || "width" in o || "height" in o) return <span className="tabular-nums">{[o.length, o.width, o.height].filter((n) => n != null).join(" × ")}{f.unit ? ` ${f.unit}` : ""}</span>;
      if ("min" in o || "max" in o) return <span className="tabular-nums">{str(o.min)}–{str(o.max)}{f.unit ? ` ${f.unit}` : ""}</span>;
      return <span className="font-mono text-[11px]">{JSON.stringify(v)}</span>;
    }
    return <span className="tabular-nums">{lbl(v)}{f.unit ? <span className="text-[11px] text-[var(--text-ghost)] ms-1">{f.unit}</span> : null}</span>;
  };
  const badges = (f: SpecField) => (
    <span className="inline-flex items-center gap-1">
      {f.computed ? <CalcBadge label={t("pk.calculated", "Calculated")} /> : null}
      {f.internalOnly ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]">INTERNAL</span>
        : f.publicVisible ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400/90">PUBLIC</span> : null}
      {f.aiReadable ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)]">AI</span> : null}
    </span>
  );

  /* Sewing template fields — for the read view; the editor's component edits. */
  const sewingTemplate = sewing?.template_slug ? SEWING_MACHINE_TEMPLATES.find((x) => x.slug === sewing.template_slug) ?? getTemplateForSubcategory(subSlug) : getTemplateForSubcategory(subSlug);
  const sewingGroups = useMemo(() => {
    const common = groupFields(COMMON_SEWING_FIELDS).map((g) => ({ ...g, src: "common" as const }));
    const tpl = sewingTemplate ? groupFields(sewingTemplate.fields).map((g) => ({ ...g, src: "template" as const })) : [];
    return [...common, ...tpl];
  }, [sewingTemplate]);
  const fmtTpl = (f: TemplateField, v: unknown) => {
    if (!filled(v)) return <Blank label={notSet} />;
    if (typeof v === "boolean") return <YesNo v={v} yes={yes} no={no} />;
    const lbl = (x: unknown) => f.options?.find((o) => o.value === String(x))?.label ?? String(x);
    if (Array.isArray(v)) return <Chips items={v.map(lbl)} />;
    return <span className="tabular-nums">{lbl(v)}{f.unit ? <span className="text-[11px] text-[var(--text-ghost)] ms-1">{f.unit}</span> : null}</span>;
  };
  const axes = axesForSubcategory(subSlug);
  const accRows = E("accessory") && d ? d.accessory : (accessory ?? []);

  return (
    <div className="space-y-4" onKeyDown={sheet.onKeyDown}>
      {/* ── Product Specs — one card per template group ───────────────── */}
      {groups.length === 0 ? (
        <Group motion={motion} icon={<BoundIcon semanticKey="field.spec_template" className="h-4 w-4" fallback={<Settings2Icon className="h-4 w-4" />} />} title={t("pp.sec.specs", "Specifications")}>
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noTemplate", "No spec template resolves for this classification, so there are no specification fields to fill.")}</p>
        </Group>
      ) : groups.map((g) => {
        const card: Card = `g:${g.id}`;
        const done = g.fields.filter((f) => filled(specs[f.key])).length;
        return (
          <Group key={g.id} motion={motion} icon={<BoundIcon semanticKey="field.spec_template" className="h-4 w-4" fallback={<Settings2Icon className="h-4 w-4" />} />} title={g.title} count={`${done}/${g.fields.length}`} {...sheet.gp(card, canEdit)}>
            {/* READ VIEW = the facts that exist. Each empty field used to cost
                four lines (label, PUBLIC/AI pills, "Not set", the hint), so a
                half-filled template read as a wall of "Not set" (owner's UI
                review, 22 Sep 2026). Now: filled rows without pills or hints,
                and one line counting what is not set, which opens the editor.
                Editing shows every field with its pills and hint again. */}
            {(() => {
              const editing = E(card);
              const rows = editing ? g.fields : g.fields.filter((f) => filled(specs[f.key]));
              const unset = g.fields.length - done;
              return (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {rows.map((f) => (
                    <FieldRow
                      key={f.key}
                      label={`${f.label || f.key}${f.required ? " *" : ""}`}
                      glyph={glyph(f.label || f.key)}
                      badge={editing ? badges(f) : (f.computed ? <CalcBadge label={t("pk.calculated", "Calculated")} /> : undefined)}
                      help={editing ? f.description : undefined}
                      value={fmtSpec(f, specs[f.key])}
                      input={editing && d && !f.computed ? <FieldInput field={f} value={d.specs[f.key]} onSet={(v) => setSpec(f.key, v)} /> : undefined}
                    />
                  ))}
                  {!editing && unset > 0 && (
                    <button
                      type="button"
                      onClick={canEdit ? () => sheet.begin(card) : undefined}
                      disabled={!canEdit}
                      className="w-full flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-[11.5px] text-[var(--text-muted)] disabled:cursor-default enabled:hover:text-[var(--text-primary)] transition-colors"
                    >
                      <span className="tabular-nums">{unset} {t("pp.notSetCount", "not set")}</span>
                      {canEdit && <span className="text-[#7FA9D6] font-medium">{t("action.edit", "Edit")}</span>}
                    </button>
                  )}
                </div>
              );
            })()}
          </Group>
        );
      })}

      {/* ── Machine Specs — sewing machines ───────────────────────────── */}
      {isSewing && (
        <Group motion={motion} icon={<WrenchIcon className="h-4 w-4" />} title={groups.length ? t("specs.additionalLegacy", "Additional / Legacy Specs") : t("specs.machineSpecs", "Machine Specs")} count={(sewing?.template_slug || "").replace(/-/g, " ") || t("cl.loading", "Loading…")} {...sheet.gp("sewing", canEdit && !!sewing)}>
          {E("sewing") && d ? (
            <SewingMachineSection data={d.sewing} onChange={(next) => sheet.patch({ sewing: next })} subcategorySlug={subSlug} mode="specs" />
          ) : !sewing ? (
            <p className="text-[12px] text-[var(--text-ghost)]">{t("cl.loading", "Loading…")}</p>
          ) : (
            <div className="space-y-4">
              {sewingGroups.map((sg) => (
                <div key={`${sg.src}:${sg.group}`}>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1">{sg.group}</div>
                  <div className={grid}>
                    {sg.fields.filter((f) => filled(sg.src === "common" ? sewing.common_specs[f.key] : sewing.template_specs[f.key])).map((f) => (
                      <FieldRow key={f.key} label={`${f.label}${f.required ? " *" : ""}`} glyph={glyph(f.label)}
                        value={fmtTpl(f, sg.src === "common" ? sewing.common_specs[f.key] : sewing.template_specs[f.key])} />
                    ))}
                    {(() => {
                      const unset = sg.fields.filter((f) => !filled(sg.src === "common" ? sewing.common_specs[f.key] : sewing.template_specs[f.key])).length;
                      return unset > 0 ? <p className="py-2.5 text-[11.5px] text-[var(--text-muted)] tabular-nums col-span-full">{unset} {t("pp.notSetCount", "not set")}</p> : null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Group>
      )}

      {/* ── Stand / Table specifications & variants ──────────────────── */}
      {isAccessory && (
        <Group motion={motion} icon={<TableIcon className="h-4 w-4" />} title={t("specs.accessoryTitle", "Stand / Table Specifications & Variants")} count={String(accRows.length)} {...sheet.gp("accessory", canEdit && !!accessory)}>
          {E("accessory") && d ? (
            <AccessoryOptionsSection rows={d.accessory} onChange={(rows) => sheet.patch({ accessory: rows })} subcategorySlug={subSlug} />
          ) : !accessory ? (
            <p className="text-[12px] text-[var(--text-ghost)]">{t("cl.loading", "Loading…")}</p>
          ) : accRows.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] italic">{notSet}</p>
          ) : (
            <div className="space-y-3">
              {axes.filter((ax) => accRows.some((r) => r.axis === ax.key)).map((ax) => (
                <div key={ax.key}>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1.5">{ax.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {accRows.filter((r) => r.axis === ax.key).map((r) => (
                      <span key={r._k} className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12px] ${r.is_default ? "border-[#567FB2]/50 bg-[#567FB2]/[0.07]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"}`}>
                        <span className="font-semibold text-[var(--text-primary)]">{r.value}</span>
                        {r.affects_price && r.price_delta_cny ? <span className="tabular-nums text-[var(--text-muted)]">{r.price_delta_cny > 0 ? "+" : ""}¥{r.price_delta_cny.toLocaleString()}</span> : null}
                        {r.is_default && <span className="text-[9px] font-semibold uppercase tracking-wider text-[#7FA9D6]">{t("opt.default", "Default")}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Group>
      )}

      {/* ── Technical Details — the electrical columns the template does not own ── */}
      {!isAccessory && techKeys.length > 0 && (
        <Group motion={motion} icon={<ZapIcon className="h-4 w-4" />} title={t("technical.title", "Technical Details")} count={t("tech.secElectrical", "Electrical")} {...sheet.gp("technical", canEdit)}>
          <div className={grid}>
            {techKeys.includes("frequency_hz") && (
              <FieldRow label={t("tech.frequency", "Frequency (Hz)")} glyph={glyph(t("tech.frequency", "Frequency (Hz)"))}
                value={arr(product?.frequency_hz).length ? <Chips items={arr(product?.frequency_hz).map((x) => `${x} Hz`)} /> : <Blank label={notSet} />}
                help={E("technical") ? t("sp.freqHint", "Comma-separated — e.g. 50, 60") : undefined}
                input={E("technical") && d ? <input value={d.frequency_hz.join(", ")} placeholder="50, 60" onChange={(ev) => sheet.patch({ frequency_hz: ev.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className={`${INP_B} w-full tabular-nums`} /> : undefined} />
            )}
            {techKeys.includes("motor_power_w") && (
              <FieldRow label={t("tech.motorPower", "Motor Power")} glyph={glyph(t("tech.motorPower", "Motor Power"))}
                value={str(product?.motor_power_w) ? <span className="tabular-nums">{str(product?.motor_power_w)} <span className="text-[11px] text-[var(--text-ghost)]">W</span></span> : <Blank label={notSet} />}
                input={E("technical") && d ? <span className="flex items-center gap-1.5"><input inputMode="numeric" value={d.motor_power_w} placeholder="e.g. 550" onChange={(ev) => sheet.patch({ motor_power_w: ev.target.value.replace(/[^0-9.]/g, "") })} className={`${INP_B} w-full max-w-[160px] tabular-nums`} /><span className="text-[11px] text-[var(--text-muted)]">W</span></span> : undefined} />
            )}
            {techKeys.includes("power_consumption_w") && (
              <FieldRow label={t("tech.powerConsumption", "Power Consumption")} glyph={glyph(t("tech.powerConsumption", "Power Consumption"))}
                value={str(product?.power_consumption_w) ? <span className="tabular-nums">{str(product?.power_consumption_w)} <span className="text-[11px] text-[var(--text-ghost)]">W</span></span> : <Blank label={notSet} />}
                input={E("technical") && d ? <span className="flex items-center gap-1.5"><input inputMode="numeric" value={d.power_consumption_w} placeholder="e.g. 600" onChange={(ev) => sheet.patch({ power_consumption_w: ev.target.value.replace(/[^0-9.]/g, "") })} className={`${INP_B} w-full max-w-[160px] tabular-nums`} /><span className="text-[11px] text-[var(--text-muted)]">W</span></span> : undefined} />
            )}
            {techKeys.includes("phase") && (
              <FieldRow label={t("tech.phase", "Phase")} glyph={glyph(t("tech.phase", "Phase"))}
                value={str(product?.phase) === "single" ? t("tech.singlePhase", "Single phase") : str(product?.phase) === "three" ? t("tech.threePhase", "Three phase") : str(product?.phase) ? str(product?.phase) : <Blank label={notSet} />}
                input={E("technical") && d ? <KdsSelect value={d.phase} onChange={(v) => sheet.patch({ phase: v })} options={[{ value: "single", label: t("tech.singlePhase", "Single phase") }, { value: "three", label: t("tech.threePhase", "Three phase") }]} placeholder={notSet} triggerClassName={`${INP_B} w-full pe-8 text-start`} /> : undefined} />
            )}
            {techKeys.includes("pneumatic_supply") && (
              <FieldRow label={t("tech.pneumatic", "Pneumatic Supply Required")} glyph={glyph(t("tech.pneumatic", "Pneumatic Supply Required"))}
                value={<YesNo v={!!product?.pneumatic_supply} yes={yes} no={no} />}
                input={E("technical") && d ? <Toggle checked={d.pneumatic_supply} onChange={(v) => sheet.patch({ pneumatic_supply: v })} /> : undefined} />
            )}
          </div>
        </Group>
      )}
      {!isAccessory && techKeys.length === 0 && groups.length > 0 && (
        <p className="text-[10.5px] text-[var(--text-ghost)] px-1">{t("technical.coveredBySpecs", "Every technical detail is covered by the spec template above.")}</p>
      )}
    </div>
  );
}
