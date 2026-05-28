"use client";

/* ---------------------------------------------------------------------------
   BreakdownCard — v26.

   Layout grammar now mirrors the canonical KOLEEX printed reference
   cards (XSL / XSO / XSI):

     1. Header — eyebrow + live mono code + Reset / Copy toolbar.
     2. Subtitle.
     3. Code anatomy — bordered numbered formula boxes for the whole code.
     4. Value tables — a column-flow grid (1 → 2 → 4 columns) of mini
        tables, one per axis. Each mini table has a black header
        (segment number + title) and stacked code|meaning rows. Code
        cell sits on black, meaning cell on subtle bg. Clicking any
        row picks that value for the segment — the big mono code at
        the top updates in real time. Selected row is ringed.

   English-only, brand-monochrome.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import type { CodingBreakdownDef } from "./data";
import { HubIcon } from "./icon-registry";
import { useT, useTL, useLang } from "./i18n";
import { HeaderShell } from "./primitives";
import ProductMatches from "./ProductMatches";

/* Map breakdown id → subtitle translation key. */
const SUBTITLE_KEY: Record<string, string> = {
  lockstitch: "bd.subtitle_lockstitch",
  overlock: "bd.subtitle_overlock",
  interlock: "bd.subtitle_interlock",
};

/* Display name for each breakdown (shown in the header eyebrow). */
const NAME_KEY: Record<string, string> = {
  lockstitch: "Lockstitch Machines",
  overlock: "Overlock Machines",
  interlock: "Interlock Machines",
};

export type Selection = Record<number, string>;

export function initialFromDef(def: CodingBreakdownDef): Selection {
  const s: Selection = {};
  for (const seg of def.segments) {
    s[seg.index] = seg.empty ? "" : seg.value;
  }
  return s;
}

function buildCode(def: CodingBreakdownDef, sel: Selection): string {
  const parts: string[] = [def.prefix];
  for (const seg of def.segments) {
    const v = sel[seg.index];
    if (v && v !== "" && v !== "/") parts.push(v);
  }
  return parts.join("-");
}

/* ── Formula cell — bordered numbered axis box in the anatomy row. ─── */
function FormulaCell({
  value,
  index,
  empty,
  prefix,
  active,
  dimmed,
  onEnter,
  onLeave,
  onClick,
}: {
  value: string;
  index?: number;
  empty?: boolean;
  prefix?: boolean;
  active?: boolean;
  dimmed?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  if (prefix) {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center justify-center min-w-[54px] h-11 px-3 rounded-lg border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] text-[14px] font-bold tracking-wider font-mono">
          {value}
        </div>
        <div className="h-5" aria-hidden />
      </div>
    );
  }
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      aria-pressed={active ? "true" : "false"}
      className="flex flex-col items-center gap-2 shrink-0 outline-none"
    >
      <div
        className={`flex items-center justify-center min-w-[54px] h-11 px-3 rounded-lg border text-[14px] font-bold tracking-wider font-mono transition-colors duration-150 ${
          empty
            ? "border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] bg-[var(--bg-surface)]"
            : active
              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        } ${dimmed ? "opacity-40" : ""}`}
      >
        {empty ? "" : value}
      </div>
      {typeof index === "number" && (
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none bg-[var(--text-primary)] text-[var(--bg-primary)] ${
            dimmed ? "opacity-40" : ""
          }`}
        >
          {index}
        </div>
      )}
    </button>
  );
}

function Dash() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center h-11 px-1 text-[var(--text-dim)] text-[16px] font-bold">
        —
      </div>
      <div className="h-5" aria-hidden />
    </div>
  );
}

export default function BreakdownCard({
  def,
  showPermalink = true,
  compact = false,
  onSelChange,
}: {
  def: CodingBreakdownDef;
  /** When true, the URL ?code= is synced and a "Copy link" button shows.
      Default true. Compare passes false so its two cards stay independent. */
  showPermalink?: boolean;
  /** Compact mode (Compare children): hides the Reset/Copy/Copy-link
      toolbar and the ProductMatches block so the card stays focused on
      composition. */
  compact?: boolean;
  /** Optional observer fired on every selection change. Used by Compare
      to compute axis-level diffs between the two cards. */
  onSelChange?: (sel: Selection) => void;
}) {
  const t = useT();
  const tl = useTL();
  const { dir } = useLang();
  const headerName = NAME_KEY[def.id]
    ? tl(NAME_KEY[def.id])
    : def.title.split(" · ")[0];
  const subtitleKey = SUBTITLE_KEY[def.id];

  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? active;

  const initial = useMemo(() => initialFromDef(def), [def]);
  const [sel, setSel] = useState<Selection>(initial);
  const builtCode = useMemo(() => buildCode(def, sel), [def, sel]);

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isDirty = def.segments.some((s) => sel[s.index] !== initial[s.index]);

  /* Permalink read — on mount, restore sel from ?code= if present and
     matches this def's prefix. Silent on parse failure. */
  useEffect(() => {
    if (!showPermalink) return;
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const queryCode = params.get("code");
      if (!queryCode || !queryCode.startsWith(def.prefix + "-")) return;
      const parts = queryCode.slice(def.prefix.length + 1).split("-");
      const next: Selection = { ...initial };
      let pi = 0;
      for (const seg of def.segments) {
        if (pi >= parts.length) break;
        if (next[seg.index] === "" || next[seg.index] === "/") continue;
        next[seg.index] = parts[pi];
        pi++;
      }
      setSel(next);
    } catch {
      /* malformed URL — ignore */
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [def.id, showPermalink]);

  /* Permalink write — sync the URL ?code= as the user composes. */
  useEffect(() => {
    if (!showPermalink) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (isDirty) {
      url.searchParams.set("code", builtCode);
    } else {
      url.searchParams.delete("code");
    }
    window.history.replaceState({}, "", url.toString());
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [builtCode, showPermalink]);

  const [flash, setFlash] = useState(false);
  useEffect(() => {
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 240);
    return () => window.clearTimeout(id);
  }, [builtCode]);

  /* Fire the observer callback when selection changes. */
  useEffect(() => {
    onSelChange?.(sel);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sel]);

  function toggleAxis(idx: number) {
    setActive((cur) => (cur === idx ? null : idx));
  }

  function pickValue(segNumber: number, code: string) {
    setSel((cur) => ({ ...cur, [segNumber]: code }));
  }

  function reset() {
    setSel(initial);
    setActive(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(builtCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("code", builtCode);
      url.hash = def.id;
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      id={def.id}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <HeaderShell
        eyebrow={<>{t("bd.eyebrow", { name: headerName })}</>}
        primary={
          <div
            className={`font-mono text-[22px] sm:text-[28px] font-bold tracking-wider text-[var(--text-primary)] break-all transition-colors duration-200 ${
              flash ? "bg-[var(--bg-surface-active)] rounded-md px-1 -mx-1" : ""
            }`}
            aria-live="polite"
            dir="ltr"
          >
            {builtCode}
          </div>
        }
        trailing={
          compact ? undefined : (
            <div className="no-print flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={!isDirty}
                className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                aria-label={t("bd.reset")}
              >
                <span aria-hidden>↺</span>
                {t("bd.reset")}
              </button>
              <button
                type="button"
                onClick={copy}
                className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-1.5"
                aria-label={t("bd.copy")}
              >
                <HubIcon domain="utility" k={copied ? "check" : "copy"} size={13} />
                {copied ? t("bd.copied") : t("bd.copy")}
              </button>
              {showPermalink && (
                <button
                  type="button"
                  onClick={copyLink}
                  className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-1.5"
                  aria-label={t("bd.copy_link")}
                >
                  <span aria-hidden>🔗</span>
                  {linkCopied ? t("bd.link_copied") : t("bd.copy_link")}
                </button>
              )}
            </div>
          )
        }
      />

      {/* ── Subtitle ────────────────────────────────────────────── */}
      <div className="px-5 sm:px-7 pt-5 text-[12.5px] text-[var(--text-faint)] leading-relaxed max-w-3xl">
        {subtitleKey ? t(subtitleKey) : def.subtitle}{" "}
        <span className="text-[var(--text-primary)] font-medium">
          {t("bd.compose_hint")}
        </span>
      </div>

      {/* ── Code anatomy ─────────────────────────────────────────── */}
      <div className="px-5 sm:px-7 pt-5 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
          {t("bd.code_anatomy")}
        </div>
        <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4 overflow-x-auto" dir="ltr">
          <div className="flex items-end gap-1.5 min-w-max justify-center">
            <FormulaCell value={def.prefix} prefix />
            <Dash />
            {def.segments.map((s) => {
              const v = sel[s.index] ?? "";
              const isEmpty = v === "" || v === "/";
              return (
                <span key={s.index} className="flex items-end gap-1.5">
                  {s.sep === "before" && <Dash />}
                  <FormulaCell
                    value={isEmpty ? "" : v}
                    index={s.index}
                    empty={isEmpty}
                    active={effective === s.index}
                    dimmed={effective !== null && effective !== s.index}
                    onEnter={() => setHover(s.index)}
                    onLeave={() => setHover(null)}
                    onClick={() => toggleAxis(s.index)}
                  />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Value tables — reference-card grammar ───────────────── */}
      <div className="px-5 sm:px-7 pt-3 pb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
          {t("bd.allowed_values")}
        </div>
        {/* Column-flow grid — auto-balances mini tables across columns. */}
        <div
          className="columns-1 sm:columns-2 lg:columns-4 gap-3"
          style={{ columnFill: "balance" }}
        >
          {def.tables.map((table) => {
            const isActive = effective === table.segmentNumber;
            const current = sel[table.segmentNumber] ?? "";
            return (
              <div
                key={table.segmentNumber}
                onMouseEnter={() => setHover(table.segmentNumber)}
                onMouseLeave={() => setHover(null)}
                className={`break-inside-avoid mb-3 rounded-xl overflow-hidden border bg-[var(--bg-secondary)] transition-colors ${
                  isActive
                    ? "border-[var(--text-primary)]"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                {/* Header — Hub grammar: subtle bg, numbered circle + uppercase label */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-faint)]">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none"
                    dir="ltr"
                  >
                    {table.segmentNumber}
                  </div>
                  <div className="text-[11.5px] font-semibold text-[var(--text-primary)] uppercase tracking-wider truncate">
                    {tl(table.title)}
                  </div>
                </div>

                {/* Rows */}
                <ul className="divide-y divide-[var(--border-faint)]">
                  {table.rows.map((r) => {
                    const isSelected = current === r.code;
                    return (
                      <li key={r.code}>
                        <button
                          type="button"
                          onClick={() => pickValue(table.segmentNumber, r.code)}
                          aria-pressed={isSelected}
                          className={`w-full grid grid-cols-[56px_1fr] items-stretch text-left transition-colors ${
                            isSelected
                              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                              : "hover:bg-[var(--bg-surface-subtle)]"
                          }`}
                        >
                          {/* Code cell — codes are identifiers, always LTR. */}
                          <div
                            className={`flex items-center justify-center px-2 py-2.5 font-mono font-bold text-[12px] tracking-wider ${
                              isSelected ? "" : "text-[var(--text-primary)]"
                            }`}
                            dir="ltr"
                          >
                            {r.code}
                          </div>
                          {/* Meaning cell — translated */}
                          <div
                            className={`px-3 py-2.5 text-[12.5px] leading-snug border-l ${
                              isSelected
                                ? "border-[var(--bg-primary)]/30 font-semibold"
                                : "border-[var(--border-faint)] text-[var(--text-faint)] font-medium"
                            }`}
                          >
                            {tl(r.meaning)}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── v30: Real products using this configuration (hidden in compact mode) ── */}
      {showPermalink && !compact && <ProductMatches prefix={def.prefix} sel={sel} />}
    </article>
  );
}
