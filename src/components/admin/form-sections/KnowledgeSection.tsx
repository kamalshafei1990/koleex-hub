"use client";

/**
 * KnowledgeSection — the Product Knowledge editor.
 *
 * Authors `products.schema_knowledge` (a ProductKnowledgeBlock[]). Until now
 * the form READ and preserved knowledge blocks but had no UI to create or edit
 * them — they could only be set via API/SQL. This is the editor for the layer
 * the catalog calls "Product Knowledge": overview, features, applications,
 * materials, selling points, technical advantages, operation/maintenance notes,
 * buyer Q&A, comparison, recommended use, limitations, package contents,
 * warranty.
 *
 * Pure presentational + state-up: takes blocks, emits the next blocks array.
 * Reuses the canonical defaults from src/types/product-knowledge (visibility
 * presets, aiWeight, titles) so authored blocks match factory-built ones.
 *
 * Brand: monochrome — neutral surfaces + a single functional state. No accent
 * colour used decoratively. Outline icons only.
 */

import { useState } from "react";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import QuoteIcon from "@/components/icons/ui/QuoteIcon";
import type {
  ProductKnowledgeBlock,
  ProductKnowledgeBlockType,
} from "@/types/product-knowledge";
import {
  DEFAULT_KNOWLEDGE_VISIBILITY,
  DEFAULT_KNOWLEDGE_AI_WEIGHT,
  DEFAULT_KNOWLEDGE_TITLE,
} from "@/types/product-knowledge";

type Shape = "text" | "list" | "qa";

interface TypeMeta {
  shape: Shape;
  group: string;
  hint: string;
}

/* The 14 canonical block types, each tagged with its content shape, the
   group it belongs to in the "Add" picker, and a one-line authoring hint.
   Order here also drives the order types appear in the Add menu. */
const TYPE_META: Record<ProductKnowledgeBlockType, TypeMeta> = {
  overview: { shape: "text", group: "Story", hint: "One short paragraph summarising the product." },
  key_features: { shape: "list", group: "Story", hint: "Headline features — one per line." },
  selling_points: { shape: "list", group: "Story", hint: "Why a buyer should choose this — one per line." },
  applications: { shape: "list", group: "Fit & Use", hint: "Production lines / use cases — one per line." },
  suitable_materials: { shape: "list", group: "Fit & Use", hint: "Fabrics & materials it handles — one per line." },
  recommended_use_cases: { shape: "list", group: "Fit & Use", hint: "Best-for scenarios — one per line." },
  technical_advantages: { shape: "list", group: "Technical", hint: "Engineering advantages — one per line." },
  operation_notes: { shape: "list", group: "Technical", hint: "How to run it well — one per line." },
  maintenance_notes: { shape: "list", group: "Technical", hint: "Upkeep & service notes — one per line." },
  comparison_notes: { shape: "list", group: "Technical", hint: "How it compares (internal / quote) — one per line." },
  limitations: { shape: "list", group: "Technical", hint: "Constraints & limitations (internal) — one per line." },
  warnings: { shape: "list", group: "Technical", hint: "Safety warnings & cautions (public) — one per line." },
  package_contents: { shape: "list", group: "Commercial & Support", hint: "What's in the box — one per line." },
  warranty_notes: { shape: "text", group: "Commercial & Support", hint: "Warranty coverage & terms." },
  buyer_questions: { shape: "qa", group: "AI & Buyers", hint: "FAQ — question / answer pairs the AI assistant can quote." },
  troubleshooting: { shape: "list", group: "AI & Buyers", hint: "Common problems and fixes — one per line." },
  ai_summary: { shape: "text", group: "AI & Buyers", hint: "A concise AI-facing summary of the product." },
};

const ALL_TYPES = Object.keys(TYPE_META) as ProductKnowledgeBlockType[];
const GROUP_ORDER = ["Story", "Fit & Use", "Technical", "Commercial & Support", "AI & Buyers"];

interface QA {
  question: string;
  answer: string;
}

/* ── content shape coercion ──────────────────────────────────────────── */
function asList(content: ProductKnowledgeBlock["content"]): string[] {
  if (Array.isArray(content)) return content.map((c) => String(c));
  if (typeof content === "string") return content ? [content] : [];
  return [];
}
function asText(content: ProductKnowledgeBlock["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => String(c)).join("\n");
  return "";
}
function asQA(content: ProductKnowledgeBlock["content"]): QA[] {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const qs = (content as Record<string, unknown>).questions;
    if (Array.isArray(qs)) {
      return qs.map((q) => {
        const o = (q ?? {}) as Record<string, unknown>;
        return { question: String(o.question ?? ""), answer: String(o.answer ?? "") };
      });
    }
  }
  return [];
}

/* Stable-enough id for a freshly added block. Created once on the click that
   adds the block (client only), never recomputed, so edits keep their key. */
function newId(type: ProductKnowledgeBlockType): string {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeEmptyBlock(type: ProductKnowledgeBlockType): ProductKnowledgeBlock {
  const shape = TYPE_META[type].shape;
  const content: ProductKnowledgeBlock["content"] =
    shape === "text" ? "" : shape === "qa" ? { questions: [] } : [];
  return {
    id: newId(type),
    type,
    title: DEFAULT_KNOWLEDGE_TITLE[type],
    content,
    visibility: { ...DEFAULT_KNOWLEDGE_VISIBILITY[type] },
    aiWeight: DEFAULT_KNOWLEDGE_AI_WEIGHT[type],
  };
}

interface Props {
  blocks: ProductKnowledgeBlock[];
  onChange: (blocks: ProductKnowledgeBlock[]) => void;
}

const inputCls =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] focus:outline-none focus:border-[var(--text-muted)] transition-colors";

export default function KnowledgeSection({ blocks, onChange }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const usedTypes = new Set(blocks.map((b) => b.type));

  const update = (idx: number, patch: Partial<ProductKnowledgeBlock>) => {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const remove = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const add = (type: ProductKnowledgeBlockType) => onChange([...blocks, makeEmptyBlock(type)]);

  /* visibility helpers — three plain-English toggles mapped onto flags */
  const setPublic = (idx: number, on: boolean) => {
    const b = blocks[idx];
    update(idx, {
      visibility: {
        ...b.visibility,
        publicVisible: on,
        websiteVisible: on,
        brochureVisible: on,
        internalOnly: on ? false : b.visibility.internalOnly,
      },
    });
  };
  const setInternalOnly = (idx: number, on: boolean) => {
    const b = blocks[idx];
    update(idx, {
      visibility: {
        ...b.visibility,
        internalOnly: on,
        publicVisible: on ? false : b.visibility.publicVisible,
        websiteVisible: on ? false : b.visibility.websiteVisible,
      },
    });
  };
  const setAi = (idx: number, on: boolean) =>
    update(idx, { visibility: { ...blocks[idx].visibility, aiReadable: on } });

  const aiTier = (w: number): "low" | "med" | "high" =>
    w >= 0.95 ? "high" : w >= 0.7 ? "med" : "low";
  const setAiTier = (idx: number, tier: "low" | "med" | "high") =>
    update(idx, { aiWeight: tier === "high" ? 1.0 : tier === "med" ? 0.8 : 0.5 });

  return (
    <div className="space-y-5">
      {/* ── existing blocks ── */}
      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-8 text-center">
          <BookOpenIcon className="mx-auto h-6 w-6 text-[var(--text-ghost)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text-primary)]">
            No knowledge added yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-[var(--text-ghost)]">
            Knowledge blocks power the customer page sections, quotes, brochures and the AI
            assistant. Add the ones that fit this product below.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((b, idx) => {
            const meta = TYPE_META[b.type] ?? { shape: "list" as Shape, group: "Other", hint: "" };
            const isCollapsed = collapsed[b.id];
            const pub = b.visibility.publicVisible && b.visibility.websiteVisible;
            const int = b.visibility.internalOnly;
            return (
              <div
                key={b.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
              >
                {/* header */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [b.id]: !c[b.id] }))}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-base)] transition-colors"
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                  >
                    {isCollapsed ? <AngleRightIcon className="h-4 w-4" /> : <AngleDownIcon className="h-4 w-4" />}
                  </button>
                  <input
                    value={b.title}
                    onChange={(e) => update(idx, { title: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none"
                    placeholder={DEFAULT_KNOWLEDGE_TITLE[b.type] ?? "Title"}
                  />
                  <span className="shrink-0 rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-ghost)]">
                    {b.type.replace(/_/g, " ")}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-base)] disabled:opacity-30 transition-colors" aria-label="Move up">
                      <AngleDownIcon className="h-3.5 w-3.5 rotate-180" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === blocks.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-base)] disabled:opacity-30 transition-colors" aria-label="Move down">
                      <AngleDownIcon className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(idx)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--state-error-bg,var(--bg-base))] hover:text-[var(--state-error,var(--text-primary))] transition-colors" aria-label="Remove block">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-3 border-t border-[var(--border-subtle)] px-4 py-3">
                    <p className="text-[11px] text-[var(--text-ghost)]">{meta.hint}</p>

                    {/* content editor by shape */}
                    {meta.shape === "text" && (
                      <textarea
                        value={asText(b.content)}
                        onChange={(e) => update(idx, { content: e.target.value })}
                        rows={3}
                        className={inputCls + " resize-y leading-relaxed"}
                        placeholder="Write the content…"
                      />
                    )}

                    {meta.shape === "list" && (
                      <div className="space-y-1.5">
                        <textarea
                          value={asList(b.content).join("\n")}
                          onChange={(e) =>
                            update(idx, {
                              content: e.target.value
                                .split("\n")
                                .map((l) => l.trimEnd())
                                .filter((l, i, arr) => l !== "" || i === arr.length - 1),
                            })
                          }
                          rows={Math.max(3, asList(b.content).length + 1)}
                          className={inputCls + " resize-y leading-relaxed"}
                          placeholder={"One item per line…"}
                        />
                        <p className="text-[10px] text-[var(--text-ghost)]">One item per line.</p>
                      </div>
                    )}

                    {meta.shape === "qa" && (
                      <QAEditor
                        items={asQA(b.content)}
                        onChange={(qs) => update(idx, { content: { questions: qs as unknown as Record<string, unknown>[] } })}
                      />
                    )}

                    {/* visibility + AI weight */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Chip active={pub && !int} onClick={() => setPublic(idx, !(pub && !int))}>
                        Public
                      </Chip>
                      <Chip active={int} onClick={() => setInternalOnly(idx, !int)}>
                        Internal only
                      </Chip>
                      <Chip active={b.visibility.aiReadable} onClick={() => setAi(idx, !b.visibility.aiReadable)}>
                        AI readable
                      </Chip>
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-ghost)]">
                        AI weight
                        {(["low", "med", "high"] as const).map((tier) => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setAiTier(idx, tier)}
                            className={
                              "rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-colors " +
                              (aiTier(b.aiWeight) === tier
                                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                                : "border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]")
                            }
                          >
                            {tier}
                          </button>
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── add picker ── */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <PlusIcon className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">Add knowledge</span>
        </div>
        <div className="space-y-3">
          {GROUP_ORDER.map((group) => {
            const types = ALL_TYPES.filter((t) => TYPE_META[t].group === group && !usedTypes.has(t));
            if (types.length === 0) return null;
            return (
              <div key={group}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">
                  {group}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => add(t)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
                    >
                      {t === "buyer_questions" ? (
                        <QuoteIcon className="h-3 w-3 text-[var(--text-muted)]" />
                      ) : (
                        <PlusIcon className="h-3 w-3 text-[var(--text-muted)]" />
                      )}
                      {DEFAULT_KNOWLEDGE_TITLE[t]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {ALL_TYPES.every((t) => usedTypes.has(t)) && (
            <p className="text-[11px] text-[var(--text-ghost)]">All knowledge types have been added.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── a single Public / Internal / AI toggle chip ── */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors " +
        (active
          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
          : "border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]")
      }
    >
      {children}
    </button>
  );
}

/* ── Q&A pair editor for buyer_questions ── */
function QAEditor({ items, onChange }: { items: QA[]; onChange: (items: QA[]) => void }) {
  const set = (i: number, patch: Partial<QA>) =>
    onChange(items.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { question: "", answer: "" }]);
  return (
    <div className="space-y-2">
      {items.map((q, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={q.question}
              onChange={(e) => set(i, { question: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] focus:outline-none"
              placeholder="Question…"
            />
            <button type="button" onClick={() => remove(i)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors" aria-label="Remove question">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={q.answer}
            onChange={(e) => set(i, { answer: e.target.value })}
            rows={2}
            className={inputCls + " resize-y leading-relaxed"}
            placeholder="Answer…"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
      >
        <PlusIcon className="h-3 w-3 text-[var(--text-muted)]" /> Add question
      </button>
    </div>
  );
}
