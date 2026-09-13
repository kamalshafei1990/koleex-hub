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

import { useMemo } from "react";
import KdsSelect from "@/components/kds/Select";
import {
  CONTAINERS, DG_KINDS, ORIGIN_CERTIFICATES, PACKING_TYPES, WOOD_TREATMENTS,
  loadPlan, sumPackages,
  type PackageRow, type ProductLogistics,
} from "@/lib/logistics";

const lbl = "block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5";
const inp =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";
const hint = "text-[10px] text-[var(--text-ghost)] leading-relaxed mt-1";

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
  const sums = useMemo(() => sumPackages(value.packages), [value.packages]);
  const plan = useMemo(
    () => loadPlan(value.packages, { stackable: value.stackable, stackMax: n(value.stack_max) }),
    [value.packages, value.stackable, value.stack_max],
  );
  if (sums.packageCount === 0) return null;
  const cell = (k: string, v: string) => (
    <div key={k} className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-ghost)]">{k}</div>
      <div className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] truncate">{v}</div>
    </div>
  );
  return (
    <div className="kx-glass rounded-xl border border-[#567FB2]/30 px-4 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
        {cell("Packages", `${sums.packageCount} / unit`)}
        {cell("Volume", `${sums.cbm} m³`)}
        {cell("Gross", `${sums.grossKg} kg`)}
        {cell("20ft", plan.c20.qty ? String(plan.c20.qty) : "—")}
        {cell("40ft", plan.c40.qty ? String(plan.c40.qty) : "—")}
        {cell("40HQ", plan.c40hq.qty ? String(plan.c40hq.qty) : "—")}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PACKING — the crates.
   ═══════════════════════════════════════════════════════════════════ */
export function PackingBlock({ value, onChange }: BlockProps) {
  /* Memoised so the fallback row is not a fresh array on every render — that
     identity change re-ran the sums below on every keystroke anywhere on the
     form. */
  const rows: PackageRow[] = useMemo(
    () => (value.packages?.length ? value.packages : [{ qty: 1 }]),
    [value.packages],
  );
  const sums = useMemo(() => sumPackages(rows), [rows]);

  const setRow = (i: number, u: Partial<PackageRow>) => {
    const next = rows.map((r, x) => (x === i ? { ...r, ...u } : r));
    onChange({ packages: next, cbm: sumPackages(next).cbm, gross_weight_kg: sumPackages(next).grossKg });
  };
  const addRow = () => onChange({ packages: [...rows, { qty: 1 }] });
  const removeRow = (i: number) => {
    const next = rows.filter((_, x) => x !== i);
    onChange({ packages: next, cbm: sumPackages(next).cbm, gross_weight_kg: sumPackages(next).grossKg });
  };

  const numCell = (i: number, k: keyof PackageRow, ph: string) => (
    <input
      inputMode="decimal"
      value={String(rows[i][k] ?? "")}
      onChange={(e) => setRow(i, { [k]: e.target.value } as Partial<PackageRow>)}
      placeholder={ph}
      className={`${inp} text-center tabular-nums px-1.5`}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Packing type</label>
          <KdsSelect
            value={value.packing_type ?? ""}
            onChange={(v: string) => onChange({ packing_type: v })}
            options={PACKING_TYPES.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="— Select —"
            triggerClassName={inp + " pe-9 text-start"}
          />
        </div>
        <div>
          <label className={lbl}>Wood treatment (ISPM-15)</label>
          <KdsSelect
            value={value.wood_treatment ?? ""}
            onChange={(v: string) => onChange({ wood_treatment: v })}
            options={WOOD_TREATMENTS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="— Select —"
            triggerClassName={inp + " pe-9 text-start"}
          />
          {/* Not paperwork trivia: untreated solid wood is refused at the
              border, and the shipment is fumigated at the port or sent back. */}
          <p className={hint}>
            {value.wood_treatment === "untreated"
              ? "⚠ Untreated solid wood is refused by EU / US / AU customs — it must be heat-treated or fumigated and bear the IPPC mark."
              : "Solid wood packaging must be treated and IPPC-marked. Plywood and processed board are exempt."}
          </p>
        </div>
      </div>

      {/* ── the crates ──
          ONE ROW PER CRATE, because one machine is regularly more than one
          crate — a spreader ships as machine + table/rails + accessory box.
          A single set of dimensions gets the volume, the weight and every
          container count wrong, and cannot produce a packing list at all. */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className={`${lbl} mb-0`}>Packages per unit</label>
          <span className="text-[10px] tabular-nums text-[var(--text-ghost)]">
            {sums.packageCount} pkg · {sums.cbm} m³ · {sums.grossKg} kg
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-y-1.5">
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-ghost)]">
                <th className="text-start font-semibold ps-1">What&apos;s inside</th>
                <th className="w-14 font-semibold">Qty</th>
                <th className="w-20 font-semibold">L (cm)</th>
                <th className="w-20 font-semibold">W (cm)</th>
                <th className="w-20 font-semibold">H (cm)</th>
                <th className="w-24 font-semibold">Gross (kg)</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="pe-2">
                    <input
                      value={r.label ?? ""}
                      onChange={(e) => setRow(i, { label: e.target.value })}
                      placeholder={i === 0 ? "Machine" : "Table & rails / Accessories"}
                      className={inp}
                    />
                  </td>
                  <td className="px-1">{numCell(i, "qty", "1")}</td>
                  <td className="px-1">{numCell(i, "l_cm", "120")}</td>
                  <td className="px-1">{numCell(i, "w_cm", "80")}</td>
                  <td className="px-1">{numCell(i, "h_cm", "110")}</td>
                  <td className="px-1">{numCell(i, "gross_kg", "210")}</td>
                  <td className="ps-1">
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label="Remove package"
                        className="h-8 w-8 rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-1 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-base)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors"
        >
          + Add package
        </button>
        <p className={hint}>
          Centimetres — the unit on every packing list and bill of lading. Machine
          dimensions above stay in mm.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={lbl}>Net weight (kg)</label>
          <input
            inputMode="decimal"
            value={String(value.net_weight_kg ?? "")}
            onChange={(e) => onChange({ net_weight_kg: e.target.value })}
            placeholder="180"
            className={`${inp} tabular-nums`}
          />
          <p className={hint}>The goods without packaging.</p>
        </div>
        <div>
          <label className={lbl}>Gross weight (kg)</label>
          <input
            value={sums.grossKg ? String(sums.grossKg) : ""}
            readOnly
            placeholder="—"
            className={`${inp} tabular-nums opacity-60`}
          />
          {/* Gross used to be a free number with no relationship to anything;
              it is the sum of the crates, so the crates state it. */}
          <p className={hint}>Sum of the packages above.</p>
        </div>
        <div>
          <label className={lbl}>Packaging weight (kg)</label>
          <input
            value={sums.grossKg && n(value.net_weight_kg) ? String(Math.round((sums.grossKg - n(value.net_weight_kg)) * 100) / 100) : ""}
            readOnly
            placeholder="—"
            className={`${inp} tabular-nums opacity-60`}
          />
          <p className={hint}>Gross − net. Negative means one of them is wrong.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOADING — how many fit, and which limit decides it.
   ═══════════════════════════════════════════════════════════════════ */
export function LoadingBlock({ value, onChange }: BlockProps) {
  const sums = useMemo(() => sumPackages(value.packages), [value.packages]);
  const plan = useMemo(
    () => loadPlan(value.packages, { stackable: value.stackable, stackMax: n(value.stack_max) }),
    [value.packages, value.stackable, value.stack_max],
  );

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
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">{CONTAINERS[key].label}</span>
          {overridden ? (
            <button
              type="button"
              onClick={() => onChange({ [stored]: r.qty } as Partial<ProductLogistics>)}
              className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-300 underline underline-offset-2"
            >
              Edited · reset {r.qty}
            </button>
          ) : (
            <span className="text-[8.5px] font-bold uppercase tracking-[0.12em] px-1.5 py-px rounded-full border border-[#567FB2]/50 text-[#3E6796] dark:text-[#7FA9D6]">
              Calculated
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
          {r.qty === 0
            ? anyMeasured
              ? "Does not fit — a package is taller or longer than the container."
              : "Enter the packages above."
            : r.limit === "weight"
              ? `Weight-limited — ${CONTAINERS[key].payload_kg.toLocaleString()} kg payload.`
              : "Space-limited — footprint × layers."}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Can crates be stacked?</label>
          <div className="flex items-center gap-2">
            {[["yes", true], ["no", false]].map(([k, v]) => (
              <button
                key={String(k)}
                type="button"
                onClick={() => onChange({ stackable: v as boolean })}
                className={`h-10 px-4 rounded-lg text-[12px] font-semibold border transition-colors ${
                  !!value.stackable === v
                    ? "border-[#567FB2]/60 bg-[#567FB2]/[0.12] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {k === "yes" ? "Stackable" : "Not stackable"}
              </button>
            ))}
          </div>
          {/* This one answer can halve or double every number below it: an
              unstackable crate wastes the whole container above its own height. */}
          <p className={hint}>An unstackable crate uses the floor only — everything above it is air.</p>
        </div>
        {value.stackable ? (
          <div>
            <label className={lbl}>Maximum layers</label>
            <input
              inputMode="numeric"
              value={String(value.stack_max ?? "")}
              onChange={(e) => onChange({ stack_max: e.target.value })}
              placeholder="2"
              className={`${inp} tabular-nums`}
            />
            <p className={hint}>Blank = as many as the container height allows.</p>
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
          <label className={lbl}>Volume (m³ per unit)</label>
          <input value={sums.cbm ? String(sums.cbm) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-60`} />
          <p className={hint}>All packages together.</p>
        </div>
        <div>
          <label className={lbl}>Volumetric weight (kg, air)</label>
          <input value={sums.volumetricKg ? String(sums.volumetricKg) : ""} readOnly placeholder="—" className={`${inp} tabular-nums opacity-60`} />
          {/* Air freight charges the greater of actual and volumetric. Spare
              parts and accessories fly constantly; nothing computed this. */}
          <p className={hint}>
            L×W×H cm ÷ 6000. Air freight bills the greater of this and {sums.grossKg || "gross"} kg.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CUSTOMS — what the border asks that the HS code does not answer.
   ═══════════════════════════════════════════════════════════════════ */
export function CustomsExtras({ value, onChange }: BlockProps) {
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
          <label className={lbl}>Origin certificate</label>
          <KdsSelect
            value={value.origin_certificate ?? ""}
            onChange={(v: string) => onChange({ origin_certificate: v })}
            options={ORIGIN_CERTIFICATES.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="— Select —"
            triggerClassName={inp + " pe-9 text-start"}
          />
          {/* Country of origin says where it was made; this says what the buyer
              can present to pay less duty on it. Form E and Form A carry a
              preference, a plain CO does not. */}
          <p className={hint}>What the buyer&apos;s customs will accept as proof of origin.</p>
        </div>
        <div>
          <label className={lbl}>Regulated content</label>
          <div className="flex items-center gap-2">
            {[["none", false], ["has", true]].map(([k, v]) => (
              <button
                key={String(k)}
                type="button"
                onClick={() => setDg({ has: v as boolean })}
                className={`h-10 px-4 rounded-lg text-[12px] font-semibold border transition-colors ${
                  !!dg.has === v
                    ? v
                      ? "border-amber-500/60 bg-amber-500/[0.12] text-[var(--text-primary)]"
                      : "border-[#567FB2]/60 bg-[#567FB2]/[0.12] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {k === "none" ? "Nothing regulated" : "Has regulated content"}
              </button>
            ))}
          </div>
          <p className={hint}>Batteries, oil inside the machine, magnets — asked for by air freight and by every MSDS request.</p>
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
                  {k.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>UN number(s)</label>
              <input
                value={dg.un_numbers ?? ""}
                onChange={(e) => setDg({ un_numbers: e.target.value })}
                placeholder="UN3481"
                className={`${inp} font-mono`}
              />
            </div>
            <div>
              <label className={lbl}>Note for the forwarder</label>
              <input
                value={dg.notes ?? ""}
                onChange={(e) => setDg({ notes: e.target.value })}
                placeholder="Oil drained before shipment"
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
  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
      <div className="max-w-md">
        <label className={lbl}>Default port of loading</label>
        <input
          value={value.port_of_loading ?? ""}
          onChange={(e) => onChange({ port_of_loading: e.target.value })}
          placeholder="Shanghai"
          className={inp}
        />
        <p className={hint}>Where this product normally ships from — freight cannot be quoted without it.</p>
      </div>
    </div>
  );
}
