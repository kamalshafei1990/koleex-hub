"use client";

/* ProductSpecs — the specification sheet, all of it, open.
 *
 * The old sheet hid "standard" and "quiet" groups behind disclosures; a
 * buyer reading for a number had to guess which fold it was under. Every
 * group is now visible: a group title on the left column of a two-column
 * fact grid, a hairline per row, the unit set quietly after the value.
 * Above the tables, the spec facts that are lists of things — suitable
 * materials, applications, automation, other true features — are chips in
 * labelled rows, monochrome, so the eye separates "what it does" from "how
 * much".
 *
 * A family with more differing specs than the hero table shows (three) gets
 * a comparison grid here: one column per model, one row per differing spec.
 */
import { useMemo } from "react";
import type { SpecField, SpecGroup } from "@/types/product-schema";
import { Chip, FactList, formatSpecValue, Glyph, SectionHead } from "./shared";

export interface SpecChipRow { key: string; label: string; items: Array<{ key: string; label: string; glyph: string | null }> }

export default function ProductSpecs({ groups, values, chipRows, comparison, legacyFacts, groupGlyph, yes, no, t }: {
  groups: Array<{ group: SpecGroup; fields: SpecField[] }>;
  values: Record<string, unknown>;
  chipRows: SpecChipRow[];
  comparison: { models: Array<{ code: string; values: Record<string, unknown>; primary: boolean }>; fields: SpecField[] } | null;
  legacyFacts: Array<{ key: string; label: string; value: string }>;
  groupGlyph: (title: string) => string | null;
  yes: string;
  no: string;
  t: (key: string, fallback?: string) => string;
}) {
  const rows = useMemo(() => groups.map(({ group, fields }) => ({
    group,
    rows: fields.map((f) => ({ key: f.key, label: f.label ?? f.key, value: formatSpecValue(f, values[f.key], yes, no) })),
  })), [groups, values, yes, no]);

  const empty = rows.length === 0 && chipRows.length === 0 && !comparison && legacyFacts.length === 0;
  if (empty) return null;

  return (
    <section id="specs" className="space-y-6">
      <SectionHead eyebrow={t("preview.navSpecs", "Specifications")} title={t("preview.technicalSpecifications", "Technical Specifications")} />

      {chipRows.length > 0 ? (
        <div className="space-y-4">
          {chipRows.map((r) => (
            <div key={r.key} className="grid grid-cols-1 md:grid-cols-[11rem_1fr] gap-2 md:gap-4">
              <div className="pt-1.5 text-[13px] text-[var(--text-dim)]">{r.label}</div>
              <div className="flex flex-wrap gap-2">
                {r.items.map((it) => <Chip key={it.key} glyph={it.glyph}>{it.label}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {legacyFacts.length > 0 ? (
        <FactList rows={legacyFacts.map((f) => ({ key: f.key, label: f.label, value: f.value }))} />
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-8">
          {rows.map(({ group, rows: rs }) => {
            const glyph = groupGlyph(group.title);
            return (
              <div key={group.id} className="grid grid-cols-1 lg:grid-cols-[11rem_1fr] gap-2 lg:gap-8">
                <div className="flex items-center gap-2 pt-3 text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {glyph ? <Glyph src={glyph} className="h-4 w-4 text-[var(--text-faint)]" /> : null}
                  {group.title}
                </div>
                <FactList rows={rs} />
              </div>
            );
          })}
        </div>
      ) : null}

      {comparison ? (
        <div className="space-y-4">
          <div id="models" className="scroll-mt-28 text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {t("preview.navModels", "Models compared")}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="bg-[var(--bg-surface-subtle)]">
                  <th className="px-4 py-3 text-start text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("preview.heroFamilyModel", "Model")}</th>
                  {comparison.models.map((m) => (
                    <th key={m.code} className="px-4 py-3 text-start whitespace-nowrap font-semibold text-[var(--text-primary)]">
                      {m.code}
                      {m.primary ? <span className="ms-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)]">{t("preview.primary", "Primary")}</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.fields.map((f) => (
                  <tr key={f.key} className="border-t border-[var(--border-subtle)]">
                    <th scope="row" className="px-4 py-3 text-start font-normal text-[var(--text-dim)]">{f.label ?? f.key}</th>
                    {comparison.models.map((m) => (
                      <td key={m.code} className="px-4 py-3 tabular-nums text-[var(--text-primary)]">{formatSpecValue(f, m.values[f.key], yes, no)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
