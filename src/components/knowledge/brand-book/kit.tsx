"use client";

/* ---------------------------------------------------------------------------
   The brand book's page kit — every chapter is built from these parts, so
   every page reads the same way:

       rule  →  why  →  specs  →  ✓ / ✗ examples  →  download

   Two kinds of surface, deliberately different:
     · the READER (headings, text, cards) uses the Hub tokens, so it follows
       the skin (Aurora glass or Core flat) and the light/dark theme;
     · a STAGE is an artboard. It paints the brand's own colours (#FFFFFF,
       #000000…) whatever the theme, because an example of the logo on white
       has to be white in a dark room too.

   The chapter BODY is English (owner, 27/09/2026) and is marked dir="ltr"
   lang="en" so an Arabic reader's RTL page does not right-align English
   sentences. The reader's own words (labels, menus) follow the language.

   THE LOOK (owner, 27/09/2026 — "Apple brand style"): few words, big type,
   generous space, 24–28 px corners, black and white, silver as the premium
   material, Hub Blue only for links and buttons. The book paints its own
   page (BOOK_THEME below) instead of following the Hub skin, so it reads
   the same in Aurora and Core, light and dark.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import { Noto_Sans_Arabic } from "next/font/google";
import { useTranslation, type Lang } from "@/lib/i18n";
import { BRAND_BOOK_UI, fill } from "@/lib/brand-book/ui";
import { BOOK_BASE, BOOK_PARTS, chapterByNumber, chapterHref, neighbours, pad } from "@/lib/brand-book/chapters";
import { SILVER, cmykText, rgbText, type BrandColor } from "@/lib/brand-book/tokens";

const NO_DICTIONARY = {};

/* The brand's Arabic face (owner, 27/09/2026: Noto Sans Arabic). Loaded only
   by the book; the unicode-range split means a page downloads it only when
   it shows Arabic. */
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "600"], display: "swap", variable: "--font-book-ar" });

/** Inline style for Arabic samples in the book. */
export const AR_FONT: CSSProperties = { fontFamily: "var(--font-book-ar), 'Noto Sans Arabic', 'Geeza Pro', Tahoma, sans-serif" };
/** Inline style for Chinese samples in the book. */
export const ZH_FONT: CSSProperties = { fontFamily: "'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" };

/* The book's own page. It re-points the Hub's text and surface tokens, so
   every part of every chapter — including classes written in the chapter
   files — takes the book's palette: white / Cloud / Graphite in light,
   black / Graphite / Cloud in dark. Links use Hub Blue (Deep on white, Sky
   on black); nothing else is blue. */
export const BOOK_THEME = [
  notoArabic.variable,
  "[--bg-primary:#FFFFFF] dark:[--bg-primary:#000000]",
  "[--bg-secondary:#F5F5F7] dark:[--bg-secondary:#1D1D1F]",
  "[--bg-surface:#F5F5F7] dark:[--bg-surface:#1D1D1F]",
  "[--bg-surface-subtle:#FAFAFC] dark:[--bg-surface-subtle:#0D0D0E]",
  "[--bg-surface-hover:#E8E8ED] dark:[--bg-surface-hover:#2C2C2E]",
  "[--border-subtle:#D2D2D7] dark:[--border-subtle:#38383A]",
  "[--border-faint:#E8E8ED] dark:[--border-faint:#2C2C2E]",
  "[--border-focus:#86868B] dark:[--border-focus:#6E6E73]",
  "[--text-primary:#1D1D1F] dark:[--text-primary:#F5F5F7]",
  "[--text-secondary:#424245] dark:[--text-secondary:#D1D1D6]",
  "[--text-dim:#6E6E73] dark:[--text-dim:#98989D]",
  "[--text-ghost:#AEAEB2] dark:[--text-ghost:#636366]",
  "[--bg-inverted:#1D1D1F] dark:[--bg-inverted:#F5F5F7]",
  "[--text-inverted:#FFFFFF] dark:[--text-inverted:#000000]",
  "[--bk-link:#3E6796] dark:[--bk-link:#7FA9D6]",
  "[&_:lang(ar)]:[font-family:var(--font-book-ar),'Noto_Sans_Arabic',sans-serif]",
  "bg-[var(--bg-primary)] text-[var(--text-primary)]",
].join(" ");

export function useBookLang(): { lang: Lang; ui: (typeof BRAND_BOOK_UI)[Lang] } {
  const { lang } = useTranslation(NO_DICTIONARY);
  const safe: Lang = lang === "zh" || lang === "ar" ? lang : "en";
  return { lang: safe, ui: BRAND_BOOK_UI[safe] };
}

/* The language of the chapter BODY. Labels that sit inside the body — Why,
   Specs, Do / Don't, Copy, Download — speak the body's language, so an
   English paragraph is never introduced by an Arabic "السبب:". The reader's
   own chrome (contents, pager, headers) keeps the reader's language. */
const BodyLang = createContext<Lang | null>(null);

function useBodyUi(): (typeof BRAND_BOOK_UI)[Lang] {
  const body = useContext(BodyLang);
  const { ui } = useBookLang();
  return body ? BRAND_BOOK_UI[body] : ui;
}

/* Where the book lives. The Knowledge route is the default; a copy served at
   another address (the public link, a local preview) provides its own base
   so every link inside stays inside that copy. */
export const BookBase = createContext<string>(BOOK_BASE);

export function useBookBase(): string {
  return useContext(BookBase);
}

/* ── Chapter frame ─────────────────────────────────────────────────────── */

export interface TocItem { id: string; title: string }

export function Chapter({ n, lead, toc, children }: {
  n: number;
  lead: ReactNode;
  toc: TocItem[];
  children: ReactNode;
}) {
  const { lang, ui } = useBookLang();
  const base = useBookBase();
  const ch = chapterByNumber(n);
  if (!ch) throw new Error(`brand-book: no chapter ${n}`);
  const part = BOOK_PARTS.find((p) => p.n === ch.part);
  const { prev, next } = neighbours(n);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_200px] gap-12">
      <article className="min-w-0">
        <header className="pb-12 md:pb-16">
          <p className="text-[13px] font-semibold text-[var(--text-dim)]">
            {fill(ui.part, { n: ch.part })} · {part?.title[lang]}
          </p>
          <p className="mt-6 text-[15px] font-semibold tabular-nums text-[var(--text-dim)]">{pad(n)}</p>
          <h1 className="mt-1 text-[40px] md:text-[56px] font-semibold leading-[1.04] tracking-[-0.03em] text-[var(--text-primary)] [text-wrap:balance]">
            {ch.title[lang]}
          </h1>
          {lang !== "en" && (
            <p className="mt-3 text-[13px] text-[var(--text-dim)]">
              {ch.title.en} — {ui.bodyInEnglish}
            </p>
          )}
          <div dir="ltr" lang="en" className="mt-6 max-w-[40ch] text-[19px] md:text-[21px] leading-[1.45] tracking-[-0.01em] text-[var(--text-dim)]">
            {lead}
          </div>
        </header>

        <BodyLang.Provider value="en">
          <div dir="ltr" lang="en" className="space-y-20 md:space-y-24">
            {children}
          </div>
        </BodyLang.Provider>

        <nav className="mt-24 grid grid-cols-2 gap-3" aria-label={ui.contents}>
          {prev ? (
            <Link href={chapterHref(prev.slug, base)} className="group rounded-[24px] bg-[var(--bg-secondary)] px-5 py-4 transition-colors hover:bg-[var(--bg-surface-hover)]">
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-dim)]">
                <ArrowLeftIcon size={12} className="rtl:rotate-180" />{ui.previous}
              </span>
              <span className="mt-1 block text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {prev.title[lang]}
              </span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={chapterHref(next.slug, base)} className="group rounded-[24px] bg-[var(--bg-secondary)] px-5 py-4 text-end transition-colors hover:bg-[var(--bg-surface-hover)]">
              <span className="flex items-center justify-end gap-1.5 text-[12px] text-[var(--text-dim)]">
                {ui.next}<ArrowRightIcon size={12} className="rtl:rotate-180" />
              </span>
              <span className="mt-1 block text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {next.title[lang]}
              </span>
            </Link>
          ) : <span />}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-6 pt-2">
          <p className="text-[12px] font-semibold text-[var(--text-dim)]">{ui.onThisPage}</p>
          <ul dir="ltr" lang="en" className="mt-3 space-y-2.5">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="block text-[13px] leading-snug text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/* ── Text ──────────────────────────────────────────────────────────────── */

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-[30px] md:text-[40px] font-semibold leading-[1.08] tracking-[-0.025em] text-[var(--text-primary)] [text-wrap:balance]">{title}</h2>
      <div className="mt-8 space-y-6">{children}</div>
    </section>
  );
}

export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 pt-4">
      <h3 className="text-[21px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">{title}</h3>
      {children}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-[64ch] text-[17px] leading-[1.6] text-[var(--text-secondary)]">{children}</p>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="max-w-[64ch] space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3.5 text-[17px] leading-[1.55] text-[var(--text-secondary)]">
          <span aria-hidden className="mt-[11px] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--text-ghost)]" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>;
}

/** A cross-reference to another chapter: a link when it is written, plain
 *  text (with "soon") when it is not — never a link to an empty page. */
export function Ref({ n }: { n: number }) {
  const base = useBookBase();
  const ch = chapterByNumber(n);
  if (!ch) return null;
  const label = `ch. ${pad(n)} ${ch.title.en}`;
  return ch.ready ? (
    <Link href={chapterHref(ch.slug, base)} className="font-medium text-[var(--bk-link)] hover:underline underline-offset-2">
      {label}
    </Link>
  ) : (
    <span className="text-[var(--text-dim)]">{label} (coming)</span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--text-primary)]">{children}</code>;
}

/** The rule itself, stated once and big, with the reason under it. */
export function Rule({ children, why }: { children: ReactNode; why?: ReactNode }) {
  const ui = useBodyUi();
  return (
    <div className="rounded-[28px] bg-[var(--bg-secondary)] px-6 py-7 md:px-10 md:py-9">
      <p className="max-w-[34ch] text-[22px] md:text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--text-primary)] [text-wrap:balance]">{children}</p>
      {why && (
        <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--text-dim)]">
          <span className="font-semibold text-[var(--text-secondary)]">{ui.why}. </span>{why}
        </p>
      )}
    </div>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleWarningIcon : InfoIcon;
  return (
    <div className="flex max-w-[76ch] gap-3 rounded-[20px] bg-[var(--bg-secondary)] px-5 py-4">
      <Icon size={16} className="mt-[3px] shrink-0" style={{ color: tone === "warn" ? "#D97706" : "var(--text-dim)" }} />
      <div className="min-w-0 text-[15px] leading-[1.55] text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}

/* ── Specs & tables ────────────────────────────────────────────────────── */

export function Specs({ rows, title }: { rows: Array<[string, ReactNode]>; title?: string }) {
  const ui = useBodyUi();
  return (
    <div className="overflow-hidden rounded-[24px] bg-[var(--bg-secondary)] px-5 md:px-7 py-2">
      <p className="pb-2 pt-4 text-[13px] font-semibold text-[var(--text-dim)]">{title ?? ui.specs}</p>
      <dl className="divide-y divide-[var(--border-faint)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-1 sm:gap-6 py-3.5">
            <dt className="text-[14px] text-[var(--text-dim)]">{k}</dt>
            <dd className="text-[15px] font-medium text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-[24px] bg-[var(--bg-secondary)] px-3 md:px-5 py-2">
      <table className={`w-full text-start text-[14px] ${head.length >= 4 ? "min-w-[620px]" : head.length === 3 ? "min-w-[480px]" : ""}`}>
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            {head.map((h) => (
              <th key={h} className="px-2 md:px-3 py-3 text-start text-[13px] font-semibold text-[var(--text-dim)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-faint)]">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-2 md:px-3 py-3 align-top text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Examples ──────────────────────────────────────────────────────────── */

export function Examples({ cols = 2, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const grid = cols === 4
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    : cols === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2";
  return <div className={`grid gap-5 ${grid}`}>{children}</div>;
}

/** An artboard. It paints its own colour whatever the reader's theme. */
export function Stage({ bg = "#FFFFFF", h = 180, pad = 24, border, children, style }: {
  bg?: string;
  h?: number | "auto";
  pad?: number;
  border?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  /* Every artboard gets a hairline, dark on light boards and light on dark
     ones — otherwise a black board vanishes into a dark reader and a white
     board into a light one. `border={false}` opts out. */
  const light = /^#(f|e|d|c|b)/i.test(bg);
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-[24px]"
      style={{
        background: bg,
        /* An artboard sets its own ink too, so a sample with no colour of
           its own never inherits the reader's (white text on a white board). */
        color: light ? "#1D1D1F" : "#FFFFFF",
        /* …and re-points the reader's text tokens, so kit parts used inside
           an artboard (B, Code, notes) take the board's ink, not the page's. */
        ...(light
          ? { "--text-primary": "#1D1D1F", "--text-secondary": "#424245", "--text-dim": "#6E6E73" }
          : { "--text-primary": "#F5F5F7", "--text-secondary": "#D1D1D6", "--text-dim": "#98989D" }),
        minHeight: h === "auto" ? undefined : h,
        padding: pad,
        boxShadow: border === false ? undefined : light ? "inset 0 0 0 1px rgba(0,0,0,0.06)" : "inset 0 0 0 1px rgba(255,255,255,0.10)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Example({ tone = "neutral", caption, bg, h, pad, border, children }: {
  tone?: "do" | "dont" | "neutral";
  caption: ReactNode;
  bg?: string;
  h?: number | "auto";
  pad?: number;
  border?: boolean;
  children: ReactNode;
}) {
  const ui = useBodyUi();
  return (
    <figure className="flex flex-col gap-3">
      <Stage bg={bg} h={h} pad={pad} border={border}>{children}</Stage>
      <figcaption className="flex items-start gap-2 px-1 text-[14px] leading-[1.45] text-[var(--text-secondary)]">
        {tone === "do" && (
          <span className="mt-[1px] inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold" style={{ color: "#059669" }}>
            <CheckIcon size={12} />{ui.doLabel}
          </span>
        )}
        {tone === "dont" && (
          <span className="mt-[1px] inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold" style={{ color: "#DC2626" }}>
            <CrossIcon size={12} />{ui.dontLabel}
          </span>
        )}
        <span className="min-w-0">{caption}</span>
      </figcaption>
    </figure>
  );
}

/* ── Colour ────────────────────────────────────────────────────────────── */

function CopyValue({ value }: { value: string }) {
  const ui = useBodyUi();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        }).catch(() => { /* clipboard blocked: the value is on screen to select */ });
      }}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--bk-link)]"
      aria-label={`${ui.copy} ${value}`}
    >
      {done ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      {done ? ui.copied : ui.copy}
    </button>
  );
}

export function Swatch({ c, big = false }: { c: BrandColor; big?: boolean }) {
  const fill = c.id === "silver" ? SILVER.css : c.hex;
  return (
    <div className="overflow-hidden rounded-[24px] bg-[var(--bg-secondary)] ring-1 ring-black/5 dark:ring-white/10">
      <div
        className="w-full"
        style={{ background: fill, height: big ? 150 : 104, boxShadow: c.hex === "#FFFFFF" || c.hex === "#F5F5F7" ? "inset 0 -1px 0 rgba(0,0,0,0.06)" : undefined }}
      />
      <div className="space-y-1 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{c.name}</p>
          <CopyValue value={c.hex} />
        </div>
        <p className="font-mono text-[12.5px] text-[var(--text-primary)]">{c.id === "silver" ? `${c.hex} · gradient` : c.hex}</p>
        <p className="font-mono text-[12px] text-[var(--text-dim)]">RGB {rgbText(c.hex)}</p>
        <p className="font-mono text-[12px] text-[var(--text-dim)]">{c.id === "silver" ? SILVER.pantone : cmykText(c.hex)}</p>
        <p className="pt-1.5 text-[13px] leading-[1.5] text-[var(--text-secondary)]">{c.role}</p>
      </div>
    </div>
  );
}

/* ── Downloads ─────────────────────────────────────────────────────────── */

export interface DownloadItem { label: string; href: string; format: string; note?: string }

export function Downloads({ items }: { items: DownloadItem[] }) {
  const ui = useBodyUi();
  return (
    <div className="overflow-hidden rounded-[24px] bg-[var(--bg-secondary)] px-2 py-1 divide-y divide-[var(--border-faint)]">
      {items.map((it) => (
        <a
          key={it.href}
          href={it.href}
          download
          className="flex items-center gap-3 rounded-[16px] px-3 py-3.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-[var(--text-primary)]">{it.label}</span>
            {it.note && <span className="block text-[13px] text-[var(--text-dim)]">{it.note}</span>}
          </span>
          <span className="shrink-0 font-mono text-[12px] text-[var(--text-dim)]">{it.format}</span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--bk-link)]">
            <DownloadIcon size={14} />
          </span>
          <span className="sr-only">{ui.download}</span>
        </a>
      ))}
    </div>
  );
}
