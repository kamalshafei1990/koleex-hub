"use client";

/* ---------------------------------------------------------------------------
   /super-admin/activity — live monitoring panel (Super Admin only).

   KPI cards · live online users · realtime activity feed · filters ·
   user-detail drawer. Reads SA-gated server routes via short polling (no anon
   realtime → activity data never reaches a non-admin client). Brand-aligned
   monochrome with status colours used only functionally.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fpAvatar } from "@/lib/cdn";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import UserActivityDrawer from "@/components/super-admin/UserActivityDrawer";
import AlertPreferencesModal from "@/components/super-admin/AlertPreferencesModal";
import { routeToModule, eventLabel } from "@/lib/activity/modules";

/* ── client-side mirror types ── */
interface AccountInfo {
  account_id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  role: string | null;
  avatar_url: string | null;
}
interface OnlineRow {
  session_id: string;
  account: AccountInfo;
  status: "online" | "idle" | "offline";
  current_route: string | null;
  current_module: string | null;
  last_action: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  country: string | null;
  started_at: string;
  last_seen_at: string;
}
interface FeedRow {
  id: string;
  account: AccountInfo;
  event_type: string;
  route: string | null;
  module: string | null;
  title: string | null;
  severity: string;
  ip: string | null;
  country: string | null;
  created_at: string;
}
interface Kpis {
  online_users: number;
  active_sessions: number;
  critical_alerts_today: number;
  failed_logins_today: number;
  sensitive_actions_today: number;
}

const MONITOR_MS = 8_000;
const FEED_MS = 15_000;

function rel(ts: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(a: AccountInfo): string {
  const n = a.name || a.username || a.email || "?";
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ a, size = 32 }: { a: AccountInfo; size?: number }) {
  if (a.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={fpAvatar(a.avatar_url)}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full shrink-0 inline-flex items-center justify-center bg-[var(--bg-inverted)]/[0.08] text-[var(--text-muted)] font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(a)}
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  online: "bg-[#00CC66]",
  idle: "bg-[#FFCC00]",
  offline: "bg-[var(--text-ghost)]",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium capitalize text-[var(--text-secondary)]">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.offline}`} />
      {status}
    </span>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const cls =
    severity === "critical"
      ? "text-[#FF3333] border-[#FF3333]/30 bg-[#FF3333]/10"
      : severity === "warning"
        ? "text-[#FFCC00] border-[#FFCC00]/30 bg-[#FFCC00]/10"
        : "text-[var(--text-dim)] border-[var(--border-subtle)]";
  return (
    <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold uppercase ${cls}`}>
      {severity}
    </span>
  );
}

/* ── Live activity graph ─────────────────────────────────────────────────
   A continuously-scrolling multi-line waveform (macOS "CPU LOAD" style).
   Samples the live KPIs once a second into a rolling ring buffer so the traces
   are always moving; values are real, only the x-axis advances on idle.
   Plots several signals at once (active sessions · online users · idle) on a
   shared scale. Interactive: legend chips toggle each line; hover reads every
   line at that second. */
const GRAPH_MAX = 90; // samples kept (~90s window)
const GRAPH_SAMPLE_MS = 1000;

type GraphSample = { sessions: number; online: number; idle: number };
type SeriesKey = keyof GraphSample;

const GRAPH_SERIES: Array<{
  key: SeriesKey;
  label: string;
  color: string;
  area: boolean;
  dash?: string;
}> = [
  { key: "sessions", label: "Active sessions", color: "var(--accent)", area: true },
  { key: "online", label: "Online users", color: "var(--text-secondary)", area: false, dash: "5 4" },
  { key: "idle", label: "Idle", color: "var(--text-ghost)", area: false, dash: "2 4" },
];

function LiveActivityGraph({ kpis }: { kpis: Kpis | null }) {
  const [samples, setSamples] = useState<GraphSample[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const kpiRef = useRef<Kpis | null>(kpis);
  useEffect(() => {
    kpiRef.current = kpis;
  }, [kpis]);

  // Append a sample every second; seed a full window on first tick so the
  // traces span the whole card immediately instead of growing in.
  useEffect(() => {
    const tick = () => {
      const k = kpiRef.current;
      const sessions = k?.active_sessions ?? 0;
      const online = k?.online_users ?? 0;
      const s: GraphSample = { sessions, online, idle: Math.max(0, sessions - online) };
      setSamples((prev) => {
        const base = prev.length === 0 ? Array.from({ length: GRAPH_MAX }, () => s) : prev;
        const next = base.concat(s);
        return next.slice(Math.max(0, next.length - GRAPH_MAX));
      });
    };
    tick();
    /* WS7: don't re-sample + re-render the SVG once per second while the tab is
       hidden; a single tick on return refreshes the trace. */
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, GRAPH_SAMPLE_MS);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const W = 1000;
  const H = 110;
  const PADY = 10;
  const stepX = W / (GRAPH_MAX - 1);

  const visible = GRAPH_SERIES.filter((s) => !hidden.has(s.key));
  // Shared y-scale across every visible line, so they're comparable.
  const peak = useMemo(() => {
    let m = 1;
    for (const s of samples) for (const v of visible) m = Math.max(m, s[v.key]);
    return m;
  }, [samples, visible]);

  const yFor = (v: number) => H - PADY - (v / (peak * 1.15)) * (H - PADY * 2);
  const ptsFor = (key: SeriesKey) => samples.map((s, i) => [i * stepX, yFor(s[key])] as const);
  const linePath = (pts: ReadonlyArray<readonly [number, number]>) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const last = samples.length - 1;
  const at = hover != null && hover <= last ? hover : last;
  const valueOf = (key: SeriesKey) => (samples[at] ? samples[at][key] : 0);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(GRAPH_MAX - 1, Math.round(x / stepX))));
  };

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      // Keep at least one line visible.
      if (next.has(key)) next.delete(key);
      else if (next.size < GRAPH_SERIES.length - 1) next.add(key);
      return next;
    });

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            <ActivityIcon className="h-3.5 w-3.5" />
            Activity load
            <span className="inline-flex items-center gap-1 text-[10px] normal-case font-medium text-[#00CC66]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00CC66] animate-pulse" /> live
            </span>
          </div>
          <div className="mt-1 text-[12px] text-[var(--text-dim)]">
            {hover != null ? `${GRAPH_MAX - 1 - hover}s ago` : "now"}
          </div>
        </div>

        {/* Legend — each chip shows the current/hovered value and toggles its line. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {GRAPH_SERIES.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                title={`Toggle ${s.label}`}
                className={`group inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border transition-colors ${
                  off
                    ? "border-transparent opacity-45 hover:opacity-80"
                    : "border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[11px] text-[var(--text-secondary)]">{s.label}</span>
                <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary)]">
                  {off ? "—" : valueOf(s.key)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[110px] block cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="kx-load-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline grid */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--border-subtle)" strokeWidth={1} opacity={0.5} />
        ))}

        {/* one area + line per visible series (areas first so lines sit on top) */}
        {visible
          .filter((s) => s.area)
          .map((s) => {
            const pts = ptsFor(s.key);
            return pts.length ? (
              <path key={`a-${s.key}`} d={`${linePath(pts)} L${W},${H} L0,${H} Z`} fill="url(#kx-load-fill)" />
            ) : null;
          })}
        {visible.map((s) => {
          const pts = ptsFor(s.key);
          if (!pts.length) return null;
          return (
            <path
              key={`l-${s.key}`}
              d={linePath(pts)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          );
        })}

        {/* hover guide + a dot on every visible line */}
        {hover != null && samples[hover] && (
          <line x1={hover * stepX} x2={hover * stepX} y1={0} y2={H} stroke="var(--text-dim)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6} />
        )}
        {visible.map((s) => {
          const pts = ptsFor(s.key);
          const idx = hover != null && pts[hover] ? hover : pts.length - 1;
          const p = pts[idx];
          return p ? (
            <circle key={`d-${s.key}`} cx={p[0]} cy={p[1]} r={3.2} fill={s.color} vectorEffect="non-scaling-stroke" />
          ) : null;
        })}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--text-ghost)]">
        <span>−{GRAPH_MAX - 1}s</span>
        <span>peak {peak}</span>
        <span>now</span>
      </div>
    </div>
  );
}

export default function SuperAdminActivityPage() {
  const { data: boot, loading: bootLoading } = useMeBootstrap();
  const isSA = !!boot?.isSuperAdmin;

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [online, setOnline] = useState<OnlineRow[]>([]);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const feedQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (moduleFilter) p.set("module", moduleFilter);
    if (severityFilter) p.set("severity", severityFilter);
    if (criticalOnly) p.set("critical", "1");
    return p.toString();
  }, [search, moduleFilter, severityFilter, criticalOnly]);

  const loadMonitor = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/monitor", { credentials: "include" });
      if (res.status === 403) {
        setError("forbidden");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { kpis: Kpis; online: OnlineRow[] };
      setKpis(j.kpis);
      setOnline(j.online);
      setError(null);
    } catch {
      /* transient — keep last data */
    } finally {
      setLoadingMonitor(false);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/super-admin/feed?${feedQuery}`, { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { rows: FeedRow[] };
      setFeed(j.rows);
    } catch {
      /* transient */
    } finally {
      setLoadingFeed(false);
    }
  }, [feedQuery]);

  /* WS7 (background activity): these DB-backed pollers now skip their tick while
     the tab is hidden (matching every other poller in the app) and snap fresh
     the moment the operator returns via a visibilitychange resync — no more
     8s/15s DB reads against a backgrounded monitor tab. */
  useEffect(() => {
    if (!isSA) return;
    void loadMonitor();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMonitor();
    }, MONITOR_MS);
    const onVis = () => { if (document.visibilityState === "visible") void loadMonitor(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [isSA, loadMonitor]);

  useEffect(() => {
    if (!isSA) return;
    setLoadingFeed(true);
    void loadFeed();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadFeed();
    }, FEED_MS);
    const onVis = () => { if (document.visibilityState === "visible") void loadFeed(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [isSA, loadFeed]);

  const visibleOnline = useMemo(
    () => (onlineOnly ? online.filter((r) => r.status === "online") : online),
    [online, onlineOnly],
  );

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    feed.forEach((f) => f.module && set.add(f.module));
    online.forEach((o) => o.current_module && set.add(o.current_module));
    return Array.from(set).sort();
  }, [feed, online]);

  if (bootLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  if (!isSA || error === "forbidden") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
        <LockIcon className="h-10 w-10 text-[var(--text-ghost)]" />
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Super Admin only</h2>
        <p className="text-[13px] text-[var(--text-dim)] max-w-sm">
          This activity monitoring panel is restricted to Super Administrators.
        </p>
      </div>
    );
  }

  const selectCls =
    "h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 md:px-6 pt-4 md:pt-6">
      <PageHeader
        title="Activity Monitor"
        subtitle="Live users, sessions, and the system-wide activity feed"
        icon={<ActivityIcon className="h-5 w-5" />}
        backHref="/"
        action={
          <button
            type="button"
            onClick={() => setPrefsOpen(true)}
            className="h-9 px-3 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5"
          >
            <Settings2Icon className="h-3.5 w-3.5" />
            Alert preferences
          </button>
        }
      />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 space-y-6">
        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Online now" value={kpis?.online_users ?? "—"} icon={<UsersIcon className="h-4 w-4" />} loading={loadingMonitor && !kpis} tone="positive" />
          <KpiCard label="Active sessions" value={kpis?.active_sessions ?? "—"} icon={<MonitorIcon className="h-4 w-4" />} loading={loadingMonitor && !kpis} />
          <KpiCard label="Critical today" value={kpis?.critical_alerts_today ?? "—"} icon={<ShieldExclamationIcon className="h-4 w-4" />} loading={loadingMonitor && !kpis} tone={kpis && kpis.critical_alerts_today > 0 ? "rose" : "default"} />
          <KpiCard label="Failed logins today" value={kpis?.failed_logins_today ?? "—"} icon={<TriangleWarningIcon className="h-4 w-4" />} loading={loadingMonitor && !kpis} tone={kpis && kpis.failed_logins_today > 0 ? "warning" : "default"} />
          <KpiCard label="Sensitive actions today" value={kpis?.sensitive_actions_today ?? "—"} icon={<LockIcon className="h-4 w-4" />} loading={loadingMonitor && !kpis} />
        </div>

        {/* ── Live activity load graph (full-width, always moving) ── */}
        <LiveActivityGraph kpis={kpis} />

        {/* ── Two-column: live users + activity feed ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Live users */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden flex flex-col min-h-0">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-[var(--text-dim)]" />
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Live users</h3>
                <span className="text-[11px] text-[var(--text-dim)]">{visibleOnline.length}</span>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer select-none">
                <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} className="accent-[var(--accent)]" />
                Online only
              </label>
            </div>
            <div className="overflow-y-auto max-h-[520px]">
              {loadingMonitor && online.length === 0 ? (
                <div className="h-40 flex items-center justify-center"><SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
              ) : visibleOnline.length === 0 ? (
                <p className="h-40 flex items-center justify-center text-[12px] text-[var(--text-ghost)]">No users online right now.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {visibleOnline.map((r) => (
                    <li key={r.session_id}>
                      <button
                        type="button"
                        onClick={() => setDrawerId(r.account.account_id)}
                        className="w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <Avatar a={r.account} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{r.account.name || r.account.username || "Unknown"}</span>
                            <StatusBadge status={r.status} />
                          </div>
                          <div className="text-[11.5px] text-[var(--text-dim)] truncate">
                            {r.current_module || routeToModule(r.current_route)} · {r.browser || "?"} on {r.os || "?"}
                            {r.country ? ` · ${r.country}` : ""}
                          </div>
                        </div>
                        <div className="text-[10.5px] text-[var(--text-ghost)] shrink-0 text-end">
                          <div>{rel(r.last_seen_at)}</div>
                          <div className="truncate max-w-[120px]">{r.current_route || "—"}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Activity feed */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden flex flex-col min-h-0">
            <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)] space-y-2.5">
              <div className="flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-[var(--text-dim)]" />
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Activity feed</h3>
                {loadingFeed && <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-[var(--text-dim)]" />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px]">
                  <SearchIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    className="w-full h-9 ps-9 pe-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
                    placeholder="Search route, module, event…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select className={selectCls} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                  <option value="">All modules</option>
                  {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className={selectCls} value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setCriticalOnly(false); }}>
                  <option value="">All severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer select-none">
                  <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} className="accent-[var(--accent)]" />
                  Critical only
                </label>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[520px]">
              {loadingFeed && feed.length === 0 ? (
                <div className="h-40 flex items-center justify-center"><SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
              ) : feed.length === 0 ? (
                <p className="h-40 flex items-center justify-center text-[12px] text-[var(--text-ghost)]">No activity matches these filters.</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {feed.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setDrawerId(f.account.account_id)}
                        className="w-full text-start px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <Avatar a={f.account} size={26} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">{f.account.name || f.account.username || "Unknown"}</span>
                            <span className="text-[11.5px] text-[var(--text-secondary)] truncate">{eventLabel(f)}</span>
                            {f.severity !== "info" && <SeverityPill severity={f.severity} />}
                          </div>
                          <div className="text-[10.5px] text-[var(--text-dim)] truncate">
                            {f.module || "—"}{f.route ? ` · ${f.route}` : ""}{f.country ? ` · ${f.country}` : ""}
                          </div>
                        </div>
                        <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">{rel(f.created_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-ghost)]">
          <GlobeIcon className="h-3.5 w-3.5" /> Live data refreshes automatically. Click any user to open their full activity timeline.
        </p>
      </div>

      {drawerId && <UserActivityDrawer accountId={drawerId} onClose={() => setDrawerId(null)} onChanged={loadMonitor} />}
      {prefsOpen && <AlertPreferencesModal onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}
