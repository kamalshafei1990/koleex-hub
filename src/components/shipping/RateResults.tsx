"use client";

/* ---------------------------------------------------------------------------
   Shipping — the results.

   The whole screen is built around one question an operator answers in two
   seconds: what does this cost? So the money is the biggest thing on the card,
   and everything qualifying it is one line under it, with the rest behind a
   disclosure.

   ── The badge is not decoration ───────────────────────────────────────────
   Every card leads with WHAT KIND of number it is, in colour and in words:
   Provider Rate / Market Estimate / Koleex Historical Rate / Forwarder Quote.
   A market band renders as a RANGE with no single figure, because it does not
   have one. A Koleex historical rate always carries the date it was recorded.
   Neither can be mistaken for today's bookable price by someone skimming.

   ── Nothing is invented ───────────────────────────────────────────────────
   A lane with no data renders "Rate unavailable" with the reason. There is no
   fallback figure, no nearest-port substitution and no average.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { ContainerEquipment, FreightRate, RateKind } from "@/lib/shipping/types";
import { CONTAINER_EQUIPMENT } from "@/lib/shipping/types";
import { allInTotal } from "@/lib/shipping/comparability";
import type { ComparisonGroupView, RateSearchResponse } from "./shipping-client";
import ContainerIcon from "@/components/icons/ui/ContainerIcon";
import CubicMeterIcon from "@/components/icons/ui/CubicMeterIcon";
import WeightIcon from "@/components/icons/ui/WeightIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";

type T = (key: string, fallback?: string) => string;

/* Each kind gets its own hue, and they never appear in each other's colour.
   Hub Blue for a provider (the house accent, the trustworthy case), amber for
   a market band (read this carefully), neutral for history, emerald for a
   quote someone will honour. */
const KIND_TONE: Record<RateKind, string> = {
  provider: "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  market: "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  koleex: "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
  forwarder: "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
};

const CONF_TONE: Record<string, string> = {
  high: "text-[#10B981]",
  medium: "text-[#F59E0B]",
  low: "text-[var(--text-dim)]",
};

/**
 * D/M/Y — the house date format, in EVERY language.
 *
 * ⚠️ The ORDER is assembled here, not left to the locale. Asking zh-CN for a
 * short date returns 2026/04/09, which is Y/M/D and is not the house format;
 * ar-EG and en-GB happen to agree with it and Chinese does not. Only the
 * DIGITS follow the reader's locale (Arabic-Indic numerals in ar), which is
 * what formatToParts gives without also handing over the field order.
 */
export function fmtDate(iso: string | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB";
  try {
    const parts = new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", year: "numeric" })
      .formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const day = get("day"), month = get("month"), year = get("year");
    if (day && month && year) return `${day}/${month}/${year}`;
  } catch { /* fall through */ }
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtMoney(n: number, currency: string, lang: Lang): string {
  const loc = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB";
  try {
    return new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString(loc)}`;
  }
}

function relativeAge(iso: string, t: T, lang: Lang): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return t("res.today", "today");
  return fmtDate(iso, lang);
}

/* ── the badge every rate leads with ────────────────────────────────────── */
export function KindBadge({ rate, t }: { rate: FreightRate; t: T }) {
  const key = rate.kind === "provider" && rate.sourceCadence === "daily"
    ? "kind.provider.daily"
    : `kind.${rate.kind}`;
  return (
    <span
      title={t(`kind.${rate.kind}.what`)}
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold ${KIND_TONE[rate.kind]}`}
    >
      {t(key)}
    </span>
  );
}

function ConfidenceMark({ rate, t }: { rate: FreightRate; t: T }) {
  if (!rate.confidence) return null;
  const level = t(`conf.${rate.confidence}`);
  return (
    <span
      title={`${t("conf.label")}: ${level} · ${rate.confidenceScore}/100\n${(rate.confidenceReasons ?? []).join("\n")}`}
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${CONF_TONE[rate.confidence]}`}
    >
      <span aria-hidden>●</span>
      {level}
    </span>
  );
}

const unitIcon = (unit: string, size = 14) =>
  unit === "container" ? <ContainerIcon size={size} />
  : unit === "cbm" ? <CubicMeterIcon size={size} />
  : <WeightIcon size={size} />;

/* ── the money line ─────────────────────────────────────────────────────── */
function Amount({ rate, t, lang }: { rate: FreightRate; t: T; lang: Lang }) {
  if (rate.amount != null) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
          {fmtMoney(rate.amount, rate.currency, lang)}
        </span>
        <span className="text-[11px] text-[var(--text-dim)]">
          {rate.unit === "container" ? t("res.perContainer") : rate.unit === "cbm" ? t("res.perCbm") : t("res.perKg")}
        </span>
      </div>
    );
  }
  if (rate.amountLow != null && rate.amountHigh != null) {
    /* A band, drawn as a band. There is no single number to show, so none is
       shown — the range IS the answer. */
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[20px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">
          {fmtMoney(rate.amountLow, rate.currency, lang)} – {fmtMoney(rate.amountHigh, rate.currency, lang)}
        </span>
        <span className="text-[11px] text-[#F59E0B]">{t("res.rangeOnly")}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[var(--text-dim)]">
      <TriangleWarningIcon size={14} />
      <span className="text-[14px] font-medium">{t("res.unavailable")}</span>
    </div>
  );
}

/* ── one rate, expandable ───────────────────────────────────────────────── */
export function RateRow({ rate, t, lang, quantity = 1 }: { rate: FreightRate; t: T; lang: Lang; quantity?: number }) {
  const [open, setOpen] = useState(false);
  const total = allInTotal(rate, quantity);
  const transit = rate.transitDaysMin != null
    ? (rate.transitDaysMax != null && rate.transitDaysMax !== rate.transitDaysMin
        ? t("res.daysRange").replace("{min}", String(rate.transitDaysMin)).replace("{max}", String(rate.transitDaysMax))
        : t("res.days").replace("{n}", String(rate.transitDaysMin)))
    : null;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <KindBadge rate={rate} t={t} />
            <ConfidenceMark rate={rate} t={t} />
          </div>
          <Amount rate={rate} t={t} lang={lang} />
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] text-[var(--text-dim)]">
          {transit ? (
            <span className="inline-flex items-center gap-1"><ClockIcon size={12} />{transit}</span>
          ) : null}
          {rate.carrier ? <span className="font-medium text-[var(--text-muted)]">{rate.carrier}</span> : null}
          {rate.kind === "koleex" ? (
            <span className="inline-flex items-center gap-1">
              <HistoryIcon size={12} />
              {t("res.recordedOn").replace("{date}", fmtDate(rate.retrievedAt, lang))}
            </span>
          ) : (
            <span>{t("res.updated").replace("{when}", relativeAge(rate.retrievedAt, t, lang))}</span>
          )}
        </div>
      </div>

      {/* The line that stops a freight figure being read as a landed figure. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-ghost)]">
        <span className="inline-flex items-center gap-1">{unitIcon(rate.unit, 12)}{t(`scope.${rate.scope}`)}</span>
        {rate.includesDestinationCharges === true ? <span className="text-[#10B981]">{t("incl.destination")}</span>
          : rate.includesDestinationCharges === false ? <span className="text-[#F59E0B]">{t("excl.destination")}</span>
          : <span>{t("incl.unknown")}</span>}
        {rate.validUntil
          ? <span>{t("res.validity").replace("{date}", fmtDate(rate.validUntil, lang))}</span>
          : <span>{t("res.noValidity")}</span>}
      </div>

      {(rate.surcharges.length > 0 || total || rate.confidenceReasons?.length) ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            <AngleDownIcon size={11} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
            {open ? t("action.hideDetails") : t("action.details")}
          </button>
          {open ? (
            <div className="mt-2 space-y-2 border-t border-[var(--border-subtle)] pt-2">
              {rate.surcharges.length > 0 ? (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">{t("res.surcharges")}</div>
                  <ul className="space-y-0.5">
                    {rate.surcharges.map((s, i) => (
                      <li key={`${s.code}-${i}`} className="flex items-center justify-between gap-3 text-[12px]">
                        {/* Surcharge CODES stay untranslated — BAF and THC are
                            what a carrier's invoice says, in every language. */}
                        <span className="text-[var(--text-secondary)]">
                          <span className="font-mono text-[11px] text-[var(--text-ghost)]">{s.code}</span>{" "}
                          {/* The CODE is an identifier and stays; the wording
                              beside it is copy, so it goes through t() with the
                              provider's own English as the fallback. */}
                          {t(`surcharge.${s.code}`, s.label)}
                        </span>
                        <span className="tabular-nums text-[var(--text-primary)]">{fmtMoney(s.amount, s.currency, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {rate.minCharge != null ? (
                /* A per-CBM rate with a minimum underneath it is how a small
                   LCL consignment ends up costing more than volume × rate.
                   Showing the rate without the floor is the classic under-quote. */
                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-[var(--text-secondary)]">{t("res.minCharge")}</span>
                  <span className="tabular-nums text-[var(--text-primary)]">{fmtMoney(rate.minCharge, rate.currency, lang)}</span>
                </div>
              ) : null}
              {total ? (
                <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-2 text-[13px]">
                  <span className="font-semibold text-[var(--text-secondary)]">{t("res.estimatedTotal")}</span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">{fmtMoney(total.amount, total.currency, lang)}</span>
                </div>
              ) : null}
              {rate.confidenceReasons?.length ? (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-ghost)]">{t("conf.why")}</div>
                  <ul className="space-y-0.5 text-[11px] text-[var(--text-dim)]">
                    {rate.confidenceReasons.map((r, i) => <li key={i}>· {r}</li>)}
                  </ul>
                </div>
              ) : null}
              {rate.notes ? <p className="text-[11px] italic text-[var(--text-ghost)]">{rate.notes}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ── a comparison group: one product, every source that prices it ───────── */
function GroupCard({ group, t, lang, quantity }: { group: ComparisonGroupView; t: T; lang: Lang; quantity: number }) {
  const heading = group.key.equipment !== "-" ? group.key.equipment : null;
  const empty = group.rates.length === 0;
  /* Order by how actionable the number is, not by price: a bookable rate
     first, then a quote, then our own history, then a band. */
  const ordered: RateKind[] = ["provider", "forwarder", "koleex", "market"];
  const rates = ordered.flatMap((k) => group.byKind[k] ?? []);

  return (
    <section className={"rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3" + (empty ? " opacity-70" : "")}>
      {heading ? (
        <header className="mb-2 flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-primary)]">
            <ContainerIcon size={15} className="text-[var(--text-dim)]" />
            {/* Container types are identifiers, not copy — 40HQ in every language. */}
            {heading}
          </h3>
          {group.best ? (
            <span title={t("cmp.bestNote")} className="rounded-full border border-[#10B981]/35 bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
              {t("cmp.best")}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className="space-y-2">
        {rates.length ? (
          rates.map((r, i) => <RateRow key={r.id ?? `${r.sourceId}-${i}`} rate={r} t={t} lang={lang} quantity={quantity} />)
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-5 text-center">
            <TriangleWarningIcon size={14} className="mx-auto mb-1 text-[var(--text-ghost)]" />
            <p className="text-[12px] font-medium text-[var(--text-dim)]">{t("res.unavailable")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── the whole result ───────────────────────────────────────────────────── */
export default function RateResults({
  data, t, lang, quantity = 1, columns,
}: {
  data: RateSearchResponse;
  t: T;
  lang: Lang;
  quantity?: number;
  /** Measured by the host — never a viewport breakpoint. */
  columns: 1 | 2 | 3;
}) {
  /* FCL ASKS ABOUT THREE CONTAINERS AND MUST ANSWER ABOUT THREE.
     The engine groups what it FOUND, so a lane priced only for 20GP rendered a
     single card and the other two simply were not there — which reads as "we
     did not ask" rather than "there is no rate". Every requested container gets
     a card; the ones with nothing say so. */
  const groups = useMemo(() => {
    if (data.query.mode !== "ocean_fcl") return data.groups;
    const wanted = data.query.equipment?.length ? data.query.equipment : CONTAINER_EQUIPMENT;
    const byEquipment = new Map(data.groups.map((g) => [g.key.equipment, g]));
    const out: ComparisonGroupView[] = [];
    for (const eq of wanted) {
      const hit = byEquipment.get(eq);
      out.push(hit ?? emptyGroup(data, eq));
      byEquipment.delete(eq);
    }
    /* Anything the engine returned that was NOT asked for still belongs on
       screen — a provider answering with a container we did not request is
       information, not noise. */
    for (const g of byEquipment.values()) out.push(g);
    return out;
  }, [data]);

  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-12 text-center">
        <TriangleWarningIcon size={20} className="mx-auto mb-2 text-[var(--text-ghost)]" />
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">{t("res.unavailable")}</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-[12px] text-[var(--text-dim)]">
          {data.unavailable?.reason === "no_sources" ? t("err.noSources") : t("res.unavailableHint")}
        </p>
      </div>
    );
  }

  /* FCL wants its three containers side by side; LCL and air have one product
     and read better full width. */
  const grid = columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${groups.length > 1 ? grid : "grid-cols-1"}`}>
        {groups.map((g, i) => (
          <GroupCard key={`${g.key.equipment}-${g.key.scope}-${i}`} group={g} t={t} lang={lang} quantity={quantity} />
        ))}
      </div>

      {data.refusals.length ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
          <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
            <InfoIcon size={13} className="text-[var(--text-ghost)]" />
            {t("cmp.notComparable")}
          </p>
          <p className="mb-2 text-[11px] text-[var(--text-dim)]">{t("cmp.why")}</p>
          <ul className="space-y-1 text-[11px] text-[var(--text-ghost)]">
            {data.refusals.slice(0, 4).map((r, i) => (
              <li key={i}>
                <span className="text-[var(--text-dim)]">{r.a}</span>
                {" · "}
                <span className="text-[var(--text-dim)]">{r.b}</span>
                {" — "}
                {r.reasons.map((x) => t(`cmp.diff.${reasonKey(x)}`, x)).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** A container we asked about and got nothing for. Rendered, never omitted. */
function emptyGroup(data: RateSearchResponse, equipment: ContainerEquipment): ComparisonGroupView {
  return {
    key: {
      mode: data.query.mode,
      originCode: data.query.originCode,
      destinationCode: data.query.destinationCode,
      equipment,
      unit: "container",
      currency: "USD",
      scope: "port_to_port",
      inclusions: "???",
    },
    rates: [],
    byKind: { provider: [], market: [], koleex: [], forwarder: [] },
  };
}

/** The engine speaks English reason strings; map them onto dictionary keys. */
function reasonKey(reason: string): string {
  if (reason.includes("mode")) return "mode";
  if (reason.includes("lane")) return "lane";
  if (reason.includes("container")) return "equipment";
  if (reason.includes("unit")) return "unit";
  if (reason.includes("currency")) return "currency";
  if (reason.includes("scope")) return "scope";
  return "inclusions";
}
