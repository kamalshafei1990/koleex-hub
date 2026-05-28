"use client";

/* ---------------------------------------------------------------------------
   /knowledge/product-coding-system  ·  v12

   Document-grade redesign. The page itself is the deliverable — it reads
   cleanly on any device, at any width, on a printed sheet, without any
   "Print as PDF" affordance. Visual grammar is Koleex monochrome:

     · Black / white / gray only. No accent colors.
     · Helvetica via the Hub design tokens.
     · Hairline 1px borders, no decorative rounded shells, no glows.
     · Generous whitespace. 8px spacing grid.
     · Restrained hero typography — H1 ≈ 48–56pt.
     · Codes (monospace) carry visual weight, not chrome.

   Structure (5 sections):
     1. The KOLEEX universe   — restrained hero + 9 division grid
     2. Categories            — 11 expandable tiles with inline subs
     3. Technical specs       — XSL / XSO / XSI as three stacked cards
     4. SKU builder           — interactive composer
     5. Intelligence layer    — what the code unlocks (pipeline + cards)
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import { SectionHeader } from "@/components/knowledge/product-coding/primitives";
import {
  DivisionStrip,
  CategoryGrid,
} from "@/components/knowledge/product-coding/HierarchyBlocks";
import BreakdownCard from "@/components/knowledge/product-coding/BreakdownCard";
import CodeBuilder from "@/components/knowledge/product-coding/CodeBuilder";
import AIParseFlow from "@/components/knowledge/product-coding/AIParseFlow";
import {
  CATEGORIES,
  DIVISIONS,
  LOCKSTITCH,
  OVERLOCK,
  INTERLOCK,
  PIPELINE,
  AI_CAPABILITIES,
} from "@/components/knowledge/product-coding/data";

const TOC = [
  { id: "divisions", label: "01 — The KOLEEX universe" },
  { id: "categories", label: "02 — Categories" },
  { id: "technical-breakdown", label: "03 — Technical specifications" },
  { id: "builder", label: "04 — SKU builder" },
  { id: "intelligence", label: "05 — Intelligence layer" },
];

export default function ProductCodingSystemPage() {
  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Breadcrumb bar ─────────────────────────────────────────────── */}
      <div className="border-b border-[var(--border-faint)]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <Link
            href="/knowledge"
            aria-label="Back to Knowledge"
            className="h-8 w-8 flex items-center justify-center border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-faint)]">
            <Link href="/knowledge" className="hover:text-[var(--text-primary)]">
              Knowledge
            </Link>
            <span className="text-[var(--text-dim)]">/</span>
            <span className="text-[var(--text-primary)] font-medium">
              Product Coding System
            </span>
          </div>
        </div>
      </div>

      {/* ── Document body ──────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-12">
          <div className="space-y-20 md:space-y-28 min-w-0">

            {/* ═══ 01 · HERO + DIVISIONS ═══════════════════════════════ */}
            <section id="divisions" className="scroll-mt-20">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--text-faint)] mb-6">
                01 — Enterprise Product Intelligence
              </div>

              <h1 className="text-[40px] sm:text-[48px] md:text-[56px] font-bold tracking-[-0.015em] leading-[1.04] text-[var(--text-primary)] max-w-4xl">
                The KOLEEX universe.
              </h1>
              <p className="mt-6 text-[15px] md:text-[16px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
                Nine divisions share one identity grammar. Every product —
                from a sewing machine to a smart-home sensor — gets its
                code from the same system. This document covers the
                Garment Machinery division, the first one to ship full
                coding coverage.
              </p>

              {/* Meta line — version, scope, division */}
              <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 max-w-3xl text-[12px] border-t border-[var(--border-faint)] pt-5">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Document
                  </dt>
                  <dd className="mt-1 text-[var(--text-primary)] font-medium">
                    Coding System Spec
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Division
                  </dt>
                  <dd className="mt-1 text-[var(--text-primary)] font-medium">
                    Garment Machinery
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Categories
                  </dt>
                  <dd className="mt-1 text-[var(--text-primary)] font-medium font-mono">
                    11
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Subcategories
                  </dt>
                  <dd className="mt-1 text-[var(--text-primary)] font-medium font-mono">
                    {CATEGORIES.reduce((n, c) => n + c.subcategories.length, 0)}
                  </dd>
                </div>
              </dl>

              {/* The 9 divisions */}
              <div className="mt-12">
                <DivisionStrip
                  divisions={DIVISIONS}
                  currentId="garment-machinery"
                />
              </div>
            </section>

            {/* ═══ 02 · CATEGORIES ═════════════════════════════════════ */}
            <section id="categories" className="scroll-mt-20">
              <SectionHeader
                number="02"
                eyebrow="Categories"
                title="Eleven categories of garment machinery."
                sub="Every product code begins with one of these prefixes. Each tile expands to show its subcategories — the full reference lives inside the browse."
                trailing={
                  <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                    11 categories ·{" "}
                    {CATEGORIES.reduce((n, c) => n + c.subcategories.length, 0)}{" "}
                    subs
                  </span>
                }
              />
              <CategoryGrid categories={CATEGORIES} />
            </section>

            {/* ═══ 03 · TECHNICAL SPECIFICATIONS ═══════════════════════ */}
            <section id="technical-breakdown" className="scroll-mt-20">
              <SectionHeader
                number="03"
                eyebrow="Technical specifications"
                title="One card per machine type."
                sub="Three industrial sewing subcategories with full technical decoding — Lockstitch (XSL), Overlock (XSO), Interlock (XSI). Hover or click any axis to highlight its allowed values."
              />

              <div className="space-y-10">
                <BreakdownCard def={LOCKSTITCH} />
                <BreakdownCard def={OVERLOCK} />
                <BreakdownCard def={INTERLOCK} />
              </div>
            </section>

            {/* ═══ 04 · SKU BUILDER ════════════════════════════════════ */}
            <section id="builder" className="scroll-mt-20">
              <SectionHeader
                number="04"
                eyebrow="SKU builder"
                title="Compose a technical SKU."
                sub="Pick a value on each axis. The code assembles in real time and the silhouette highlights the part of the machine each axis controls."
              />
              <CodeBuilder />
            </section>

            {/* ═══ 05 · INTELLIGENCE LAYER ═════════════════════════════ */}
            <section id="intelligence" className="scroll-mt-20">
              <SectionHeader
                number="05"
                eyebrow="Intelligence layer"
                title="What the code unlocks."
                sub="Every segment feeds a different system: ERP routing, BOM resolution, AI reasoning, quotation engine. Parsed once, reused by every consumer."
              />

              <div className="border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 sm:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-5">
                      ERP pipeline
                    </div>
                    <ol className="relative space-y-0">
                      {PIPELINE.map((p, i) => (
                        <li key={p.label} className="relative pl-10">
                          {i < PIPELINE.length - 1 && (
                            <span
                              aria-hidden
                              className="absolute left-[14px] top-7 bottom-[-12px] w-px bg-[var(--border-subtle)]"
                            />
                          )}
                          <div className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center border border-[var(--text-primary)] bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--text-primary)] font-mono">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div className="pb-5">
                            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                              {p.label}
                            </div>
                            <div className="text-[12px] text-[var(--text-faint)] mt-0.5 leading-snug">
                              {p.detail}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-5">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                      What each segment unlocks
                    </div>
                    <ul className="mt-4 space-y-2.5">
                      {[
                        { k: "Model code", v: "Catalog lineage · price-list anchor" },
                        { k: "Function", v: "Capability filter · brochure features" },
                        { k: "Motor / table", v: "Inventory variants · packing weight" },
                        { k: "Operation length", v: "Workbench compatibility" },
                        { k: "Fabric", v: "Recommendation engine input" },
                        { k: "Hook / stitch", v: "Spare-parts BOM resolution" },
                        { k: "Special config", v: "Quotation surcharges + add-ons" },
                      ].map((row) => (
                        <li
                          key={row.k}
                          className="grid grid-cols-[120px_1fr] gap-3 text-[12px]"
                        >
                          <span className="text-[var(--text-muted)]">{row.k}</span>
                          <span className="text-[var(--text-primary)] font-medium">
                            {row.v}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <AIParseFlow />
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--border-faint)] border border-[var(--border-faint)]">
                {AI_CAPABILITIES.map((c) => (
                  <div
                    key={c.title}
                    className="bg-[var(--bg-secondary)] p-4"
                  >
                    <div className="flex h-7 w-7 items-center justify-center border border-[var(--text-primary)] bg-[var(--bg-surface)] text-[12px] font-bold text-[var(--text-primary)] font-mono">
                      {c.glyph}
                    </div>
                    <div className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">
                      {c.title}
                    </div>
                    <div className="mt-1 text-[11.5px] text-[var(--text-faint)] leading-snug">
                      {c.detail}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══ Document signature ══════════════════════════════════ */}
            <div className="border-t border-[var(--border-faint)] pt-6 flex flex-wrap items-center justify-between gap-3 text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)]">
              <span>KOLEEX Enterprise Product Intelligence Architecture</span>
              <span className="font-mono">v12 · Garment Machinery</span>
            </div>
          </div>

          {/* ── Sticky TOC (lg+ only) ── */}
          <aside className="hidden lg:block">
            <nav className="sticky top-20">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
                Contents
              </div>
              <ul className="space-y-0 border-l border-[var(--border-faint)]">
                {TOC.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="block pl-3 -ml-px py-1.5 border-l border-transparent text-[12px] text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}
