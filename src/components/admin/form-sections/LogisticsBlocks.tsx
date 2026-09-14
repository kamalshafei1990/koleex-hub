"use client";

/* ---------------------------------------------------------------------------
   LogisticsBlocks — the Packing & Logistics tab, identical for every product.

   Owner, 2026-09-13: "this tab can be the same for any kind of product with
   any category or subcategory." It was not: packing lived inside the
   per-subcategory spec templates, so only 7 of 25 templates asked it at all,
   two of those offered a 4-item packing-type list where the rest offered 8,
   and one asked the same questions on the Specs tab. These blocks are fixed
   fields on the form — like Country of Origin, which was never a template
   field — and they write to products.logistics.

   Four blocks, in the order the person filling them actually thinks:
     Packing   → what the crate is, and how many crates
     Loading   → what fits in a container
     Customs   → what the border asks for
     Shipping  → where it leaves from
   --------------------------------------------------------------------------- */

import type React from "react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import KdsSelect from "@/components/kds/Select";
import {
  CONTAINERS, DG_KINDS, ITEM_KINDS, ORIGIN_CERTIFICATES, PACKING_TYPES, WOOD_TREATMENTS,
  loadPlan, sumPackages, STUFFING_EFFICIENCY, type LoadResult,
  type ContentItem, type PackageRow, type PackingMode, type ProductLogistics,
} from "@/lib/logistics";
import {
  LENGTH_UNITS, MASS_UNITS, displayIn, storeFrom, useEntryUnits,
} from "@/lib/entry-units";

/* The packing model stores centimetres and kilograms — see the field names. */
const dimFromCm = (v: unknown, u: string) => displayIn(v, "cm", u);
const dimToCm = (v: string, u: string) => storeFrom(v, "cm", u);
const weightFromKg = (v: unknown, u: string) => displayIn(v, "kg", u);
const weightToKg = (v: string, u: string) => storeFrom(v, "kg", u);
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import PlugIcon from "@/components/icons/ui/PlugIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import UnitPicker from "./UnitPicker";
import { CHINA_PORTS } from "@/lib/ports";

/** The port list, plus the stored value when it is not on it. */
export const portOptions = (current?: string | null): string[] =>
  current && !CHINA_PORTS.includes(current) ? [current, ...CHINA_PORTS] : [...CHINA_PORTS];

const lbl = "block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5";
/* TWO WIDTHS, NOT ONE STRING WITH AN OVERRIDE. `inp` carries w-full, and a
   caller that appended `w-16` did not get a 4rem box: both are width
   utilities of equal specificity, so the winner is whichever Tailwind emits
   last — not whichever is written last in the className. The qty box came out
   wider than the label it followed. `inpBase` is the same input with no width
   so a caller can set its own. */
const inpBase =
  "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";
const inp = `w-full ${inpBase}`;
const hint = "text-[10px] text-[var(--text-ghost)] leading-relaxed mt-1";

/* CHOICE BUTTONS MUST GROW, NOT CLIP. Every pair on this tab was `h-10` with a
   sentence inside it — "One package → many pieces", "Has regulated content" —
   and at 375px the text wrapped to two lines inside a 40px box and spilled out
   of its own border. Measured on the phone viewport: three buttons with
   scrollHeight past clientHeight. min-h with auto height lets the label wrap
   and the button grow; the row stacks below sm so each choice gets the full
   width instead of splitting 343px two ways. */
const choiceRow = "flex flex-col sm:flex-row items-stretch gap-2";
const choiceBtn =
  "min-h-10 py-2 px-3 rounded-lg text-[11.5px] font-semibold border transition-colors flex-1 text-center leading-snug";
const choiceOn = "border-[#567FB2]/60 bg-[#567FB2]/[0.12] text-[var(--text-primary)]";
const choiceOff =
  "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]";

/* Closed lists carry English labels in src/lib/logistics.ts because that file
   is shared with the server. The FORM is what a person reads, so every option
   passes through the UI dictionary on the way to the screen; the stored value
   never changes. */
type TFn = (key: string, fallback: string) => string;
/* The arithmetic behind a container count, in one line, so "29" is never a
   number to take on faith. Exported: the profile sheet says the same thing. */
export function loadExplain(t: TFn, r: LoadResult, grossKg: number, payloadKg: number): string {
  const vol = t("pk.volumeLimited", "By volume: {cbm} m³ × {eff}% ÷ {unit} m³ = {n}")
    .replace("{cbm}", String(r.containerCbm)).replace("{eff}", String(Math.round(STUFFING_EFFICIENCY * 100)))
    .replace("{unit}", String(r.unitCbm)).replace("{n}", String(r.byVolume));
  if (r.limit === "weight") {
    const w = t("pk.weightLimitedCalc", "By weight: {payload} kg ÷ {gross} kg = {n}")
      .replace("{payload}", payloadKg.toLocaleString()).replace("{gross}", String(grossKg)).replace("{n}", String(r.byWeight));
    return `${w}. ${t("pk.weightDecides", "Weight decides — the volume would allow {n}.").replace("{n}", String(r.byVolume))}`;
  }
  return `${vol}.`;
}
const localise = (t: TFn, list: readonly { value: string; label: string }[]) =>
  list.map((o) => ({ value: o.value, label: t(`pk.opt.${o.value}`, o.label) }));

/* The unit switch is the shared UnitPicker (./UnitPicker) with a caption — one
   control for units everywhere on the form, so the crate's switch and the
   machine's switch above it are visibly the same thing. */
export function UnitSwitch({
  value, options, onChange, label, canonical,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  label: string;
  canonical: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)]">{label}</span>
      <UnitPicker value={value} options={options} onPick={onChange} canonical={canonical} size="sm" />
    </span>
  );
}

type Patch = (u: Partial<ProductLogistics>) => void;
interface BlockProps { value: ProductLogistics; onChange: Patch; }

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(x) ? x : 0;
};
/* Net weight IS the machine weight (owner, 2026-09-14: "net weight means the
   machine weight"). The packing column is kept only as a fallback for rows
   written before the two were one. */
export const netOf = (value: ProductLogistics, machineKg: number | string | null | undefined): number =>
  n(machineKg) || n(value.net_weight_kg);

/* ═══════════════════════════════════════════════════════════════════
   SUMMARY — the whole shipment in one line.

   Fourteen separate numbers hide their own mistakes; one sentence does
   not. A crate entered in millimetres instead of centimetres reads as
   0.001 m³ here and the operator sees it immediately.
   ═══════════════════════════════════════════════════════════════════ */
export function LogisticsSummary({ value }: { value: ProductLogistics }) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const sums = useMemo(() => sumPackages(value.packages), [value.packages]);
  const plan = useMemo(
    () => loadPlan(value.packages, {
      unitsPerPackage: value.packing_mode === "per_package" ? n(value.units_per_package) : 1,
    }),
    [value.packages, value.packing_mode, value.units_per_package],
  );
  if (sums.packageCount === 0) return null;
  const perPkg = value.packing_mode === "per_package" ? Math.max(1, Math.floor(n(value.units_per_package) || 1)) : 1;
  const cell = (k: string, v: string) => (
    <div key={k} className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-ghost)]">{k}</div>
      {/* <bdi> is INLINE: the run reads LTR ("1.46 m³", never "m³ 1.46")
          while the cell still aligns with its label on the page's own side.
          dir on the div itself did the first and broke the second. */}
      <div className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] truncate"><bdi dir="ltr">{v}</bdi></div>
    </div>
  );
  return (
    <div className="kx-glass rounded-xl border border-[#567FB2]/30 px-4 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
        {cell(t("pk.cellPackages", "Packages"), perPkg > 1 ? `${perPkg} ${t("pk.perPkgShort", "pcs / pkg")}` : `${sums.packageCount} ${t("pk.perUnitShort", "/ unit")}`)}
        {cell(t("pk.cbm", "CBM (m³)").replace(/\s*\(.*\)$/, ""), `${sums.cbm} m³`)}
        {cell(t("pk.cellGross", "Gross"), `${sums.grossKg} kg`)}
        {cell("20ft", plan.c20.qty ? String(plan.c20.qty) : "—")}
        {cell("40ft", plan.c40.qty ? String(plan.c40.qty) : "—")}
        {cell("40HQ", plan.c40hq.qty ? String(plan.c40hq.qty) : "—")}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PACKING — the crates, what is inside them, and how many pieces to a box.
   ═══════════════════════════════════════════════════════════════════ */
export function PackingBlock({ value, onChange, productId, netKg }: BlockProps & { productId?: string;
  /** The machine weight from Physical. Suppliers quote N.W. and G.W.; N.W. IS
   *  the machine, so the packing tab does not ask for it a second time. */
  netKg?: number | string | null;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  /* Memoised so the fallback row is not a fresh array on every render — that
     identity change re-ran the sums below on every keystroke anywhere on the
     form. */
  const rows: PackageRow[] = useMemo(
    () => (value.packages?.length ? value.packages : [{ qty: 1 }]),
    [value.packages],
  );
  const sums = useMemo(() => sumPackages(rows), [rows]);
  const mode: PackingMode = value.packing_mode === "per_package" ? "per_package" : "per_unit";
  const per = Math.max(1, Math.floor(n(value.units_per_package) || 1));
  /* ONE UNIT CHOICE FOR THE WHOLE FORM, not one per section. It was stored on
     the product, which made it a fact about the goods — it is not, it is how
     the person at the keyboard reads the catalogue in front of them. It now
     lives with the operator (src/lib/entry-units.ts), so picking mm here also
     puts the machine's own dimensions above into mm, and the two halves of the
     tab can never disagree about what a number means. */
  const { length: dimUnit, mass: wtUnit, setLength, setMass } = useEntryUnits();
  /* Keystroke drafts for the converted fields — see numCell. Cleared whenever
     the unit changes so every box repaints in the new unit at once. */
  const [raw, setRaw] = useState<Record<string, string>>({});

  const write = (next: PackageRow[]) => {
    const s = sumPackages(next);
    onChange({ packages: next, cbm: s.cbm, gross_weight_kg: s.grossKg });
  };
  const setRow = (i: number, u: Partial<PackageRow>) => write(rows.map((r, x) => (x === i ? { ...r, ...u } : r)));
  const addRow = () => onChange({ packages: [...rows, { qty: 1 }] });
  const removeRow = (i: number) => write(rows.filter((_, x) => x !== i));

  /* EVERY NUMBER IN THIS CARD IS STORED IN cm AND kg, WHATEVER THE SWITCH SAYS.
     The cell converts on the way in and on the way out, so a crate typed as
     1200 mm and a crate typed as 120 cm are the same crate in the file — and
     CBM, the container maths and the packing list never learn that a choice
     was made. Qty is a count and is never converted. */
  const numCell = (i: number, k: keyof PackageRow, ph: string, label: string) => {
    const isDim = k === "l_cm" || k === "w_cm" || k === "h_cm";
    const isWeight = k === "gross_kg";
    const id = `${i}:${String(k)}`;
    /* THE DECIMAL POINT HAS TO SURVIVE BEING TYPED. Converting on every
       keystroke and echoing the result back means "1." becomes Number("1.")
       = 1 and re-renders as "1" — the dot is eaten and a metre-and-a-bit crate
       can never be entered. So while a field is being typed in, the field shows
       exactly what was typed; the STORE still receives the converted number on
       every keystroke, so nothing waits for a blur. */
    const converted = isDim ? dimFromCm(rows[i][k], dimUnit)
      : isWeight ? weightFromKg(rows[i][k], wtUnit)
      : String(rows[i][k] ?? "");
    const shown = raw[id] !== undefined ? raw[id] : converted;
    const onType = (v: string) => {
      setRaw((m) => ({ ...m, [id]: v }));
      const stored = isDim ? dimToCm(v, dimUnit) : isWeight ? weightToKg(v, wtUnit) : v;
      setRow(i, { [k]: stored } as Partial<PackageRow>);
    };
    return (
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1 truncate">{label}</div>
        <input
          inputMode="decimal"
          value={shown}
          onChange={(e) => onType(e.target.value)}
          /* On leaving, drop the draft so the field re-reads the stored value —
             which is also how a unit switch repaints it. */
          onBlur={() => setRaw((m) => { const next = { ...m }; delete next[id]; return next; })}
          placeholder={ph}
          className={`${inp} text-center tabular-nums px-1.5`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── HOW THIS PRODUCT IS PACKED ──
          The first question, because every number under it means something
          different depending on the answer. A machine occupies crates; a small
          accessory shares one. The customer's question — "how many per box?" —
          only exists in the second case, so the field only exists there. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("pk.modeQ", "How is it packed?")}</label>
          <div className={choiceRow}>
            {([["per_unit", t("pk.modePerUnit", "One unit → its own package(s)")], ["per_package", t("pk.modePerPackage", "One package → many pieces")]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => onChange({ packing_mode: k as PackingMode })}
                className={`${choiceBtn} ${mode === k ? choiceOn : choiceOff}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={hint}>
            {mode === "per_unit"
              ? t("pk.modeHintUnit", "A machine: one unit ships as one or more crates.")
              : t("pk.modeHintPkg", "A small item: one carton holds many pieces.")}
          </p>
        </div>
        {mode === "per_package" ? (
          <div>
            <label className={lbl}>{t("pk.piecesPerPkg", "Pieces per package")}</label>
            <input
              inputMode="numeric"
              value={String(value.units_per_package ?? "")}
              onChange={(e) => onChange({ units_per_package: e.target.value })}
              placeholder="50"
              className={`${inp} tabular-nums`}
            />
            <p className={hint}>{t("pk.piecesHint", "The first thing a customer asks about a small item. Container counts below are in PIECES.")}</p>
          </div>
        ) : (
          /* The right half stays EMPTY in per-unit mode, and that is deliberate.
             It held a second CBM field — the same read-only number the weights
             row below already shows — which is the exact duplication this tab
             spent the day losing. The slot keeps its width so the layout does
             not jump when the mode is switched. */
          <div aria-hidden />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("pk.packingType", "Packing type")}</label>
          <KdsSelect
            value={value.packing_type ?? ""}
            onChange={(v: string) => onChange({ packing_type: v })}
            options={localise(t, PACKING_TYPES)}
            placeholder={t("pk.select", "— Select —")}
            triggerClassName={inp + " pe-9 text-start"}
          />
        </div>
        <div>
          <label className={lbl}>{t("pk.woodTreatment", "Wood treatment (ISPM-15)")}</label>
          <KdsSelect
            value={value.wood_treatment ?? ""}
            onChange={(v: string) => onChange({ wood_treatment: v })}
            options={localise(t, WOOD_TREATMENTS)}
            placeholder={t("pk.select", "— Select —")}
            triggerClassName={inp + " pe-9 text-start"}
          />
          {/* Not paperwork trivia: untreated solid wood is refused at the
              border, and the shipment is fumigated at the port or sent back. */}
          <p className={hint}>
            {value.wood_treatment === "untreated"
              ? t("pk.woodWarn", "⚠ Untreated solid wood is refused by EU / US / AU customs — it must be heat-treated or fumigated and bear the IPPC mark.")
              : t("pk.woodHint", "Solid wood packaging must be treated and IPPC-marked. Plywood and processed board are exempt.")}
          </p>
        </div>
      </div>

      {/* ── THE SAMPLE PHOTO ──
          Large on purpose. Every written packing spec is an argument waiting to
          happen — "wooden case" means one thing to us and another to the buyer
          — and one photograph of the actual packed machine ends it. It is also
          what the factory is asked to reproduce. */}
      <PackingPhoto
        url={value.packing_photo_url ?? null}
        onChange={(u) => onChange({ packing_photo_url: u })}
        productId={productId}
      />

      {/* ── the crates ──
          ONE CARD PER CRATE, because one machine is regularly more than one
          crate — a spreader ships as machine + table/rails + accessory box. A
          single set of dimensions gets the volume, the weight and every
          container count wrong, and cannot produce a packing list at all. */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-2">
          <label className={`${lbl} mb-0`}>{mode === "per_package" ? t("pk.packageOne", "Package") : t("pk.packagesPerUnit", "Packages per unit")}</label>
          {/* The switches sit WITH the numbers they govern, not in a settings
              panel somewhere else — the operator sets them while looking at the
              catalogue page they are copying from. */}
          <div className="flex flex-wrap items-center gap-3">
            <UnitSwitch
              label={t("pk.unitSize", "Size")}
              value={dimUnit}
              options={LENGTH_UNITS}
              canonical="cm"
              onChange={(v) => { setRaw({}); setLength(v as typeof dimUnit); }}
            />
            <UnitSwitch
              label={t("pk.unitWeight", "Weight")}
              value={wtUnit}
              options={MASS_UNITS}
              canonical="kg"
              onChange={(v) => { setRaw({}); setMass(v as typeof wtUnit); }}
            />
          </div>
        </div>
        {/* ONE RULE, SO NOBODY HAS TO GUESS: the INPUTS speak the operator's
            unit — whatever the catalogue in front of them prints — and every
            TOTAL speaks the shipping units, m³ and kg, because that is what a
            packing list, a bill of lading and a freight quote are written in.
            A total in grams would be a number nobody downstream can use. */}
        {/* A number-and-unit run is Latin-script; inside an Arabic page the
            bidi algorithm reorders it ("m³ 1.46"). It is isolated LTR so the
            totals read the same in every language. */}
        <div className="text-[10px] tabular-nums text-[var(--text-ghost)] mb-2">
          <bdi dir="ltr">
            {sums.packageCount} {t("pk.pkgWord", "pkg")} · {sums.cbm} m³ · {sums.grossKg} kg
            {mode === "per_package" && per > 1 ? ` · ${Math.round((sums.cbm / per) * 10000) / 10000} ${t("pk.m3PerPc", "m³/pc")}` : ""}
          </bdi>
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3 space-y-3">
              {/* TWO ROWS, NOT ONE CROWDED LINE. A photo, a name, five numbers
                  and a delete button never fit one line honestly: the earlier
                  single-row grid needed 680px of tracks and started asking for
                  them at 640, so the last fields fell off the card. The name
                  belongs with the photo it describes; the measurements are a
                  set and read as one. Nothing depends on a breakpoint now. */}
              <div className="flex items-start gap-3">
                <ItemPhoto
                  url={r.photo_url ?? null}
                  kind="box"
                  size="lg"
                  onChange={(u) => setRow(i, { photo_url: u })}
                  productId={productId}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1">{t("pk.colPackage", "Package")}</div>
                      <input
                        value={r.label ?? ""}
                        onChange={(e) => setRow(i, { label: e.target.value })}
                        placeholder={i === 0 ? t("pk.phMachineCrate", "Machine crate") : t("pk.phAccBox", "Accessories box")}
                        className={inp}
                      />
                    </div>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label={t("pk.removePackage", "Remove package")}
                        className="h-10 w-9 shrink-0 rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {numCell(i, "qty", "1", t("pk.colQty", "Qty"))}
                    {numCell(i, "l_cm", "120", `${t("pk.colLbare", "L")} (${dimUnit})`)}
                    {numCell(i, "w_cm", "80", `${t("pk.colWbare", "W")} (${dimUnit})`)}
                    {numCell(i, "h_cm", "110", `${t("pk.colHbare", "H")} (${dimUnit})`)}
                    {numCell(i, "gross_kg", "210", `${t("pk.colGrossBare", "Gross")} (${wtUnit})`)}
                  </div>
                </div>
              </div>

              {/* What is in this crate — the packing list, nested. */}
              <ContentsEditor
                items={r.contents ?? []}
                onChange={(items) => setRow(i, { contents: items })}
                productId={productId}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors"
        >
          {t("pk.addPackage", "+ Add package")}
        </button>
        <p className={hint}>
          {t("pk.cmHint", "Centimetres — the unit on every packing list and bill of lading. Machine dimensions above stay in mm.")}
        </p>
        {/* THE ONE RULE THAT KEEPS THE TOTALS HONEST. A package is something
            the forwarder loads and weighs; what is inside it is already in its
            size and its weight. Entering the accessories box as a package as
            well as listing it inside the crate counts the same box twice — the
            crate's 210 kg already includes it — and nothing in the arithmetic
            can detect that, because both readings are perfectly valid numbers.
            So the rule is stated where the mistake would be made. */}
        <p className={`${hint} mt-1.5`}>
          {t("pk.packagesRule", "A package is one thing the forwarder loads: only what is weighed and measured on its own belongs here. A box inside another box goes under \"What's inside\" — the outer crate's size and weight already include it.")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className={lbl}>{`${t("pk.netWeightBare", "Net weight")} (${wtUnit})`}</label>
          <input value={weightFromKg(netOf(value, netKg), wtUnit)} readOnly placeholder="—" className={`${inp} tabular-nums opacity-70`} />
          <p className={hint}>{t("pk.netFromMachine", "The machine weight from Physical — suppliers quote N.W. and G.W., and N.W. is the machine.")}</p>
        </div>
        <div>
          <label className={lbl}>{`${t("pk.grossWeightBare", "Gross weight")} (${wtUnit})`}</label>
          <input value={weightFromKg(sums.grossKg, wtUnit)} readOnly placeholder="—" className={`${inp} tabular-nums opacity-70`} />
          {/* Gross used to be a free number with no relationship to anything;
              it is the sum of the crates, so the crates state it. */}
          <p className={hint}>{t("pk.grossHint", "Sum of the packages above.")}</p>
        </div>
        <div>
          <label className={lbl}>{`${t("pk.packagingWeightBare", "Packaging weight")} (${wtUnit})`}</label>
          <input
            value={sums.grossKg && n(netOf(value, netKg)) ? weightFromKg(Math.round((sums.grossKg - n(netOf(value, netKg))) * 10000) / 10000, wtUnit) : ""}
            readOnly
            placeholder="—"
            className={`${inp} tabular-nums opacity-70`}
          />
          <p className={hint}>{t("pk.packagingHint", "Gross − net. Negative means one of them is wrong.")}</p>
        </div>
        <div>
          <label className={lbl}>{t("pk.cbm", "CBM (m³)")}</label>
          <input value={sums.cbm ? String(sums.cbm) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-70`} />
          <p className={hint}>{t("pk.cbmHintAll", "All packages together.")}</p>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   PHOTOS — one big sample of the packed product, and a thumbnail for
   every item in the crate.

   Uploads go through the same storage route the rest of the Hub uses, into
   the public `media` bucket under packing/<product>/. The URL is all that is
   stored in products.logistics.
   ═══════════════════════════════════════════════════════════════════ */

async function uploadPackingImage(file: File, productId?: string): Promise<string | null> {
  const { uploadToStorage } = await import("@/lib/storage-client");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `packing/${productId || "new"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await uploadToStorage("media", path, file, { contentType: file.type || undefined, upsert: true });
  /* The helper reports failure in the result, not by throwing — a rejected
     upload that returned a bare null here would look like "no photo chosen". */
  return res.ok ? res.data.publicUrl : null;
}

export function useImagePicker(onPicked: (url: string | null) => void, productId?: string) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const onFile = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const url = await uploadPackingImage(f, productId);
      if (url) onPicked(url);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => void onFile(e.target.files?.[0])}
    />
  );
  /* Drag-and-drop, because a packing photo arrives as a file in a folder or a
     picture in a chat — dragging it in is the natural motion, and a target
     that only answers a click makes the operator go the long way round.
     preventDefault on dragOver is what stops the browser from navigating away
     to the dropped file, which would lose unsaved form state. */
  const drop = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      void onFile(e.dataTransfer?.files?.[0]);
    },
  };
  return { busy, over, drop, open: () => ref.current?.click(), input };
}

export function PackingPhoto({
  url, onChange, productId,
}: { url: string | null; onChange: (u: string | null) => void; productId?: string }) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const { busy, over, drop, open, input } = useImagePicker(onChange, productId);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className={`${lbl} mb-0`}>{t("pk.samplePhoto", "Packing sample photo")}</label>
        {url ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] font-semibold text-[var(--text-ghost)] hover:text-[var(--text-primary)]"
          >
            {t("pk.remove", "Remove")}
          </button>
        ) : null}
      </div>
      {input}
      {url ? (
        <button
          type="button"
          onClick={open}
          {...drop}
          title={t("pk.photoReplace", "Click or drop an image to replace")}
          className={`block w-full max-w-3xl overflow-hidden rounded-xl border bg-[var(--bg-surface-subtle)]/40 transition-colors ${over ? "border-[#567FB2]" : "border-[var(--border-subtle)]"}`}
        >
          {/* Deliberately large. A packing photo is read, not glanced at: the
              buyer is looking for how the corners are protected and whether the
              crate is closed or open. A thumbnail answers neither. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Packing sample" className="w-full max-h-[420px] object-contain bg-black/20" />
        </button>
      ) : (
        /* EMPTY, IT IS A CONTROL; FILLED, IT IS THE PHOTO. Full width and
           160px tall, the empty state drew a 1,266px dashed band across the
           middle of the tab — more visual weight than any field that actually
           holds data. Capped while empty; the image below is the thing allowed
           to be big. */
        <button
          type="button"
          onClick={open}
          disabled={busy}
          {...drop}
          className={`w-full max-w-3xl h-56 rounded-xl border border-dashed bg-[var(--bg-surface-subtle)]/40 text-[12px] transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-2 ${
            over
              ? "border-[#567FB2] bg-[#567FB2]/[0.06] text-[var(--text-primary)]"
              : "border-[var(--border-subtle)] text-[var(--text-ghost)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]"
          }`}
        >
          <ImageRawIcon className="h-6 w-6 opacity-70" />
          <span>{busy ? t("pk.uploading", "Uploading…") : t("pk.samplePhotoCta", "Click to upload a photo of the packed product")}</span>
          <span className="text-[10.5px] opacity-70">{t("pk.dropHere", "…or drag an image here")}</span>
        </button>
      )}
      <p className={hint}>{t("pk.samplePhotoHint", "One photograph settles what \"wooden case\" means — for the buyer and for the factory.")}</p>
    </div>
  );
}

function ItemGlyph({ kind, className }: { kind?: string; className?: string }) {
  const cls = className || "h-4 w-4";
  switch (kind) {
    case "machine": return <BoxesIcon className={cls} />;
    case "tools":   return <WrenchIcon className={cls} />;
    case "cable":   return <PlugIcon className={cls} />;
    case "cover":   return <ShieldCheckIcon className={cls} />;
    case "parts":   return <LayersIcon className={cls} />;
    case "docs":    return <FileIcon className={cls} />;
    default:        return <PackageIcon className={cls} />;
  }
}

function ItemPhoto({
  url, kind, onChange, productId, size = "sm",
}: {
  url: string | null; kind?: string; onChange: (u: string | null) => void;
  productId?: string; size?: "sm" | "lg";
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const { busy, over, drop, open, input } = useImagePicker(onChange, productId);
  const box = size === "lg" ? "h-24 w-24" : "h-10 w-10";
  return (
    <>
      {input}
      <button
        type="button"
        onClick={open}
        disabled={busy}
        {...drop}
        title={url ? t("pk.photoReplace", "Click or drop an image to replace") : t("pk.photoAdd", "Click or drop an image to add a photo")}
        className={`${box} shrink-0 rounded-lg overflow-hidden border bg-[var(--bg-surface-subtle)]/60 flex items-center justify-center transition-colors disabled:opacity-50 ${
          over
            ? "border-[#567FB2] text-[var(--text-primary)]"
            : "border-[var(--border-subtle)] text-[var(--text-ghost)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]"
        }`}
      >
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ItemGlyph kind={kind} className={size === "lg" ? "h-7 w-7" : "h-4 w-4"} />
        )}
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTENTS — what is in the crate, and what is in the boxes in it.

   Owner's example, exactly: the machine crate holds the machine and an
   accessories box; the accessories box holds the cover, the tools. So the
   list nests one level. Everything is optional — plenty of machines ship as a
   crate with a machine in it and nothing else to say.
   ═══════════════════════════════════════════════════════════════════ */
export function ContentsEditor({
  items, onChange, productId, depth = 0,
}: {
  items: ContentItem[];
  onChange: (next: ContentItem[]) => void;
  productId?: string;
  depth?: number;
}) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const set = (i: number, u: Partial<ContentItem>) => onChange(items.map((it, x) => (x === i ? { ...it, ...u } : it)));
  const remove = (i: number) => onChange(items.filter((_, x) => x !== i));
  const add = () => onChange([...items, { qty: 1 }]);

  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={add}
        className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-[10.5px] font-semibold text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-dashed border-[var(--border-subtle)] transition-colors ${depth ? "ms-11" : ""}`}
      >
        + {depth === 0 ? t("pk.listInside", "List what's inside") : t("pk.insideThisBox", "What's inside this box")}
      </button>
    );
  }

  return (
    <div className={`space-y-2 ${depth ? "ms-11 ps-3 border-s border-[var(--border-subtle)]" : ""}`}>
      {depth === 0 ? (
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)]">
          {t("pk.whatsInside", "What's inside")}
          <span className="ms-2 normal-case tracking-normal font-normal text-[9.5px] opacity-80">
            {t("pk.insideNotWeighed", "not weighed separately")}
          </span>
        </div>
      ) : null}
      {items.map((it, i) => (
        <div key={i} className="space-y-2">
          {/* Wraps rather than squeezes: at 375px a photo, a label, a quantity,
              an icon picker and a delete button do not fit on one line, and
              forcing them there is what pushed the qty box off the screen. */}
          <div className="flex flex-wrap items-center gap-2">
            <ItemPhoto
              url={it.photo_url ?? null}
              kind={it.kind}
              onChange={(u) => set(i, { photo_url: u })}
              productId={productId}
            />
            <input
              value={it.label ?? ""}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder={depth === 0 ? t("pk.itemPh0", "Machine / Accessories box") : t("pk.itemPh1", "Cover, tool kit, spare needles…")}
              className={`${inpBase} flex-1 basis-[140px] min-w-0`}
            />
            <input
              inputMode="numeric"
              value={String(it.qty ?? "")}
              onChange={(e) => set(i, { qty: e.target.value })}
              placeholder="1"
              className={`${inpBase} w-14 shrink-0 text-center tabular-nums px-1.5`}
            />
            {/* No photo? Then the glyph carries the meaning, so it is worth
                choosing. Hidden once a photo exists — the photo wins. */}
            {!it.photo_url ? (
              <KdsSelect
                value={it.kind ?? ""}
                onChange={(v: string) => set(i, { kind: v })}
                options={localise(t, ITEM_KINDS)}
                placeholder={t("pk.iconPh", "Icon")}
                triggerClassName={`${inpBase} w-[92px] sm:w-[132px] pe-7 text-start shrink-0 text-[11px]`}
              />
            ) : null}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t("pk.removeItem", "Remove item")}
              className="h-8 w-8 shrink-0 rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              ×
            </button>
          </div>
          {/* One level of nesting only — deeper than that and it is a second
              crate, not a box inside a box. */}
          {depth === 0 ? (
            <ContentsEditor
              items={it.items ?? []}
              onChange={(sub) => set(i, { items: sub })}
              productId={productId}
              depth={1}
            />
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-[10.5px] font-semibold text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
      >
        {t("pk.addItem", "+ Add item")}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOADING — how many fit, and which limit decides it.
   ═══════════════════════════════════════════════════════════════════ */
export function LoadingBlock({ value, onChange }: BlockProps) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const sums = useMemo(() => sumPackages(value.packages), [value.packages]);
  const plan = useMemo(
    () => loadPlan(value.packages, {
      unitsPerPackage: value.packing_mode === "per_package" ? n(value.units_per_package) : 1,
    }),
    [value.packages, value.packing_mode, value.units_per_package],
  );

  const perPkg = value.packing_mode === "per_package" ? Math.max(1, Math.floor(n(value.units_per_package) || 1)) : 1;
  /* MEASURED, not merely counted. The packages table starts with one empty
     row, so a count alone is 1 before anything is typed — and the box then
     announced "does not fit" on a blank form, which is an alarm about nothing. */
  const anyMeasured = (value.packages ?? []).some(
    (r) => n(r.l_cm) > 0 && n(r.w_cm) > 0 && n(r.h_cm) > 0,
  );

  const box = (key: "c20" | "c40" | "c40hq", stored: keyof ProductLogistics) => {
    const r = plan[key];
    const typed = value[stored];
    const overridden = typed !== undefined && typed !== "" && n(typed) !== r.qty;
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {CONTAINERS[key].label}
            <span className="ms-1 font-normal text-[var(--text-ghost)]">{perPkg > 1 ? t("pk.pcsWord", "pcs") : t("pk.unitsWord", "units")}</span>
            {/* What the box holds — the number every quote starts from, so it
                is written in a size that can be read, with the m³ in bold. */}
            <span className="block mt-0.5 text-[11.5px] font-normal tabular-nums text-[var(--text-muted)]">
              {t("pk.capacityWord", "Capacity")} <b className="font-bold text-[var(--text-primary)]">{r.containerCbm} m³</b> · {t("pk.payload", "payload")} {CONTAINERS[key].payload_kg.toLocaleString()} kg
            </span>
          </span>
          {overridden ? (
            <button
              type="button"
              onClick={() => onChange({ [stored]: r.qty } as Partial<ProductLogistics>)}
              className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-300 underline underline-offset-2"
            >
              {t("pk.resetTo", "Edited · reset")} {r.qty}
            </button>
          ) : (
            <span className="text-[8.5px] font-bold uppercase tracking-[0.12em] px-1.5 py-px rounded-full border border-[#567FB2]/50 text-[#3E6796] dark:text-[#7FA9D6]">
              {t("pk.calculated", "Calculated")}
            </span>
          )}
        </div>
        <input
          inputMode="numeric"
          value={String(typed ?? (r.qty || ""))}
          onChange={(e) => onChange({ [stored]: e.target.value } as Partial<ProductLogistics>)}
          placeholder="—"
          className={`${inp} mt-1.5 tabular-nums text-[15px] font-bold`}
        />
        <p className={hint}>
          {perPkg > 1 && r.qty > 0 ? `${Math.floor(r.qty / perPkg)} ${t("pk.pkgsTimes", "packages ×")} ${perPkg} ${t("pk.pcsWord", "pcs")}. ` : ""}
          {r.qty === 0
            ? anyMeasured
              ? t("pk.doesNotFit", "Does not fit — a package is taller or longer than the container.")
              : t("pk.enterPackages", "Enter the packages above.")
            : loadExplain(t, r, sums.grossKg, CONTAINERS[key].payload_kg)}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* The stackable / layers questions used to live here. The count is by
          volume now (owner: "it's totally about the CBM"), so they no longer
          feed anything and asking them would only suggest they did. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {box("c20", "qty_20ft")}
        {box("c40", "qty_40ft")}
        {box("c40hq", "qty_40hq")}
      </div>

      {/* CBM used to sit here too. It is a property of the PACKING and is
          already stated beside the weights it belongs with, so repeating it
          here put the same number on the tab twice. What belongs in Loading
          is the number air freight is actually billed on. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("pk.volumetric", "Volumetric weight (kg, air)")}</label>
          <input value={sums.volumetricKg ? String(sums.volumetricKg) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-60`} />
          {/* Air freight charges the greater of actual and volumetric. Spare
              parts and accessories fly constantly; nothing computed this. */}
          <p className={hint}>{t("pk.volumetricHint", "L×W×H cm ÷ 6000. Air freight bills the greater of this and the gross weight.")}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CUSTOMS — what the border asks that the HS code does not answer.
   ═══════════════════════════════════════════════════════════════════ */
export function CustomsExtras({ value, onChange }: BlockProps) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const dg = value.dangerous_goods ?? {};
  const setDg = (u: Partial<typeof dg>) => onChange({ dangerous_goods: { ...dg, ...u } });
  const toggleKind = (k: string) => {
    const cur = dg.kinds ?? [];
    setDg({ kinds: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] });
  };
  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-[var(--border-subtle)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("pk.originCert", "Origin certificate")}</label>
          <KdsSelect
            value={value.origin_certificate ?? ""}
            onChange={(v: string) => onChange({ origin_certificate: v })}
            options={localise(t, ORIGIN_CERTIFICATES)}
            placeholder={t("pk.select", "— Select —")}
            triggerClassName={inp + " pe-9 text-start"}
          />
          {/* Country of origin says where it was made; this says what the buyer
              can present to pay less duty on it. Form E and Form A carry a
              preference, a plain CO does not. */}
          <p className={hint}>{t("pk.originCertHint", "What the buyer's customs will accept as proof of origin.")}</p>
        </div>
        <div>
          <label className={lbl}>{t("pk.dgLabel", "Regulated content")}</label>
          <div className={choiceRow}>
            {[["none", false], ["has", true]].map(([k, v]) => (
              <button
                key={String(k)}
                type="button"
                onClick={() => setDg({ has: v as boolean })}
                className={`${choiceBtn} ${
                  !!dg.has === v
                    ? v
                      ? "border-amber-500/60 bg-amber-500/[0.12] text-[var(--text-primary)]"
                      : choiceOn
                    : choiceOff
                }`}
              >
                {k === "none" ? t("pk.dgNone", "Nothing regulated") : t("pk.dgHas", "Has regulated content")}
              </button>
            ))}
          </div>
          <p className={hint}>{t("pk.dgHint", "Batteries, oil inside the machine, magnets — asked for by air freight and by every MSDS request.")}</p>
        </div>
      </div>

      {dg.has ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] px-3 py-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {DG_KINDS.map((k) => {
              const on = (dg.kinds ?? []).includes(k.value);
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => toggleKind(k.value)}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    on
                      ? "border-amber-500/60 bg-amber-500/[0.14] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(`pk.opt.${k.value}`, k.label)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>{t("pk.unNumbers", "UN number(s)")}</label>
              <input
                value={dg.un_numbers ?? ""}
                onChange={(e) => setDg({ un_numbers: e.target.value })}
                placeholder="UN3481"
                className={`${inp} font-mono`}
              />
            </div>
            <div>
              <label className={lbl}>{t("pk.dgNote", "Note for the forwarder")}</label>
              <input
                value={dg.notes ?? ""}
                onChange={(e) => setDg({ notes: e.target.value })}
                placeholder={t("pk.dgNotePh", "Oil drained before shipment")}
                className={inp}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHIPPING — where it leaves from. Incoterm and destination are the
   DEAL's, not the product's: they live on the quotation and on the
   supplier link, and repeating them here would rebuild the duplication
   this tab was just cleared of.
   ═══════════════════════════════════════════════════════════════════ */
export function ShippingOrigin({ value, onChange }: BlockProps) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
      <div className="max-w-md">
        <label className={lbl}>{t("pk.portOfLoading", "Default port of loading")}</label>
        {/* The Chinese seaports, not a free line: Koleex ships FROM China and
            the list is the same one the packing list picks from, so the
            product's default port and the document's port can never be two
            spellings of one place. A value entered before the list existed is
            kept as its own option rather than silently dropped. */}
        <KdsSelect
          value={value.port_of_loading ?? ""}
          onChange={(v: string) => onChange({ port_of_loading: v })}
          options={portOptions(value.port_of_loading)}
          placeholder={t("pk.select", "— Select —")}
          triggerClassName={inp + " pe-9 text-start"}
        />
        <p className={hint}>{t("pk.portHint", "Where this product normally ships from — freight cannot be quoted without it.")}</p>
      </div>
    </div>
  );
}
