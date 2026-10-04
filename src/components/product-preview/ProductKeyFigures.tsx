"use client";

/* ProductKeyFigures — the numbers that describe the machine, first.
 *
 * Up to six schema anchors (metric_block fields and anchored facts), each a
 * cell: value in the display weight, unit beside it, the field's name under
 * it in a small uppercase label. The meter bars of the old band are gone —
 * a bar against a schema maximum told the reader nothing they could act on.
 * Cells sit on a hairline grid so the eye reads them as one table.
 */
import type { ProductAnchor } from "@/lib/product-schema/visual-options";
import { displayScalar, Glyph, selectedValuesOf } from "./shared";

export default function ProductKeyFigures({ anchors, values, fieldGlyph }: {
  anchors: ProductAnchor[];
  values: Record<string, unknown>;
  fieldGlyph: (key: string, label?: string) => string | null;
}) {
  if (anchors.length === 0) return null;
  const cells = anchors.slice(0, 6).map(({ field: f, kind }) => {
    const raw = values[f.key];
    let value = "";
    let unit = "";
    let big = true;
    if (kind === "metric") { value = displayScalar(raw); unit = f.unit ?? ""; }
    else if (kind === "boolean") { value = f.label ?? f.key; big = false; }
    else {
      const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
      value = f.options?.find((o) => o.value === single)?.label ?? displayScalar(raw);
      big = false;
    }
    const label = f.label ?? f.key;
    return { key: f.key, value, unit, big, label: label.trim().toLowerCase() === value.trim().toLowerCase() ? null : label, glyph: fieldGlyph(f.key, label) };
  });
  /* Static class names — Tailwind generates only what it can read. */
  const COLS: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-3", 6: "md:grid-cols-3" };
  return (
    <section id="overview" className="scroll-mt-28">
      <div className={`grid grid-cols-2 ${COLS[cells.length] ?? "md:grid-cols-3"} gap-px rounded-xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] overflow-hidden`}>
        {cells.map((c) => (
          <div key={c.key} className="flex min-h-[7rem] flex-col justify-between gap-4 bg-[var(--bg-primary)] px-5 py-5">
            {c.glyph ? <Glyph src={c.glyph} className="h-4 w-4 text-[var(--text-faint)]" /> : <span className="h-4" />}
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className={c.big ? "text-[32px] leading-none font-medium tracking-[-0.02em] tabular-nums text-[var(--text-primary)]" : "text-[18px] leading-tight font-medium text-[var(--text-primary)]"}>{c.value}</span>
                {c.unit ? <span className="text-[13px] font-medium text-[var(--text-dim)]">{c.unit}</span> : null}
              </div>
              {c.label ? <div className="mt-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)]">{c.label}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
