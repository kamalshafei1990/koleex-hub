"use client";

/* ---------------------------------------------------------------------------
   SocialInsights — the Insights tab: each connected Facebook Page's and
   Instagram account's numbers for 7, 28 or 90 days (Meta's days, ending
   yesterday) against the days before, each with a small day-by-day line.
   The figures come from the Hub (marketing_insight_days, kept current by
   the marketing cron); opening the tab reads Meta once more when an
   account's numbers are over 6 hours old or its history is still coming
   in. The last answer per period is kept for the session, so coming back
   paints at once instead of flashing a skeleton.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import Button from "@/components/kds/Button";
import EmptyState from "@/components/kds/EmptyState";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import TrendingDownIcon from "@/components/icons/ui/TrendingDownIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import { useTranslation } from "@/lib/i18n";
import { INSIGHTS_T } from "@/lib/marketing/insights-i18n";
import { compact, dmyHm } from "@/lib/marketing/format";
import { SPACE_ROUTE, type MarketingAccountView, type MarketingSpace } from "@/lib/marketing/spaces";
import { INSIGHT_PERIODS, addDays, changePct, type InsightPeriod, type MetricView, type PeriodSummary } from "@/lib/marketing/insights";

type AccountInsights = PeriodSummary & { account: MarketingAccountView; synced_at: string | null };
type InsightsResponse = { period: InsightPeriod; end: string; accounts: AccountInsights[] };
type T = (key: string) => string;

/** Opening the tab reads Meta again after this long. */
const STALE_MS = 6 * 3600_000;

const cacheKey = (space: MarketingSpace, period: InsightPeriod) => `kx.mkt.insights.${space}.${period}`;
function readCache(key: string): InsightsResponse | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as InsightsResponse) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, data: InsightsResponse): void {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* storage blocked or full: the next visit loads again */ }
}

const dmy = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** Like Meta: exact below 10,000 (2,030), short above (8.4K). */
const figure = (n: number) => (Math.abs(n) < 10_000 ? Math.round(n).toLocaleString("en-US") : compact(n));

export default function SocialInsights({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(INSIGHTS_T);
  const router = useRouter();
  const [period, setPeriod] = useState<InsightPeriod>(28);
  const [account, setAccount] = useState<string | null>(null);
  const [data, setData] = useState<InsightsResponse | null>(() => (typeof window === "undefined" ? null : readCache(cacheKey(space, 28))));
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const periodRef = useRef(period);
  const autoRefreshed = useRef(false);

  const load = useCallback(async (p: InsightPeriod): Promise<InsightsResponse | null> => {
    setError(false);
    try {
      const res = await fetch(`/api/marketing/insights?space=${space}&period=${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as InsightsResponse;
      writeCache(cacheKey(space, p), body);
      if (periodRef.current === p) setData(body);
      return body;
    } catch {
      if (periodRef.current === p) setError(true);
      return null;
    }
  }, [space]);

  const refresh = useCallback(async (auto = false) => {
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      const res = await fetch("/api/marketing/insights/refresh", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space }),
      });
      if (!res.ok && !auto) setRefreshFailed(true);
    } catch {
      if (!auto) setRefreshFailed(true);
    }
    await load(periodRef.current);
    setRefreshing(false);
  }, [space, load]);

  useEffect(() => {
    periodRef.current = period;
    setData(readCache(cacheKey(space, period)));
    let alive = true;
    void load(period).then((body) => {
      if (!alive || !body || autoRefreshed.current) return;
      const behind = body.accounts.some((a) =>
        !a.synced_at || Date.now() - Date.parse(a.synced_at) > STALE_MS || a.days < period || a.daysBefore < period);
      if (behind) {
        autoRefreshed.current = true;
        void refresh(true);
      }
    });
    return () => { alive = false; };
  }, [period, space, load, refresh]);

  const all = data?.accounts ?? [];
  const shown = all.filter((a) => !account || a.account.id === account);

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader
        space={space}
        action={
          <Button type="button" variant="secondary" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCwIcon size={14} className={refreshing ? "motion-safe:animate-spin" : ""} />{refreshing ? t("refreshing") : t("refresh")}
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("periods")} className="flex flex-wrap gap-2">
            {INSIGHT_PERIODS.map((p) => (
              <Chip key={p} on={period === p} onClick={() => setPeriod(p)}>{t(`period.${p}`)}</Chip>
            ))}
          </div>
          {all.length > 1 && (
            <div role="group" aria-label={t("accounts")} className="flex flex-wrap gap-2 md:ms-auto">
              <Chip on={account === null} onClick={() => setAccount(null)}>{t("allAccounts")}</Chip>
              {all.map((a) => (
                <Chip key={a.account.id} on={account === a.account.id} onClick={() => setAccount(a.account.id)}>
                  <BrandGlyph name={a.account.platform} size={13} />
                  <span className="truncate">{a.account.name}</span>
                </Chip>
              ))}
            </div>
          )}
        </div>

        {refreshFailed && <p role="alert" className="text-[12px] text-[#FF3333]">{t("refreshFailed")}</p>}

        {error && !data ? (
          <EmptyState title={t("loadError")} action={<Button type="button" variant="secondary" onClick={() => void load(period)}>{t("retry")}</Button>} />
        ) : !data ? (
          <div aria-busy="true" className="flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-subtle)] p-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((j) => <div key={j} className="h-[132px] rounded-xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}
              </div>
            ))}
          </div>
        ) : all.length === 0 ? (
          <EmptyState
            title={t("empty")}
            hint={t("emptyHint")}
            action={<Button type="button" variant="secondary" onClick={() => router.push(SPACE_ROUTE[space])}>{t("openAccounts")}</Button>}
          />
        ) : (
          <>
            <p className="text-[12px] text-[var(--text-muted)]">
              <span dir="ltr" className="tabular-nums">{dmy(addDays(data.end, -(period - 1)))} – {dmy(data.end)}</span>
              {" · "}{t("vsBefore").replace("{n}", String(period))}
            </p>
            {shown.map((a) => <AccountBlock key={a.account.id} a={a} period={period} t={t} />)}
            <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">
              {t("metaDay")}{period === 90 ? ` ${t("unique90")}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
        on ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

interface Row { label: string; value: string; pct?: number | null }

function AccountBlock({ a, period, t }: { a: AccountInsights; period: InsightPeriod; t: T }) {
  const m = a.metrics;
  const platform = a.account.platform;
  const count = (v: MetricView | undefined) => (v ? figure(v.now) : "");
  const row = (key: string, v: MetricView | undefined): Row | null => (v ? { label: t(`m.${key}`), value: count(v), pct: changePct(v) } : null);
  const duration = (ms: number) => {
    const mins = Math.round(ms / 60_000);
    return mins >= 60 ? t("hm").replace("{h}", String(Math.floor(mins / 60))).replace("{m}", String(mins % 60)) : t("m").replace("{m}", String(mins));
  };
  // Each part of the two Meta split the views into — they always add up to 100%.
  const split = (m.views_followers?.now ?? 0) + (m.views_others?.now ?? 0);
  const share = (part: MetricView | undefined) => (part && split > 0 ? `${((part.now / split) * 100).toFixed(1)}%` : null);
  const collecting = a.days > 0 && (a.days < period || a.daysBefore < period);

  return (
    <section aria-label={a.account.name} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 md:p-4">
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-surface-subtle)]">
            {a.account.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.account.avatar_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <BrandGlyph name={platform} size={16} />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{a.account.name}</span>
            <span className="flex min-w-0 items-center gap-1 text-[12px] text-[var(--text-muted)]">
              <BrandGlyph name={platform} size={12} />
              <span className="truncate">{t(`kind.${platform}`)}{a.account.handle ? ` · @${a.account.handle}` : ""}</span>
            </span>
          </span>
        </span>
        <span className="ms-auto flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
          {collecting && (
            <span className="rounded-full bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
              {t("collecting").replace("{n}", String(a.days + a.daysBefore)).replace("{total}", String(period * 2))}
            </span>
          )}
          {a.synced_at && (
            <span>{t("updated").replace("{time}", "").trim()} <span dir="ltr" className="tabular-nums">{dmyHm(a.synced_at)}</span></span>
          )}
        </span>
      </header>

      {a.days === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--text-muted)]">{t("noDays")}</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {platform === "facebook" ? (
            <>
              <Card label={t("m.views")} m={m.views} value={count(m.views)} rows={[row("viewers", m.viewers)]} t={t} />
              <Card label={t("m.follows")} m={m.follows} value={count(m.follows)} rows={[row("unfollows", m.unfollows), row("net_follows", m.net_follows)]} t={t} />
              <Card label={t("m.visits")} m={m.visits} value={count(m.visits)} t={t} />
              <Card label={t("m.interactions")} m={m.interactions} value={count(m.interactions)} t={t} />
              <Card
                label={t("m.video_views")}
                m={m.video_views}
                value={count(m.video_views)}
                rows={[m.watch_ms ? { label: t("m.watch_ms"), value: duration(m.watch_ms.now), pct: changePct(m.watch_ms) } : null]}
                t={t}
              />
            </>
          ) : (
            <>
              <Card
                label={t("m.views")}
                m={m.views}
                value={count(m.views)}
                rows={[
                  share(m.views_followers) ? { label: t("fromFollowers"), value: share(m.views_followers) as string } : null,
                  share(m.views_others) ? { label: t("fromOthers"), value: share(m.views_others) as string } : null,
                ]}
                t={t}
              />
              <Card label={t("m.reach")} m={m.reach} value={count(m.reach)} t={t} />
              <Card label={t("m.follows")} m={m.follows} value={count(m.follows)} rows={[row("unfollows", m.unfollows), row("net_follows", m.net_follows)]} t={t} />
              <Card
                label={t("m.interactions")}
                m={m.interactions}
                value={count(m.interactions)}
                rows={[row("likes", m.likes), row("comments", m.comments), row("shares", m.shares), row("saves", m.saves)]}
                t={t}
              />
              <Card label={t("m.link_taps")} m={m.link_taps} value={count(m.link_taps)} t={t} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Card({ label, m, value, rows = [], t }: { label: string; m: MetricView | undefined; value: string; rows?: Array<Row | null>; t: T }) {
  if (!m) return null;
  const list = rows.filter((r): r is Row => r !== null);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-medium text-[var(--text-muted)]">{label}</span>
        <Sparkline values={m.series} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span dir="ltr" className="text-[24px] font-semibold leading-7 tabular-nums text-[var(--text-primary)]">{value}</span>
        <Change pct={changePct(m)} t={t} />
      </div>
      {list.length > 0 && (
        <dl className="flex flex-col gap-1 border-t border-[var(--border-subtle)] pt-2 text-[12px]">
          {list.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <dt className="min-w-0 truncate text-[var(--text-muted)]">{r.label}</dt>
              <dd className="flex shrink-0 items-center gap-2">
                <span dir="ltr" className="tabular-nums text-[var(--text-primary)]">{r.value}</span>
                {r.pct !== undefined && <Change pct={r.pct} t={t} small />}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Up green, down red, like Meta; nothing when there is no honest comparison. */
function Change({ pct, t, small }: { pct: number | null; t: T; small?: boolean }) {
  if (pct === null || !Number.isFinite(pct)) return null;
  const n = Math.abs(pct) < 10 ? Math.abs(pct).toFixed(1) : String(Math.round(Math.abs(pct)));
  const size = small ? "text-[11px]" : "text-[12px]";
  if (Number(n) === 0) return <span dir="ltr" className={`${size} tabular-nums text-[var(--text-dim)]`}>0%</span>;
  const up = pct > 0;
  return (
    <span
      role="img"
      aria-label={t(up ? "up" : "down").replace("{n}", n)}
      className={`inline-flex items-center gap-0.5 ${size} font-medium tabular-nums ${up ? "text-[#10B981]" : "text-[#FF3333]"}`}
    >
      {up ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />}
      <span dir="ltr">{n}%</span>
    </span>
  );
}

/** The period day by day; a missing day breaks the line. */
function Sparkline({ values }: { values: Array<number | null> }) {
  const known = values.filter((v): v is number => v !== null);
  if (values.length < 2 || known.length < 2) return null;
  const w = 84, h = 26;
  const max = Math.max(...known), min = Math.min(0, ...known);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const lines: string[] = [];
  let points: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (points.length > 1) lines.push(points.join(" "));
      points = [];
      return;
    }
    points.push(`${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`);
  });
  if (points.length > 1) lines.push(points.join(" "));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0 text-[#567FB2]">
      {lines.map((p, i) => <polyline key={i} points={p} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />)}
    </svg>
  );
}
