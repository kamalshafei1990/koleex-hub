"use client";

/* ---------------------------------------------------------------------------
   /knowledge/product-coding-system  ·  v27

   Trilingual (en / zh / ar) with RTL support for Arabic. The whole tree
   reads from the i18n module — UI strings via useT(), data labels via
   useTL(). A small language selector lives in the breadcrumb bar.
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
import CompareCodes from "@/components/knowledge/product-coding/CompareCodes";
import SearchByCode from "@/components/knowledge/product-coding/SearchByCode";
import StickyNav from "@/components/knowledge/product-coding/StickyNav";
import EcosystemPreview from "@/components/knowledge/product-coding/EcosystemPreview";
import { taxonomyLogoUrl } from "@/components/knowledge/product-coding/taxonomy-logo";
import {
  LangProvider,
  useLang,
  useT,
  useTL,
} from "@/components/knowledge/product-coding/i18n";
import {
  CATEGORIES,
  DIVISIONS,
  LOCKSTITCH,
  OVERLOCK,
  INTERLOCK,
  PIPELINE,
  AI_CAPABILITIES,
} from "@/components/knowledge/product-coding/data";

/* Hoisted aggregate counts. */
const TOTAL_SUBS = CATEGORIES.reduce((n, c) => n + c.subcategories.length, 0);
const DECODED_SUBS = 3; // XSL · XSO · XSI

/* Category icon — pulls media/categories/<slug>.svg from Storage. */
function CategoryIcon({ slug, label }: { slug: string; label: string }) {
  const url = taxonomyLogoUrl("categories", slug);
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={label} width={28} height={28} style={{ width: 28, height: 28 }} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-dim)]" aria-hidden />
      )}
    </div>
  );
}

export default function ProductCodingSystemPage() {
  return (
    <LangProvider>
      <PageInner />
    </LangProvider>
  );
}

function PageInner() {
  const t = useT();
  const tl = useTL();
  const { dir } = useLang();

  return (
    <div
      dir={dir}
      className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]"
    >
      {/* ── Print stylesheet — hide page chrome, keep document content ── */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          html, body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
          section { break-inside: avoid; }
        }
      `}</style>
      {/* v30: persistent section navigator */}
      <StickyNav />

      {/* ── Breadcrumb bar ─────────────────────────────────────────── */}
      <div className="border-b border-[var(--border-faint)] no-print">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <Link
            href="/knowledge"
            aria-label={t("nav.back")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
          >
            <ArrowLeftIcon className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-faint)]">
            <Link href="/knowledge" className="hover:text-[var(--text-primary)]">
              {t("nav.knowledge")}
            </Link>
            <span className="text-[var(--text-dim)]">/</span>
            <span className="text-[var(--text-primary)] font-medium">
              {t("doc.title_short")}
            </span>
          </div>
        </div>
      </div>

      {/* ── Document body ──────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="space-y-20 md:space-y-28 min-w-0">

          {/* ═══ 01 · HERO + DIVISIONS ═══════════════════════════════ */}
          <section id="divisions" className="scroll-mt-20">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[var(--text-faint)] mb-6">
              {t("01.eyebrow")}
            </div>

            <h1 className="text-[40px] sm:text-[48px] md:text-[56px] font-bold tracking-[-0.015em] leading-[1.04] text-[var(--text-primary)] max-w-4xl">
              {t("01.title")}
            </h1>
            <p className="mt-6 text-[15px] md:text-[16px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
              {t("01.lead")}
            </p>

            {/* Meta strip */}
            <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 max-w-3xl text-[12px] border-t border-[var(--border-faint)] pt-5">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {t("01.meta.document")}
                </dt>
                <dd className="mt-1 text-[var(--text-primary)] font-medium">
                  {t("01.meta.document_value")}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {t("01.meta.division")}
                </dt>
                <dd className="mt-1 text-[var(--text-primary)] font-medium">
                  {tl("Garment Machinery")}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {t("01.meta.categories")}
                </dt>
                <dd className="mt-1 text-[var(--text-primary)] font-medium font-mono" dir="ltr">
                  11
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {t("01.meta.subcategories")}
                </dt>
                <dd className="mt-1 text-[var(--text-primary)] font-medium font-mono" dir="ltr">
                  {TOTAL_SUBS}
                </dd>
              </div>
            </dl>

            {/* The 9 divisions */}
            <div className="mt-12">
              <DivisionStrip divisions={DIVISIONS} currentId="garment-machinery" />
            </div>

            {/* v30: Unified Product Intelligence Architecture preview */}
            <EcosystemPreview />
          </section>

          {/* ═══ 02 · CATEGORIES ═══════════════════════════════════════ */}
          <section id="categories" className="scroll-mt-20">
            <SectionHeader
              number={t("02.number")}
              eyebrow={t("02.eyebrow")}
              title={t("02.title")}
              sub={t("02.sub")}
              trailing={
                <span className="text-[10.5px] font-mono text-[var(--text-faint)]" dir="ltr">
                  {t("02.count", { n: 11, m: TOTAL_SUBS })}
                </span>
              }
            />
            <div className="mb-5 no-print max-w-md">
              <SearchByCode />
            </div>
            <CategoryGrid categories={CATEGORIES} />

            {/* ── Subcategory index ── */}
            <div className="mt-12">
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                    {t("02.index.eyebrow")}
                  </div>
                  <h3 className="mt-1 text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
                    {t("02.index.title")}
                  </h3>
                </div>
                <span className="text-[10.5px] font-mono text-[var(--text-faint)]" dir="ltr">
                  {t("02.index.meta", { n: TOTAL_SUBS })}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <div
                    key={c.code}
                    data-cat-anchor={c.code}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 transition-shadow scroll-mt-24"
                  >
                    {/* Category header — icon + code + label + count */}
                    <div className="flex items-center gap-3 pb-3 mb-3 border-b border-[var(--border-faint)]">
                      <CategoryIcon slug={c.slug} label={tl(c.label)} />
                      <div
                        className="font-mono text-[20px] font-bold tracking-[0.04em] text-[var(--text-primary)] shrink-0"
                        dir="ltr"
                      >
                        {c.code}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-[var(--text-primary)] truncate">
                          {tl(c.label)}
                        </div>
                        <div className="text-[10.5px] font-mono text-[var(--text-faint)] mt-0.5">
                          <span dir="ltr">{c.subcategories.length}</span>{" "}
                          {c.subcategories.length === 1
                            ? t("cat.subs_singular")
                            : t("cat.subs_plural")}
                        </div>
                      </div>
                    </div>

                    <ul className="divide-y divide-[var(--border-faint)]">
                      {c.subcategories.map((s) => (
                        <li
                          key={s.code}
                          className="grid grid-cols-[1fr_auto] gap-3 items-center py-2"
                        >
                          <span className="text-[13px] text-[var(--text-primary)] truncate">
                            {tl(s.label)}
                          </span>
                          <span
                            className="font-mono text-[13px] font-bold tracking-[0.06em] text-[var(--text-primary)]"
                            dir="ltr"
                          >
                            {s.code}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ 03 · TECHNICAL SPECIFICATIONS ═══════════════════════ */}
          <section id="technical-breakdown" className="scroll-mt-20">
            <SectionHeader
              number={t("03.number")}
              eyebrow={t("03.eyebrow")}
              title={t("03.title")}
              sub={t("03.sub")}
              trailing={
                <span className="text-[10.5px] font-mono text-[var(--text-faint)]" dir="ltr">
                  {t("03.coverage", {
                    decoded: DECODED_SUBS,
                    total: TOTAL_SUBS,
                    pct: Math.round((DECODED_SUBS / TOTAL_SUBS) * 100),
                  })}
                </span>
              }
            />

            {/* XS subcategory strip */}
            <div className="mb-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                    {t("03.xs_strip.eyebrow")}
                  </div>
                  <div className="mt-1 text-[13px] text-[var(--text-faint)]">
                    {t("03.xs_strip.sub")}
                  </div>
                </div>
                <div className="text-[10.5px] font-mono text-[var(--text-faint)]" dir="ltr">
                  {t("03.xs_strip.meta", {
                    n:
                      (CATEGORIES.find((c) => c.code === "XS")?.subcategories ?? []).length,
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(CATEGORIES.find((c) => c.code === "XS")?.subcategories ?? []).map((s) => {
                  const targetId =
                    s.code === "XSL"
                      ? "#lockstitch"
                      : s.code === "XSO"
                        ? "#overlock"
                        : s.code === "XSI"
                          ? "#interlock"
                          : null;
                  const isDecoded = !!targetId;
                  const cls = `h-8 px-3 rounded-md border text-[11.5px] font-mono flex items-center gap-2 transition-colors ${
                    isDecoded
                      ? "border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                      : "border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"
                  }`;
                  return isDecoded ? (
                    <a key={s.code} href={targetId!} className={cls}>
                      <span className="font-bold" dir="ltr">{s.code}</span>
                      <span className="opacity-75 font-sans font-medium">{tl(s.label)}</span>
                    </a>
                  ) : (
                    <div key={s.code} className={cls}>
                      <span className="font-bold" dir="ltr">{s.code}</span>
                      <span className="opacity-75 font-sans font-medium">{tl(s.label)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-10">
              <BreakdownCard def={LOCKSTITCH} />
              <BreakdownCard def={OVERLOCK} />
              <BreakdownCard def={INTERLOCK} />
            </div>
          </section>

          {/* ═══ 03b · COMPARE TWO CODES ═══════════════════════════════ */}
          <section id="compare" className="scroll-mt-20 no-print">
            <SectionHeader
              number="03b"
              eyebrow={t("compare.eyebrow")}
              title={t("compare.title")}
              sub={t("compare.sub")}
            />
            <CompareCodes />
          </section>

          {/* ═══ 04 · SKU BUILDER ════════════════════════════════════ */}
          <section id="builder" className="scroll-mt-20">
            <SectionHeader
              number={t("04.number")}
              eyebrow={t("04.eyebrow")}
              title={t("04.title")}
              sub={t("04.sub")}
            />
            <CodeBuilder />
          </section>

          {/* ═══ 05 · INTELLIGENCE LAYER ═════════════════════════════ */}
          <section id="intelligence" className="scroll-mt-20">
            <SectionHeader
              number={t("05.number")}
              eyebrow={t("05.eyebrow")}
              title={t("05.title")}
              sub={t("05.sub")}
            />

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-5">
                    {t("05.erp_pipeline")}
                  </div>
                  <ol className="relative space-y-0">
                    {PIPELINE.map((p, i) => (
                      <li key={p.label} className="relative ps-10">
                        {i < PIPELINE.length - 1 && (
                          <span
                            aria-hidden
                            className="absolute start-[14px] top-7 bottom-[-12px] w-px bg-[var(--border-subtle)]"
                          />
                        )}
                        <div
                          className="absolute start-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--text-primary)] bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--text-primary)] font-mono"
                          dir="ltr"
                        >
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="pb-5">
                          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                            {tl(p.label)}
                          </div>
                          <div className="text-[12px] text-[var(--text-faint)] mt-0.5 leading-snug">
                            {tl(p.detail)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                    {t("05.segment_unlocks")}
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {(
                      [
                        ["unlock.model_code", "unlock.model_code.v"],
                        ["unlock.function", "unlock.function.v"],
                        ["unlock.motor_table", "unlock.motor_table.v"],
                        ["unlock.op_length", "unlock.op_length.v"],
                        ["unlock.fabric", "unlock.fabric.v"],
                        ["unlock.hook_stitch", "unlock.hook_stitch.v"],
                        ["unlock.special", "unlock.special.v"],
                      ] as const
                    ).map(([k, v]) => (
                      <li
                        key={k}
                        className="grid grid-cols-[120px_1fr] gap-3 text-[12px]"
                      >
                        <span className="text-[var(--text-muted)]">{t(k)}</span>
                        <span className="text-[var(--text-primary)] font-medium">
                          {t(v)}
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

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {AI_CAPABILITIES.map((c) => (
                <div
                  key={c.title}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--text-primary)] bg-[var(--bg-surface)] text-[12px] font-bold text-[var(--text-primary)] font-mono"
                    dir="ltr"
                  >
                    {c.glyph}
                  </div>
                  <div className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">
                    {tl(c.title)}
                  </div>
                  <div className="mt-1 text-[11.5px] text-[var(--text-faint)] leading-snug">
                    {tl(c.detail)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ Document signature ════════════════════════════════════ */}
          <div className="border-t border-[var(--border-faint)] pt-6 flex flex-wrap items-center justify-between gap-3 text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)]">
            <span>{t("footer.architecture")}</span>
            <span className="font-mono" dir="ltr">v30 · {tl("Garment Machinery")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
