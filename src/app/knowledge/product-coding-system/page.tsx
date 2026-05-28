"use client";

/* ---------------------------------------------------------------------------
   /knowledge/product-coding-system  ·  v11

   Redesigned for interactivity AND printability.

     1. Hero + Division layer        — the universe, with print/share toolbar
     2. Category layer (expandable)  — 11 tiles, inline subs on click
     3. Technical breakdowns         — XSL / XSO / XSI as THREE separate
                                       interactive cards (NOT tabs). Each
                                       card prints to a single A4 page.
     4. Live SKU builder             — composer (screen only)
     5. Intelligence layer           — pipeline + AI + capabilities (screen only)

   Print model:
     · Hide breadcrumb, TOC, builder, intelligence on print.
     · Each breakdown card forces page-break-before so a clean A4 packet
       comes out: Cover (hero + divisions) → XSL → XSO → XSI.
     · `.print-only` shows a print-only signature line on the last page.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import {
  SystemStatus,
  SectionHeader,
} from "@/components/knowledge/product-coding/primitives";
import {
  DivisionStrip,
  CategoryGrid,
} from "@/components/knowledge/product-coding/HierarchyBlocks";
import BreakdownCard from "@/components/knowledge/product-coding/BreakdownCard";
import CodeBuilder from "@/components/knowledge/product-coding/CodeBuilder";
import AIParseFlow from "@/components/knowledge/product-coding/AIParseFlow";
import { HubIcon } from "@/components/knowledge/product-coding/icon-registry";
import {
  CATEGORIES,
  DIVISIONS,
  LOCKSTITCH,
  OVERLOCK,
  INTERLOCK,
  SYSTEM_STATUS,
  PIPELINE,
  AI_CAPABILITIES,
} from "@/components/knowledge/product-coding/data";

const TOC = [
  { id: "divisions", label: "1. The KOLEEX universe" },
  { id: "categories", label: "2. Categories" },
  { id: "technical-breakdown", label: "3. Technical breakdown" },
  { id: "builder", label: "4. SKU builder" },
  { id: "intelligence", label: "5. Intelligence layer" },
];

function SectionDivider() {
  return (
    <div className="relative py-2 print:hidden" aria-hidden>
      <div className="h-px w-full bg-[var(--border-faint)]" />
    </div>
  );
}

function handlePrint() {
  if (typeof window !== "undefined") window.print();
}

export default function ProductCodingSystemPage() {
  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] print:bg-white print:text-black">
      {/* ── Print stylesheet — only loaded on print, no runtime cost ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm 12mm;
          }
          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print,
          aside,
          nav {
            display: none !important;
          }
          a {
            color: inherit !important;
            text-decoration: none !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* ── Page-wide depth: faint grid + radial mask (screen only) ── */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.04] print:hidden"
        style={{
          backgroundImage:
            "linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(80% 50% at 50% 20%, black 30%, transparent 90%)",
        }}
      />

      {/* ── Breadcrumb bar ── */}
      <div className="relative border-b border-[var(--border-faint)] bg-[var(--bg-primary)]/80 backdrop-blur-sm print:hidden">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/knowledge"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
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

          {/* Toolbar — Print + Copy URL */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-1.5"
              aria-label="Print full document"
            >
              <span aria-hidden>⎙</span>
              <span className="hidden sm:inline">Print PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 print:max-w-none print:px-0 print:py-0">
        <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-10 print:block">
          <div className="space-y-14 md:space-y-20 min-w-0 print:space-y-6">

            {/* ═══ 1 · HERO + DIVISION LAYER ══════════════════════════ */}
            <section id="divisions" className="scroll-mt-20 print:break-after-page">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] print:hidden">
                  <HubIcon domain="section" k="breakdown" size={16} />
                </div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] print:text-black">
                  Enterprise Product Intelligence · Garment Machinery Division
                </div>
              </div>

              <h1 className="text-[40px] sm:text-[56px] md:text-[72px] lg:text-[80px] font-semibold tracking-[-0.02em] leading-[0.98] text-[var(--text-primary)] max-w-5xl print:text-[42px] print:text-black">
                The KOLEEX universe.
              </h1>
              <p className="mt-6 text-[15px] md:text-[17px] text-[var(--text-faint)] max-w-2xl leading-relaxed print:text-[12px] print:text-gray-700">
                Nine divisions share one identity grammar. Every product
                — from a sewing machine to a smart-home sensor — gets
                its code from the same system. You are reading the
                Garment Machinery division, the first one to ship full
                coding coverage.
              </p>

              <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 print:hidden">
                {SYSTEM_STATUS.map((s, i) => (
                  <SystemStatus
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    pulse={i === 0}
                  />
                ))}
              </div>

              <div className="mt-10">
                <DivisionStrip divisions={DIVISIONS} currentId="garment-machinery" />
              </div>
            </section>

            <SectionDivider />

            {/* ═══ 2 · CATEGORY LAYER (expandable) ════════════════════ */}
            <section id="categories" className="scroll-mt-20 print:hidden">
              <SectionHeader
                number="02"
                eyebrow="Categories"
                title="Eleven categories of garment machinery."
                sub="Each category begins with one of these prefixes. Click any tile to expand its subcategory table inline — the full reference lives inside the browse, not in a separate wall of cards."
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

            <SectionDivider />

            {/* ═══ 3 · TECHNICAL BREAKDOWNS (3 separate cards) ════════ */}
            <section id="technical-breakdown" className="scroll-mt-20">
              <SectionHeader
                number="03"
                eyebrow="Technical breakdowns"
                title="One card per machine type."
                sub="Three subcategories with full technical decoding — Lockstitch (XSL), Overlock (XSO), Interlock (XSI). Each card is interactive on screen and prints to a single page."
                trailing={
                  <div className="flex items-center gap-2 print:hidden">
                    <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                      Hover · Click · Print
                    </span>
                  </div>
                }
              />

              {/* Quick-jump pills (screen only) */}
              <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
                {[LOCKSTITCH, OVERLOCK, INTERLOCK].map((d) => (
                  <a
                    key={d.id}
                    href={`#${d.id}`}
                    className="inline-flex items-center gap-2 px-3 h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <span className="font-mono tracking-wider">{d.prefix}</span>
                    <span className="opacity-70 font-medium">
                      {d.title.split(" · ")[0]}
                    </span>
                  </a>
                ))}
              </div>

              <div className="space-y-6 print:space-y-0">
                <BreakdownCard def={LOCKSTITCH} />
                <BreakdownCard def={OVERLOCK} />
                <BreakdownCard def={INTERLOCK} />
              </div>
            </section>

            <SectionDivider />

            {/* ═══ 4 · LIVE BUILDER (screen only) ═════════════════════ */}
            <section id="builder" className="scroll-mt-20 print:hidden">
              <SectionHeader
                number="04"
                eyebrow="Live SKU builder"
                title="Compose a technical SKU."
                sub="Pick a value on each axis. The code assembles in real time and the silhouette highlights the part of the machine each axis controls."
              />
              <CodeBuilder />
            </section>

            <SectionDivider />

            {/* ═══ 5 · INTELLIGENCE LAYER (screen only) ═══════════════ */}
            <section id="intelligence" className="scroll-mt-20 print:hidden">
              <SectionHeader
                number="05"
                eyebrow="Intelligence layer"
                title="What the code unlocks."
                sub="Every segment feeds a different system: ERP routing, BOM resolution, AI reasoning, quotation engine. Parsed once, reused by every consumer."
              />

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-7">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
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
                          <div className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--text-primary)]">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div className="pb-5">
                            <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                              {p.label}
                            </div>
                            <div className="text-[11.5px] text-[var(--text-faint)] mt-0.5 leading-snug">
                              {p.detail}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-5">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                      What each segment unlocks
                    </div>
                    <ul className="mt-3 space-y-2.5">
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

              <div className="mt-5">
                <AIParseFlow />
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {AI_CAPABILITIES.map((c) => (
                  <div
                    key={c.title}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-bold text-[var(--text-primary)]">
                      {c.glyph}
                    </div>
                    <div className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">
                      {c.title}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--text-faint)] leading-snug">
                      {c.detail}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══ Footer signature (screen) ══════════════════════════ */}
            <div className="text-center text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)] pt-6 border-t border-[var(--border-faint)] print:hidden">
              KOLEEX Enterprise Product Intelligence Architecture · v11
            </div>

            {/* Print-only footer signature */}
            <div className="print-only mt-4 text-center text-[9px] tracking-[0.18em] uppercase text-gray-700 border-t border-gray-400 pt-3">
              KOLEEX Enterprise Product Intelligence Architecture · v11 · printed reference
            </div>
          </div>

          {/* ── Sticky TOC (lg+ only, screen only) ── */}
          <aside className="hidden lg:block print:hidden">
            <nav className="sticky top-20 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2.5">
                Contents
              </div>
              {TOC.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="block py-1.5 px-2 -mx-2 rounded-md text-[12px] text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                >
                  {t.label}
                </a>
              ))}
              <div className="mt-4 pt-4 border-t border-[var(--border-faint)]">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <span aria-hidden>⎙</span> Print as PDF
                </button>
              </div>
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}
