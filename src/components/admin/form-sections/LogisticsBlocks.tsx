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

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import KdsSelect from "@/components/kds/Select";
import {
  CONTAINERS, DG_KINDS, ITEM_KINDS, ORIGIN_CERTIFICATES, PACKING_TYPES, WOOD_TREATMENTS,
  loadPlan, sumPackages,
  type ContentItem, type PackageRow, type PackingMode, type ProductLogistics,
} from "@/lib/logistics";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import PlugIcon from "@/components/icons/ui/PlugIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import FileIcon from "@/components/icons/ui/FileIcon";

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
const localise = (t: TFn, list: readonly { value: string; label: string }[]) =>
  list.map((o) => ({ value: o.value, label: t(`pk.opt.${o.value}`, o.label) }));

type Patch = (u: Partial<ProductLogistics>) => void;
interface BlockProps { value: ProductLogistics; onChange: Patch; }

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(x) ? x : 0;
};

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
      stackable: value.stackable, stackMax: n(value.stack_max),
      unitsPerPackage: value.packing_mode === "per_package" ? n(value.units_per_package) : 1,
    }),
    [value.packages, value.stackable, value.stack_max, value.packing_mode, value.units_per_package],
  );
  if (sums.packageCount === 0) return null;
  const perPkg = value.packing_mode === "per_package" ? Math.max(1, Math.floor(n(value.units_per_package) || 1)) : 1;
  const cell = (k: string, v: string) => (
    <div key={k} className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-ghost)]">{k}</div>
      <div className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] truncate">{v}</div>
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
export function PackingBlock({ value, onChange, productId }: BlockProps & { productId?: string }) {
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

  const write = (next: PackageRow[]) => {
    const s = sumPackages(next);
    onChange({ packages: next, cbm: s.cbm, gross_weight_kg: s.grossKg });
  };
  const setRow = (i: number, u: Partial<PackageRow>) => write(rows.map((r, x) => (x === i ? { ...r, ...u } : r)));
  const addRow = () => onChange({ packages: [...rows, { qty: 1 }] });
  const removeRow = (i: number) => write(rows.filter((_, x) => x !== i));

  const numCell = (i: number, k: keyof PackageRow, ph: string, label: string) => (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1">{label}</div>
      <input
        inputMode="decimal"
        value={String(rows[i][k] ?? "")}
        onChange={(e) => setRow(i, { [k]: e.target.value } as Partial<PackageRow>)}
        placeholder={ph}
        className={`${inp} text-center tabular-nums px-1.5`}
      />
    </div>
  );

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
          <div>
            <label className={lbl}>{t("pk.cbm", "CBM (m³)")}</label>
            <input value={sums.cbm ? String(sums.cbm) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-70`} />
            <p className={hint}>{t("pk.cbmHintCalc", "Calculated from the package sizes below — L × W × H ÷ 1,000,000.")}</p>
          </div>
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
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className={`${lbl} mb-0`}>{mode === "per_package" ? t("pk.packageOne", "Package") : t("pk.packagesPerUnit", "Packages per unit")}</label>
          <span className="text-[10px] tabular-nums text-[var(--text-ghost)]">
            {sums.packageCount} pkg · {sums.cbm} m³ · {sums.grossKg} kg
            {mode === "per_package" && per > 1 ? ` · ${Math.round((sums.cbm / per) * 10000) / 10000} m³/pc` : ""}
          </span>
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3 space-y-3">
              <div className="flex items-start gap-2 sm:gap-3">
                <ItemPhoto
                  url={r.photo_url ?? null}
                  kind="box"
                  size="lg"
                  onChange={(u) => setRow(i, { photo_url: u })}
                  productId={productId}
                />
                <div className="flex-1 min-w-0 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div className="col-span-3 sm:col-span-2 min-w-0">
                    <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-1">{t("pk.colPackage", "Package")}</div>
                    <input
                      value={r.label ?? ""}
                      onChange={(e) => setRow(i, { label: e.target.value })}
                      placeholder={i === 0 ? t("pk.phMachineCrate", "Machine crate") : t("pk.phAccBox", "Accessories box")}
                      className={inp}
                    />
                  </div>
                  {numCell(i, "qty", "1", t("pk.colQty", "Qty"))}
                  {numCell(i, "l_cm", "120", t("pk.colL", "L (cm)"))}
                  {numCell(i, "w_cm", "80", t("pk.colW", "W (cm)"))}
                  {numCell(i, "h_cm", "110", t("pk.colH", "H (cm)"))}
                  <div className="col-span-3 sm:col-span-1">{numCell(i, "gross_kg", "210", t("pk.colGross", "Gross (kg)"))}</div>
                </div>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="Remove package"
                    className="h-8 w-8 shrink-0 rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    ×
                  </button>
                ) : null}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className={lbl}>{t("pk.netWeight", "Net weight (kg)")}</label>
          <input
            inputMode="decimal"
            value={String(value.net_weight_kg ?? "")}
            onChange={(e) => onChange({ net_weight_kg: e.target.value })}
            placeholder="180"
            className={`${inp} tabular-nums`}
          />
          <p className={hint}>{t("pk.netHint", "The goods without packaging.")}</p>
        </div>
        <div>
          <label className={lbl}>{t("pk.grossWeight", "Gross weight (kg)")}</label>
          <input value={sums.grossKg ? String(sums.grossKg) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-70`} />
          {/* Gross used to be a free number with no relationship to anything;
              it is the sum of the crates, so the crates state it. */}
          <p className={hint}>{t("pk.grossHint", "Sum of the packages above.")}</p>
        </div>
        <div>
          <label className={lbl}>{t("pk.packagingWeight", "Packaging weight (kg)")}</label>
          <input
            value={sums.grossKg && n(value.net_weight_kg) ? String(Math.round((sums.grossKg - n(value.net_weight_kg)) * 100) / 100) : ""}
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

function useImagePicker(onPicked: (url: string | null) => void, productId?: string) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
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
  return { busy, open: () => ref.current?.click(), input };
}

function PackingPhoto({
  url, onChange, productId,
}: { url: string | null; onChange: (u: string | null) => void; productId?: string }) {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const { busy, open, input } = useImagePicker(onChange, productId);
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
          title="Click to replace"
          className="block w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40"
        >
          {/* Deliberately large. A packing photo is read, not glanced at: the
              buyer is looking for how the corners are protected and whether the
              crate is closed or open. A thumbnail answers neither. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Packing sample" className="w-full max-h-[420px] object-contain bg-black/20" />
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="w-full h-40 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 text-[12px] text-[var(--text-ghost)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)] transition-colors disabled:opacity-50"
        >
          {busy ? t("pk.uploading", "Uploading…") : t("pk.samplePhotoCta", "Click to upload a photo of the packed product")}
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
  const { busy, open, input } = useImagePicker(onChange, productId);
  const box = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return (
    <>
      {input}
      <button
        type="button"
        onClick={open}
        disabled={busy}
        title={url ? "Click to replace the photo" : "Click to add a photo"}
        className={`${box} shrink-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 flex items-center justify-center text-[var(--text-ghost)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)] transition-colors disabled:opacity-50`}
      >
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ItemGlyph kind={kind} className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
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
function ContentsEditor({
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
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)]">{t("pk.whatsInside", "What's inside")}</div>
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
              aria-label="Remove item"
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
      stackable: value.stackable, stackMax: n(value.stack_max),
      unitsPerPackage: value.packing_mode === "per_package" ? n(value.units_per_package) : 1,
    }),
    [value.packages, value.stackable, value.stack_max, value.packing_mode, value.units_per_package],
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
            : r.limit === "weight"
              ? `${t("pk.weightLimited", "Weight-limited")} — ${CONTAINERS[key].payload_kg.toLocaleString()} kg ${t("pk.payload", "payload")}.`
              : t("pk.spaceLimited", "Space-limited — footprint × layers.")}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("pk.stackQ", "Can crates be stacked?")}</label>
          <div className={choiceRow}>
            {[["yes", true], ["no", false]].map(([k, v]) => (
              <button
                key={String(k)}
                type="button"
                onClick={() => onChange({ stackable: v as boolean })}
                className={`${choiceBtn} ${!!value.stackable === v ? choiceOn : choiceOff}`}
              >
                {k === "yes" ? t("pk.stackable", "Stackable") : t("pk.notStackable", "Not stackable")}
              </button>
            ))}
          </div>
          {/* This one answer can halve or double every number below it: an
              unstackable crate wastes the whole container above its own height. */}
          <p className={hint}>{t("pk.stackHint", "An unstackable crate uses the floor only — everything above it is air.")}</p>
        </div>
        {value.stackable ? (
          <div>
            <label className={lbl}>{t("pk.maxLayers", "Maximum layers")}</label>
            <input
              inputMode="numeric"
              value={String(value.stack_max ?? "")}
              onChange={(e) => onChange({ stack_max: e.target.value })}
              placeholder="2"
              className={`${inp} tabular-nums`}
            />
            <p className={hint}>{t("pk.maxLayersHint", "Blank = as many as the container height allows.")}</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {box("c20", "qty_20ft")}
        {box("c40", "qty_40ft")}
        {box("c40hq", "qty_40hq")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>{t("pk.cbm", "CBM (m³)")}</label>
          <input value={sums.cbm ? String(sums.cbm) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-60`} />
          <p className={hint}>{t("pk.cbmHintAll", "All packages together.")}</p>
        </div>
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
        <input
          value={value.port_of_loading ?? ""}
          onChange={(e) => onChange({ port_of_loading: e.target.value })}
          placeholder="Shanghai"
          className={inp}
        />
        <p className={hint}>{t("pk.portHint", "Where this product normally ships from — freight cannot be quoted without it.")}</p>
      </div>
    </div>
  );
}
