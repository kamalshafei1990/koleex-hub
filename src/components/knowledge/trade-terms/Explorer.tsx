"use client";

/* ---------------------------------------------------------------------------
   Explorer — the Trade & Payment Terms section.

   THE PERFORMANCE CONTRACT, which shaped every decision here:
     · The grid renders from data.ts (structure, ~10 KB, language-neutral) and
       summary.en.ts (one line per term, ~7 KB). That is the whole cost of
       arriving on this page.
     · detail.en.ts (~35 KB) is fetched by dynamic import the FIRST time any
       card is opened, then reused. A reader who browses and leaves never
       downloads it.
     · No API call, no database read, no server round trip. The content is
       static, so it is compiled in and served with the bundle.

   Search filters on code, name, aliases and the one-liner — never on the
   deep copy, because that would force the deep copy to load just to type a
   letter.

   TWO SHAPES, ONE LIST. With nothing typed, each tab is ORGANISED: the
   Incoterms under their four ICC groups, the payment terms under method /
   L/C variant / guarantee / T/T. With a query, both tabs collapse to one
   flat grid of hits — a reader typing "SBLC" wants the card, not a lesson in
   which shelf it lives on.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import {
  INCOTERMS, INCOTERM_GROUPS, incotermsIn, LEGACY_INCOTERMS,
  PAYMENT_METHODS, paymentsIn, TT_STRUCTURES,
} from "@/lib/trade-terms/data";
import { SUMMARY_EN } from "@/lib/trade-terms/summary.en";
import type { Incoterm, PaymentMethod, TermCopy } from "@/lib/trade-terms/types";
import { TRADE_TERMS_UI, type TradeLang } from "@/lib/trade-terms/ui";
import TermCard, { type TermCardLabels } from "./TermCard";
import RiskLadder from "./RiskLadder";
import TabStrip from "@/components/ui/TabStrip";
import SearchIcon from "@/components/icons/ui/SearchIcon";

type DeepCopy = Record<string, Omit<TermCopy, "oneLine">>;
type Tab = "incoterms" | "payment";

const GRID = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3";

export default function Explorer({ lang }: { lang: TradeLang }) {
  const t = TRADE_TERMS_UI[lang];
  const [tab, setTab] = useState<Tab>("incoterms");
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [deep, setDeep] = useState<DeepCopy | null>(null);

  /* ── WHAT LOADS, AND WHEN ──────────────────────────────────────────────
     English is the source language and the default, so SUMMARY_EN is a
     static import: the majority of readers pay nothing extra and see the
     grid on first paint. Chinese and Arabic summaries are fetched only if
     that is the active language — an English reader never downloads a byte
     of either, and a Chinese reader never downloads Arabic.

     Deep copy is one step further out: fetched only when a card is first
     opened, in the active language alone. Browse and leave, and none of the
     three detail files is ever requested. */
  const [summary, setSummary] = useState<Record<string, string>>(SUMMARY_EN);
  /* Chinese and Arabic carry a spoken name for each term (信用证, الاعتماد
     المستندي) beside the English contract wording. English has none — the
     data.ts name IS the English name — so this stays empty for it. */
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    if (lang === "en") { setSummary(SUMMARY_EN); setNames({}); return; }
    (async () => {
      const m = lang === "zh"
        ? await import("@/lib/trade-terms/summary.zh")
        : await import("@/lib/trade-terms/summary.ar");
      if (!alive) return;
      if ("SUMMARY_ZH" in m) { setSummary(m.SUMMARY_ZH); setNames(m.NAMES_ZH); }
      else { setSummary(m.SUMMARY_AR); setNames(m.NAMES_AR); }
    })();
    return () => { alive = false; };
  }, [lang]);

  /* A language switch must invalidate the loaded detail, or a reader who
     switches to Arabic with a card open keeps reading English underneath a
     translated heading. The open card is kept open: `openTerm` refetches in
     the new language on the next toggle, and until then the panel shows the
     structural layers, which need no prose. */
  useEffect(() => { setDeep(null); }, [lang]);

  const loadDeep = async () => {
    const m = lang === "zh"
      ? await import("@/lib/trade-terms/detail.zh")
      : lang === "ar"
        ? await import("@/lib/trade-terms/detail.ar")
        : await import("@/lib/trade-terms/detail.en");
    setDeep("DETAIL_ZH" in m ? m.DETAIL_ZH : "DETAIL_AR" in m ? m.DETAIL_AR : m.DETAIL_EN);
  };

  const openTerm = async (code: string) => {
    const next = openCode === code ? null : code;
    setOpenCode(next);
    if (next && !deep) await loadDeep();
  };

  /* Deep copy was dropped by a language switch while a card was open —
     fetch the new language so the open panel does not sit half-empty. */
  useEffect(() => {
    if (openCode && !deep) void loadDeep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const switchTab = (next: Tab) => { setTab(next); setOpenCode(null); };

  const labels: TermCardLabels = useMemo(() => ({
    seaOnly: t.seaOnly,
    anyMode: t.anyMode,
    containerWarning: (alt) => t.containerWarning.replace("{alt}", alt),
    alsoWritten: (a) => t.alsoWritten.replace("{aliases}", a),
    sellerPays: t.sellerPays,
    buyerPays: t.buyerPays,
    costRows: {
      exportPackLoad: t.exportPackLoad,
      exportClearance: t.exportClearance,
      mainCarriage: t.mainCarriage,
      insurance: t.insurance,
      importClearance: t.importClearance,
      dutyVat: t.dutyVat,
      unloadAtDestination: t.unloadAtDestination,
    },
    journey: {
      seller: t.stSeller, export: t.stExport, onBoard: t.stOnBoard,
      arrival: t.stArrival, destination: t.stDestination,
    },
    riskMarker: t.riskMarker,
    costMarker: t.costMarker,
    meaning: t.meaning,
    howItWorks: t.howItWorks,
    useWhen: t.useWhen,
    avoidWhen: t.avoidWhen,
    pitfall: t.pitfall,
    insuranceNote: (c, p) => t.insuranceNote.replace("{clauses}", c).replace("{pct}", String(p)),
    more: t.more,
    less: t.less,
  }), [t]);

  /* ── Search ───────────────────────────────────────────────────────────
     "fob price", "c&f", "cad", "sblc" must all land. Codes, names, aliases
     and the one-liner are searched; the word "price" is dropped because a
     newcomer types "FOB price" — the price basis IS the Incoterm. */
  const q = query.trim().toLowerCase().replace(/\bprice\b/g, "").trim();
  const hit = (s: string | undefined) => !!s && s.toLowerCase().includes(q);

  const incoterms = useMemo(() => {
    if (!q) return INCOTERMS;
    return INCOTERMS.filter((i) =>
      hit(i.code) || hit(i.name) || hit(names[i.code]) || i.aliases?.some(hit) || hit(summary[i.code]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, summary, names]);

  const legacy = useMemo(() => {
    if (!q) return LEGACY_INCOTERMS;
    return LEGACY_INCOTERMS.filter((l) => hit(l.code) || hit(l.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const payments = useMemo(() => {
    if (!q) return PAYMENT_METHODS;
    return PAYMENT_METHODS.filter((p) =>
      hit(p.name) || hit(p.abbr) || hit(names[p.id]) || p.aliases?.some(hit) || hit(summary[p.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, summary, names]);

  const tts = useMemo(() => {
    if (!q) return [...TT_STRUCTURES];
    return TT_STRUCTURES.filter((s) =>
      hit("t/t") || hit("tt") || hit(s.split) || hit(t.ttTriggers[s.id]) || hit(summary[s.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, summary, t]);

  /* Typing a code jumps to the tab that holds it, so a reader who types
     "SBLC" while looking at Incoterms is shown the card, not told "no
     results — try the other tab". The jump happens only when the current
     tab has NOTHING, so a query that hits both tabs never yanks the reader
     away from the one they chose. */
  const incotermHits = incoterms.length + legacy.length;
  const paymentHits = payments.length + tts.length;
  const shownCount = tab === "incoterms" ? incotermHits : paymentHits;
  const otherHasHits = tab === "incoterms" ? paymentHits > 0 : incotermHits > 0;

  useEffect(() => {
    if (q && shownCount === 0 && otherHasHits) setTab(tab === "incoterms" ? "payment" : "incoterms");
  }, [q, shownCount, otherHasHits, tab]);

  const badgesFor = (p: PaymentMethod): string[] => {
    if (p.group === "method") {
      return [
        p.bankUndertaking ? t.bankBacked : t.noBankBacking,
        ...(p.goodsBeforePayment ? [t.goodsBefore] : []),
      ];
    }
    return p.protects === "seller" ? [t.protectsSeller]
      : p.protects === "buyer" ? [t.protectsBuyer]
        : p.protects === "both" ? [t.protectsBoth] : [];
  };

  const incotermCard = (i: Incoterm) => (
    <TermCard
      key={i.code}
      term={i}
      localName={names[i.code]}
      oneLine={summary[i.code] ?? ""}
      detail={deep?.[i.code]}
      open={openCode === i.code}
      onToggle={() => void openTerm(i.code)}
      labels={labels}
    />
  );

  /* Title = abbreviation + the spoken name; the English name and the other
     spellings go on the ghost line beneath, because the English is what the
     contract says and the reader must be able to match the two. */
  const paymentCard = (p: PaymentMethod) => (
    <PaymentCard
      key={p.id}
      id={p.id}
      title={p.abbr ? `${p.abbr} — ${names[p.id] ?? p.name}` : (names[p.id] ?? p.name)}
      aliases={names[p.id] ? [p.name, ...(p.aliases ?? [])] : p.aliases}
      oneLine={summary[p.id] ?? ""}
      detail={deep?.[p.id]}
      open={openCode === p.id}
      onToggle={() => void openTerm(p.id)}
      labels={labels}
      badges={badgesFor(p)}
    />
  );

  const ttCard = (s: (typeof TT_STRUCTURES)[number]) => (
    <PaymentCard
      key={s.id}
      id={s.id}
      title={s.split}
      oneLine={summary[s.id] ?? ""}
      detail={deep?.[s.id]}
      open={openCode === s.id}
      onToggle={() => void openTerm(s.id)}
      labels={labels}
      badges={[t.ttTriggers[s.id]]}
    />
  );

  const legacyList = (rows: typeof LEGACY_INCOTERMS) => (
    <ul className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-subtle)]">
      {rows.map((l) => (
        <li key={l.code} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
          <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] line-through decoration-[var(--text-ghost)] decoration-1">{l.code}</span>
          <span className="text-[12.5px] text-[var(--text-dim)]">{l.name}</span>
          <span className="ms-auto text-[12px] text-[var(--text-secondary)]">
            {t.legacyLine.replace("{year}", String(l.retiredIn)).replace("{alt}", l.replacedBy)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <TabStrip
        ariaLabel={t.title}
        className="inline-flex max-w-full"
        items={[
          { key: "incoterms", label: t.tabIncoterms, active: tab === "incoterms", onClick: () => switchTab("incoterms") },
          { key: "payment", label: t.tabPayment, active: tab === "payment", onClick: () => switchTab("payment") },
        ]}
      />

      {/* Search */}
      <div className="relative mt-3">
        <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="w-full h-11 ps-10 pe-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
        />
      </div>

      {/* Keyed on the tab so the swap gets the strip's entrance. */}
      <div key={tab} className="kx-tab-in">
        {shownCount === 0 ? (
          <p className="mt-8 text-center text-[13px] text-[var(--text-dim)]">
            {otherHasHits
              ? `${t.noResults} — ${tab === "incoterms" ? t.tabPayment : t.tabIncoterms}`
              : t.noResults}
          </p>
        ) : tab === "incoterms" ? (
          q ? (
            <div className="mt-4 space-y-4">
              {incoterms.length > 0 && <div className={GRID}>{incoterms.map(incotermCard)}</div>}
              {legacy.length > 0 && legacyList(legacy)}
            </div>
          ) : (
            <>
              <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--text-dim)] max-w-3xl">{t.incotermsIntro}</p>
              {INCOTERM_GROUPS.map((g) => (
                <Section key={g} title={t[`group${g}`]}>
                  <div className={GRID}>{incotermsIn(g).map(incotermCard)}</div>
                </Section>
              ))}
              <Section title={t.legacyTitle} intro={t.legacyIntro}>
                {legacyList(LEGACY_INCOTERMS)}
              </Section>
            </>
          )
        ) : q ? (
          <div className={`mt-4 ${GRID}`}>
            {payments.map(paymentCard)}
            {tts.map(ttCard)}
          </div>
        ) : (
          <>
            <RiskLadder lang={lang} onOpen={openTerm} openId={openCode} summary={summary} names={names} />
            <Section title={t.methodsTitle}>
              <div className={GRID}>{paymentsIn("method").map(paymentCard)}</div>
            </Section>
            <Section title={t.lcTypesTitle} intro={t.lcTypesIntro}>
              <div className={GRID}>{paymentsIn("lcType").map(paymentCard)}</div>
            </Section>
            <Section title={t.guaranteesTitle} intro={t.guaranteesIntro}>
              <div className={GRID}>{[...paymentsIn("guarantee"), ...paymentsIn("platform")].map(paymentCard)}</div>
            </Section>
            {/* T/T structures — separate from the ladder on purpose: T/T is the
                transfer mechanism, not a risk level, and listing it as a rung
                would imply a security it does not carry on its own. */}
            <Section title={t.ttTitle} intro={t.ttIntro}>
              <div className={GRID}>{TT_STRUCTURES.map(ttCard)}</div>
            </Section>
          </>
        )}
      </div>

      <p className="mt-10 text-[11px] leading-relaxed text-[var(--text-ghost)] max-w-3xl">
        {t.sourceNote}
      </p>
    </div>
  );
}

/* One heading grammar for every group on the page, so the reader learns it
   once. The intro is optional: the Incoterm groups explain themselves by
   their title, the payment groups need a sentence. */
function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
      {intro && <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-dim)] max-w-2xl">{intro}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* Payment terms have no journey line and no cost table — forcing them into
   the Incoterm card would print empty sections. Same three layers, fewer
   instruments. */
function PaymentCard({
  id, title, aliases, oneLine, detail, open, onToggle, labels, badges,
}: {
  id: string; title: string; aliases?: string[]; oneLine: string;
  detail?: Omit<TermCopy, "oneLine">;
  open: boolean; onToggle: () => void; labels: TermCardLabels; badges: string[];
}) {
  return (
    <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-start p-4 md:p-5 transition-colors hover:bg-[var(--bg-surface-subtle)]"
      >
        <div className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">{title}</div>
        {aliases && aliases.length > 0 && (
          <div className="mt-0.5 text-[11.5px] text-[var(--text-ghost)]">{labels.alsoWritten(aliases.join(", "))}</div>
        )}
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{oneLine}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span key={b} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10.5px] text-[var(--text-dim)]">
              {b}
            </span>
          ))}
        </div>
        <span className="mt-3 inline-block text-[11.5px] font-semibold text-[#7FA9D6]">
          {open ? labels.less : labels.more}
        </span>
      </button>

      {open && detail && (
        <div className="px-4 md:px-5 pb-5 border-t border-[var(--border-subtle)] pt-4 space-y-4">
          <Field title={labels.meaning} body={detail.meaning} />
          <Field title={labels.howItWorks} body={detail.howItWorks} />
          {detail.useWhen && <Field title={labels.useWhen} body={detail.useWhen} />}
          {detail.avoidWhen && <Field title={labels.avoidWhen} body={detail.avoidWhen} />}
          {detail.pitfall && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-amber-400/90">{labels.pitfall}</h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{detail.pitfall}</p>
            </div>
          )}
        </div>
      )}
      <span className="sr-only">{id}</span>
    </div>
  );
}

function Field({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-ghost)]">{title}</h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}
