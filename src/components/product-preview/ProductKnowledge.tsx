"use client";

/* ProductKnowledge — every public knowledge block, one shape.
 *
 * The old page rendered each block type as its own set piece — a snap
 * carousel, a gradient statement, an editorial column, a benefit grid — and
 * the reader had to re-learn the layout at every scroll. Now a block is a
 * block: eyebrow (what kind of knowledge), title, and its items as a list or
 * a paragraph, in a two-column grid that reads top to bottom. Safety
 * warnings carry the one functional colour the brand allows for a warning,
 * as a rule on the card's edge; everything else is monochrome.
 *
 * Buyer questions render as Q / A pairs. Types with nothing to say render
 * nothing; the section renders nothing when no block does.
 */
import type { ProductKnowledgeBlock } from "@/types/product-schema";
import { asKnowledgeList, SectionHead } from "./shared";

const ORDER: Array<{ type: ProductKnowledgeBlock["type"]; key: string; fallback: string; wide?: boolean; warn?: boolean }> = [
  { type: "overview", key: "preview.kb.overview", fallback: "Overview", wide: true },
  { type: "key_features", key: "preview.kb.key_features", fallback: "Key features" },
  { type: "selling_points", key: "preview.kb.selling_points", fallback: "Why it wins" },
  { type: "technical_advantages", key: "preview.kb.technical_advantages", fallback: "Technical advantages" },
  { type: "applications", key: "preview.kb.applications", fallback: "Applications" },
  { type: "suitable_materials", key: "preview.kb.suitable_materials", fallback: "Suitable materials" },
  { type: "recommended_use_cases", key: "preview.kb.recommended_use_cases", fallback: "Recommended use" },
  { type: "operation_notes", key: "preview.kb.operation_notes", fallback: "Operation notes" },
  { type: "maintenance_notes", key: "preview.kb.maintenance_notes", fallback: "Maintenance" },
  { type: "limitations", key: "preview.kb.limitations", fallback: "Limitations" },
  { type: "warnings", key: "preview.kb.warnings", fallback: "Warnings & safety", warn: true, wide: true },
  { type: "package_contents", key: "preview.kb.package_contents", fallback: "What's included" },
  { type: "warranty_notes", key: "preview.kb.warranty_notes", fallback: "Warranty notes" },
  { type: "buyer_questions", key: "preview.kb.buyer_questions", fallback: "Buyer questions", wide: true },
];

function questionsOf(b: ProductKnowledgeBlock): Array<{ question: string; answer: string }> {
  const c = b.content;
  if (c && typeof c === "object" && !Array.isArray(c) && Array.isArray((c as Record<string, unknown>).questions)) {
    return ((c as Record<string, unknown>).questions as Array<{ question: string; answer: string }>).filter((q) => q?.question);
  }
  return [];
}

export default function ProductKnowledge({ byType, t }: {
  /** Localised blocks, grouped by type (the composition localises once). */
  byType: Map<string, ProductKnowledgeBlock[]>;
  t: (key: string, fallback?: string) => string;
}) {
  const cards: Array<{ id: string; eyebrow: string; title: string; items: string[]; qa: Array<{ question: string; answer: string }>; wide: boolean; warn: boolean }> = [];
  for (const o of ORDER) {
    for (const b of byType.get(o.type) ?? []) {
      const qa = o.type === "buyer_questions" ? questionsOf(b) : [];
      const items = o.type === "buyer_questions" ? [] : asKnowledgeList(b.content);
      if (items.length === 0 && qa.length === 0) continue;
      cards.push({ id: b.id, eyebrow: t(o.key, o.fallback), title: b.title?.trim() || t(o.key, o.fallback), items, qa, wide: !!o.wide, warn: !!o.warn });
    }
  }
  if (cards.length === 0) return null;

  return (
    <section id="knowledge" className="space-y-6">
      <SectionHead eyebrow={t("preview.navKnowledge", "Knowledge")} title={t("preview.knowledgeTitle", "About this machine")} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <article
            key={c.id}
            className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-6 ${c.wide ? "md:col-span-2" : ""} ${c.warn ? "border-s-[3px] border-s-[#FFCC00]" : ""}`}
          >
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">{c.eyebrow}</div>
            {c.title.toLowerCase() !== c.eyebrow.toLowerCase() ? (
              <h3 className="mt-1 text-[18px] font-medium text-[var(--text-primary)]">{c.title}</h3>
            ) : null}
            {c.items.length === 1 && c.items[0].length > 140 ? (
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">{c.items[0]}</p>
            ) : c.items.length > 0 ? (
              <ul className={`mt-3 space-y-2 ${c.wide && c.items.length > 4 ? "md:columns-2 md:gap-10" : ""}`}>
                {c.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-[var(--text-secondary)] break-inside-avoid">
                    <span aria-hidden="true" className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {c.qa.length > 0 ? (
              <dl className="mt-3 divide-y divide-[var(--border-subtle)]">
                {c.qa.map((q, i) => (
                  <div key={i} className="py-3">
                    <dt className="text-[14px] font-medium text-[var(--text-primary)]">{q.question}</dt>
                    <dd className="mt-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">{q.answer}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
