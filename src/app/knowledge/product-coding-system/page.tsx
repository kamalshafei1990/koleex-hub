"use client";

/* ---------------------------------------------------------------------------
   /knowledge/product-coding-system

   Master reference for the KOLEEX Product Coding System. Visual-first
   technical documentation styled to match the KOLEEX Hub design system
   (same tokens, same spacing, same monochrome restraint). The numbered
   coding diagrams are deliberately modeled on the printed reference
   sheets (XSL Lockstitch, XSO Overlock, XSI Interlock).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import FileCode2Icon from "@/components/icons/ui/FileCode2Icon";

/* ── Visual primitives ─────────────────────────────────────────────────── */

/** A boxed code segment shown above its numbered marker.
 *  Mirrors the printed reference sheets: each part of the SKU lives in
 *  its own rectangle with a number-circle directly below. */
function CodeSegment({
  value,
  index,
  empty,
}: {
  value: string;
  /** 1-based segment number, or null for the prefix/separator. */
  index: number | null;
  /** Show a dashed empty placeholder rather than a value. */
  empty?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div
        className={`flex items-center justify-center min-w-[60px] h-12 px-3 rounded-lg border text-[15px] font-bold tracking-wider ${
          empty
            ? "border-dashed border-[var(--border-subtle)] text-[var(--text-dim)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
        }`}
      >
        {empty ? "□" : value}
      </div>
      {index !== null ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none">
          {index}
        </div>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
}

/** A bracket showing the prefix (XSL/XSO/XSI) without a number circle. */
function CodePrefix({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center min-w-[60px] h-12 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[15px] font-bold tracking-wider text-[var(--text-primary)]">
        {value}
      </div>
      <div className="h-5" />
    </div>
  );
}

/** Visual dash separator. */
function Dash() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center h-12 px-1 text-[var(--text-dim)] text-[15px] font-bold">
        —
      </div>
      <div className="h-5" />
    </div>
  );
}

/** Column header strip below the code diagram. Each cell describes a
 *  segment. Lays out the Chinese-first/English-second style of the
 *  reference cards but in the Hub's typographic system. */
function ColumnHeaderRow({
  cells,
}: {
  cells: Array<{ label: string; sub?: string }>;
}) {
  return (
    <div className="grid gap-px mt-3" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((c, i) => (
        <div
          key={i}
          className="px-2 py-2 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] text-center"
        >
          <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-tight">
            {c.label}
          </div>
          {c.sub && (
            <div className="text-[9.5px] text-[var(--text-faint)] mt-0.5 leading-tight">
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** A configuration value table — pairs of (code, meaning).
 *  Mirrors the printed reference card's stacked rows. */
function ConfigTable({
  segmentNumber,
  title,
  rows,
}: {
  segmentNumber: number;
  title: string;
  rows: Array<{ code: string; meaning: string }>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header band — matches the reference cards' dark title strip. */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-faint)]">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none">
          {segmentNumber}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)]">
          {title}
        </div>
      </div>
      <div className="divide-y divide-[var(--border-faint)]">
        {rows.map((r) => (
          <div
            key={r.code}
            className="grid grid-cols-[64px_1fr] gap-3 px-3.5 py-2"
          >
            <div className="text-[12px] font-bold text-[var(--text-primary)] font-mono tracking-wider">
              {r.code}
            </div>
            <div className="text-[12px] text-[var(--text-faint)] leading-snug">
              {r.meaning}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Section heading with eyebrow + number. */
function SectionHeader({
  number,
  eyebrow,
  title,
  sub,
}: {
  number: string;
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3 text-[10px] font-bold tracking-[0.22em] text-[var(--text-faint)]">
        <span className="text-[var(--text-dim)]">{number}</span>
        <span>{eyebrow}</span>
      </div>
      <h2 className="mt-1 text-[20px] sm:text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      {sub && (
        <p className="mt-1.5 text-[12.5px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function ProductCodingSystemPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Top bar with breadcrumb back to Knowledge ── */}
      <div className="border-b border-[var(--border-faint)]">
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

      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 space-y-16 md:space-y-20">

        {/* ── 1. HERO ─────────────────────────────────────────────── */}
        <header>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]">
              <FileCode2Icon size={16} />
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Enterprise Product Architecture · Garment Machinery Division
            </div>
          </div>
          <h1 className="text-[34px] sm:text-[44px] md:text-[54px] font-semibold tracking-tight leading-[1.03] text-[var(--text-primary)] max-w-4xl">
            KOLEEX Product Coding System.
          </h1>
          <p className="mt-4 text-[15px] md:text-[16px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
            The official master reference for every KOLEEX garment-machinery
            product code. A single, structured grammar that the catalog, the
            ERP, the spare-parts engine, and the AI assistant all read from.
          </p>

          {/* Hero code chip — the canonical Lockstitch example */}
          <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-7">
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

            {/* Hero quick-tour: 4 mini cards previewing the article */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { kicker: "01", label: "Identity" },
                { kicker: "02", label: "Categories" },
                { kicker: "03", label: "Breakdown" },
                { kicker: "04", label: "Intelligence" },
              ].map((c) => (
                <div
                  key={c.kicker}
                  className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-3 py-2.5"
                >
                  <div className="text-[10px] font-bold tracking-[0.18em] text-[var(--text-faint)]">
                    {c.kicker}
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--text-primary)]">
                    {c.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── 2. PRODUCT IDENTITY ARCHITECTURE ───────────────────── */}
        <section>
          <SectionHeader
            number="01"
            eyebrow="Identity Architecture"
            title="Two identities. One product."
            sub="Every KOLEEX product carries a clean commercial identity for the outside world and a deep technical identity for the systems that run the business."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* Commercial */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                Commercial product identity
              </div>
              <div className="mt-3 inline-flex items-center px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-[15px] font-bold tracking-wider">
                XSL-7903D
              </div>
              <p className="mt-4 text-[13px] text-[var(--text-faint)] leading-relaxed">
                Branding-oriented. Easy to remember. External-facing. The
                catalog, the website, the brochure, and the social post all
                use this short form.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  "Catalogs",
                  "Marketing",
                  "Product labels",
                  "Product pages",
                  "Social media",
                  "Quotation header",
                ].map((u) => (
                  <div
                    key={u}
                    className="text-[11.5px] text-[var(--text-muted)] rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5"
                  >
                    {u}
                  </div>
                ))}
              </div>
            </div>

            {/* Technical */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                Technical product identity
              </div>
              <div className="mt-3 inline-flex items-center px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-[15px] font-bold tracking-wider">
                XSL-Q10-5-E-560-M-HJ-LT
              </div>
              <p className="mt-4 text-[13px] text-[var(--text-faint)] leading-relaxed">
                Engineering-oriented. Every segment carries machine-readable
                meaning. ERP filters, the AI assistant, spare-parts matching,
                and BOM compatibility all read this form.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  "ERP filters",
                  "AI understanding",
                  "Spare-parts match",
                  "BOM compatibility",
                  "Technical search",
                  "Internal engineering",
                ].map((u) => (
                  <div
                    key={u}
                    className="text-[11.5px] text-[var(--text-muted)] rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5"
                  >
                    {u}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. MAIN CATEGORY CODES ─────────────────────────────── */}
        <section>
          <SectionHeader
            number="02"
            eyebrow="Main Category Codes"
            title="The garment-machinery taxonomy."
            sub="Eleven top-level category codes. Every product code begins with one of these prefixes."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {MAIN_CATEGORIES.map((c) => (
              <div
                key={c.code}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
              >
                <div className="font-mono text-[15px] font-bold tracking-wider text-[var(--text-primary)]">
                  {c.code}
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-faint)] leading-snug">
                  {c.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. INDUSTRIAL SEWING SUB-CATEGORIES ────────────────── */}
        <section>
          <SectionHeader
            number="03"
            eyebrow="Industrial Sewing Machines"
            title="The XS-family."
            sub="Inside the XS prefix, nine subcategories describe the machine class. Phase 1 of the template engine ships with full coverage for XSL, XSO, and XSI."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {SEWING_CATEGORIES.map((c) => (
              <div
                key={c.code}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
              >
                <div className="font-mono text-[15px] font-bold tracking-wider text-[var(--text-primary)]">
                  {c.code}
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-faint)] leading-snug">
                  {c.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. VISUAL CODING BREAKDOWN ─────────────────────────── */}
        <section>
          <SectionHeader
            number="04"
            eyebrow="Visual Coding Breakdown"
            title="Decoding the technical identity."
            sub="Each segment of the technical code is a discrete configuration axis. The diagrams below mirror the printed reference cards used on the factory floor — same numbered structure, same axis ordering, brought into the Hub."
          />

          {/* ── 5a. LOCKSTITCH ── */}
          <CodingBreakdown
            title="Lockstitch · XSL"
            subtitle="Eight configuration axes. Empty boxes mean the segment is optional and may be omitted from a real SKU."
            example="XSL-Q10-5 □ E-560-M □ □"
            segments={[
              { value: "Q10", index: 1, header: "Model code", sub: "型号代码" },
              { value: "5", index: 2, header: "Function", sub: "功能" },
              { value: "", index: 3, empty: true, header: "Seam table", sub: "缝台类型" },
              { value: "E", index: 4, header: "Motor type", sub: "电机类型" },
              { value: "560", index: 5, header: "Operation length", sub: "操作空间长度", sep: "before" },
              { value: "M", index: 6, header: "Fabrics", sub: "适用布料", sep: "before" },
              { value: "", index: 7, empty: true, header: "Hook type", sub: "旋梭类型" },
              { value: "", index: 8, empty: true, header: "Special", sub: "特殊配置" },
            ]}
            prefix="XSL"
            tables={LOCKSTITCH_TABLES}
          />

          {/* ── 5b. OVERLOCK ── */}
          <div className="mt-12">
            <CodingBreakdown
              title="Overlock · XSO"
              subtitle="Six configuration axes. Thread count and pneumatic features are the high-signal axes for buyers."
              example="XSO-981-1-E-S-4-Q"
              segments={[
                { value: "981", index: 1, header: "Model code", sub: "型号代码" },
                { value: "1", index: 2, header: "Seam table", sub: "缝台类型" },
                { value: "E", index: 3, header: "Motor type", sub: "电机类型" },
                { value: "S", index: 4, header: "Function", sub: "功能", sep: "before" },
                { value: "4", index: 5, header: "Threads", sub: "线数", sep: "before" },
                { value: "Q", index: 6, header: "Special", sub: "特殊配置" },
              ]}
              prefix="XSO"
              tables={OVERLOCK_TABLES}
            />
          </div>

          {/* ── 5c. INTERLOCK ── */}
          <div className="mt-12">
            <CodingBreakdown
              title="Interlock · XSI"
              subtitle="Five configuration axes. The stitch-type catalog is the widest of any subcategory in the system."
              example="XSI-150-D-01-V"
              segments={[
                { value: "150", index: 1, header: "Model code", sub: "型号代码" },
                { value: "D", index: 2, header: "Function", sub: "功能" },
                { value: "01", index: 3, header: "Stitch type", sub: "线迹类型", sep: "before" },
                { value: "V", index: 4, header: "Special", sub: "特殊配置" },
                { value: "", index: 5, empty: true, header: "Needle position", sub: "针位组", sep: "before" },
              ]}
              prefix="XSI"
              tables={INTERLOCK_TABLES}
            />
          </div>
        </section>

        {/* ── 6. ERP INTELLIGENCE LAYER ──────────────────────────── */}
        <section>
          <SectionHeader
            number="05"
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

              {/* Right column: data flow */}
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

        {/* ── 7. AI PRODUCT LOGIC ────────────────────────────────── */}
        <section>
          <SectionHeader
            number="06"
            eyebrow="AI Product Logic"
            title="A code the assistant can reason over."
            sub="Because every axis is structured and enumerable, the assistant treats a product code as a feature vector — not free text."
          />
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
        </section>

        {/* ── 8. FUTURE EXPANSION ─────────────────────────────────── */}
        <section>
          <SectionHeader
            number="07"
            eyebrow="Future Expansion"
            title="Beyond garment machinery."
            sub="The grammar generalizes. Each future division uses the same identity rules — short commercial code, long technical code — with its own segment ordering."
          />
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-7">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {FUTURE_DIVISIONS.map((d) => (
                <div
                  key={d.prefix}
                  className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[14px] font-bold tracking-wider text-[var(--text-primary)]">
                      {d.prefix}
                    </div>
                    <div
                      className={`text-[9.5px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${
                        d.status === "live"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                          : "border-[var(--border-subtle)] text-[var(--text-faint)]"
                      }`}
                    >
                      {d.status === "live" ? "Live" : "Planned"}
                    </div>
                  </div>
                  <div className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">
                    {d.name}
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--text-faint)] leading-snug">
                    {d.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer credit line */}
          <div className="mt-10 text-center text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)]">
            KOLEEX Enterprise Product Intelligence Architecture · v1
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Reusable: one full coding breakdown (top diagram + tables grid) ──── */

function CodingBreakdown({
  title,
  subtitle,
  example,
  prefix,
  segments,
  tables,
}: {
  title: string;
  subtitle: string;
  example: string;
  prefix: string;
  segments: Array<{
    value: string;
    index: number;
    empty?: boolean;
    header: string;
    sub?: string;
    /** insert a dash separator BEFORE this segment */
    sep?: "before";
  }>;
  tables: Array<{
    segmentNumber: number;
    title: string;
    rows: Array<{ code: string; meaning: string }>;
  }>;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-7">
      {/* Header strip */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="mt-1 text-[12.5px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        </div>
        <div className="font-mono text-[11.5px] text-[var(--text-dim)]">
          {example}
        </div>
      </div>

      {/* The numbered code diagram */}
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="flex items-end gap-1.5 min-w-max">
          <CodePrefix value={prefix} />
          <Dash />
          {segments.map((s, i) => (
            <span key={i} className="flex items-end gap-1.5">
              {s.sep === "before" && <Dash />}
              <CodeSegment
                value={s.value}
                index={s.index}
                empty={s.empty}
              />
            </span>
          ))}
        </div>
      </div>

      {/* Column header strip describing each numbered segment */}
      <ColumnHeaderRow
        cells={segments.map((s) => ({ label: s.header, sub: s.sub }))}
      />

      {/* Configuration tables grid */}
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tables.map((t) => (
          <ConfigTable
            key={t.title}
            segmentNumber={t.segmentNumber}
            title={t.title}
            rows={t.rows}
          />
        ))}
      </div>
    </article>
  );
}

/* ── Data ──────────────────────────────────────────────────────────────── */

const MAIN_CATEGORIES: Array<{ code: string; label: string }> = [
  { code: "XPR", label: "Fabric Preparation" },
  { code: "XC", label: "Cutting Equipment" },
  { code: "XS", label: "Industrial Sewing Machines" },
  { code: "XA", label: "Automatic Sewing Systems" },
  { code: "XSE", label: "Leather & Footwear Machinery" },
  { code: "XE", label: "Embroidery Equipment" },
  { code: "XP", label: "Printing & Heat Press" },
  { code: "XF", label: "Finishing Equipment" },
  { code: "XPC", label: "Packing & Inspection" },
  { code: "XD", label: "Domestic Sewing Machines" },
  { code: "XSP", label: "Spare Parts & Accessories" },
];

const SEWING_CATEGORIES: Array<{ code: string; label: string }> = [
  { code: "XSL", label: "Lockstitch" },
  { code: "XSO", label: "Overlock" },
  { code: "XSI", label: "Interlock" },
  { code: "XSC", label: "Chainstitch" },
  { code: "XSD", label: "Double-needle" },
  { code: "XSM", label: "Multi-needle" },
  { code: "XPA", label: "Pattern sewing" },
  { code: "XSH", label: "Heavy duty" },
  { code: "XSS", label: "Special machines" },
];

const LOCKSTITCH_TABLES: Array<{
  segmentNumber: number;
  title: string;
  rows: Array<{ code: string; meaning: string }>;
}> = [
  {
    segmentNumber: 1,
    title: "Model code",
    rows: [
      { code: "QXX", meaning: "New model single needle lockstitch" },
      { code: "AXX", meaning: "Variant series A" },
      { code: "BXX", meaning: "Variant series B" },
    ],
  },
  {
    segmentNumber: 2,
    title: "Function",
    rows: [
      { code: "0", meaning: "Direct-drive" },
      { code: "1", meaning: "Only trimmer" },
      { code: "3", meaning: "3 automatic functions" },
      { code: "4", meaning: "4 automatic functions" },
      { code: "5", meaning: "Single stepper" },
      { code: "6", meaning: "Double stepper" },
      { code: "7", meaning: "Triple stepper" },
    ],
  },
  {
    segmentNumber: 3,
    title: "Seam table type",
    rows: [
      { code: "/", meaning: "Flat-bed" },
      { code: "1", meaning: "Cylinder-bed" },
    ],
  },
  {
    segmentNumber: 4,
    title: "Motor type",
    rows: [
      { code: "/", meaning: "Simple motor" },
      { code: "E", meaning: "Servo motor" },
    ],
  },
  {
    segmentNumber: 5,
    title: "Operation length",
    rows: [
      { code: "/", meaning: "270 mm" },
      { code: "360", meaning: "360 mm" },
      { code: "560", meaning: "560 mm" },
    ],
  },
  {
    segmentNumber: 6,
    title: "Applicable fabrics",
    rows: [
      { code: "S", meaning: "Thin material" },
      { code: "M", meaning: "Medium material" },
      { code: "H", meaning: "Heavy material" },
    ],
  },
  {
    segmentNumber: 7,
    title: "Hook type",
    rows: [
      { code: "/", meaning: "Domestic hook" },
      { code: "HJ", meaning: "DLC hook" },
      { code: "R", meaning: "Japanese hook" },
      { code: "G", meaning: "Huge hook" },
    ],
  },
  {
    segmentNumber: 8,
    title: "Special functions",
    rows: [
      { code: "Cd", meaning: "Differential" },
      { code: "Zs", meaning: "Needle feeding" },
      { code: "P", meaning: "Puller" },
      { code: "Lt", meaning: "Folder" },
      { code: "Sd", meaning: "Double-knife" },
      { code: "Mf", meaning: "Sealed oil pan" },
    ],
  },
];

const OVERLOCK_TABLES: Array<{
  segmentNumber: number;
  title: string;
  rows: Array<{ code: string; meaning: string }>;
}> = [
  {
    segmentNumber: 1,
    title: "Model code",
    rows: [
      { code: "98X", meaning: "Direct-drive" },
      { code: "85X", meaning: "Mix type / M700" },
      { code: "7XX", meaning: "747F type" },
    ],
  },
  {
    segmentNumber: 2,
    title: "Seam table type",
    rows: [
      { code: "/", meaning: "Flat-bed" },
      { code: "1", meaning: "Cylinder-bed" },
    ],
  },
  {
    segmentNumber: 3,
    title: "Motor type",
    rows: [
      { code: "/", meaning: "Simple motor" },
      { code: "E", meaning: "Servo motor" },
    ],
  },
  {
    segmentNumber: 4,
    title: "Function",
    rows: [
      { code: "D", meaning: "Direct-drive" },
      { code: "A", meaning: "Normal automatic" },
      { code: "S", meaning: "Stepping automatic" },
      { code: "T", meaning: "Top and bottom feed" },
    ],
  },
  {
    segmentNumber: 5,
    title: "Thread quantity",
    rows: [
      { code: "2", meaning: "2-thread" },
      { code: "3", meaning: "3-thread" },
      { code: "4", meaning: "4-thread" },
      { code: "5", meaning: "5-thread" },
      { code: "6", meaning: "6-thread" },
    ],
  },
  {
    segmentNumber: 6,
    title: "Special functions",
    rows: [
      { code: "Q", meaning: "Pneumatic type" },
      { code: "Bk", meaning: "Reverse seaming" },
      { code: "Dz", meaning: "Pleating" },
      { code: "Lt", meaning: "Folder" },
      { code: "Hb", meaning: "Lacework" },
      { code: "Cx", meaning: "Side suction trimmer" },
      { code: "Kd", meaning: "Pocket / double-chain cloth bound" },
      { code: "Mk", meaning: "Narrow bound" },
    ],
  },
];

const INTERLOCK_TABLES: Array<{
  segmentNumber: number;
  title: string;
  rows: Array<{ code: string; meaning: string }>;
}> = [
  {
    segmentNumber: 1,
    title: "Model code",
    rows: [
      { code: "X50 / W500", meaning: "Flat-bed" },
      { code: "X60 / W600", meaning: "Cylinder-bed" },
    ],
  },
  {
    segmentNumber: 2,
    title: "Function",
    rows: [
      { code: "D", meaning: "Direct-drive" },
      { code: "A", meaning: "Normal automatic" },
      { code: "S", meaning: "Stepping automatic" },
    ],
  },
  {
    segmentNumber: 3,
    title: "Stitch type",
    rows: [
      { code: "01", meaning: "Basic type" },
      { code: "02", meaning: "Sewing rolled-edge type" },
      { code: "03", meaning: "Cover seam type" },
      { code: "04", meaning: "4-needle 6-thread type" },
      { code: "05", meaning: "Elastic lace cord type" },
      { code: "06", meaning: "Double chain-stitch in 2-looper" },
      { code: "07", meaning: "Trouser seam type" },
      { code: "08", meaning: "Bottom folding seam type" },
      { code: "31", meaning: "All-in-one (01 + 02 + 03)" },
    ],
  },
  {
    segmentNumber: 4,
    title: "Special functions",
    rows: [
      { code: "V", meaning: "Upper trimmer" },
      { code: "W", meaning: "Wiper" },
      { code: "Q", meaning: "Pneumatic type" },
      { code: "35Zd", meaning: "Left cutter" },
      { code: "33Ac", meaning: "Right cutter" },
      { code: "P", meaning: "Puller" },
      { code: "Lt", meaning: "Folder" },
      { code: "Hb", meaning: "Lacework" },
      { code: "Tk", meaning: "Rolled-edge trimmer" },
    ],
  },
  {
    segmentNumber: 5,
    title: "Needle position",
    rows: [{ code: "—", meaning: "Defined per model line; see spec sheet." }],
  },
];

const PIPELINE: Array<{ label: string; detail: string }> = [
  {
    label: "Commercial identity",
    detail:
      "The short code on the label, the brochure, and the quotation header.",
  },
  {
    label: "Technical identity",
    detail:
      "The long code parsed segment-by-segment into a feature vector.",
  },
  {
    label: "ERP intelligence",
    detail:
      "Inventory, pricing, BOM, and packaging derive directly from the segments.",
  },
  {
    label: "AI understanding",
    detail:
      "The assistant reasons over the vector for recommendations and Q&A.",
  },
  {
    label: "Spare-parts matching",
    detail:
      "Hook type + needle system + bed type resolve to the correct parts BOM.",
  },
  {
    label: "Technical compatibility",
    detail:
      "Side-by-side comparison and quotation upsells use the same axes.",
  },
];

const AI_CAPABILITIES: Array<{ glyph: string; title: string; detail: string }> = [
  {
    glyph: "→",
    title: "Recommendation",
    detail: "Match fabric weight + production level + automation tier to a SKU.",
  },
  {
    glyph: "⌘",
    title: "Spare-parts matching",
    detail: "Resolve a service request to the exact parts BOM via hook + bed.",
  },
  {
    glyph: "≡",
    title: "Technical filtering",
    detail: "Catalog filter by any axis: motor type, thread count, hook, etc.",
  },
  {
    glyph: "↔",
    title: "Product comparison",
    detail: "Side-by-side diff because every product speaks the same grammar.",
  },
  {
    glyph: "$",
    title: "Smart quotation",
    detail: "Special-function codes drive automatic line-item surcharges.",
  },
  {
    glyph: "✓",
    title: "Machine compatibility",
    detail: "Same bed + same hook ⇒ shared accessories without manual lookup.",
  },
];

const FUTURE_DIVISIONS: Array<{
  prefix: string;
  name: string;
  description: string;
  status: "live" | "planned";
}> = [
  {
    prefix: "X•",
    name: "Garment Machinery",
    description: "11 categories, 9 sewing subcategories, full coding live.",
    status: "live",
  },
  {
    prefix: "S•",
    name: "Smart Devices",
    description: "Wearables, sensors, IoT controllers — same identity grammar.",
    status: "planned",
  },
  {
    prefix: "H•",
    name: "Smart Home",
    description: "Lighting, climate, surveillance product lines.",
    status: "planned",
  },
  {
    prefix: "A•",
    name: "Industrial Automation",
    description: "Conveyors, robotic arms, vision systems.",
    status: "planned",
  },
  {
    prefix: "V•",
    name: "Vehicles",
    description: "EV scooter / e-bike SKUs with battery + motor axes.",
    status: "planned",
  },
  {
    prefix: "T•",
    name: "Technology Products",
    description: "Compute, displays, peripherals — cross-division compatibility.",
    status: "planned",
  },
];
