"use client";

/* ---------------------------------------------------------------------------
   /knowledge/product-coding-system  ·  v2

   Visual Product Intelligence Experience. The page treats the
   product code as the DNA of the machine and walks through every
   layer the code controls: identity, taxonomy, breakdown, builder,
   ERP, AI, and the cross-division ecosystem.

   All visual primitives are imported from
   `src/components/knowledge/product-coding/`. Icons are pulled from
   the central Hub icon registry — no inline SVGs in this file.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import {
  CodeSegment,
  CodePrefix,
  Dash,
  SystemStatus,
  SectionHeader,
} from "@/components/knowledge/product-coding/primitives";
import CodingBreakdown from "@/components/knowledge/product-coding/CodingBreakdown";
import CodeBuilder from "@/components/knowledge/product-coding/CodeBuilder";
import EcosystemMap from "@/components/knowledge/product-coding/EcosystemMap";
import AIParseFlow from "@/components/knowledge/product-coding/AIParseFlow";
import { HubIcon } from "@/components/knowledge/product-coding/icon-registry";
import {
  MAIN_CATEGORIES,
  SEWING_CATEGORIES,
  LOCKSTITCH,
  OVERLOCK,
  INTERLOCK,
  SYSTEM_STATUS,
  PIPELINE,
  AI_CAPABILITIES,
} from "@/components/knowledge/product-coding/data";

export default function ProductCodingSystemPage() {
  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Page-wide depth: faint engineering grid + radial glow ── */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(80% 50% at 50% 20%, black 30%, transparent 90%)",
        }}
      />

      {/* ── Breadcrumb bar ── */}
      <div className="relative border-b border-[var(--border-faint)] bg-[var(--bg-primary)]/80 backdrop-blur-sm">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center gap-3">
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
      </div>

      <div className="relative max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 space-y-16 md:space-y-20">

        {/* ════════════════════════════════════════════════════════════════
            HERO
            ════════════════════════════════════════════════════════════════ */}
        <header className="relative">
          {/* eyebrow + system status row */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]">
              <HubIcon domain="section" k="breakdown" size={16} />
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Enterprise Product Intelligence · Garment Machinery Division
            </div>
          </div>

          <h1 className="text-[34px] sm:text-[44px] md:text-[58px] font-semibold tracking-tight leading-[1.02] text-[var(--text-primary)] max-w-5xl">
            The code is the DNA of the machine.
          </h1>
          <p className="mt-4 text-[15px] md:text-[16px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
            One grammar drives the catalog, the ERP, the BOM, the
            spare-parts engine, the quotation system, and the AI
            assistant. Every segment of a KOLEEX SKU is a parameter
            inside a living industrial operating system.
          </p>

          {/* ── System status strip ── */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {SYSTEM_STATUS.map((s, i) => (
              <SystemStatus
                key={s.label}
                label={s.label}
                value={s.value}
                pulse={i === 0}
              />
            ))}
          </div>

          {/* ── Hero code chip — non-interactive showpiece ── */}
          <div
            className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-7 relative overflow-hidden"
            style={{
              background:
                "radial-gradient(120% 100% at 10% 0%, var(--bg-surface) 0%, var(--bg-secondary) 60%)",
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                Canonical example · Lockstitch
              </div>
              <div className="hidden sm:block text-[10.5px] font-mono text-[var(--text-dim)]">
                XSL-Q10-5-E-560-M
              </div>
            </div>
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="flex items-end gap-1.5 min-w-max">
                <CodePrefix value="XSL" />
                <Dash />
                <CodeSegment value="Q10" index={1} />
                <CodeSegment value="5" index={2} />
                <CodeSegment value="" index={3} empty />
                <CodeSegment value="E" index={4} />
                <Dash />
                <CodeSegment value="560" index={5} />
                <Dash />
                <CodeSegment value="M" index={6} />
                <CodeSegment value="" index={7} empty />
                <CodeSegment value="" index={8} empty />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { k: "01", label: "Identity" },
                { k: "02", label: "Taxonomy" },
                { k: "03", label: "Breakdown" },
                { k: "04", label: "Intelligence" },
              ].map((c) => (
                <div
                  key={c.k}
                  className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-3 py-2.5"
                >
                  <div className="text-[10px] font-bold tracking-[0.18em] text-[var(--text-faint)]">
                    {c.k}
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                    {c.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════════════
            01 · IDENTITY ARCHITECTURE
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="01"
            eyebrow="Identity Architecture"
            title="Two identities. One product."
            sub="Every KOLEEX product carries a clean commercial identity for the outside world and a deep technical identity for the systems that run the business."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <IdentityCard
              kind="Commercial product identity"
              code="XSL-7903D"
              detail="Branding-oriented. Easy to remember. External-facing. The catalog, the website, the brochure, and the social post all use this short form."
              chips={[
                "Catalogs",
                "Marketing",
                "Product labels",
                "Product pages",
                "Social media",
                "Quotation header",
              ]}
            />
            <IdentityCard
              kind="Technical product identity"
              code="XSL-Q10-5-E-560-M-HJ-LT"
              detail="Engineering-oriented. Every segment carries machine-readable meaning. ERP filters, the AI assistant, spare-parts matching, and BOM compatibility all read this form."
              chips={[
                "ERP filters",
                "AI understanding",
                "Spare-parts match",
                "BOM compatibility",
                "Technical search",
                "Internal engineering",
              ]}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            02 · TAXONOMY
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="02"
            eyebrow="Main Category Codes"
            title="The garment-machinery taxonomy."
            sub="Eleven top-level codes. Every product code begins with one of these prefixes."
            trailing={
              <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                11 prefixes
              </span>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {MAIN_CATEGORIES.map((c) => (
              <CategoryTile key={c.code} code={c.code} label={c.label} domain="category" />
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            03 · INDUSTRIAL SEWING SUB-CATEGORIES
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="03"
            eyebrow="Industrial Sewing Machines"
            title="The XS-family."
            sub="Nine subcategories inside the XS prefix. Phase 1 ships full coding coverage for XSL, XSO, and XSI; the rest follow the same grammar."
            trailing={
              <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                3 of 9 documented
              </span>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {SEWING_CATEGORIES.map((c) => (
              <CategoryTile
                key={c.code}
                code={c.code}
                label={c.label}
                domain="sewing"
                documented={["XSL", "XSO", "XSI"].includes(c.code)}
              />
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            04 · INTERACTIVE VISUAL CODING BREAKDOWN
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="04"
            eyebrow="Visual Coding Breakdown"
            title="Decoding the technical identity."
            sub="Hover or click any numbered segment — the matching configuration table lights up and the others soft-fade. The diagrams below mirror the printed reference cards used on the factory floor."
          />
          <div className="space-y-6">
            <CodingBreakdown def={LOCKSTITCH} />
            <CodingBreakdown def={OVERLOCK} />
            <CodingBreakdown def={INTERLOCK} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            05 · LIVE CODE BUILDER
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="05"
            eyebrow="Live Code Builder"
            title="Compose a technical SKU."
            sub="Pick a value on each axis. The code assembles in real time and the silhouette highlights the part of the machine each axis controls."
          />
          <CodeBuilder />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            06 · ERP INTELLIGENCE PIPELINE
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="06"
            eyebrow="ERP Intelligence Layer"
            title="How the code becomes a system."
            sub="Each segment of the technical identity feeds a different layer of KOLEEX Hub. The pipeline reads top to bottom."
          />
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-7">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-start">
              {/* Pipeline */}
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

              {/* Segment → unlocks key/value */}
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
        </section>

        {/* ════════════════════════════════════════════════════════════════
            07 · AI PRODUCT LOGIC + parse visualization
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="07"
            eyebrow="AI Product Logic"
            title="A code the assistant can reason over."
            sub="Because every axis is structured and enumerable, the assistant treats a product code as a feature vector — not free text."
          />
          <div className="space-y-5">
            <AIParseFlow />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {AI_CAPABILITIES.map((c) => (
                <div
                  key={c.title}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-bold text-[var(--text-primary)]">
                    {c.glyph}
                  </div>
                  <div className="mt-3 text-[13.5px] font-semibold text-[var(--text-primary)]">
                    {c.title}
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--text-faint)] leading-snug">
                    {c.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            08 · FUTURE EXPANSION ECOSYSTEM
            ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            number="08"
            eyebrow="Future Expansion"
            title="The grammar generalizes."
            sub="Garment machinery is the first division. The same identity grammar — short commercial code, long technical code — extends to every other KOLEEX division."
          />
          <EcosystemMap />

          <div className="mt-10 text-center text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)]">
            KOLEEX Enterprise Product Intelligence Architecture · v2
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Local composite blocks ────────────────────────────────────────────── */

function IdentityCard({
  kind,
  code,
  detail,
  chips,
}: {
  kind: string;
  code: string;
  detail: string;
  chips: string[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
      />
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
        {kind}
      </div>
      <div className="mt-3 inline-flex items-center px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-[15px] font-bold tracking-wider">
        {code}
      </div>
      <p className="mt-4 text-[13px] text-[var(--text-faint)] leading-relaxed">
        {detail}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {chips.map((u) => (
          <div
            key={u}
            className="text-[11.5px] text-[var(--text-muted)] rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5"
          >
            {u}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryTile({
  code,
  label,
  domain,
  documented,
}: {
  code: string;
  label: string;
  domain: "category" | "sewing";
  documented?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 group hover:bg-[var(--bg-surface-subtle)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] group-hover:bg-[var(--bg-surface-hover)] transition-colors">
          <HubIcon domain={domain} k={code} size={13} />
        </div>
        {documented && (
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-emerald-600 dark:text-emerald-300">
            Live
          </span>
        )}
      </div>
      <div className="mt-3 font-mono text-[15px] font-bold tracking-wider text-[var(--text-primary)]">
        {code}
      </div>
      <div className="mt-1 text-[12px] text-[var(--text-faint)] leading-snug">
        {label}
      </div>
    </div>
  );
}
