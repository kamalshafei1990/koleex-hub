"use client";

/* ---------------------------------------------------------------------------
   KnowledgeSheet — the Knowledge tab of the product profile, editable in place.

   The record used to show ONE number here — how many knowledge blocks the
   product had. The blocks are the authored knowledge the AI layer, the public
   page and every export read, so they are shown in full:

     Product Knowledge   one card per block: its type and group, the text /
                         list / Q&A content (in the reader's language when a
                         translation exists), where it shows (public / internal
                         / AI) and its AI weight. Edit opens the editor's own
                         block editor inside the card — types, presets,
                         translations and weights are its rules.
     Related Products    the linked products with their relation type; Edit
                         searches the catalogue, sets the type, removes.

   Knowledge saves on the product row (schema_knowledge); relations replace
   the set through the related-products API.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProductKnowledgeBlock } from "@/types/product-schema";
import { updateProduct, setRelatedProducts, searchProducts } from "@/lib/products-admin";
import KnowledgeSection from "../form-sections/KnowledgeSection";
import KdsSelect from "@/components/kds/Select";
import BoundIcon from "@/components/common/BoundIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { Group, Blank, INP_B } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type Row = Record<string, unknown>;
type Rel = { related_id: string; relation_type: string; name: string; slug: string | null };
type Draft = { blocks: ProductKnowledgeBlock[]; related: Rel[] };
type Card = "knowledge" | "related";

const REL_TYPES: [string, string][] = [
  ["related", "Related"], ["accessory", "Accessory"], ["spare_part", "Spare part"], ["consumable", "Consumable"],
  ["compatible_with", "Compatible with"], ["required_addon", "Required add-on"], ["optional_attachment", "Optional attachment"],
  ["upgrade", "Upgrade"], ["replaces", "Replaces"], ["replaced_by", "Replaced by"], ["bundle", "Bundle"],
];
const GROUP_OF: Record<string, string> = {
  overview: "Story", key_features: "Story", selling_points: "Story",
  applications: "Fit & Use", suitable_materials: "Fit & Use", recommended_use_cases: "Fit & Use",
  technical_advantages: "Technical", operation_notes: "Technical", maintenance_notes: "Technical", comparison_notes: "Technical", limitations: "Technical", warnings: "Technical",
  package_contents: "Commercial & Support", warranty_notes: "Commercial & Support",
  buyer_questions: "AI & Buyers", troubleshooting: "AI & Buyers", ai_summary: "AI & Buyers",
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default function KnowledgeSheet({
  product, related, productId, t, lang, motion, canEdit, onDirtyChange, onSaved, notSet,
}: {
  product: Row | undefined;
  related: Array<Row & { product: { name: string; slug: string | null } | null }>;
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  lang: string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (u: { product?: Row; related?: Row[] }) => void;
  notSet: string;
}) {
  const blocks = (Array.isArray(product?.schema_knowledge) ? product!.schema_knowledge : []) as ProductKnowledgeBlock[];
  const relOf = (r: Row & { product: { name: string; slug: string | null } | null }): Rel => ({ related_id: str(r.related_id), relation_type: str(r.relation_type) || "related", name: r.product?.name ?? "—", slug: r.product?.slug ?? null });
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; product_name: string; slug: string | null }>>([]);

  const sheet = useSheetEdit<Card, Draft>({
    t, onDirtyChange,
    makeDraft: () => ({ blocks: JSON.parse(JSON.stringify(blocks)) as ProductKnowledgeBlock[], related: related.map(relOf) }),
    commit: async (card, d) => {
      if (!productId) return;
      if (card === "knowledge") {
        const patch = { schema_knowledge: d.blocks };
        await updateProduct(productId, patch);
        onSaved({ product: patch });
      } else {
        const ok = await setRelatedProducts(productId, d.related.map((r) => ({ related_id: r.related_id, relation_type: r.relation_type })));
        if (!ok) throw new Error(t("pr.saveFailed", "Couldn't save — try again."));
        onSaved({ related: d.related.map((r, i) => ({ related_id: r.related_id, relation_type: r.relation_type, order: i, product: { name: r.name, slug: r.slug } })) });
      }
    },
  });
  const d = sheet.draft;
  const eK = sheet.editing === "knowledge";
  const eR = sheet.editing === "related";
  const rels: Rel[] = eR && d ? d.related : related.map(relOf);

  /* Catalogue search while the Related card is open. */
  const term = eR ? q.trim() : "";
  useEffect(() => {
    if (term.length < 2) return;
    let alive = true;
    const id = setTimeout(() => { searchProducts(term, productId).then((r) => { if (alive) setHits(r.map((x) => ({ id: x.id, product_name: x.product_name ?? "", slug: (x.slug as string | null) ?? null }))); }).catch(() => {}); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [term, productId]);
  /* Results are only shown for the term they were fetched for. */
  const shownHits = term.length >= 2 ? hits : [];

  const relLabel = (v: string) => t(`rel.${v}`, REL_TYPES.find(([k]) => k === v)?.[1] ?? humanize(v));
  const lc = lang as "zh" | "ar" | "en";
  const blockTitle = (b: ProductKnowledgeBlock) => (lc !== "en" && b.title_i18n?.[lc as "zh" | "ar"]) || b.title || humanize(b.type);
  const blockContent = (b: ProductKnowledgeBlock): React.ReactNode => {
    const tr = lc !== "en" ? b.content_i18n?.[lc as "zh" | "ar"] : undefined;
    const c = tr ?? b.content;
    if (c === null || c === undefined || c === "" || (Array.isArray(c) && c.length === 0)) return <Blank label={notSet} />;
    if (typeof c === "string") return <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{c}</p>;
    if (Array.isArray(c)) return <ul className="space-y-1">{c.map((x, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[var(--text-ghost)] shrink-0" />{String(x)}</li>)}</ul>;
    const qs = (c as { questions?: Array<{ question?: string; answer?: string }> }).questions;
    if (Array.isArray(qs)) return (
      <div className="space-y-2">
        {qs.map((x, i) => <div key={i}><div className="text-[12.5px] font-semibold text-[var(--text-primary)]">{x.question || "—"}</div><div className="text-[12.5px] text-[var(--text-secondary)]">{x.answer || "—"}</div></div>)}
      </div>
    );
    return <span className="font-mono text-[11px]">{JSON.stringify(c)}</span>;
  };
  const weightTier = (w: number) => (w >= 1 ? t("kn.aiHigh", "High") : w >= 0.8 ? t("kn.aiMed", "Medium") : t("kn.aiLow", "Low"));

  return (
    <div className="space-y-4" onKeyDown={sheet.onKeyDown}>
      {/* ── Product Knowledge ─────────────────────────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="field.knowledge" className="h-4 w-4" fallback={<BookOpenIcon className="h-4 w-4" />} />} title={t("knowledge.title", "Product Knowledge")} count={t("kn.blocksN", "{n} blocks").replace("{n}", String(blocks.length))} {...sheet.gp("knowledge", canEdit)}>
        {eK && d ? (
          <KnowledgeSection blocks={d.blocks} onChange={(next) => sheet.patch({ blocks: next })} />
        ) : blocks.length === 0 ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("kn.none", "No knowledge blocks yet — press Edit to add the first.")}</p>
        ) : (
          <div className="space-y-3">
            {blocks.map((b, i) => {
              const pub = b.visibility?.publicVisible && b.visibility?.websiteVisible;
              const int = b.visibility?.internalOnly;
              return (
                <div key={b.id || i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 p-3 sm:p-4">
                  <div className="flex items-start gap-3 mb-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{GROUP_OF[b.type] ?? "Other"} · {humanize(b.type)}</div>
                      <div className="text-[13.5px] font-semibold text-[var(--text-primary)]">{blockTitle(b)}</div>
                    </div>
                    <span className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {int ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]">INTERNAL</span>
                        : pub ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400/90">PUBLIC</span> : null}
                      {b.visibility?.aiReadable && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)]">AI · {weightTier(b.aiWeight ?? 0.8)}</span>}
                      {(b.title_i18n && Object.keys(b.title_i18n).length) || (b.content_i18n && Object.keys(b.content_i18n).length) ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]">{Object.keys({ ...(b.title_i18n ?? {}), ...(b.content_i18n ?? {}) }).join(" · ").toUpperCase()}</span> : null}
                    </span>
                  </div>
                  {blockContent(b)}
                </div>
              );
            })}
          </div>
        )}
      </Group>

      {/* ── Related Products ─────────────────────────────────────────── */}
      <Group motion={motion} icon={<Link2Icon className="h-4 w-4" />} title={t("review.relatedSection", "Related Products")} count={t("kn.linkedN", "{n} linked").replace("{n}", String(rels.length))} {...sheet.gp("related", canEdit)}>
        {rels.length === 0 && !eR ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("kn.noRelated", "No related products linked.")}</p>
        ) : (
          <div className="space-y-1.5">
            {rels.map((r) => (
              <div key={r.related_id} className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px]">
                {eR && d ? (
                  <KdsSelect value={r.relation_type} onChange={(v) => sheet.patch({ related: d.related.map((x) => (x.related_id === r.related_id ? { ...x, relation_type: v } : x)) })} options={REL_TYPES.map(([v]) => ({ value: v, label: relLabel(v) }))} triggerClassName={`${INP_B} h-8 text-[12px] pe-8 text-start w-[190px]`} />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">{relLabel(r.relation_type)}</span>
                )}
                {r.slug ? <Link href={`/product-data/${r.slug}`} className="text-[var(--text-primary)] hover:underline truncate">{r.name}</Link> : <span className="text-[var(--text-dim)] truncate">{r.name}</span>}
                <span className="flex-1" />
                {eR && d && <button type="button" aria-label={t("cc.remove", "Remove")} onClick={() => sheet.patch({ related: d.related.filter((x) => x.related_id !== r.related_id) })} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>}
              </div>
            ))}
          </div>
        )}
        {eR && d && (
          <div className="mt-3">
            <div className="relative">
              <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)]" />
              <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={t("kn.searchPh", "Search a product to link…")} className={`${INP_B} w-full ps-8 font-normal`} />
            </div>
            {shownHits.length > 0 && (
              <div className="mt-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)] max-h-56 overflow-y-auto">
                {shownHits.filter((h) => !d.related.some((x) => x.related_id === h.id)).map((h) => (
                  <button key={h.id} type="button" onClick={() => { sheet.patch({ related: [...d.related, { related_id: h.id, relation_type: "related", name: h.product_name, slug: h.slug }] }); setQ(""); }}
                    className="block w-full text-start px-3 py-2 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]">{h.product_name}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </Group>
    </div>
  );
}
