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
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { reportsT } from "@/lib/translations/reports";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu, { type AppHomeNavItem } from "@/components/ui/AppHomeMenu";
import SharedKpiCard from "@/components/ui/KpiCard";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ReportsIcon from "@/components/icons/ReportsIcon";
import { useServerList } from "@/lib/hooks/useServerList";
import { REPORT_FAMILIES, REPORT_TEMPLATES, periodFor } from "@/lib/reports/templates";
import { createReport, dmyDate, dmyTime, fetchReportsBundle, localToday, periodLabel, type ReportListRow, type ReportsBundle } from "@/lib/work-reports";
import type { DueItem } from "@/lib/reports/obligations";
import { CARD, ReportRowItem, TemplateIcon, tplName, type T } from "./shared";

const HrLibrary = dynamic(() => import("./HrLibrary"), { ssr: false, loading: () => <div className="grid place-items-center py-10"><SpinnerIcon size={18} /></div> });
const ComplianceTab = dynamic(() => import("./ComplianceTab"), { ssr: false, loading: () => <div className={`${CARD} grid place-items-center py-14`}><SpinnerIcon size={18} /></div> });

type Tab = "home" | "inbox" | "mine" | "team" | "compliance" | "library";
const TABS: Tab[] = ["home", "inbox", "mine", "team", "compliance", "library"];
const WARM_KEY = "kx:reports:bundle";

export default function ReportsApp() {
  const { t, lang } = useTranslation(reportsT);
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

  const [bundle, setBundle] = useState<ReportsBundle | null>(null);
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
    } else setCreateError(res.error === "not_internal" ? t("err.notInternal") : t("err.generic"));
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
      if (!REPORT_TEMPLATES.some((x) => x.key === key)) return;
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
  ];

  const [query, setQuery] = useState("");
  const onSearch = (q: string) => { setQuery(q); if (tab === "home" || tab === "library") setTab("inbox"); };

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-12 pb-28 sm:px-6 lg:px-8">
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
          {tab === "home" && <Home t={t} bundle={bundle} creating={creating} createError={createError} onStart={start} onOpenInbox={() => setTab("inbox")} />}
          {(tab === "inbox" || tab === "mine" || tab === "team") && <ReportList t={t} box={tab} query={query} accountId={bundle?.me.id ?? null} />}
          {tab === "compliance" && <ComplianceTab t={t} lang={lang} />}
          {tab === "library" && <Library t={t} bundle={bundle} />}
        </div>
      </div>
    </div>
  );
}

/* ── Home: what to write, and what arrived ─────────────────────────────── */

type StartFn = (key: string, date?: string, opts?: { request?: string }) => void;

function Home({ t, bundle, creating, createError, onStart, onOpenInbox }: {
  t: T; bundle: ReportsBundle | null; creating: string | null; createError: string | null;
  onStart: StartFn; onOpenInbox: () => void;
}) {
  const allowed = useMemo(() => new Set(bundle?.templates ?? REPORT_TEMPLATES.filter((x) => !x.hrOnly && !x.requestOnly).map((x) => x.key)), [bundle]);
  const due = bundle?.due ?? [];
  return (
    <div className="space-y-4">
    {due.length > 0 && <DueCard t={t} due={due} creating={creating} onStart={onStart} />}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-write">
        <h2 id="kx-rep-write" className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">{t("home.write")}</h2>
        {createError && <p className="mb-3 text-[12.5px] text-red-400">{createError}</p>}
        <div className="space-y-4">
          {REPORT_FAMILIES.map((fam) => {
            const items = REPORT_TEMPLATES.filter((x) => x.family === fam && allowed.has(x.key));
            if (!items.length) return null;
            return (
              <div key={fam}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">{t(`family.${fam}`)}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      disabled={!!creating}
                      onClick={() => onStart(tpl.key)}
                      className="kx-hover-glow group flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-start transition-colors hover:bg-[var(--bg-surface)] disabled:opacity-60"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#567FB2]/12 text-[#9DBCE0]">
                        {creating === tpl.key ? <SpinnerIcon size={14} /> : <TemplateIcon templateKey={tpl.key} size={15} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{tplName(t, tpl.key)}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-dim)]">{t(`tpl.${tpl.key}.desc`)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${CARD} p-2 sm:p-3`} aria-labelledby="kx-rep-latest">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <h2 id="kx-rep-latest" className="text-[14px] font-semibold text-[var(--text-primary)]">{t("home.latest")}</h2>
          <button type="button" onClick={onOpenInbox} className="text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("home.viewAll")}</button>
        </div>
        {!bundle ? (
          <div className="grid place-items-center py-10"><SpinnerIcon size={18} /></div>
        ) : bundle.latest.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-[var(--text-dim)]">{t("empty.inbox")}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {bundle.latest.map((r) => <ReportRowItem key={r.id} r={r} t={t} />)}
          </ul>
        )}
      </section>
    </div>
    </div>
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
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#567FB2]/12 text-[#9DBCE0]"><TemplateIcon templateKey={d.key} size={14} /></span>
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

function ReportList({ t, box, query, accountId }: { t: T; box: "inbox" | "mine" | "team"; query: string; accountId: string | null }) {
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
        {list.rows.map((r) => <ReportRowItem key={r.id} r={r} t={t} showAuthor={box !== "mine"} />)}
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
