"use client";

/* ---------------------------------------------------------------------------
   The brand book's page kit — every chapter is built from these parts, so
   every page reads the same way:

       rule  →  why  →  specs  →  ✓ / ✗ examples  →  download

   Two kinds of surface, deliberately different:
     · the READER (headings, text, cards) uses the Hub tokens, so it follows
       the skin (Aurora glass or Core flat) and the light/dark theme;
     · a STAGE is an artboard. It paints the brand's own colours (#FFFFFF,
       #0A0A0A…) whatever the theme, because an example of the logo on white
       has to be white in a dark room too.

   The chapter BODY is English (owner, 27/09/2026) and is marked dir="ltr"
   lang="en" so an Arabic reader's RTL page does not right-align English
   sentences. The reader's own words (labels, menus) follow the language.
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
import { useTranslation, type Lang } from "@/lib/i18n";
import { BRAND_BOOK_UI, fill } from "@/lib/brand-book/ui";
import { BOOK_BASE, BOOK_PARTS, chapterByNumber, chapterHref, neighbours, pad } from "@/lib/brand-book/chapters";
import { cmykText, rgbText, type BrandColor } from "@/lib/brand-book/tokens";

const NO_DICTIONARY = {};

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
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_200px] gap-10">
      <article className="min-w-0">
        <header className="pb-8 mb-2 border-b border-[var(--border-subtle)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            {fill(ui.part, { n: ch.part })} · {part?.title[lang]}
          </p>
          <div className="mt-3 flex items-baseline gap-4">
            <span className="text-[44px] md:text-[56px] font-bold leading-none tabular-nums text-[var(--text-ghost)]">{pad(n)}</span>
            <h1 className="text-[28px] md:text-[36px] font-bold leading-tight tracking-tight text-[var(--text-primary)] [text-wrap:balance]">
              {ch.title[lang]}
            </h1>
          </div>
          {lang !== "en" && (
            <p className="mt-3 text-[12px] text-[var(--text-dim)]">
              {ch.title.en} — {ui.bodyInEnglish}
            </p>
          )}
          <div dir="ltr" lang="en" className="mt-5 max-w-[68ch] text-[16px] leading-7 text-[var(--text-secondary)]">
            {lead}
          </div>
        </header>

        <BodyLang.Provider value="en">
          <div dir="ltr" lang="en" className="space-y-14 pt-8">
            {children}
          </div>
        </BodyLang.Provider>

        <nav className="mt-16 pt-6 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-3" aria-label={ui.contents}>
          {prev ? (
            <Link href={chapterHref(prev.slug, base)} className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 transition-colors hover:border-[var(--border-focus)]">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <ArrowLeftIcon size={12} className="rtl:rotate-180" />{ui.previous}
              </span>
              <span className="mt-1 block text-[13.5px] font-semibold text-[var(--text-primary)]">
                {pad(prev.n)} · {prev.title[lang]}
              </span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={chapterHref(next.slug, base)} className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-end transition-colors hover:border-[var(--border-focus)]">
              <span className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--text-dim)]">
                {ui.next}<ArrowRightIcon size={12} className="rtl:rotate-180" />
              </span>
              <span className="mt-1 block text-[13.5px] font-semibold text-[var(--text-primary)]">
                {pad(next.n)} · {next.title[lang]}
              </span>
            </Link>
          ) : <span />}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{ui.onThisPage}</p>
          <ul dir="ltr" lang="en" className="mt-3 space-y-2 border-s border-[var(--border-subtle)]">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="block -ms-px border-s border-transparent ps-3 text-[12.5px] leading-snug text-[var(--text-dim)] transition-colors hover:border-[#567FB2] hover:text-[var(--text-primary)]">
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
      <h2 className="text-[22px] md:text-[24px] font-bold tracking-tight text-[var(--text-primary)] [text-wrap:balance]">{title}</h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</h3>
      {children}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-[14.5px] leading-7 text-[var(--text-secondary)]">{children}</p>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="max-w-[68ch] space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[14.5px] leading-7 text-[var(--text-secondary)]">
          <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#567FB2]" />
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
    <Link href={chapterHref(ch.slug, base)} className="font-medium text-[#3E6796] underline decoration-[#7FA9D6]/60 underline-offset-2 hover:decoration-[#3E6796] dark:text-[#7FA9D6]">
      {label}
    </Link>
  ) : (
    <span className="text-[var(--text-dim)]">{label} (coming)</span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[12.5px] text-[var(--text-primary)]">{children}</code>;
}

/** The rule itself, stated once, with the reason under it. */
export function Rule({ children, why }: { children: ReactNode; why?: ReactNode }) {
  const ui = useBodyUi();
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 md:p-6">
      <div className="flex gap-3">
        <span aria-hidden className="mt-1 h-auto w-1 shrink-0 rounded-full" style={{ background: "linear-gradient(180deg,#567FB2,#BCD8F0)" }} />
        <div className="min-w-0">
          <p className="text-[16px] md:text-[17px] font-semibold leading-7 text-[var(--text-primary)] [text-wrap:pretty]">{children}</p>
          {why && (
            <p className="mt-2 text-[13.5px] leading-6 text-[var(--text-dim)]">
              <span className="font-semibold text-[var(--text-secondary)]">{ui.why}: </span>{why}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const Icon = tone === "warn" ? TriangleWarningIcon : InfoIcon;
  const accent = tone === "warn" ? "#D97706" : "#567FB2";
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3 max-w-[76ch]">
      <Icon size={16} className="mt-[3px] shrink-0" style={{ color: accent }} />
      <div className="min-w-0 text-[13.5px] leading-6 text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}

/* ── Specs & tables ────────────────────────────────────────────────────── */

export function Specs({ rows, title }: { rows: Array<[string, ReactNode]>; title?: string }) {
  const ui = useBodyUi();
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <p className="border-b border-[var(--border-subtle)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
        {title ?? ui.specs}
      </p>
      <dl className="divide-y divide-[var(--border-faint)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-1 sm:gap-4 px-4 py-2.5">
            <dt className="text-[13px] text-[var(--text-dim)]">{k}</dt>
            <dd className="text-[13.5px] font-medium text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <table className={`w-full text-start text-[13px] ${head.length >= 4 ? "min-w-[620px]" : head.length === 3 ? "min-w-[480px]" : ""}`}>
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-start text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-faint)]">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">{cell}</td>
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
  return <div className={`grid gap-4 ${grid}`}>{children}</div>;
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
      className="relative flex items-center justify-center overflow-hidden rounded-xl"
      style={{
        background: bg,
        /* An artboard sets its own ink too, so a sample with no colour of
           its own never inherits the reader's (white text on a white board). */
        color: light ? "#0A0A0A" : "#FFFFFF",
        /* …and re-points the reader's text tokens, so kit parts used inside
           an artboard (B, Code, notes) take the board's ink, not the page's. */
        ...(light
          ? { "--text-primary": "#0A0A0A", "--text-secondary": "#4B5563", "--text-dim": "#4B5563" }
          : { "--text-primary": "#FFFFFF", "--text-secondary": "rgba(255,255,255,0.72)", "--text-dim": "#9CA3AF" }),
        minHeight: h === "auto" ? undefined : h,
        padding: pad,
        boxShadow: border === false ? undefined : light ? "inset 0 0 0 1px rgba(0,0,0,0.08)" : "inset 0 0 0 1px rgba(255,255,255,0.16)",
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
    <figure className="flex flex-col gap-2.5">
      <Stage bg={bg} h={h} pad={pad} border={border}>{children}</Stage>
      <figcaption className="flex items-start gap-2 text-[13px] leading-5 text-[var(--text-secondary)]">
        {tone === "do" && (
          <span className="mt-[1px] inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[1px] text-[11px] font-semibold text-white" style={{ background: "#059669" }}>
            <CheckIcon size={10} />{ui.doLabel}
          </span>
        )}
        {tone === "dont" && (
          <span className="mt-[1px] inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[1px] text-[11px] font-semibold text-white" style={{ background: "#DC2626" }}>
            <CrossIcon size={10} />{ui.dontLabel}
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
      className="inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
      aria-label={`${ui.copy} ${value}`}
    >
      {done ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      {done ? ui.copied : ui.copy}
    </button>
  );
}

export function Swatch({ c, big = false }: { c: BrandColor; big?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div
        className="w-full"
        style={{ background: c.hex, height: big ? 132 : 88, boxShadow: c.hex === "#FFFFFF" ? "inset 0 -1px 0 rgba(0,0,0,0.08)" : undefined }}
      />
      <div className="space-y-1 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{c.name}</p>
          <CopyValue value={c.hex} />
        </div>
        <p className="font-mono text-[12px] text-[var(--text-primary)]">{c.hex}</p>
        <p className="font-mono text-[11.5px] text-[var(--text-dim)]">RGB {rgbText(c.hex)}</p>
        <p className="font-mono text-[11.5px] text-[var(--text-dim)]">{cmykText(c.hex)}</p>
        <p className="pt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{c.role}</p>
      </div>
    </div>
  );
}

/* ── Downloads ─────────────────────────────────────────────────────────── */

export interface DownloadItem { label: string; href: string; format: string; note?: string }

export function Downloads({ items }: { items: DownloadItem[] }) {
  const ui = useBodyUi();
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-faint)]">
      {items.map((it) => (
        <a
          key={it.href}
          href={it.href}
          download
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)]">
            <DownloadIcon size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-[var(--text-primary)]">{it.label}</span>
            {it.note && <span className="block text-[12px] text-[var(--text-dim)]">{it.note}</span>}
          </span>
          <span className="shrink-0 rounded-md border border-[var(--border-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-dim)]">{it.format}</span>
          <span className="sr-only">{ui.download}</span>
        </a>
      ))}
    </div>
  );
}
