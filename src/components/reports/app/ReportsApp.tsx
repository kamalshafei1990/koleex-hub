"use client";

/* ---------------------------------------------------------------------------
   Reports — /reports (Phase 1, owner-approved 25 Sep 2026).

   One app for every written report: pick a type, it opens as a draft
   addressed to the right person, you fill it in and send it. The engine
   knows no single type — they all come from src/lib/reports/templates.ts.

   Requests on open: ONE (/api/work-reports/bundle), warm-started from
   sessionStorage so a revisit paints at once. The Inbox / My reports / Team
   lists are server-side (search, filter, paging) through the shared
   useServerList contract and load only when their tab opens. The Library's
   HR numbers load their own code only when that section is opened, and so
   does the Compliance board (Phase 3A). "Due from you" rides the bundle.
   Phase 4E: the types made in the template builder ride it too (named, for
   "Write a report"), and the builder itself — the Templates tab, for super
   admins and whoever holds "Report Templates" in Roles — loads its own code
   only when it is opened. Phase 5A: the Team tab opens with the team
   summary (Koleex AI over what the team sent), its own chunk too.
   5C: the types are listed from their HEADS (lib/reports/catalog-heads —
   key, family, group, icon, cadence, who is offered it), never the catalog
   with every type's sections: only the builder's own chunk carries that.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation, type Translations } from "@/lib/i18n";
import { reportCommonT } from "@/lib/translations/report-ui/common";
import { reportHomeT } from "@/lib/translations/report-ui/home";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu, { type AppHomeNavItem } from "@/components/ui/AppHomeMenu";
import SharedKpiCard from "@/components/ui/KpiCard";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ReportsIcon from "@/components/icons/ReportsIcon";
import { useServerList } from "@/lib/hooks/useServerList";
import { REPORT_FAMILIES, periodFor, type ReportFamily } from "@/lib/reports/templates";
import { FAMILY_GROUPS, REPORT_HEADS, reportHead } from "@/lib/reports/catalog-heads";
import { headWords, isCustomKey } from "@/lib/reports/template-words";
import { createReport, dmyDate, dmyTime, fetchReportsBundle, localToday, periodLabel, type ReportListRow, type ReportsBundle } from "@/lib/work-reports";
import type { DueItem } from "@/lib/reports/obligations";
import { CARD, TemplateIcon, tplName, type T } from "./shared";
import { ReportRowItem } from "./ReportRowItem";

const HrLibrary = dynamic(() => import("./HrLibrary"), { ssr: false, loading: () => <div className="grid place-items-center py-10"><SpinnerIcon size={18} /></div> });
const ComplianceTab = dynamic(() => import("./ComplianceTab"), { ssr: false, loading: () => <div className={`${CARD} grid place-items-center py-14`}><SpinnerIcon size={18} /></div> });
const TemplatesTab = dynamic(() => import("./TemplatesTab"), { ssr: false, loading: () => <div className={`${CARD} grid place-items-center py-14`}><SpinnerIcon size={18} /></div> });
const TeamSummary = dynamic(() => import("./TeamSummary"), { ssr: false, loading: () => <div className={`${CARD} mb-4 grid place-items-center py-10`}><SpinnerIcon size={16} /></div> });

type Tab = "home" | "inbox" | "mine" | "team" | "compliance" | "library" | "templates";
const TABS: Tab[] = ["home", "inbox", "mine", "team", "compliance", "library", "templates"];
const WARM_KEY = "kx:reports:bundle";
/** The home's words and every type's name. Never the whole Reports
 *  dictionary: the report page's words stay with the report page (26 Sep). */
const APP_WORDS = { ...reportCommonT, ...reportHomeT };
/* The one line under each type's name (5B) rides its own chunk (owner's
   pick, 26 Sep 2026): it starts loading with the page, beside the list of
   types, and "Write a report" is a skeleton until BOTH are here — the cards
   land once, never growing under the reader's eyes. Kept once loaded, so
   coming back to the home finds it at once. */
let descsLoaded: Translations | null = null;
const loadDescs = (): Promise<Translations> =>
  import("@/lib/translations/report-descs").then((m) => (descsLoaded = m.reportDescsT));

export default function ReportsApp() {
  const [bundle, setBundle] = useState<ReportsBundle | null>(null);
  /* The builder types' names and descriptions (4E) join the dictionary, so
     "Write a report" names them like any other type. */
  const custom = bundle?.custom;
  const [descs, setDescs] = useState<Translations | null>(() => descsLoaded);
  const words = useMemo(() => (descs || custom?.length ? { ...APP_WORDS, ...(descs ?? {}), ...(custom?.length ? headWords(custom) : {}) } : APP_WORDS), [descs, custom]);
  const { t, lang } = useTranslation(words);
  const router = useRouter();
  const [tab, setTabState] = useState<Tab>(() => {
    if (typeof window === "undefined") return "home";
    const q = new URLSearchParams(window.location.search).get("tab");
    return (TABS as string[]).includes(q ?? "") ? (q as Tab) : "home";
  });
  /* A client-side navigation to /reports?tab=… (after deleting a draft, a
     notification, a Library link) renders this component BEFORE the router
     writes the new URL, so the initializer above still sees the old one.
     Read it again once the navigation has committed. */
  useEffect(() => {
    void Promise.resolve().then(() => {
      const q = new URLSearchParams(window.location.search).get("tab");
      if ((TABS as string[]).includes(q ?? "")) setTabState(q as Tab);
    });
  }, []);
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    try {
      const url = new URL(window.location.href);
      if (next === "home") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch { /* no history */ }
  }, []);

  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetchReportsBundle();
    if (res.ok) {
      setBundle(res.data);
      setLoadError(false);
      try { sessionStorage.setItem(WARM_KEY, JSON.stringify(res.data)); } catch { /* quota */ }
    } else {
      setLoadError((had) => had || true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(WARM_KEY);
      if (raw) queueMicrotask(() => { if (!cancelled) setBundle(JSON.parse(raw) as ReportsBundle); });
    } catch { /* corrupt — the network covers it */ }
    void Promise.resolve().then(() => { if (!cancelled) reload(); });
    /* A failed load is no lines under the names — never a skeleton for good. */
    if (!descsLoaded) loadDescs().then((d) => { if (!cancelled) setDescs(d); }, () => { if (!cancelled) setDescs({}); });
    return () => { cancelled = true; };
  }, [reload]);

  /* A new report — or, for a day / week / month that already has one, that
     one (the server returns it), so "Write it now" on an owed report opens
     the draft already started. */
  const start = useCallback(async (key: string, date?: string, opts?: { replace?: boolean; request?: string }) => {
    setCreating(opts?.request ?? (date ? `${key}|${date}` : key));
    setCreateError(null);
    const res = await createReport(key, date ?? localToday(), opts?.request ? { request: opts.request, lang } : undefined);
    setCreating(null);
    if (res.ok) {
      if (opts?.replace) router.replace(`/reports/${res.data.id}`);
      else router.push(`/reports/${res.data.id}`);
    } else setCreateError(res.error === "not_internal" ? t("err.notInternal") : res.error === "hidden" || res.error === "unknown_template" ? t("err.typeGone") : t("err.generic"));
  }, [router, t, lang]);

  /* /reports?write=<type>&date=<day>[&request=<id>] — "write it" from the
     Calendar, the Home greeting (Phase 3C) or an event's notification (3D)
     opens that day's, week's or month's report, or the one the event asked
     for (the draft already started, if there is one). The parameters go
     first, so Back or a refresh never starts it twice, and the report
     REPLACES this stop in the history: Back returns to where the tap came
     from. Read once the navigation has committed (the ?tab= trap above). */
  useEffect(() => {
    void Promise.resolve().then(() => {
      const url = new URL(window.location.href);
      const key = url.searchParams.get("write");
      if (!key) return;
      const date = url.searchParams.get("date");
      const request = url.searchParams.get("request");
      url.searchParams.delete("write");
      url.searchParams.delete("date");
      url.searchParams.delete("request");
      window.history.replaceState(window.history.state, "", url.toString());
      if (!reportHead(key) && !isCustomKey(key)) return;
      void start(key, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined, {
        replace: true,
        request: request && /^[0-9a-f-]{36}$/i.test(request) ? request : undefined,
      });
    });
  }, [start]);

  const counts = bundle?.counts;
  const navItems: AppHomeNavItem[] = [
    { key: "home", onClick: () => setTab("home"), icon: "home", label: t("nav.home"), active: tab === "home" },
    { key: "inbox", onClick: () => setTab("inbox"), icon: "download", label: t("nav.inbox"), count: counts?.unread || undefined, active: tab === "inbox" },
    { key: "mine", onClick: () => setTab("mine"), icon: "file", label: t("nav.mine"), count: counts?.drafts || undefined, active: tab === "mine" },
    ...(bundle?.me.hasTeam ? [{ key: "team", onClick: () => setTab("team"), icon: "users" as const, label: t("nav.team"), active: tab === "team" }] : []),
    ...(bundle?.me.board ? [{ key: "compliance", onClick: () => setTab("compliance"), icon: "badge-check" as const, label: t("nav.compliance"), active: tab === "compliance" }] : []),
    { key: "library", onClick: () => setTab("library"), icon: "books", label: t("nav.library"), active: tab === "library" },
    ...(bundle?.me.templates ? [{ key: "templates", onClick: () => setTab("templates"), icon: "palette" as const, label: t("nav.templates"), active: tab === "templates" }] : []),
  ];

  const [query, setQuery] = useState("");
  const onSearch = (q: string) => { setQuery(q); if (tab === "home" || tab === "library") setTab("inbox"); };

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-full">
      {/* The Hub shell's top padding, not pt-12: pt-12 cleared a frosted ramp
          that once hung 3rem below the header; the header is solid at rest
          now and nothing paints in that strip (measured 25/09), so it had
          become a gap. !pb-28 keeps the bottom clearance the compact density
          layer would otherwise rewrite to 16px. */}
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-28">
        <PageHeader
          title={t("app.title")}
          subtitle={t("app.subtitle")}
          icon={<ReportsIcon size={16} />}
          showTabs={false}
        />

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <SharedKpiCard label={t("kpi.review")} value={counts ? String(counts.review) : "—"} icon="badge-check" tone={counts && counts.review > 0 ? "warning" : undefined} onClick={() => setTab("inbox")} />
          <SharedKpiCard label={t("kpi.unread")} value={counts ? String(counts.unread) : "—"} icon="download" tone={counts && counts.unread > 0 ? "info" : undefined} onClick={() => setTab("inbox")} />
          <SharedKpiCard label={t("kpi.drafts")} value={counts ? String(counts.drafts) : "—"} icon="pencil" onClick={() => setTab("mine")} />
          <SharedKpiCard label={t("kpi.sent")} value={counts ? String(counts.sentThisMonth) : "—"} icon="paper-plane" onClick={() => setTab("mine")} />
        </div>

        <div className="mt-4 mb-4">
          <AppHomeMenu searchPlaceholder={t("search.placeholder")} onSearchSubmit={onSearch} navItems={navItems} />
        </div>

        {loadError && !bundle && (
          <div className={`${CARD} px-5 py-6 text-center text-[13px] text-[var(--text-dim)]`}>
            {t("err.generic")} <button type="button" onClick={() => void reload()} className="ms-2 font-medium text-[var(--text-primary)] underline">↻</button>
          </div>
        )}

        <div key={tab} className="kx-tab-in">
          {tab === "home" && <Home t={t} lang={lang} bundle={bundle} ready={!!bundle && !!descs} failed={loadError && !bundle} creating={creating} createError={createError} onStart={start} onOpenInbox={() => setTab("inbox")} />}
          {tab === "team" && bundle?.me.hasTeam && <TeamSummary t={t} lang={lang} />}
          {(tab === "inbox" || tab === "mine" || tab === "team") && <ReportList t={t} lang={lang} box={tab} query={query} accountId={bundle?.me.id ?? null} />}
          {tab === "compliance" && <ComplianceTab t={t} lang={lang} />}
          {tab === "library" && <Library t={t} bundle={bundle} />}
          {tab === "templates" && (bundle?.me.templates
            ? <TemplatesTab t={t} lang={lang} onChanged={() => void reload()} />
            : <div className={`${CARD} px-5 py-12 text-center text-[13px] text-[var(--text-dim)]`}>{bundle ? t("err.forbidden") : <SpinnerIcon size={18} />}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ── Home: what to write, and what arrived ─────────────────────────────── */

type StartFn = (key: string, date?: string, opts?: { request?: string }) => void;

/** A column's heading row: one height on both columns, so what follows
 *  starts on the same line. */
const HEAD_ROW = "flex min-h-8 items-center px-1";
const HEAD = "text-[15px] font-semibold text-[var(--text-primary)]";

function Home({ t, lang, bundle, ready, failed, creating, createError, onStart, onOpenInbox }: {
  t: T; lang: string; bundle: ReportsBundle | null; ready: boolean; failed: boolean; creating: string | null; createError: string | null;
  onStart: StartFn; onOpenInbox: () => void;
}) {
  /* What this person may start is the server's list, and only that — until
     it is here nothing is offered (a skeleton), so no one ever sees a type
     flash by that they may not start (5B), and the grid never jumps from a
     guess to the real list. */
  const allowed = useMemo(() => new Set(bundle?.templates ?? []), [bundle]);
  /* Every type this person may start, by group: the built-ins, then the
     builder's (4E) — each named from the dictionary. */
  const offered = useMemo(() => [
    ...REPORT_HEADS.filter((x) => allowed.has(x.key)).map((x) => ({ key: x.key, family: x.family, icon: x.icon, group: x.group })),
    ...(bundle?.custom ?? []).map((c) => ({ key: c.key, family: c.family, icon: c.icon, group: undefined as string | undefined })),
  ], [allowed, bundle?.custom]);
  const due = bundle?.due ?? [];
  return (
    <div className="space-y-4">
    {due.length > 0 && <DueCard t={t} due={due} creating={creating} onStart={onStart} />}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* Each family its own card (owner, 27/09/2026: "just separate them
          clearly" — it read as one endless section, 156 types in one card).
          The heading names the whole column; a family card names itself,
          with its own icon and how many of its types this person may start. */}
      <section className="min-w-0 space-y-3" aria-labelledby="kx-rep-write" aria-busy={!ready && !failed}>
        <div className={HEAD_ROW}><h2 id="kx-rep-write" className={HEAD}>{t("home.write")}</h2></div>
        {createError && <p className="px-1 text-[12.5px] text-red-400">{createError}</p>}
        {!ready ? (failed ? <div className={`${CARD} p-5 text-[12.5px] text-[var(--text-dim)]`}>{t("err.generic")}</div> : <WriteSkeleton />) : (
        <>
          {REPORT_FAMILIES.map((fam) => {
            const items = offered.filter((x) => x.family === fam);
            if (!items.length) return null;
            /* 5C: a big family shows its types under its groups (HR's seven,
               Projects' four), a builder type after them. */
            const order = FAMILY_GROUPS[fam];
            const parts = order
              ? [...order.map((g) => ({ g, list: items.filter((x) => x.group === g) })), { g: "", list: items.filter((x) => !x.group || !order.includes(x.group)) }].filter((p) => p.list.length)
              : [{ g: "", list: items }];
            return (
              <section key={fam} className={`${CARD} p-4 sm:p-5`} aria-labelledby={`kx-rep-fam-${fam}`}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
                    <RrIcon name={FAMILY_ICON[fam]} size={15} />
                  </span>
                  <h3 id={`kx-rep-fam-${fam}`} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-primary)]">{t(`family.${fam}`)}</h3>
                  <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--text-dim)]">{items.length}</span>
                </div>
                <div className="space-y-3">
                {parts.map((part) => (
                <div key={part.g || "rest"}>
                {part.g && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">{t(`grp.${fam}.${part.g}`)}</p>}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {part.list.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      disabled={!!creating}
                      onClick={() => onStart(tpl.key)}
                      className="kx-hover-glow group flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-start transition-colors hover:bg-[var(--bg-surface)] disabled:opacity-60"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#567FB2]/12 text-[#9DBCE0]">
                        {creating === tpl.key ? <SpinnerIcon size={14} /> : <TemplateIcon icon={tpl.icon} size={15} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{tplName(t, tpl.key)}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-dim)]">{t(`tpl.${tpl.key}.desc`, "")}</span>
                      </span>
                    </button>
                  ))}
                </div>
                </div>
                ))}
                </div>
              </section>
            );
          })}
        </>
        )}
      </section>

      {/* Its own height, and in view while the family cards scroll by — a
          grid item stretches to its row, and the row is the whole column.
          The same heading row as "Write a report", outside the card, so the
          two columns' cards start on one line (owner, 26/09/2026: the card
          stood a heading's height above the first family card). */}
      <section className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start" aria-labelledby="kx-rep-latest">
        <div className={`${HEAD_ROW} justify-between gap-3`}>
          <h2 id="kx-rep-latest" className={HEAD}>{t("home.latest")}</h2>
          <button type="button" onClick={onOpenInbox} className="shrink-0 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("home.viewAll")}</button>
        </div>
        <div className={`${CARD} p-2 sm:p-3`}>
          {!bundle ? (
            <div className="grid place-items-center py-10"><SpinnerIcon size={18} /></div>
          ) : bundle.latest.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[var(--text-dim)]">{t("empty.inbox")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {bundle.latest.map((r) => <ReportRowItem key={r.id} r={r} t={t} lang={lang} />)}
            </ul>
          )}
        </div>
      </section>
    </div>
    </div>
  );
}

/** Each family's icon on its card (RrIcon, the house set). */
const FAMILY_ICON: Record<ReportFamily, RrIconName> = {
  work: "briefcase", team: "users", office: "building", executive: "bullseye-arrow", visits: "handshake", sales: "money",
  marketing: "megaphone", suppliers: "box-open", quality: "badge-check", logistics: "shipping-fast", service: "tools",
  travel: "plane-departure", memos: "document", hr: "id-badge", projects: "clipboard", inventory: "pallet", finance: "calculator",
  compliance: "shield-check",
};

/** "Write a report" while the list of types is on its way: the real shape —
 *  family cards, each a heading row, then cards of an icon and two lines —
 *  so the real ones land where the skeleton stood. Hidden from screen
 *  readers (the section says it is busy). */
function WriteSkeleton() {
  const bar = "block rounded bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse";
  return (
    <>
      {[6, 4].map((n, c) => (
        <div key={c} aria-hidden className={`${CARD} p-4 sm:p-5`}>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="h-8 w-8 shrink-0 rounded-lg bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
            <span className={`${bar} h-3.5 w-28`} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
                <span className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                  <span className={`${bar} h-3`} style={{ width: `${58 - (i % 3) * 9}%` }} />
                  <span className={`${bar} h-2.5 w-[88%]`} />
                  <span className={`${bar} h-2.5 w-3/5`} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Due from you (Phase 3A): what is missing, then what falls due soon ── */

function DueCard({ t, due, creating, onStart }: { t: T; due: DueItem[]; creating: string | null; onStart: StartFn }) {
  /* What an event asked for (Phase 3D) says what it is about instead. */
  const when = (d: DueItem) => d.request ? (d.subject ?? "") : d.key === "daily" ? dmyDate(d.periodKey)
    : d.key === "weekly" ? (() => { const p = periodFor("weekly", d.date); return periodLabel(p.start, p.end); })()
    : `${d.periodKey.slice(5, 7)}/${d.periodKey.slice(0, 4)}`;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-due">
      <h2 id="kx-rep-due" className="text-[14px] font-semibold text-[var(--text-primary)]">{t("due.title")}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {due.map((d) => {
          const busy = creating === (d.request ?? `${d.key}|${d.date}`);
          return (
            <li key={`${d.key}|${d.periodKey}`} className={`flex items-center gap-3 rounded-xl border p-3 ${d.state === "missing" ? "border-red-500/30 bg-red-500/[0.06]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#567FB2]/12 text-[#9DBCE0]"><TemplateIcon icon={reportHead(d.key)?.icon} size={14} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">{tplName(t, d.key)} <span className="font-normal text-[var(--text-dim)] tabular-nums">· {when(d)}</span></span>
                <span className={`block text-[11.5px] tabular-nums ${d.state === "missing" ? "text-red-500" : "text-amber-500"}`}>
                  {d.state === "missing" ? t("due.missing") : t("due.by").replace("{when}", dmyTime(d.dueAt))}
                </span>
              </span>
              <button type="button" disabled={!!creating} onClick={() => onStart(d.key, d.date, d.request ? { request: d.request } : undefined)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
                {busy && <SpinnerIcon size={11} />}{d.draftId ? t("due.continue") : t("due.write")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Inbox / My reports / Team: server-side lists ──────────────────────── */

function ReportList({ t, lang, box, query, accountId }: { t: T; lang: string; box: "inbox" | "mine" | "team"; query: string; accountId: string | null }) {
  const list = useServerList<ReportListRow>({
    resource: `work-reports:${box}`,
    endpoint: "/api/work-reports",
    scope: { accountId },
    fixedParams: { box },
    pageSize: 25,
    initialSort: { field: box === "mine" ? "updated" : "submitted", dir: "desc" },
  });
  const { setQuery } = list;
  useEffect(() => { setQuery(query); }, [query, setQuery]);

  if (list.isInitialLoading) return <div className={`${CARD} grid place-items-center py-14`}><SpinnerIcon size={18} /></div>;
  if (list.isError && list.rows.length === 0) {
    return <div className={`${CARD} px-5 py-8 text-center text-[13px] text-[var(--text-dim)]`}>{t("err.generic")} <button type="button" onClick={() => void list.refetch()} className="ms-2 underline">↻</button></div>;
  }
  if (list.rows.length === 0) {
    return <div className={`${CARD} px-5 py-12 text-center text-[13px] text-[var(--text-dim)]`}>{query ? t("empty.search") : box === "mine" ? t("empty.mine") : box === "team" ? t("empty.team") : t("empty.inbox")}</div>;
  }
  return (
    <section className={`${CARD} p-2 sm:p-3`}>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {list.rows.map((r) => <ReportRowItem key={r.id} r={r} t={t} lang={lang} showAuthor={box !== "mine"} />)}
      </ul>
      {(list.page > 1 || list.hasMore) && (
        <div className="flex items-center justify-between gap-2 px-2 pt-3 pb-1 text-[12px]">
          <button type="button" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-secondary)] disabled:opacity-40">‹</button>
          <span className="tabular-nums text-[var(--text-dim)]">{list.page}{list.total != null ? ` / ${Math.max(1, Math.ceil(list.total / 25))}` : ""}</span>
          <button type="button" disabled={!list.hasMore} onClick={() => list.setPage(list.page + 1)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-secondary)] disabled:opacity-40">›</button>
        </div>
      )}
      {list.isRefreshing && <div className="flex justify-center pb-2"><SpinnerIcon size={12} /></div>}
    </section>
  );
}

/* ── Library: the number reports each app already builds ──────────────── */

function Library({ t, bundle }: { t: T; bundle: ReportsBundle | null }) {
  const [hrOpen, setHrOpen] = useState(false);
  const lib = bundle?.library;
  const links: Array<{ show: boolean; href: string; icon: "clock" | "receipt" | "balance-scale-left" | "clipboard"; title: string; hint: string }> = [
    { show: !!lib?.hr, href: "/hr?tab=attendance", icon: "clock", title: t("library.attendance"), hint: t("library.attendanceHint") },
    { show: !!lib?.finance, href: "/reports/operational", icon: "receipt", title: t("library.operational"), hint: t("library.operationalHint") },
    { show: !!lib?.finance, href: "/reports/statements", icon: "balance-scale-left", title: t("library.statements"), hint: t("library.statementsHint") },
    { show: !!lib?.tasks, href: "/todo/report", icon: "clipboard", title: t("library.tasks"), hint: t("library.tasksHint") },
  ];
  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4 sm:p-5`}>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("library.title")}</h2>
        <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">{t("library.hint")}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {links.filter((l) => l.show).map((l) => (
            <Link key={l.href} href={l.href} className="kx-hover-glow flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 transition-colors hover:bg-[var(--bg-surface)]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#567FB2]/12 text-[#9DBCE0]"><RrIcon name={l.icon} size={15} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{l.title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-dim)]">{l.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {lib?.hr && (
        <section className={`${CARD} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("library.hr")}</h2>
              <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">{t("library.hrHint")}</p>
            </div>
            {!hrOpen && (
              <button type="button" onClick={() => setHrOpen(true)} className="kx-hover-glow rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12.5px] font-medium text-[var(--text-primary)]">
                {t("library.open")}
              </button>
            )}
          </div>
          {hrOpen && <div className="mt-4"><HrLibrary /></div>}
        </section>
      )}
    </div>
  );
}
